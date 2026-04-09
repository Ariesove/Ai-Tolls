#!/usr/bin/env node
// Standalone Lighthouse runner to avoid Next.js bundling issues
// Usage: node scripts/lighthouse-runner.mjs --url https://example.com
const args = process.argv.slice(2);
let url = "";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--url") {
    url = args[i + 1] || "";
    i++;
  }
}
if (!url) {
  console.error("missing --url");
  process.exit(2);
}

const run = async () => {
  try {
    const chromeLauncher = (await import("chrome-launcher")).default;
    const lighthouse = (await import("lighthouse")).default;
    const launchOpts = {
      chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
    };
    // 允许通过环境变量显式指定 Chrome 可执行文件路径（Windows 常见）
    const chromePath =
      process.env.CHROME_PATH ||
      process.env.LIGHTHOUSE_CHROMIUM_PATH ||
      process.env.CHROMIUM_PATH;
    if (chromePath) {
      launchOpts.chromePath = chromePath;
    }
    const chrome = await chromeLauncher.launch(launchOpts);
    try {
      const options = {
        port: chrome.port,
        onlyCategories: ["accessibility", "best-practices", "seo"],
        logLevel: "error",
      };
      const runnerResult = await lighthouse(url, options);
      const lhr = runnerResult?.lhr || {};
      const scores = {
        accessibility: Math.round((lhr.categories?.accessibility?.score || 0) * 100),
        bestPractices: Math.round((lhr.categories?.["best-practices"]?.score || 0) * 100),
        seo: Math.round((lhr.categories?.seo?.score || 0) * 100),
      };
      const audits = lhr.audits || {};
      const suggestions = Object.keys(audits)
        .map((k) => ({ id: k, title: audits[k]?.title, score: audits[k]?.score }))
        .filter((x) => typeof x.score === "number" && x.score < 1 && x.title)
        .sort((a, b) => (a.score || 0) - (b.score || 0))
        .slice(0, 8)
        .map(({ id, title }) => ({ id, title }));
      const result = { ok: true, scores, suggestions };
      process.stdout.write(JSON.stringify(result));
    } finally {
      await chrome.kill();
    }
  } catch (e) {
    process.stdout.write(JSON.stringify({ ok: false, error: e.message || "failed" }));
    process.exit(1);
  }
};

run();
