import { ChatOpenAI } from "@langchain/openai";

const InitLLm = () => {
  // 复用已有的 localStorage 配置
  const apiKey = typeof window !== 'undefined' ? localStorage.getItem('OPENAI_API_KEY') : null;
  const baseUrl = typeof window !== 'undefined' ? localStorage.getItem('OPENAI_BASE_URL') || 'https://api.302.ai/v1' : 'https://api.302.ai/v1';

  if (!apiKey) {
    console.warn(`[}] API Key 缺失，请在设置中配置`);
  }

  let llm = new ChatOpenAI({
    apiKey: apiKey || 'dummy-key',
    configuration: {
      baseURL: baseUrl,
    },
    modelName: "gpt-4o", // 默认使用强模型以保证审查质量
    temperature: 0.1,    // 低随机性，保证代码审查的稳定性
  });
  return llm
}
export default InitLLm