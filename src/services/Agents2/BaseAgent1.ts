import { PromptTemplate } from "langchain/prompts";
import InitLLm, { createAgentRunner, type AgentRuntime } from "./agentUtils";
import { AgentRole, AgentTask } from "./types";

type CreateBaseAgent1Options = {
  llm?: AgentRuntime["llm"];
  role?: AgentRole;
  name?: string;
  getSystemPrompt?: () => string;
  getUserPrompt?: (task: AgentTask) => string;
};

const BASE_TEMPLATE =
  "你作为最专业的前端工程师,你需要将整个输入的代码内容{{context}} 进行处理,通过之后的多个agent 进行处理";

const createBasePromptTemplate = () =>
  new PromptTemplate({ template: BASE_TEMPLATE, inputVariables: ["context"] });

const defaultGetUserPrompt = (task: AgentTask): string => {
  const instruction = task.instruction
    ? `\n【指挥指令 - 最高优先级】\n${task.instruction}\n`
    : "";
  const context = task.context ? `\n【上下文线索】\n${task.context}\n` : "";

  return `
请审查以下代码 (${task.language}):
文件名: ${task.fileName || "未知"}
${instruction}${context}
代码内容:
\`\`\`${task.language}
${task.code}
\`\`\`

请以 JSON 格式输出审查结果。
    `;
};

const createBaseAgent1Runtime = (options: CreateBaseAgent1Options = {}) => {
  const role = options.role ?? AgentRole.ORCHESTRATOR;
  const name = options.name ?? "BaseAgent1";
  const llm = options.llm ?? InitLLm();
  const getSystemPrompt = options.getSystemPrompt ?? (() => BASE_TEMPLATE);
  const getUserPrompt = options.getUserPrompt ?? defaultGetUserPrompt;

  const runtime: AgentRuntime = {
    role,
    name,
    llm,
    getSystemPrompt,
    getUserPrompt,
  };

  return runtime;
};

const createBaseAgent1Runner = (options: CreateBaseAgent1Options = {}) =>
  createAgentRunner(createBaseAgent1Runtime(options));

export {
  BASE_TEMPLATE,
  createBasePromptTemplate,
  defaultGetUserPrompt,
  createBaseAgent1Runtime,
  createBaseAgent1Runner,
  type CreateBaseAgent1Options,
};

export default createBaseAgent1Runner;
