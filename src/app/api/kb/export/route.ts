import { NextResponse } from "next/server";
import { exportKb } from "@/services/db/kbDb";

export const runtime = "nodejs";

export async function GET() {
  const res = await exportKb();
  if (!res.success) {
    return NextResponse.json({ error: res.error }, { status: 500 });
  }
  return NextResponse.json({ data: res.data });
}

