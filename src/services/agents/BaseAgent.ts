import { ChatOpenAI } from "@langchain/openai";
import { AgentRole, AgentResult, AgentTask, IAgent } from './types';
import { Result, Ok, Err } from '@/lib/result';

/**
 * Agent 基础抽象类
 * 负责通用的 LLM 初始化、Prompt 拼装、JSON 解析
 */
export abstract class BaseAgent implements IAgent {
  abstract readonly role: AgentRole;
  abstract readonly name: string;
  protected llm: ChatOpenAI;

  constructor() {
    // 复用已有的 localStorage 配置
    const apiKey = typeof window !== 'undefined' ? localStorage.getItem('OPENAI_API_KEY') : null;
    const baseUrl = typeof window !== 'undefined' ? localStorage.getItem('OPENAI_BASE_URL') || 'https://api.302.ai/v1' : 'https://api.302.ai/v1';

    if (!apiKey) {
      console.warn(`[${this.name}] API Key 缺失，请在设置中配置`);
    }

    this.llm = new ChatOpenAI({
      apiKey: apiKey || 'dummy-key',
      configuration: {
        baseURL: baseUrl,
      },
      modelName: "gpt-4o", // 默认使用强模型以保证审查质量
      temperature: 0.1,    // 低随机性，保证代码审查的稳定性
    });
  }

  /**
   * 默认执行逻辑：发送 Prompt -> 解析 JSON -> 返回结果
   */
  async run(task: AgentTask, onStream?: (chunk: string) => void): Promise<Result<AgentResult>> {
    try {
      const systemPrompt = this.getSystemPrompt();
      const userPrompt = this.getUserPrompt(task);

      // 如果有流式需求
      if (onStream) {
        const stream = await this.llm.stream([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]);

        let fullContent = "";
        for await (const chunk of stream) {
          const piece = this.contentToText((chunk as unknown as { content?: unknown })?.content);
          if (!piece) continue;
          fullContent += piece;
          onStream(piece);
        }
        return this.parseResponse(fullContent);
      }

      // 普通非流式调用
      const response = await this.llm.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]);

      const content = this.contentToText((response as unknown as { content?: unknown })?.content);
      return this.parseResponse(content);
    } catch (error) {
      return Err(`[${this.name}] 执行失败: ${(error as Error).message}`);
    }
  }

  /**
   * 子类必须实现各自的系统提示词（核心：审查规则）
   */
  protected abstract getSystemPrompt(): string;

  /**
   * 默认用户提示词拼装
   */
  protected getUserPrompt(task: AgentTask): string {
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
  }

  /**
   * 解析 AI 返回的 JSON 字符串
   * 健壮性：自动去除 Markdown 代码块标记
   */
  protected parseResponse(content: string): Result<AgentResult> {
    try {
      const jsonStr = this.extractJsonObjectText(content);
      const parsed: unknown = JSON.parse(jsonStr);
      return Ok(this.normalizeAgentResult(parsed));
    } catch (e) {
      const preview = typeof content === "string" ? content.slice(0, 800) : "";
      console.error(`[${this.name}] JSON 解析失败:`, preview);
      return Err(`[${this.name}] 解析 AI 返回数据失败，可能不是合法的 JSON 格式。`);
    }
  }

  private contentToText(content: unknown): string {
    if (typeof content === "string") return content;
    if (!content) return "";

    if (Array.isArray(content)) {
      const parts = content.map((p) => {
        if (typeof p === "string") return p;
        if (p && typeof p === "object") {
          const rec = p as Record<string, unknown>;
          if (typeof rec.text === "string") return rec.text;
          if (typeof rec.content === "string") return rec.content;
        }
        try {
          return JSON.stringify(p);
        } catch {
          return String(p);
        }
      });
      return parts.join("");
    }

    if (content && typeof content === "object") {
      const rec = content as Record<string, unknown>;
      if (typeof rec.text === "string") return rec.text;
      if (typeof rec.content === "string") return rec.content;
      try {
        return JSON.stringify(content);
      } catch {
        return String(content);
      }
    }

    return String(content);
  }

  private extractJsonObjectText(raw: string): string {
    const src = raw.replace(/\r\n/g, "\n").trim();

    const fenced = /```(?:json)?[^\n]*\n([\s\S]*?)\n```/gi;
    let m: RegExpExecArray | null = null;
    while ((m = fenced.exec(src))) {
      const inner = (m[1] ?? "").trim();
      const picked = this.findFirstJsonObject(inner);
      if (picked) return picked;
    }

    const withoutFences = src.replace(/```[\s\S]*?```/g, "").trim();
    return this.findFirstJsonObject(withoutFences) ?? withoutFences;
  }

  private findFirstJsonObject(s: string): string | undefined {
    const first = s.indexOf("{");
    if (first === -1) return undefined;

    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = first; i < s.length; i++) {
      const ch = s[i];
      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          escaped = true;
          continue;
        }
        if (ch === "\"") {
          inString = false;
        }
        continue;
      }

      if (ch === "\"") {
        inString = true;
        continue;
      }
      if (ch === "{") {
        depth++;
        continue;
      }
      if (ch === "}") {
        depth--;
        if (depth === 0) {
          return s.slice(first, i + 1);
        }
      }
    }

    return s.slice(first);
  }

  private normalizeAgentResult(parsed: unknown): AgentResult {
    const asRecord = (v: unknown): Record<string, unknown> | undefined =>
      v && typeof v === "object" && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : undefined;

    const rec = asRecord(parsed) ?? {};
    const thinking =
      typeof rec.thinking === "string" ? rec.thinking : "";
    const suggestedCode =
      typeof rec.suggestedCode === "string" ? rec.suggestedCode : undefined;

    const commentsRaw = Array.isArray(rec.comments) ? rec.comments : [];
    const comments = commentsRaw
      .map((c): AgentResult["comments"][number] | null => {
        const cr = asRecord(c);
        if (!cr) return null;
        const message = typeof cr.message === "string" ? cr.message : "";
        if (!message) return null;
        const sev =
          cr.severity === "info" || cr.severity === "warn" || cr.severity === "error"
            ? cr.severity
            : "info";
        const line =
          typeof cr.line === "number" && Number.isFinite(cr.line) ? cr.line : undefined;
        const column =
          typeof cr.column === "number" && Number.isFinite(cr.column) ? cr.column : undefined;
        const suggestion =
          typeof cr.suggestion === "string" ? cr.suggestion : undefined;
        return { line, column, severity: sev, message, suggestion };
      })
      .filter((x): x is AgentResult["comments"][number] => Boolean(x));

    return {
      role: this.role,
      comments,
      suggestedCode,
      thinking,
    };
  }
}
