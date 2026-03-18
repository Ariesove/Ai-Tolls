import { describe, expect, it } from "vitest";

import { chain, compose, pipe, pipeAsync } from "./utils";

describe("utils functional call chain", () => {
  it("pipe should run left-to-right", () => {
    const result = pipe(
      1,
      (n) => n + 1,
      (n) => n * 10,
      (n) => `${n}`
    );
    expect(result).toBe("20");
  });

  it("compose should run right-to-left", () => {
    const fn = compose(
      (n: number) => `${n}`,
      (n: number) => n * 10,
      (n: number) => n + 1
    );
    expect(fn(1)).toBe("20");
  });

  it("pipeAsync should await each step", async () => {
    const result = await pipeAsync(
      1,
      async (n) => n + 1,
      (n) => Promise.resolve(n * 10),
      (n) => `${n}`
    );
    expect(result).toBe("20");
  });

  it("chain should support fluent mapping", () => {
    const result = chain("  hello ")
      .map((s) => s.trim())
      .map((s) => s.toUpperCase())
      .value();
    expect(result).toBe("HELLO");
  });
});

