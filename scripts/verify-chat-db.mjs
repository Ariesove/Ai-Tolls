import { readFileSync, existsSync } from "node:fs";
import { Client } from "pg";
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

const ensureDatabase = async (databaseUrl) => {
  const u = new URL(databaseUrl);
  const dbName = (u.pathname || "").replace(/^\//, "") || "ai_tools";
  const adminUrl = new URL(u.toString());
  adminUrl.pathname = "/postgres";

  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const exists = await admin.query(
      "SELECT 1 AS ok FROM pg_database WHERE datname = $1",
      [dbName],
    );
    if (exists.rows.length === 0) {
      await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
    }
  } finally {
    await admin.end();
  }

  return dbName;
};

const ensureSchema = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id uuid PRIMARY KEY,
      title text NOT NULL,
      created_at bigint NOT NULL,
      updated_at bigint NOT NULL
    );
  `);
  await client.query(`
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
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at
    ON messages(conversation_id, created_at);
  `);
};

const main = async () => {
  loadDotEnvLocal();
  const databaseUrl = process.env.DATABASE_URL;
  if (typeof databaseUrl !== "string" || !databaseUrl.trim()) {
    throw new Error("DATABASE_URL 未配置（请在 .env.local 设置）");
  }

  const dbName = await ensureDatabase(databaseUrl);

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await ensureSchema(client);

    const conversationId = randomUUID();
    const now = Date.now();
    await client.query(
      `INSERT INTO conversations(id, title, created_at, updated_at)
       VALUES ($1, $2, $3, $4)`,
      [conversationId, "DB Smoke Test", now, now],
    );

    const m1 = randomUUID();
    const m2 = randomUUID();
    await client.query(
      `INSERT INTO messages(id, conversation_id, role, content, created_at, status)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [m1, conversationId, "user", "hello db", now, "sent"],
    );
    await client.query(
      `INSERT INTO messages(id, conversation_id, role, content, created_at, status)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [m2, conversationId, "assistant", "db ok", now + 1, "sent"],
    );

    const convCount = await client.query(
      "SELECT COUNT(*)::int AS n FROM conversations",
    );
    const msgCount = await client.query(
      "SELECT COUNT(*)::int AS n FROM messages",
    );

    process.stdout.write(
      JSON.stringify(
        {
          ok: true,
          database: dbName,
          insertedConversationId: conversationId,
          counts: { conversations: convCount.rows[0]?.n, messages: msgCount.rows[0]?.n },
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    await client.end();
  }
};

main().catch((e) => {
  const msg =
    e instanceof Error
      ? e.message || e.name
      : typeof e === "string"
        ? e
        : "unknown error";
  const extra =
    e && typeof e === "object"
      ? Object.fromEntries(
          Object.entries(e).filter(([_, v]) => typeof v !== "function"),
        )
      : undefined;
  process.stderr.write(
    JSON.stringify(
      { ok: false, error: msg, extra },
      null,
      2,
    ) + "\n",
  );
  process.exitCode = 1;
});
