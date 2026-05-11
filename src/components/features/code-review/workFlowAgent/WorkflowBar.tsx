"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

export type WorkflowStepStatus = "idle" | "running" | "done" | "error";

export interface WorkflowStep {
  id: string;
  title: string;
  description?: string;
  status: WorkflowStepStatus;
  meta?: string;
  onClick?: () => void;
}

const StatusIcon: React.FC<{ status: WorkflowStepStatus }> = ({ status }) => {
  if (status === "running") {
    return <Loader2 className="h-4 w-4 text-amber-400 animate-spin" />;
  }
  if (status === "done") {
    return <CheckCircle2 className="h-4 w-4 text-green-400" />;
  }
  if (status === "error") {
    return <XCircle className="h-4 w-4 text-red-400" />;
  }
  return <div className="h-4 w-4 rounded-full border border-zinc-700" />;
};

export const WorkflowBar: React.FC<{ steps: WorkflowStep[] }> = ({ steps }) => {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-zinc-400">工作流</div>
        <div className="text-[10px] text-zinc-500">
          {steps.filter((s) => s.status === "done").length}/{steps.length} 完成
        </div>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-2">
        {steps.map((s) => {
          const clickable = typeof s.onClick === "function";
          return (
            <button
              key={s.id}
              type="button"
              onClick={s.onClick}
              disabled={!clickable}
              className={cn(
                "flex min-w-0 items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-900/30 px-3 py-2 text-left transition-colors",
                clickable
                  ? "hover:border-zinc-700 hover:bg-zinc-900/50"
                  : "cursor-default",
              )}
            >
              <div className="mt-0.5 shrink-0">
                <StatusIcon status={s.status} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-xs font-semibold text-zinc-200">
                    {s.title}
                  </div>
                  {s.meta ? (
                    <div className="shrink-0 text-[10px] text-zinc-500">
                      {s.meta}
                    </div>
                  ) : null}
                </div>
                {s.description ? (
                  <div className="mt-0.5 line-clamp-2 text-[10px] text-zinc-500">
                    {s.description}
                  </div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

