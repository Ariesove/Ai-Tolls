import { Result, Ok, Err } from "../../lib/result";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * 工具函数定义
 * 每个工具函数都有明确的功能描述和参数结构
 */

/**
 * 搜索知识库工具
 * 用于回答需要查询知识库的问题
 */
export async function searchKnowledgeBase(query: string): Promise<Result<string, string>> {
  try {
    const { search } = await import("../rag/RAG");
    const docs = await search(query, 3);

    if (docs.length === 0) {
      return Ok("知识库中没有找到相关内容");
    }

    const context = docs.map(doc => doc.pageContent).join("\n\n");
    return Ok(context);
  } catch (error) {
    return Err(`搜索知识库失败: ${(error as Error).message}`);
  }
}

/**
 * 数学计算工具
 * 用于执行数学运算
 */
export async function calculate(expression: string): Promise<Result<string, string>> {
  try {
    // 简单的数学表达式计算，实际项目中可以使用更安全的数学库
    const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, "");
    const result = Function('"use strict"; return (' + sanitized + ')')();

    if (typeof result !== 'number' || isNaN(result)) {
      return Err("无效的数学表达式");
    }

    return Ok(result.toString());
  } catch (error) {
    return Err(`计算失败: ${(error as Error).message}`);
  }
}

/**
 * 获取当前时间工具
 * 用于回答时间相关问题
 */
export async function getCurrentTime(timezone?: string): Promise<Result<string, string>> {
  try {
    const now = new Date();
    const timeString = now.toLocaleString('zh-CN', {
      timeZone: timezone || 'Asia/Shanghai',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    return Ok(`当前时间是: ${timeString}`);
  } catch (error) {
    return Err(`获取时间失败: ${(error as Error).message}`);
  }
}

/**
 * 工具描述定义
 * 用于LangChain Function Calling的schema定义
 */
export const tools = [
  {
    name: "searchKnowledgeBase",
    description: "搜索知识库，获取与查询相关的文档内容",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "搜索查询的关键词或问题"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "calculate",
    description: "执行数学计算，支持基本的四则运算",
    parameters: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "数学表达式，例如: '15 * 3 + 2'"
        }
      },
      required: ["expression"]
    }
  },
  {
    name: "getCurrentTime",
    description: "获取当前时间信息",
    parameters: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description: "时区，例如: 'Asia/Shanghai'，可选"
        }
      }
    }
  }
];

/**
 * 工具映射表
 * 将工具名称映射到实际的函数实现
 */
export const toolFunctions: Record<string, Function> = {
  searchKnowledgeBase,
  calculate,
  getCurrentTime
};

export const lcTools = [
  tool(
    async ({ query }: { query: string }) => {
      const res = await searchKnowledgeBase(query);
      if ((res as Result<string, string>).success) {
        return (res as Result<string, string>).data;
      }
      throw new Error((res as Result<string, string>).error as string);
    },
    {
      name: "searchKnowledgeBase",
      description: "搜索知识库，获取与查询相关的文档内容",
      schema: z.object({
        query: z.string()
      })
    }
  ),
  tool(
    async ({ expression }: { expression: string }) => {
      const res = await calculate(expression);
      if ((res as Result<string, string>).success) {
        return (res as Result<string, string>).data;
      }
      throw new Error((res as Result<string, string>).error as string);
    },
    {
      name: "calculate",
      description: "执行数学计算，支持基本的四则运算",
      schema: z.object({
        expression: z.string()
      })
    }
  ),
  tool(
    async ({ timezone }: { timezone?: string }) => {
      const res = await getCurrentTime(timezone);
      if ((res as Result<string, string>).success) {
        return (res as Result<string, string>).data;
      }
      throw new Error((res as Result<string, string>).error as string);
    },
    {
      name: "getCurrentTime",
      description: "获取当前时间信息",
      schema: z.object({
        timezone: z.string().optional()
      })
    }
  ),
];
