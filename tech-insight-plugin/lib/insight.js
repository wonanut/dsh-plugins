/**
 * 技术洞察 · Host 纯逻辑与 service 工厂
 *
 * 这个模块不直接依赖 Cordis：Host 路由把 ctx 上解析出来的 `web` / `llm` /
 * 模型选择以依赖注入的方式交给 createInsightService，因此这里可以在 Node
 * 里单独测试（见 test/insight.test.mjs）。
 *
 * 数据流：
 *   检索词 → web.search 多路检索 → web.fetch 抓取正文 → 组装语料
 *   → llm 生成严格 JSON → 规范化成固定分节的 Report
 */

export const PLUGIN_VERSION = '1.0.0';
export const GENERATOR = 'tech-insight/1.0';

/** 报告的四个固定分节；顺序即渲染顺序。 */
export const SECTION_DEFS = [
  { key: 'introduction', title: '技术介绍' },
  { key: 'solution', title: '技术方案设计' },
  { key: 'difficulties', title: '技术关键难点' },
  { key: 'scenarios', title: '技术使用场景' },
  { key: 'industry', title: '业界使用状态' },
];

const DEPTHS = {
  /*
   * 两段式生成：
   * 1) plan：高推理强度梳理方案要点（输出很短，不会被截断）；
   * 2) report：关闭推理，把完整输出预算留给报告 JSON（推理与正文共用上限）。
   */
  quick: { queries: 3, maxResults: 5, fetchPages: 4, maxTokens: 5500, corpusChars: 32000, plan: false, planEffort: 'off', planTokens: 0 },
  standard: { queries: 6, maxResults: 6, fetchPages: 8, maxTokens: 9000, corpusChars: 62000, plan: true, planEffort: 'high', planTokens: 0 },
  deep: { queries: 8, maxResults: 8, fetchPages: 12, maxTokens: 12000, corpusChars: 92000, plan: true, planEffort: 'max', planTokens: 0 },
};

const REPORT_BODY_MAX = 24000;
const REFERENCE_MAX = 12;

/** 带错误码的业务错误，路由层把它翻译成 SSE error 事件。 */
export class InsightError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'InsightError';
    this.code = code;
  }
}

function clampText(value, max) {
  const text = value === null || value === undefined ? '' : String(value);
  return text.length > max ? text.slice(0, max) : text;
}

function asString(value, max = 4000) {
  if (typeof value === 'string') return clampText(value, max);
  if (Array.isArray(value)) return clampText(value.filter((item) => typeof item === 'string').join('\n'), max);
  return '';
}

function normalizeUrl(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!/^https?:\/\//i.test(raw)) return '';
  try {
    const url = new URL(raw);
    url.hash = '';
    return url.href.replace(/\/$/, '');
  } catch (error) {
    return '';
  }
}

function siteOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (error) {
    return '';
  }
}

/** 由技术主题生成检索词；深度决定条数。 */
export function buildQueries(topic, focus, depth, year) {
  const name = clampText(topic, 120).trim();
  if (!name) return [];
  const hint = clampText(focus, 120).trim();
  /* 以当前年份为主：检索词不写死年份，避免报告基准年漂移。 */
  const y = Number.isFinite(year) ? Math.trunc(year) : new Date().getFullYear();
  const first = hint ? `${name} ${hint}` : name;
  const quick = [
    `${first} 技术方案 架构 设计`,
    `${name} 技术原理 实现 原理`,
    `${name} 最佳实践 落地 案例 ${y}`,
  ];
  const standard = [
    `${first} 技术方案 架构设计`,
    `${name} 关键技术 选型 对比 优缺点`,
    `${name} 核心流程 实现 原理 数据结构`,
    `${name} 性能 调优 参数 容量 监控`,
    `${name} 使用场景 落地 案例`,
    `${name} 业界 现状 厂商 采用 ${y}`,
  ];
  const deep = [
    `${first} 技术方案 架构设计 演进`,
    `${name} 关键技术 选型 对比 优缺点 取舍`,
    `${name} 核心流程 实现 原理 数据结构 算法`,
    `${name} 性能 调优 参数 容量 监控 运维`,
    `${name} 高可用 可靠性 失败 降级 一致性`,
    `${name} 使用场景 落地 案例 最佳实践`,
    `${name} 业界 现状 厂商 采用 融资 ${y} 最新进展`,
    `${name} architecture design implementation trade-offs benchmark tuning`,
  ];
  return depth === 'quick' ? quick : depth === 'deep' ? deep : standard;
}

/** 修订模式下的检索词：围绕用户的补充要求。 */
export function buildRefineQueries(topic, instruction, depth, year) {
  const name = clampText(topic, 120).trim();
  const ask = clampText(instruction, 100).trim();
  if (!name) return [];
  const y = Number.isFinite(year) ? Math.trunc(year) : new Date().getFullYear();
  const base = [
    `${name} ${ask}`,
    `${name} ${ask} 架构 实现 参数`,
    `${name} 最新 进展 案例 ${y}`,
  ];
  if (depth === 'deep' || (depth !== 'quick' && ask.length > 16)) {
    base.push(`${name} ${ask} 厂商 数据 对比`);
    base.push(`${name} 最佳实践 调优 失败 处理`);
  }
  return base;
}

/** 把 WebSearchResult[] 合并成去重的来源列表。 */
export function mergeSearchResults(results, limit = 16) {
  const byUrl = new Map();
  const answers = [];
  for (const result of results) {
    if (!result || typeof result !== 'object') continue;
    if (typeof result.content === 'string' && result.content.trim()) answers.push(result.content.trim());
    for (const source of Array.isArray(result.sources) ? result.sources : []) {
      if (!source || typeof source !== 'object') continue;
      const url = normalizeUrl(source.url);
      if (!url) continue;
      const snippet = clampText(source.snippet || source.summary || '', 600);
      const existing = byUrl.get(url);
      if (existing) {
        if (!existing.title && source.title) existing.title = clampText(source.title, 300);
        if (!existing.snippet && snippet) existing.snippet = snippet;
        continue;
      }
      byUrl.set(url, {
        url,
        title: clampText(source.title || siteOf(url), 300),
        snippet,
        summary: clampText(source.summary || '', 1200),
        publishedAt: clampText(source.publishedAt || '', 40),
        site: siteOf(url),
      });
    }
  }
  return { sources: Array.from(byUrl.values()).slice(0, limit), answers };
}

/** 抓取网页正文时把 HTML 压成纯文本。 */
export function extractTextFromHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|section|article|li|h[1-6]|tr|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

/**
 * 联网检索的账号凭据来自「发起会话」：dsh-web-search-deepseek 只有在
 * ctx.agents.currentInitiator() 的会话请求路由是 deepseek-account 时，才会
 * 向 DeepSeek 账号换取搜索 token；否则退回到 DEEPSEEK_API_KEY。
 * Host 路由由浏览器触发、本身不在任何 Agent 驱动链里，因此这里显式挑选一个
 * 使用 DeepSeek 账号路由的存活会话，并在其 initiator 作用域内执行检索。
 */
function isAccountRoute(agent) {
  try {
    return agent && agent.session && typeof agent.session.requestContext === 'function'
      && agent.session.requestContext()?.provider === 'deepseek-account';
  } catch (error) {
    return false;
  }
}

/** 找到可用于账号检索的 initiator：优先当前 initiator，其次任一账号路由会话。 */
export function selectSearchInitiator(agents) {
  if (!agents) return null;
  const candidates = [];
  const seen = new Set();
  const push = (agent) => {
    if (agent && typeof agent === 'object' && !seen.has(agent)) {
      seen.add(agent);
      candidates.push(agent);
    }
  };
  try {
    if (typeof agents.currentInitiator === 'function') push(agents.currentInitiator());
  } catch (error) {
    /* 没有当前 initiator */
  }
  try {
    if (typeof agents.list === 'function') for (const agent of agents.list()) push(agent);
  } catch (error) {
    /* registry unavailable */
  }
  try {
    if (typeof agents.roots === 'function') for (const agent of agents.roots()) push(agent);
  } catch (error) {
    /* registry unavailable */
  }
  return candidates.find(isAccountRoute) || candidates[0] || null;
}

/** 在 initiator 作用域内执行异步操作；无法建立作用域时直接执行。 */
function runWithInitiator(agents, agent, operation) {
  if (!agents || !agent || typeof agents.withInitiator !== 'function') return operation();
  try {
    return agents.withInitiator(agent, operation);
  } catch (error) {
    return operation();
  }
}

/** 把 provider 的 WebError 映射成用户能直接照做的提示。 */
function mapSearchFailure(error) {
  const code = error && typeof error.code === 'string' ? error.code : '';
  const detail = error && typeof error.message === 'string' ? error.message : '';
  if (code === 'WEB_PROVIDER_CREDENTIAL_MISSING') {
    return new InsightError(
      'WEB_CREDENTIAL_MISSING',
      '联网检索缺少凭据：请先在 DSH 中登录 DeepSeek 账号，并保持一个使用 DeepSeek 账号模型的会话打开（插件会复用该会话的登录态）；或在「设置 → Web 搜索」中配置 DEEPSEEK_API_KEY 后重试。',
    );
  }
  if (code === 'WEB_PROVIDER_UNAVAILABLE') {
    return new InsightError('WEB_UNAVAILABLE', '联网检索不可用：当前 DSH 没有可用的 Web 搜索 provider，请在插件设置中检查 Web 搜索配置。');
  }
  if (code === 'WEB_PROVIDER_AMBIGUOUS' || code === 'WEB_PROVIDER_CONFIGURED_MISSING' || code === 'WEB_PROVIDER_CONFIGURED_UNAVAILABLE') {
    return new InsightError('WEB_UNAVAILABLE', `联网检索配置有问题（${code}）：请在「设置 → 插件 → Web 搜索」中检查搜索 provider。`);
  }
  if (code === 'WEB_ABORTED') {
    return new InsightError('ABORTED', '检索已取消。');
  }
  return null;
}

async function mapLimit(items, limit, worker, signal) {
  const out = new Array(items.length).fill(null);
  let cursor = 0;
  const size = Math.max(1, Math.min(limit, items.length));
  const runners = Array.from({ length: size }, async () => {
    while (cursor < items.length) {
      if (signal && signal.aborted) return;
      const index = cursor;
      cursor += 1;
      try {
        out[index] = await worker(items[index], index);
      } catch (error) {
        out[index] = null;
      }
    }
  });
  await Promise.all(runners);
  return out;
}

/** 抓取靠前的来源正文；单页失败不影响整体。 */
export async function fetchSourcePages(web, sources, limit, signal) {
  const targets = sources.slice(0, limit);
  const pages = await mapLimit(
    targets,
    3,
    async (source) => {
      try {
        const result = await web.fetch({ url: source.url }, signal);
        if (!result || typeof result !== 'object') return null;
        const body = result.body || {};
        const raw = typeof body.content === 'string' ? body.content : '';
        const text = body.kind === 'html' ? extractTextFromHtml(raw) : raw;
        const content = clampText(text, 9000).trim();
        if (content.length < 120) return null;
        return { url: source.url, title: source.title, text: content };
      } catch (error) {
        return null;
      }
    },
    signal,
  );
  return pages.filter(Boolean);
}

/** 组装给模型的证据语料。 */
export function buildCorpus({ sources, pages, answers, maxChars = 48000 }) {
  const sections = [];
  const lines = [];
  lines.push('# 检索结果清单');
  sources.forEach((source, index) => {
    lines.push(`[S${index + 1}] ${source.title || source.site}`);
    lines.push(`URL: ${source.url}`);
    if (source.publishedAt) lines.push(`发布时间: ${source.publishedAt}`);
    if (source.snippet) lines.push(`摘要: ${clampText(source.snippet, 400)}`);
    lines.push('');
  });
  sections.push(lines.join('\n'));

  if (Array.isArray(answers) && answers.length > 0) {
    sections.push('# 检索服务给出的综述\n' + clampText(answers.join('\n\n'), 12000));
  }

  if (Array.isArray(pages) && pages.length > 0) {
    const pageLines = ['# 网页正文摘录'];
    pages.forEach((page, index) => {
      pageLines.push(`\n[P${index + 1}] ${page.title || ''}`);
      pageLines.push(`URL: ${page.url}`);
      pageLines.push(page.text);
    });
    sections.push(pageLines.join('\n'));
  }

  return clampText(sections.join('\n\n'), maxChars);
}

function reportToPromptJson(report) {
  const sections = {};
  for (const def of SECTION_DEFS) {
    const hit = (report.sections || []).find((section) => section.key === def.key);
    sections[def.key] = hit ? hit.body : '';
  }
  return JSON.stringify(
    {
      title: report.title,
      oneLiner: report.oneLiner,
      sections,
      references: (report.references || []).map((ref) => ({ title: ref.title, url: ref.url, note: ref.note })),
      visuals: report.visuals || null,
    },
    null,
    1,
  ).slice(0, 46000);
}

const SYSTEM_PROMPT = `你是一位资深技术架构师与技术分析师，擅长把公开资料整理成可直接用于技术方案评审与选型决策的中文技术洞察报告。报告的重心是「技术方案细节」：读者看完应当知道这项技术怎么设计、怎么选型、关键参数与坑在哪、如何分阶段落地。

硬性要求：
0. 报告以“当前年份”为基准：用户消息会给出当前日期，业界现状、厂商动态、参考来源优先采用当前年份及最近 12–18 个月的资料；历史里程碑可以早于当前年份，但最新状态与结论必须落到当前年份，不得把往年当作现状。
1. 只输出一个 JSON 对象，不要输出 Markdown 代码围栏、前言、结语或任何解释文字。
2. 全部使用简体中文；专有名词、产品名、公司名可保留原文。
3. 所有事实必须来自给定材料，不得编造；材料不足处明确写“公开资料有限，以下为工程经验判断，需实测验证”，不要杜撰链接、数字或日期。
4. references 里的 url 只能从材料中出现的 URL 原样复制，不得编造或拼接。
5. sections 的五个 key 必须全部存在：introduction、solution、difficulties、scenarios、industry，body 使用 markdown-lite（## 小标题、- 列表、**粗体**、\`行内代码\`、[文字](url)）。
6. 深度优先于空话：每条主张尽量落到“做什么、怎么做、为什么、代价是什么”。禁止“需要关注性能/安全/成本”“根据实际情况调整”这类没有信息量的表述；能给出参数、指标、数量级或取舍时不要省略。
7. introduction：300–500 字，讲清是什么、解决什么问题、能力边界（什么场景不适用）、关键术语的最小概念模型。
8. solution（技术方案设计）是报告核心，800–1500 字，必须按以下小标题组织，缺一不可：
   ## 总体架构 —— 模块/组件划分、各自职责、依赖与交互关系，并与 architecture 图对应
   ## 核心流程 —— 端到端一次请求/数据流转的步骤，标注关键输入输出、数据结构或索引/算法
   ## 关键技术选型 —— 至少 3 个选型维度，每个维度列 2–3 个候选方案、推荐项、取舍理由与代价
   ## 关键实现与参数 —— 典型参数区间、容量/性能的数量级估算、需要监控的指标（注明资料值还是经验值）
   ## 失败处理与可靠性 —— 最易出问题的 3 个环节，以及超时、重试、降级、一致性或容量兜底策略
   ## 落地步骤 —— 从验证到上线分 2–4 个阶段，每阶段的产出物与验收标准
9. difficulties：5–7 个，每个用“## 难点名称”开头，再写 2–4 句：为什么难、具体表现或量化影响、常见解法。
10. scenarios：5–6 个，每个用“## 场景名称”开头，写业务问题、方案匹配点、落地要点、不适合的条件。
11. industry：至少包含“## 采用现状”“## 主要玩家”“## 典型落地”“## 趋势判断”四部分，尽量给出可核实的厂商、产品与时间。
12. oneLiner：40–80 字的一句话结论，直接给判断，不要空话。
13. visuals 字段把关键结论画成可直接渲染的图，必须提供且严格符合结构：
   - architecture：3–5 层分层架构，每层 2–4 个短条目（每个 ≤14 字）；
   - difficulty：4–6 个难点，score 为 0–100 整数（越高越难），reason ≤40 字；
   - matrix：4–6 个使用场景，x=落地成熟度、y=业务价值，均为 0–100 整数；
   - timeline：4–6 个业界里程碑，time 用“2023”“2024 Q2”这类短标签，detail ≤50 字。
   所有图内名称 ≤18 字；不要输出坐标轴以外的解释文字；不要编造与正文矛盾的数据。`;

/**
 * 方案要点梳理（第一段调用）：高推理强度、短输出，供第二段成稿参考。
 * 只输出紧凑的要点清单，避免把推理预算花在长文上。
 */
const PLAN_SYSTEM_PROMPT = '你是一位资深技术架构师。只输出中文要点清单文本，不要输出 JSON、代码围栏或解释过程；每条尽量落到具体做法、参数或取舍，材料没有的写“资料未提及”。';

function buildPlanPrompt({ topic, focus, corpus, queries, asOf, year }) {
  return `你是资深技术架构师。请阅读下面的检索材料，为技术「${topic}」梳理一份“技术方案要点清单”，供后续撰写正式报告使用。

${focus ? `用户特别关注：${focus}\n` : ''}当前日期：${asOf}（当前年份 ${year}）
本次检索词：${queries.join('；')}

输出要求（只输出清单文本，不要 JSON、不要代码围栏、不要解释过程）：
- 用 ## 小标题分为：## 模块与职责、## 端到端流程、## 选型对比、## 关键参数与容量、## 失败与兜底、## 落地阶段
- 每条 1–2 句，尽量带具体做法、参数区间或数量级；材料没有的就写“资料未提及”
- 总长度控制在 1200–1800 字，宁缺毋滥，不要重复

=== 检索材料开始 ===
${corpus}
=== 检索材料结束 ===`;
}

function buildGeneratePrompt({ topic, focus, corpus, queries, asOf, year, plan, compact }) {
  return `请基于下列检索材料，为技术「${topic}」写一份以“技术方案设计”为核心的技术洞察报告。

${focus ? `用户特别关注：${focus}
` : ''}当前日期：${asOf}（当前年份 ${year}）
本次检索词：${queries.join('；')}

年份要求：业界使用状态、厂商动态与参考来源以 ${year} 年为主，优先最近 12–18 个月的资料；引用较早资料时要标明时间，不要用往年信息冒充现状。

${plan ? `以下是内部方案要点清单，请把它扩展成完整、连贯的正文，而不是原样照抄：\n${plan}\n\n` : ''}${compact ? '注意：上一版输出触发了长度上限。本版请压缩表达：solution 控制在 500–800 字，其余分节精简为 3–4 条，但必须保留六个小标题、选型结论与关键参数。\n\n' : ''}写作前在内部完成以下检查（不要输出检查过程，必须体现在正文里）：
- 系统由哪些模块组成？每个模块的输入/输出/依赖是什么？
- 端到端一次请求怎么走？用了什么数据结构、索引或算法？
- 至少 3 个选型维度上，候选方案、推荐项、代价分别是什么？
- 能给出多少个可调参数/容量指标的数量级？
- 最可能出问题的 3 个环节及兜底策略是什么？
- 从 0 到上线分几步？每步的验收标准是什么？

请输出如下 JSON 结构：
{
  "title": "报告标题，不超过 24 字",
  "oneLiner": "一句话结论",
  "sections": {
    "introduction": "…",
    "solution": "## 总体架构\n…\n## 核心流程\n…\n## 关键技术选型\n…\n## 关键实现与参数\n…\n## 失败处理与可靠性\n…\n## 落地步骤\n…",
    "difficulties": "…",
    "scenarios": "…",
    "industry": "…"
  },
  "references": [
    { "title": "来源标题", "url": "材料中的 URL", "note": "该来源支撑的要点，一句话" }
  ],
  "visuals": {
    "architecture": {
      "title": "技术分层架构",
      "layers": [ { "name": "层名称", "items": ["组件/能力", "组件/能力"] } ]
    },
    "difficulty": {
      "title": "关键难点强度（0–100）",
      "items": [ { "name": "难点名称", "score": 80, "reason": "为什么难" } ]
    },
    "matrix": {
      "title": "场景价值矩阵",
      "xLabel": "落地成熟度",
      "yLabel": "业务价值",
      "items": [ { "name": "场景名称", "x": 70, "y": 85 } ]
    },
    "timeline": {
      "title": "业界采用时间线",
      "items": [
        { "time": "${year - 2}", "title": "历史里程碑", "detail": "发生了什么" },
        { "time": "${year}", "title": "当前进展", "detail": "今年的状态" }
      ]
    }
  }
}

references 给出 8–14 条。五个分节都要有实质内容，solution 必须写满六个小标题；visuals 四块都要给出。

=== 检索材料开始 ===
${corpus}
=== 检索材料结束 ===`;
}

function buildRefinePrompt({ report, instruction, corpus, queries, asOf, year, compact }) {
  return `请根据用户的修订要求，更新下面这份技术洞察报告。

当前日期：${asOf}（当前年份 ${year}）
报告主题：${report.topic}
年份要求：把业界状态更新到 ${year} 年，优先采用最近 12–18 个月的资料；历史内容保留但要标清时间。
用户修订要求：${instruction}
${queries.length ? `本次补充检索词：${queries.join('；')}\n` : ''}
更新规则：
${compact ? '- 上一版输出触发了长度上限：本次请压缩表达，solution 控制在 500–800 字，其余分节精简，但保留六个小标题与关键结论；\n' : ''}- 保留原报告中仍然成立的内容，按修订要求补充、修正或重写；
- 必须保留五个分节（introduction、solution、difficulties、scenarios、industry），不要改成提纲；
- solution 必须保持六个小标题；用户要求更深时，补充具体模块、参数、选型对比、失败处理与落地步骤，而不是同义改写；
- visuals 必须与新正文一致：可以保留、修正或重画，但四块图都要输出；
- references 只能是原报告已有 URL 或新材料中的 URL（原样复制）；
- 输出完整的新版本报告，JSON 结构与原报告一致。

原报告（JSON）：
${reportToPromptJson(report)}

${corpus ? `=== 补充材料开始 ===\n${corpus}\n=== 补充材料结束 ===` : '（本次没有新的检索材料，请仅基于原报告与修订要求更新。）'}

请只输出更新后的 JSON 对象。`;
}

/** 从模型输出中提取 JSON 对象（容忍代码围栏、前后废话、尾逗号）。 */
export function parseJsonObject(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new InsightError('EMPTY_MODEL_OUTPUT', '模型没有返回内容，请重试或降低深度。');
  }
  let body = text.trim();
  const fence = body.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) body = fence[1].trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new InsightError('BAD_MODEL_OUTPUT', '模型输出里没有可解析的 JSON，请重试。');
  }
  body = body.slice(start, end + 1);
  try {
    return JSON.parse(body);
  } catch (error) {
    try {
      return JSON.parse(body.replace(/,\s*([}\]])/g, '$1'));
    } catch (retryError) {
      throw new InsightError('BAD_MODEL_OUTPUT', '模型输出的 JSON 无法解析（可能被截断），请降低深度后重试。');
    }
  }
}

function sectionBodyOf(raw, def) {
  const direct = raw[def.key];
  if (typeof direct === 'string') return clampText(direct, REPORT_BODY_MAX);
  if (direct && typeof direct === 'object') return clampText(asString(direct.body || direct.content || direct.text, REPORT_BODY_MAX), REPORT_BODY_MAX);
  if (raw.sections && typeof raw.sections === 'object' && !Array.isArray(raw.sections)) {
    const hit = raw.sections[def.key];
    if (typeof hit === 'string') return clampText(hit, REPORT_BODY_MAX);
    if (hit && typeof hit === 'object') return clampText(asString(hit.body || hit.content || hit.text, REPORT_BODY_MAX), REPORT_BODY_MAX);
  }
  if (Array.isArray(raw.sections)) {
    const hit = raw.sections.find((section) => section && typeof section === 'object' && (section.key === def.key || section.title === def.title));
    if (hit) {
      if (typeof hit.body === 'string') return clampText(hit.body, REPORT_BODY_MAX);
      if (typeof hit.content === 'string') return clampText(hit.content, REPORT_BODY_MAX);
      if (typeof hit.text === 'string') return clampText(hit.text, REPORT_BODY_MAX);
    }
  }
  return '';
}

function normalizeReferences(raw, allowedUrls, sources) {
  const list = Array.isArray(raw) ? raw : [];
  const allowed = new Set(Array.from(allowedUrls || []).map(normalizeUrl).filter(Boolean));
  const out = [];
  const seen = new Set();
  const push = (title, url, note) => {
    const normalized = normalizeUrl(url);
    if (!normalized || seen.has(normalized)) return;
    if (allowed.size > 0 && !allowed.has(normalized)) return;
    seen.add(normalized);
    out.push({
      title: clampText(title || siteOf(normalized), 300),
      url: normalized,
      note: clampText(note || '检索结果来源', 300),
    });
  };
  for (const item of list) {
    if (!item) continue;
    if (typeof item === 'string') {
      push('', item, '');
      continue;
    }
    if (typeof item !== 'object') continue;
    const url = item.url || item.link || item.href || '';
    push(item.title || item.name || '', url, item.note || item.summary || item.reason || '');
  }
  if (out.length < 4 && Array.isArray(sources)) {
    for (const source of sources) {
      if (out.length >= 6) break;
      push(source.title, source.url, source.snippet ? clampText(source.snippet, 160) : '检索结果来源');
    }
  }
  return out.slice(0, REFERENCE_MAX);
}

/** 短文本裁剪（visuals 里的标签都很短，超长会破坏图布局）。 */
function shortLabel(value, max) {
  return clampText(typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value), max).replace(/\s+/g, ' ').trim();
}

function clampScore(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * 可视化数据：模型只输出结构化数值/短标签，前端用内联 SVG 渲染，
 * 不执行模型产出的任意 HTML/SVG，避免注入风险。
 * 任何一块不合法就丢弃该块，报告仍可正常展示。
 */
export function normalizeVisuals(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};

  const arch = raw.architecture || raw.arch || raw.layers;
  if (arch && typeof arch === 'object') {
    const layers = (Array.isArray(arch.layers) ? arch.layers : [])
      .slice(0, 5)
      .map((layer) => {
        if (!layer || typeof layer !== 'object') return null;
        const items = (Array.isArray(layer.items) ? layer.items : [])
          .filter((item) => typeof item === 'string' && item.trim())
          .slice(0, 4)
          .map((item) => shortLabel(item, 18));
        const name = shortLabel(layer.name || layer.title, 18);
        if (!name && items.length === 0) return null;
        return { name: name || '层', items };
      })
      .filter(Boolean);
    if (layers.length >= 2) {
      out.architecture = {
        title: shortLabel(arch.title, 40) || '技术分层架构',
        layers,
      };
    }
  }

  const difficulty = raw.difficulty || raw.difficultiesVisual;
  if (difficulty && typeof difficulty === 'object') {
    const items = (Array.isArray(difficulty.items) ? difficulty.items : [])
      .slice(0, 6)
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const name = shortLabel(item.name || item.title, 20);
        if (!name) return null;
        return {
          name,
          score: clampScore(item.score ?? item.value ?? item.severity, 50),
          reason: shortLabel(item.reason || item.note || item.detail, 48),
        };
      })
      .filter(Boolean);
    if (items.length >= 2) {
      out.difficulty = {
        title: shortLabel(difficulty.title, 40) || '关键难点强度（0–100）',
        items,
      };
    }
  }

  const matrix = raw.matrix || raw.scenarioMatrix;
  if (matrix && typeof matrix === 'object') {
    const items = (Array.isArray(matrix.items) ? matrix.items : [])
      .slice(0, 6)
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const name = shortLabel(item.name || item.title, 18);
        if (!name) return null;
        return { name, x: clampScore(item.x, 50), y: clampScore(item.y, 50) };
      })
      .filter(Boolean);
    if (items.length >= 2) {
      out.matrix = {
        title: shortLabel(matrix.title, 40) || '场景价值矩阵',
        xLabel: shortLabel(matrix.xLabel, 16) || '落地成熟度',
        yLabel: shortLabel(matrix.yLabel, 16) || '业务价值',
        items,
      };
    }
  }

  const timeline = raw.timeline || raw.adoptionTimeline;
  if (timeline && typeof timeline === 'object') {
    const items = (Array.isArray(timeline.items) ? timeline.items : [])
      .slice(0, 6)
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const title = shortLabel(item.title || item.name, 24);
        if (!title) return null;
        return {
          time: shortLabel(item.time || item.date, 16),
          title,
          detail: shortLabel(item.detail || item.note || item.description, 60),
        };
      })
      .filter(Boolean);
    if (items.length >= 2) {
      out.timeline = {
        title: shortLabel(timeline.title, 40) || '业界采用时间线',
        items,
      };
    }
  }

  return Object.keys(out).length ? out : null;
}

/** 把模型输出（或修订输出）规范化成权威 Report 结构。 */
export function normalizeReport(raw, context) {
  if (!raw || typeof raw !== 'object') {
    throw new InsightError('BAD_MODEL_OUTPUT', '模型返回的报告结构不正确，请重试。');
  }
  const topic = clampText(context.topic, 120);
  const title = clampText(asString(raw.title, 80).trim() || `${topic}技术洞察`, 80);
  const oneLiner = clampText(asString(raw.oneLiner || raw.summary || raw.abstract, 240).trim(), 240);
  const sections = SECTION_DEFS.map((def) => ({
    key: def.key,
    title: def.title,
    body: sectionBodyOf(raw, def).trim(),
  }));
  if (sections.every((section) => !section.body)) {
    throw new InsightError('BAD_MODEL_OUTPUT', '模型返回的报告没有正文内容，请重试。');
  }
  return {
    id: context.id,
    revision: context.revision,
    topic,
    title,
    oneLiner,
    sections,
    references: normalizeReferences(raw.references || raw.refs || raw.sources, context.allowedUrls, context.sources),
    visuals: normalizeVisuals(raw.visuals),
    queries: Array.isArray(context.queries) ? context.queries.slice(0, 12) : [],
    sourceCount: Number.isFinite(context.sourceCount) ? context.sourceCount : 0,
    model: context.model || '',
    createdAt: context.createdAt,
    updatedAt: context.updatedAt,
    generator: GENERATOR,
  };
}

/** 新建报告 id：短、可读、避免碰撞。 */
export function newReportId(now = Date.now(), random = Math.random) {
  return `ti-${now.toString(36)}-${Math.floor(random() * 46656).toString(36)}`;
}

function explainLlmFailure(failure, provider) {
  const code = failure && typeof failure.code === 'string' ? failure.code : 'MODEL_ERROR';
  const message = failure && typeof failure.message === 'string' ? failure.message : '模型调用失败';
  if (code === 'ACCOUNT_SIGN_IN_REQUIRED' || code === 'MISSING_CREDENTIAL') {
    return new InsightError('ACCOUNT_SIGN_IN_REQUIRED', '当前 DSH 账号未登录或登录已失效，请先在设置中登录后重试。');
  }
  if (code === 'ACCOUNT_QUOTA' || code === 'QUOTA') {
    return new InsightError('ACCOUNT_QUOTA', '当前账号额度不足，请充值或切换模型后重试。');
  }
  if (code === 'CONTEXT_WINDOW_EXCEEDED') {
    return new InsightError('CONTEXT_WINDOW_EXCEEDED', '检索材料超出模型上下文窗口，请降低深度后重试。');
  }
  if (code === 'RATE_LIMIT') {
    return new InsightError('RATE_LIMIT', '模型请求被限流，请稍后重试。');
  }
  return new InsightError('MODEL_ERROR', `${message}（provider: ${provider || 'unknown'}）`);
}

/** 收集一次完整的 LLM 文本输出。effort 用于按深度提升推理强度（模型支持时）。 */
async function streamCompletion(llm, selection, system, user, { maxTokens, signal, effort }) {
  const provider = selection.provider;
  const model = selection.model;
  let resolvedMax = maxTokens;
  let info = null;
  try {
    info = await llm.resolveModelInfo(provider, model);
    if (info && Number.isFinite(info.defaultMaxTokens)) {
      resolvedMax = Math.min(maxTokens, info.defaultMaxTokens);
    }
  } catch (error) {
    /* 解析不到能力时按请求值尝试 */
  }
  const messages = [{ role: 'user', content: [{ type: 'text', text: user }] }];
  let text = '';
  let finish = null;
  const options = {
    provider,
    model,
    system,
    messages,
    maxTokens: resolvedMax,
    signal,
  };
  /* 优先使用调用方要求的强度；模型不支持时回退到当前会话选择。 */
  let reasoningEffort = selection.reasoningEffort;
  const efforts =
    info && info.reasoning && Array.isArray(info.reasoning.efforts)
      ? info.reasoning.efforts.map((item) => String(item.id))
      : [];
  if (effort && efforts.length > 0) {
    if (efforts.includes(effort)) {
      reasoningEffort = effort;
    } else {
      for (const candidate of ['max', 'high']) {
        if (efforts.includes(candidate)) {
          reasoningEffort = candidate;
          break;
        }
      }
    }
  }
  if (reasoningEffort) options.reasoningEffort = reasoningEffort;
  for await (const chunk of llm.stream(options)) {
    if (!chunk) continue;
    if (chunk.type === 'text-delta') {
      text += chunk.text || '';
    } else if (chunk.type === 'finish') {
      finish = chunk.reason;
    }
  }
  if (finish && finish.kind === 'error') {
    throw explainLlmFailure(finish.failure, provider);
  }
  if (finish && finish.kind === 'aborted') {
    throw new InsightError('ABORTED', '请求已取消。');
  }
  if (finish && finish.kind === 'max-tokens') {
    throw new InsightError('OUTPUT_TRUNCATED', '模型输出达到长度上限：已自动尝试压缩重试；如仍失败，请改用快速/标准或缩短关注点。');
  }
  return text;
}

function selectionOf(getSelection) {
  const selection = typeof getSelection === 'function' ? getSelection() : null;
  const provider = selection && typeof selection.provider === 'string' ? selection.provider : '';
  const model = selection && typeof selection.model === 'string' ? selection.model : '';
  if (!provider || !model) {
    throw new InsightError('NO_MODEL', '当前 profile 没有选择默认模型，请先在设置里选择模型。');
  }
  return selection;
}

function webOf(getWeb) {
  const web = typeof getWeb === 'function' ? getWeb() : null;
  if (!web || typeof web.search !== 'function') {
    throw new InsightError('WEB_UNAVAILABLE', '当前 DSH 没有可用的联网检索服务，请检查 Web 搜索配置。');
  }
  return web;
}

async function searchAndEnrich(web, queries, options, emit, signal) {
  const { maxResults, fetchPages, corpusChars, allowedExtraUrls } = options;
  emit('stage', { stage: 'search', label: '正在联网检索资料…', progress: 0.08 });
  /* 限制并发：DeepSeek 原生检索每次都是一次完整模型请求，过多并发容易限流。 */
  const settled = await mapLimit(
    queries,
    3,
    async (query) => {
      try {
        return { ok: true, value: await web.search({ query, maxResults }, signal) };
      } catch (error) {
        return { ok: false, error };
      }
    },
    signal,
  );
  const results = [];
  const failures = [];
  for (const item of settled) {
    if (!item) continue;
    if (item.ok) results.push(item.value);
    else failures.push(item.error);
  }
  const merged = mergeSearchResults(results, 16);
  if (merged.sources.length === 0) {
    const mapped = failures.length > 0 ? mapSearchFailure(failures[0]) : null;
    if (mapped) throw mapped;
    const detail = failures.length > 0 && failures[0] && failures[0].message ? `（${failures[0].message}）` : '';
    throw new InsightError('WEB_NO_RESULTS', `没有检索到可用资料${detail}。请检查联网检索是否可用，或换个技术名称重试。`);
  }
  emit('sources', { sources: merged.sources.slice(0, 12) });
  emit('stage', { stage: 'read', label: `已找到 ${merged.sources.length} 个来源，正在抓取正文…`, progress: 0.32 });
  let pages = [];
  if (typeof web.fetch === 'function' && fetchPages > 0) {
    pages = await fetchSourcePages(web, merged.sources, fetchPages, signal);
  }
  if (pages.length > 0) {
    emit('sources', { sources: pages.map((page) => ({ title: page.title, url: page.url, snippet: '', site: siteOf(page.url) })) });
  }
  const corpus = buildCorpus({ sources: merged.sources, pages, answers: merged.answers, maxChars: corpusChars });
  const allowedUrls = new Set(merged.sources.map((source) => source.url));
  for (const url of allowedExtraUrls || []) allowedUrls.add(url);
  return { sources: merged.sources, pages, corpus, allowedUrls };
}

const DEFAULT_BODY_LIMITS = { depth: 'standard' };

/** 把 HTTP 请求体规整成生成参数。 */
export function normalizeGenerateInput(body) {
  const topic = clampText(body && body.topic, 120).trim();
  if (!topic) throw new InsightError('BAD_REQUEST', '请先输入要洞察的技术名称。');
  const focus = clampText(body && body.focus, 240).trim();
  const depthRaw = body && typeof body.depth === 'string' ? body.depth : DEFAULT_BODY_LIMITS.depth;
  const depth = DEPTHS[depthRaw] ? depthRaw : 'standard';
  return { topic, focus, depth };
}

export function createInsightService({ getWeb, getLlm, getSelection, getAgents, now = () => Date.now(), random = Math.random }) {
  async function status() {
    const selection = (() => {
      try {
        return typeof getSelection === 'function' ? getSelection() : null;
      } catch (error) {
        return null;
      }
    })();
    const provider = selection && typeof selection.provider === 'string' ? selection.provider : '';
    const model = selection && typeof selection.model === 'string' ? selection.model : '';
    let webReady = false;
    let fetchReady = false;
    let message = '';
    const web = typeof getWeb === 'function' ? getWeb() : null;
    if (web) {
      try {
        webReady = typeof web.searchReady === 'function' ? await web.searchReady(provider || undefined) : true;
      } catch (error) {
        webReady = false;
      }
      try {
        fetchReady = typeof web.fetchReady === 'function' ? await web.fetchReady(provider || undefined) : false;
      } catch (error) {
        fetchReady = false;
      }
    }
    if (!provider || !model) message = '当前 profile 未选择默认模型，请先在设置中选择模型。';
    else if (!web) message = '当前 DSH 没有联网检索服务。';
    else if (!webReady) message = '联网检索当前不可用（模型账号未登录或无检索 provider）。';
    return {
      ok: true,
      ready: Boolean(provider && model && web && webReady),
      provider,
      model,
      modelName: model,
      webReady,
      fetchReady,
      version: PLUGIN_VERSION,
      message,
    };
  }

  async function generate(input, emit, signal) {
    const startedAt = now();
    const params = normalizeGenerateInput(input);
    const selection = selectionOf(getSelection);
    const llm = typeof getLlm === 'function' ? getLlm() : null;
    if (!llm || typeof llm.stream !== 'function') {
      throw new InsightError('MODEL_UNAVAILABLE', 'Host 侧没有可用的 llm 服务。');
    }
    const web = webOf(getWeb);
    const preset = DEPTHS[params.depth];
    const nowMs = now();
    const year = new Date(nowMs).getFullYear();
    const asOf = new Date(nowMs).toISOString().slice(0, 10);
    const queries = buildQueries(params.topic, params.focus, params.depth, year);
    emit('queries', { queries });
    const agents = typeof getAgents === 'function' ? getAgents() : null;
    const enriched = await runWithInitiator(agents, selectSearchInitiator(agents), () =>
      searchAndEnrich(web, queries, preset, emit, signal),
    );
    const promptBase = {
      topic: params.topic,
      focus: params.focus,
      corpus: enriched.corpus,
      queries,
      asOf,
      year,
    };

    /* 第一段：高推理强度梳理方案要点（输出短，不会挤占正文预算）。 */
    let planText = '';
    if (preset.plan) {
      emit('stage', { stage: 'synthesize', label: '正在用高推理强度梳理技术方案要点…', progress: 0.5 });
      try {
        const planOptions = { signal, effort: preset.planEffort };
        if (preset.planTokens > 0) planOptions.maxTokens = preset.planTokens;
        planText = await streamCompletion(llm, selection, PLAN_SYSTEM_PROMPT, buildPlanPrompt(promptBase), planOptions);
      } catch (error) {
        if (signal && signal.aborted) throw error;
        /* 方案梳理失败不阻塞成稿，直接进入第二段。 */
        planText = '';
      }
    }

    /* 第二段：关闭推理，全部输出预算用于完整报告 JSON。 */
    const writeReport = async (compact) => {
      emit('stage', {
        stage: 'synthesize',
        label: compact ? '输出较长，正在压缩重试…' : '模型正在撰写技术洞察报告…',
        progress: compact ? 0.7 : 0.62,
      });
      const prompt = buildGeneratePrompt({ ...promptBase, plan: planText, compact });
      const rawText = await streamCompletion(llm, selection, SYSTEM_PROMPT, prompt, {
        maxTokens: preset.maxTokens,
        signal,
        effort: 'off',
      });
      return parseJsonObject(rawText);
    };

    let raw;
    try {
      raw = await writeReport(false);
    } catch (error) {
      if (signal && signal.aborted) throw error;
      const truncated = error && (error.code === 'OUTPUT_TRUNCATED' || error.code === 'BAD_MODEL_OUTPUT' || error.code === 'EMPTY_MODEL_OUTPUT');
      if (!truncated) throw error;
      raw = await writeReport(true);
    }
    const timestamp = new Date(now()).toISOString();
    const report = normalizeReport(raw, {
      id: newReportId(now(), random),
      revision: 1,
      topic: params.topic,
      queries,
      sourceCount: enriched.sources.length,
      model: selection.model,
      createdAt: timestamp,
      updatedAt: timestamp,
      allowedUrls: enriched.allowedUrls,
      sources: enriched.sources,
    });
    emit('stage', { stage: 'done', label: '报告已生成', progress: 1 });
    emit('report', { report, durationMs: now() - startedAt });
    return report;
  }

  async function refine(input, emit, signal) {
    const startedAt = now();
    const report = input && input.report;
    if (!report || typeof report !== 'object' || !Array.isArray(report.sections) || !report.topic) {
      throw new InsightError('BAD_REQUEST', '缺少要修订的报告数据。');
    }
    const instruction = clampText(input && input.instruction, 600).trim();
    if (!instruction) throw new InsightError('BAD_REQUEST', '请填写补充修订的要求。');
    const useWeb = input.useWeb !== false;
    const depth = DEPTHS[input.depth] ? input.depth : 'standard';
    const selection = selectionOf(getSelection);
    const llm = typeof getLlm === 'function' ? getLlm() : null;
    if (!llm || typeof llm.stream !== 'function') {
      throw new InsightError('MODEL_UNAVAILABLE', 'Host 侧没有可用的 llm 服务。');
    }
    const existingRefs = (Array.isArray(report.references) ? report.references : [])
      .map((ref) => normalizeUrl(ref && ref.url))
      .filter(Boolean);
    let queries = [];
    let enriched = { sources: [], corpus: '', allowedUrls: new Set(existingRefs) };
    if (useWeb) {
      const web = webOf(getWeb);
      queries = buildRefineQueries(report.topic, instruction, depth, new Date(now()).getFullYear());
      emit('queries', { queries });
      const preset = { ...DEPTHS[depth], fetchPages: Math.max(2, DEPTHS[depth].fetchPages - 2), corpusChars: Math.min(DEPTHS[depth].corpusChars, 30000) };
      const agents = typeof getAgents === 'function' ? getAgents() : null;
      const searched = await runWithInitiator(agents, selectSearchInitiator(agents), () =>
        searchAndEnrich(web, queries, { ...preset, allowedExtraUrls: existingRefs }, emit, signal),
      );
      enriched = searched;
    } else {
      emit('stage', { stage: 'synthesize', label: '正在基于现有报告修订…', progress: 0.35 });
    }
    const nowDate = new Date(now());
    const writeRefine = async (compact) => {
      emit('stage', {
        stage: 'synthesize',
        label: compact ? '输出较长，正在压缩重试…' : '模型正在更新报告…',
        progress: compact ? 0.72 : 0.62,
      });
      const prompt = buildRefinePrompt({
        report,
        instruction,
        corpus: enriched.corpus,
        queries,
        asOf: nowDate.toISOString().slice(0, 10),
        year: nowDate.getFullYear(),
        compact,
      });
      const rawText = await streamCompletion(llm, selection, SYSTEM_PROMPT, prompt, {
        maxTokens: DEPTHS[depth].maxTokens,
        signal,
        effort: 'off',
      });
      return parseJsonObject(rawText);
    };

    let raw;
    try {
      raw = await writeRefine(false);
    } catch (error) {
      if (signal && signal.aborted) throw error;
      const truncated = error && (error.code === 'OUTPUT_TRUNCATED' || error.code === 'BAD_MODEL_OUTPUT' || error.code === 'EMPTY_MODEL_OUTPUT');
      if (!truncated) throw error;
      raw = await writeRefine(true);
    }
    const timestamp = new Date(now()).toISOString();
    const next = normalizeReport(raw, {
      id: typeof report.id === 'string' && report.id ? report.id : newReportId(now(), random),
      revision: Math.max(1, Number(report.revision) || 1) + 1,
      topic: report.topic,
      queries,
      sourceCount: Math.max(
        Number(report.sourceCount) || 0,
        enriched.sources.length + (Array.isArray(report.references) ? report.references.length : 0),
      ),
      model: selection.model,
      createdAt: typeof report.createdAt === 'string' && report.createdAt ? report.createdAt : timestamp,
      updatedAt: timestamp,
      allowedUrls: enriched.allowedUrls,
      sources: enriched.sources,
    });
    next.title = next.title || report.title;
    emit('stage', { stage: 'done', label: '修订完成', progress: 1 });
    emit('report', { report: next, durationMs: now() - startedAt });
    return next;
  }

  return { status, generate, refine };
}
