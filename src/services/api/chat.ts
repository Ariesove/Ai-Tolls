import { z } from "zod";
import { Err, Ok, type Result } from "@/lib/result";

const MessageRoleSchema = z.enum(["user", "assistant", "system"]);
const MessageStatusSchema = z.enum(["sending", "sent", "error"]);

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

const MessageSchema = z.object({
  id: z.string().uuid(),
  role: MessageRoleSchema,
  content: z.string(),
  createdAt: z.number().int().nonnegative(),
  status: MessageStatusSchema.optional(),
  attachments: z.array(AttachmentSchema).optional(),
  citations: z.array(CitationSchema).optional(),
});

const ConversationSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  messages: z.array(MessageSchema),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

type RequestOptions = {
  timeoutMs?: number;
  retries?: number;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const readErrorMessage = (body: unknown): string | undefined => {
  if (!body || typeof body !== "object") return undefined;
  const maybe = body as Record<string, unknown>;
  return typeof maybe.error === "string" ? maybe.error : undefined;
};

const requestJson = async <T>(
  input: string,
  init: RequestInit,
  schema: z.ZodSchema<T>,
  opts: RequestOptions = {},
): Promise<Result<T>> => {
  const timeoutMs = typeof opts.timeoutMs === "number" ? opts.timeoutMs : 15_000;
  const retries = typeof opts.retries === "number" ? opts.retries : 1;

  for (let attempt = 0; attempt <= retries; attempt++) {
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
        const msg = readErrorMessage(raw) || `请求失败（${res.status}）`;
        return Err(msg);
      }

      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        return Err("响应数据不合法");
      }
      return Ok(parsed.data);
    } catch (e) {
      const aborted =
        e instanceof DOMException ? e.name === "AbortError" : false;
      if (aborted) {
        if (attempt < retries) {
          await sleep(200 * Math.pow(2, attempt));
          continue;
        }
        return Err("请求超时");
      }
      if (attempt < retries) {
        await sleep(200 * Math.pow(2, attempt));
        continue;
      }
      return Err(e instanceof Error ? e.message : "网络错误");
    } finally {
      clearTimeout(t);
    }
  }

  return Err("网络错误");
};

const DataEnvelope = <T>(data: z.ZodSchema<T>) => z.object({ data });

export const listConversations = async (): Promise<
  Result<z.infer<typeof ConversationSchema>[]>
> => {
  const schema = DataEnvelope(z.array(ConversationSchema));
  const res = await requestJson("/api/chat/conversations", { method: "GET" }, schema);
  if (!res.success) return res;
  return Ok(res.data.data);
};

export const createConversation = async (input: {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}): Promise<Result<z.infer<typeof ConversationSchema>>> => {
  const schema = DataEnvelope(ConversationSchema);
  const res = await requestJson(
    "/api/chat/conversations",
    { method: "POST", body: JSON.stringify(input) },
    schema,
  );
  if (!res.success) return res;
  return Ok(res.data.data);
};

export const deleteConversation = async (id: string): Promise<Result<true>> => {
  const schema = DataEnvelope(z.literal(true));
  const res = await requestJson(
    `/api/chat/conversations/${id}`,
    { method: "DELETE" },
    schema,
  );
  if (!res.success) return res;
  return Ok(true as const);
};

export const listMessages = async (
  conversationId: string,
): Promise<Result<z.infer<typeof MessageSchema>[]>> => {
  const schema = DataEnvelope(z.array(MessageSchema));
  const res = await requestJson(
    `/api/chat/conversations/${conversationId}/messages`,
    { method: "GET" },
    schema,
  );
  if (!res.success) return res;
  return Ok(res.data.data);
};

export const appendMessage = async (
  conversationId: string,
  input: z.infer<typeof MessageSchema>,
): Promise<Result<z.infer<typeof MessageSchema>>> => {
  const schema = DataEnvelope(MessageSchema);
  const res = await requestJson(
    `/api/chat/conversations/${conversationId}/messages`,
    { method: "POST", body: JSON.stringify(input) },
    schema,
  );
  if (!res.success) return res;
  return Ok(res.data.data);
};

