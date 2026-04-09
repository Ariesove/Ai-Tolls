import {
  tools, searchKnowledgeBase,
  calculate,
  getCurrentTime,
  lcTools
} from './../functionCalling/tools';
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
export interface StoredDocument {
  pageContent: string;
  metadata: Record<string, any>;
  vector: number[];
}

// Module-level state
let docs: StoredDocument[] = [];
let embeddings: OpenAIEmbeddings | null = null;
// EMBEDDING=text-embedding-ada-002
// AI_KEY=sk-...
// AI_BASE_URL=https://api.302.ai/v1
// MODEL=claude-3-7-sonnet-latest
const getEmbeddings = () => {
  if (!embeddings) {
    const apiKey =
      localStorage.getItem('OPENAI_API_KEY');
    const baseUrl = localStorage.getItem('OPENAI_BASE_URL') || 'https://api.302.ai/v1';

    if (!apiKey) {
      throw new Error("OpenAI API Key is missing. Please set it in Settings.");
    }

    embeddings = new OpenAIEmbeddings({
      apiKey: apiKey,
      modelName: "text-embedding-ada-002",
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
  console.log('embedder', embedder)
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


let llm: ChatOpenAI | null = null;
const init = () => {
  const apiKey = localStorage.getItem('OPENAI_API_KEY');
  const baseUrl = localStorage.getItem('OPENAI_BASE_URL');
  console.log('11', 11)
  if (!apiKey) {
    throw new Error("OpenAI API Key not found. Please set it in Settings.");
  }

  if (!llm) {
    console.log('config', apiKey)
    llm = new ChatOpenAI({
      apiKey: apiKey,
      configuration: {
        baseURL: baseUrl || undefined,
      },
      modelName: "gpt-3.5-turbo",
      temperature: 0.7,
    });
  }

  return llm
}
/**
 * Search for similar documents
 */
export const search = async (query: string, k: number = 4): Promise<StoredDocument[]> => {
  console.log(`[RAG] Searching for: "${query}"`);
  const embedder = getEmbeddings();

  // 1. Vectorize the query
  console.log("[RAG] Vectorizing query...");
  console.log('query', query)
  console.log('embedder', embedder)
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
// 发起LLM请求
export const getLLm = async (query: string, onChunk: (chunk: string) => void) => {
  const llm = init();
  const llmcontext = llm.bindTools(tools)
  console.log('llmcontext', llmcontext)
  // Create the retrieval chain
  // const chain = RunnableSequence.from([
  //   // llmcontext,
  //   {
  //     context: async (input: string) => {
  //       const retrievedDocs = await search(input);
  //       const context = retrievedDocs.map(doc => doc.pageContent).join("\n\n");
  //       return context;
  //     },
  //     question: (input: string) => input,
  //   },
  //   ChatPromptTemplate.fromTemplate(`Answer the question based only on the following context:
  // const llmcontext = (llm as any).bindTools?.(lcTools);
  const retrievedDocs = await search(query);
  // Question: { question }`),
  //   llm,

  //   new StringOutputParser(),
  // ]);

  // const stream = await chain.stream(query);

  // for await (const chunk of stream) {
  //   onChunk(chunk);
  const contextStr = retrievedDocs.map(doc => doc.pageContent).join("\n\n");
  const prompt = ChatPromptTemplate.fromTemplate(`Answer the question based only on the following context:
{context}

 
Question: {question}`);
  console.log('llmcontext', llmcontext)
  const runnable = RunnableSequence.from([prompt, llmcontext as any]);
  const aiMsg: any = await runnable.invoke({ context: contextStr, question: query });
  console.log('aiMsg', aiMsg)
  const toolCalls = aiMsg?.additional_kwargs?.tool_calls;
  console.log('toolCalls', toolCalls)
  if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
    const call = toolCalls[0];
    let argsObj: any = {};
    try {
      const rawArgs = call?.function?.arguments;
      argsObj = typeof rawArgs === "string" ? JSON.parse(rawArgs) : (rawArgs || {});
    } catch { }
    const name = call?.function?.name;
    let text = "";
    if (name === "getCurrentTime") {
      const tz = typeof argsObj?.timezone === "string" ? argsObj.timezone : undefined;
      const res = await getCurrentTime(tz);
      text = res && typeof res === "object" && "success" in res ? (res.success ? String(res.data) : String(res.error)) : String(res);
    } else if (name === "searchKnowledgeBase") {
      const q = typeof argsObj?.query === "string" ? argsObj.query : query;
      const res = await searchKnowledgeBase(q);
      text = res && typeof res === "object" && "success" in res ? (res.success ? String(res.data) : String(res.error)) : String(res);
    } else if (name === "calculate") {
      const expr = typeof argsObj?.expression === "string" ? argsObj.expression : "";
      const res = await calculate(expr);
      text = res && typeof res === "object" && "success" in res ? (res.success ? String(res.data) : String(res.error)) : String(res);
    }
    for (const ch of text) {
      onChunk(ch);
      await new Promise((r) => setTimeout(r, 16));
    }
    return;
  }
  const content = typeof aiMsg?.content === "string" ? aiMsg.content : String(aiMsg?.content ?? "");
  for (const ch of content) {
    onChunk(ch);
    // await new Promise((r) => setTimeout(r, 16));
  }
};





/**
 * Clear all stored vectors
 */
export const clear = () => {
  // docs = [];add 
};
