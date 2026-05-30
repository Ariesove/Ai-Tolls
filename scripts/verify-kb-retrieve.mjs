import { readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";

const loadDotEnvLocal = () => {
  const p = new URL("../.env.local", import.meta.url);
  if (!existsSync(p)) return;
  const content = readFileSync(p, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const k = trimmed.slice(0, idx).trim();
    const v = trimmed.slice(idx + 1).trim();
    if (!k) continue;
    if (process.env[k] == null) process.env[k] = v;
  }
};

const postJson = async (url, body) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
};

const main = async () => {
  loadDotEnvLocal();

  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  const token = `kb-smoke-${randomUUID()}`;

  const r0 = await postJson(`${baseUrl}/api/kb/retrieve`, { query: token, k: 4 });
  if (r0.status !== 200) {
    throw new Error(`retrieve failed: ${r0.status}`);
  }

  const content = `RAG Smoke Test\n\nUnique Token: ${token}\n\nThis is a verification document.`;
  const ingest = await postJson(`${baseUrl}/api/kb/ingest`, {
    filename: "kb-smoke.txt",
    content,
    source: "verify-kb-retrieve",
    mime: "text/plain",
  });
  if (ingest.status !== 201) {
    const msg =
      ingest && typeof ingest.json === "object" && ingest.json
        ? JSON.stringify(ingest.json)
        : "unknown";
    throw new Error(`ingest failed: ${ingest.status} ${msg}`);
  }

  const r1 = await postJson(`${baseUrl}/api/kb/retrieve`, { query: token, k: 4 });
  if (r1.status !== 200) {
    throw new Error(`retrieve after ingest failed: ${r1.status}`);
  }

  const data =
    r1.json && typeof r1.json === "object"
      ? r1.json.data
      : null;
  const ctxText =
    data && typeof data === "object" ? data.ctxText : "";
  const hits =
    data && typeof data === "object" && typeof data.hits === "number"
      ? data.hits
      : 0;

  const ok = typeof ctxText === "string" && ctxText.includes(token) && hits > 0;

  process.stdout.write(
    JSON.stringify(
      {
        ok,
        baseUrl,
        token,
        hits,
        hasTokenInCtxText: typeof ctxText === "string" && ctxText.includes(token),
      },
      null,
      2,
    ) + "\n",
  );

  if (!ok) process.exitCode = 1;
};

main().catch((e) => {
  const msg =
    e instanceof Error
      ? e.message || e.name
      : typeof e === "string"
        ? e
        : "unknown error";
  process.stderr.write(JSON.stringify({ ok: false, error: msg }, null, 2) + "\n");
  process.exitCode = 1;
});
