"use client";

import React from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { WorkflowStrip } from "@/components/features/code-review/WorkflowStrip";
import { ReviewHistoryPanel } from "@/components/features/code-review/ReviewHistoryPanel";
import { SummaryCard } from "@/components/features/code-review/SummaryCard";
import { ScoreCard } from "@/components/features/code-review/ScoreCard";
import { AggregatedReview } from "@/services/review/aggregate";
import { AgentResult } from "@/services/agents/types";

interface OverviewTabProps {
  steps: any;
  history: any[];
  restoreSnapshot: (id: string) => void;
  openSnapshotDiff: (id: string) => void;
  clearHistory: () => void;
  aggregated: AggregatedReview | null;
  draftAggregated: AggregatedReview | null;
  commandText: string;
  setCommandText: (text: string) => void;
  ragEvidence: any[];
  results: AgentResult[];
  isReviewing: boolean;
  scores: any[];
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  steps,
  history,
  restoreSnapshot,
  openSnapshotDiff,
  clearHistory,
  aggregated,
  draftAggregated,
  commandText,
  setCommandText,
  ragEvidence,
  results,
  isReviewing,
  scores,
}) => {
  return (
    <div className="space-y-6">
      <WorkflowStrip model={steps} />

      {history.length > 0 && (
        <ReviewHistoryPanel
          history={history}
          onRestore={restoreSnapshot}
          onOpenDiff={openSnapshotDiff}
          onClear={clearHistory}
        />
      )}

      {aggregated ? (
        <SummaryCard
          review={aggregated}
          commandText={commandText}
          onCommandTextChange={setCommandText}
          onUseRecommended={() => setCommandText(aggregated.nextCommand)}
          ragEvidence={ragEvidence}
          isDraft={false}
        />
      ) : draftAggregated ? (
        <SummaryCard
          review={draftAggregated}
          commandText={commandText}
          onCommandTextChange={setCommandText}
          onUseRecommended={() => setCommandText(draftAggregated.nextCommand)}
          ragEvidence={ragEvidence}
          isDraft={true}
        />
      ) : (
        <ScoreCard title="评分概览" items={scores} />
      )}

      {results.length === 0 && !isReviewing && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 px-4 py-8">
          <div className="mx-auto flex max-w-md flex-col items-center justify-center space-y-3 text-center text-zinc-500">
            <Sparkles className="h-12 w-12 opacity-20" />
            <div className="text-sm text-zinc-400">
              点击右上角开始，让多 Agent 并行审查并输出最终可应用代码
            </div>
            <div className="text-xs text-zinc-600">
              总览与最终建议会在生成时实时刷新
            </div>
          </div>
        </div>
      )}

      {isReviewing && results.length === 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 px-4 py-8">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
            <div className="text-sm text-zinc-400">
              正在并行分发任务与构建上下文…
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
