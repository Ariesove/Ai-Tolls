"use client";
import React, { useState } from "react";

export default function IngestPage(): JSX.Element {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setResult("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/ingest", { method: "POST", body: fd });
      const json = await res.json();
      if (json?.success) {
        setResult(
          `文件: ${json.data.filename}\n切片数: ${json.data.chunks}\n向量维度: ${json.data.embedding_dim}`,
        );
      } else {
        setResult(`失败: ${json?.error ?? "未知错误"}`);
      }
    } catch (err) {
      setResult(`异常: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">最小闭环：文档向量化</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <input
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="submit"
          disabled={!file || loading}
          className="px-3 py-2 rounded bg-black text-white disabled:opacity-50"
        >
          {loading ? "处理中..." : "上传并向量化"}
        </button>
      </form>
      {result && (
        <pre className="mt-6 p-3 bg-gray-100 rounded text-sm whitespace-pre-wrap">
          {result}
        </pre>
      )}
    </main>
  );
}
