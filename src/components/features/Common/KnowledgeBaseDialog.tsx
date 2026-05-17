"use client";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

import { addText, hydrateFromDb, search, StoredDocument } from "@/services/rag/RAG";
import * as kbApi from "@/services/api/kb";
import { BookOpen, Check, X, Search, UploadCloud } from "lucide-react";

interface KnowledgeBaseDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KnowledgeBaseDialog: React.FC<KnowledgeBaseDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const [text, setText] = useState("");
  const [isIngesting, setIsIngesting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const successTimerRef = useRef<number | null>(null);

  // Search Test State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { doc: StoredDocument; score?: number }[]
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  console.log("3333333333", 3333333333);
  const extractPdfText = useCallback(async (file: File): Promise<string> => {
    const data = await file.arrayBuffer();
    const mod = (await import("pdfjs-dist/legacy/build/pdf")) as unknown;
    const url = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.js",
      import.meta.url,
    ).toString();
    const g = (mod as { GlobalWorkerOptions?: { workerSrc?: string } })
      .GlobalWorkerOptions;
    if (g) {
      g.workerSrc = url;
    }
    const getDocument = (
      mod as {
        getDocument: (opts: { data: ArrayBuffer }) => {
          promise: Promise<{
            numPages: number;
            getPage: (n: number) => Promise<{
              getTextContent: () => Promise<{
                items: unknown[];
              }>;
            }>;
          }>;
        };
      }
    ).getDocument;
    const task = getDocument({ data });
    const pdf = await task.promise;
    let out = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const items = Array.isArray(content.items) ? content.items : [];
      const buf: string[] = [];
      for (const it of items) {
        if (
          typeof it === "object" &&
          it !== null &&
          "str" in (it as { str?: unknown }) &&
          typeof (it as { str?: unknown }).str === "string"
        ) {
          buf.push((it as { str: string }).str);
        }
      }
      out += buf.join(" ") + "\n";
    }
    console.log("out", out);
    return out;
  }, []);

  useEffect(() => {
    if (!isOpen && successTimerRef.current) {
      window.clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        window.clearTimeout(successTimerRef.current);
        successTimerRef.current = null;
      }
    };
  }, []);

  const fileHint = useMemo(() => {
    return fileName ? fileName : "未选择文件";
  }, [fileName]);

  const handleFile = useCallback(
    async (f: File | undefined | null) => {
      if (!f) return;
      setFileName(`${f.name} (${Math.round(f.size / 1024)} KB)`);
      if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
        const pdfText = await extractPdfText(f);
        setText(pdfText);
        return;
      }
      const textContent = await f.text();
      console.log("textContent", textContent);
      setText(textContent);
    },
    [extractPdfText],
  );

  const getErrorMessage = useCallback((err: unknown) => {
    if (!err) return "";
    if (typeof err === "string") return err;
    if (err instanceof Error) return err.message;
    if (typeof err === "object" && err !== null && "message" in err) {
      const msg = (err as { message?: unknown }).message;
      return typeof msg === "string" ? msg : "";
    }
    return "";
  }, []);

  const onDrop = useCallback(
    async (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f) {
        await handleFile(f);
      }
    },
    [handleFile],
  );

  const handleIngest = useCallback(async () => {
    const value = text.trim();
    if (!value) return;

    setIsIngesting(true);
    setError("");

    try {
      const source = fileName ? "file-upload" : "user-paste";
      const cleanFilename = fileName ? fileName.split(" (")[0] : "";
      const filename =
        cleanFilename ||
        `pasted-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;

      const ingestRes = await kbApi.ingest({
        filename,
        content: value,
        source,
      });

      if (ingestRes.success) {
        await hydrateFromDb();
      } else {
        await addText(value, {
          source,
          filename,
        });
      }

      setSuccess(true);
      if (successTimerRef.current) window.clearTimeout(successTimerRef.current);
      successTimerRef.current = window.setTimeout(() => {
        setSuccess(false);
      }, 1500);
    } catch (err: unknown) {
      console.error("Failed to ingest text", err);
      setError(getErrorMessage(err) || "Failed to add to knowledge base.");
    } finally {
      setIsIngesting(false);
    }
  }, [fileName, getErrorMessage, text]);

  const handleSearchTest = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setIsSearching(true);
    try {
      const results = await search(q);
      setSearchResults(results.map((r) => ({ doc: r.doc, score: r.score })));
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm">
      <div className="fixed inset-0 overflow-y-auto px-4 py-10">
        <div className="mx-auto w-full max-w-5xl">
          <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-[0_30px_120px_-30px_rgba(0,0,0,0.9)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_420px_at_20%_0%,rgba(59,130,246,0.15),transparent_60%),radial-gradient(700px_380px_at_85%_10%,rgba(16,185,129,0.10),transparent_55%),radial-gradient(600px_360px_at_40%_110%,rgba(244,63,94,0.08),transparent_55%)]" />

            <div className="relative border-b border-zinc-800 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/40 text-blue-300">
                    <BookOpen size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-lg font-semibold text-zinc-100">
                        Knowledge Base
                      </h2>
                      <span className="rounded-full border border-zinc-800 bg-zinc-950/30 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                        RAG
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-400">
                      上传资料或粘贴上下文，用于检索增强与可追溯引用
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  aria-label="关闭"
                  className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-2 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="relative grid gap-6 p-6 md:grid-cols-5">
              <div className="md:col-span-3">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/30">
                  <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-zinc-200">
                        入库内容
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-500">
                        支持文本/Markdown/PDF。建议只放“可复用规则/接口/业务说明”
                      </div>
                    </div>
                    <div className="rounded-full border border-zinc-800 bg-zinc-950/30 px-2 py-1 text-[10px] text-zinc-400 tabular-nums">
                      {text.length.toLocaleString()} chars
                    </div>
                  </div>

                  <div className="p-4 space-y-4">
                    <Textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="粘贴文档、接口说明、业务规则或代码片段…"
                      className="min-h-[180px] resize-none border-zinc-800 bg-zinc-900/40 text-zinc-100 focus:border-blue-500/50 focus:ring-blue-500/20"
                    />

                    <label
                      htmlFor="kb-file"
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={onDrop}
                      className={[
                        "group relative block overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/20 p-4 transition",
                        dragging
                          ? "border-blue-500/70 bg-blue-500/5"
                          : "hover:border-zinc-700",
                      ].join(" ")}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950/40 text-zinc-300">
                          <UploadCloud className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-medium text-zinc-200">
                              拖拽文件到此
                            </div>
                            <span className="text-xs text-zinc-500">
                              或点击选择
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-zinc-800 bg-zinc-950/30 px-2 py-0.5 text-[10px] text-zinc-400">
                              .txt
                            </span>
                            <span className="rounded-full border border-zinc-800 bg-zinc-950/30 px-2 py-0.5 text-[10px] text-zinc-400">
                              .md
                            </span>
                            <span className="rounded-full border border-zinc-800 bg-zinc-950/30 px-2 py-0.5 text-[10px] text-zinc-400">
                              .pdf
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <div className="min-w-0 truncate text-[11px] text-zinc-500">
                              {fileHint}
                            </div>
                            <button
                              type="button"
                              className="rounded-md border border-zinc-800 bg-zinc-950/30 px-2 py-1 text-[11px] text-zinc-200 hover:border-zinc-700"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              选择文件
                            </button>
                          </div>
                        </div>
                      </div>
                      <input
                        ref={fileInputRef}
                        id="kb-file"
                        type="file"
                        accept=".txt,.md,.markdown, text/plain, text/markdown, application/pdf"
                        className="hidden"
                        onChange={(e) =>
                          handleFile(e.target.files?.[0] ?? null)
                        }
                      />
                    </label>

                    {error ? (
                      <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        {error}
                      </div>
                    ) : null}

                    <div className="flex items-center justify-end gap-2">
                      <Button
                        onClick={handleIngest}
                        disabled={!text.trim() || isIngesting}
                        className="bg-blue-600 hover:bg-blue-500"
                      >
                        {isIngesting ? (
                          "Adding..."
                        ) : success ? (
                          <span className="flex items-center gap-2">
                            <Check size={16} /> Added
                          </span>
                        ) : (
                          "Add to Knowledge Base"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/30">
                  <div className="border-b border-zinc-800 px-4 py-3">
                    <div className="text-xs font-semibold text-zinc-200">
                      检索测试
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-500">
                      用一条问题验证相似度检索是否命中
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="输入要检索的 query…"
                        className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSearchTest();
                        }}
                      />
                      <Button
                        onClick={handleSearchTest}
                        disabled={isSearching || !searchQuery.trim()}
                        className="shrink-0"
                      >
                        <Search size={16} className="mr-2" />
                        {isSearching ? "Searching..." : "Test"}
                      </Button>
                    </div>

                    {searchResults.length > 0 ? (
                      <div className="space-y-2">
                        {searchResults.slice(0, 6).map((res, idx) => (
                          <div
                            key={idx}
                            className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[10px] text-zinc-500">
                                匹配片段
                              </div>
                              <div className="text-[10px] text-zinc-500 tabular-nums">
                                {typeof res.score === "number"
                                  ? res.score.toFixed(4)
                                  : ""}
                              </div>
                            </div>
                            <div className="mt-2 text-sm leading-relaxed text-zinc-300">
                              {res.doc.pageContent.slice(0, 140)}
                              {res.doc.pageContent.length > 140 ? "…" : ""}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950/20 px-4 py-6">
                        <div className="text-sm text-zinc-300">还没有结果</div>
                        <div className="mt-1 text-[11px] text-zinc-500">
                          输入 query 并点击 Test，查看 Top matches
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/20 px-4 py-3">
                  <div className="text-[11px] text-zinc-500">
                    小建议：把“规则/接口/边界条件/错误码”入库，比整段源码更容易检索命中
                  </div>
                </div>
              </div>
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭遮罩"
            onClick={onClose}
            className="fixed inset-0 -z-10"
          />
        </div>
      </div>
    </div>
  );
};
