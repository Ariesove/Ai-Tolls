import { BaseAgent } from "./BaseAgent";
import { AgentRole, AgentTask } from "./types";

const buildReviewHints = (task: AgentTask) => {
  const instr = task.instruction?.trim();
  const instructionBlock = instr
    ? `\n【指挥指令 - 最高优先级】\n${instr}\n`
    : "";
  const ctx = task.context?.trim();
  const ctxBlock = ctx ? `\n\n【可参考上下文/审查线索汇总】\n${ctx}` : "";
  return `你将收到一段代码与一些审查线索。你的目标是：在满足指挥指令的前提下，综合这些线索给出一份“可直接应用”的最终代码。\n${instructionBlock}${ctxBlock}`;
};

export class RefactorAgent extends BaseAgent {
  readonly role = AgentRole.REFACTORER;
  readonly name = "Refactorer (最终整合)";

  protected getSystemPrompt(): string {
    return `
你是一名资深前端技术负责人，擅长在“规则 + 多人审查意见”下做最终落地改造。

核心约束：
1) 保持业务行为不变（除非明确指出 bug 并修复）。
2) TypeScript 零 any；不信任输入（unknown + 类型守卫）。
3) React：仅函数组件；useEffect 依赖精准；减少不必要重渲染。
4) 组合优于继承；单一职责；分层清晰（Components→Hooks/Store→Services→Utils）。
5) 只输出一个合法 JSON 对象，不要输出 Markdown/代码块/任何额外文本；首字符必须是 {，末字符必须是 }。
6) 为了支持前端流式展示：必须先输出 suggestedCode 字段，并尽早开始输出其内容；其余字段（thinking/comments）放在 suggestedCode 后面。

输出 JSON 格式：
{
  "suggestedCode": "最终可直接应用的完整代码",
  "thinking": "用 3-6 句总结你做了哪些关键合并决策（不要太长）",
  "comments": [
    { "severity": "warn", "message": "可选：汇总后的关键风险/收益点（最多 6 条）" }
  ]
}
    `;
  }

  protected getUserPrompt(task: AgentTask): string {
    return `
${buildReviewHints(task)}

【目标代码（${task.language}）】
文件名: ${task.fileName || "未知"}

\`\`\`${task.language}
${task.code}
\`\`\`

【并行审查的结果线索】
请综合以下要点做最终整合：
- 规范与类型（Linter）：修复 any、命名、Hooks 依赖、潜在 bug
- 架构与性能（Architect）：抽离复杂逻辑、减少重渲染、可维护性提升

要求：输出最终整合后的 suggestedCode（完整可运行），并给出少量汇总 comments。
    `;
  }
}
