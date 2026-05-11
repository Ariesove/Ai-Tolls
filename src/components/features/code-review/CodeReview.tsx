"use client";

import React from "react";
import {
  Code2,
  Loader2,
  Sparkles,
  Settings,
  BookOpen,
  Maximize2,
  Columns2,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import TabButton from "@/components/ui/TabButton";
import { KnowledgeBaseDialog } from "@/components/features/Common/KnowledgeBaseDialog";
import { SettingsDialog } from "@/components/features/Common/SettingsDialog";
import {
  CodeReviewProvider,
  useCodeReviewContext,
} from "../review/context/CodeReviewContext";

// Sub-components
import { SourceEditor } from "../review/SourceEditor";
import { OverviewTab } from "../review/OverviewTab";
import { FinalTab } from "../review/FinalTab";
import { EvidenceTab } from "../review/EvidenceTab";
import { AgentsTab } from "../review/AgentsTab";
import { DiffModal } from "../review/DiffModal";

const CodeReviewInner: React.FC = () => {
  const { ui, core, history } = useCodeReviewContext();
  const {
    layoutMode,
    setLayoutMode,
    rightTab,
    setRightTab,
    isSettingsOpen,
    setIsSettingsOpen,
    isKbOpen,
    setIsKbOpen,
  } = ui;

  const {
    code,
    isReviewing,
    handleReview,
    finalCode,
    aggregated,
    ragMeta,
    kbCount,
    results,
    agentStatus,
  } = core;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <header className="relative flex items-center justify-between border-b border-zinc-800 bg-zinc-900/40 px-6 py-4 backdrop-blur-sm">
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <div className="absolute -top-10 left-1/4 h-24 w-72 -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute -top-10 left-2/3 h-24 w-72 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg">
            <Code2 className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              CodeSentinel AI 工作台
            </h1>
            <p className="text-xs text-zinc-500">多 Agent 协作代码审查与重构</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-zinc-400 hover:text-zinc-100"
            onClick={() => setIsKbOpen(true)}
          >
            <BookOpen className="mr-2 h-4 w-4" />
            知识库
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-zinc-400 hover:text-zinc-100"
            onClick={() => setIsSettingsOpen(true)}
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-zinc-400 hover:text-zinc-100"
            onClick={() =>
              setLayoutMode((v) => (v === "split" ? "review" : "split"))
            }
            title={layoutMode === "split" ? "专注结果" : "恢复分屏"}
          >
            {layoutMode === "split" ? (
              <Maximize2 className="h-4 w-4" />
            ) : (
              <Columns2 className="h-4 w-4" />
            )}
          </Button>
          <Button
            onClick={() =>
              handleReview(
                ui.rightTab === "final"
                  ? undefined
                  : (snap) => {
                      history.saveToHistory(snap);
                      ui.setRightTab("final");
                    },
              )
            }
            disabled={isReviewing || !code}
            className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 px-6"
          >
            {isReviewing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            {isReviewing ? "AI 正在审查中..." : "开始 AI 审查"}
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden p-6">
        <div
          className={
            layoutMode === "split" ? "grid h-full grid-cols-12 gap-6" : "h-full"
          }
        >
          <SourceEditor />

          <section
            className={
              layoutMode === "split"
                ? "col-span-7 flex min-w-0 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/35"
                : "flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/35"
            }
          >
            <div className="relative border-b border-zinc-800 bg-zinc-900/60 px-4 py-3">
              <div className="pointer-events-none absolute inset-0 opacity-50">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(63,63,70,0.18)_1px,transparent_1px),linear-gradient(to_bottom,rgba(63,63,70,0.14)_1px,transparent_1px)] bg-[size:26px_26px]" />
              </div>
              <div className="relative flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-zinc-500" />
                    <div className="text-xs font-semibold text-zinc-200">
                      协作面板（多 Agent 审查与整合）
                    </div>
                  </div>
                  <div className="mt-1 text-[10px] text-zinc-500">
                    总览与最终建议支持流式更新；不展示过程输出
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  {Object.entries(agentStatus).map(([role, status]) => (
                    <div
                      key={role}
                      className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950/30 px-2 py-1 text-[10px]"
                    >
                      <div
                        className={[
                          "h-1.5 w-1.5 rounded-full",
                          status === "thinking"
                            ? "bg-amber-500 animate-pulse"
                            : status === "done"
                              ? "bg-green-500"
                              : status === "error"
                                ? "bg-red-500"
                                : "bg-zinc-600",
                        ].join(" ")}
                      />
                      <span className="text-zinc-500 uppercase">{role}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-b border-zinc-800 bg-zinc-950/20 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <TabButton
                    active={rightTab === "overview"}
                    label="总览"
                    icon={<Sparkles className="h-4 w-4" />}
                    onClick={() => setRightTab("overview")}
                    meta={
                      aggregated
                        ? `${aggregated.mustFix.length}/${aggregated.shouldImprove.length}`
                        : undefined
                    }
                  />
                  <TabButton
                    active={rightTab === "final"}
                    label="最终建议"
                    icon={<Code2 className="h-4 w-4" />}
                    onClick={() => setRightTab("final")}
                    meta={finalCode ? "READY" : isReviewing ? "..." : undefined}
                  />
                  <TabButton
                    active={rightTab === "evidence"}
                    label="证据"
                    icon={<BookOpen className="h-4 w-4" />}
                    onClick={() => setRightTab("evidence")}
                    meta={
                      ragMeta
                        ? `${ragMeta.hits}`
                        : kbCount
                          ? `${kbCount}`
                          : undefined
                    }
                  />
                  <TabButton
                    active={rightTab === "agents"}
                    label="Agents"
                    icon={<Sparkles className="h-4 w-4" />}
                    onClick={() => setRightTab("agents")}
                    meta={results.length ? `${results.length}` : undefined}
                  />
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {rightTab === "overview" && <OverviewTab />}
              {rightTab === "final" && <FinalTab />}
              {rightTab === "evidence" && <EvidenceTab />}
              {rightTab === "agents" && <AgentsTab />}
            </div>
          </section>
        </div>
      </main>

      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
      <KnowledgeBaseDialog
        isOpen={isKbOpen}
        onClose={() => setIsKbOpen(false)}
      />

      <DiffModal />

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
        .diff-scroll {
          scrollbar-gutter: stable both-edges;
        }
        .diff-scroll pre {
          white-space: pre;
          word-break: normal;
          overflow-wrap: normal;
        }
        .diff-wrap pre {
          white-space: pre-wrap;
        }
      `}</style>
    </div>
  );
};

export default function CodeReview() {
  return (
    <CodeReviewProvider>
      <CodeReviewInner />
    </CodeReviewProvider>
  );
}
