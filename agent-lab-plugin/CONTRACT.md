# Agent 实验室 · 内部实现契约（v1）

本文件是并行开发的唯一接口约定。所有文件都是**纯 JavaScript**，最终由 `build.mjs`
按文件名顺序拼进同一个 Client factory 作用域，因此：

- 不用 `import` / `export` / JSX / TypeScript / Node API。
- React 由外层提供：文件里可直接用 `React`、`e`（= `React.createElement`），以及
  `useState`、`useEffect`、`useMemo`、`useRef`、`useCallback` 这些解构名。
- 跨文件函数优先用 `function` 声明（会提升）；常量用 `const`，且要保证被引用前已定义。
- 不直接访问 `document` / `window`（除 `globalThis.localStorage` 的受保护访问，
  已封装在 core 里）。不读其他插件 DOM。
- 所有用户可见文案为中文；代码注释中文。meta 的 zh/en locale 由 Lead 维护。

## 目标形态

DSH Web UI 左侧栏一个独立入口「Agent 实验室」，点击打开一个整页插件：

1. **体验**：三栏布局 —— 左：会话列表；中：模拟 TUI 终端；右：检查器
   （流转 / 上下文 / 记忆）。输入一句话，实时看到它如何经过
   上下文组装 → LLM → 工具调用 → 记忆 → 输出。
2. **源码**：浏览本插件真实运行的源码（构建时内嵌为 `SOURCES`）。
3. **原理**：图文讲解最小 agent 循环、上下文与压缩、记忆、会话、工具协议，
   以及如何替换成真实 LLM。

## 文件与归属

| 文件 | 角色 | 归属 |
|---|---|---|
| `src/00-core.js` | 常量、token 估算、纯工具函数 | engine-dev |
| `src/10-engine.js` | 会话/记忆/上下文/压缩/持久化/`createLab` | engine-dev |
| `src/20-tools.js` | 工具注册表与四个工具实现 | engine-dev |
| `src/30-llm.js` | 规则驱动的模拟 LLM（计划 + 流式输出） | engine-dev |
| `src/40-ui-kit.js` | 全局 CSS、图标、按钮等 UI 原语 | Lead |
| `src/50-tui.js` | TUI 终端组件 | Lead |
| `src/60-inspector.js` | 检查器三个页签 | Lead |
| `src/70-docs.js` | 原理页组件与内容 | docs-dev |
| `src/80-source.js` | 源码浏览器与高亮 | docs-dev |
| `src/90-page.js` | 页面外壳、顶部页签、会话栏、组装 | Lead |
| `src/95-apply.js` | 注册 slot / sidebar | Lead |
| `test/engine.test.mjs` | 引擎无头测试 | engine-dev |
| `README.md` | 使用与架构说明 | docs-dev（Lead 终审） |

**不要修改不属于自己的文件。** 需要改契约时先告知 Lead。

## 引擎 API（engine-dev 必须实现；Lead／UI 按此消费）

### 常量与纯函数（00-core.js）

```js
const LAB_BUDGET = 420;            // 上下文 token 预算（估算值）
const LAB_RECENT_KEEP = 4;         // 压缩时保留的最近消息条数
const LAB_MAX_STEPS = 4;           // 单轮最多模型步数
const LAB_STORAGE_KEY = 'dsh.agent-lab.v1';
const LAB_SYSTEM_PROMPT = '……';    // 迷你 agent 的 system prompt（中文，说明自己是教学用模拟模型）

function estimateTokens(text) {}   // 估算：CJK 约 1 token/字，其他约 4 字符/token，向上取整
function fmtClock(ts) {}           // HH:MM:SS
function fmtTime(ts) {}            // 2026-11-07 13:02
function truncate(text, n) {}
function uid(prefix) {}            // 可选注入 id 生成器
```

### `createLab(options)`（10-engine.js）

```js
// options（全部可选）：
// storage: { getItem(k), setItem(k,v) }  默认受保护的 localStorage，失败则内存态
// sleep: (ms) => Promise<void>           默认 setTimeout；测试注入 no-op
// now: () => number                      默认 Date.now
// id: (prefix) => string                 默认 uid
// pace: 'fast' | 'normal' | 'slow'       默认 'normal'
// budget?: number                        默认 LAB_BUDGET
```

返回对象：

```js
lab.snapshot()            // 见下方 Snapshot；每次返回新对象，可安全交给 React
lab.onEvent(fn)           // 订阅事件，返回取消函数
lab.submit(text)          // Promise<void>；空串/busy 时直接 resolve；内部异常转为错误事件
lab.compact()             // 手动压缩；无消息时给出 info 行
lab.newSession()          // 新建并切换；busy 时返回 false
lab.switchSession(id)     // boolean
lab.deleteSession(id)     // 删除；删当前会话时自动切到下一个/新建
lab.clearMemory()
lab.deleteMemory(id)
lab.resetAll()            // 清空本地存储并重建
lab.setPace(pace)         // 'fast' | 'normal' | 'slow'
lab.dispose()             // 取消进行中的 turn、退订；之后 snapshot 仍可用
```

### 事件（每次状态变化至少发一个；UI 收到后重取 `snapshot()`）

```js
{ type: 'turn_start', turnId }
{ type: 'stage' }                 // 某阶段状态变化
{ type: 'context' }               // 上下文重新组装
{ type: 'token', text }           // 流式输出增量（用于触发重渲染；以 snapshot 为准）
{ type: 'line' }                  // transcript 新增/更新
{ type: 'message' }
{ type: 'tool_call', name }
{ type: 'tool_result', name, ok }
{ type: 'memory' }
{ type: 'compression' }
{ type: 'turn_end', turnId }
{ type: 'error', message }
{ type: 'state' }                 // 会话切换/删除/清空等
```

### Snapshot

```js
{
  busy: boolean,
  pace: 'fast'|'normal'|'slow',
  activeId: string,
  sessions: [{
    id, title, createdAt, updatedAt,
    messageCount, tokens, compressions, turns,
  }],
  messages: [{
    id, role: 'user'|'assistant'|'tool'|'system',
    kind?: 'tool_call'|'tool_result'|'summary'|'memory'|'final',
    content: string, tokens: number, at: number,
    toolName?: string,
  }],
  transcript: [{
    id,
    kind: 'banner'|'user'|'meta'|'llm'|'tool'|'toolresult'|'memory'|'compress'|'error'|'agent'|'info',
    text: string,                  // 纯文本；TUI 直接渲染
    at: number,
    streaming?: true,              // 正在流式输出的最后一行
  }],
  memory: [{
    id, key, value, source, sessionId, createdAt, updatedAt,
  }],
  context: {
    limit, used,
    segments: [{ id:'system'|'summary'|'memory'|'recent'|'input', label, tokens }],
    hits: [{ id, key, value }],    // 本轮自动召回的长记忆
    summary: string|null,
    messageCount: number,
  },
  turn: null | {
    id, input,
    status: 'running'|'done'|'error',
    startedAt, endedAt,
    stages: [{
      id, kind: 'input'|'context'|'compress'|'model'|'tool'|'memory'|'output',
      title: string,
      meta: string,                // 一行摘要，例如 "8 条消息 · 186 tok"
      status: 'active'|'done'|'error',
      detail: any,                 // 可 JSON 序列化的细节，检查器展开显示
      at: number,
    }],
  },
  streaming: null | { lineId: string, text: string },
  stats: {
    turns, toolCalls, compressions, tokensSaved, totalTokens,
  },
  lastInput: string,
}
```

### 行为规范

- **上下文组装**（每次模型调用前）：
  `system`（`LAB_SYSTEM_PROMPT`）+
  `summary`（历史摘要，若有）+
  `memory`（按用户输入关键词召回最多 3 条长记忆，作为 system 消息注入）+
  `recent`（当前会话消息，压缩后新旧）+
  `input`（本轮用户输入）。
  同时更新 `context.segments/used/hits`，并 emit `context`。
- **压缩**：模型调用前若 `used > limit * 0.9`，把除最近 `LAB_RECENT_KEEP` 条之外的
  消息折叠进 `summary`（累计式、抽取式：保留用户意图、工具名与结果要点）。
  记录压缩次数，`stats.tokensSaved += before - after`，emit `compression`，
  transcript 加一条 `compress` 行，turn 加一个 `compress` stage。
  手动 `compact()` 无条件执行（消息不足 3 条时只加 info 行）。
- **一轮 turn 的 stages**（按发生顺序）：`input` → `context` →（`compress`）→
  `model`（第 1 步）→ `tool`（每次调用一个）→ `model`（第 2 步）… → `output`。
  `model` stage 的 `detail` 要包含 `{ step, messages: 发给模型的消息数组, toolSchemas, response }`，
  其中 `response` 为 `{ type:'tool_call', name, args }` 或 `{ type:'final', text }`。
- **max steps**：超过 `LAB_MAX_STEPS` 仍未收敛 → 错误行 + turn error。
- **transcript**：每轮至少产生 user、llm、tool(可选)、agent、meta 行；工具调用行形如
  `⚙ calculator {"expression":"(12+30)*3"}`，工具结果行 `← 126`；
  记忆写入 `◈ 记忆已保存 · 项目代号 = Orion`；压缩 `⇣ 上下文已压缩 · 186 → 92 tok`。
- **多步**：`(12+30)*3 然后记住结果` 这类输入应产生两次工具调用再回答，展示 agent loop。
- **持久化**：turn 结束、记忆变化、会话操作后写 storage；最多 20 个会话，
  每会话消息上限 120 条（超出丢最旧）；transcript 每会话上限 200 行。
- **首次运行**：自动建一个会话，transcript 首行 banner：
  `Agent Lab v0.1 · 规则驱动的迷你 Agent（离线可用） · 输入 /help 查看命令`。
- **/help、/compact、/new、/memory、/clear** 等斜杠命令也可由 UI 直接映射到 API；
  引擎自身不要求解析斜杠命令，但 `submit('/compact')` 之类可由 Lead 在 UI 处理。

### 模拟 LLM 必须覆盖的意图（30-llm.js）

规则驱动、可复现、不联网。至少覆盖：

1. 打招呼 / 自我介绍（简短说明自己是教学用模拟模型）。
2. `帮助`、`/help`、`你能做什么` → 能力清单 + 可试示例。
3. 算术表达式（含 `+ - * / % ^ ( )`）→ 调 `calculator`；若同时出现
   `记住/记下/保存`，在计算后再调 `memory_write` 存结果。
4. `几点/时间/日期` → 调 `clock`；可链式 `记住`。
5. `记住/记一下/记下/保存 X`（支持 `我的X是Y`、`记住 X = Y`、`记住：X`）
   → 调 `memory_write`，回答已保存。
6. `我的X是什么`、`你还记得`、`回忆`、`记忆` → 调 `memory_search`，基于结果回答；
   查不到时明确说没有。
7. `压缩/compact/总结上下文` → 由 UI 触发 compact；模型回答压缩前后对比（可用
   turn 里的 compression 数据；若 engine 实现为模型先回答再压缩也可，保持可解释）。
8. `工具/有哪些工具` → 列出四个工具及作用。
9. `你是谁/怎么工作/原理` → 用 3–5 句解释 agent 循环与自己的定位。
10. `忘掉/清空记忆` → 提示在「记忆」面板可清空（不真正删除，避免误操作）。
11. 兜底：承认自己是规则模型，复述输入，结合记忆中的事实回应，并给 2 个可试命令。
12. 模型回答用中文、口语、简洁（一般 ≤ 120 字），可带入 token/步骤等教学解释。

流式：最终回答按字符/词组分块输出，`pace` 控制间隔（fast≈3ms、normal≈14ms、slow≈30ms），
总时长上限约 1.5s；工具调用步骤不用流式文本。

### 工具注册表（20-tools.js）

```js
const LAB_TOOLS = [{
  name: 'calculator',
  description: '安全计算四则/幂/括号表达式',
  parameters: { type:'object', properties:{ expression:{type:'string'} }, required:['expression'] },
  run(args, ctx) -> { ok: boolean, result: any, display: string },
}, ...];
```

四个工具：`calculator`、`clock`、`memory_write`、`memory_search`。
`run` 可以是 async。`ctx` 提供 `{ now, memory, sessionId, writeMemory, searchMemory }`。
错误不抛异常，返回 `{ ok:false, result:{error}, display }`。

### 测试（test/engine.test.mjs）

用 Node 跑：`node test/engine.test.mjs`。因为源文件是普通脚本，用 `node:vm`：
拼接 `00-core.js + 10-engine.js + 20-tools.js + 30-llm.js`，追加
`;globalThis.__LAB__ = { createLab, estimateTokens, LAB_TOOLS, LAB_BUDGET };`，
在 sandbox 里执行（sandbox 需提供 `console`、`setTimeout`、`clearTimeout`、`Date`、`JSON`、
`Math`、`globalThis`）。`createLab({ sleep: async () => {}, storage: mockStorage() })`
让测试瞬间完成。需覆盖：

- token 估算与工具 schema 存在。
- 算术：`算一下 (12+30)*3` → 出现 tool_call/工具结果/最终含 `126`；`messages` 含 tool 角色。
- 记忆：`记住 我的项目代号是 Orion` 后，新会话里问 `我的项目代号是什么` → 回答含 Orion。
- 压缩：连续提交 ≥ 10 轮 → `stats.compressions > 0`、`context.summary` 非空、
  `context.used <= context.limit`、transcript 有 `compress` 行。
- 会话：newSession 后 messages 隔离、memory 共享；switch/delete 正确。
- 持久化：dispose 后用同一 storage 重建 → memory 与 sessions 仍在。
- 手动 compact。
- 失败工具：`计算 1/0` 之类 → 工具返回 ok:false 或明确错误，最终回答提及失败。

测试输出 `PASS` / `FAIL` 行，失败以非零退出码结束。

## 源码浏览（docs-dev 消费）

`build.mjs` 会在 factory 顶部注入：

```js
const SOURCES = [{ id:'10-engine', name:'10-engine.js', role:'…', code:'…' }, ...];
```

`70-docs.js`、`80-source.js` 里可直接读 `SOURCES`（做 `typeof SOURCES === 'undefined'` 保护）。
源码页需：左侧文件列表（名称 + 一行角色说明），右侧代码区（行号、等宽、深浅色都清晰、
复制按钮、横向滚动），并标注「这就是当前页面正在运行的代码」。

## UI 约定（Lead 负责 40/50/60/90；docs-dev 只需遵守配色与命名）

- 页面根 class：`al-root`；所有自写 class 加前缀：Lead `al-`，docs `al-doc-` / `al-src-`。
- 主题：优先用 `--dsw-alias-*` tokens（见 Theme inspect）；TUI 终端是「艺术品」，
  允许固定的深色配色（`#0b0e14` 底、`#7ee787` 绿、`#79c0ff` 蓝、`#d2a8ff` 紫、
  `#ffa657` 橙、`#ff7b72` 红、`#8b949e` 灰），正文等 UI 用主题 token。
- 页面顶部用 `padding-top: calc(var(--dsh-frame-top-clearance, 0px) + 24px)` 避开标题栏。
- 不使用 `document.body` 追加、不替换 app root、不读写其他插件 DOM。
- 组件用函数组件 + hooks；资源（timer/listener）在 `useEffect` 清理。
- docs 页若需要样式，组件内渲染 `<style dangerouslySetInnerHTML={{__html: CSS}} />` 即可。
