import { Result } from '@/lib/result';

export enum AgentRole {
  LINTER = 'LINTER',         // 规范检查：命名、Hooks、样式等
  ARCHITECT = 'ARCHITECT',   // 架构优化：逻辑提取、性能优化、模式建议
  REFACTORER = 'REFACTORER', // 重构执行：汇总建议，生成最终代码
  ORCHESTRATOR = 'ORCHESTRATOR' // 协调者：任务分发与结果汇总
}

export interface ReviewComment {
  line?: number;           // 行号（可选，针对具体行的建议）
  column?: number;         // 列号（可选）
  severity: 'info' | 'warn' | 'error';
  message: string;         // 审查意见
  suggestion?: string;     // 修复建议（代码片段）
}

export interface AgentTask {
  id: string;
  code: string;            // 待审查的代码
  fileName?: string;       // 文件名（辅助 AI 理解上下文）
  language: string;        // 编程语言（typescript, javascript, react-tsx 等）
  context?: string;        // 额外的上下文信息（如已有的 RAG 知识片段）
  instruction?: string;    // 用户显式输入的“指挥指令”（具备最高优先级）
}

export interface AgentResult {
  role: AgentRole;
  comments: ReviewComment[];
  suggestedCode?: string;  // 重构后的完整代码建议
  thinking?: string;       // AI 的思考过程（面试亮点：展示逻辑推导）
}

export interface IAgent {
  readonly role: AgentRole;
  readonly name: string;

  /**
   * 执行审查任务
   * @param task 任务信息
   * @param onStream 可选的流式回调（用于打字机效果）
   */
  run(task: AgentTask, onStream?: (chunk: string) => void): Promise<Result<AgentResult>>;
}

export interface OrchestratorResult {
  taskId: string;
  originalCode: string;
  results: AgentResult[];    // 各个 Agent 的汇总结果
  finalSuggestion?: string;  // 最终汇总后的重构建议代码
}
