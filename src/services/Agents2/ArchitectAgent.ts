import InitLLm, { createAgentRunner, type AgentRuntime } from "./agentUtils";
import { AgentRole, AgentTask, IAgent } from "./types";

/**
 * Architect Agent: 专注于架构设计、逻辑提取、性能优化、模式建议。
 */
const getUserPrompt = (task: AgentTask): string => {
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

const ArchitectAgent = (): IAgent => {
  const role = AgentRole.ARCHITECT;
  const name = 'Architect (架构导师)';
  const llm = InitLLm();

  const getSystemPrompt = () => {
    return `
你是一名资深的前端架构师（社招 5 年经验以上，中大厂级别）。
你的任务是审查用户的 React / TypeScript 代码，从架构和逻辑优化的角度给出建议。

## 审查重点：
1. **职责分离 (SOLID)**：组件是否太胖？逻辑是否应该抽离到自定义 Hooks 或 Service 层？
2. **性能优化**：是否有明显的 React 重渲染隐患？是否缺少 useMemo/useCallback/React.memo？
3. **设计模式**：是否有更好的状态管理方案？是否可以使用组合 (Composition) 优于继承 (Inheritance)？
4. **可扩展性**：硬编码的配置是否应该抽离？接口设计是否灵活？

## 输出格式要求（必须是 JSON）：
{
  "thinking": "这里是你对代码架构的深度分析...",
  "comments": [
    {
      "severity": "info",
      "message": "这里的复杂数据处理逻辑可以抽离为自定义 Hook useMyLogic",
      "suggestion": "const { data, loading } = useMyLogic();"
    }
  ],
  "suggestedCode": "（可选：如果涉及架构优化，提供重构后的代码片段）"
}

强约束：只输出一个合法 JSON 对象，不要输出 Markdown，不要输出代码块，不要输出任何额外文本；首字符必须是 {，末字符必须是 }。
    `;
  }

  const runtime: AgentRuntime = {
    role,
    name,
    llm,
    getSystemPrompt,
    getUserPrompt,
  };

  return {
    role,
    name,
    run: createAgentRunner(runtime),
  }
}

export default ArchitectAgent
