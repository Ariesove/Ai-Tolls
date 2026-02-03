import { ChatOpenAI } from "@langchain/openai";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { search, addText, StoredDocument } from "./RAG";

class OpenAIRAGEngine {
  private llm: ChatOpenAI | null = null;

  constructor() {
  }

  private init() {
    const apiKey = localStorage.getItem('OPENAI_API_KEY');
    const baseUrl = localStorage.getItem('OPENAI_BASE_URL');

    if (!apiKey) {
      throw new Error("OpenAI API Key not found. Please set it in Settings.");
    }

    if (!this.llm) {
      const config = {
        openAIApiKey: apiKey,
        configuration: {
          baseURL: baseUrl || undefined,
        },
      };

      this.llm = new ChatOpenAI({
        ...config,
        modelName: "gpt-3.5-turbo",
        temperature: 0.7,
      });
    }
  }

  async ingest(text: string, source: string = "user-input"): Promise<void> {
    await addText(text, { source });
  }

  async retrieve(query: string, k: number = 4): Promise<StoredDocument[]> {
    return await search(query, k);
  }

  async generateResponseStream(query: string, onChunk: (chunk: string) => void): Promise<void> {
    this.init();

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
