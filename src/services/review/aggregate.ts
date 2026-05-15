import { AgentResult, AgentRole, ReviewComment } from "@/services/Agents2/types";
import { Result, Ok, Err } from "@/lib/result";

export type ReviewDimension =
  | "correctness"
  | "typeSafety"
  | "reactHooks"
  | "performance"
  | "maintainability"
  | "style";

export type AggregatedItemKind = "mustFix" | "shouldImprove";

export interface AggregatedItem {
  id: string;
  kind: AggregatedItemKind;
  dimension: ReviewDimension;
  severity: "info" | "warn" | "error";
  title: string;
  description: string;
  evidence?: {
    role: AgentRole;
    message: string;
    line?: number;
  }[];
  suggestion?: string;
}

export interface DimensionScore {
  dimension: ReviewDimension;
  label: string;
  score: number; // 0..100
  evidence: string;
  nextAction: string;
}

export interface AggregatedReview {
  mustFix: AggregatedItem[];
  shouldImprove: AggregatedItem[];
  planSteps: string[];
  nextCommand: string;
  dimensions: DimensionScore[];
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

const normalizeText = (s: string) =>
  s
    .replace(/\s+/g, " ")
    .replace(/[，。；：！？、]/g, "")
    .trim()
    .toLowerCase();

const pickTop = <T>(arr: T[], n: number) => arr.slice(0, Math.max(0, n));

const scoreRank = (sev: ReviewComment["severity"]) =>
  sev === "error" ? 3 : sev === "warn" ? 2 : 1;

const dimensionRank = (d: ReviewDimension) => {
  if (d === "correctness") return 5;
  if (d === "typeSafety") return 4;
  if (d === "reactHooks") return 3;
  if (d === "performance") return 2;
  if (d === "maintainability") return 1;
  return 0;
};

const classifyDimension = (role: AgentRole, c: ReviewComment): ReviewDimension => {
  const text = `${c.message} ${c.suggestion ?? ""}`.toLowerCase();

  const has = (re: RegExp) => re.test(text);

  if (has(/\buseeffect\b|\busememo\b|\busecallback\b|\bhooks?\b|依赖|闭包|重渲染/)) {
    return "reactHooks";
  }
  if (has(/\bany\b|\bunknown\b|类型守卫|interface|type\s|泛型|返回值|入参|ts/)) {
    return "typeSafety";
  }
  if (has(/性能|re-render|render|memo|cache|虚拟化|debounce|throttle/)) {
    return "performance";
  }
  if (has(/职责|抽离|拆分|重构|可维护|复杂|嵌套|重复|复用|分层|service|hook/)) {
    return "maintainability";
  }
  if (has(/命名|格式|lint|规范|风格|可读性/)) {
    return "style";
  }

  return role === AgentRole.ARCHITECT ? "maintainability" : "style";
};

const idOf = (role: AgentRole, c: ReviewComment, dimension: ReviewDimension) => {
  const base = `${dimension}|${role}|${normalizeText(c.message).slice(0, 80)}|${c.line ?? ""}`;
  let h = 0;
  for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) >>> 0;
  return `r_${h.toString(16)}`;
};

const titleOf = (dimension: ReviewDimension, message: string) => {
  const short = message.trim().slice(0, 28);
  const prefix =
    dimension === "correctness"
      ? "正确性"
      : dimension === "typeSafety"
        ? "类型"
        : dimension === "reactHooks"
          ? "Hooks"
          : dimension === "performance"
            ? "性能"
            : dimension === "maintainability"
              ? "架构"
              : "规范";
  return `${prefix}：${short}${message.length > 28 ? "…" : ""}`;
};

const defaultPlan = (mustFix: AggregatedItem[], shouldImprove: AggregatedItem[]) => {
  const hasHooks = mustFix.some((x) => x.dimension === "reactHooks") || shouldImprove.some((x) => x.dimension === "reactHooks");
  const hasType = mustFix.some((x) => x.dimension === "typeSafety") || shouldImprove.some((x) => x.dimension === "typeSafety");
  const hasPerf = shouldImprove.some((x) => x.dimension === "performance");
  const hasArch = shouldImprove.some((x) => x.dimension === "maintainability");

  const steps: string[] = [];
  steps.push("先修正正确性/类型/Hook 依赖等会导致行为错误的问题");
  if (hasHooks) steps.push("校准 useEffect/useMemo/useCallback 依赖，避免闭包与重渲染陷阱");
  if (hasType) steps.push("去除 any，引入类型守卫与清晰的接口边界");
  if (hasArch) steps.push("抽离复杂逻辑到 Hooks/Services，收敛职责与依赖方向");
  if (hasPerf) steps.push("对热点计算与列表渲染做 memo/拆分，减少不必要重渲染");
  steps.push("对比 Diff 确认行为不变，再进入下一轮微调");
  return pickTop(steps, 5);
};

const nextCommandOf = (mustFix: AggregatedItem[], shouldImprove: AggregatedItem[]) => {
  const wantPerf = shouldImprove.some((x) => x.dimension === "performance");
  const wantArch = shouldImprove.some((x) => x.dimension === "maintainability");
  const wantType = mustFix.some((x) => x.dimension === "typeSafety");
  const parts = [
    "保持业务行为不变",
    wantType ? "优先修复类型与 Hook 依赖问题" : undefined,
    wantPerf ? "只做必要的性能优化" : undefined,
    wantArch ? "把复杂逻辑抽离到 hook/service" : undefined,
    "输出可直接应用的代码与清晰 Diff",
  ].filter(Boolean);
  return `指挥指令：${parts.join("，")}。`;
};

const dimLabel: Record<ReviewDimension, string> = {
  correctness: "正确性",
  typeSafety: "类型安全",
  reactHooks: "React Hooks",
  performance: "性能",
  maintainability: "可维护性",
  style: "规范与可读性",
};

const summarizeDim = (dimension: ReviewDimension, items: AggregatedItem[]) => {
  const inDim = items.filter((x) => x.dimension === dimension);
  const errors = inDim.filter((x) => x.severity === "error").length;
  const warns = inDim.filter((x) => x.severity === "warn").length;
  const infos = inDim.filter((x) => x.severity === "info").length;
  const score = clamp(100 - errors * 22 - warns * 10 - infos * 2);
  const evidence =
    inDim.length === 0 ? "暂无问题" : `${errors} 错误 / ${warns} 警告 / ${infos} 提示`;
  const nextAction =
    inDim.length === 0
      ? "保持"
      : inDim[0]?.title.replace(/^[^：]+：/, "").slice(0, 24) || "按建议修复";
  return { score, evidence, nextAction };
};

export const aggregateAgentResults = (
  results: AgentResult[],
): Result<AggregatedReview> => {
  try {
    const all: AggregatedItem[] = [];

    for (const r of results) {
      const comments = Array.isArray(r.comments) ? r.comments : [];
      for (const c of comments) {
        const dimension = classifyDimension(r.role, c);
        const id = idOf(r.role, c, dimension);
        all.push({
          id,
          kind: c.severity === "error" ? "mustFix" : "shouldImprove",
          dimension,
          severity: c.severity,
          title: titleOf(dimension, c.message),
          description: c.message,
          evidence: [
            { role: r.role, message: c.message, line: typeof c.line === "number" ? c.line : undefined },
          ],
          suggestion: c.suggestion,
        });
      }
    }

    const uniq = new Map<string, AggregatedItem>();
    for (const it of all) {
      const key = `${it.dimension}|${normalizeText(it.description).slice(0, 120)}`;
      const prev = uniq.get(key);
      if (!prev) {
        uniq.set(key, it);
        continue;
      }
      const merged: AggregatedItem = {
        ...prev,
        severity: scoreRank(it.severity) > scoreRank(prev.severity) ? it.severity : prev.severity,
        kind: scoreRank(it.severity) > scoreRank(prev.severity) ? it.kind : prev.kind,
        evidence: [...(prev.evidence ?? []), ...(it.evidence ?? [])],
      };
      uniq.set(key, merged);
    }

    const list = Array.from(uniq.values()).sort((a, b) => {
      const s = scoreRank(b.severity) - scoreRank(a.severity);
      if (s !== 0) return s;
      return dimensionRank(b.dimension) - dimensionRank(a.dimension);
    });

    const mustFix = pickTop(
      list.filter((x) => x.kind === "mustFix"),
      3,
    );
    const shouldImprove = pickTop(
      list.filter((x) => x.kind === "shouldImprove"),
      3,
    );

    const dimensions: DimensionScore[] = (Object.keys(dimLabel) as ReviewDimension[]).map(
      (d) => {
        const { score, evidence, nextAction } = summarizeDim(d, list);
        return { dimension: d, label: dimLabel[d], score, evidence, nextAction };
      },
    );

    const planSteps = defaultPlan(mustFix, shouldImprove);
    const nextCommand = nextCommandOf(mustFix, shouldImprove);

    return Ok({
      mustFix,
      shouldImprove,
      planSteps,
      nextCommand,
      dimensions,
    });
  } catch (e) {
    return Err(`聚合失败：${(e as Error).message}`);
  }
};

