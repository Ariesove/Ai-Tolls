// A fully self-contained Mock RAG Engine to avoid package import issues
// This demonstrates the logic of RAG without heavy dependencies

export interface Document {
  pageContent: string;
  metadata: Record<string, any>;
  vector?: number[]; // Added to store the embedding vector
}

// Helper: Calculate Cosine Similarity between two vectors
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 1. Simple Text Splitter
class SimpleTextSplitter {
  constructor(private chunkSize: number = 500, private chunkOverlap: number = 50) { }

  splitText(text: string): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + this.chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start += this.chunkSize - this.chunkOverlap;
    }
    return chunks;
  }

  createDocuments(texts: string[], metadatas: Record<string, any>[] = []): Document[] {
    const documents: Document[] = [];
    texts.forEach((text, i) => {
      const chunks = this.splitText(text);
      chunks.forEach(chunk => {
        documents.push({
          pageContent: chunk,
          metadata: metadatas[i] || {},
        });
      });
    });
    return documents;
  }
}

// 2. Deterministic Fake Embeddings
// Generates the same vector for the same text, allowing "exact match" simulation via vectors.
class DeterministicFakeEmbeddings {
  private dimensions = 1536;

  // A simple hash function to generate a pseudo-random but deterministic vector from text
  private hashTextToVector(text: string): number[] {
    const vector = new Array(this.dimensions).fill(0);
    const normalizedText = text.toLowerCase();

    // Simple "Bag of Character-Codes" hashing distributed across dimensions
    for (let i = 0; i < normalizedText.length; i++) {
      const charCode = normalizedText.charCodeAt(i);
      const index = (charCode * 7 + i * 13) % this.dimensions;
      vector[index] += 1; // Increment dimension value
    }

    // Normalize vector to unit length (important for cosine similarity)
    let norm = 0;
    for (let i = 0; i < this.dimensions; i++) {
      norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);

    if (norm > 0) {
      for (let i = 0; i < this.dimensions; i++) {
        vector[i] /= norm;
      }
    }

    return vector;
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    return Promise.resolve(documents.map(doc => this.hashTextToVector(doc)));
  }

  async embedQuery(text: string): Promise<number[]> {
    return Promise.resolve(this.hashTextToVector(text));
  }
}

// 3. Simple Vector Store (In-Memory Array with Vector Search)
class SimpleMemoryVectorStore {
  private docs: Document[] = [];

  async addDocuments(documents: Document[], vectors: number[][]): Promise<void> {
    documents.forEach((doc, i) => {
      this.docs.push({
        ...doc,
        vector: vectors[i]
      });
    });
  }

  // Real Vector Similarity Search (using Cosine Similarity)
  async similaritySearchVectorWithScore(queryVector: number[], k: number = 2): Promise<[Document, number][]> {
    if (this.docs.length === 0) return [];

    // Calculate score for every doc
    const scoredDocs = this.docs.map(doc => {
      if (!doc.vector) return { doc, score: 0 };
      const score = cosineSimilarity(queryVector, doc.vector);
      return { doc, score };
    });

    // Sort by score desc
    scoredDocs.sort((a, b) => b.score - a.score);
    console.log('scoredDocs', scoredDocs)
    console.log("[RAG] Vector Search Top Scores:", scoredDocs.slice(0, 3).map(d => ({ text: d.doc.pageContent.slice(0, 20), score: d.score.toFixed(4) })));
    console.log('scoredDocs', scoredDocs)
    // Return top k
    return scoredDocs
      .slice(0, k)
      .map(item => [item.doc, item.score]);
  }
}

// 4. The RAG Engine Class
class MockRAGEngine {
  private vectorStore: SimpleMemoryVectorStore;
  private splitter: SimpleTextSplitter;
  private embeddings: DeterministicFakeEmbeddings;

  constructor() {
    this.vectorStore = new SimpleMemoryVectorStore();
    this.splitter = new SimpleTextSplitter(500, 50);
    this.embeddings = new DeterministicFakeEmbeddings();
  }

  // Ingest Text (The "Knowledge Base")
  async ingest(text: string, source: string = "user-input"): Promise<void> {
    // 1. Split text into chunks
    const docs = this.splitter.createDocuments([text], [{ source }]);

    // 2. Generate embeddings for chunks
    const vectors = await this.embeddings.embedDocuments(docs.map(d => d.pageContent));

    // 3. Store chunks + vectors
    await this.vectorStore.addDocuments(docs, vectors);

    console.log(`[RAG] Ingested ${docs.length} chunks from source: ${source}`);
  }

  // Retrieve (The "Search")
  async retrieve(query: string, k: number = 2): Promise<Document[]> {
    // 1. Embed the query
    const queryVector = await this.embeddings.embedQuery(query);

    // 2. Vector Search
    const resultsWithScore = await this.vectorStore.similaritySearchVectorWithScore(queryVector, k);

    // 3. Filter by threshold (optional, e.g., score > 0.5)
    // For this deterministic mock, exact word overlap gives high score.
    return resultsWithScore
      .filter(([_, score]) => score > 0.1) // Basic threshold to filter noise
      .map(([doc, _]) => doc);
  }

  // Generate Answer (Mock LLM Generation with Context)
  generateMockResponse(query: string, context: Document[]): string {
    if (context.length === 0) {
      return "I don't have enough information in my knowledge base to answer that.";
    }

    const contextText = context.map(doc => `• ${doc.pageContent}`).join("\n");

    return `Based on the knowledge base (Vector Search Match), here is what I found:\n\n${contextText}\n\n(This response demonstrates successful RAG: The user query was converted to a vector, compared against stored document vectors using Cosine Similarity, and the best matches were retrieved.)`;
  }
}

export const ragEngine = new MockRAGEngine();
