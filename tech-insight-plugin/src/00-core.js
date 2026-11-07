/* ─────────────────────────────────────────────────────────────
 * 技术洞察 · 核心层
 * 常量、本地存储、通用工具、Host 网络请求（JSON + SSE）与 Markdown 导出。
 * 本文件被 build.mjs 拼进 Client factory，与后续文件共享同一作用域。
 * ───────────────────────────────────────────────────────────── */

/* ── 常量 ─────────────────────────────────────────────────── */

const TI_STORAGE_KEY = 'dsh.tech-insight.v1';
const TI_STORE_VERSION = 1;

const TI_PATHS = {
  status: '/tech-insight/status',
  insight: '/tech-insight/insight',
  refine: '/tech-insight/refine',
  job: '/tech-insight/job',
  cancel: '/tech-insight/job/cancel',
};

/** 深度三档：与 Host 的 quick / standard / deep 严格对应。 */
const TI_DEPTHS = [
  { id: 'quick', label: '快速', hint: '3 组检索，方案要点够用' },
  { id: 'standard', label: '标准', hint: '6 组检索，方案细节较全' },
  { id: 'deep', label: '深度', hint: '8 组检索 + 最高推理强度，细节最全、耗时最长' },
];

const TI_EXAMPLES = ['向量数据库', 'RISC-V', '智能体记忆', '液冷数据中心'];

/** 四个固定分节：key 与 Host 契约一致，顺序即渲染顺序。 */
const TI_SECTIONS = [
  { key: 'introduction', label: '技术介绍', icon: 'book', hint: '它解决什么问题、核心原理是什么' },
  { key: 'solution', label: '技术方案设计', icon: 'blueprint', hint: '架构 / 流程 / 选型 / 参数 / 可靠性 / 落地路径' },
  { key: 'difficulties', label: '技术关键难点', icon: 'flame', hint: '工程落地时真正难啃的地方' },
  { key: 'scenarios', label: '技术使用场景', icon: 'layers', hint: '典型业务场景与适用边界' },
  { key: 'industry', label: '业界使用状态', icon: 'chart', hint: '主流玩家、成熟度与趋势' },
];

/** 生成步骤条：SSE 只有 search/read/synthesize，最后一步由 report 事件点亮。 */
const TI_STAGES = [
  { key: 'search', label: '检索资料', hint: '联网搜索候选来源' },
  { key: 'read', label: '抓取正文', hint: '读取并清洗页面正文' },
  { key: 'synthesize', label: '模型分析', hint: '归纳结构与结论' },
  { key: 'report', label: '整理报告', hint: '按固定分节成稿' },
];

/** 面板标识（sidebar/main 共用）。 */
const TI_PANEL_ID = 'tech-insight';
/** 生成中任务在归档目录里的临时选中态。 */
const TI_PENDING_ID = '__ti_pending__';

/* ── 基础工具 ─────────────────────────────────────────────── */

function tiUid(prefix) {
  return String(prefix || 'ti') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
}

function tiDeepCopy(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    return value;
  }
}

function tiClamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function tiTruncate(text, max) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (value.length <= max) return value;
  return value.slice(0, Math.max(0, max - 1)) + '…';
}

/* ── 时间格式化 ───────────────────────────────────────────── */

function tiParseDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function tiPad(n) {
  return n < 10 ? '0' + n : String(n);
}

/** 2026-11-07 17:30 */
function tiFormatDateTime(value) {
  const date = tiParseDate(value);
  if (!date) return '—';
  return (
    date.getFullYear() + '-' + tiPad(date.getMonth() + 1) + '-' + tiPad(date.getDate()) +
    ' ' + tiPad(date.getHours()) + ':' + tiPad(date.getMinutes())
  );
}

/** 11-07 */
function tiFormatShortDate(value) {
  const date = tiParseDate(value);
  if (!date) return '—';
  return tiPad(date.getMonth() + 1) + '-' + tiPad(date.getDate());
}

/** 20261107（导出文件名用） */
function tiFormatFileDay(value) {
  const date = tiParseDate(value) || new Date();
  return String(date.getFullYear()) + tiPad(date.getMonth() + 1) + tiPad(date.getDate());
}

/** 已用时：12.3 秒 / 1 分 05 秒 */
function tiFormatElapsed(ms) {
  const total = Math.max(0, Number(ms) || 0) / 1000;
  if (total < 60) return total.toFixed(1) + ' 秒';
  const minutes = Math.floor(total / 60);
  const seconds = Math.floor(total % 60);
  return minutes + ' 分 ' + tiPad(seconds) + ' 秒';
}

/* ── 本地存储（dsh.tech-insight.v1） ──────────────────────── */

function tiDefaultStore() {
  return {
    version: TI_STORE_VERSION,
    reports: [],
    draft: { topic: '', focus: '', depth: 'standard' },
    prefs: { depth: 'standard', railCollapsed: false },
    selectedId: '',
  };
}

function tiStorageAvailable() {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch (error) {
    return false;
  }
}

/** 单条归档容错：结构缺失时尽量补齐，无法修复则丢弃。 */
function tiNormalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const report = entry.report && typeof entry.report === 'object' ? entry.report : null;
  if (!report || typeof report.id !== 'string' || !report.id) return null;
  const revisions = Array.isArray(entry.revisions)
    ? entry.revisions
        .filter((item) => item && typeof item === 'object' && item.report && typeof item.report === 'object')
        .map((item, index) => ({
          rev: Number.isFinite(item.rev) ? item.rev : index + 1,
          at: typeof item.at === 'string' ? item.at : new Date().toISOString(),
          note: typeof item.note === 'string' ? item.note : '',
          report: item.report,
        }))
        .sort((a, b) => a.rev - b.rev)
    : [];
  if (!revisions.length) {
    revisions.push({ rev: 1, at: entry.archivedAt || report.createdAt || new Date().toISOString(), note: '初始洞察', report });
  }
  const currentRev = Number.isFinite(entry.currentRev) ? entry.currentRev : revisions[revisions.length - 1].rev;
  return {
    report,
    archivedAt: typeof entry.archivedAt === 'string' ? entry.archivedAt : new Date().toISOString(),
    revisions,
    currentRev,
  };
}

/** 读取归档：JSON 损坏 / 结构异常时回到默认值，绝不抛错。 */
function tiReadStore() {
  const fallback = tiDefaultStore();
  if (!tiStorageAvailable()) return fallback;
  try {
    const raw = window.localStorage.getItem(TI_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;
    const store = tiDefaultStore();
    store.reports = Array.isArray(parsed.reports) ? parsed.reports.map(tiNormalizeEntry).filter(Boolean) : [];
    const draft = parsed.draft && typeof parsed.draft === 'object' ? parsed.draft : {};
    store.draft = {
      topic: typeof draft.topic === 'string' ? draft.topic.slice(0, 200) : '',
      focus: typeof draft.focus === 'string' ? draft.focus.slice(0, 300) : '',
      depth: TI_DEPTHS.some((item) => item.id === draft.depth) ? draft.depth : 'standard',
    };
    const prefs = parsed.prefs && typeof parsed.prefs === 'object' ? parsed.prefs : {};
    store.prefs = {
      depth: TI_DEPTHS.some((item) => item.id === prefs.depth) ? prefs.depth : store.draft.depth,
      railCollapsed: prefs.railCollapsed === true,
    };
    store.selectedId = typeof parsed.selectedId === 'string' ? parsed.selectedId : '';
    /* 选中项已被删除时清空选择，避免出现“幽灵”报告。 */
    if (store.selectedId && !store.reports.some((entry) => entry.report.id === store.selectedId)) store.selectedId = '';
    return store;
  } catch (error) {
    console.warn('[tech-insight] 读取本地归档失败，已回退默认值', error && error.message);
    return fallback;
  }
}

/** 写入归档：成功返回 {ok:true}，失败（如配额）返回可读原因。 */
function tiWriteStore(store) {
  if (!tiStorageAvailable()) return { ok: false, message: '当前浏览器不支持本地存储，报告无法归档。' };
  try {
    window.localStorage.setItem(TI_STORAGE_KEY, JSON.stringify(store));
    return { ok: true };
  } catch (error) {
    const quota = error && (error.name === 'QuotaExceededError' || error.code === 22 || error.code === 1014);
    return {
      ok: false,
      message: quota ? '本地存储空间不足，归档未保存。可删除旧报告后重试。' : '本地归档写入失败：' + ((error && error.message) || '未知错误'),
    };
  }
}

/* ── Report 结构归一化 ────────────────────────────────────── */

/** 可视化数据兜底：Host 已归一化，这里再防御一次历史数据/手工数据。 */
function tiVisualShort(value, max) {
  return tiTruncate(typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value), max);
}

function tiVisualScore(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function tiVisualArray(value) {
  return Array.isArray(value) ? value : [];
}

function tiNormalizeVisuals(input) {
  if (!input || typeof input !== 'object') return null;
  const out = {};
  const arch = input.architecture;
  if (arch && typeof arch === 'object') {
    const layers = tiVisualArray(arch.layers)
      .slice(0, 5)
      .map((layer) => {
        if (!layer || typeof layer !== 'object') return null;
        const name = tiVisualShort(layer.name, 18);
        const items = tiVisualArray(layer.items)
          .filter((item) => typeof item === 'string' && item.trim())
          .slice(0, 4)
          .map((item) => tiVisualShort(item, 18));
        return name || items.length ? { name: name || '层', items } : null;
      })
      .filter(Boolean);
    if (layers.length >= 2) out.architecture = { title: tiVisualShort(arch.title, 40) || '技术分层架构', layers };
  }
  const difficulty = input.difficulty;
  if (difficulty && typeof difficulty === 'object') {
    const items = tiVisualArray(difficulty.items)
      .slice(0, 6)
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const name = tiVisualShort(item.name, 20);
        return name ? { name, score: tiVisualScore(item.score, 50), reason: tiVisualShort(item.reason, 48) } : null;
      })
      .filter(Boolean);
    if (items.length >= 2) out.difficulty = { title: tiVisualShort(difficulty.title, 40) || '关键难点强度（0–100）', items };
  }
  const matrix = input.matrix;
  if (matrix && typeof matrix === 'object') {
    const items = tiVisualArray(matrix.items)
      .slice(0, 6)
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const name = tiVisualShort(item.name, 18);
        return name ? { name, x: tiVisualScore(item.x, 50), y: tiVisualScore(item.y, 50) } : null;
      })
      .filter(Boolean);
    if (items.length >= 2) {
      out.matrix = {
        title: tiVisualShort(matrix.title, 40) || '场景价值矩阵',
        xLabel: tiVisualShort(matrix.xLabel, 16) || '落地成熟度',
        yLabel: tiVisualShort(matrix.yLabel, 16) || '业务价值',
        items,
      };
    }
  }
  const timeline = input.timeline;
  if (timeline && typeof timeline === 'object') {
    const items = tiVisualArray(timeline.items)
      .slice(0, 6)
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const title = tiVisualShort(item.title, 24);
        return title ? { time: tiVisualShort(item.time, 16), title, detail: tiVisualShort(item.detail, 60) } : null;
      })
      .filter(Boolean);
    if (items.length >= 2) out.timeline = { title: tiVisualShort(timeline.title, 40) || '业界采用时间线', items };
  }
  return Object.keys(out).length ? out : null;
}


/** 把 Host 返回的 report 兜底为可安全渲染的结构（分节固定、缺失补空）。 */
function tiNormalizeReport(input) {
  const source = input && typeof input === 'object' ? input : {};
  const rawSections = Array.isArray(source.sections) ? source.sections : [];
  const byKey = {};
  rawSections.forEach((section) => {
    if (section && typeof section === 'object' && typeof section.key === 'string') byKey[section.key] = section;
  });
  const sections = TI_SECTIONS.map((meta) => {
    const hit = byKey[meta.key];
    return {
      key: meta.key,
      title: hit && typeof hit.title === 'string' && hit.title.trim() ? hit.title.trim() : meta.label,
      body: hit && typeof hit.body === 'string' ? hit.body : '',
    };
  });
  const references = (Array.isArray(source.references) ? source.references : [])
    .filter((item) => item && typeof item === 'object' && /^https?:\/\//i.test(String(item.url || '')))
    .map((item) => ({
      title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : String(item.url),
      url: String(item.url),
      note: typeof item.note === 'string' ? item.note : '',
    }));
  const now = new Date().toISOString();
  return {
    id: typeof source.id === 'string' && source.id ? source.id : tiUid('ti'),
    revision: Number.isFinite(source.revision) && source.revision > 0 ? Math.floor(source.revision) : 1,
    topic: typeof source.topic === 'string' ? source.topic : '',
    title: typeof source.title === 'string' && source.title.trim() ? source.title.trim() : (typeof source.topic === 'string' ? source.topic + '技术洞察' : '技术洞察报告'),
    oneLiner: typeof source.oneLiner === 'string' ? source.oneLiner : '',
    sections,
    references,
    visuals: tiNormalizeVisuals(source.visuals),
    queries: (Array.isArray(source.queries) ? source.queries : []).filter((item) => typeof item === 'string'),
    sourceCount: Number.isFinite(source.sourceCount) ? source.sourceCount : references.length,
    model: typeof source.model === 'string' ? source.model : '',
    createdAt: typeof source.createdAt === 'string' ? source.createdAt : now,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : now,
    generator: typeof source.generator === 'string' ? source.generator : 'tech-insight/1.0',
  };
}

/* ── Markdown 导出 ───────────────────────────────────────── */

/** 把 Report 序列化为可下载的 Markdown 文本。 */
function tiReportToMarkdown(report) {
  const item = tiNormalizeReport(report);
  const lines = [];
  lines.push('# ' + item.title);
  lines.push('');
  if (item.oneLiner) {
    lines.push('> ' + item.oneLiner);
    lines.push('');
  }
  lines.push('- 技术主题：' + (item.topic || '—'));
  lines.push('- 模型：' + (item.model || '—'));
  lines.push('- 版本：v' + item.revision);
  lines.push('- 来源数：' + item.sourceCount);
  lines.push('- 生成时间：' + tiFormatDateTime(item.createdAt));
  if (item.updatedAt && item.updatedAt !== item.createdAt) lines.push('- 最近更新：' + tiFormatDateTime(item.updatedAt));
  lines.push('');
  item.sections.forEach((section) => {
    lines.push('## ' + section.title);
    lines.push('');
    lines.push(section.body || '_（暂无内容）_');
    lines.push('');
  });
  lines.push('## 相关参考');
  lines.push('');
  if (!item.references.length) {
    lines.push('_（暂无参考来源）_');
  } else {
    item.references.forEach((ref, index) => {
      lines.push(index + 1 + '. [' + ref.title + '](' + ref.url + ')' + (ref.note ? ' — ' + ref.note : ''));
    });
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('由 DSH「技术洞察」生成 · ' + tiFormatDateTime(new Date()));
  lines.push('');
  return lines.join('\n');
}

/** 导出文件名：技术洞察-{topic}-{YYYYMMDD}.md */
function tiReportFileName(report) {
  const topic = String((report && report.topic) || '报告').replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '') || '报告';
  return '技术洞察-' + tiTruncate(topic, 40) + '-' + tiFormatFileDay() + '.md';
}

/* ── 剪贴板 / 下载 ───────────────────────────────────────── */

/**
 * 临时节点挂载点：只用于复制兜底与下载触发，用完立即移除。
 * 挂到页面根节点下，用完立即移除；不读取也不覆盖宿主页面结构。
 */
function tiTempMount(node) {
  try {
    const host = document.documentElement;
    if (!host || !node) return false;
    host.appendChild(node);
    return true;
  } catch (error) {
    return false;
  }
}

function tiTempUnmount(node) {
  try {
    if (node && node.parentNode) node.parentNode.removeChild(node);
  } catch (error) {
    /* 节点可能已被移除 */
  }
}

function tiCopyText(text) {
  const value = String(text || '');
  const fallback = () => {
    try {
      if (typeof document === 'undefined') return false;
      const area = document.createElement('textarea');
      area.value = value;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      if (!tiTempMount(area)) return false;
      area.select();
      const ok = document.execCommand('copy');
      tiTempUnmount(area);
      return ok;
    } catch (error) {
      return false;
    }
  };
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(value).then(() => true).catch(fallback);
    }
  } catch (error) {
    /* 走兜底 */
  }
  return Promise.resolve(fallback());
}

/** 用 Blob + 临时 <a download> 触发下载（临时节点用完即移除）。 */
function tiDownloadText(fileName, text) {
  try {
    if (typeof document === 'undefined' || typeof Blob === 'undefined') return false;
    const blob = new Blob([String(text || '')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.style.display = 'none';
    if (!tiTempMount(anchor)) {
      URL.revokeObjectURL(url);
      return false;
    }
    anchor.click();
    window.setTimeout(() => {
      tiTempUnmount(anchor);
      URL.revokeObjectURL(url);
    }, 0);
    return true;
  } catch (error) {
    console.warn('[tech-insight] 导出 Markdown 失败', error && error.message);
    return false;
  }
}

/* ── Host HTTP 请求 ──────────────────────────────────────── */

function tiApiError(code, message) {
  const error = new Error(message || '请求失败');
  error.code = code || 'UNKNOWN';
  return error;
}

/** 同源 JSON 请求；统一把 HTTP/业务错误转成带 code 的 Error。 */
async function tiFetchJson(path, options) {
  const init = options || {};
  let response;
  try {
    response = await fetch(path, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...init,
      headers: { accept: 'application/json', ...(init.headers || {}) },
    });
  } catch (error) {
    throw tiApiError('NETWORK', '无法连接本地 Host 路由：' + ((error && error.message) || '网络错误'));
  }
  let data = null;
  try {
    const raw = await response.text();
    data = raw ? JSON.parse(raw) : {};
  } catch (error) {
    data = null;
  }
  if (!response.ok) {
    const failureMessage = data && data.error && data.error.message ? data.error.message : 'HTTP ' + response.status;
    throw tiApiError(data && data.error && data.error.code ? data.error.code : 'HTTP_' + response.status, failureMessage);
  }
  if (!data || data.ok !== true) {
    const failureMessage = data && data.error && data.error.message ? data.error.message : 'Host 返回了无法识别的响应';
    throw tiApiError(data && data.error && data.error.code ? data.error.code : 'BAD_RESPONSE', failureMessage);
  }
  return data;
}

/** 读取状态；失败时静默降级（不阻塞页面，chip 显示“状态未知”）。 */
async function tiFetchStatus() {
  try {
    const data = await tiFetchJson(TI_PATHS.status, { method: 'GET' });
    return {
      state: 'ok',
      ready: data.ready === true,
      provider: typeof data.provider === 'string' ? data.provider : '',
      model: typeof data.model === 'string' ? data.model : '',
      modelName: typeof data.modelName === 'string' ? data.modelName : '',
      webReady: data.webReady === true,
      fetchReady: data.fetchReady === true,
      version: typeof data.version === 'string' ? data.version : '',
      message: typeof data.message === 'string' ? data.message : '',
    };
  } catch (error) {
    return { state: 'unknown', ready: false, webReady: false, fetchReady: false, message: (error && error.message) || '状态未知' };
  }
}

/* ── 后台任务 API ───────────────────────────────────────── */
/* 生成在 Host 后台执行，浏览器只负责启动/轮询/取消；页面切换不会中断任务。 */

async function tiStartJob(kind, payload) {
  const path = kind === 'refine' ? TI_PATHS.refine : TI_PATHS.insight;
  const data = await tiFetchJson(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  if (!data.job || typeof data.job.id !== 'string') throw tiApiError('BAD_JOB', 'Host 没有返回后台任务 id');
  return data.job;
}

async function tiFetchJob(id) {
  const query = id ? '?id=' + encodeURIComponent(id) : '';
  const data = await tiFetchJson(TI_PATHS.job + query, { method: 'GET' });
  return data.job || null;
}

/** 最近一个后台任务（优先运行中），用于页面重新挂载后续接。 */
async function tiFetchLatestJob() {
  return tiFetchJob('');
}

async function tiCancelJob(id) {
  const data = await tiFetchJson(TI_PATHS.cancel, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  return data.job || null;
}

/* ── SSE 流式请求 ───────────────────────────────────────── */

/** 解析一个 SSE 帧（event + 多行 data）。 */
function tiParseSseFrame(raw) {
  let eventName = 'message';
  const dataLines = [];
  raw.split('\n').forEach((line) => {
    if (!line || line.charAt(0) === ':') return;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.charAt(0) === ' ') value = value.slice(1);
    if (field === 'event') eventName = value;
    else if (field === 'data') dataLines.push(value);
  });
  if (!dataLines.length) return null;
  let data = null;
  try {
    data = JSON.parse(dataLines.join('\n'));
  } catch (error) {
    data = null;
  }
  return { event: eventName, data: data && typeof data === 'object' ? data : {} };
}

/**
 * POST 一个 SSE 接口并逐帧回调。
 * - 非 text/event-stream（或 HTTP 非 2xx）时按 JSON 错误解析；
 * - 收到 error 事件立即抛出；
 * - 流结束仍未收到 report 视为失败；
 * - 返回归一化后的 Report。
 */
async function tiSseRequest(path, payload, options) {
  const settings = options || {};
  const signal = settings.signal;
  const onEvent = typeof settings.onEvent === 'function' ? settings.onEvent : null;

  let response;
  try {
    response = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { accept: 'text/event-stream', 'content-type': 'application/json' },
      body: JSON.stringify(payload || {}),
      signal,
    });
  } catch (error) {
    if (error && error.name === 'AbortError') throw error;
    throw tiApiError('NETWORK', '无法连接本地 Host 路由：' + ((error && error.message) || '网络错误'));
  }

  const contentType = String((response.headers && response.headers.get && response.headers.get('content-type')) || '').toLowerCase();
  if (!response.ok || contentType.indexOf('text/event-stream') === -1) {
    let data = null;
    try {
      const raw = await response.text();
      data = raw ? JSON.parse(raw) : null;
    } catch (error) {
      data = null;
    }
    const message = data && data.error && data.error.message ? data.error.message : 'HTTP ' + response.status;
    throw tiApiError(data && data.error && data.error.code ? data.error.code : 'HTTP_' + response.status, message);
  }

  if (!response.body || typeof response.body.getReader !== 'function') {
    throw tiApiError('NO_STREAM', '当前浏览器不支持流式响应，请升级浏览器后重试。');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalReport = null;

  const consumeFrame = (frame) => {
    if (!frame) return;
    if (frame.event === 'error') {
      const detail = frame.data || {};
      throw tiApiError(detail.code || 'SSE_ERROR', detail.message || '生成过程中发生未知错误');
    }
    if (onEvent) onEvent(frame.event, frame.data || {});
    if (frame.event === 'report' && frame.data && frame.data.report) {
      finalReport = tiNormalizeReport(frame.data.report);
    }
  };

  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n');
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const rawFrame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        consumeFrame(tiParseSseFrame(rawFrame));
        boundary = buffer.indexOf('\n\n');
      }
    }
    buffer += decoder.decode();
    buffer = buffer.replace(/\r\n/g, '\n');
    if (buffer.trim()) consumeFrame(tiParseSseFrame(buffer.trim()));
  } catch (error) {
    if (error && error.name === 'AbortError') throw error;
    throw error;
  } finally {
    try {
      reader.releaseLock();
    } catch (error) {
      /* 忽略释放失败 */
    }
  }

  if (!finalReport) throw tiApiError('NO_REPORT', '生成结束但没有收到完整报告，请重试。');
  return finalReport;
}

/* ── 生成任务辅助（只依赖纯数据，便于 Page 复用） ────────── */

function tiEmptyJob() {
  return {
    kind: 'insight',
    topic: '',
    focus: '',
    depth: 'standard',
    instruction: '',
    useWeb: true,
    stage: '',
    stageLabel: '准备中',
    progress: 0,
    queries: [],
    sources: [],
    startedAt: Date.now(),
  };
}

/** 按 url 去重追加来源，最多保留 max 条。 */
function tiMergeSources(previous, incoming, max) {
  const list = Array.isArray(previous) ? previous.slice() : [];
  const seen = {};
  list.forEach((item) => {
    if (item && item.url) seen[item.url] = true;
  });
  (Array.isArray(incoming) ? incoming : []).forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const url = String(item.url || '').trim();
    if (!url || seen[url]) return;
    if (!/^https?:\/\//i.test(url)) return;
    seen[url] = true;
    list.push({
      title: String(item.title || url),
      url: url,
      snippet: typeof item.snippet === 'string' ? item.snippet : '',
      site: typeof item.site === 'string' ? item.site : '',
    });
  });
  return list.slice(0, Math.max(1, Number(max) || 12));
}

/** 从 url 提取站点名，作为来源列表的副标题兜底。 */
function tiSiteOf(source) {
  if (source && source.site) return source.site;
  try {
    return new URL(source.url).hostname.replace(/^www\./, '');
  } catch (error) {
    return '';
  }
}
