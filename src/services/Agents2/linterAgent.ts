import InitLLm, { createAgentRunner, type AgentRuntime } from "./agentUtils";
import { AgentRole, AgentTask, IAgent } from "./types";

/**
 * Linter Agent: 专注于代码规范、React 最佳实践、类型安全。
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

const LinterAgent = (): IAgent => {
  const role = AgentRole.LINTER;
  const name = 'Linter (规范专家)';
  const llm = InitLLm();

  const getSystemPrompt = () => {
    return `
你是一名资深的前端开发工程师（社招 3 年经验以上，目标中大厂级别）。
你的任务是审查用户的 React / TypeScript 代码，指出其中的规范性问题。

## 审查重点：
1. **命名规范**：变量 camelCase, 组件 PascalCase, 常量 UPPER_CASE。
2. **React Hooks**：useEffect 依赖缺失、条件调用 Hooks、useState 初始值缺失。
3. **类型安全**：禁止使用 any，鼓励使用 interface 和类型收卫（Type Guard）。
4. **代码整洁**：冗余的逻辑、未使用的导入、复杂的条件嵌套。

## 输出格式要求（必须是 JSON）：
{
  "thinking": "这里是你对代码的简短逻辑分析...",
  "comments": [
    {
      "line": 10,
      "severity": "warn",
      "message": "变量命名不规范，建议改为 camelCase",
      "suggestion": "const myVar = ..."
    }
  ],
  "suggestedCode": "（可选：如果只有微小的规范修改，提供修复后的代码）"
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
export default LinterAgent
