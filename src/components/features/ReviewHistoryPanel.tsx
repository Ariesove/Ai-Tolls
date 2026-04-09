"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";

export interface ReviewSnapshot {
  id: string;
  ts: number;
  code: string;
  commandText: string;
  finalCode: string;
  aggregated: unknown;
  overallScore: number;
  mustFixCount: number;
  ragMeta?: { hits: number; chars: number } | null;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

const lcsLength = (a: string[], b: string[]) => {
  const n = a.length;
  const m = b.length;
  let prev = new Array(m + 1).fill(0);
  let cur = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    cur[0] = 0;
    for (let j = 1; j <= m; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    const tmp = prev;
    prev = cur;
    cur = tmp;
  }
  return prev[m] as number;
};

const approxChangedLines = (before: string, after: string, cap = 220) => {
  const aAll = before.replace(/\r\n/g, "\n").split("\n");
  const bAll = after.replace(/\r\n/g, "\n").split("\n");
  const a = aAll.slice(0, cap);
  const b = bAll.slice(0, cap);
  const lcs = lcsLength(a, b);
  const core = (a.length - lcs) + (b.length - lcs);
  const spill = Math.abs(aAll.length - a.length) + Math.abs(bAll.length - b.length);
  return core + spill;
};

export const ReviewHistoryPanel: React.FC<{
  history: ReviewSnapshot[];
  onRestore: (id: string) => void;
  onOpenDiff: (id: string) => void;
  onClear: () => void;
}> = ({ history, onRestore, onOpenDiff, onClear }) => {
  const head = history[0];
  const prev = history[1];

  const deltas = useMemo(() => {
    if (!head || !prev) return null;
    const scoreDelta = clamp(head.overallScore) - clamp(prev.overallScore);
    const mustFixDelta = head.mustFixCount - prev.mustFixCount;
    const finalDelta = approxChangedLines(prev.finalCode, head.finalCode);
    return { scoreDelta, mustFixDelta, finalDelta };
  }, [head, prev]);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-zinc-400">迭代历史</div>
        <button
          type="button"
          className="rounded border border-zinc-800 bg-zinc-950/30 px-2 py-1 text-[10px] text-zinc-300 hover:border-zinc-700"
          onClick={onClear}
        >
          清空
        </button>
      </div>

      {deltas ? (
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-3">
            <div className="text-[10px] text-zinc-500">评分变化</div>
            <div className={cn("mt-1 text-sm font-semibold tabular-nums", deltas.scoreDelta >= 0 ? "text-green-400" : "text-red-400")}>
              {deltas.scoreDelta >= 0 ? `+${deltas.scoreDelta}` : `${deltas.scoreDelta}`}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-3">
            <div className="text-[10px] text-zinc-500">必做项变化</div>
            <div className={cn("mt-1 text-sm font-semibold tabular-nums", deltas.mustFixDelta <= 0 ? "text-green-400" : "text-amber-400")}>
              {deltas.mustFixDelta >= 0 ? `+${deltas.mustFixDelta}` : `${deltas.mustFixDelta}`}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-3">
            <div className="text-[10px] text-zinc-500">Final 变化（≈行）</div>
            <div className="mt-1 text-sm font-semibold text-zinc-200 tabular-nums">
              {deltas.finalDelta}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 text-xs text-zinc-500">至少完成两轮审查后才会显示对比</div>
      )}

      <div className="mt-3 space-y-2">
        {history.map((s, idx) => (
          <div
            key={s.id}
            className={cn(
              "rounded-lg border border-zinc-800 bg-zinc-950/30 p-3",
              idx === 0 ? "ring-1 ring-indigo-500/20" : undefined,
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-zinc-200">
                  {idx === 0 ? "当前" : `第 ${idx + 1} 轮`}
                </div>
                <div className="mt-1 text-[10px] text-zinc-500">
                  {new Date(s.ts).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-full border border-zinc-800 bg-zinc-950/30 px-2 py-1 text-[10px] text-zinc-400 tabular-nums">
                  {clamp(s.overallScore)}
                </div>
                <div className="rounded-full border border-zinc-800 bg-zinc-950/30 px-2 py-1 text-[10px] text-zinc-400">
                  必做 {s.mustFixCount}
                </div>
              </div>
            </div>
            {s.commandText.trim() ? (
              <div className="mt-2 rounded border border-zinc-800 bg-zinc-950/20 p-2 text-[10px] text-zinc-400 line-clamp-2">
                {s.commandText.trim()}
              </div>
            ) : null}
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="text-[10px] text-zinc-500">
                {s.ragMeta ? `RAG 命中 ${s.ragMeta.hits}` : "RAG 未记录"}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded border border-zinc-800 bg-zinc-950/30 px-2 py-1 text-[10px] text-zinc-300 hover:border-zinc-700"
                  onClick={() => onOpenDiff(s.id)}
                >
                  查看 Diff
                </button>
                <button
                  type="button"
                  className="rounded border border-zinc-800 bg-zinc-950/30 px-2 py-1 text-[10px] text-zinc-300 hover:border-zinc-700"
                  onClick={() => onRestore(s.id)}
                >
                  回滚
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

