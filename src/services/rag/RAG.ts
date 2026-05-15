import {
  lcTools
} from './../functionCalling/tools';
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
export interface StoredDocument {
  pageContent: string;
  metadata: Record<string, unknown>;
  vector: number[];
}

// Module-level state
let docs: StoredDocument[] = [];
let embeddings: OpenAIEmbeddings | null = null;
let vectorMode: "openai" | "fallback" | null = null;
// EMBEDDING=text-embedding-ada-002
// AI_KEY=sk-...
// AI_BASE_URL=https://api.302.ai/v1
// MODEL=claude-3-7-sonnet-latest
const getEmbeddings = () => {
  if (!embeddings) {
    const apiKey = localStorage.getItem("OPENAI_API_KEY") || "";
    if (!apiKey) return null;
    const baseUrl = localStorage.getItem("OPENAI_BASE_URL") || "https://api.302.ai/v1";

    embeddings = new OpenAIEmbeddings({
      apiKey,
      model: "text-embedding-3-small",
      configuration: {
        baseURL: baseUrl || undefined,
      },
    });
  }

  return embeddings;
};

function embedFallback(text: string): number[] {
  const bytes = new TextEncoder().encode(text);
  const dim = 64;
  const vec = new Array(dim).fill(0);
  for (let i = 0; i < bytes.length; i++) {
    vec[i % dim] += bytes[i] / 255;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

async function embedDocuments(texts: string[]): Promise<number[][]> {
  if (vectorMode === "fallback") {
    return texts.map(embedFallback);
  }
  const provider = getEmbeddings();
  if (!provider) {
    vectorMode = "fallback";
    return texts.map(embedFallback);
  }
  try {
    const vectors = await provider.embedDocuments(texts);
    vectorMode = "openai";
    return vectors;
  } catch {
    vectorMode = "fallback";
    return texts.map(embedFallback);
  }
}

async function embedQuery(text: string): Promise<number[]> {
  if (vectorMode === "fallback") {
    return embedFallback(text);
  }
  const provider = getEmbeddings();
  if (!provider) {
    vectorMode = "fallback";
    return embedFallback(text);
  }
  try {
    const vec = await provider.embedQuery(text);
    vectorMode = "openai";
    return vec;
  } catch {
    vectorMode = "fallback";
    return embedFallback(text);
  }
}

const estTokens = (s: string) => Math.ceil(s.length / 4);
const smartSplitText = (text: string, maxTokens = 320, overlapTokens = 64) => {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const segs: Array<{ type: "code" | "text"; content: string }> = [];
  let i = 0;
  let buf: string[] = [];
  while (i < lines.length) {
    const m = /^(```|~~~)\s*([a-zA-Z0-9+._-]*)?\s*$/.exec(lines[i]);
    if (m) {
      if (buf.length) {
        segs.push({ type: "text", content: buf.join("\n") });
        buf = [];
      }
      const marker = m[1];
      const start = i;
      i++;
      while (i < lines.length && !new RegExp(`^${marker}\\s*$`).test(lines[i])) i++;
      if (i < lines.length) i++;
      segs.push({ type: "code", content: lines.slice(start, i).join("\n") });
      continue;
    }
    buf.push(lines[i]);
    i++;
  }
  if (buf.length) segs.push({ type: "text", content: buf.join("\n") });
  const out: string[] = [];
  const pushWithOverlap = (chunk: string) => {
    if (out.length === 0) {
      out.push(chunk);
      return;
    }
    const prev = out[out.length - 1];
    const overlapChars = Math.max(0, Math.floor((overlapTokens * 4)));
    const tail = prev.slice(Math.max(0, prev.length - overlapChars));
    out.push(tail + (tail ? "\n" : "") + chunk);
  };
  for (const seg of segs) {
    if (seg.type === "code") {
      const t = estTokens(seg.content);
      if (t <= maxTokens) {
        pushWithOverlap(seg.content);
      } else {
        const codeLines = seg.content.split("\n");
        let buf2: string[] = [];
        for (const l of codeLines) {
          const tmp = buf2.length ? buf2.join("\n") + "\n" + l : l;
          if (estTokens(tmp) > maxTokens) {
            if (buf2.length) pushWithOverlap(buf2.join("\n"));
            buf2 = [l];
          } else {
            buf2.push(l);
          }
        }
        if (buf2.length) pushWithOverlap(buf2.join("\n"));
      }
    } else {
      const paras = seg.content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
      let acc: string[] = [];
      for (const p of paras) {
        const tmp = acc.length ? acc.join("\n\n") + "\n\n" + p : p;
        if (estTokens(tmp) > maxTokens) {
          if (acc.length) pushWithOverlap(acc.join("\n\n"));
          acc = [p];
        } else {
          acc.push(p);
        }
      }
      if (acc.length) pushWithOverlap(acc.join("\n\n"));
    }
  }
  return out;
};

const computeChunkLineRanges = (original: string, chunks: string[]) => {
  const ranges: Array<{ startLine: number; endLine: number }> = [];
  let cursor = 0;
  const safeIndexOf = (hay: string, needle: string, fromIdx: number) => {
    let pos = hay.indexOf(needle, fromIdx);
    if (pos !== -1) return pos;
    const prefix = needle.slice(0, Math.min(80, needle.length)).trim();
    if (prefix.length > 0) {
      pos = hay.indexOf(prefix, fromIdx);
      if (pos !== -1) return pos;
    }
    const suffix = needle.slice(-Math.min(80, needle.length)).trim();
    if (suffix.length > 0) {
      pos = hay.indexOf(suffix, fromIdx);
      if (pos !== -1) return pos;
    }
    return hay.indexOf(needle);
  };
  for (const chunk of chunks) {
    const pos = safeIndexOf(original, chunk, cursor);
    const before = pos >= 0 ? original.slice(0, pos) : original.slice(0, cursor);
    const startLine = before.split("\n").length;
    const endLine = startLine + chunk.split("\n").length - 1;
    ranges.push({ startLine, endLine });
    if (pos >= 0) {
      cursor = pos + Math.floor(chunk.length * 0.6);
    } else {
      cursor = cursor + Math.floor(chunk.length * 0.6);
    }
  }
  return ranges;
};

const computeHitInsideChunk = (query: string, chunk: string, chunkStartLine?: number) => {
  const lines = chunk.split("\n");
  const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
  const qn = norm(query).slice(0, 200);
  let hitStart = -1;
  let hitEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    const ln = norm(lines[i]);
    if (qn && ln.includes(qn)) {
      hitStart = i;
      hitEnd = i;
      break;
    }
  }
  if (hitStart === -1) {
    const base = norm(query).replace(/[^a-z0-9\u4e00-\u9fa5]/gi, "");
    const windows: string[] = [];
    const L = base.length;
    const w = Math.max(6, Math.min(24, Math.floor(L / 2) || 6));
    for (let i = 0; i + w <= L; i += Math.max(3, Math.floor(w / 2))) {
      windows.push(base.slice(i, i + w));
      if (windows.length > 6) break;
    }
    let bestIdx = -1;
    let bestScore = -1;
    for (let i = 0; i < lines.length; i++) {
      const ln = norm(lines[i]);
      let score = 0;
      for (const win of windows) {
        if (win && ln.includes(win)) score += win.length;
      }
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    if (bestIdx !== -1 && bestScore > 0) {
      hitStart = bestIdx;
      hitEnd = bestIdx;
    }
  }
  if (hitStart === -1) {
    const tokens = query
      .toLowerCase()
      .split(/[\s,.;:，。；：]+/)
      .filter((t) => t.length >= 3)
      .slice(0, 6);
    if (tokens.length) {
      const scores = lines.map((ln) => {
        const n = ln.toLowerCase();
        let s = 0;
        for (const t of tokens) if (n.includes(t)) s++;
        return s;
      });
      let bestIdx = -1;
      let bestScore = -1;
      for (let i = 0; i < scores.length; i++) {
        if (scores[i] > bestScore) {
          bestScore = scores[i];
          bestIdx = i;
        }
      }
      if (bestIdx !== -1 && bestScore > 0) {
        hitStart = bestIdx;
        hitEnd = bestIdx;
      }
    }
  }
  if (hitStart === -1) {
    hitStart = 0;
    hitEnd = Math.min(lines.length - 1, 0);
  }
  let winStart = Math.max(0, hitStart - 2);
  let winEnd = Math.min(lines.length - 1, hitEnd + 2);
  const hitText = lines.slice(winStart, winEnd + 1).join("\n");
  const absStart = typeof chunkStartLine === "number" ? chunkStartLine + hitStart : undefined;
  const absEnd = typeof chunkStartLine === "number" ? chunkStartLine + hitEnd : undefined;
  return { hitStartAbs: absStart, hitEndAbs: absEnd, hitText };
};

const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Vectorize text and store locally (in-memory)
 */
// 整体的流程就是-> 再输入文档后,先把内容向量化,然后存储到本地,然后把文档进行chunk分割,因为要避免所有的文档,一块处理,超限
export const addText = async (
  text: string,
  metadata: Record<string, unknown> = {},
): Promise<void> => {
  const chunks = smartSplitText(text);
  // Batch embed documents
  const vectors = await embedDocuments(chunks);
  const ranges = computeChunkLineRanges(text, chunks);

  chunks.forEach((chunk, i) => {
    docs.push({
      pageContent: chunk,
      metadata: { ...metadata, chunkIndex: i, lineStart: ranges[i]?.startLine, lineEnd: ranges[i]?.endLine },
      vector: vectors[i]
    });
  });
};


let llm: ChatOpenAI | null = null;
const init = () => {
  const apiKey = localStorage.getItem('OPENAI_API_KEY');
  const baseUrl = localStorage.getItem('OPENAI_BASE_URL');
  if (!apiKey) {
    throw new Error("OpenAI API Key not found. Please set it in Settings.");
  }

  if (!llm) {
    llm = new ChatOpenAI({
      apiKey: apiKey,
      configuration: {
        baseURL: baseUrl || undefined,
      },
      modelName: "gpt-3.5-turbo",
      temperature: 0.7,
    });
  }

  return llm
}
/**
 * Search for similar documents
 */
export const search = async (query: string, k: number = 4): Promise<{ doc: StoredDocument; score: number }[]> => {
  // 1. Vectorize the query
  const queryVector = await embedQuery(query);

  // 2. Calculate Similarity
  const scoredDocs = docs.map((doc) => ({
    doc,
    score: cosineSimilarity(queryVector, doc.vector),
  }));

  // 3. Sort by score
  scoredDocs.sort((a, b) => b.score - a.score);

  return scoredDocs.slice(0, k);
};

// 发起LLM请求 - 流式输出版本
export const getLLm = async (
  query: string,
  onChunk: (chunk: string) => void,
): Promise<{
  citations: {
    filename?: string;
    chunkIndex: number;
    preview: string;
    score?: number;
    content?: string;
    startLine?: number;
    endLine?: number;
  }[];
}> => {
  const llm = init();
  const llmWithTools = (llm as any).bindTools?.(lcTools) || llm;
  const retrieved = await search(query);
  const contextStr = retrieved.map((r) => r.doc.pageContent).join("\n\n");

  const prompt = ChatPromptTemplate.fromTemplate(`Answer the question based only on the following context:
{context}

 
Question: {question}`);

  const chain = RunnableSequence.from([prompt, llmWithTools]);

  try {
    const stream = await chain.stream({ context: contextStr, question: query });

    let fullContent = "";
    let rafId: number | null = null;
    const flushBuffer = (buffer: string) => {
      onChunk(buffer);
      rafId = null;
    };

    for await (const chunk of stream) {
      if (chunk?.content) {
        fullContent += chunk.content;
        if (rafId === null) {
          rafId = requestAnimationFrame(() => flushBuffer(fullContent));
        }
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "unknown error";
    const errorMsg = `处理请求时出错: ${msg}`;
    for (const ch of errorMsg) {
      onChunk(ch);
      await new Promise((r) => setTimeout(r, 16));
    }
  }

  const citations = retrieved.map((r) => {
    const meta = r.doc.metadata;
    const fn = typeof meta?.filename === "string" ? meta.filename : undefined;
    const idx = typeof meta?.chunkIndex === "number" ? meta.chunkIndex : 0;
    const cls = typeof meta?.lineStart === "number" ? meta.lineStart : undefined;
    const { hitStartAbs, hitEndAbs, hitText } = computeHitInsideChunk(query, r.doc.pageContent, cls);
    return {
      filename: fn,
      chunkIndex: idx,
      preview: r.doc.pageContent.slice(0, 80),
      score: r.score,
      content: r.doc.pageContent,
      startLine: hitStartAbs,
      endLine: hitEndAbs,
      hitText,
    };
  });
  return { citations };
};





/**
 * Clear all stored vectors
 */
export const clear = () => {
  docs = [];
};
export const listDocs = (): Array<{ filename?: string; chunkIndex?: number; content: string; lineStart?: number; lineEnd?: number }> => {
  return docs.map((d) => ({
    filename: typeof d.metadata?.filename === 'string' ? d.metadata.filename : undefined,
    chunkIndex: typeof d.metadata?.chunkIndex === 'number' ? d.metadata.chunkIndex : undefined,
    content: d.pageContent,
    lineStart: typeof d.metadata?.lineStart === 'number' ? d.metadata.lineStart : undefined,
    lineEnd: typeof d.metadata?.lineEnd === 'number' ? d.metadata.lineEnd : undefined,
  }));
};
