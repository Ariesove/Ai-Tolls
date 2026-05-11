"use client";

import React from "react";
import { FileText } from "lucide-react";
import { Textarea } from "@/components/ui/Textarea";
import { useCodeReviewContext } from "./context/CodeReviewContext";

export const SourceEditor: React.FC = () => {
  const { ui, core } = useCodeReviewContext();

  if (ui.layoutMode !== "split") return null;

  return (
    <section className="col-span-5 flex min-w-0 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/35">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-900/60 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-zinc-500" />
            <div className="truncate text-xs font-semibold text-zinc-200">
              输入源代码（TSX/TS）
            </div>
          </div>
          <div className="mt-1 text-[10px] text-zinc-500">
            建议粘贴单文件组件；审查会自动并行分发到多个 Agent
          </div>
        </div>
        {core.lastApplied ? (
          <div className="flex items-center gap-2">
            <div className="text-[10px] text-zinc-500">
              已应用：{core.lastApplied.from}
            </div>
            <button
              type="button"
              className="rounded border border-zinc-800 bg-zinc-950/40 px-2 py-1 text-[10px] text-zinc-300 hover:border-zinc-700"
              onClick={core.undoApply}
            >
              撤销
            </button>
          </div>
        ) : null}
      </div>
      <Textarea
        ref={core.editorRef}
        className="flex-1 w-full resize-none border-0 bg-transparent p-4 font-mono text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
        placeholder="请在此粘贴你想审查与重构的代码..."
        value={core.code}
        onChange={(e) => core.setCode(e.target.value)}
      />
    </section>
  );
};
