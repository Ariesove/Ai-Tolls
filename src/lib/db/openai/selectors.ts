import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { openAiEmbeddings } from './schema';

export async function getEmbeddingsByMetadata(metadata: Record<string, any>) {
  // 简单的元数据过滤
  const embeddings = await db.select().from(openAiEmbeddings);
  return embeddings.filter(embedding => {
    return Object.entries(metadata).every(([key, value]) => {
      return embedding.metadata[key] === value;
    });
  });
}

// 批量操作
export async function createMultipleEmbeddings(data: Array<typeof openAiEmbeddings.$inferInsert>) {
  return await db.insert(openAiEmbeddings).values(data).returning();
}