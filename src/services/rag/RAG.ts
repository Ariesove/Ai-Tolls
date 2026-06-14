import {
  lcTools
} from './../functionCalling/tools';
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { Err, Ok, type Result } from "@/lib/result";
import * as kbApi from "@/services/api/kb";
import type { Attachment } from "@/types/chat";
import { shouldGenerateImage, extractImagePrompt, generateImage } from "@/services/image-generation";
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
    return { hitStartAbs: undefined, hitEndAbs: undefined, hitText: "" };
  }
  let winStart = Math.max(0, hitStart - 2);
  let winEnd = Math.min(lines.length - 1, hitEnd + 2);
  const hitText = lines.slice(winStart, winEnd + 1).join("\n");
  const absStart = typeof chunkStartLine === "number" ? chunkStartLine + hitStart : undefined;
  const absEnd = typeof chunkStartLine === "number" ? chunkStartLine + hitEnd : undefined;
  return { hitStartAbs: absStart, hitEndAbs: absEnd, hitText };
};

const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  const n = Math.min(vecA.length, vecB.length);
  if (n === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < n; i++) {
    const a = vecA[i] ?? 0;
    const b = vecB[i] ?? 0;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom ? dotProduct / denom : 0;
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

export const addPrecomputed = (input: {
  originalText: string;
  chunks: Array<{ content: string; vector: number[]; chunkIndex: number }>;
  metadata?: Record<string, unknown>;
}): Result<true> => {
  const meta = input.metadata ?? {};
  const ordered = [...input.chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
  const texts = ordered.map((c) => c.content);
  const ranges = computeChunkLineRanges(input.originalText, texts);
  for (let i = 0; i < ordered.length; i++) {
    const c = ordered[i];
    const r = ranges[i];
    docs.push({
      pageContent: c.content,
      metadata: {
        ...meta,
        chunkIndex: c.chunkIndex,
        lineStart: r?.startLine,
        lineEnd: r?.endLine,
      },
      vector: c.vector,
    });
  }
  return Ok(true as const);
};

export const hydrateFromDb = async (): Promise<
  Result<{ documents: number; chunks: number; dim: number }>
> => {
  const res = await kbApi.retryExportAll(2);
  if (!res.success) return Err(res.error);

  clear();
  for (const doc of res.data.documents) {
    const chunks = res.data.chunks
      .filter((c) => c.documentId === doc.id)
      .map((c) => ({ content: c.content, vector: c.embedding, chunkIndex: c.chunkIndex }));
    addPrecomputed({
      originalText: doc.content,
      chunks,
      metadata: {
        filename: doc.filename,
        source: doc.source,
        documentId: doc.id,
      },
    });
  }

  const dim = res.data.chunks[0]?.embedding.length ?? 0;
  return Ok({
    documents: res.data.documents.length,
    chunks: res.data.chunks.length,
    dim,
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
        timeout: 120000, // 增加超时到 2 分钟
      },
      model: "gpt-4o",
      temperature: 0.7,
    });
  }

  return llm
}
/**
 * Search for similar documents
 */
export const search = async (
  query: string,
  k: number = 4,
): Promise<{ doc: StoredDocument; score: number }[]> => {
  const qRaw = typeof query === "string" ? query.trim() : "";
  if (!qRaw) return [];

  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, "");
  const qNorm = normalize(qRaw);
  if (!qNorm) return [];

  const latinTokens = (qRaw.match(/[a-z0-9]+/gi) || [])
    .map((t) => t.toLowerCase())
    .filter((t) => t.length >= 2);
  const zhTokens = (qRaw.match(/[\u4e00-\u9fa5]{2,}/g) || []).filter(Boolean);
  const tokens = Array.from(new Set([...latinTokens, ...zhTokens, qNorm])).filter(Boolean);

  const docNorm = (d: StoredDocument) => normalize(d.pageContent);
  const filenameNorm = (d: StoredDocument) => {
    const fn = (d.metadata as any)?.filename;
    return typeof fn === "string" ? normalize(fn) : "";
  };
  const tokenHitCount = (d: StoredDocument) => {
    const body = docNorm(d);
    const fn = filenameNorm(d);
    let hits = 0;
    for (const t of tokens) {
      const tn = normalize(String(t));
      if (!tn) continue;
      if (body.includes(tn) || fn.includes(tn)) hits++;
    }
    return hits;
  };

  const primaryLatin = latinTokens[0] || "";
  const docsHitPrimaryLatin =
    primaryLatin &&
    docs.some((d) => docNorm(d).includes(primaryLatin) || filenameNorm(d).includes(primaryLatin));

  const docCandidates = docsHitPrimaryLatin
    ? docs.filter((d) => docNorm(d).includes(primaryLatin) || filenameNorm(d).includes(primaryLatin))
    : docs;

  let queryVector = await embedQuery(qRaw);
  let vecCandidates = docCandidates.filter((d) => d.vector.length === queryVector.length);
  if (vecCandidates.length === 0 && queryVector.length !== 64) {
    const fallbackVec = embedFallback(qRaw);
    if (docCandidates.some((d) => d.vector.length === fallbackVec.length)) {
      queryVector = fallbackVec;
      vecCandidates = docCandidates.filter((d) => d.vector.length === queryVector.length);
    }
  }
  if (vecCandidates.length === 0) vecCandidates = docCandidates;

  const qIsShortLatin = qNorm.length <= 6 && /^[a-z0-9]+$/i.test(qNorm);
  const directMatches = vecCandidates.filter((d) => tokenHitCount(d) > 0);
  const strictCandidates = qIsShortLatin && directMatches.length > 0 ? directMatches : vecCandidates;

  const minScore = qNorm.length <= 6 ? 0.45 : 0.25;
  const scored = strictCandidates
    .map((doc) => {
      const base = cosineSimilarity(queryVector, doc.vector);
      const hits = tokenHitCount(doc);
      const boost = hits > 0 ? hits * 0.25 : 0;
      return { doc, score: base + boost };
    })
    .filter(({ doc, score }) => tokenHitCount(doc) > 0 || score >= minScore)
    .sort((a, b) => b.score - a.score);

  const unique = new Map<string, { doc: StoredDocument; score: number }>();
  for (const it of scored) {
    const fn = filenameNorm(it.doc);
    const idx =
      typeof (it.doc.metadata as any)?.chunkIndex === "number"
        ? String((it.doc.metadata as any).chunkIndex)
        : "na";
    const key = `${fn}::${idx}::${normalize(it.doc.pageContent.slice(0, 120))}`;
    const prev = unique.get(key);
    if (!prev || it.score > prev.score) unique.set(key, it);
  }

  return Array.from(unique.values()).slice(0, k);
};

// 将 blob URL 转换为 base64
const blobToBase64 = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Image conversion timeout'));
    }, 10000); // 10 秒超时

    fetch(url)
      .then(res => res.blob())
      .then(blob => {
        console.log(`Processing image: ${(blob.size / 1024).toFixed(1)}KB`);
        const reader = new FileReader();
        reader.onloadend = () => {
          clearTimeout(timeout);
          const result = reader.result as string;
          console.log(`Base64 size: ${(result.length / 1024).toFixed(1)}KB`);
          resolve(result);
        };
        reader.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Failed to read image'));
        };
        reader.readAsDataURL(blob);
      })
      .catch(err => {
        clearTimeout(timeout);
        reject(err);
      });
  });
};

// 发起LLM请求 - 支持多模态的流式输出版本
export const getLLm = async (
  query: string,
  onChunk: (chunk: string) => void,
  attachments?: Attachment[],
): Promise<{
  citations: {
    filename?: string;
    chunkIndex: number;
    preview: string;
    score?: number;
    content?: string;
    startLine?: number;
    endLine?: number;
    hitText?: string;
  }[];
  generatedAttachments?: Attachment[];
}> => {
  const llm = init();
  const llmWithTools = (llm as any).bindTools?.(lcTools) || llm;

  console.log("=== getLLm 被调用，query:", query);

  // 测试 shouldGenerateImage 函数
  console.log("测试1: '给我生成风景图片冬天' ->", shouldGenerateImage("给我生成风景图片冬天"));
  console.log("测试2: '生成图片' ->", shouldGenerateImage("生成图片"));
  console.log("测试3: 'hello' ->", shouldGenerateImage("hello"));

  console.log("当前 query 的判断结果:", shouldGenerateImage(query));
  console.log("shouldGenerateImage 函数:", shouldGenerateImage);

  // 最高优先级：检查是否需要生成图片
  const shouldGen = shouldGenerateImage(query);
  console.log("shouldGen 结果:", shouldGen);

  if (shouldGen) {
    console.log("触发图片生成逻辑");
    try {
      onChunk("正在生成图片，请稍候...\n\n");

      const imagePrompt = extractImagePrompt(query);
      console.log("Generating image with prompt:", imagePrompt);

      const generatedImage = await generateImage(imagePrompt);

      onChunk(`图片已生成！\n\n描述: ${imagePrompt}`);

      return {
        citations: [],
        generatedAttachments: [generatedImage]
      };
    } catch (error) {
      console.error("Image generation error:", error);
      const msg = error instanceof Error ? error.message : "unknown error";
      let errorMsg: string;

      if (msg.includes("timeout") || msg.includes("TIMEOUT") || msg.includes("超时")) {
        errorMsg = "图片生成超时\n\n可能的原因：\n1. API 服务响应较慢\n2. 网络连接不稳定\n\n建议：\n- 稍后重试\n- 简化图片描述\n- 检查 API 配置";
      } else if (msg.includes("429") || msg.includes("rate limit")) {
        errorMsg = "请求频率超限\n\n请稍后再试。";
      } else if (msg.includes("content_policy") || msg.includes("违规")) {
        errorMsg = "内容违反政策\n\n请修改图片描述后重试。";
      } else {
        errorMsg = `图片生成失败: ${msg}\n\n请检查：\n- API Key 是否正确\n- API 是否支持图片生成\n- 网络连接是否正常`;
      }

      onChunk(errorMsg);
      return { citations: [] };
    }
  }

  // 如果有附件，优先直接使用 vision LLM 处理，不依赖知识库
  if (attachments && attachments.length > 0) {
    try {
      onChunk("正在处理图片，请稍候...\n\n");

      // 构建多模态消息内容
      const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

      // 添加文本部分
      if (query) {
        contentParts.push({ type: "text", text: query });
      }

      // 处理所有图片附件
      for (const att of attachments) {
        if (att.type === 'image') {
          try {
            // 尝试转换为 base64
            let imageUrl = att.url;
            if (att.url.startsWith('blob:')) {
              imageUrl = await blobToBase64(att.url);
            }
            contentParts.push({
              type: "image_url",
              image_url: { url: imageUrl }
            });
          } catch (e) {
            console.error("Failed to process image attachment:", e);
          }
        }
      }

      // 如果没有文本，添加默认提示
      if (!query) {
        contentParts.unshift({ type: "text", text: "请描述这张图片的内容。" });
      }

      const humanMessage = new HumanMessage({ content: contentParts });
      console.log("Sending request to Vision LLM...");
      const stream = await llmWithTools.stream([humanMessage]);

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

      return { citations: [] };
    } catch (error) {
      console.error("Vision LLM error:", error);
      const msg = error instanceof Error ? error.message : "unknown error";
      let errorMsg: string;

      if (msg.includes("timeout") || msg.includes("TIMEOUT") || msg.includes("超时")) {
        errorMsg = "请求超时\n\n可能的原因：\n1. API 服务响应较慢\n2. 网络连接不稳定\n3. 图片处理耗时较长\n\n建议：\n- 稍后重试\n- 使用更小的图片\n- 检查 API 配置";
      } else if (msg.includes("429") || msg.includes("rate limit")) {
        errorMsg = "请求频率超限\n\n请稍后再试。";
      } else {
        errorMsg = `处理图片时出错: ${msg} \n\n请检查：\n - API Key 是否正确\n - 网络连接是否正常\n - 图片格式是否支持`;
      }

      onChunk(errorMsg);
      return { citations: [] };
    }
  }

  // 没有附件时，走原来的知识库 RAG 流程
  const retrieved = await search(query);
  if (retrieved.length === 0) {
    const msg = "未在知识库中找到与问题相关的内容，请先补充资料或调整问题表述。";
    for (const ch of msg) {
      onChunk(ch);
      await new Promise((r) => setTimeout(r, 8));
    }
    return { citations: [] };
  }
  const contextStr = retrieved.map((r) => r.doc.pageContent).join("\n\n");

  const prompt = ChatPromptTemplate.fromTemplate(`Answer the question based only on the following context:
        { context }


        Question: { question } `);

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
    const errorMsg = `处理请求时出错: ${msg} `;
    for (const ch of errorMsg) {
      onChunk(ch);
      await new Promise((r) => setTimeout(r, 16));
    }
  }

  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, "");
  const latinTokens = (query.match(/[a-z0-9]+/gi) || [])
    .map((t) => t.toLowerCase())
    .filter((t) => t.length >= 2);
  const zhTokens = (query.match(/[\u4e00-\u9fa5]{2,}/g) || []).filter(Boolean);
  const tokens = Array.from(new Set([...latinTokens, ...zhTokens])).filter(Boolean);

  const citations = retrieved.slice(0, 4).map((r) => {
    const meta = r.doc.metadata;
    const fn = typeof meta?.filename === "string" ? meta.filename : undefined;
    const idx = typeof meta?.chunkIndex === "number" ? meta.chunkIndex : 0;
    const cls = typeof meta?.lineStart === "number" ? meta.lineStart : undefined;
    const chunkNorm = normalize(r.doc.pageContent);
    const bestToken =
      tokens.find((t) => chunkNorm.includes(normalize(t))) || query;
    const { hitStartAbs, hitEndAbs, hitText } = computeHitInsideChunk(
      bestToken,
      r.doc.pageContent,
      cls,
    );

    const rawScore =
      typeof r.score === "number" && Number.isFinite(r.score) ? r.score : undefined;
    const score = typeof rawScore === "number" && rawScore >= 0 ? rawScore : undefined;
    const hasHit = typeof hitText === "string" && hitText.trim().length > 0;

    return {
      filename: fn,
      chunkIndex: idx,
      preview: r.doc.pageContent.slice(0, 80),
      score,
      content: r.doc.pageContent,
      startLine: hasHit ? hitStartAbs : undefined,
      endLine: hasHit ? hitEndAbs : undefined,
      hitText: hasHit ? hitText : undefined,
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
