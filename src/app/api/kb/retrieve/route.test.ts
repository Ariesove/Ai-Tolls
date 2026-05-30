import { beforeEach, describe, expect, it, vi } from "vitest";
import { Ok, Err } from "@/lib/result";
import { listChunksWithDocument } from "@/services/db/kbDb";
import { POST } from "./route";

vi.mock("@/services/db/kbDb", () => ({
  listChunksWithDocument: vi.fn(),
}));

describe("/api/kb/retrieve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
  });

  it("should 400 on invalid body", async () => {
    const req = new Request("http://localhost/api/kb/retrieve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return empty result when kb is empty", async () => {
    const mocked = vi.mocked(listChunksWithDocument);
    mocked.mockResolvedValue(
      Ok([] as Array<Record<string, unknown>>),
    );

    const req = new Request("http://localhost/api/kb/retrieve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "hello", k: 4 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json: unknown = await res.json();
    expect(json).toEqual({
      data: { ctxText: "", hits: 0, chars: 0, evidence: [] },
    });
  });

  it("should return 500 when db read fails", async () => {
    const mocked = vi.mocked(listChunksWithDocument);
    mocked.mockResolvedValue(Err("db failed"));

    const req = new Request("http://localhost/api/kb/retrieve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "hello", k: 2 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const json: unknown = await res.json();
    expect(json).toEqual({ error: "db failed" });
  });

  it("should return ctxText and evidence when kb has rows", async () => {
    const mocked = vi.mocked(listChunksWithDocument);
    mocked.mockResolvedValue(
      Ok([
        {
          documentId: "d1",
          filename: "a.ts",
          source: "unit",
          documentContent: "doc",
          chunkIndex: 0,
          chunkId: "c0",
          chunkContent: "alpha beta gamma",
          embedding: [1, 0, 0],
        },
        {
          documentId: "d2",
          filename: "b.ts",
          source: "unit",
          documentContent: "doc",
          chunkIndex: 1,
          chunkId: "c1",
          chunkContent: "delta epsilon",
          embedding: [0, 1, 0],
        },
      ]),
    );

    const req = new Request("http://localhost/api/kb/retrieve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "alpha", k: 4 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: {
        ctxText: string;
        hits: number;
        chars: number;
        evidence: Array<{ title: string; preview: string }>;
        dim: number;
      };
    };

    expect(typeof json.data.ctxText).toBe("string");
    expect(json.data.hits).toBe(2);
    expect(json.data.evidence).toHaveLength(2);
    expect(json.data.ctxText).toContain("来自知识库的相关片段");
    expect(json.data.ctxText).toContain("\n\n---\n\n");
    expect(json.data.dim).toBe(64);
    expect(json.data.chars).toBe(json.data.ctxText.length);
  });
});
