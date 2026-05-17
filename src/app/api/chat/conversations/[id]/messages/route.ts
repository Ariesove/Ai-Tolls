import { NextResponse } from "next/server";
import { z } from "zod";
import { appendMessage, listMessages } from "@/services/db/chatDb";

export const runtime = "nodejs";

const ParamsSchema = z.object({ id: z.string().uuid() });

const AttachmentSchema = z.object({
  id: z.string().min(1),
  type: z.literal("image"),
  url: z.string().min(1),
  name: z.string().min(1),
});

const CitationSchema = z.object({
  filename: z.string().optional(),
  chunkIndex: z.number().int().nonnegative(),
  preview: z.string(),
  score: z.number().optional(),
  content: z.string().optional(),
  startLine: z.number().int().optional(),
  endLine: z.number().int().optional(),
  hitText: z.string().optional(),
});

const AppendMessageSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  createdAt: z.number().int().nonnegative(),
  status: z.enum(["sending", "sent", "error"]).optional(),
  attachments: z.array(AttachmentSchema).optional(),
  citations: z.array(CitationSchema).optional(),
});

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const parsed = ParamsSchema.safeParse(ctx.params);
  if (!parsed.success) {
    return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  }

  const res = await listMessages(parsed.data.id);
  if (!res.success) {
    return NextResponse.json({ error: res.error }, { status: 500 });
  }
  return NextResponse.json({ data: res.data });
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const paramsParsed = ParamsSchema.safeParse(ctx.params);
  if (!paramsParsed.success) {
    return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  }

  const body: unknown = await req.json().catch(() => null);
  const parsed = AppendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "参数不合法", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const res = await appendMessage({
    id: parsed.data.id,
    conversationId: paramsParsed.data.id,
    role: parsed.data.role,
    content: parsed.data.content,
    createdAt: parsed.data.createdAt,
    status: parsed.data.status,
    attachments: parsed.data.attachments,
    citations: parsed.data.citations,
  });
  if (!res.success) {
    return NextResponse.json({ error: res.error }, { status: 500 });
  }
  return NextResponse.json({ data: res.data }, { status: 201 });
}

