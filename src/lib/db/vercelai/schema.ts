import { pgTable, varchar, text, jsonb } from 'drizzle-orm/pg-core';

export const vercelAiEmbeddings = pgTable('vercel_ai_embeddings', {
  id: varchar('id', { length: 191 }).primaryKey(),
  content: text('content').notNull(),
  embedding: jsonb('embedding').notNull(),
  metadata: jsonb('metadata').default({}),
  createdAt: jsonb('created_at').$defaultFn(() => new Date().toISOString()),
});

export type VercelAiEmbedding = typeof vercelAiEmbeddings.$inferSelect;
export type NewVercelAiEmbedding = typeof vercelAiEmbeddings.$inferInsert;