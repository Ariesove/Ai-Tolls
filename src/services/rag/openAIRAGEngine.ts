import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";

interface StoredDocument {
  pageContent: string;
  metadata: Record<string, any>;
  vector: number[];
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

class OpenAIRAGEngine {
  private docs: StoredDocument[] = [];
  private embeddings: OpenAIEmbeddings | null = null;
  private llm: ChatOpenAI | null = null;
  private chunkSize = 1000;
  private chunkOverlap = 200;

  constructor() {
  }

  private init() {
    const apiKey = localStorage.getItem('OPENAI_API_KEY');
    const baseUrl = localStorage.getItem('OPENAI_BASE_URL');

    if (!apiKey) {
      throw new Error("OpenAI API Key not found. Please set it in Settings.");
    }

    if (!this.embeddings || !this.llm) {
      const config = {
        openAIApiKey: apiKey,
        configuration: {
          baseURL: baseUrl || undefined,
        },
      };

      this.embeddings = new OpenAIEmbeddings(config);
      this.llm = new ChatOpenAI({
        ...config,
        modelName: "gpt-3.5-turbo",
        temperature: 0.7,
      });
    }
  }

  private splitText(text: string, source: string) {
    const chunks: { pageContent: string; metadata: Record<string, any> }[] = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + this.chunkSize, text.length);
      const content = text.slice(start, end);
      chunks.push({ pageContent: content, metadata: { source } });
      if (end === text.length) break;
      start = end - this.chunkOverlap;
      if (start < 0) start = 0;
    }
    return chunks;
  }

  async ingest(text: string, source: string = "user-input"): Promise<void> {
    this.init();
    if (!this.embeddings) throw new Error("Embeddings not initialized");

    const rawDocs = this.splitText(text, source);
    const contents = rawDocs.map(d => d.pageContent);

    const vectors = await this.embeddings.embedDocuments(contents);

    rawDocs.forEach((doc, i) => {
      this.docs.push({
        pageContent: doc.pageContent,
        metadata: doc.metadata,
        vector: vectors[i]
      });
    });

    console.log(`[OpenAI RAG] Ingested ${rawDocs.length} chunks.`);
  }

  async retrieve(query: string, k: number = 4): Promise<StoredDocument[]> {
    this.init();
    if (!this.embeddings) throw new Error("Embeddings not initialized");

    const queryVector = await this.embeddings.embedQuery(query);

    const scoredDocs = this.docs.map(doc => ({
      doc,
      score: cosineSimilarity(queryVector, doc.vector)
    }));

    scoredDocs.sort((a, b) => b.score - a.score);

    return scoredDocs.slice(0, k).map(d => d.doc);
  }

  async generateResponseStream(query: string, onChunk: (chunk: string) => void): Promise<void> {
    this.init();

    if (this.docs.length === 0) {
      throw new Error("Knowledge Base is empty. Please add some text first.");
    }

    const retrievedDocs = await this.retrieve(query);

    const template = `Answer the question based only on the following context:
{context}

Question: {question}`;

    const prompt = ChatPromptTemplate.fromTemplate(template);

    const chain = RunnableSequence.from([
      {
        context: () => retrievedDocs.map(doc => doc.pageContent).join("\n\n"),
        question: () => query,
      },
      prompt,
      this.llm!,
      new StringOutputParser(),
    ]);

    const stream = await chain.stream({});

    for await (const chunk of stream) {
      onChunk(chunk);
    }
  }
}

export const openAIRAGEngine = new OpenAIRAGEngine();
