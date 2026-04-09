"use client";

export interface TakeScreenshotArgs {
  url: string;
  fullPage?: boolean;
  format?: "png" | "jpeg" | "webp";
  quality?: number;
}

export interface ScreenshotResult {
  ok: boolean;
  dataUrl?: string;
  error?: string;
}

export async function takeScreenshotLocal(args: TakeScreenshotArgs): Promise<ScreenshotResult> {
  try {
    const puppeteer = await import("puppeteer").catch(() => null as any);
    if (!puppeteer) {
      return {
        ok: false,
        error:
          "puppeteer 未安装。请先安装：pnpm add puppeteer；或改用真实 MCP 传输层对接 take_screenshot",
      };
    }
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.goto(args.url, { waitUntil: "networkidle0", timeout: 60_000 });
    const buf = await page.screenshot({
      type: args.format || "png",
      quality: args.format === "jpeg" || args.format === "webp" ? args.quality ?? 80 : undefined,
      fullPage: !!args.fullPage,
    });
    await browser.close();
    const mime =
      args.format === "jpeg"
        ? "image/jpeg"
        : args.format === "webp"
          ? "image/webp"
          : "image/png";
    const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
    return { ok: true, dataUrl };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

