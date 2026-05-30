import { Err, Ok, type Result } from "@/lib/result";
import * as kbApi from "@/services/api/kb";
import type { AgentTask } from "./types";

type RAGParseMeta = {
  kbCount: number;
};

type RAGRetrieveMeta = {
  hits: number;
  chars: number;
};

export const runRagParse = async (): Promise<Result<RAGParseMeta>> => {
  const res = await kbApi.retryExportAll(1);
  if (!res.success) return Err(res.error);
  const kbCount = res.data.chunks.length;
  return Ok({ kbCount });
};

export const runRagRetrieve = async (
  task: AgentTask,
  k = 4,
): Promise<Result<{ ctxText: string; meta: RAGRetrieveMeta }>> => {
  const fileName = task.fileName || "component.tsx";
  const language = task.language || "typescript";
  const instruction = task.instruction?.trim();

  const normalizeForQuery = (s: string, maxLen: number) =>
    s.replace(/\s+/g, " ").trim().slice(0, maxLen);
  const codeSnippet = normalizeForQuery(task.code, 1800);
  const query = `目标：代码审查与重构。语言：${language}。重点：命名、Hooks 依赖、类型安全、可维护性、性能。${instruction ? `指挥指令：${normalizeForQuery(instruction, 400)}。` : ""}文件：${fileName}。代码片段：${codeSnippet}`;

  try {
    const retrieved = await kbApi.retrieve({ query, k });
    if (!retrieved.success) return Err(retrieved.error);
    const ctxText = retrieved.data.ctxText || "";
    const meta: RAGRetrieveMeta = {
      hits: retrieved.data.hits,
      chars: retrieved.data.chars,
    };
    return Ok({ ctxText, meta });
  } catch (e) {
    return Err(`构建 RAG 上下文失败：${(e as Error).message}`);
  }
};

export type { RAGParseMeta, RAGRetrieveMeta };
