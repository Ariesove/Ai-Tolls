"use client";

import React from "react";
import { Message } from "@/types/chat";
import { cn } from "@/lib/utils";
import { Bot, User, AlertCircle, RefreshCw, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import type { Citation } from "@/types/chat";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { defaultSchema } from "hast-util-sanitize";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import PrismLight from "react-syntax-highlighter/dist/esm/prism-light";
import oneDark from "react-syntax-highlighter/dist/esm/styles/prism/one-dark";
import prismTypescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import prismJavascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import prismJson from "react-syntax-highlighter/dist/esm/languages/prism/json";
import prismBash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import prismPython from "react-syntax-highlighter/dist/esm/languages/prism/python";
import prismMarkup from "react-syntax-highlighter/dist/esm/languages/prism/markup";

interface MessageItemProps {
  message: Message;
  onRetry?: () => void;
}

type PrismLightModule = {
  registerLanguage?: (lang: string, syntax: unknown) => void;
};

const registerPrismLanguage = (lang: string, syntax: unknown) => {
  const mod = PrismLight as unknown as PrismLightModule;
  if (typeof mod.registerLanguage === "function") {
    mod.registerLanguage(lang, syntax);
  }
};

registerPrismLanguage("typescript", prismTypescript);
registerPrismLanguage("javascript", prismJavascript);
registerPrismLanguage("json", prismJson);
registerPrismLanguage("bash", prismBash);
registerPrismLanguage("python", prismPython);
registerPrismLanguage("markup", prismMarkup);

type PrismHighlighterComp = React.ComponentType<{
  style: unknown;
  language?: string;
  children: string;
}>;

const PrismHighlighter = PrismLight as unknown as PrismHighlighterComp;

function normalizeFenceLanguage(lang?: string): string {
  const l = (lang || "").toLowerCase();
  if (l === "ts" || l === "typescript") return "typescript";
  if (l === "js" || l === "javascript") return "javascript";
  if (l === "json") return "json";
  if (l === "bash" || l === "shell" || l === "sh") return "bash";
  if (l === "py" || l === "python") return "python";
  return "markup";
}

function isSafeImageURL(url: string): boolean {
  try {
    const u = new URL(
      url,
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost",
    );
    if (u.protocol === "blob:") return true;
    if (u.protocol === "data:") {
      return /^data:image\//i.test(url);
    }
    if (u.protocol === "https:" || u.protocol === "http:") {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function isSafeLinkURL(url?: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(
      url,
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost",
    );
    return ["http:", "https:", "mailto:", "tel:"].includes(u.protocol);
  } catch {
    return false;
  }
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  onRetry,
}) => {
  const isUser = message.role === "user";
  const isError = message.status === "error";

  function preprocessMarkdownForStreaming(md: string): string {
    const lines = md.split("\n");
    type Fence = { marker: "```" | "~~~"; lang?: string };
    const stack: Fence[] = [];
    for (const line of lines) {
      const openMatch = /^(```|~~~)\s*([a-zA-Z0-9+-_.]*)?\s*$/.exec(line);
      if (openMatch) {
        const marker = openMatch[1] as "```" | "~~~";
        const lang = (openMatch[2] || "").trim() || undefined;
        stack.push({ marker, lang });
        continue;
      }
      const closeMatch = /^(```|~~~)\s*$/.exec(line);
      if (closeMatch && stack.length > 0) {
        const marker = closeMatch[1] as "```" | "~~~";
        const last = stack[stack.length - 1];
        if (last.marker === marker) {
          stack.pop();
        }
      }
    }
    if (stack.length > 0) {
      const last = stack[stack.length - 1];
      return md + "\n" + last.marker;
    }
    return md;
  }

  const CodeInline: React.FC<{
    inline?: boolean;
    className?: string;
    children?: React.ReactNode;
  }> = ({ inline, children }) => {
    if (inline) {
      return (
        <code className="rounded bg-zinc-800/60 px-1 py-0.5">{children}</code>
      );
    }
    return <code>{children}</code>;
  };

  function extractCodeInfo(node: React.ReactNode): {
    code: string;
    language: string;
  } {
    if (React.isValidElement(node)) {
      const child = node as React.ReactElement<{
        className?: string;
        children?: React.ReactNode;
      }>;
      const language =
        typeof child.props.className === "string"
          ? child.props.className.replace("language-", "").toLowerCase()
          : "";
      const content =
        typeof child.props.children === "string"
          ? child.props.children
          : Array.isArray(child.props.children)
            ? child.props.children.join("")
            : "";
      return { code: content, language };
    }
    return { code: "", language: "" };
  }

  const CopyButton: React.FC<{ text: string }> = ({ text }) => {
    const [copied, setCopied] = useState(false);
    const onCopy = async () => {
      const markCopied = () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      };
      try {
        if (
          (navigator as any).clipboard &&
          typeof (navigator as any).clipboard.writeText === "function"
        ) {
          await (navigator as any).clipboard.writeText(text);
          markCopied();
          return;
        }
      } catch {}
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "0";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch {}
      document.body.removeChild(ta);
      if (ok) markCopied();
    };
    return (
      <button
        type="button"
        onClick={onCopy}
        aria-label="Copy code"
        className="absolute right-2 top-2 rounded-md border border-zinc-700 bg-zinc-800/80 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700"
      >
        {copied ? (
          <Check className="h-3 w-3 inline-block" />
        ) : (
          <Copy className="h-3 w-3 inline-block" />
        )}{" "}
        {copied ? "已复制" : "复制"}
      </button>
    );
  };
  const CodeBlockHighlighted: React.FC<{ code: string; language?: string }> = ({
    code,
    language,
  }) => {
    const langId = normalizeFenceLanguage(language);
    return (
      <PrismHighlighter style={oneDark} language={langId}>
        {code}
      </PrismHighlighter>
    );
  };

  const markdownComponents = {
    a: (props: React.HTMLProps<HTMLAnchorElement>) => {
      const href = typeof props.href === "string" ? props.href : "";
      const safe = isSafeLinkURL(href);
      const url = safe ? href : "#";
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="underline decoration-zinc-600 hover:decoration-zinc-400"
        >
          {props.children}
        </a>
      );
    },
    img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
      const src = typeof props.src === "string" ? props.src : "";
      if (!isSafeImageURL(src)) {
        return (
          <span className="inline-block rounded border border-red-500/40 bg-red-900/20 px-2 py-1 text-xs text-red-300 align-middle">
            Blocked image
          </span>
        );
      }
      return (
        <Image
          src={src}
          alt={typeof props.alt === "string" ? props.alt : ""}
          width={640}
          height={360}
          unoptimized
          className="max-h-64 max-w-full rounded-lg border border-zinc-800 object-contain"
          loading="lazy"
        />
      );
    },
    code: (props: React.HTMLProps<HTMLElement>) => (
      <CodeInline inline className={props.className}>
        {props.children}
      </CodeInline>
    ),
    pre: (props: React.HTMLProps<HTMLPreElement>) => {
      const info = extractCodeInfo(props.children as React.ReactNode);
      if (info.language === "mermaid") {
        return (
          <div className="relative">
            <MermaidRenderer code={info.code} />
            <CopyButton text={info.code} />
          </div>
        );
      }
      return (
        <div className="relative">
          <CodeBlockHighlighted code={info.code} language={info.language} />
          <CopyButton text={info.code} />
        </div>
      );
    },
    p: (props: React.HTMLProps<HTMLParagraphElement>) => (
      <p className="whitespace-pre-wrap break-words">{props.children}</p>
    ),
    ul: (props: React.HTMLProps<HTMLUListElement>) => (
      <ul className="list-disc pl-5">{props.children}</ul>
    ),
    ol: (props: React.HTMLProps<HTMLOListElement>) => (
      <ol className="list-decimal pl-5">{props.children}</ol>
    ),
    li: (props: React.HTMLProps<HTMLLIElement>) => (
      <li className="my-1">{props.children}</li>
    ),
  };

  return (
    <div
      className={cn(
        "flex w-full gap-4 p-4 md:px-8 transition-opacity",
        isUser ? "bg-zinc-950" : "bg-zinc-900/50",
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-sm",
          isUser ? "bg-blue-600 text-white" : "bg-zinc-700 text-zinc-100",
        )}
      >
        {isUser ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </div>
      <div className="flex-1 space-y-2 overflow-hidden">
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {message.attachments.map((att) => {
              const safe = isSafeImageURL(att.url);
              if (!safe) {
                return (
                  <div
                    key={att.id}
                    className="flex h-24 w-40 items-center justify-center rounded-lg border border-red-500/40 bg-red-900/20 text-xs text-red-300"
                    title="Blocked unsafe image URL"
                  >
                    Blocked image
                  </div>
                );
              }
              return (
                <Image
                  key={att.id}
                  src={att.url}
                  alt={att.name}
                  width={256}
                  height={256}
                  unoptimized
                  className="max-h-64 max-w-full rounded-lg border border-zinc-800 object-contain"
                />
              );
            })}
          </div>
        )}
        {message.content && (
          <div className="prose prose-sm prose-invert max-w-none text-zinc-300">
            {/* 流式阶段：若检测到代码围栏和语言，提前预加载语言模块 */}
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[
                rehypeKatex as any,
                [
                  rehypeSanitize as any,
                  {
                    ...defaultSchema,
                    attributes: {
                      ...(defaultSchema as any).attributes,
                      span: [
                        ...((defaultSchema as any).attributes?.span || []),
                        ["className", /^katex/],
                      ],
                    },
                    tagNames: [
                      ...((defaultSchema as any).tagNames || []),
                      "span",
                    ],
                  },
                ],
              ]}
              components={{ ...markdownComponents } as any}
            >
              {message.status === "sending"
                ? preprocessMarkdownForStreaming(message.content)
                : message.content}
            </ReactMarkdown>
            {message.status === "sending" && (
              <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-zinc-400 align-middle" />
            )}
          </div>
        )}
        {message.role === "assistant" &&
          Array.isArray(message.citations) &&
          message.citations.length > 0 && (
            <div className="mt-2 rounded-md border border-zinc-800 bg-zinc-900/40 p-2">
              <div className="mb-1 text-xs font-medium text-zinc-400">
                引用来源
              </div>
              <ul className="space-y-1">
                {message.citations.map((c, i) => (
                  <CitationItem key={i} c={c} />
                ))}
              </ul>
            </div>
          )}
        {isError && (
          <div className="flex items-center gap-2 text-sm text-red-400">
            <AlertCircle className="h-4 w-4" />
            <span>Failed to send message.</span>
            {onRetry && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRetry}
                className="h-auto p-0 text-red-400 hover:bg-transparent hover:text-red-300 hover:underline"
              >
                <RefreshCw className="mr-1 h-3 w-3" /> Retry
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const CitationItem: React.FC<{ c: Citation }> = ({ c }) => {
  const [expanded, setExpanded] = useState(false);
  const fileLabel = c.filename || "粘贴内容";
  const params = new URLSearchParams();
  if (c.filename) params.set("filename", c.filename);
  params.set("chunk", String(c.chunkIndex));
  if (typeof c.startLine === "number")
    params.set("startLine", String(c.startLine));
  if (typeof c.endLine === "number") params.set("endLine", String(c.endLine));
  const jumpHref = "/kb/viewer?" + params.toString();
  return (
    <li className="text-xs text-zinc-400">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="truncate">
            {fileLabel} · 第{c.chunkIndex + 1}段
            {typeof c.startLine === "number" && typeof c.endLine === "number"
              ? ` · L${c.startLine}-${c.endLine}`
              : ""}
          </span>
          {typeof c.score === "number" && (
            <span className="rounded bg-zinc-800 px-1 py-0.5 text-[10px] text-zinc-500">
              {c.score.toFixed(2)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded border border-zinc-700 bg-zinc-800/80 px-2 py-0.5 text-[11px] text-zinc-200 hover:bg-zinc-700"
          >
            {expanded ? "收起" : "展开"}
          </button>
          <Link
            href={jumpHref}
            className="rounded border border-zinc-700 bg-zinc-800/80 px-2 py-0.5 text-[11px] text-zinc-200 hover:bg-zinc-700"
          >
            查看
          </Link>
        </div>
      </div>
      {!expanded ? (
        <div className="line-clamp-2 text-zinc-500">{c.preview}</div>
      ) : (
        <div className="mt-1 whitespace-pre-wrap break-words rounded border border-zinc-800 bg-zinc-950 p-2 text-zinc-300">
          {c.hitText || c.content || c.preview}
        </div>
      )}
    </li>
  );
};

const MermaidRenderer: React.FC<{ code: string }> = ({ code }) => {
  const [svg, setSvg] = useState<string>("");
  const id = useId().replace(/[:]/g, "");
  const mounted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        if (!mounted.current) {
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            theme: "default",
          } as any);
          mounted.current = true;
        }
        const { svg } = await mermaid.render(`mmd-${id}`, code);
        if (!cancelled) setSvg(svg);
      } catch (e) {
        if (!cancelled) setSvg(`<pre>${escapeHtml(code)}</pre>`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, id]);

  return (
    <div
      className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900 p-3"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
