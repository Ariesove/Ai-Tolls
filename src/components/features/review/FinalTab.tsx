"use client";

import React from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import oneDark from "react-syntax-highlighter/dist/esm/styles/prism/one-dark";

interface FinalTabProps {
  finalCode: string;
  isReviewing: boolean;
  draftFinalCode: string;
  applyToEditor: (code: string, from: any) => void;
  setIsDiffOpen: (open: boolean) => void;
}

export const FinalTab: React.FC<FinalTabProps> = ({
  finalCode,
  isReviewing,
  draftFinalCode,
  applyToEditor,
  setIsDiffOpen,
}) => {
  return (
    <div className="space-y-6">
      {!finalCode && isReviewing && draftFinalCode && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-medium text-zinc-400">最终建议（流式生成中）</div>
              <div className="mt-1 text-[10px] text-zinc-500">代码正在生成，完成后可直接 Diff / 应用</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/30 px-2 py-1 text-[10px] text-zinc-500">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                STREAM
              </div>
            </div>
          </div>
          <div className="mt-3 rounded-lg overflow-hidden border border-zinc-800 shadow-2xl">
            <SyntaxHighlighter
              language="typescript"
              style={oneDark}
              customStyle={{
                margin: 0,
                padding: "1rem",
                fontSize: "12px",
                background: "#0b0b0f",
              }}
            >
              {draftFinalCode}
            </SyntaxHighlighter>
          </div>
        </div>
      )}

      {finalCode && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-medium text-zinc-400">最终建议（推荐）</div>
              <div className="mt-1 text-[10px] text-zinc-500">已整合并行审查结论，默认只看这一份 Diff</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded border border-zinc-800 bg-zinc-950/40 px-2 py-1 text-[10px] text-zinc-300 hover:border-zinc-700"
                onClick={() => applyToEditor(finalCode, "FINAL")}
              >
                应用到输入
              </button>
              <button
                type="button"
                className="rounded border border-zinc-800 bg-zinc-950/40 px-2 py-1 text-[10px] text-zinc-300 hover:border-zinc-700"
                onClick={() => setIsDiffOpen(true)}
              >
                打开 Diff
              </button>
            </div>
          </div>
          <div className="mt-3 rounded-lg overflow-hidden border border-zinc-800 shadow-2xl">
            <SyntaxHighlighter
              language="typescript"
              style={oneDark}
              customStyle={{
                margin: 0,
                padding: "1rem",
                fontSize: "12px",
                background: "#0b0b0f",
              }}
            >
              {finalCode}
            </SyntaxHighlighter>
          </div>
        </div>
      )}

      {!finalCode && !isReviewing && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 px-4 py-8 text-center text-sm text-zinc-500">
          还没有最终建议。请先开始审查。
        </div>
      )}
    </div>
  );
};
