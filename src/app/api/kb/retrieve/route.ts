import { NextResponse } from "next/server";
import { z } from "zod";
import { OpenAIEmbeddings } from "@langchain/openai";
import { listChunksWithDocument } from "@/services/db/kbDb";
import { buildRagCtxText } from "@/services/rag/ragEvidence";

export const runtime = "nodejs";

const RetrieveSchema = z.object({
  query: z.string().min(1),
  k: z.number().int().positive().max(12).optional(),
});

const embedFallback = (text: string): number[] => {
  const bytes = Buffer.from(text, "utf8");
  const dim = 64;
  const vec = new Array(dim).fill(0);
  for (let i = 0; i < bytes.length; i++) {
    vec[i % dim] += bytes[i] / 255;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
};

const embedQuery = async (text: string): Promise<number[]> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return embedFallback(text);
  const baseURL = process.env.OPENAI_BASE_URL;
  const provider = new OpenAIEmbeddings({
    apiKey,
    model: "text-embedding-3-small",
    configuration: { baseURL: baseURL || undefined },
  });
  return provider.embedQuery(text);
};

const cosineSimilarity = (a: number[], b: number[]): number => {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot / denom : 0;
};

export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  const parsed = RetrieveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "参数不合法", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { query } = parsed.data;
  const k = parsed.data.k ?? 4;

  const rowsRes = await listChunksWithDocument();
  if (!rowsRes.success) {
    return NextResponse.json({ error: rowsRes.error }, { status: 500 });
  }
  const rows = rowsRes.data;
  if (rows.length === 0) {
    return NextResponse.json({
      data: { ctxText: "", hits: 0, chars: 0, evidence: [] },
    });
  }

  let qVec: number[];
  try {
    qVec = await embedQuery(query);
  } catch (e) {
    return NextResponse.json(
      { error: `query embedding failed: ${(e as Error).message}` },
      { status: 500 },
    );
  }

  const scored = rows
    .map((r) => ({
      r,
      score: cosineSimilarity(qVec, r.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  const blocks = scored.map(({ r, score }, idx) => {
    const header = [
      `#${idx + 1}`,
      r.filename ? `file=${r.filename}` : undefined,
      typeof r.chunkIndex === "number" ? `chunk=${r.chunkIndex}` : undefined,
      `score=${score.toFixed(4)}`,
    ]
      .filter(Boolean)
      .join(" ");
    return `${header}\n${r.chunkContent}`;
  });

  const ctxText = buildRagCtxText(blocks);

  const evidence = scored.map(({ r, score }) => ({
    title: [
      r.filename ? `file=${r.filename}` : "file=unknown",
      `chunk=${r.chunkIndex}`,
      `score=${score.toFixed(4)}`,
    ].join(" "),
    filename: r.filename,
    chunkIndex: r.chunkIndex,
    score,
    preview: r.chunkContent.slice(0, 260),
    content: r.chunkContent,
  }));

  return NextResponse.json({
    data: {
      ctxText,
      hits: blocks.length,
      chars: ctxText.length,
      evidence,
      dim: qVec.length,
    },
  });
}
