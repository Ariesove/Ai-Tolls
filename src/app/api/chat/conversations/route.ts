import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createConversation,
  listConversations,
} from "@/services/db/chatDb";

export const runtime = "nodejs";

const CreateConversationSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(120),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export async function GET() {
  const res = await listConversations();
  if (!res.success) {
    return NextResponse.json({ error: res.error }, { status: 500 });
  }
  return NextResponse.json({ data: res.data });
}

export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  const parsed = CreateConversationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "参数不合法", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const res = await createConversation(parsed.data);
  if (!res.success) {
    return NextResponse.json({ error: res.error }, { status: 500 });
  }
  return NextResponse.json({ data: res.data }, { status: 201 });
}

