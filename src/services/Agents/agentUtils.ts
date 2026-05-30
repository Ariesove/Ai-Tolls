import { ChatOpenAI } from "@langchain/openai";
import { Err, Ok, Result } from "@/lib/result";
import { AgentResult, AgentRole, AgentTask, ReviewComment } from "./types";

type InitLLmOptions = {
  modelName?: string;
  temperature?: number;
};

const InitLLm = (options: InitLLmOptions = {}) => {
  const apiKey =
    typeof window !== "undefined" ? localStorage.getItem("OPENAI_API_KEY") : null;
  const baseUrl =
    typeof window !== "undefined"
      ? localStorage.getItem("OPENAI_BASE_URL") || "https://api.302.ai/v1"
      : "https://api.302.ai/v1";

  if (!apiKey) {
    console.warn(`[Agents2] API Key 缺失，请在设置中配置`);
  }

  return new ChatOpenAI({
    apiKey: apiKey || "dummy-key",
    configuration: {
      baseURL: baseUrl,
    },
    modelName: options.modelName ?? "gpt-4o",
    temperature: options.temperature ?? 0.1,
  });
};

const contentToText = (content: unknown): string => {
  if (typeof content === "string") return content;
  if (!content) return "";

  if (Array.isArray(content)) {
    return content
      .map((p) => {
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
      })
      .join("");
  }

  if (typeof content === "object") {
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
};

const findFirstJsonObject = (s: string): string | undefined => {
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
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      depth++;
      continue;
    }
    if (ch === "}") {
      depth--;
      if (depth === 0) return s.slice(first, i + 1);
    }
  }

  return s.slice(first);
};

const extractJsonObjectText = (raw: string): string => {
  const src = raw.replace(/\r\n/g, "\n").trim();

  const fenced = /```(?:json)?[^\n]*\n([\s\S]*?)\n```/gi;
  let m: RegExpExecArray | null = null;
  while ((m = fenced.exec(src))) {
    const inner = (m[1] ?? "").trim();
    const picked = findFirstJsonObject(inner);
    if (picked) return picked;
  }

  const withoutFences = src.replace(/```[\s\S]*?```/g, "").trim();
  return findFirstJsonObject(withoutFences) ?? withoutFences;
};

const normalizeAgentResult = (
  parsed: unknown,
  role: AgentRole,
): AgentResult => {
  const asRecord = (v: unknown): Record<string, unknown> | undefined =>
    v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : undefined;

  const rec = asRecord(parsed) ?? {};
  const thinking = typeof rec.thinking === "string" ? rec.thinking : "";
  const suggestedCode =
    typeof rec.suggestedCode === "string" ? rec.suggestedCode : undefined;

  const commentsRaw = Array.isArray(rec.comments) ? rec.comments : [];
  const comments = commentsRaw
    .map((c): ReviewComment | null => {
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
        typeof cr.column === "number" && Number.isFinite(cr.column)
          ? cr.column
          : undefined;
      const suggestion = typeof cr.suggestion === "string" ? cr.suggestion : undefined;
      return { line, column, severity: sev, message, suggestion };
    })
    .filter((x): x is ReviewComment => Boolean(x));

  return {
    role,
    comments,
    suggestedCode,
    thinking,
  };
};

const parseResponse = (
  content: string,
  ctx: { role: AgentRole; name?: string },
): Result<AgentResult> => {
  try {
    const jsonStr = extractJsonObjectText(content);
    const parsed: unknown = JSON.parse(jsonStr);
    return Ok(normalizeAgentResult(parsed, ctx.role));
  } catch {
    const preview = typeof content === "string" ? content.slice(0, 800) : "";
    console.error(`[${ctx.name ?? ctx.role}] JSON 解析失败:`, preview);
    return Err(
      `[${ctx.name ?? ctx.role}] 解析 AI 返回数据失败，可能不是合法的 JSON 格式。`,
    );
  }
};

type AgentRuntime = {
  role: AgentRole;
  name: string;
  llm: ChatOpenAI;
  getSystemPrompt: () => string;
  getUserPrompt: (task: AgentTask) => string;
};

const createAgentRunner =
  (runtime: AgentRuntime) =>
    async (
      task: AgentTask,
      onStream?: (chunk: string) => void,
    ): Promise<Result<AgentResult>> => {
      try {
        const systemPrompt = runtime.getSystemPrompt();
        const userPrompt = runtime.getUserPrompt(task);

        if (onStream) {
          const stream = await runtime.llm.stream([
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ]);

          let fullContent = "";
          for await (const chunk of stream) {
            const piece = contentToText(
              (chunk as unknown as { content?: unknown })?.content,
            );
            if (!piece) continue;
            fullContent += piece;
            onStream(piece);
          }
          return parseResponse(fullContent, {
            role: runtime.role,
            name: runtime.name,
          });
        }

        const response = await runtime.llm.invoke([
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ]);

        const content = contentToText(
          (response as unknown as { content?: unknown })?.content,
        );
        return parseResponse(content, { role: runtime.role, name: runtime.name });
      } catch (error) {
        return Err(`[${runtime.name}] 执行失败: ${(error as Error).message}`);
      }
    };



export {
  InitLLm as default,
  InitLLm,
  contentToText,
  findFirstJsonObject,
  extractJsonObjectText,
  normalizeAgentResult,
  parseResponse,
  createAgentRunner,
  type AgentRuntime,
  type InitLLmOptions,
};
