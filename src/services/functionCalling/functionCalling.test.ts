import { describe, it, expect, vi, beforeEach } from "vitest";
import { FunctionCallingHandler, processFunctionCall } from "./functionCalling";
import * as toolsModule from "./tools";

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

// Mock LangChain modules
vi.mock("@langchain/openai", () => {
  class ChatOpenAI {
    invoke = vi.fn().mockResolvedValue({ content: "便捷函数测试结果" });
  }
  return { ChatOpenAI };
});

vi.mock("./tools", () => ({
  toolFunctions: {
    searchKnowledgeBase: vi.fn(),
    calculate: vi.fn(),
    getCurrentTime: vi.fn(),
  },
  tools: [
    {
      name: "searchKnowledgeBase",
      description: "搜索知识库",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "搜索查询" }
        },
        required: ["query"]
      }
    }
  ]
}));

describe("FunctionCallingHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue("mock-api-key");
  });

  describe("构造函数", () => {
    it("应该成功创建实例当API密钥存在时", () => {
      const handler = new FunctionCallingHandler();
      expect(handler).toBeDefined();
    });

    it("应该抛出错误当API密钥不存在时", () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      expect(() => {
        new FunctionCallingHandler();
      }).toThrow("OpenAI API Key not found. Please set it in Settings.");
    });
  });

  describe("processMessage", () => {
    it("应该处理直接回答（无需函数调用）", async () => {
      const handler = new FunctionCallingHandler();
      const mockInvoke = vi.fn().mockResolvedValue({
        content: "这是一个直接回答"
      });
      
      // @ts-ignore - 访问私有属性进行测试
      handler.llm.invoke = mockInvoke;

      const result = await handler.processMessage("你好");

      expect(result.success).toBe(true);
      expect(result.data).toBe("这是一个直接回答");
      expect(mockInvoke).toHaveBeenCalled();
    });

    it("应该处理函数调用并执行工具函数", async () => {
      const handler = new FunctionCallingHandler();
      const mockInvoke = vi.fn()
        .mockResolvedValueOnce({
          content: '{"function_call": {"name": "searchKnowledgeBase", "arguments": {"query": "测试查询"}}}'
        })
        .mockResolvedValueOnce({
          content: "基于搜索结果，我找到了相关信息。"
        });

      // @ts-ignore
      handler.llm.invoke = mockInvoke;

      // Mock 工具函数
      const mockSearchKnowledgeBase = vi.fn().mockResolvedValue({
        success: true,
        data: "搜索结果内容"
      });
      
      // @ts-ignore
      toolsModule.toolFunctions.searchKnowledgeBase = mockSearchKnowledgeBase;

      const result = await handler.processMessage("搜索知识库");

      expect(result.success).toBe(true);
      expect(result.data).toBe("基于搜索结果，我找到了相关信息。");
      expect(mockSearchKnowledgeBase).toHaveBeenCalledWith({ query: "测试查询" });
    });

    it("应该处理函数调用失败的情况", async () => {
      const handler = new FunctionCallingHandler();
      const mockInvoke = vi.fn().mockResolvedValue({
        content: '{"function_call": {"name": "unknownFunction", "arguments": {}}}'
      });

      // @ts-ignore
      handler.llm.invoke = mockInvoke;

      const result = await handler.processMessage("调用未知函数");

      expect(result.success).toBe(false);
      expect(result.error).toContain("未知函数");
    });

    it("应该支持流式输出", async () => {
      const handler = new FunctionCallingHandler();
      const chunks: string[] = [];
      const onChunk = (chunk: string) => chunks.push(chunk);

      const mockInvoke = vi.fn().mockResolvedValue({
        content: "流式回答内容"
      });

      // @ts-ignore
      handler.llm.invoke = mockInvoke;

      const result = await handler.processMessage("流式测试", onChunk);

      expect(result.success).toBe(true);
      expect(result.data).toBe("流式回答内容");
      expect(chunks).toEqual([]);
    });
  });

  describe("parseFunctionCall", () => {
    it("应该正确解析JSON格式的函数调用", () => {
      const handler = new FunctionCallingHandler();
      const content = '{"function_call": {"name": "calculate", "arguments": {"expression": "1+1"}}}';
      
      // @ts-ignore - 访问私有方法进行测试
      const result = handler.parseFunctionCall(content);

      expect(result).toEqual({
        name: "calculate",
        arguments: { expression: "1+1" }
      });
    });

    it("应该返回null当内容不是函数调用时", () => {
      const handler = new FunctionCallingHandler();
      const content = "这是一个普通回答";
      
      // @ts-ignore
      const result = handler.parseFunctionCall(content);

      expect(result).toBeNull();
    });

    it("应该处理格式不正确的JSON", () => {
      const handler = new FunctionCallingHandler();
      const content = "无效JSON内容";
      
      // @ts-ignore
      const result = handler.parseFunctionCall(content);

      expect(result).toBeNull();
    });
  });

  describe("对话历史管理", () => {
    it("应该正确管理对话历史", async () => {
      const handler = new FunctionCallingHandler();
      const mockInvoke = vi.fn().mockResolvedValue({
        content: "回答1"
      });

      // @ts-ignore
      handler.llm.invoke = mockInvoke;

      await handler.processMessage("问题1");
      const history1 = handler.getHistory();
      expect(history1).toHaveLength(2); // HumanMessage + AIMessage

      await handler.processMessage("问题2");
      const history2 = handler.getHistory();
      expect(history2).toHaveLength(4); // 两轮的对话

      handler.clearHistory();
      const history3 = handler.getHistory();
      expect(history3).toHaveLength(0);
    });
  });
});

describe("processFunctionCall", () => {
  it("应该成功处理单次Function Calling请求", async () => {
    const result = await processFunctionCall("测试消息");

    expect(result.success).toBe(true);
    expect(result.data).toBe("便捷函数测试结果");
  });
});
