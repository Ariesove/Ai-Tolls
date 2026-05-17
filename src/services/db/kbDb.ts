import { Pool } from "pg";
import crypto from "node:crypto";
import { Err, Ok, type Result } from "@/lib/result";

type Db = {
  pool: Pool;
  ensureSchema: () => Promise<Result<true>>;
};

export type KbDocumentRow = {
  id: string;
  filename: string;
  mime?: string;
  source?: string;
  content: string;
  contentSha1: string;
  createdAt: number;
  updatedAt: number;
};

export type KbChunkRow = {
  documentId: string;
  chunkIndex: number;
  chunkId: string;
  content: string;
  embedding: number[];
  createdAt: number;
};

const getDatabaseUrl = (): Result<string> => {
  const url = process.env.DATABASE_URL;
  if (typeof url !== "string" || !url.trim()) {
    return Err("DATABASE_URL 未配置");
  }
  return Ok(url);
};

const sha1 = (s: string): string =>
  crypto.createHash("sha1").update(s, "utf8").digest("hex");

const getDb = (): Result<Db> => {
  const urlRes = getDatabaseUrl();
  if (!urlRes.success) return urlRes;

  const g = globalThis as unknown as {
    __kbDb?: { db: Db; schemaReady?: Promise<Result<true>> };
  };

  if (!g.__kbDb) {
    const pool = new Pool({ connectionString: urlRes.data });
    const ensureSchema = async (): Promise<Result<true>> => {
      const holder = g.__kbDb;
      if (holder?.schemaReady) return holder.schemaReady;
      const schemaReady = (async () => {
        try {
          await pool.query(`
            CREATE TABLE IF NOT EXISTS kb_documents (
              id uuid PRIMARY KEY,
              filename text NOT NULL,
              mime text,
              source text,
              content text NOT NULL,
              content_sha1 text NOT NULL UNIQUE,
              created_at bigint NOT NULL,
              updated_at bigint NOT NULL
            );
          `);
          await pool.query(`
            CREATE TABLE IF NOT EXISTS kb_chunks (
              document_id uuid NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
              chunk_index int NOT NULL,
              chunk_id text NOT NULL,
              content text NOT NULL,
              embedding real[] NOT NULL,
              created_at bigint NOT NULL,
              PRIMARY KEY (document_id, chunk_index)
            );
          `);
          await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_kb_chunks_document
            ON kb_chunks(document_id);
          `);
          return Ok(true as const);
        } catch (e) {
          return Err(`初始化KB表结构失败：${(e as Error).message}`);
        }
      })();
      if (holder) holder.schemaReady = schemaReady;
      const res = await schemaReady;
      if (holder && !res.success) {
        delete holder.schemaReady;
      }
      return res;
    };
    g.__kbDb = { db: { pool, ensureSchema } };
  }

  return Ok(g.__kbDb.db);
};

export const upsertDocument = async (input: {
  id: string;
  filename: string;
  mime?: string;
  source?: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}): Promise<Result<KbDocumentRow>> => {
  const dbRes = getDb();
  if (!dbRes.success) return dbRes;
  const ready = await dbRes.data.ensureSchema();
  if (!ready.success) return ready;

  const contentSha1 = sha1(input.content);
  try {
    const { rows } = await dbRes.data.pool.query<
      Record<string, unknown>
    >(
      `INSERT INTO kb_documents(id, filename, mime, source, content, content_sha1, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (content_sha1)
       DO UPDATE SET filename=EXCLUDED.filename, mime=EXCLUDED.mime, source=EXCLUDED.source, content=EXCLUDED.content, updated_at=EXCLUDED.updated_at
       RETURNING id, filename, mime, source, content, content_sha1, created_at, updated_at`,
      [
        input.id,
        input.filename,
        input.mime ?? null,
        input.source ?? null,
        input.content,
        contentSha1,
        input.createdAt,
        input.updatedAt,
      ],
    );
    const row = rows[0] || {};
    return Ok({
      id: String(row.id),
      filename: typeof row.filename === "string" ? row.filename : input.filename,
      mime: typeof row.mime === "string" ? row.mime : undefined,
      source: typeof row.source === "string" ? row.source : undefined,
      content: typeof row.content === "string" ? row.content : input.content,
      contentSha1: typeof row.content_sha1 === "string" ? row.content_sha1 : contentSha1,
      createdAt: Number(row.created_at) || input.createdAt,
      updatedAt: Number(row.updated_at) || input.updatedAt,
    });
  } catch (e) {
    return Err(`写入KB文档失败：${(e as Error).message}`);
  }
};

export const upsertChunks = async (input: {
  documentId: string;
  chunks: Array<{
    chunkIndex: number;
    chunkId: string;
    content: string;
    embedding: number[];
    createdAt: number;
  }>;
}): Promise<Result<true>> => {
  const dbRes = getDb();
  if (!dbRes.success) return dbRes;
  const ready = await dbRes.data.ensureSchema();
  if (!ready.success) return ready;

  const client = await dbRes.data.pool.connect();
  try {
    await client.query("BEGIN");
    for (const c of input.chunks) {
      await client.query(
        `INSERT INTO kb_chunks(document_id, chunk_index, chunk_id, content, embedding, created_at)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (document_id, chunk_index)
         DO UPDATE SET chunk_id=EXCLUDED.chunk_id, content=EXCLUDED.content, embedding=EXCLUDED.embedding`,
        [
          input.documentId,
          c.chunkIndex,
          c.chunkId,
          c.content,
          c.embedding,
          c.createdAt,
        ],
      );
    }
    await client.query("COMMIT");
    return Ok(true as const);
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    return Err(`写入KB切片失败：${(e as Error).message}`);
  } finally {
    client.release();
  }
};

export const exportKb = async (): Promise<
  Result<{ documents: KbDocumentRow[]; chunks: KbChunkRow[] }>
> => {
  const dbRes = getDb();
  if (!dbRes.success) return dbRes;
  const ready = await dbRes.data.ensureSchema();
  if (!ready.success) return ready;

  try {
    const docsRes = await dbRes.data.pool.query<Record<string, unknown>>(
      `SELECT id, filename, mime, source, content, content_sha1, created_at, updated_at
       FROM kb_documents
       ORDER BY updated_at DESC`,
    );
    const documents: KbDocumentRow[] = docsRes.rows.map((r) => ({
      id: String(r.id),
      filename: typeof r.filename === "string" ? r.filename : "unknown",
      mime: typeof r.mime === "string" ? r.mime : undefined,
      source: typeof r.source === "string" ? r.source : undefined,
      content: typeof r.content === "string" ? r.content : "",
      contentSha1: typeof r.content_sha1 === "string" ? r.content_sha1 : "",
      createdAt: Number(r.created_at) || Date.now(),
      updatedAt: Number(r.updated_at) || Date.now(),
    }));

    const chunksRes = await dbRes.data.pool.query<Record<string, unknown>>(
      `SELECT document_id, chunk_index, chunk_id, content, embedding, created_at
       FROM kb_chunks
       ORDER BY document_id, chunk_index ASC`,
    );
    const chunks: KbChunkRow[] = chunksRes.rows.map((r) => ({
      documentId: String(r.document_id),
      chunkIndex: Number(r.chunk_index) || 0,
      chunkId: typeof r.chunk_id === "string" ? r.chunk_id : "",
      content: typeof r.content === "string" ? r.content : "",
      embedding: Array.isArray(r.embedding) ? (r.embedding as number[]) : [],
      createdAt: Number(r.created_at) || Date.now(),
    }));

    return Ok({ documents, chunks });
  } catch (e) {
    return Err(`读取KB失败：${(e as Error).message}`);
  }
};

