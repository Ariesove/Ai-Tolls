import { NextRequest, NextResponse } from "next/server";
import { vectorize, summarizeEmbeddings } from "@/services/rag/ingest";
import { Ok, Err } from "@/lib/result";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(Err("缺少文件字段 file"), { status: 400 });
    }
    const text = await file.text();
    const res = await vectorize({
      filename: file.name,
      content: text,
      mime: file.type,
    });
    if (!res.success) {
      return NextResponse.json(Err(res.error), { status: 500 });
    }
    const summary = summarizeEmbeddings(res.data.embeddings);
    return NextResponse.json(
      Ok({
        filename: file.name,
        chunks: res.data.chunks.length,
        embedding_dim: summary.dim,
      }),
      { status: 200 }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json(Err(msg), { status: 500 });
  }
}

