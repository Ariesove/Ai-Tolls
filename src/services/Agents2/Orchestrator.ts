import { isOk } from "@/lib/result";
import ArchitectAgent from "./ArchitectAgent";
import LinterAgent from "./linterAgent";
import RefactorAgent from "./RefactorAgent";
import { AgentResult, AgentRole, AgentTask, OrchestratorResult } from "./types";
import { runRagParse, runRagRetrieve } from "./RAGAgent";

type AgentProgress = "thinking" | "done" | "error";

type OnAgentProgress = (role: AgentRole, progress: AgentProgress) => void;
type OnAgentToken = (role: AgentRole, chunk: string) => void;
type OnAgentResult = (role: AgentRole, result: AgentResult) => void;

type RAGStep = "kb" | "retrieve";
type RAGStepStatus = "running" | "done" | "error";
type OnRagStep = (
  step: RAGStep,
  status: RAGStepStatus,
  payload?: {
    kbCount?: number;
    hits?: number;
    chars?: number;
    ctxText?: string;
    error?: string;
  },
) => void;

const toHint = (r: AgentResult) => {
  const head = `[${r.role}]`;
  const msgs = (Array.isArray(r.comments) ? r.comments : [])
    .slice(0, 10)
    .map(
      (c) =>
        `- (${c.severity}) ${c.message}${typeof c.line === "number" ? ` @${c.line}` : ""}`,
    )
    .join("\n");
  return `${head}\n${msgs}`;
};

export const runReview = async (
  task: AgentTask,
  onAgentProgress?: OnAgentProgress,
  onAgentToken?: OnAgentToken,
  onAgentResult?: OnAgentResult,
  onRagStep?: OnRagStep,
): Promise<OrchestratorResult> => {
  onRagStep?.("kb", "running");
  const kbRes = runRagParse();
  if (isOk(kbRes)) onRagStep?.("kb", "done", { kbCount: kbRes.data.kbCount });
  else onRagStep?.("kb", "error", { error: kbRes.error });

  onRagStep?.("retrieve", "running");
  const ctxRes = await runRagRetrieve(task, 4);
  const taskWithCtx: AgentTask = isOk(ctxRes)
    ? { ...task, context: ctxRes.data.ctxText }
    : task;
  if (isOk(ctxRes))
    onRagStep?.("retrieve", "done", {
      ctxText: ctxRes.data.ctxText,
      hits: ctxRes.data.meta.hits,
      chars: ctxRes.data.meta.chars,
    });
  else onRagStep?.("retrieve", "error", { error: ctxRes.error });

  const agents = [LinterAgent(), ArchitectAgent()];

  const promises = agents.map(async (agent) => {
    onAgentProgress?.(agent.role, "thinking");
    const result = await agent.run(taskWithCtx, (piece) => {
      onAgentToken?.(agent.role, piece);
    });

    if (isOk(result)) {
      onAgentProgress?.(agent.role, "done");
      onAgentResult?.(agent.role, result.data);
      return result.data;
    }

    onAgentProgress?.(agent.role, "error");
    const fallback: AgentResult = {
      role: agent.role,
      comments: [{ severity: "error", message: `审查失败: ${result.error}` }],
      thinking: "出错了，请检查配置。",
    };
    onAgentResult?.(agent.role, fallback);
    return fallback;
  });

  const results = await Promise.all(promises);

  onAgentProgress?.(AgentRole.REFACTORER, "thinking");
  const mergedHints = results.map(toHint).join("\n\n");

  const refactorer = RefactorAgent();
  const refTask: AgentTask = {
    ...task,
    context: ["【审查线索汇总】", mergedHints].filter(Boolean).join("\n\n"),
    instruction: task.instruction,
  };

  const refRes = await refactorer.run(refTask, (piece) => {
    onAgentToken?.(AgentRole.REFACTORER, piece);
  });

  let finalSuggestion: string | undefined;
  if (isOk(refRes)) {
    onAgentProgress?.(AgentRole.REFACTORER, "done");
    results.push(refRes.data);
    onAgentResult?.(AgentRole.REFACTORER, refRes.data);
    finalSuggestion = refRes.data.suggestedCode;
  } else {
    onAgentProgress?.(AgentRole.REFACTORER, "error");
    finalSuggestion =
      results.find((r) => r.role === AgentRole.ARCHITECT)?.suggestedCode ||
      results.find((r) => r.role === AgentRole.LINTER)?.suggestedCode;
  }

  return {
    taskId: task.id,
    originalCode: task.code,
    results,
    finalSuggestion,
  };
};

export const CodeReviewOrchestrator = {
  runReview,
};

export default CodeReviewOrchestrator;
