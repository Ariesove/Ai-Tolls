import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { vercelAiEmbeddings, type NewVercelAiEmbedding } from './schema';

export async function createEmbedding(data: NewVercelAiEmbedding) {
  return await db.insert(vercelAiEmbeddings).values(data).returning();
}

export async function getEmbeddingById(id: string) {
  return await db.select().from(vercelAiEmbeddings).where(eq(vercelAiEmbeddings.id, id)).limit(1).then(res => res[0]);
}

export async function getAllEmbeddings() {
  return await db.select().from(vercelAiEmbeddings);
}

export async function deleteEmbedding(id: string) {
  return await db.delete(vercelAiEmbeddings).where(eq(vercelAiEmbeddings.id, id)).returning();
}

// 简单的余弦相似度搜索
export async function searchSimilarEmbeddings(queryEmbedding: number[], limit = 5) {
  const embeddings = await db.select().from(vercelAiEmbeddings);
  
  const similarities = embeddings.map(embedding => {
    const similarity = cosineSimilarity(queryEmbedding, embedding.embedding);
    return {
      ...embedding,
      similarity,
    };
  });
  
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}