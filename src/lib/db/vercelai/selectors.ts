import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { vercelAiEmbeddings } from './schema';

export async function getEmbeddingsByMetadata(metadata: Record<string, any>) {
  // 简单的元数据过滤
  const embeddings = await db.select().from(vercelAiEmbeddings);
  return embeddings.filter(embedding => {
    return Object.entries(metadata).every(([key, value]) => {
      return embedding.metadata[key] === value;
    });
  });
}

// 批量操作
export async function createMultipleEmbeddings(data: Array<typeof vercelAiEmbeddings.$inferInsert>) {
  return await db.insert(vercelAiEmbeddings).values(data).returning();
}