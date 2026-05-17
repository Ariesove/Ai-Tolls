import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { vectorize } from "@/services/rag/ingest";
import { upsertChunks, upsertDocument } from "@/services/db/kbDb";

export const runtime = "nodejs";

const IngestSchema = z.object({
  filename: z.string().min(1),
  content: z.string().min(1),
  mime: z.string().optional(),
  source: z.string().optional(),
});

export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  const parsed = IngestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "参数不合法", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { filename, content, mime, source } = parsed.data;
  const vecRes = await vectorize({ filename, content, mime });
  if (!vecRes.success) {
    return NextResponse.json({ error: vecRes.error }, { status: 500 });
  }

  const now = Date.now();
  const docRes = await upsertDocument({
    id: randomUUID(),
    filename,
    mime,
    source,
    content,
    createdAt: now,
    updatedAt: now,
  });
  if (!docRes.success) {
    return NextResponse.json({ error: docRes.error }, { status: 500 });
  }

  const chunkMap = new Map(vecRes.data.embeddings.map((e) => [e.index, e]));
  const rows = vecRes.data.chunks.map((c) => ({
    chunkIndex: c.index,
    chunkId: c.id,
    content: c.text,
    embedding: chunkMap.get(c.index)?.vector ?? [],
    createdAt: now,
  }));

  const chunksRes = await upsertChunks({
    documentId: docRes.data.id,
    chunks: rows,
  });
  if (!chunksRes.success) {
    return NextResponse.json({ error: chunksRes.error }, { status: 500 });
  }

  const dim = vecRes.data.embeddings[0]?.vector.length ?? 0;
  return NextResponse.json(
    {
      data: {
        documentId: docRes.data.id,
        chunks: rows.length,
        dim,
      },
    },
    { status: 201 },
  );
}

