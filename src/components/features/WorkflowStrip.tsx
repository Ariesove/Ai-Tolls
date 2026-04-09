"use client";

import React from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepStatus = "idle" | "running" | "done" | "error";

export interface WorkflowStripModel {
  kbStatus: StepStatus;
  kbMeta?: string;
  retrieveStatus: StepStatus;
  retrieveMeta?: string;
  linterStatus: StepStatus;
  architectStatus: StepStatus;
  refactorStatus?: StepStatus;
  diffStatus: StepStatus;
  onOpenKb?: () => void;
}

const Icon: React.FC<{ status: StepStatus }> = ({ status }) => {
  if (status === "running") {
    return <Loader2 className="h-4 w-4 animate-spin text-amber-400" />;
  }
  if (status === "done") {
    return <CheckCircle2 className="h-4 w-4 text-green-400" />;
  }
  if (status === "error") {
    return <XCircle className="h-4 w-4 text-red-400" />;
  }
  return <div className="h-4 w-4 rounded-full border border-zinc-700" />;
};

const Node: React.FC<{
  title: string;
  subtitle?: string;
  status: StepStatus;
  meta?: string;
  onClick?: () => void;
}> = ({ title, subtitle, status, meta, onClick }) => {
  const clickable = typeof onClick === "function";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/30 px-3 py-2 text-left",
        clickable ? "hover:border-zinc-700 hover:bg-zinc-900/50" : "cursor-default",
      )}
    >
      <Icon status={status} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="truncate text-xs font-semibold text-zinc-200">{title}</div>
          {meta ? <div className="shrink-0 text-[10px] text-zinc-500">{meta}</div> : null}
        </div>
        {subtitle ? <div className="text-[10px] text-zinc-500">{subtitle}</div> : null}
      </div>
    </button>
  );
};

const Arrow = () => <div className="hidden h-px flex-1 bg-zinc-800 md:block" />;

export const WorkflowStrip: React.FC<{ model: WorkflowStripModel }> = ({ model }) => {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-zinc-400">工作流</div>
        <div className="text-[10px] text-zinc-500">先后 + 并发</div>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Node
            title="RAG 解析"
            subtitle="上传/切片入库"
            status={model.kbStatus}
            meta={model.kbMeta}
            onClick={model.onOpenKb}
          />
          <Arrow />
          <Node
            title="RAG 检索"
            subtitle="构建上下文"
            status={model.retrieveStatus}
            meta={model.retrieveMeta}
          />
          <Arrow />
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center justify-between px-1">
              <div className="text-[10px] font-medium text-zinc-500">并行审查</div>
              <div className="text-[10px] text-zinc-600">同时启动</div>
            </div>
            <div className="relative flex min-w-0 flex-col gap-2 pl-3">
              <div className="absolute bottom-1 left-0 top-1 w-px bg-zinc-800" />
              <Node title="Linter" subtitle="规范/类型" status={model.linterStatus} />
              <Node title="Architect" subtitle="架构/性能" status={model.architectStatus} />
            </div>
          </div>
          <Arrow />
          {model.refactorStatus ? (
            <>
              <Node title="最终整合" subtitle="统一输出" status={model.refactorStatus} />
              <Arrow />
            </>
          ) : null}
          <Node title="Diff" subtitle="改动对比" status={model.diffStatus} />
        </div>
      </div>
    </div>
  );
};

