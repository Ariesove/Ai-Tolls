import { OpenAIEmbeddings } from "@langchain/openai";

export interface StoredDocument {
  pageContent: string;
  metadata: Record<string, any>;
  vector: number[];
}

// Module-level state
let docs: StoredDocument[] = [];
let embeddings: OpenAIEmbeddings | null = null;
// EMBEDDING=text-embedding-ada-002
// AI_KEY=sk-4EVaiOOCO95SvVh78XPgajAnVNB7lKcpM2tuGIRFScudhMvC
// AI_BASE_URL=https://api.302.ai/v1
// MODEL=claude-3-7-sonnet-latest
const getEmbeddings = () => {
  if (!embeddings) {
    const apiKey = localStorage.getItem('OPENAI_API_KEY') || 'sk-4EVaiOOCO95SvVh78XPgajAnVNB7lKcpM2tuGIRFScudhMvC';
    const baseUrl = localStorage.getItem('OPENAI_BASE_URL') || 'https://api.302.ai/v1';

    if (!apiKey) {
      throw new Error("OpenAI API Key is missing. Please set it in Settings.");
    }

    embeddings = new OpenAIEmbeddings({
      openAIApiKey: apiKey,
      configuration: {
        baseURL: baseUrl || undefined,
      }
    });
  }
  console.log('embeddings', embeddings)
  return embeddings;
};

const splitText = (text: string, chunkSize: number = 1000, chunkOverlap: number = 200) => {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    if (end === text.length) break;
    start = end - chunkOverlap;
    if (start < 0) start = 0;
  }
  return chunks;
};

const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Vectorize text and store locally (in-memory)
 */
// 整体的流程就是-> 再输入文档后,先把内容向量化,然后存储到本地,然后把文档进行chunk分割,因为要避免所有的文档,一块处理,超限
export const addText = async (text: string, metadata: Record<string, any> = {}): Promise<void> => {
  const embedder = getEmbeddings();
  const chunks = splitText(text);
  console.log('chunks', chunks)
  // Batch embed documents
  const vectors = await embedder.embedDocuments(chunks);

  console.log('%c [  ]-72', 'font-size:13px; background:pink; color:#bf2c9f;', vectors)
  chunks.forEach((chunk, i) => {
    docs.push({
      pageContent: chunk,
      metadata,
      vector: vectors[i]
    });
  });
  console.log('docs', docs)
  console.log(`[RAG] Added ${chunks.length} vectors to local store.`);
};

/**
 * Search for similar documents
 */
export const search = async (query: string, k: number = 4): Promise<StoredDocument[]> => {
  console.log(`[RAG] Searching for: "${query}"`);
  const embedder = getEmbeddings();

  // 1. Vectorize the query
  console.log("[RAG] Vectorizing query...");
  const queryVector = await embedder.embedQuery(query);
  console.log(`[RAG] Query vectorized. Dimension: ${queryVector.length}`);
  console.log('docs22', docs)
  // 2. Calculate Similarity
  console.log(`[RAG] Calculating similarity against ${docs.length} stored chunks...`);
  const scoredDocs = docs.map(doc => ({
    doc,
    score: cosineSimilarity(queryVector, doc.vector)
  }));

  // 3. Sort by score
  scoredDocs.sort((a, b) => b.score - a.score);

  // 4. Log Top Results
  console.log("[RAG] Top Results:");
  scoredDocs.slice(0, k).forEach((d, i) => {
    console.log(`  ${i + 1}. Score: ${d.score.toFixed(4)} | Content: "${d.doc.pageContent.slice(0, 50)}..."`);
  });
  console.log('scoredDocs', scoredDocs)
  return scoredDocs.slice(0, k).map(d => d.doc);
};

/**
 * Clear all stored vectors
 */
export const clear = () => {
  // docs = [];add 
};
