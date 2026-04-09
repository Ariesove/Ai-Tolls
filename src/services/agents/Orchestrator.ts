import { AgentTask, OrchestratorResult, AgentRole } from './types';
import { LinterAgent } from './LinterAgent';
import { ArchitectAgent } from './ArchitectAgent';
import { RefactorAgent } from './RefactorAgent';
import { isOk } from '@/lib/result';

/**
 * Orchestrator (协调者): 任务分发与结果汇总。
 * 核心逻辑：
 * 1. 接收代码片段。
 * 2. 分发给 LinterAgent 和 ArchitectAgent 并行审查。
 * 3. 汇总两个 Agent 的建议。
 */
export class CodeReviewOrchestrator {
  private agents = [
    new LinterAgent(),
    new ArchitectAgent()
  ];
  private refactorer = new RefactorAgent();

  /**
   * 运行代码审查全链路
   * @param task 审查任务
   * @param onAgentProgress 可选的回调，用于展示各 Agent 的完成情况
   */
  async runReview(
    task: AgentTask,
    onAgentProgress?: (role: AgentRole, progress: 'thinking' | 'done' | 'error') => void
  ): Promise<OrchestratorResult> {

    // 1. 并行分发任务（中大厂追求效率的典型体现）
    const promises = this.agents.map(async (agent) => {
      onAgentProgress?.(agent.role, 'thinking');
      const result = await agent.run(task);

      if (isOk(result)) {
        onAgentProgress?.(agent.role, 'done');
        return result.data;
      } else {
        onAgentProgress?.(agent.role, 'error');
        console.error(`[${agent.name}] 审查失败:`, result.error);
        return {
          role: agent.role,
          comments: [{ severity: 'error', message: `审查失败: ${result.error}` }],
          thinking: '出错了，请检查配置。'
        };
      }
    });

    const results = await Promise.all(promises);

    // 2. 最终整合（如果某些 Agent 失败，也应尽量基于成功的线索做最终代码）
    onAgentProgress?.(AgentRole.REFACTORER, 'thinking');
    const mergedHints = results
      .map((r) => {
        const head = `[${r.role}]`;
        const msgs = (Array.isArray(r.comments) ? r.comments : [])
          .slice(0, 10)
          .map((c) => `- (${c.severity}) ${c.message}${typeof c.line === 'number' ? ` @${c.line}` : ''}`)
          .join('\n');
        return `${head}\n${msgs}`;
      })
      .join('\n\n');

    const refTask: AgentTask = {
      ...task,
      context: [task.context, '【审查线索汇总】', mergedHints].filter(Boolean).join('\n\n'),
    };
    const refRes = await this.refactorer.run(refTask);
    let finalSuggestion: string | undefined;
    if (isOk(refRes)) {
      onAgentProgress?.(AgentRole.REFACTORER, 'done');
      results.push(refRes.data);
      finalSuggestion = refRes.data.suggestedCode;
    } else {
      onAgentProgress?.(AgentRole.REFACTORER, 'error');
      console.error(`[${this.refactorer.name}] 整合失败:`, refRes.error);
      finalSuggestion =
        results.find(r => r.role === AgentRole.ARCHITECT)?.suggestedCode
        || results.find(r => r.role === AgentRole.LINTER)?.suggestedCode;
    }

    // 2. 汇总结果
    return {
      taskId: task.id,
      originalCode: task.code,
      results: results,
      finalSuggestion
    };
  }
}
