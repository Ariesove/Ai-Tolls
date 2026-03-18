import { Result, Ok, Err } from "../../lib/result";
import { StoredDocument, search, getLLm } from "../rag/RAG";

/**
 * 增强版RAG工具函数
 * 直接集成RAG.ts的核心功能，实现最小闭环
 */

/**
 * 增强搜索知识库工具
 * 结合RAG搜索和文档格式化
 */
export async function enhancedSearchKnowledgeBase(
  query: string,
  k: number = 3
): Promise<Result<string, string>> {
  try {
    console.log(`[Enhanced RAG] Searching for: "${query}"`);

    // 直接使用RAG.ts的search函数
    const docs = await search(query, k);

    if (docs.length === 0) {
      return Ok("知识库中没有找到相关内容");
    }

    // 格式化搜索结果
    const formattedResults = docs.map((doc, index) => {
      return `结果 ${index + 1}:
${doc.pageContent}
---`;
    }).join("\n\n");

    console.log(`[Enhanced RAG] Found ${docs.length} results`);
    return Ok(formattedResults);
  } catch (error) {
    return Err(`增强搜索失败: ${(error as Error).message}`);
  }
}

/**
 * 文档分析工具
 * 分析知识库中的文档内容
 */
export async function analyzeDocuments(
  query: string,
  analysisType: "summary" | "keywords" | "entities" = "summary"
): Promise<Result<string, string>> {
  try {
    console.log(`[Enhanced RAG] Analyzing documents for: "${query}"`);

    // 先搜索相关文档
    const docs = await search(query, 5);

    if (docs.length === 0) {
      return Ok("没有找到相关文档进行分析");
    }

    const context = docs.map(doc => doc.pageContent).join("\n\n");

    let analysisPrompt = "";
    switch (analysisType) {
      case "summary":
        analysisPrompt = `请对以下内容进行摘要分析：\n\n${context}`;
        break;
      case "keywords":
        analysisPrompt = `请提取以下内容的关键词：\n\n${context}`;
        break;
      case "entities":
        analysisPrompt = `请识别以下内容中的实体信息：\n\n${context}`;
        break;
    }

    return Ok(`分析结果：\n${analysisPrompt}\n\n（基于${docs.length}个相关文档）`);
  } catch (error) {
    return Err(`文档分析失败: ${(error as Error).message}`);
  }
}

/**
 * 文档摘要工具
 * 生成知识库文档的智能摘要
 */
export async function summarizeDocuments(
  query: string,
  maxLength: number = 300
): Promise<Result<string, string>> {
  try {
    console.log(`[Enhanced RAG] Summarizing documents for: "${query}"`);

    // 搜索相关文档
    const docs = await search(query, 4);

    if (docs.length === 0) {
      return Ok("没有找到相关文档进行摘要");
    }

    // 合并文档内容
    const combinedContent = docs.map(doc => doc.pageContent).join("\n\n");

    // 截断过长的内容
    const truncatedContent = combinedContent.length > maxLength
      ? combinedContent.substring(0, maxLength) + "..."
      : combinedContent;

    return Ok(`文档摘要（基于${docs.length}个文档）：\n\n${truncatedContent}`);
  } catch (error) {
    return Err(`文档摘要失败: ${(error as Error).message}`);
  }
}

/**
 * 增强工具描述定义
 * 用于LangChain Function Calling的schema定义
 */
export const enhancedTools = [
  {
    name: "enhancedSearchKnowledgeBase",
    description: "增强搜索知识库，获取格式化的搜索结果",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "搜索查询的关键词或问题"
        },
        k: {
          type: "number",
          description: "返回结果数量，默认为3",
          default: 3
        }
      },
      required: ["query"]
    }
  },
  {
    name: "analyzeDocuments",
    description: "分析知识库中的文档内容，支持摘要、关键词提取、实体识别",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "分析查询的关键词或问题"
        },
        analysisType: {
          type: "string",
          description: "分析类型：summary、keywords、entities",
          enum: ["summary", "keywords", "entities"],
          default: "summary"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "summarizeDocuments",
    description: "生成知识库文档的智能摘要",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "摘要查询的关键词或问题"
        },
        maxLength: {
          type: "number",
          description: "摘要最大长度，默认为300字符",
          default: 300
        }
      },
      required: ["query"]
    }
  }
];

/**
 * 增强工具映射表
 * 将工具名称映射到实际的函数实现
 */
export const enhancedToolFunctions: Record<string, Function> = {
  enhancedSearchKnowledgeBase,
  analyzeDocuments,
  summarizeDocuments
};