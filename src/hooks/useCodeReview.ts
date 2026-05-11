"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { CodeReviewOrchestrator } from "@/services/agents/Orchestrator";
import { AgentTask, AgentRole, AgentResult } from "@/services/agents/types";
import { buildReviewContext } from "@/services/rag/reviewContext";
import { isOk } from "@/lib/result";
import { listDocs } from "@/services/rag/RAG";
import {
  AggregatedReview,
  aggregateAgentResults,
} from "@/services/review/aggregate";
import { StepStatus } from "@/components/features/code-review/WorkflowStrip";
import { ReviewSnapshot } from "@/components/features/code-review/ReviewHistoryPanel";

export type LayoutMode = "split" | "review";
export type RightTab = "overview" | "final" | "evidence" | "agents";
export type DiffTargetRole = AgentRole | "FINAL";
export type AppliedFrom = "LINTER" | "ARCHITECT" | "FINAL" | "DIFF";

const HISTORY_KEY = "code_review_history_v1";

export function useCodeReview() {
  const [code, setCode] = useState("");
  const [reviewedCode, setReviewedCode] = useState("");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("split");
  const [rightTab, setRightTab] = useState<RightTab>("overview");
  const [isReviewing, setIsReviewing] = useState(false);
  const [results, setResults] = useState<AgentResult[]>([]);
  const [finalCode, setFinalCode] = useState("");
  const [commandText, setCommandText] = useState("");
  const [ragEvidence, setRagEvidence] = useState<
    Array<{ title: string; preview: string }>
  >([]);
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

  const extractSuggestedCodeSoFar = useCallback((raw: string) => {
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
  }, []);

  const parseRagEvidence = useCallback((ctxText: string) => {
    const start = ctxText.indexOf("：\n\n");
    const body = start !== -1 ? ctxText.slice(start + 3) : ctxText;
    const blocks = body.split("\n\n---\n\n").filter(Boolean);
    return blocks.slice(0, 4).map((b) => {
      const [firstLine, ...rest] = b.split("\n");
      const title = (firstLine || "").trim();
      const preview = rest.join("\n").trim().slice(0, 260);
      return { title, preview };
    });
  }, []);

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

  const stepStatusFromAgent = useCallback((s: string | undefined): StepStatus => {
    if (s === "thinking") return "running";
    if (s === "done") return "done";
    if (s === "error") return "error";
    return "idle";
  }, []);

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
  }, [agentStatus, hasDiff, isReviewing, kbCount, ragMeta, ragStatus, stepStatusFromAgent]);

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
    setRightTab("overview");
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

      const task: AgentTask = {
        id: uuidv4(),
        code: originalCode,
        language,
        fileName,
        context: ctxText,
        instruction: instruction,
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
      if (reviewResult.finalSuggestion) setRightTab("final");
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
          } catch { }
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
    } catch { }
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

  return {
    code,
    setCode,
    reviewedCode,
    layoutMode,
    setLayoutMode,
    rightTab,
    setRightTab,
    isReviewing,
    results,
    finalCode,
    commandText,
    setCommandText,
    ragEvidence,
    agentStatus,
    isSettingsOpen,
    setIsSettingsOpen,
    isKbOpen,
    setIsKbOpen,
    ragStatus,
    ragMeta,
    isDiffOpen,
    setIsDiffOpen,
    diffWrap,
    setDiffWrap,
    diffSplit,
    setDiffSplit,
    diffShowOnly,
    setDiffShowOnly,
    diffTargetRole,
    setDiffTargetRole,
    kbCount,
    hasDiff,
    showAgentDetails,
    setShowAgentDetails,
    lastApplied,
    editorRef,
    aggregated,
    draftAggregated,
    history,
    draftFinalCode,
    handleReview,
    restoreSnapshot,
    openSnapshotDiff,
    clearHistory,
    applyToEditor,
    undoApply,
    diffTargetCode,
    steps,
    scores,
  };
}
