import { z } from "zod";
import { Err, Ok, type Result } from "@/lib/result";

type RequestOptions = {
  timeoutMs?: number;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const requestJson = async <T>(
  input: string,
  init: RequestInit,
  schema: z.ZodSchema<T>,
  opts: RequestOptions = {},
): Promise<Result<T>> => {
  const timeoutMs = typeof opts.timeoutMs === "number" ? opts.timeoutMs : 30_000;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(input, {
      ...init,
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });
    const raw: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const msg =
        raw && typeof raw === "object" && typeof (raw as any).error === "string"
          ? String((raw as any).error)
          : `请求失败（${res.status}）`;
      return Err(msg);
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return Err("响应数据不合法");
    return Ok(parsed.data);
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === "AbortError";
    if (aborted) return Err("请求超时");
    return Err(e instanceof Error ? e.message : "网络错误");
  } finally {
    clearTimeout(t);
  }
};

const DataEnvelope = <T>(data: z.ZodSchema<T>) => z.object({ data });

const ExportSchema = z.object({
  documents: z.array(
    z.object({
      id: z.string().uuid(),
      filename: z.string(),
      mime: z.string().optional(),
      source: z.string().optional(),
      content: z.string(),
      contentSha1: z.string(),
      createdAt: z.number(),
      updatedAt: z.number(),
    }),
  ),
  chunks: z.array(
    z.object({
      documentId: z.string().uuid(),
      chunkIndex: z.number().int().nonnegative(),
      chunkId: z.string(),
      content: z.string(),
      embedding: z.array(z.number()),
      createdAt: z.number(),
    }),
  ),
});

const IngestResponseSchema = z.object({
  documentId: z.string().uuid(),
  chunks: z.number().int().nonnegative(),
  dim: z.number().int().nonnegative(),
});

export type KbExport = z.infer<typeof ExportSchema>;
export type KbIngestResult = z.infer<typeof IngestResponseSchema>;

export const ingest = async (input: {
  filename: string;
  content: string;
  mime?: string;
  source?: string;
}): Promise<Result<KbIngestResult>> => {
  const schema = DataEnvelope(IngestResponseSchema);
  const res = await requestJson(
    "/api/kb/ingest",
    { method: "POST", body: JSON.stringify(input) },
    schema,
    { timeoutMs: 60_000 },
  );
  if (!res.success) return res;
  return Ok(res.data.data);
};

export const exportAll = async (): Promise<Result<KbExport>> => {
  const schema = DataEnvelope(ExportSchema);
  const res = await requestJson("/api/kb/export", { method: "GET" }, schema, {
    timeoutMs: 60_000,
  });
  if (!res.success) return res;
  return Ok(res.data.data);
};

export const retryExportAll = async (
  tries = 2,
): Promise<Result<KbExport>> => {
  for (let i = 0; i <= tries; i++) {
    const res = await exportAll();
    if (res.success) return res;
    if (i < tries) await sleep(250 * Math.pow(2, i));
  }
  return Err("读取KB失败");
};

