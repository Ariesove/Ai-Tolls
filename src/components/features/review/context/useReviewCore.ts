"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { CodeReviewOrchestrator } from "@/services/Agents2/Orchestrator";
import { AgentTask, AgentRole, AgentResult } from "@/services/Agents2/types";
import { isOk } from "@/lib/result";
import { listDocs } from "@/services/rag/RAG";
import {
  AggregatedReview,
  aggregateAgentResults,
} from "@/services/review/aggregate";
import { StepStatus } from "@/components/features/code-review/workFlowAgent/WorkflowStrip";

export type AppliedFrom = "LINTER" | "ARCHITECT" | "FINAL" | "DIFF";

export function useReviewCore() {
  const [code, setCode] = useState("");
  const [reviewedCode, setReviewedCode] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);
  const [results, setResults] = useState<AgentResult[]>([]);
  const [finalCode, setFinalCode] = useState("");
  const [commandText, setCommandText] = useState("");
  const [ragEvidence, setRagEvidence] = useState<
    Array<{ title: string; preview: string }>
  >([]);
  const [agentStatus, setAgentStatus] = useState<Record<string, string>>({});
  const [ragStatus, setRagStatus] = useState<StepStatus>("idle");
  const [ragMeta, setRagMeta] = useState<{
    hits: number;
    chars: number;
  } | null>(null);
  const [kbCount, setKbCount] = useState(0);
  const [hasDiff, setHasDiff] = useState(false);
  const [lastApplied, setLastApplied] = useState<{
    prev: string;
    next: string;
    from: AppliedFrom;
  } | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [aggregated, setAggregated] = useState<AggregatedReview | null>(null);
  const [draftAggregated, setDraftAggregated] =
    useState<AggregatedReview | null>(null);
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
  }, []);

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

  const applyToEditor = useCallback((nextCode: string, from: AppliedFrom) => {
    if (!nextCode) return;
    setLastApplied({ prev: code, next: nextCode, from });
    setCode(nextCode);
    setTimeout(() => {
      editorRef.current?.focus();
    }, 0);
  }, [code]);

  const undoApply = useCallback(() => {
    if (!lastApplied) return;
    setCode(lastApplied.prev);
    setLastApplied(null);
    setTimeout(() => {
      editorRef.current?.focus();
    }, 0);
  }, [lastApplied]);

  const handleReview = async (onSaveHistory?: (snap: any) => void) => {
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
    setRagEvidence([]);
    setDraftFinalCode("");
    streamBufRef.current = {};
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const fileName = "component.tsx";
    const language = "typescript";

    try {
      const instruction = commandText.trim();
      let ctxText = "";
      let hits = 0;

      const task: AgentTask = {
        id: uuidv4(),
        code: originalCode,
        language,
        fileName,
        context: "",
        instruction: instruction,
      };

      const reviewResult = await CodeReviewOrchestrator.runReview(
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
        (step, status, payload) => {
          if (step === "retrieve") {
            setRagStatus(
              status === "running"
                ? "running"
                : status === "done"
                  ? "done"
                  : "error",
            );
            if (status === "done") {
              ctxText = payload?.ctxText ?? "";
              hits = typeof payload?.hits === "number" ? payload.hits : 0;
              setRagMeta({
                hits,
                chars: typeof payload?.chars === "number" ? payload.chars : 0,
              });
              if (ctxText) setRagEvidence(parseRagEvidence(ctxText));
            }
          }
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

        if (onSaveHistory) {
          const dims = aggRes.data.dimensions ?? [];
          const overallScore =
            dims.length > 0
              ? Math.round(dims.reduce((a, d) => a + d.score, 0) / dims.length)
              : 0;

          onSaveHistory({
            code: originalCode,
            commandText: instruction,
            finalCode: reviewResult.finalSuggestion || "",
            aggregated: aggRes.data as unknown,
            overallScore,
            mustFixCount: aggRes.data.mustFix?.length ?? 0,
            ragMeta: { hits, chars: ctxText.length },
          });
        }
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

  return {
    code,
    setCode,
    reviewedCode,
    setReviewedCode,
    isReviewing,
    setIsReviewing,
    results,
    setResults,
    finalCode,
    setFinalCode,
    commandText,
    setCommandText,
    ragEvidence,
    setRagEvidence,
    agentStatus,
    setAgentStatus,
    ragStatus,
    setRagStatus,
    ragMeta,
    setRagMeta,
    kbCount,
    setKbCount,
    hasDiff,
    setHasDiff,
    lastApplied,
    setLastApplied,
    editorRef,
    aggregated,
    setAggregated,
    draftAggregated,
    setDraftAggregated,
    draftFinalCode,
    setDraftFinalCode,
    streamBufRef,
    rafRef,
    extractSuggestedCodeSoFar,
    parseRagEvidence,
    steps,
    scores,
    applyToEditor,
    undoApply,
    handleReview,
  };
}

export type ReviewCoreContextType = ReturnType<typeof useReviewCore>;
