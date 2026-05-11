"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface ScoreItem {
  id: string;
  label: string;
  score: number;
  hint?: string;
}

const clampScore = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export const ScoreCard: React.FC<{
  title?: string;
  items: ScoreItem[];
}> = ({ title = "评分", items }) => {
  const safeItems = items.map((it) => ({ ...it, score: clampScore(it.score) }));
  const isEmpty = safeItems.length === 0 || safeItems.every((it) => it.score === 0);
  const overall =
    safeItems.length > 0
      ? Math.round(
          safeItems.reduce((acc, it) => acc + it.score, 0) / safeItems.length,
        )
      : 0;

  const overallTone =
    overall >= 85 ? "text-green-400" : overall >= 70 ? "text-amber-400" : "text-red-400";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-zinc-400">{title}</div>
        {isEmpty ? (
          <div className="text-[10px] text-zinc-500">等待审查结果</div>
        ) : (
          <div className={cn("text-sm font-semibold tabular-nums", overallTone)}>
            {overall}
          </div>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {safeItems.map((it) => (
          <div key={it.id} className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 truncate text-xs text-zinc-300">
                {it.label}
              </div>
              <div className="shrink-0 text-[10px] text-zinc-500 tabular-nums">
                {it.score}
              </div>
            </div>
            <div className="h-2 rounded-full bg-zinc-900">
              <div
                className={cn(
                  "h-2 rounded-full",
                  it.score >= 85
                    ? "bg-green-500/70"
                    : it.score >= 70
                      ? "bg-amber-500/70"
                      : "bg-red-500/70",
                )}
                style={{ width: `${it.score}%` }}
              />
            </div>
            {it.hint ? (
              <div className="text-[10px] text-zinc-500">{it.hint}</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
};
