import { z } from "zod";
import crypto from "node:crypto";
import { Result, Ok, Err } from "@/lib/result";
import { OpenAIEmbeddings } from "@langchain/openai";

export interface Chunk {
  id: string;
  text: string;
  index: number;
}

export interface Embedding {
  id: string;
  vector: number[];
  index: number;
}

export const UploadSchema = z.object({
  filename: z.string().min(1),
  content: z.string().min(1),
  mime: z.string().optional(),
});

function splitToChunks(text: string, maxLen = 800): Chunk[] {
  const parts: string[] = [];
  let buf = "";
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (buf.length + line.length + 1 > maxLen) {
      if (buf.trim().length) parts.push(buf);
      buf = line;
    } else {
      buf = buf ? `${buf}\n${line}` : line;
    }
  }
  if (buf.trim().length) parts.push(buf);
  return parts.map((p, i) => ({
    id: crypto.createHash("sha1").update(`${i}:${p}`).digest("hex"),
    text: p,
    index: i,
  }));
}

async function embedWithOpenAI(chunks: Chunk): Promise<number[]>;
async function embedWithOpenAI(chunks: Chunk[]): Promise<number[][]>;
async function embedWithOpenAI(chunks: Chunk | Chunk[]): Promise<number[] | number[][]> {
  const provider = new OpenAIEmbeddings({
    model: "text-embedding-3-small",
  });
  if (Array.isArray(chunks)) {
    return provider.embedDocuments(chunks.map((c) => c.text));
  }
  return provider.embedQuery(chunks.text);
}

function embedFallback(text: string): number[] {
  const bytes = Buffer.from(text, "utf8");
  const dim = 64;
  const vec = new Array(dim).fill(0);
  for (let i = 0; i < bytes.length; i++) {
    vec[i % dim] += bytes[i] / 255;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export async function vectorize(
  input: unknown
): Promise<Result<{ chunks: Chunk[]; embeddings: Embedding[] }>> {
  const parsed = UploadSchema.safeParse(input);
  if (!parsed.success) {
    return Err(parsed.error.message);
  }
  const { content } = parsed.data;
  const chunks = splitToChunks(content);

  const useOpenAI = Boolean(process.env.OPENAI_API_KEY);
  try {
    if (useOpenAI) {
      const vectors = (await embedWithOpenAI(chunks)) as number[][];
      const embeddings: Embedding[] = vectors.map((v, i) => ({
        id: chunks[i].id,
        vector: v,
        index: i,
      }));
      return Ok({ chunks, embeddings });
    } else {
      const embeddings: Embedding[] = chunks.map((c, i) => ({
        id: c.id,
        vector: embedFallback(c.text),
        index: i,
      }));
      return Ok({ chunks, embeddings });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    // 尝试回退
    const embeddings: Embedding[] = chunks.map((c, i) => ({
      id: c.id,
      vector: embedFallback(c.text),
      index: i,
    }));
    return Err(`embedding failed: ${msg}`);
  }
}

export function summarizeEmbeddings(embeddings: Embedding[]): {
  count: number;
  dim: number;
} {
  const dim = embeddings[0]?.vector.length ?? 0;
  return { count: embeddings.length, dim };
}

