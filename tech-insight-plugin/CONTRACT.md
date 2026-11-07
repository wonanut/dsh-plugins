# 技术洞察插件 · 实现契约（v1）

本文件是 Host 半侧与 Client 半侧之间的唯一接口约定。**不要修改本文件、index.js、lib/、package.json、cordis.patch.yml、locale/、icon.svg**（这些由 Lead 负责）。Client 半侧的实现范围是 `src/*.js` 与生成的 `client.js`。

## 1. 产品目标

在 DSH Web 左侧导航新增「技术洞察」入口。用户输入一个技术名称（可加关注点与深度），点击「一键洞察」后：

1. Host 通过 DSH 的 `web` 服务联网检索并抓取正文；
2. Host 调用当前 DSH 默认模型，生成结构化技术洞察报告；
3. 报告包含固定五部分：**技术介绍、技术关键难点、技术使用场景、业界使用状态、相关参考**；
4. 报告自动归档到本地（可删除、可搜索），并可**多次补充修订**（保留历史版本、可回滚、可手动编辑分节、可导出 Markdown）。

中文 UI，视觉风格贴合 DSH 宿主（浅色/深色主题自动适配），不是独立网页、不使用 iframe。

## 2. 文件与加载

```
tech-insight-plugin/
  package.json          （Lead，已就绪）
  cordis.patch.yml      （Lead）
  index.js              （Lead，Host）
  lib/insight.js        （Lead，纯逻辑 + service 工厂）
  client.js             （由 node build.mjs 生成，你只改 src/ 后重新生成）
  build.mjs             （Lead，已就绪：拼接 src/*.js 为 client.js）
  src/
    00-core.js          常量 / 存储 / 工具函数 / 网络请求封装
    10-ui.js            全局 CSS + UI 原语（Icon、Btn、Modal、Toast、RichText 等）
    20-generate.js      一键洞察输入区 + 生成进度视图
    30-report.js        报告视图 + 修订对话框 + 修订历史 + 手动编辑
    40-archive.js       归档列表（左栏）
    50-page.js          页面外壳与状态编排（Page 组件）
    90-apply.js         左侧边栏 + main 面板的 slot 注册（apply 函数）
```

- 构建命令：`node build.mjs`（在插件根目录）
- 语法检查：`node build.mjs --check`
- 生成后的 `client.js` 是一个 `window.__ModuleLoader__.load({ id: '@wonanut/dsh-tech-insight', factory(require){...} })` 模块；`src/*.js` 会被原样拼进 factory，因此：
  - 可用的全局变量只有 `React`、`e`（React.createElement）、`useState/useEffect/useMemo/useRef/useCallback`；
  - **不要写 import/export**，不要依赖其他 npm 包，不要 require Harness Client 包；
  - 各文件共享同一作用域，函数名用 `ti` 前缀或足够独特，避免重名。

## 3. Host HTTP API（同源，路径固定）

所有接口使用相对路径请求：`fetch('/tech-insight/...', { credentials: 'same-origin', cache: 'no-store' })`。

**后台任务模型（重要）**：洞察与修订在 Host 后台执行，HTTP 只负责启动/轮询/取消。页面切换、组件卸载都不会中断任务；重新挂载时通过 `GET /tech-insight/job`（不带 id）恢复运行中的任务，或对已完成任务补归档。

### 3.1 `GET /tech-insight/status`

```json
{
  "ok": true,
  "ready": true,
  "provider": "deepseek-account",
  "model": "deepseek-flash",
  "modelName": "DeepSeek-V4-Flash",
  "webReady": true,
  "fetchReady": true,
  "version": "1.0.0",
  "message": ""
}
```

- `ready=false` 时 `message` 给出可操作的原因（如未选择模型、未登录）。
- UI 打开时请求一次；展示「模型 / 联网检索」两个状态 chip。请求失败要静默降级为“状态未知”，不能阻塞页面。

### 3.2 `POST /tech-insight/insight`（启动后台任务，立即返回）

返回 `{ "ok": true, "job": { "id": "ti-job-…", "status": "running", … } }`。生成任务在 Host 独立执行，与请求连接无关。

请求体：

```json
{ "topic": "向量数据库", "focus": "可选，如：工程落地与选型", "depth": "quick|standard|deep" }
```

响应：`text/event-stream`，每帧 `event: <type>\ndata: <json>\n\n`。事件类型：

| event | data 形状 | 说明 |
|---|---|---|
| `stage` | `{ "stage": "search"\|"read"\|"synthesize", "label": "正在检索资料…", "progress": 0.1 }` | 阶段进度，`progress` 0–1 |
| `queries` | `{ "queries": ["..."] }` | 实际使用的检索词 |
| `sources` | `{ "sources": [{"title":"","url":"","snippet":"","site":""}] }` | 已发现来源（在 read 阶段可能再次出现，追加即可，按 url 去重） |
| `report` | `{ "report": {Report} }` | 最终报告，随后服务端结束流 |
| `error` | `{ "code": "WEB_UNAVAILABLE", "message": "可读错误" }` | 失败，随后结束流 |

注意：错误也可能以普通 JSON 返回（HTTP 非 200，`{ok:false,error:{code,message}}`）。Client 必须先看 `response.ok` 与 `content-type`；不是 `text/event-stream` 时按 JSON 错误解析。

### 3.3 `POST /tech-insight/refine`（启动后台修订任务，立即返回）

返回结构同上。

请求体：

```json
{ "report": {Report}, "instruction": "补充近一年国内厂商的落地案例", "useWeb": true }
```

事件与 insight 相同（`stage` / `queries` / `sources` / `report` / `error`），最终 `report` 为修订后的完整报告（`id` 不变，`revision` 字段递增，`updatedAt` 更新）。`useWeb=false` 时 Host 不联网，只基于现有报告与指令改写。

### 3.4 任务轮询与取消

- `GET /tech-insight/job?id=<jobId>`：返回 `{ ok:true, job }`；省略 `id` 时返回最近一个任务（优先运行中）。
  运行中 `job.report` 为 `null`，完成后携带完整 Report；`job.status` ∈ `running | done | error | cancelled`。
- `POST /tech-insight/job/cancel`，body `{ "id": "<jobId>" }`：取消运行中的任务。
- 客户端每 ~900ms 轮询一次；卸载时只停止轮询，不取消任务。

### 3.5 Report 对象（权威结构）

```json
{
  "id": "ti-lx3k9a-4f2",
  "revision": 1,
  "topic": "向量数据库",
  "title": "向量数据库技术洞察",
  "oneLiner": "一句话结论（40–80 字）",
  "sections": [
    { "key": "introduction", "title": "技术介绍", "body": "…markdown-lite…" },
    { "key": "solution", "title": "技术方案设计", "body": "## 总体架构 / ## 核心流程 / ## 关键技术选型 / ## 关键实现与参数 / ## 失败处理与可靠性 / ## 落地步骤" },
    { "key": "difficulties", "title": "技术关键难点", "body": "…" },
    { "key": "scenarios", "title": "技术使用场景", "body": "…" },
    { "key": "industry", "title": "业界使用状态", "body": "…" }
  ],
  "references": [
    { "title": "来源标题", "url": "https://…", "note": "该来源支撑的要点" }
  ],
  "visuals": {
    "architecture": { "title": "…", "layers": [ { "name": "层", "items": ["条目"] } ] },
    "difficulty": { "title": "…", "items": [ { "name": "难点", "score": 0, "reason": "…" } ] },
    "matrix": { "title": "…", "xLabel": "…", "yLabel": "…", "items": [ { "name": "场景", "x": 0, "y": 0 } ] },
    "timeline": { "title": "…", "items": [ { "time": "2024", "title": "事件", "detail": "…" } ] }
  },
  "queries": ["检索词1", "检索词2"],
  "sourceCount": 12,
  "model": "deepseek-flash",
  "createdAt": "2026-11-07T09:00:00.000Z",
  "updatedAt": "2026-11-07T09:00:00.000Z",
  "generator": "tech-insight/1.0"
}
```

- `sections` 按上述顺序、**key 固定**；Client 渲染时按 key 匹配图标与配色，缺失的分节用空 body 兜底。
- `visuals` 可为 `null`（旧报告/模型未产出时），四块图各自独立校验，不合法就丢弃该块。分节与图对应：solution→architecture、difficulties→difficulty、scenarios→matrix、industry→timeline，前端用内联 SVG 渲染，**不执行模型产出的 HTML/SVG**。
- `body` 是 markdown-lite：支持 `## ` 小标题、`- ` 列表、`1. ` 有序列表、`**粗体**`、`` `行内代码` ``、`[文字](https://url)`。Client 自己实现安全渲染（不要 `dangerouslySetInnerHTML`）。
- `references` 的 `url` 一律 `http(s)`。

## 4. Client 本地存储（localStorage）

Key：`dsh.tech-insight.v1`

```json
{
  "version": 1,
  "reports": [ { "report": {Report}, "archivedAt": "ISO", "revisions": [ { "rev": 1, "at": "ISO", "note": "初始洞察", "report": {Report} } ], "currentRev": 1 } ],
  "draft": { "topic": "", "focus": "", "depth": "standard" },
  "prefs": { "depth": "standard" },
  "selectedId": "ti-…"
}
```

- 每次 `readStore()` 必须深合并默认值并容错（JSON 损坏时返回默认值，不能抛错）。
- 写入失败（配额）要 Toast 提示，不能静默。
- 生成成功 → 以 `report` 入归档，`revisions=[rev1]`，`currentRev=1`，`note='初始洞察'`。
- 修订成功 → 追加 revision（`rev=currentRev+1`），`report` 替换为最新版本，`archivedAt` 不变。
- 手动编辑分节 → 同样追加一个 revision，note 形如 `手动编辑 · 技术介绍`。
- 回滚 → 把历史版本作为**新 revision** 追加（note `回滚到 v{n}`），不破坏历史。
- 删除归档 → 删除该条；若正选中则清空选择。

## 5. 交互与状态规格

页面（main 面板）建议布局：

```
┌ Header：logo + 「技术洞察」+ 副标题           [状态 chip][刷新状态][新建洞察] ┐
├ 左栏 300px：搜索框 + 归档列表（标题/时间/来源数/版本数）  │ 右栏：主内容             ┤
└                                                          └──────────────────────┘
```

主内容有四种状态：

1. **空态 / 新建**：大输入卡（技术名称 textarea 1–2 行）、可选「关注点」输入、深度三选一（快速≈2 条检索/标准≈4/深度≈6，用 chip 表示）、主按钮「一键洞察」。下方可给 4 个示例技术 chip（如 向量数据库、RISC-V、智能体记忆、液冷数据中心）点击填充。
2. **生成中**：显示当前阶段（检索资料 → 抓取正文 → 模型分析 → 整理报告）的步骤条/进度、实时来源列表（标题+站点，最多 12 条）、已用时；提供「取消」（AbortController）与「转到后台」可选（不做也行）。
3. **报告视图**：标题 + oneLiner + 元信息（模型、生成时间、来源数、当前版本）；操作按钮：`补充修订`、`手动编辑`、`复制 Markdown`、`导出 .md`、`删除`；正文为 4 个分节卡片（技术介绍 / 关键难点 / 使用场景 / 业界状态），每节可折叠、可进入手动编辑；末尾「相关参考」按序列表，外链新开标签；修订历史可切换为独立视图/侧栏（tab：报告 / 修订历史）。
4. **错误态**：可读错误信息 + `重试`（保留输入），例如联网检索不可用、模型未选择。

关键交互：

- 「一键洞察」在 topic 为空时禁用；生成期间禁止重复提交。
- 生成结束自动选中新报告；若 SSE 失败，保留输入并提示。
- 「补充修订」弹窗：修订指令 textarea（必填）+ 「联网检索新资料」开关（默认开）+ 提交；提交后复用生成中视图的进度与来源展示，完成后追加 revision 并 Toast。
- 「手动编辑」：分节卡片内切换为 textarea，保存/取消；也可编辑标题与 oneLiner（可选，若做则同样记录 revision）。
- 「修订历史」：按 rev 倒序显示时间 + note + 按钮「查看」「回滚到此版本」；查看为只读预览（可简单弹窗）。
- 「导出 .md」：客户端根据 Report 生成 Markdown，`Blob` + 临时 `<a download>` 触发下载，文件名 `技术洞察-{topic}-{YYYYMMDD}.md`。
- 「复制 Markdown」：`navigator.clipboard.writeText`，失败时 Toast 提示。
- 归档列表支持按标题/主题过滤，显示 `v{currentRev}`、来源数、日期；选中高亮。
- 所有异步错误都必须可见（Toast 或错误卡），不能只 `console.error`。

## 6. 样式与宿主一致性（硬性）

- 所有颜色/背景/边框用主题 token：`--dsw-alias-bg-base`、`--dsw-alias-bg-layer-1`、`--dsw-alias-bg-layer-2`、`--dsw-alias-bg-overlay`、`--dsw-alias-border-l1`、`--dsw-alias-border-l2`、`--dsw-alias-brand-primary`、`--dsw-alias-label-primary`、`--dsw-alias-label-secondary`、`--dsw-alias-state-error-primary`、`--dsw-alias-state-success-primary`、`--dsw-alias-state-warn-primary`、`--dsw-alias-state-idle-primary`、`--dsw-specific-sidebar-fill`。
- 品牌强调色可用自有色（如 `#0EA5E9`），但必须用 `color-mix(...)` 与 token 结合，且深色下可读；不要写死深色/浅色两套。
- CSS 类名统一前缀 `ti-`，全局样式用一个 `<style>` React 元素渲染在页面根部（卸载自动移除）。不要写入 `document.body`，不要读取/覆盖宿主 DOM 或样式。
- 按钮、输入框、弹窗要自己实现（不要 import Harness Client 包）；弹窗需支持 Esc 关闭、遮罩点击关闭、`role="dialog"`、焦点进入；按钮需有 `disabled` 态与 `:focus-visible` 样式。
- 页面根节点：`width:100%; height:100%; min-height:100%; overflow:hidden;`，内部滚动区域自行 `overflow:auto`。顶部为主内容留出 `--dsh-frame-top-clearance` 的内边距（参考 agent-lab-plugin 的 `.al-inner`）。
- 空态/加载用骨架或占位，不要布局跳动。

## 7. Slot 注册（90-apply.js，照抄并改 id）

```js
function TiPanelIcon(props) { /* 16px 线性图标，跟随 currentColor */ }

function apply(ctx) {
  ctx.slots.inject('main', () =>
    ctx.slots.register({ name: 'main', key: 'tech-insight' }, Page),
  );
  ctx.slots.inject('sidebar.panellist', () =>
    ctx.slots.register(
      { name: 'sidebar.panellist', id: 'tech-insight', order: 7, label: () => '技术洞察' },
      TiPanelIcon,
    ),
  );
}
```

- 左侧图标即 `TiPanelIcon`（16×16 线性 SVG，不要复用宿主图标）。
- `Page` 组件不需要 slot props；它自己请求 `/tech-insight/status`。

## 8. 参考实现（务必先读，照其模式写）

- `汇报拷打室-plugin/src/30-page.js` 末尾的 `apply()`：sidebar.panellist + main 注册模式。
- `汇报拷打室-plugin/src/10-ui.js`：整套 `rr-` 前缀 CSS、首页头部、tabs、列表、弹窗、Toast 的宿主风格参考。
- `agent-lab-plugin/src/95-apply.js`：sidebar 图标 + main 面板注册。
- `agent-lab-plugin/src/40-ui-kit.js`：token 变量、按钮/图标按钮/chip/卡片样式参考。
- `agent-lab-plugin/src/45-real-client.js` 开头：浏览器端 fetch Host 路由 + 错误处理的写法（SSE 部分需另写）。
- `agent-lab-plugin/build.mjs`：构建产物格式。

## 9. 验收标准（Lead 会检查）

1. `node build.mjs` 成功，`client.js` 语法正确。
2. 页面在浅色/深色下均使用 token，无写死的背景/文字色。
3. 无 `import`/`require` 其他包、无 `dangerouslySetInnerHTML`、无 `document.body` 注入。
4. 完整实现第 3–5 节的接口与交互；`fetch` 路径与 SSE 事件名严格一致。
5. 首次打开请求 status；一键洞察、取消、修订、手动编辑、导出、删除、回滚、搜索归档均可用。
6. 代码结构清晰、注释为中文、无调试残留（console.log 可留少量前缀 `[tech-insight]` 的异常日志）。
