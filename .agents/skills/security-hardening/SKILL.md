---
name: "security-hardening"
description: "对 Next.js/React/TS 项目做安全加固（密钥、依赖、前端安全、服务端 API 保护）。当用户要提升安全性或修复安全隐患时调用。"
---

# 安全加固（Security Hardening）

## 何时调用

- 用户提到：安全、密钥泄露、依赖漏洞、XSS/CSRF、API 滥用、权限与隔离
- 你发现代码里有硬编码 token、日志打印敏感信息、或把 Node 能力放进客户端

## MVP 目标（优先级从高到低）

1. 密钥与配置安全
   - 禁止把 key 写进代码或提交历史
   - 统一使用环境变量与运行时注入（浏览器端只用 NEXT_PUBLIC_*）
2. 服务端边界明确
   - Node-only 能力（fs/child_process/puppeteer/lighthouse）只能在 server route / server actions
   - 所有对外 API 需要基本的滥用防护（最小：输入校验 + 超时 + 错误整形）
3. 依赖风险可控
   - 固定关键依赖版本，避免随 latest 漂移
   - 引入最小的依赖检查与升级策略

## 执行清单（按顺序）

### A. 密钥治理

- 搜索 repo 中疑似密钥（sk-、apiKey、Authorization 等）
- 检查 localStorage/sessionStorage 写入的敏感数据
- 给用户明确建议：
  - 仅服务端持有密钥
  - 前端只持有短期 token（如需）并避免持久化

### B. 输入校验与错误处理（API 层）

- app/api 路由统一：
  - 解析参数 → 校验 → 限制长度/类型 → 执行 → 统一返回 { ok, data?, error? }
- 所有外部调用加入：
  - timeout（避免卡死）
  - try/catch（不泄露堆栈到客户端）

### C. 前端安全

- 渲染用户内容时使用安全策略（markdown/HTML 必须 sanitize）
- 禁止危险的 dangerouslySetInnerHTML（除非严格 sanitize）

### D. 依赖与供应链

- 运行依赖审计并给出修复建议（优先修高危）
- 对易引入 Node-only 的包，确保不被打进浏览器 bundle

## 产出

- 一份“安全风险清单”（按 P0/P1/P2 分级）
- 一份“最小修复补丁”（聚焦：密钥、边界、API 防护）

