import { Result, Ok, Err } from "@/lib/result";
import { search } from "@/services/rag/RAG";

const asString = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;

const asNumber = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

const normalizeForQuery = (s: string, maxLen: number) =>
  s.replace(/\s+/g, " ").trim().slice(0, maxLen);

export interface BuildReviewContextInput {
  code: string;
  fileName?: string;
  language: string;
  k?: number;
}

export const buildReviewContext = async (
  input: BuildReviewContextInput,
): Promise<Result<string>> => {
  try {
    const k = typeof input.k === "number" && input.k > 0 ? input.k : 4;
    const fileName = input.fileName ?? "unknown";
    const codeSnippet = normalizeForQuery(input.code, 1800);
    const query = `目标：代码审查与重构。语言：${input.language}。重点：命名、Hooks 依赖、类型安全、可维护性、性能。文件：${fileName}。代码片段：${codeSnippet}`;

    const retrieved = await search(query, k);
    const blocks = retrieved.map((r, idx) => {
      const meta = r.doc.metadata as unknown;
      const filename =
        meta && typeof meta === "object"
          ? asString((meta as Record<string, unknown>).filename)
          : undefined;
      const chunkIndex =
        meta && typeof meta === "object"
          ? asNumber((meta as Record<string, unknown>).chunkIndex)
          : undefined;
      const lineStart =
        meta && typeof meta === "object"
          ? asNumber((meta as Record<string, unknown>).lineStart)
          : undefined;
      const lineEnd =
        meta && typeof meta === "object"
          ? asNumber((meta as Record<string, unknown>).lineEnd)
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

    const context = blocks.length
      ? `来自知识库的相关片段（Top ${blocks.length}）：\n\n${blocks.join("\n\n---\n\n")}`
      : "";

    return Ok(context);
  } catch (e) {
    return Err(`构建 RAG 上下文失败：${(e as Error).message}`);
  }
};

