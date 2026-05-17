import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteConversation } from "@/services/db/chatDb";

export const runtime = "nodejs";

const ParamsSchema = z.object({ id: z.string().uuid() });

export async function DELETE(
  _req: Request,
  ctx: { params: { id: string } },
) {
  const parsed = ParamsSchema.safeParse(ctx.params);
  if (!parsed.success) {
    return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  }

  const res = await deleteConversation(parsed.data.id);
  if (!res.success) {
    return NextResponse.json({ error: res.error }, { status: 500 });
  }
  return NextResponse.json({ data: true });
}

