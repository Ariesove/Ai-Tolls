import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { openAiEmbeddings, type NewOpenAiEmbedding } from './schema';

export async function createEmbedding(data: NewOpenAiEmbedding) {
  return await db.insert(openAiEmbeddings).values(data).returning();
}

export async function getEmbeddingById(id: string) {
  return await db.select().from(openAiEmbeddings).where(eq(openAiEmbeddings.id, id)).limit(1).then(res => res[0]);
}

export async function getAllEmbeddings() {
  return await db.select().from(openAiEmbeddings);
}

export async function deleteEmbedding(id: string) {
  return await db.delete(openAiEmbeddings).where(eq(openAiEmbeddings.id, id)).returning();
}

// 简单的余弦相似度搜索
export async function searchSimilarEmbeddings(queryEmbedding: number[], limit = 5) {
  const embeddings = await db.select().from(openAiEmbeddings);
  
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