import { Err, Ok, type Result } from "@/lib/result";
import { listDocs, search } from "@/services/rag/RAG";
import type { AgentTask } from "./types";

type RAGParseMeta = {
  kbCount: number;
};

type RAGRetrieveMeta = {
  hits: number;
  chars: number;
};

const safeListDocsCount = (): number => {
  try {
    const docs = listDocs();
    return Array.isArray(docs) ? docs.length : 0;
  } catch {
    return 0;
  }
};

const deriveRetrieveMeta = (ctxText: string): RAGRetrieveMeta => {
  const hits = ctxText ? ctxText.split("\n---\n").length : 0;
  return { hits, chars: ctxText.length };
};

export const runRagParse = (): Result<RAGParseMeta> => {
  const kbCount = safeListDocsCount();
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
    const retrieved = await search(query, k);
    const blocks = retrieved.map((r, idx) => {
      const metaRaw = r.doc.metadata as unknown;
      const rec =
        metaRaw && typeof metaRaw === "object" && !Array.isArray(metaRaw)
          ? (metaRaw as Record<string, unknown>)
          : undefined;
      const filename = typeof rec?.filename === "string" ? rec.filename : undefined;
      const chunkIndex =
        typeof rec?.chunkIndex === "number" && Number.isFinite(rec.chunkIndex)
          ? rec.chunkIndex
          : undefined;
      const lineStart =
        typeof rec?.lineStart === "number" && Number.isFinite(rec.lineStart)
          ? rec.lineStart
          : undefined;
      const lineEnd =
        typeof rec?.lineEnd === "number" && Number.isFinite(rec.lineEnd)
          ? rec.lineEnd
          : undefined;

      const header = [
        `#${idx + 1}`,
        filename ? `file=${filename}` : undefined,
        typeof chunkIndex === "number" ? `chunk=${chunkIndex}` : undefined,
        typeof r.score === "number" ? `score=${r.score.toFixed(4)}` : undefined,
        typeof lineStart === "number" && typeof lineEnd === "number"
          ? `lines=${lineStart}-${lineEnd}`
          : undefined,
      ]
        .filter(Boolean)
        .join(" ");

      return `${header}\n${r.doc.pageContent}`;
    });

    const ctxText = blocks.length
      ? `来自知识库的相关片段（Top ${blocks.length}）：\n\n${blocks.join("\n\n---\n\n")}`
      : "";
    const meta = deriveRetrieveMeta(ctxText);
    return Ok({ ctxText, meta });
  } catch (e) {
    return Err(`构建 RAG 上下文失败：${(e as Error).message}`);
  }
};

export type { RAGParseMeta, RAGRetrieveMeta };
