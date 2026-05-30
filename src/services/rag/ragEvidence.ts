export type RagEvidenceItem = { title: string; preview: string };

export const buildRagCtxText = (blocks: string[]): string => {
  if (!Array.isArray(blocks) || blocks.length === 0) return "";
  return `来自知识库的相关片段（Top ${blocks.length}）：\n\n${blocks.join("\n\n---\n\n")}`;
};

export const parseRagEvidence = (
  ctxText: string,
  limit = 4,
  previewLimit = 260,
): RagEvidenceItem[] => {
  if (typeof ctxText !== "string" || !ctxText.trim()) return [];

  const safeLimit =
    typeof limit === "number" && Number.isFinite(limit) && limit > 0
      ? Math.floor(limit)
      : 4;
  const safePreviewLimit =
    typeof previewLimit === "number" &&
    Number.isFinite(previewLimit) &&
    previewLimit > 0
      ? Math.floor(previewLimit)
      : 260;

  const start = ctxText.indexOf("：\n\n");
  const body = start !== -1 ? ctxText.slice(start + 3) : ctxText;
  const blocks = body
    .split("\n\n---\n\n")
    .map((b) => b.trim())
    .filter(Boolean);

  return blocks.slice(0, safeLimit).map((b) => {
    const [firstLine, ...rest] = b.split("\n");
    const title = (firstLine || "").trim();
    const preview = rest.join("\n").trim().slice(0, safePreviewLimit);
    return { title, preview };
  });
};
