"use client";

import React, { Ref, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { v4 as uuidv4 } from "uuid";
import { CodeReviewOrchestrator } from "@/services/agents/Orchestrator";
import { AgentTask, AgentRole, AgentResult } from "@/services/agents/types";
import { buildReviewContext } from "@/services/rag/reviewContext";
import { isOk } from "@/lib/result";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { KnowledgeBaseDialog } from "@/components/features/KnowledgeBaseDialog";
import { SettingsDialog } from "@/components/features/SettingsDialog";
import { WorkflowStrip, StepStatus } from "@/components/features/WorkflowStrip";
import { ScoreCard } from "@/components/features/ScoreCard";
import { SummaryCard } from "@/components/features/SummaryCard";
import {
  ReviewHistoryPanel,
  ReviewSnapshot,
} from "@/components/features/ReviewHistoryPanel";
import { listDocs } from "@/services/rag/RAG";
import {
  AggregatedReview,
  aggregateAgentResults,
} from "@/services/review/aggregate";
import {
  AlertCircle,
  CheckCircle2,
  Code2,
  Loader2,
  Sparkles,
  Settings,
  BookOpen,
  Maximize2,
  Columns2,
} from "lucide-react";

const ReactDiffViewer = dynamic(() => import("react-diff-viewer-continued"), {
  ssr: false,
});

type LayoutMode = "split" | "review";
type DiffTargetRole = AgentRole | "FINAL";
type AppliedFrom = "LINTER" | "ARCHITECT" | "FINAL" | "DIFF";
const HISTORY_KEY = "code_review_history_v1";

export default function CodeReviewPage() {
  const [code, setCode] = useState("");
  const [reviewedCode, setReviewedCode] = useState("");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("split");
  const [isReviewing, setIsReviewing] = useState(false);
  const [results, setResults] = useState<AgentResult[]>([]);
  const [finalCode, setFinalCode] = useState("");
  const [commandText, setCommandText] = useState("");
  const [ragEvidence, setRagEvidence] = useState<
    Array<{ title: string; preview: string }>
  >([]);
  const [isRagExplainOpen, setIsRagExplainOpen] = useState(false);
  const [agentStatus, setAgentStatus] = useState<Record<string, string>>({});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isKbOpen, setIsKbOpen] = useState(false);
  const [ragStatus, setRagStatus] = useState<StepStatus>("idle");
  const [ragMeta, setRagMeta] = useState<{
    hits: number;
    chars: number;
  } | null>(null);
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [diffWrap, setDiffWrap] = useState(true);
  const [diffSplit, setDiffSplit] = useState(false);
  const [diffShowOnly, setDiffShowOnly] = useState(true);
  const [diffTargetRole, setDiffTargetRole] = useState<DiffTargetRole>("FINAL");
  const [kbCount, setKbCount] = useState(0);
  const [hasDiff, setHasDiff] = useState(false);
  const [showAgentDetails, setShowAgentDetails] = useState(false);
  const [lastApplied, setLastApplied] = useState<{
    prev: string;
    next: string;
    from: AppliedFrom;
  } | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [aggregated, setAggregated] = useState<AggregatedReview | null>(null);
  const [draftAggregated, setDraftAggregated] =
    useState<AggregatedReview | null>(null);
  const [history, setHistory] = useState<ReviewSnapshot[]>([]);
  const [draftFinalCode, setDraftFinalCode] = useState("");
  const streamBufRef = useRef<Record<string, string>>({});
  const rafRef = useRef<number | null>(null);
  const [mcpScreenshot, setMcpScreenshot] = useState<string | null>(null);
  const [mcpShotError, setMcpShotError] = useState<string | null>(null);
  const [mcpLhError, setMcpLhError] = useState<string | null>(null);
  const [mcpLhScores, setMcpLhScores] = useState<null | {
    accessibility?: number;
    seo?: number;
    bestPractices?: number;
    suggestions?: Array<{ id: string; title: string }>;
  }>(null);
  // 过程输出已移除：仅保留最终代码与总览的流式更新
  const extractSuggestedCodeSoFar = (raw: string) => {
    const key = '"suggestedCode"';
    const k = raw.indexOf(key);
    if (k === -1) return "";
    let i = k + key.length;
    while (i < raw.length && raw[i] !== ":") i++;
    if (i >= raw.length) return "";
    i++;
    while (i < raw.length && /\s/.test(raw[i])) i++;
    if (i >= raw.length) return "";
    if (raw[i] !== '"') return "";
    i++;

    let out = "";
    let esc = false;
    while (i < raw.length) {
      const ch = raw[i];
      if (!esc) {
        if (ch === '"') break;
        if (ch === "\\") {
          esc = true;
          i++;
          continue;
        }
        out += ch;
        i++;
        continue;
      }

      esc = false;
      if (ch === "n") {
        out += "\n";
        i++;
        continue;
      }
      if (ch === "r") {
        out += "\r";
        i++;
        continue;
      }
      if (ch === "t") {
        out += "\t";
        i++;
        continue;
      }
      if (ch === '"') {
        out += '"';
        i++;
        continue;
      }
      if (ch === "\\") {
        out += "\\";
        i++;
        continue;
      }
      if (ch === "u") {
        const hex = raw.slice(i + 1, i + 5);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          out += String.fromCharCode(parseInt(hex, 16));
          i += 5;
          continue;
        }
        out += "u";
        i++;
        continue;
      }
      out += ch;
      i++;
    }
    return out;
  };

  const parseRagEvidence = (ctxText: string) => {
    const start = ctxText.indexOf("：\n\n");
    const body = start !== -1 ? ctxText.slice(start + 3) : ctxText;
    const blocks = body.split("\n\n---\n\n").filter(Boolean);
    return blocks.slice(0, 4).map((b) => {
      const [firstLine, ...rest] = b.split("\n");
      const title = (firstLine || "").trim();
      const preview = rest.join("\n").trim().slice(0, 260);
      return { title, preview };
    });
  };

  useEffect(() => {
    try {
      setKbCount(listDocs().length);
    } catch {
      setKbCount(0);
    }
  }, [isKbOpen]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const items = parsed
        .filter((x): x is ReviewSnapshot => Boolean(x && typeof x === "object"))
        .slice(0, 5);
      setHistory(items);
    } catch {
      setHistory([]);
    }
  }, []);

  const diffTargetCode = useMemo(() => {
    const pick = (role: AgentRole) =>
      results.find((r) => r.role === role)?.suggestedCode ?? "";
    if (diffTargetRole === "FINAL") {
      return (
        finalCode ||
        pick(AgentRole.REFACTORER) ||
        pick(AgentRole.ARCHITECT) ||
        pick(AgentRole.LINTER)
      );
    }
    return pick(diffTargetRole);
  }, [diffTargetRole, finalCode, results]);

  const stepStatusFromAgent = (s: string | undefined): StepStatus => {
    if (s === "thinking") return "running";
    if (s === "done") return "done";
    if (s === "error") return "error";
    return "idle";
  };

  const steps = useMemo(() => {
    const linter = agentStatus[AgentRole.LINTER];
    const architect = agentStatus[AgentRole.ARCHITECT];
    const refactor = agentStatus[AgentRole.REFACTORER];

    return {
      kbStatus: kbCount > 0 ? ("done" as const) : ("idle" as const),
      kbMeta: kbCount > 0 ? `${kbCount}` : undefined,
      retrieveStatus: ragStatus,
      retrieveMeta: ragMeta ? `${ragMeta.hits} / ${ragMeta.chars}` : undefined,
      linterStatus: stepStatusFromAgent(linter),
      architectStatus: stepStatusFromAgent(architect),
      refactorStatus: refactor ? stepStatusFromAgent(refactor) : undefined,
      diffStatus: hasDiff
        ? ("done" as const)
        : isReviewing
          ? ("running" as const)
          : ("idle" as const),
      onOpenKb: () => setIsKbOpen(true),
    };
  }, [agentStatus, hasDiff, isReviewing, kbCount, ragMeta, ragStatus]);

  const scores = useMemo(() => {
    if (results.length === 0) return [];
    const countBy = (role: AgentRole) => {
      const r = results.find((x) => x.role === role);
      const list = Array.isArray(r?.comments) ? r!.comments : [];
      const errors = list.filter((c) => c.severity === "error").length;
      const warns = list.filter((c) => c.severity === "warn").length;
      const infos = list.filter((c) => c.severity === "info").length;
      return { errors, warns, infos };
    };

    const lint = countBy(AgentRole.LINTER);
    const arch = countBy(AgentRole.ARCHITECT);

    const scoreOf = (x: { errors: number; warns: number; infos: number }) =>
      Math.max(0, 100 - x.errors * 22 - x.warns * 10 - x.infos * 2);

    return [
      {
        id: "lint",
        label: "规范与类型",
        score: scoreOf(lint),
        hint: `${lint.errors} 个错误 / ${lint.warns} 个警告`,
      },
      {
        id: "arch",
        label: "架构与性能",
        score: scoreOf(arch),
        hint: `${arch.errors} 个错误 / ${arch.warns} 个警告`,
      },
    ];
  }, [results]);

  const handleReview = async () => {
    if (!code.trim()) return;

    const originalCode = code;
    setReviewedCode(originalCode);
    setIsReviewing(true);
    setResults([]);
    setAgentStatus({});
    setHasDiff(false);
    setRagStatus("running");
    setRagMeta(null);
    setLastApplied(null);
    setAggregated(null);
    setDraftAggregated(null);
    setFinalCode("");
    setShowAgentDetails(false);
    setRagEvidence([]);
    setDraftFinalCode("");
    streamBufRef.current = {};
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const orchestrator = new CodeReviewOrchestrator();
    const fileName = "component.tsx";
    const language = "typescript";

    try {
      const instruction = commandText.trim();
      const ctxRes = await buildReviewContext({
        code: originalCode,
        fileName,
        language,
        k: 4,
        instruction,
      });
      setRagStatus(isOk(ctxRes) ? "done" : "error");
      const ctxText = isOk(ctxRes) ? ctxRes.data : "";
      const hits = ctxText ? ctxText.split("\n---\n").length : 0;
      setRagMeta({ hits, chars: ctxText.length });
      if (ctxText) {
        setRagEvidence(parseRagEvidence(ctxText));
      }

      const commander = instruction ? `【指挥指令】\n${instruction}` : "";
      const context = [commander, ctxText].filter(Boolean).join("\n\n");
      const task: AgentTask = {
        id: uuidv4(),
        code: originalCode,
        language,
        fileName,
        context,
      };

      const reviewResult = await orchestrator.runReview(
        task,
        (role, status) => {
          setAgentStatus((prev) => ({ ...prev, [role]: status }));
        },
        (role, chunk) => {
          if (role !== AgentRole.REFACTORER) return;
          const cur2 = streamBufRef.current[role] || "";
          streamBufRef.current[role] = (cur2 + chunk).slice(-12000);
          const draft = extractSuggestedCodeSoFar(streamBufRef.current[role]);
          setDraftFinalCode(draft.slice(-20000));
        },
        (role, partialResult) => {
          setResults((prev) => {
            const next = prev.filter((r) => r.role !== role);
            next.push(partialResult as AgentResult);
            next.sort((a, b) => String(a.role).localeCompare(String(b.role)));
            const aggRes = aggregateAgentResults(next);
            if (isOk(aggRes)) {
              setDraftAggregated(aggRes.data);
              setCommandText((cur) =>
                cur.trim() ? cur : aggRes.data.nextCommand,
              );
            }
            return next;
          });
        },
      );
      setResults(reviewResult.results);
      setFinalCode(reviewResult.finalSuggestion || "");
      const aggRes = aggregateAgentResults(reviewResult.results);
      if (isOk(aggRes)) {
        setAggregated(aggRes.data);
        setDraftAggregated(null);
        setCommandText((prev) =>
          prev.trim() ? prev : aggRes.data.nextCommand,
        );
        const dims = aggRes.data.dimensions ?? [];
        const overallScore =
          dims.length > 0
            ? Math.round(dims.reduce((a, d) => a + d.score, 0) / dims.length)
            : 0;
        const snap: ReviewSnapshot = {
          id: uuidv4(),
          ts: Date.now(),
          code: originalCode,
          commandText: instruction,
          finalCode: reviewResult.finalSuggestion || "",
          aggregated: aggRes.data as unknown,
          overallScore,
          mustFixCount: aggRes.data.mustFix?.length ?? 0,
          ragMeta: { hits, chars: ctxText.length },
        };
        setHistory((prev) => {
          const next = [snap, ...prev].slice(0, 5);
          try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
          } catch {}
          return next;
        });
      } else {
        setAggregated(null);
      }
      setHasDiff(
        reviewResult.results.some(
          (r) =>
            typeof r.suggestedCode === "string" && r.suggestedCode.length > 0,
        ),
      );
    } catch (error) {
      console.error("审查失败:", error);
      setRagStatus("error");
    } finally {
      setIsReviewing(false);
    }
  };

  const restoreSnapshot = (id: string) => {
    const snap = history.find((h) => h.id === id);
    if (!snap) return;
    setCode(snap.code);
    setReviewedCode(snap.code);
    setCommandText(snap.commandText);
    setFinalCode(snap.finalCode);
    setAggregated(snap.aggregated as AggregatedReview);
    setResults([]);
    setIsDiffOpen(false);
    setShowAgentDetails(false);
    setLastApplied(null);
    setLayoutMode("split");
    setTimeout(() => {
      editorRef.current?.focus();
    }, 0);
  };

  const openSnapshotDiff = (id: string) => {
    const snap = history.find((h) => h.id === id);
    if (!snap) return;
    setReviewedCode(snap.code);
    setFinalCode(snap.finalCode);
    setDiffTargetRole("FINAL");
    setIsDiffOpen(true);
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {}
  };

  const applyToEditor = (nextCode: string, from: AppliedFrom) => {
    if (!nextCode) return;
    setLastApplied({ prev: code, next: nextCode, from });
    setCode(nextCode);
    setLayoutMode("split");
    setTimeout(() => {
      editorRef.current?.focus();
    }, 0);
  };

  const undoApply = () => {
    if (!lastApplied) return;
    setCode(lastApplied.prev);
    setLastApplied(null);
    setLayoutMode("split");
    setTimeout(() => {
      editorRef.current?.focus();
    }, 0);
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
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
            onClick={handleReview}
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

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden p-6 gap-6">
        {/* Left: Editor Area */}
        {layoutMode === "split" ? (
          <div className="flex-1 flex flex-col min-w-0 bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-900 flex justify-between items-center gap-3">
              <span className="text-xs font-medium text-zinc-400">
                输入源代码 (TSX/TS)
              </span>
              {lastApplied ? (
                <div className="flex items-center gap-2">
                  <div className="text-[10px] text-zinc-500">
                    已应用：{lastApplied.from}
                  </div>
                  <button
                    type="button"
                    className="rounded border border-zinc-800 bg-zinc-950/40 px-2 py-1 text-[10px] text-zinc-300 hover:border-zinc-700"
                    onClick={undoApply}
                  >
                    撤销
                  </button>
                </div>
              ) : null}
            </div>
            <Textarea
              ref={editorRef}
              className="flex-1 w-full bg-transparent p-4 font-mono text-sm resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500/30 text-zinc-300 border-0"
              placeholder="请在此粘贴你想重构的代码..."
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
        ) : null}

        {/* Right: Results Area */}
        <div
          className={
            layoutMode === "split"
              ? "flex-1 flex flex-col min-w-0 bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden"
              : "w-full flex flex-col min-w-0 bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden"
          }
        >
          <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-900 flex justify-between items-center">
            <span className="text-xs font-medium text-zinc-400">
              AI 审查报告与建议
            </span>
            <div className="flex gap-3">
              {Object.entries(agentStatus).map(([role, status]) => (
                <div
                  key={role}
                  className="flex items-center gap-1.5 text-[10px]"
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      status === "thinking"
                        ? "bg-amber-500 animate-pulse"
                        : status === "done"
                          ? "bg-green-500"
                          : "bg-red-500"
                    }`}
                  />
                  <span className="text-zinc-500 uppercase">{role}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
            <WorkflowStrip model={steps} />
            {history.length > 0 ? (
              <ReviewHistoryPanel
                history={history}
                onRestore={restoreSnapshot}
                onOpenDiff={openSnapshotDiff}
                onClear={clearHistory}
              />
            ) : null}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-zinc-400">
                    RAG 检索
                  </div>
                  <div className="mt-1 text-[10px] text-zinc-500">
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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded border border-zinc-800 bg-zinc-950/30 px-2 py-1 text-[10px] text-zinc-300 hover:border-zinc-700"
                    onClick={() => setIsKbOpen(true)}
                  >
                    打开知识库
                  </button>
                  <button
                    type="button"
                    className="rounded border border-zinc-800 bg-zinc-950/30 px-2 py-1 text-[10px] text-zinc-300 hover:border-zinc-700"
                    onClick={async () => {
                      try {
                        setMcpShotError(null);
                        const url =
                          typeof window !== "undefined"
                            ? `${window.location.origin}/code-review`
                            : "http://localhost:3000/code-review";
                        const resp = await fetch(
                          `/api/mcp/screenshot?url=${encodeURIComponent(url)}`,
                          { method: "GET" },
                        );
                        const data = await resp.json();
                        if (data?.ok) setMcpScreenshot(data.dataUrl || null);
                        else setMcpShotError(data?.error || "截图失败");
                      } catch (e: any) {
                        setMcpShotError(e.message || "调用失败");
                      }
                    }}
                  >
                    截图（MCP）
                  </button>
                  <button
                    type="button"
                    className="rounded border border-zinc-800 bg-zinc-950/30 px-2 py-1 text-[10px] text-zinc-300 hover:border-zinc-700"
                    onClick={async () => {
                      try {
                        setMcpLhError(null);
                        setMcpLhScores(null);
                        const url =
                          typeof window !== "undefined"
                            ? `${window.location.origin}/code-review`
                            : "http://localhost:3000/code-review";
                        const resp = await fetch(
                          `/api/mcp/lighthouse?url=${encodeURIComponent(url)}`,
                          { method: "GET" },
                        );
                        const data = await resp.json();
                        if (data?.ok) {
                          setMcpLhScores({
                            accessibility: data.scores?.accessibility,
                            seo: data.scores?.seo,
                            bestPractices: data.scores?.bestPractices,
                            suggestions: data.suggestions || [],
                          });
                        } else {
                          setMcpLhError(data?.error || "审计失败");
                        }
                      } catch (e: any) {
                        setMcpLhError(e.message || "调用失败");
                      }
                    }}
                    title="通过 MCP（服务端代理）获取 Lighthouse 审计"
                  >
                    性能分数（MCP）
                  </button>
                </div>
              </div>
              {mcpShotError ? (
                <div className="mt-2 text-[11px] text-red-400">
                  {mcpShotError}
                </div>
              ) : null}
              {mcpScreenshot ? (
                <div className="mt-3 rounded border border-zinc-800 bg-zinc-950/30 p-2">
                  <div className="text-[10px] text-zinc-500 mb-1">
                    页面截图（MCP 本地适配）
                  </div>
                  <img
                    src={mcpScreenshot}
                    alt="mcp-screenshot"
                    className="rounded border border-zinc-800 max-h-64 object-contain"
                  />
                </div>
              ) : null}
              {mcpLhError ? (
                <div className="mt-2 text-[11px] text-red-400">
                  {mcpLhError}
                </div>
              ) : null}
              {mcpLhScores ? (
                <div className="mt-3 rounded border border-zinc-800 bg-zinc-950/30 p-2">
                  <div className="text-[10px] text-zinc-500 mb-2">
                    Lighthouse 审计（MCP）
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded border border-zinc-800 bg-zinc-950/20 p-2">
                      <div className="text-[10px] text-zinc-500">可访问性</div>
                      <div className="text-sm font-semibold text-zinc-200 tabular-nums">
                        {mcpLhScores.accessibility ?? "-"}
                      </div>
                    </div>
                    <div className="rounded border border-zinc-800 bg-zinc-950/20 p-2">
                      <div className="text-[10px] text-zinc-500">最佳实践</div>
                      <div className="text-sm font-semibold text-zinc-200 tabular-nums">
                        {mcpLhScores.bestPractices ?? "-"}
                      </div>
                    </div>
                    <div className="rounded border border-zinc-800 bg-zinc-950/20 p-2">
                      <div className="text-[10px] text-zinc-500">SEO</div>
                      <div className="text-sm font-semibold text-zinc-200 tabular-nums">
                        {mcpLhScores.seo ?? "-"}
                      </div>
                    </div>
                  </div>
                  {mcpLhScores.suggestions &&
                  mcpLhScores.suggestions.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      {mcpLhScores.suggestions.slice(0, 5).map((s, i) => (
                        <div
                          key={`${s.id}-${i}`}
                          className="text-[11px] text-zinc-400"
                        >
                          • {s.title}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {isRagExplainOpen && ragEvidence.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {ragEvidence.map((e, idx) => (
                    <div
                      key={idx}
                      className="rounded border border-zinc-800 bg-zinc-950/20 p-2"
                    >
                      <div className="text-[10px] text-zinc-300">{e.title}</div>
                      <div className="mt-1 text-[10px] text-zinc-500 line-clamp-3">
                        {e.preview}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
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
                onUseRecommended={() =>
                  setCommandText(draftAggregated.nextCommand)
                }
                ragEvidence={ragEvidence}
                isDraft={true}
              />
            ) : (
              <ScoreCard title="评分概览" items={scores} />
            )}

            {/* 过程输出已移除 */}

            {!finalCode && isReviewing && draftFinalCode ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-zinc-400">
                      最终建议（流式生成中）
                    </div>
                    <div className="mt-1 text-[10px] text-zinc-500">
                      代码正在生成，完成后可直接 Diff / 应用
                    </div>
                  </div>
                </div>
                <div className="mt-3 rounded-lg overflow-hidden border border-zinc-800 shadow-2xl">
                  <SyntaxHighlighter
                    language="typescript"
                    style={oneDark}
                    customStyle={{
                      margin: 0,
                      padding: "1rem",
                      fontSize: "12px",
                      background: "#0b0b0f",
                    }}
                    lineProps={() => ({
                      style: { display: "block", background: "transparent" },
                    })}
                  >
                    {draftFinalCode}
                  </SyntaxHighlighter>
                </div>
              </div>
            ) : null}

            {finalCode ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-zinc-400">
                      最终建议（推荐）
                    </div>
                    <div className="mt-1 text-[10px] text-zinc-500">
                      已整合并行审查结论，默认只看这一份 Diff
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded border border-zinc-800 bg-zinc-950/40 px-2 py-1 text-[10px] text-zinc-300 hover:border-zinc-700"
                      onClick={() => applyToEditor(finalCode, "FINAL")}
                    >
                      应用到输入
                    </button>
                    <button
                      type="button"
                      className="rounded border border-zinc-800 bg-zinc-950/40 px-2 py-1 text-[10px] text-zinc-300 hover:border-zinc-700"
                      onClick={() => setIsDiffOpen(true)}
                    >
                      打开 Diff
                    </button>
                  </div>
                </div>
                <div className="mt-3 rounded-lg overflow-hidden border border-zinc-800 shadow-2xl">
                  <SyntaxHighlighter
                    language="typescript"
                    style={oneDark}
                    customStyle={{
                      margin: 0,
                      padding: "1rem",
                      fontSize: "12px",
                      background: "#0b0b0f",
                    }}
                    lineProps={() => ({
                      style: { display: "block", background: "transparent" },
                    })}
                  >
                    {finalCode}
                  </SyntaxHighlighter>
                </div>
              </div>
            ) : null}

            {results.length === 0 && !isReviewing && (
              <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-3">
                <Sparkles className="w-12 h-12 opacity-20" />
                <p className="text-sm">点击上方按钮，让 AI 专家为你审查代码</p>
              </div>
            )}

            {isReviewing && results.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin opacity-50" />
                <div className="space-y-1 text-center">
                  <p className="text-sm text-zinc-400">
                    正在分发任务至 Linter 与 Architect Agent...
                  </p>
                  <p className="text-xs text-zinc-500 italic">
                    “通常深思熟虑的代码更可靠”
                  </p>
                </div>
              </div>
            )}

            {results.length > 0 ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-medium text-zinc-400">
                    Agent 细节（可追溯）
                  </div>
                  <button
                    type="button"
                    className="rounded border border-zinc-800 bg-zinc-950/40 px-2 py-1 text-[10px] text-zinc-300 hover:border-zinc-700"
                    onClick={() => setShowAgentDetails((v) => !v)}
                  >
                    {showAgentDetails ? "收起" : "展开"}
                  </button>
                </div>

                {showAgentDetails ? (
                  <div className="mt-3 space-y-4">
                    {results
                      .filter((r) => r.role !== AgentRole.REFACTORER)
                      .map((r) => (
                        <div
                          key={r.role}
                          className="rounded-lg border border-zinc-800 bg-zinc-900/20 p-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold text-zinc-200">
                              {r.role === AgentRole.LINTER
                                ? "Linter（规范/类型）"
                                : "Architect（架构/性能）"}
                            </div>
                            <div className="text-[10px] text-zinc-500 uppercase">
                              {r.role}
                            </div>
                          </div>
                          <div className="mt-2 space-y-2">
                            {(Array.isArray(r.comments) ? r.comments : []).map(
                              (comment, cIdx) => (
                                <div
                                  key={cIdx}
                                  className="rounded border border-zinc-800 bg-zinc-950/30 p-2"
                                >
                                  <div className="flex items-start gap-2">
                                    <AlertCircle
                                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                                        comment.severity === "error"
                                          ? "text-red-400"
                                          : comment.severity === "warn"
                                            ? "text-amber-400"
                                            : "text-blue-400"
                                      }`}
                                    />
                                    <div className="min-w-0">
                                      <div className="text-xs text-zinc-200">
                                        {comment.message}
                                      </div>
                                      {comment.suggestion ? (
                                        <div className="mt-1 text-[11px] font-mono text-zinc-300">
                                          {comment.suggestion}
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
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
      {isDiffOpen ? (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm">
          <div className="absolute inset-6 rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/60 px-4 py-3">
              <div className="text-sm font-semibold text-zinc-200">
                Diff 详情
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={diffTargetRole}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "FINAL") setDiffTargetRole("FINAL");
                    else if (v === AgentRole.LINTER)
                      setDiffTargetRole(AgentRole.LINTER);
                    else setDiffTargetRole(AgentRole.ARCHITECT);
                  }}
                  className="h-8 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-200"
                >
                  <option value="FINAL">最终建议</option>
                  <option value={AgentRole.LINTER}>Linter</option>
                  <option value={AgentRole.ARCHITECT}>Architect</option>
                </select>
                <button
                  type="button"
                  className="h-8 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-200 hover:border-zinc-700"
                  onClick={() => setDiffShowOnly((v) => !v)}
                >
                  {diffShowOnly ? "显示全部" : "只看改动"}
                </button>
                <button
                  type="button"
                  className="h-8 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-200 hover:border-zinc-700"
                  onClick={() => setDiffSplit((v) => !v)}
                >
                  {diffSplit ? "统一视图" : "分屏视图"}
                </button>
                <button
                  type="button"
                  className="h-8 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-200 hover:border-zinc-700"
                  onClick={() => setDiffWrap((v) => !v)}
                >
                  {diffWrap ? "关闭换行" : "开启换行"}
                </button>
                <button
                  type="button"
                  className="h-8 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-200 hover:border-zinc-700"
                  onClick={() => {
                    applyToEditor(
                      diffTargetCode,
                      diffTargetRole === "FINAL" ? "FINAL" : "DIFF",
                    );
                    setIsDiffOpen(false);
                  }}
                  disabled={!diffTargetCode}
                >
                  应用到输入
                </button>
                <button
                  type="button"
                  className="h-8 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-200 hover:border-zinc-700"
                  onClick={() => setIsDiffOpen(false)}
                >
                  关闭
                </button>
              </div>
            </div>
            <div
              className={
                diffWrap
                  ? "h-[calc(100%-52px)] overflow-auto diff-scroll diff-wrap"
                  : "h-[calc(100%-52px)] overflow-auto diff-scroll"
              }
            >
              <ReactDiffViewer
                oldValue={reviewedCode}
                newValue={diffTargetCode}
                splitView={diffSplit}
                showDiffOnly={diffShowOnly}
                disableWordDiff={false}
                styles={{
                  variables: {
                    dark: {
                      diffViewerBackground: "#09090b",
                      diffViewerColor: "#e4e4e7",
                      addedBackground: "rgba(34,197,94,0.16)",
                      addedColor: "#e4e4e7",
                      removedBackground: "rgba(239,68,68,0.16)",
                      removedColor: "#e4e4e7",
                      wordAddedBackground: "rgba(34,197,94,0.28)",
                      wordRemovedBackground: "rgba(239,68,68,0.28)",
                      addedGutterBackground: "rgba(34,197,94,0.10)",
                      removedGutterBackground: "rgba(239,68,68,0.10)",
                      gutterBackground: "#0b0b0f",
                      gutterBackgroundDark: "#0b0b0f",
                      highlightBackground: "rgba(99,102,241,0.12)",
                      highlightGutterBackground: "rgba(99,102,241,0.10)",
                      codeFoldGutterBackground: "#0b0b0f",
                      codeFoldBackground: "#0b0b0f",
                      emptyLineBackground: "#09090b",
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

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
}
