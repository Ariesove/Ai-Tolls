import { describe, expect, it } from "vitest";
import { buildRagCtxText, parseRagEvidence } from "./ragEvidence";

describe("ragEvidence", () => {
  it("buildRagCtxText should return empty for empty blocks", () => {
    expect(buildRagCtxText([])).toBe("");
  });

  it("parseRagEvidence should return empty for empty ctxText", () => {
    expect(parseRagEvidence("")).toEqual([]);
  });

  it("parseRagEvidence should parse blocks and strip header", () => {
    const ctxText = buildRagCtxText([
      "#1 file=a.ts chunk=0 score=0.9\nhello world",
      "#2 file=b.ts chunk=3 score=0.8\nline1\nline2",
    ]);
    const res = parseRagEvidence(ctxText);
    expect(res).toHaveLength(2);
    expect(res[0]?.title).toContain("#1");
    expect(res[0]?.preview).toBe("hello world");
    expect(res[1]?.title).toContain("#2");
    expect(res[1]?.preview).toBe("line1\nline2");
  });

  it("parseRagEvidence should cap to 4 items", () => {
    const ctxText = buildRagCtxText([
      "#1\nA",
      "#2\nB",
      "#3\nC",
      "#4\nD",
      "#5\nE",
    ]);
    const res = parseRagEvidence(ctxText);
    expect(res).toHaveLength(4);
    expect(res[3]?.title).toContain("#4");
  });
});
