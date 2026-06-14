import { Pool } from "pg";
import { Err, Ok, type Result } from "@/lib/result";
import type { Conversation, Message, MessageRole, MessageStatus } from "@/types/chat";

type Db = {
  pool: Pool;
  ensureSchema: () => Promise<Result<true>>;
};

const getDatabaseUrl = (): Result<string> => {
  const url = process.env.DATABASE_URL;
  if (typeof url !== "string" || !url.trim()) {
    return Err("DATABASE_URL 未配置");
  }
  return Ok(url);
};

const getDb = (): Result<Db> => {
  const urlRes = getDatabaseUrl();
  if (!urlRes.success) return urlRes;

  const g = globalThis as unknown as {
    __chatDb?: { db: Db; schemaReady?: Promise<Result<true>> };
  };

  if (!g.__chatDb) {
    const pool = new Pool({ connectionString: urlRes.data });
    const ensureSchema = async (): Promise<Result<true>> => {
      const holder = g.__chatDb;
      if (holder?.schemaReady) return holder.schemaReady;
      const schemaReady = (async () => {
        try {
          await pool.query(`
            CREATE TABLE IF NOT EXISTS conversations (
              id uuid PRIMARY KEY,
              title text NOT NULL,
              created_at bigint NOT NULL,
              updated_at bigint NOT NULL
            );
          `);
          await pool.query(`
            CREATE TABLE IF NOT EXISTS messages (
              id uuid PRIMARY KEY,
              conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
              role text NOT NULL,
              content text NOT NULL,
              created_at bigint NOT NULL,
              status text,
              attachments jsonb,
              citations jsonb
            );
          `);
          await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at
            ON messages(conversation_id, created_at);
          `);
          return Ok(true as const);
        } catch (e) {
          return Err(`初始化表结构失败：${(e as Error).message}`);
        }
      })();
      if (holder) holder.schemaReady = schemaReady;
      const res = await schemaReady;
      if (holder && !res.success) {
        delete holder.schemaReady;
      }
      return res;
    };
    g.__chatDb = { db: { pool, ensureSchema } };
  }

  return Ok(g.__chatDb.db);
};

const asMessageRole = (v: unknown): MessageRole | undefined =>
  v === "user" || v === "assistant" || v === "system" ? v : undefined;

const asMessageStatus = (v: unknown): MessageStatus | undefined =>
  v === "sending" || v === "sent" || v === "error" ? v : undefined;

const mapConversationRow = (row: Record<string, unknown>): Conversation => {
  const id = String(row.id);
  const title = typeof row.title === "string" ? row.title : "New Chat";
  const createdAt = Number(row.created_at) || Date.now();
  const updatedAt = Number(row.updated_at) || createdAt;
  return { id, title, createdAt, updatedAt, messages: [] };
};

const mapMessageRow = (row: Record<string, unknown>): Message => {
  const id = String(row.id);
  const role = asMessageRole(row.role) ?? "assistant";
  const content = typeof row.content === "string" ? row.content : "";
  const createdAt = Number(row.created_at) || Date.now();
  const status = asMessageStatus(row.status);
  const attachments = Array.isArray(row.attachments)
    ? (row.attachments as Message["attachments"])
    : undefined;
  const citations = Array.isArray(row.citations)
    ? (row.citations as Message["citations"])
    : undefined;
  return { id, role, content, createdAt, status, attachments, citations };
};

export const listConversations = async (): Promise<Result<Conversation[]>> => {
  const dbRes = getDb();
  if (!dbRes.success) return dbRes;
  const ready = await dbRes.data.ensureSchema();
  if (!ready.success) return ready;
  try {
    const { rows } = await dbRes.data.pool.query<Record<string, unknown>>(
      `SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC`,
    );
    const data = rows.map((r) => mapConversationRow(r));
    return Ok(data);
  } catch (e) {
    return Err(`读取会话列表失败：${(e as Error).message}`);
  }
};

export const createConversation = async (input: {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}): Promise<Result<Conversation>> => {
  const dbRes = getDb();
  if (!dbRes.success) return dbRes;
  const ready = await dbRes.data.ensureSchema();
  if (!ready.success) return ready;
  try {
    await dbRes.data.pool.query(
      `INSERT INTO conversations(id, title, created_at, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, updated_at=EXCLUDED.updated_at`,
      [input.id, input.title, input.createdAt, input.updatedAt],
    );
    return Ok({
      id: input.id,
      title: input.title,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      messages: [],
    });
  } catch (e) {
    return Err(`创建会话失败：${(e as Error).message}`);
  }
};

export const deleteConversation = async (id: string): Promise<Result<true>> => {
  const dbRes = getDb();
  if (!dbRes.success) return dbRes;
  const ready = await dbRes.data.ensureSchema();
  if (!ready.success) return ready;
  try {
    await dbRes.data.pool.query(`DELETE FROM conversations WHERE id=$1`, [id]);
    return Ok(true as const);
  } catch (e) {
    return Err(`删除会话失败：${(e as Error).message}`);
  }
};

export const listMessages = async (
  conversationId: string,
): Promise<Result<Message[]>> => {
  const dbRes = getDb();
  if (!dbRes.success) return dbRes;
  const ready = await dbRes.data.ensureSchema();
  if (!ready.success) return ready;
  try {
    const { rows } = await dbRes.data.pool.query<Record<string, unknown>>(
      `SELECT id, role, content, created_at, status, attachments, citations
       FROM messages
       WHERE conversation_id=$1
       ORDER BY created_at ASC`,
      [conversationId],
    );
    return Ok(rows.map((r) => mapMessageRow(r)));
  } catch (e) {
    return Err(`读取消息失败：${(e as Error).message}`);
  }
};

export const appendMessage = async (input: {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  status?: string;
  attachments?: Message["attachments"];
  citations?: Message["citations"];
}): Promise<Result<Message>> => {
  const dbRes = getDb();
  if (!dbRes.success) return dbRes;
  const ready = await dbRes.data.ensureSchema();
  if (!ready.success) return ready;
  try {
    const attachmentsJson =
      input.attachments != null ? JSON.stringify(input.attachments) : null;
    const citationsJson = input.citations != null ? JSON.stringify(input.citations) : null;
    await dbRes.data.pool.query(
      `INSERT INTO messages(id, conversation_id, role, content, created_at, status, attachments, citations)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)
       ON CONFLICT (id) DO UPDATE SET content=EXCLUDED.content, status=EXCLUDED.status, attachments=EXCLUDED.attachments, citations=EXCLUDED.citations`,
      [
        input.id,
        input.conversationId,
        input.role,
        input.content,
        input.createdAt,
        input.status ?? null,
        attachmentsJson,
        citationsJson,
      ],
    );
    await dbRes.data.pool.query(
      `UPDATE conversations SET updated_at=$2 WHERE id=$1`,
      [input.conversationId, Date.now()],
    );
    return Ok({
      id: input.id,
      role: input.role,
      content: input.content,
      createdAt: input.createdAt,
      status: input.status as Message["status"],
      attachments: input.attachments,
      citations: input.citations,
    });
  } catch (e) {
    return Err(`写入消息失败：${(e as Error).message}`);
  }
};
