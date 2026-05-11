"use client";

import React from "react";
import { AlertCircle } from "lucide-react";
import { AgentRole } from "@/services/agents/types";
import { useCodeReviewContext } from "./context/CodeReviewContext";

export const AgentsTab: React.FC = () => {
  const { core, ui } = useCodeReviewContext();
  const { results, applyToEditor } = core;
  const { showAgentDetails, setShowAgentDetails } = ui;

  return (
    <div className="space-y-4">
      {results.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 px-4 py-8 text-center text-sm text-zinc-500">
          暂无 Agent 结果。请先开始审查。
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-medium text-zinc-400">
              审查细节（可追溯）
            </div>
            <button
              type="button"
              className="rounded border border-zinc-800 bg-zinc-950/40 px-2 py-1 text-[10px] text-zinc-300 hover:border-zinc-700"
              onClick={() => setShowAgentDetails((v) => !v)}
            >
              {showAgentDetails ? "收起" : "展开"}
            </button>
          </div>

          {showAgentDetails && (
            <div className="mt-3 space-y-4">
              {results.map((r) => (
                <div
                  key={r.role}
                  className="rounded-lg border border-zinc-800 bg-zinc-950/20 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-zinc-200">
                        {r.role === AgentRole.LINTER
                          ? "Linter（规范/类型）"
                          : r.role === AgentRole.ARCHITECT
                            ? "Architect（架构/性能）"
                            : "Refactorer（最终整合）"}
                      </div>
                      {r.thinking && (
                        <div className="mt-1 text-[11px] text-zinc-500 line-clamp-2">
                          {r.thinking}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {r.suggestedCode && (
                        <button
                          type="button"
                          className="rounded border border-zinc-800 bg-zinc-950/40 px-2 py-1 text-[10px] text-zinc-300 hover:border-zinc-700"
                          onClick={() =>
                            applyToEditor(
                              r.suggestedCode || "",
                              r.role === AgentRole.LINTER
                                ? "LINTER"
                                : r.role === AgentRole.ARCHITECT
                                  ? "ARCHITECT"
                                  : "FINAL",
                            )
                          }
                        >
                          应用
                        </button>
                      )}
                      <div className="text-[10px] text-zinc-500 uppercase">
                        {r.role}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 space-y-2">
                    {(Array.isArray(r.comments) ? r.comments : []).map(
                      (comment, cIdx) => (
                        <div
                          key={cIdx}
                          className="rounded border border-zinc-800 bg-zinc-950/30 p-2"
                        >
                          <div className="flex items-start gap-2">
                            <AlertCircle
                              className={[
                                "mt-0.5 h-4 w-4 shrink-0",
                                comment.severity === "error"
                                  ? "text-red-400"
                                  : comment.severity === "warn"
                                    ? "text-amber-400"
                                    : "text-blue-400",
                              ].join(" ")}
                            />
                            <div className="min-w-0">
                              <div className="text-xs text-zinc-200">
                                {comment.message}
                                {typeof comment.line === "number" && (
                                  <span className="ml-2 text-[10px] text-zinc-500 tabular-nums">
                                    L{comment.line}
                                  </span>
                                )}
                              </div>
                              {comment.suggestion && (
                                <div className="mt-1 font-mono text-[11px] text-zinc-300">
                                  {comment.suggestion}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
