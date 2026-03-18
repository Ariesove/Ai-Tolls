import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { Result, Ok, Err } from "../../lib/result";
import { tools, toolFunctions } from "./tools";

export interface FunctionCall {
  name: string;
  arguments: Record<string, any>;
}

export interface FunctionCallingOptions {
  model?: string;
  temperature?: number;
  maxRetries?: number;
}

/**
 * LangChain.js Function Calling 核心处理器
 * 支持多轮对话和工具调用
 */
export class FunctionCallingHandler {
  private llm: ChatOpenAI;
  private messages: any[] = [];
  private options: FunctionCallingOptions;

  constructor(options: FunctionCallingOptions = {}) {
    this.options = {
      model: "gpt-3.5-turbo",
      temperature: 0.7,
      maxRetries: 3,
      ...options
    };

    const apiKey = localStorage.getItem("OPENAI_API_KEY");
    const baseUrl = localStorage.getItem("OPENAI_BASE_URL");

    if (!apiKey) {
      throw new Error("OpenAI API Key not found. Please set it in Settings.");
    }

    this.llm = new ChatOpenAI({
      modelName: this.options.model,
      temperature: this.options.temperature,
      openAIApiKey: apiKey,
      configuration: {
        baseURL: baseUrl || undefined,
      },
    });
  }

  /**
   * 处理用户输入，支持Function Calling
   */
  async processMessage(
    userInput: string,
    onChunk?: (chunk: string) => void
  ): Promise<Result<string, string>> {
    try {
      // 添加用户消息到对话历史
      this.messages.push(new HumanMessage(userInput));

      // 构建系统提示，包含可用工具信息
      const systemPrompt = `你是一个智能助手，可以调用以下工具来回答问题：

${JSON.stringify(tools, null, 2)}

请根据用户的问题，判断是否需要调用工具。如果需要调用工具，请返回一个JSON格式的函数调用，包含函数名和参数。
如果不需要调用工具，请直接回答问题。

返回格式：
- 如果需要调用工具：{"function_call": {"name": "函数名", "arguments": {"参数名": "参数值"}}}
- 如果直接回答：直接返回文本内容`;

      // 准备消息列表（包含系统提示）
      const messagesWithSystem = [
        new SystemMessage(systemPrompt),
        ...this.messages
      ];

      // 调用LLM
      const response = await this.llm.invoke(messagesWithSystem);
      const content = response.content as string;

      // 检查是否是函数调用
      const functionCall = this.parseFunctionCall(content);
      
      if (functionCall) {
        // 执行函数调用
        const toolResult = await this.executeFunction(functionCall);
        
        if (isErr(toolResult)) {
          return toolResult;
        }

        // 将函数调用和结果添加到对话历史
        this.messages.push(
          new AIMessage(content),
          new SystemMessage(`函数调用结果: ${toolResult.data}`)
        );

        // 再次调用LLM，基于函数结果生成最终回答
        const finalResponse = await this.llm.invoke([
          ...messagesWithSystem,
          new AIMessage(content),
          new SystemMessage(`函数调用结果: ${toolResult.data}`)
        ]);

        const finalContent = finalResponse.content as string;
        this.messages.push(new AIMessage(finalContent));
        
        return Ok(finalContent);
      } else {
        // 直接回答，添加到对话历史
        this.messages.push(new AIMessage(content));
        return Ok(content);
      }
    } catch (error) {
      return Err(`Function Calling处理失败: ${(error as Error).message}`);
    }
  }

  /**
   * 解析函数调用
   */
  private parseFunctionCall(content: string): FunctionCall | null {
    try {
      // 尝试解析JSON格式的函数调用
      const parsed = JSON.parse(content);
      if (parsed.function_call) {
        return {
          name: parsed.function_call.name,
          arguments: parsed.function_call.arguments
        };
      }
    } catch {
      // 如果不是JSON，尝试用正则提取
      const match = content.match(/\{\s*"function_call"\s*:\s*\{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*(\{[^}]+\})\s*\}\s*\}/);
      if (match) {
        try {
          const funcCall = JSON.parse(match[0]);
          return {
            name: funcCall.function_call.name,
            arguments: funcCall.function_call.arguments
          };
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  /**
   * 执行函数调用
   */
  private async executeFunction(functionCall: FunctionCall): Promise<Result<string, string>> {
    const { name, arguments: args } = functionCall;
    
    // 查找对应的工具函数
    const toolFunction = toolFunctions[name];
    if (!toolFunction) {
      return Err(`未知函数: ${name}`);
    }

    try {
      // 执行函数
      const result = await toolFunction(args);
      
      // 处理Result类型返回值
      if (result && typeof result === 'object' && 'success' in result) {
        if (result.success) {
          return Ok(String(result.data));
        } else {
          return Err(result.error);
        }
      }
      
      // 处理普通返回值
      return Ok(String(result));
    } catch (error) {
      return Err(`函数执行失败: ${(error as Error).message}`);
    }
  }

  /**
   * 清空对话历史
   */
  clearHistory(): void {
    this.messages = [];
  }

  /**
   * 获取当前对话历史
   */
  getHistory(): any[] {
    return [...this.messages];
  }
}

/**
 * 便捷函数：处理单次Function Calling请求
 */
export async function processFunctionCall(
  userInput: string,
  onChunk?: (chunk: string) => void,
  options?: FunctionCallingOptions
): Promise<Result<string, string>> {
  const handler = new FunctionCallingHandler(options);
  return handler.processMessage(userInput, onChunk);
}

// 辅助函数
function isErr<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return !result.success;
}