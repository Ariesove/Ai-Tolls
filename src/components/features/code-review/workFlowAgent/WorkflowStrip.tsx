"use client";

import React from "react";
import { ArrowDown } from "lucide-react";
import { StepStatus, StatusDot, Rail } from "./BaseAgent";
import { GitMerge } from "lucide-react";
// Import Agents
import RAGParse from "./RAGParse";
import RAGSearch from "./RAGSearch";
import LinterAgent from "./LinterAgent";
import ArchitectAgent from "./ArchitectAgent";
import RefactorAgent from "./RefactorAgent";
import DiffAgent from "./DiffAgent";

export type { StepStatus } from "./BaseAgent";

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

export const WorkflowStrip: React.FC<{ model: WorkflowStripModel }> = ({
  model,
}) => {
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
            className={[
              "rounded-full border px-2 py-0.5 text-[10px]",
              overallStatus === "running"
                ? "border-amber-500/30 text-amber-400"
                : overallStatus === "done"
                  ? "border-green-500/30 text-green-400"
                  : overallStatus === "error"
                    ? "border-red-500/30 text-red-400"
                    : "border-zinc-800 text-zinc-500",
            ].join(" ")}
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
              <RAGParse
                status={model.kbStatus}
                meta={model.kbMeta}
                onOpenKb={model.onOpenKb}
              />
              <Rail direction="v" len={52} status={model.kbStatus} />
              <RAGSearch
                status={model.retrieveStatus}
                meta={model.retrieveMeta}
              />
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
          <LinterAgent status={model.linterStatus} />
          <ArchitectAgent status={model.architectStatus} />
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
              <RefactorAgent status={model.refactorStatus} />
              <Rail status={model.diffStatus} />
              <DiffAgent status={model.diffStatus} />
            </>
          ) : (
            <DiffAgent status={model.diffStatus} />
          )}
        </div>
      </div>
    </div>
  );
};
