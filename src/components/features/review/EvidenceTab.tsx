"use client";

import React from "react";

interface EvidenceTabProps {
  ragStatus: string;
  ragMeta: any;
  kbCount: number;
  ragEvidence: any[];
  setIsKbOpen: (open: boolean) => void;
}

export const EvidenceTab: React.FC<EvidenceTabProps> = ({
  ragStatus,
  ragMeta,
  kbCount,
  ragEvidence,
  setIsKbOpen,
}) => {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium text-zinc-400">RAG 证据面板</div>
            <div className="mt-1 text-[10px] text-zinc-500">将“检索命中片段”作为可追溯依据输入到多 Agent</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded border border-zinc-800 bg-zinc-950/30 px-2 py-1 text-[10px] text-zinc-300 hover:border-zinc-700"
              onClick={() => setIsKbOpen(true)}
            >
              打开知识库
            </button>
          </div>
        </div>
        <div className="mt-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                  RAG 检索状态
                </div>
                <div className="mt-1 text-xs text-zinc-300">
                  {ragStatus === "running"
                    ? "检索中…"
                    : ragStatus === "error"
                      ? "检索失败"
                      : ragMeta
                        ? `命中 ${ragMeta.hits} / ${ragMeta.chars} chars`
                        : kbCount > 0
                          ? "待检索"
                          : "知识库为空"}
                </div>
              </div>
              <div className="shrink-0 text-[10px] text-zinc-500 tabular-nums">
                {ragMeta ? `${ragMeta.hits}` : "-"}
              </div>
            </div>
            {ragEvidence.length > 0 ? (
              <div className="mt-3 space-y-2">
                {ragEvidence.map((e, idx) => (
                  <div key={idx} className="rounded border border-zinc-800 bg-zinc-950/20 p-2">
                    <div className="text-[10px] text-zinc-300">{e.title}</div>
                    <div className="mt-1 text-[10px] text-zinc-500 line-clamp-3">
                      {e.preview}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-[11px] text-zinc-600">暂无命中片段（或尚未运行审查）。</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
