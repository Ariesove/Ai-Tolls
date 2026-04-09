"use client";

import React, { useMemo, useState } from "react";
import { AggregatedReview, AggregatedItem } from "@/services/review/aggregate";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Copy } from "lucide-react";

const ItemRow: React.FC<{ item: AggregatedItem }> = ({ item }) => {
  const tone =
    item.severity === "error"
      ? "border-red-500/30 bg-red-500/5 text-red-200"
      : item.severity === "warn"
        ? "border-amber-500/30 bg-amber-500/5 text-amber-200"
        : "border-blue-500/30 bg-blue-500/5 text-blue-200";

  return (
    <div className={cn("rounded-lg border px-3 py-2", tone)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-zinc-100">{item.title}</div>
          <div className="mt-1 text-[11px] text-zinc-300 line-clamp-2">{item.description}</div>
        </div>
        <div className="shrink-0 text-[10px] text-zinc-400 uppercase">
          {item.dimension}
        </div>
      </div>
      {item.suggestion ? (
        <div className="mt-2 rounded border border-zinc-800 bg-zinc-950/40 p-2 font-mono text-[11px] text-zinc-200">
          {item.suggestion}
        </div>
      ) : null}
    </div>
  );
};

export const SummaryCard: React.FC<{
  review: AggregatedReview;
  commandText: string;
  onCommandTextChange: (text: string) => void;
  onUseRecommended: () => void;
  ragEvidence?: { title: string; preview: string }[];
  isDraft?: boolean;
}> = ({
  review,
  commandText,
  onCommandTextChange,
  onUseRecommended,
  ragEvidence,
  isDraft,
}) => {
  const [openDetails, setOpenDetails] = useState(false);
  const [openRag, setOpenRag] = useState(false);
  const cmd = review.nextCommand;
  const canCopy = typeof navigator !== "undefined" && !!navigator.clipboard;
  const dims = review.dimensions;

  const overall = useMemo(() => {
    if (dims.length === 0) return 0;
    const avg = dims.reduce((a, d) => a + d.score, 0) / dims.length;
    return Math.round(avg);
  }, [dims]);

  const overallTone =
    overall >= 85 ? "text-green-400" : overall >= 70 ? "text-amber-400" : "text-red-400";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-zinc-400">
          总览（指挥视角）{isDraft ? " · 生成中" : ""}
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-full border border-zinc-800 bg-zinc-950/30 px-2 py-1 text-[10px] text-zinc-400">
            必做 {review.mustFix.length}
          </div>
          <div className="rounded-full border border-zinc-800 bg-zinc-950/30 px-2 py-1 text-[10px] text-zinc-400">
            可选 {review.shouldImprove.length}
          </div>
          <div className={cn("text-sm font-semibold tabular-nums", overallTone)}>{overall}</div>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/30 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
            指挥指令（参与下一轮整合）
          </div>
          <button
            type="button"
            className="rounded border border-zinc-800 bg-zinc-950/30 px-2 py-1 text-[10px] text-zinc-300 hover:border-zinc-700"
            onClick={onUseRecommended}
          >
            使用推荐
          </button>
        </div>
        <input
          value={commandText}
          onChange={(e) => onCommandTextChange(e.target.value)}
          placeholder="例如：保持行为不变；优先修复 Hooks 与类型；只做必要性能优化；不改 API"
          className="mt-2 h-9 w-full rounded-md border border-zinc-800 bg-zinc-950/40 px-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            "保持业务行为不变",
            "不改 API 接口",
            "优先修复 Hooks 依赖",
            "优先提升类型安全",
            "只做必要性能优化",
          ].map((t) => (
            <button
              key={t}
              type="button"
              className="rounded-full border border-zinc-800 bg-zinc-950/30 px-2 py-1 text-[10px] text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              onClick={() => {
                const cur = commandText.trim();
                onCommandTextChange(cur ? `${cur}，${t}` : t);
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {ragEvidence && ragEvidence.length > 0 ? (
        <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/30 p-3">
          <button
            type="button"
            className="flex w-full items-center justify-between text-left"
            onClick={() => setOpenRag((v) => !v)}
          >
            <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              RAG 命中（Top {ragEvidence.length}）
            </div>
            <div className="text-[10px] text-zinc-500">{openRag ? "收起" : "展开"}</div>
          </button>
          {openRag ? (
            <div className="mt-2 space-y-2">
              {ragEvidence.map((e, idx) => (
                <div key={idx} className="rounded border border-zinc-800 bg-zinc-950/20 p-2">
                  <div className="text-[10px] text-zinc-300">{e.title}</div>
                  <div className="mt-1 text-[10px] text-zinc-500 line-clamp-3">
                    {e.preview}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-6">
        {review.dimensions.map((d) => (
          <div key={d.dimension} className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-zinc-400 truncate">{d.label}</div>
              <div className="text-[10px] text-zinc-300 tabular-nums">{d.score}</div>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-zinc-900">
              <div
                className={cn(
                  "h-1.5 rounded-full",
                  d.score >= 85 ? "bg-green-500/70" : d.score >= 70 ? "bg-amber-500/70" : "bg-red-500/70",
                )}
                style={{ width: `${d.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
            必做 Top 3
          </div>
          {review.mustFix.length ? (
            <div className="space-y-2">
              {review.mustFix.map((it) => (
                <ItemRow key={it.id} item={it} />
              ))}
            </div>
          ) : (
            <div className="text-xs text-zinc-500">暂无必做项</div>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
            可选 Top 3
          </div>
          {review.shouldImprove.length ? (
            <div className="space-y-2">
              {review.shouldImprove.map((it) => (
                <ItemRow key={it.id} item={it} />
              ))}
            </div>
          ) : (
            <div className="text-xs text-zinc-500">暂无可选项</div>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
            推荐步骤（3-5 步）
          </div>
          <ol className="mt-2 space-y-1 text-xs text-zinc-300">
            {review.planSteps.map((s, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="text-zinc-500 tabular-nums">{idx + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              下一步指令（可复制）
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-950/30 px-2 py-1 text-[10px] text-zinc-300 hover:border-zinc-700 disabled:opacity-50"
              onClick={async () => {
                if (!canCopy) return;
                await navigator.clipboard.writeText(cmd);
              }}
              disabled={!canCopy}
              title={canCopy ? "复制指令" : "浏览器不支持复制"}
            >
              <Copy className="h-3 w-3" />
              复制
            </button>
          </div>
          <div className="mt-2 rounded border border-zinc-800 bg-zinc-950/20 p-2 text-xs text-zinc-200">
            {cmd}
          </div>
          <div className="mt-2 text-[10px] text-zinc-500">
            你负责定义目标与约束，AI 负责落地与微调。
          </div>
        </div>
      </div>

      <button
        type="button"
        className="mt-4 flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200"
        onClick={() => setOpenDetails((v) => !v)}
      >
        {openDetails ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        维度评分与依据
      </button>

      {openDetails ? (
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
          {review.dimensions.map((d) => (
            <div key={d.dimension} className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-zinc-200">{d.label}</div>
                <div className="text-xs text-zinc-300 tabular-nums">{d.score}</div>
              </div>
              <div className="mt-1 text-[10px] text-zinc-500">{d.evidence}</div>
              <div className="mt-1 text-[10px] text-zinc-400">下一步：{d.nextAction}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};
