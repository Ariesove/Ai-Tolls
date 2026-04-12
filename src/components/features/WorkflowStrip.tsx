"use client";

import React from "react";
import {
  CheckCircle2,
  Loader2,
  XCircle,
  Database,
  Search,
  GitMerge,
  Diff,
  ArrowDown,
  ArrowRight,
} from "lucide-react";
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

type StatusTone = {
  dot: string;
  border: string;
  bg: string;
  text: string;
  rail: string;
};

const tone = (s: StepStatus): StatusTone => {
  if (s === "running")
    return {
      dot: "bg-amber-400",
      border: "border-amber-500/40",
      bg: "bg-amber-500/8",
      text: "text-amber-100",
      rail: "bg-amber-400/60",
    };
  if (s === "done")
    return {
      dot: "bg-green-400",
      border: "border-green-500/40",
      bg: "bg-green-500/8",
      text: "text-green-100",
      rail: "bg-green-400/60",
    };
  if (s === "error")
    return {
      dot: "bg-red-400",
      border: "border-red-500/40",
      bg: "bg-red-500/8",
      text: "text-red-100",
      rail: "bg-red-400/60",
    };
  return {
    dot: "bg-zinc-600",
    border: "border-zinc-800",
    bg: "bg-zinc-900/20",
    text: "text-zinc-300",
    rail: "bg-zinc-700",
  };
};

const StatusDot: React.FC<{ s: StepStatus; pulse?: boolean }> = ({
  s,
  pulse,
}) => {
  const t = tone(s);
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        t.dot,
        s === "running" && "animate-pulse",
        pulse && "shadow-[0_0_6px_rgba(251,191,36,0.5)]",
      )}
    />
  );
};

const StatusIcon: React.FC<{ s: StepStatus }> = ({ s }) => {
  if (s === "running")
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />;
  if (s === "done")
    return <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />;
  if (s === "error") return <XCircle className="h-3.5 w-3.5 text-red-400" />;
  return <span className="text-zinc-700">—</span>;
};

interface RailProps {
  status: StepStatus;
  direction?: "h" | "v";
  len?: number;
}

const Rail: React.FC<RailProps> = ({ status, direction = "h", len = 24 }) => {
  const t = tone(status);
  if (direction === "v") {
    return (
      <div
        className={cn("w-[2px] shrink-0 rounded-full", t.rail, "mx-auto")}
        style={{ height: len }}
      />
    );
  }
  return (
    <div
      className={cn(
        "h-[2px] shrink-0 rounded-full flex-1 min-w-[16px]",
        t.rail,
      )}
    />
  );
};

interface StepCardProps {
  title: string;
  subtitle?: string;
  status: StepStatus;
  meta?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  badge?: string;
}

const StepCard: React.FC<StepCardProps> = ({
  title,
  subtitle,
  status,
  meta,
  icon,
  onClick,
  badge,
}) => {
  const t = tone(status);
  const clickable = typeof onClick === "function";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={cn(
        "relative flex w-full min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all",
        t.border,
        t.bg,
        clickable
          ? "cursor-pointer hover:border-zinc-600 hover:bg-zinc-900/40"
          : "cursor-default",
        status === "running" && "shadow-[0_0_0_1px_rgba(251,191,36,0.15)]",
      )}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950/50">
        {icon ? (
          <span className="text-zinc-400">{icon}</span>
        ) : (
          <StatusIcon s={status} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn("truncate text-xs font-semibold", t.text)}>
            {title}
          </span>
          {meta && (
            <span className="shrink-0 rounded-full border border-zinc-800 bg-zinc-950/40 px-1.5 py-0.5 text-[10px] text-zinc-500 tabular-nums">
              {meta}
            </span>
          )}
          {badge && (
            <span className="shrink-0 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] text-indigo-300">
              {badge}
            </span>
          )}
        </div>
        {subtitle && (
          <div className="mt-0.5 truncate text-[10px] text-zinc-500">
            {subtitle}
          </div>
        )}
      </div>
      {status === "running" && (
        <span className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent animate-pulse" />
      )}
    </button>
  );
};

export const WorkflowStrip: React.FC<{ model: WorkflowStripModel }> = ({
  model,
}) => {
  const hasRefactor = Boolean(model.refactorStatus);

  const overallRunning = [
    model.kbStatus,
    model.retrieveStatus,
    model.linterStatus,
    model.architectStatus,
    model.refactorStatus,
    model.diffStatus,
  ].some((s) => s === "running");
  const overallDone = [
    model.kbStatus,
    model.retrieveStatus,
    model.linterStatus,
    model.architectStatus,
    model.diffStatus,
  ].every((s) => s === "done");
  const overallError = [
    model.kbStatus,
    model.retrieveStatus,
    model.linterStatus,
    model.architectStatus,
    model.refactorStatus,
    model.diffStatus,
  ].some((s) => s === "error");
  const overallStatus: StepStatus = overallError
    ? "error"
    : overallRunning
      ? "running"
      : overallDone
        ? "done"
        : "idle";

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusDot s={overallStatus} pulse />
          <span className="text-xs font-semibold text-zinc-300">PIPELINE</span>
          <span className="text-[10px] text-zinc-600">多 Agent 协作</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px]",
              overallStatus === "running"
                ? "border-amber-500/30 text-amber-400"
                : overallStatus === "done"
                  ? "border-green-500/30 text-green-400"
                  : overallStatus === "error"
                    ? "border-red-500/30 text-red-400"
                    : "border-zinc-800 text-zinc-500",
            )}
          >
            {overallStatus === "running"
              ? "运行中"
              : overallStatus === "done"
                ? "完成"
                : overallStatus === "error"
                  ? "异常"
                  : "待机"}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {/* 阶段一：KB → RAG */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="flex flex-1 gap-2">
              <div className="flex flex-col gap-2">
                <StepCard
                  title="RAG 解析"
                  subtitle="上传 / 切片入库"
                  status={model.kbStatus}
                  meta={model.kbMeta}
                  icon={<Database className="h-3.5 w-3.5" />}
                  onClick={model.onOpenKb}
                />
              </div>
              <Rail direction="v" len={52} />
              <div className="flex flex-1 flex-col gap-2">
                <StepCard
                  title="RAG 检索"
                  subtitle="构建上下文"
                  status={model.retrieveStatus}
                  meta={model.retrieveMeta}
                  icon={<Search className="h-3.5 w-3.5" />}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 并行分叉指示 */}
        <div className="flex items-center gap-1.5">
          <Rail status={model.linterStatus} />
          <div className="flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/40 px-2 py-0.5 text-[10px] text-zinc-500">
            <ArrowDown className="h-3 w-3" />
            并行分叉
          </div>
          <Rail status={model.architectStatus} />
        </div>

        {/* 阶段二：并行审查 Linter ⬇ Architect */}
        <div className="grid grid-cols-2 gap-2">
          <StepCard
            title="Linter"
            subtitle="规范 / 类型"
            status={model.linterStatus}
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          />
          <StepCard
            title="Architect"
            subtitle="架构 / 性能"
            status={model.architectStatus}
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          />
        </div>

        {/* 并行合并指示 */}
        {model.refactorStatus && (
          <div className="flex items-center gap-1.5">
            <Rail status={model.refactorStatus} />
            <div className="flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] text-indigo-400">
              <GitMerge className="h-3 w-3" />
              合并整合
            </div>
            <Rail status={model.refactorStatus} />
          </div>
        )}

        {/* 阶段三：最终整合 / Diff */}
        <div className="flex items-center gap-2">
          {model.refactorStatus ? (
            <>
              <div className="flex flex-1 gap-2">
                <StepCard
                  title="最终整合"
                  subtitle="统一输出"
                  status={model.refactorStatus}
                  icon={<GitMerge className="h-3.5 w-3.5" />}
                />
              </div>
              <Rail status={model.diffStatus} />
              <div className="flex flex-1 gap-2">
                <StepCard
                  title="Diff"
                  subtitle="改动对比"
                  status={model.diffStatus}
                  icon={<Diff className="h-3.5 w-3.5" />}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-1 gap-2">
              <StepCard
                title="Diff"
                subtitle="改动对比"
                status={model.diffStatus}
                icon={<Diff className="h-3.5 w-3.5" />}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
