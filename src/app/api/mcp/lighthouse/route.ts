import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const url =
      searchParams.get("url") ||
      (process.env.NEXT_PUBLIC_APP_ORIGIN
        ? `${process.env.NEXT_PUBLIC_APP_ORIGIN}/code-review`
        : "http://localhost:3000/code-review");

    // 通过子进程调用独立的 Node 脚本，避免 Next 打包 lighthouse 产生的解析错误
    const scriptPath = join(
      process.cwd(),
      "scripts",
      "lighthouse-runner.mjs",
    );
    const child = spawn(process.execPath, [scriptPath, "--url", url], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));

    const code: number = await new Promise((resolve) => {
      child.on("close", (c) => resolve(c ?? 1));
      child.on("error", () => resolve(1));
    });

    if (code !== 0) {
      return NextResponse.json(
        { ok: false, error: err || "lighthouse runner failed" },
        { status: 500 },
      );
    }
    try {
      const data = JSON.parse(out);
      return NextResponse.json(data);
    } catch {
      return NextResponse.json(
        { ok: false, error: "invalid runner output" },
        { status: 500 },
      );
    }
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message || "failed" },
      { status: 500 },
    );
  }
}
