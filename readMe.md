# AI-Tolls（本地 RAG + 流式渲染聊天应用）

一个基于 Next.js 的本地 RAG 应用，聚焦“降低大模型幻觉、提升交互体验”。项目实现了安全可控的流式 Markdown 渲染、Prism 实时高亮、Mermaid 图表、KaTeX 公式，以及代码复制能力，并保持严格的安全策略（rehype-sanitize、CSP）。

## 技术栈

- Next.js 14 + React 18 + TypeScript
- React Markdown 生态：remark-gfm、remark-math、rehype-katex、rehype-sanitize
- 语法高亮：react-syntax-highlighter（Prism Light 按需 + 预加载）
- 图表：Mermaid（动态引入，securityLevel: strict）
- 向量检索与 RAG：LangChain + OpenAI（见 RAG 服务）
- 样式与图标：Tailwind（merge 工具）、lucide-react

## 目录结构（节选）

```bash
src/
├─ app/
│  ├─ layout.tsx          # 全局样式（含 KaTeX CSS）
│  └─ page.tsx            # 入口页面
├─ components/
│  └─ features/
│     ├─ ChatWindow.tsx   # 流式缓冲、增量更新、消息列表控制
│     └─ MessageItem.tsx  # Markdown 渲染、Prism 高亮、Mermaid、复制
├─ services/
│  └─ rag/
│     └─ RAG.ts           # RAG 相关逻辑（嵌入、知识检索、工具调用等）
└─ types/
   └─ react-syntax-highlighter.d.ts # ESM 按需模块的类型垫片
```

关键文件参考：

- [MessageItem.tsx](file:///e:/AI项目实践/Ai-Tolls/src/components/features/MessageItem.tsx)
- [ChatWindow.tsx](file:///e:/AI项目实践/Ai-Tolls/src/components/features/ChatWindow.tsx)
- [RAG.ts](file:///e:/AI项目实践/Ai-Tolls/src/services/rag/RAG.ts)
- [next.config.js](file:///e:/AI项目实践/Ai-Tolls/next.config.js)
- [tsconfig.json](file:///e:/AI项目实践/Ai-Tolls/tsconfig.json)

## 核心功能
- Rag 流程
 - 内容解析,向量化
 - LLM 请求先先进行内容,向量化,进行相似度检索
 - 整合检索内容,和问答内容输出

- 流式 Markdown 渲染
  - 在流式输出过程中持续解析 Markdown，文本/列表/段落即时呈现。
  - 对未闭合的代码围栏进行“渲染期补齐”，让代码块在生成中也能被解析为块级，减少错位。

- 代码语法高亮（Prism）
  - 采用 PrismLight 以减小包体，语言模块按需加载。
  - 为解决“首帧未高亮”与“闪动”，预加载常用语言（typescript、javascript、json、markdown、bash、python、markup），并共享注册缓存，保证首次出现即高亮。
  - 在动态语言未就绪时以“markup”先行着色，语言就绪后平滑切换，组件不重建，减少闪动。

- 复制能力
  - 优先使用 Clipboard API；不支持时回退 document.execCommand('copy')。
  - 复制按钮置于 pre 容器层，避免 code 标签内布局抖动。

- 数学公式与图表
  - remark-math + rehype-katex 渲染 LaTeX；在 layout.tsx 引入 KaTeX CSS。
  - Mermaid 采用动态 import，securityLevel 设为 strict，防止 XSS。

- 安全与合规
  - rehype-sanitize 基于 defaultSchema 扩展 KaTeX 必要 class 白名单。
  - CSP 由 Next headers 注入，限制 script/style/img/connect/font 等源，阻断潜在注入。

## 关键设计与难点

- 流式阶段的“实时高亮”与“闪动”治理
  - 难点：语言模块是异步按需加载；若在首次渲染时未就绪，会出现“纯文本→高亮”的闪变。
  - 方案：组件挂载预热 PrismLight+主题；常用语言启动即预加载并注册到共享缓存；代码块初次渲染即使用高亮组件（先以 markup），待目标语言就绪后仅切换 language，避免组件重建。

- 安全渲染
  - Markdown 渲染严格不启用 rehypeRaw；Mermaid 在安全模式（strict）下渲染；链接与图片做协议过滤/白名单校验；配合 CSP 头进一步收敛风险面。

- 流式性能与体验
  - ChatWindow 实现缓冲与节流（例如 50–100ms 间隔或 ≥N 字符批量），减少大规模重绘与解析；对围栏做渲染期补齐，避免“半个代码块”导致的破损布局。



## 开发与运行

- 安装依赖
  - Node 18+
  - npm i

- 本地运行
  - npm run dev
  - 打开 http://localhost:3000

- 代码规范
  - TypeScript 严格模式；Next + React 18；ESLint 核心 Web Vitals。

## 常见问题

- 首帧未高亮/抖动
  - 已通过预热 PrismLight 与常用语言尽量消除；非常用语言首次出现仍需按需加载，短暂切换不可避免。可将常用语言列表扩展至你场景常见的语言。

- TS 提示找不到语言模块
  - 已在 src/types/react-syntax-highlighter.d.ts 增加 ESM 模块声明；如新增语言模块，请同步更新声明或使用现有模块别名（tsx→typescript、jsx→javascript）。

## 后续规划

- RAG 侧：引入本地向量库持久化（SQLite/PG + pgvector），支持多文档管理与检索评估；补充工具调用链路的可观测性。
- 高亮侧：按需扩展预加载语言；评估 Shiki/StarryNight 等替代方案（服务端预高亮）。
- 渲染侧：将围栏/段落解析下沉到 Web Worker，进一步平滑 UI。
- 安全侧：结合自定义 URL 校验与 CSP 报警，形成全链路防护。

---

项目演示与说明将持续更新。欢迎提出建议与问题。
