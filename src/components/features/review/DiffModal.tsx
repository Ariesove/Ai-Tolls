"use client";

import React from "react";
import dynamic from "next/dynamic";
import { AgentRole } from "@/services/Agents/types";
import { useCodeReviewContext } from "./context/CodeReviewContext";

const ReactDiffViewer = dynamic(() => import("react-diff-viewer-continued"), {
  ssr: false,
});

export const DiffModal: React.FC = () => {
  const { ui, core } = useCodeReviewContext();
  const {
    isDiffOpen,
    setIsDiffOpen,
    diffTargetRole,
    setDiffTargetRole,
    diffShowOnly,
    setDiffShowOnly,
    diffSplit,
    setDiffSplit,
    diffWrap,
    setDiffWrap,
  } = ui;

  const { reviewedCode, diffTargetCode, applyToEditor } = core;

  if (!isDiffOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm">
      <div className="absolute inset-6 rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/60 px-4 py-3">
          <div className="text-sm font-semibold text-zinc-200">Diff 详情</div>
          <div className="flex items-center gap-2">
            <select
              value={diffTargetRole}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "FINAL") setDiffTargetRole("FINAL");
                else if (v === AgentRole.LINTER)
                  setDiffTargetRole(AgentRole.LINTER);
                else setDiffTargetRole(AgentRole.ARCHITECT);
              }}
              className="h-8 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-200"
            >
              <option value="FINAL">最终建议</option>
              <option value={AgentRole.LINTER}>Linter</option>
              <option value={AgentRole.ARCHITECT}>Architect</option>
            </select>
            <button
              type="button"
              className="h-8 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-200 hover:border-zinc-700"
              onClick={() => setDiffShowOnly((v) => !v)}
            >
              {diffShowOnly ? "显示全部" : "只看改动"}
            </button>
            <button
              type="button"
              className="h-8 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-200 hover:border-zinc-700"
              onClick={() => setDiffSplit((v) => !v)}
            >
              {diffSplit ? "统一视图" : "分屏视图"}
            </button>
            <button
              type="button"
              className="h-8 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-200 hover:border-zinc-700"
              onClick={() => setDiffWrap((v) => !v)}
            >
              {diffWrap ? "关闭换行" : "开启换行"}
            </button>
            <button
              type="button"
              className="h-8 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-200 hover:border-zinc-700"
              onClick={() => {
                applyToEditor(
                  diffTargetCode,
                  diffTargetRole === "FINAL" ? "FINAL" : "DIFF",
                );
                setIsDiffOpen(false);
              }}
              disabled={!diffTargetCode}
            >
              应用到输入
            </button>
            <button
              type="button"
              className="h-8 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-200 hover:border-zinc-700"
              onClick={() => setIsDiffOpen(false)}
            >
              关闭
            </button>
          </div>
        </div>
        <div
          className={
            diffWrap
              ? "h-[calc(100%-52px)] overflow-auto diff-scroll diff-wrap"
              : "h-[calc(100%-52px)] overflow-auto diff-scroll"
          }
        >
          <ReactDiffViewer
            oldValue={reviewedCode}
            newValue={diffTargetCode}
            splitView={diffSplit}
            showDiffOnly={diffShowOnly}
            disableWordDiff={false}
            styles={{
              variables: {
                dark: {
                  diffViewerBackground: "#09090b",
                  diffViewerColor: "#e4e4e7",
                  addedBackground: "rgba(34,197,94,0.16)",
                  addedColor: "#e4e4e7",
                  removedBackground: "rgba(239,68,68,0.16)",
                  removedColor: "#e4e4e7",
                  wordAddedBackground: "rgba(34,197,94,0.28)",
                  wordRemovedBackground: "rgba(239,68,68,0.28)",
                  addedGutterBackground: "rgba(34,197,94,0.10)",
                  removedGutterBackground: "rgba(239,68,68,0.10)",
                  gutterBackground: "#0b0b0f",
                  gutterBackgroundDark: "#0b0b0f",
                  highlightBackground: "rgba(99,102,241,0.12)",
                  highlightGutterBackground: "rgba(99,102,241,0.10)",
                  codeFoldGutterBackground: "#0b0b0f",
                  codeFoldBackground: "#0b0b0f",
                  emptyLineBackground: "#09090b",
                },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
};
