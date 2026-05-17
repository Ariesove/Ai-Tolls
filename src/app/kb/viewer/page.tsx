"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { hydrateFromDb, listDocs } from "@/services/rag/RAG";

export default function KBViewerPage() {
  const params = useSearchParams();
  const filename = params.get("filename") || undefined;
  const chunkStr = params.get("chunk");
  const chunkIndex = chunkStr ? parseInt(chunkStr, 10) : undefined;
  const startLineParam = params.get("startLine");
  const endLineParam = params.get("endLine");
  const startLine = startLineParam ? parseInt(startLineParam, 10) : undefined;
  const endLine = endLineParam ? parseInt(endLineParam, 10) : undefined;

  const [docs, setDocs] = useState(() => listDocs());
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await hydrateFromDb();
      if (!alive) return;
      if (res.success) {
        setDocs(listDocs());
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!listRef.current) return;
    if (filename && typeof chunkIndex === "number") {
      const items = listRef.current.querySelectorAll<HTMLDivElement>(
        '[data-role="kb-chunk"]',
      );
      for (const el of Array.from(items)) {
        const fn = el.getAttribute("data-filename") || "";
        const idx = el.getAttribute("data-chunk-index");
        if (fn === (filename || "") && String(chunkIndex) === idx) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("ring-2", "ring-blue-600");
          setTimeout(() => {
            el.classList.remove("ring-2", "ring-blue-600");
          }, 1600);
          break;
        }
      }
    }
  }, [filename, chunkIndex, docs.length]);

  return (
    <div className="mx-auto max-w-4xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-100">知识库查看</h1>
        <Link
          href="/"
          className="rounded border border-zinc-700 bg-zinc-800/80 px-3 py-1 text-sm text-zinc-200 hover:bg-zinc-700"
        >
          返回聊天
        </Link>
      </div>
      <div ref={listRef} className="space-y-3">
        {docs.length === 0 && (
          <div className="rounded border border-zinc-800 bg-zinc-900 p-4 text-zinc-400">
            暂无已载入的向量块
          </div>
        )}
        {docs.map((d, i) => {
          const lines = d.content.split("\n");
          const highlightStart =
            typeof startLine === "number" && typeof d.lineStart === "number"
              ? Math.max(0, startLine - d.lineStart)
              : undefined;
          const highlightEnd =
            typeof endLine === "number" && typeof d.lineStart === "number"
              ? Math.max(0, endLine - d.lineStart)
              : undefined;
          const content = lines.map((ln, idx) => {
            const shouldHighlight =
              typeof highlightStart === "number" &&
              typeof highlightEnd === "number" &&
              idx >= highlightStart &&
              idx <= highlightEnd;
            return (
              <div
                key={idx}
                className={
                  "whitespace-pre-wrap break-words text-sm " +
                  (shouldHighlight ? "bg-yellow-900/30" : "text-zinc-200")
                }
              >
                {ln}
              </div>
            );
          });
          return (
            <div
              key={i}
              data-role="kb-chunk"
              data-filename={d.filename || ""}
              data-chunk-index={
                d.chunkIndex != null ? String(d.chunkIndex) : ""
              }
              className="rounded border border-zinc-800 bg-zinc-950 p-3"
            >
              <div className="mb-1 flex items-center justify-between text-xs text-zinc-400">
                <div className="truncate">
                  {(d.filename || "粘贴内容") +
                    " · 第" +
                    ((d.chunkIndex != null ? d.chunkIndex : i) + 1) +
                    "段"}
                </div>
                <div className="text-[10px] text-zinc-500">#{i + 1}</div>
              </div>
              <div className="space-y-0.5">{content}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
