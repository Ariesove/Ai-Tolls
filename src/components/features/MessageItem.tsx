import React from "react";
import { Message } from "@/types/chat";
import { cn } from "@/lib/utils";
import { Bot, User, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { defaultSchema } from "hast-util-sanitize";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { useEffect, useId, useRef, useState } from "react";

interface MessageItemProps {
  message: Message;
  onRetry?: () => void;
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

  const CodeBlock: React.FC<{
    inline?: boolean;
    className?: string;
    children?: React.ReactNode;
  }> = ({ inline, className, children }) => {
    const language = className?.replace("language-", "") || "";
    const code = String(children ?? "");
    if (!inline && language.toLowerCase() === "mermaid") {
      return <MermaidRenderer code={code} />;
    }
    return (
      <code className="rounded bg-zinc-800/60 px-1 py-0.5">{children}</code>
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
        <img
          src={src}
          alt={typeof props.alt === "string" ? props.alt : ""}
          className="max-h-64 max-w-full rounded-lg border border-zinc-800 object-contain"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      );
    },
    code: (props: React.HTMLProps<HTMLElement>) => (
      <code className="rounded bg-zinc-800/60 px-1 py-0.5">
        {props.children}
      </code>
    ),
    pre: (props: React.HTMLProps<HTMLPreElement>) => (
      <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900 p-3">
        {props.children}
      </pre>
    ),
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
            {message.status === "sending" ? (
              <pre className="whitespace-pre-wrap break-words rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                {message.content}
              </pre>
            ) : (
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
                components={{ ...markdownComponents, code: CodeBlock } as any}
              >
                {message.content}
              </ReactMarkdown>
            )}
            {message.status === "sending" && (
              <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-zinc-400 align-middle" />
            )}
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
