import { pgTable, varchar, text, jsonb } from 'drizzle-orm/pg-core';

export const openAiEmbeddings = pgTable('open_ai_embeddings', {
  id: varchar('id', { length: 191 }).primaryKey(),
  content: text('content').notNull(),
  embedding: jsonb('embedding').notNull(),
  metadata: jsonb('metadata').default({}),
  createdAt: jsonb('created_at').$defaultFn(() => new Date().toISOString()),
});

export type OpenAiEmbedding = typeof openAiEmbeddings.$inferSelect;
export type NewOpenAiEmbedding = typeof openAiEmbeddings.$inferInsert;