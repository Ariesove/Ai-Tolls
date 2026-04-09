import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const url =
      searchParams.get("url") ||
      (process.env.NEXT_PUBLIC_APP_ORIGIN
        ? `${process.env.NEXT_PUBLIC_APP_ORIGIN}/code-review`
        : "http://localhost:3000/code-review");
    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
    const buf = await page.screenshot({ type: "png", fullPage: false });
    await browser.close();
    const dataUrl = `data:image/png;base64,${buf.toString("base64")}`;
    return NextResponse.json({ ok: true, dataUrl });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message || "failed" },
      { status: 500 },
    );
  }
}

