---
name: "perf-mcp-audit"
description: "用 MCP/服务端代理做性能与体验核验（Lighthouse、截图、冒烟校验），并把证据回写到审查总览。用户要提升性能或做可验证优化时调用。"
---

# 性能审计（MCP + Evidence）

## 何时调用

- 用户提到：性能、首屏慢、卡顿、交互延迟、可访问性、SEO、需要“可验证”的优化
- 你准备把性能优化纳入 Code Review 的闭环，并产出可追溯证据

## MVP 目标

- 用“服务端 API 代理”方式调用 Node-only 工具（避免 Next 客户端打包问题）
- 产出两类证据：
  - 视觉证据：页面截图（用于回归对比）
  - 指标证据：Lighthouse（accessibility / best-practices / SEO）
- 把证据展示在 Code Review 右侧，减少等待焦虑（结果到一条展示一条）

## 实施步骤（最小闭环）

1. 服务端能力入口（app/api）
   - /api/mcp/screenshot：返回 dataUrl
   - /api/mcp/lighthouse：返回 { scores, suggestions }
2. 前端 UI 接入
   - 在 Code Review 右侧加入按钮触发
   - 将返回的证据渲染到卡片中（失败展示 error）
3. 性能改动前后对比（可选）
   - 将上一次结果写入 localStorage
   - 展示分数变化与关键建议变化

## 常见故障处理

- Could not find Chrome / Chromium
  - 使用系统 Chrome：设置 CHROME_PATH 环境变量
  - 或安装受管浏览器后再运行
- Next build 报 fs/ParsedURL/trace_engine
  - 确保 lighthouse/puppeteer 只在 server route / 子进程脚本中运行
  - 前端只 fetch，不直接 import Node 包

## 输出给用户

- 当前页面审计结论（分数 + Top 建议）
- 优化建议要绑定“证据变化”（例如分数提升、建议减少、截图差异）

