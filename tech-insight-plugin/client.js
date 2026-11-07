/* Generated from src/*.js by build.mjs — do not edit by hand. */
window.__ModuleLoader__.load({
  id: '@local/dsh-tech-insight',
  factory(require) {
    const React = require('react');
    const e = React.createElement;
    const { useState, useEffect, useMemo, useRef, useCallback } = React;

/* ── 00-core.js ── */
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


/* ── 10-ui.js ── */
/* ─────────────────────────────────────────────────────────────
 * 技术洞察 · UI 层
 * 全局样式（.ti- 前缀）与通用原语：图标、按钮、chip、弹窗、Toast、空态、
 * 安全 markdown-lite 渲染（只生成 React 元素，不做 HTML 注入）。
 * ───────────────────────────────────────────────────────────── */

const TI_CSS = `
.ti-root {
  --ti-bg: var(--dsw-alias-bg-base);
  --ti-layer: var(--dsw-alias-bg-layer-1);
  --ti-layer2: var(--dsw-alias-bg-layer-2);
  --ti-sidebar: var(--dsw-specific-sidebar-fill);
  --ti-text: var(--dsw-alias-label-primary);
  --ti-sub: var(--dsw-alias-label-secondary);
  --ti-tert: var(--dsw-alias-label-secondary);
  --ti-border: var(--dsw-alias-border-l1);
  --ti-border2: var(--dsw-alias-border-l2);
  --ti-brand: var(--dsw-alias-brand-primary);
  --ti-danger: var(--dsw-alias-state-error-primary);
  --ti-success: var(--dsw-alias-state-success-primary);
  --ti-warn: var(--dsw-alias-state-warn-primary);
  --ti-idle: var(--dsw-alias-state-idle-primary);
  --ti-accent: #0EA5E9;
  --ti-accent-soft: color-mix(in srgb, var(--ti-accent) 12%, transparent);
  --ti-accent-line: color-mix(in srgb, var(--ti-accent) 26%, transparent);
  --ti-accent-glow: color-mix(in srgb, var(--ti-accent) 32%, transparent);
  --ti-figure-fill: color-mix(in srgb, var(--ti-layer2) 76%, transparent);
  --ti-figure-stroke: color-mix(in srgb, var(--ti-border2) 88%, transparent);
  --ti-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 100%;
  overflow: hidden;
  color: var(--ti-text);
  background:
    radial-gradient(1100px 460px at 8% -12%, var(--ti-accent-soft), transparent 62%),
    radial-gradient(880px 420px at 100% 0%, color-mix(in srgb, var(--ti-brand) 5%, transparent), transparent 58%),
    var(--ti-bg);
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
.ti-root, .ti-root * { box-sizing: border-box; }
.ti-root :where(button, input, textarea, select) { font: inherit; color: inherit; }
.ti-root button { cursor: pointer; }
.ti-root ::selection { background: var(--ti-accent-glow); }
.ti-root ::-webkit-scrollbar { width: 10px; height: 10px; }
.ti-root ::-webkit-scrollbar-thumb { background: var(--ti-border2); border: 3px solid transparent; border-radius: 999px; background-clip: content-box; }
.ti-root ::-webkit-scrollbar-thumb:hover { background: var(--ti-sub); background-clip: content-box; }
.ti-root ::-webkit-scrollbar-track { background: transparent; }

.ti-inner {
  width: min(1560px, 100%);
  height: 100%;
  min-height: 0;
  margin: 0 auto;
  padding: calc(var(--dsh-frame-top-clearance, 0px) + 18px) 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ── header ─────────────────────────────────────────────── */
.ti-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; flex: none; }
.ti-brand { display: flex; align-items: center; gap: 13px; min-width: 0; }
.ti-logo {
  width: 44px; height: 44px; flex: none; border-radius: 13px;
  display: grid; place-items: center; color: #fff;
  background: linear-gradient(145deg, var(--ti-accent), color-mix(in srgb, var(--ti-accent) 58%, var(--dsw-alias-bg-overlay)));
  box-shadow: 0 10px 22px -12px var(--ti-accent-glow), inset 0 1px 0 rgba(255, 255, 255, .26);
  position: relative; overflow: hidden;
}
.ti-logo::after {
  content: ''; position: absolute; inset: -42% -10% auto auto; width: 72%; height: 90%;
  background: radial-gradient(circle, rgba(255, 255, 255, .38), transparent 68%);
  transform: rotate(18deg);
}
.ti-logo svg { position: relative; z-index: 1; }
.ti-title-row { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
.ti-title { margin: 0; font-size: 21px; line-height: 1.25; font-weight: 680; letter-spacing: -.02em; }
.ti-sub { margin: 3px 0 0; color: var(--ti-sub); font-size: 12.5px; max-width: 780px; }
.ti-head-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; flex: none; }

/* ── status chips ──────────────────────────────────────── */
.ti-chips { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.ti-chip {
  display: inline-flex; align-items: center; gap: 5px;
  height: 24px; padding: 0 9px; border-radius: 999px;
  border: 1px solid var(--ti-border); background: color-mix(in srgb, var(--ti-layer) 76%, transparent);
  color: var(--ti-sub); font-size: 11px; font-weight: 560; white-space: nowrap;
}
.ti-chip svg { flex: none; }
.ti-chip-brand { color: var(--ti-accent); border-color: var(--ti-accent-line); background: var(--ti-accent-soft); }
.ti-chip-good { color: var(--ti-success); border-color: color-mix(in srgb, var(--ti-success) 28%, transparent); background: color-mix(in srgb, var(--ti-success) 10%, transparent); }
.ti-chip-warn { color: var(--ti-warn); border-color: color-mix(in srgb, var(--ti-warn) 28%, transparent); background: color-mix(in srgb, var(--ti-warn) 10%, transparent); }
.ti-chip-idle { color: var(--ti-idle); border-color: color-mix(in srgb, var(--ti-idle) 26%, transparent); background: color-mix(in srgb, var(--ti-idle) 8%, transparent); }
.ti-chip-danger { color: var(--ti-danger); border-color: color-mix(in srgb, var(--ti-danger) 28%, transparent); background: color-mix(in srgb, var(--ti-danger) 9%, transparent); }
.ti-chip-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

/* ── buttons ───────────────────────────────────────────── */
.ti-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 34px; padding: 0 13px; border-radius: 10px;
  border: 1px solid transparent; background: transparent; color: var(--ti-text);
  font-size: 12.5px; font-weight: 560; white-space: nowrap; user-select: none;
  transition: transform .15s ease, background .15s ease, border-color .15s ease, box-shadow .15s ease, opacity .15s ease, color .15s ease;
}
.ti-btn:hover { transform: translateY(-1px); }
.ti-btn:active { transform: translateY(0); }
.ti-btn:disabled { opacity: .42; cursor: not-allowed; transform: none; }
.ti-btn:focus-visible { outline: 2px solid var(--ti-accent); outline-offset: 2px; }
.ti-btn-sm { height: 28px; padding: 0 10px; font-size: 12px; border-radius: 8px; gap: 4px; }
.ti-btn-primary {
  color: #fff;
  background: linear-gradient(135deg, var(--ti-accent), color-mix(in srgb, var(--ti-accent) 62%, var(--dsw-alias-bg-overlay)));
  box-shadow: 0 8px 18px -10px var(--ti-accent-glow), inset 0 1px 0 rgba(255, 255, 255, .22);
}
.ti-btn-primary span, .ti-btn-primary svg { color: #fff; }
.ti-btn-primary:hover { box-shadow: 0 12px 24px -10px var(--ti-accent-glow), inset 0 1px 0 rgba(255, 255, 255, .3); }
.ti-btn-soft { color: var(--ti-accent); background: var(--ti-accent-soft); }
.ti-btn-soft:hover { background: color-mix(in srgb, var(--ti-accent) 18%, transparent); }
.ti-btn-ghost { color: var(--ti-sub); border-color: var(--ti-border); background: var(--ti-layer); }
.ti-btn-ghost:hover { color: var(--ti-text); border-color: var(--ti-border2); background: var(--ti-layer2); }
.ti-btn-danger { color: var(--ti-danger); border-color: color-mix(in srgb, var(--ti-danger) 26%, transparent); background: transparent; }
.ti-btn-danger:hover { background: color-mix(in srgb, var(--ti-danger) 9%, transparent); }
.ti-btn-icon { width: 34px; padding: 0; }
.ti-btn-icon.ti-btn-sm { width: 28px; }
.ti-iconbtn {
  width: 28px; height: 28px; display: inline-grid; place-items: center; flex: none;
  border: 1px solid transparent; background: transparent; border-radius: 8px; color: var(--ti-sub);
  transition: background .15s ease, color .15s ease, border-color .15s ease, opacity .15s ease;
}
.ti-iconbtn:hover { background: var(--ti-layer2); color: var(--ti-text); border-color: var(--ti-border); }
.ti-iconbtn:focus-visible { outline: 2px solid var(--ti-accent); outline-offset: 2px; }
.ti-iconbtn.danger:hover { color: var(--ti-danger); background: color-mix(in srgb, var(--ti-danger) 10%, transparent); border-color: color-mix(in srgb, var(--ti-danger) 22%, transparent); }
.ti-iconbtn:disabled { opacity: .35; cursor: not-allowed; }

/* ── layout body ───────────────────────────────────────── */
.ti-body { flex: 1; min-height: 0; display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 16px; }
.ti-rail {
  display: flex; flex-direction: column; min-height: 0; overflow: hidden;
  border: 1px solid var(--ti-border); border-radius: 15px;
  background: color-mix(in srgb, var(--ti-layer) 82%, transparent);
}
.ti-rail-head { padding: 12px 12px 9px; display: flex; flex-direction: column; gap: 8px; flex: none; border-bottom: 1px solid var(--ti-border); }
.ti-rail-head-actions { display: flex; align-items: center; gap: 4px; flex: none; }
.ti-rail-title-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ti-rail-title { font-size: 12px; font-weight: 650; letter-spacing: .02em; }
.ti-rail-count { color: var(--ti-sub); font-size: 11px; font-variant-numeric: tabular-nums; }
.ti-rail-list { flex: 1; min-height: 0; overflow: auto; padding: 6px; display: flex; flex-direction: column; gap: 4px; }
.ti-item-pending { border-style: dashed; border-color: var(--ti-accent-line); background: color-mix(in srgb, var(--ti-accent) 6%, transparent); }
.ti-pending-tag {
  display: inline-flex; align-items: center; gap: 5px;
  color: var(--ti-accent); font-size: 10.5px; font-weight: 650; white-space: nowrap;
}
.ti-pending-tag .ti-spinner { width: 10px; height: 10px; border-width: 1.6px; }

.ti-rail-empty { padding: 26px 16px; text-align: center; color: var(--ti-sub); font-size: 12px; line-height: 1.7; }
.ti-search { position: relative; }
.ti-search svg { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); color: var(--ti-sub); pointer-events: none; }
.ti-search input {
  width: 100%; height: 31px; padding: 0 10px 0 29px;
  border: 1px solid var(--ti-border); border-radius: 9px;
  background: var(--ti-layer2); color: var(--ti-text); font-size: 12px; outline: none;
  transition: border-color .16s ease, box-shadow .16s ease;
}
.ti-search input::placeholder { color: var(--ti-sub); }
.ti-search input:focus { border-color: var(--ti-accent); box-shadow: 0 0 0 3px var(--ti-accent-soft); }

/* ── archive items ─────────────────────────────────────── */
.ti-item {
  display: block; width: 100%; text-align: left; position: relative;
  border-radius: 10px; border: 1px solid transparent;
  background: transparent; color: var(--ti-text);
  transition: background .15s ease, border-color .15s ease;
}
.ti-item:hover { background: var(--ti-layer2); border-color: var(--ti-border); }
.ti-item-main {
  display: block; width: 100%; text-align: left; padding: 9px 10px;
  border: 0; border-radius: inherit; background: transparent; color: inherit;
}
.ti-item-main:focus-visible { outline: 2px solid var(--ti-accent); outline-offset: 1px; }
.ti-item.on { background: var(--ti-accent-soft); border-color: var(--ti-accent-line); }
.ti-item-title {
  font-size: 12.5px; font-weight: 600; line-height: 1.42;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  padding-right: 22px;
}
.ti-item-meta { margin-top: 4px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; color: var(--ti-sub); font-size: 10.5px; }
.ti-item-meta b { font-weight: 600; color: var(--ti-sub); }
.ti-item-dot { width: 3px; height: 3px; border-radius: 50%; background: var(--ti-border2); }
.ti-item-del {
  position: absolute; top: 7px; right: 6px; width: 22px; height: 22px;
  display: grid; place-items: center; border: 0; border-radius: 6px;
  background: transparent; color: var(--ti-sub); opacity: 0;
  transition: opacity .14s ease, background .14s ease, color .14s ease;
}
.ti-item:hover .ti-item-del, .ti-item:focus-within .ti-item-del { opacity: 1; }
.ti-item-del:hover { background: color-mix(in srgb, var(--ti-danger) 12%, transparent); color: var(--ti-danger); }
.ti-item-del:focus-visible { opacity: 1; outline: 2px solid var(--ti-accent); outline-offset: 1px; }

/* ── main scroll area ──────────────────────────────────── */
.ti-main { min-height: 0; overflow: auto; padding: 2px 4px 8px 2px; display: flex; flex-direction: column; }
/* 报告区铺满可用宽度，避免宽屏下右侧大片留白 */
.ti-main-inner { display: flex; flex-direction: column; gap: 14px; width: 100%; min-height: 100%; flex: 1; }
.ti-anim { animation: ti-rise .22s cubic-bezier(.2, .75, .25, 1) both; }

/* ── generator / empty ─────────────────────────────────── */
.ti-generator { display: flex; flex-direction: column; gap: 16px; }
.ti-gen-hero {
  border: 1px solid var(--ti-border); border-radius: 16px;
  background:
    radial-gradient(620px 260px at 100% 0%, var(--ti-accent-soft), transparent 68%),
    color-mix(in srgb, var(--ti-layer) 88%, transparent);
  padding: 24px; display: flex; flex-direction: column; gap: 6px;
}
.ti-gen-kicker { display: inline-flex; align-items: center; gap: 7px; color: var(--ti-accent); font-size: 11px; font-weight: 640; letter-spacing: .08em; text-transform: uppercase; }
.ti-gen-title { margin: 6px 0 2px; font-size: clamp(22px, 2.3vw, 28px); line-height: 1.2; font-weight: 700; letter-spacing: -.03em; }
.ti-gen-desc { margin: 0; color: var(--ti-sub); font-size: 13px; max-width: 620px; }
.ti-gen-card {
  border: 1px solid var(--ti-border); border-radius: 16px; padding: 20px;
  background: color-mix(in srgb, var(--ti-layer) 86%, transparent);
  display: flex; flex-direction: column; gap: 14px;
}
.ti-label { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; color: var(--ti-sub); font-size: 11.5px; font-weight: 580; }
.ti-label em { font-style: normal; color: var(--ti-danger); margin-left: 2px; }
.ti-label-tip { color: var(--ti-sub); font-size: 10.5px; font-weight: 500; }
.ti-input, .ti-textarea {
  width: 100%; border: 1px solid var(--ti-border); border-radius: 11px;
  background: var(--ti-layer2); color: var(--ti-text); padding: 10px 12px;
  font-size: 13px; line-height: 1.6; outline: none;
  transition: border-color .16s ease, box-shadow .16s ease, background .16s ease;
}
.ti-textarea { resize: vertical; min-height: 64px; }
.ti-input:focus, .ti-textarea:focus { border-color: var(--ti-accent); background: var(--ti-layer); box-shadow: 0 0 0 3px var(--ti-accent-soft); }
.ti-input::placeholder, .ti-textarea::placeholder { color: var(--ti-sub); }
.ti-textarea.ti-topic { min-height: 54px; max-height: 140px; font-size: 15px; }
.ti-gen-row { display: flex; flex-direction: column; gap: 6px; }
.ti-depth-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ti-depth {
  display: inline-flex; align-items: baseline; gap: 6px;
  padding: 7px 12px; border-radius: 10px; border: 1px solid var(--ti-border);
  background: var(--ti-layer2); color: var(--ti-sub); font-size: 12px; font-weight: 560;
  transition: background .15s ease, border-color .15s ease, color .15s ease, box-shadow .15s ease;
}
.ti-depth small { color: var(--ti-sub); font-size: 10.5px; font-weight: 500; }
.ti-depth:hover { color: var(--ti-text); border-color: var(--ti-border2); }
.ti-depth:focus-visible { outline: 2px solid var(--ti-accent); outline-offset: 2px; }
.ti-depth.on { color: var(--ti-accent); border-color: var(--ti-accent); background: var(--ti-accent-soft); box-shadow: 0 0 0 3px var(--ti-accent-soft); }
.ti-depth.on small { color: var(--ti-accent); opacity: .8; }
.ti-gen-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding-top: 2px; }
.ti-examples { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; color: var(--ti-sub); font-size: 11px; }
.ti-example {
  height: 24px; padding: 0 9px; border-radius: 999px; border: 1px dashed var(--ti-border2);
  background: transparent; color: var(--ti-sub); font-size: 11px;
  transition: color .15s ease, border-color .15s ease, background .15s ease;
}
.ti-example:hover { color: var(--ti-accent); border-color: var(--ti-accent-line); background: var(--ti-accent-soft); }
.ti-example:focus-visible { outline: 2px solid var(--ti-accent); outline-offset: 2px; }
.ti-hint { color: var(--ti-sub); font-size: 10.5px; line-height: 1.5; }
.ti-error-text { color: var(--ti-danger); font-size: 11.5px; }

/* ── progress ──────────────────────────────────────────── */
.ti-progress-card {
  border: 1px solid var(--ti-border); border-radius: 16px; padding: 22px;
  background: color-mix(in srgb, var(--ti-layer) 88%, transparent);
  display: flex; flex-direction: column; gap: 18px;
}
.ti-progress-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.ti-progress-title { margin: 0; font-size: 16px; font-weight: 660; letter-spacing: -.015em; }
.ti-progress-sub { margin: 3px 0 0; color: var(--ti-sub); font-size: 12px; }
.ti-progress-time { color: var(--ti-sub); font-size: 12px; font-variant-numeric: tabular-nums; display: inline-flex; align-items: center; gap: 5px; }
.ti-bar { height: 6px; border-radius: 999px; background: var(--ti-layer2); overflow: hidden; }
.ti-bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--ti-accent), color-mix(in srgb, var(--ti-accent) 62%, var(--ti-brand))); transition: width .35s ease; }
.ti-steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.ti-step {
  border: 1px solid var(--ti-border); border-radius: 11px; padding: 10px 11px;
  background: color-mix(in srgb, var(--ti-layer2) 64%, transparent);
  display: flex; flex-direction: column; gap: 3px; min-width: 0;
  transition: border-color .2s ease, background .2s ease;
}
.ti-step-head { display: flex; align-items: center; gap: 6px; color: var(--ti-sub); font-size: 12px; font-weight: 600; }
.ti-step-index {
  width: 17px; height: 17px; flex: none; border-radius: 50%;
  display: grid; place-items: center; font-size: 9.5px; font-weight: 700;
  border: 1px solid var(--ti-border2); color: var(--ti-sub); background: transparent;
}
.ti-step-hint { color: var(--ti-sub); font-size: 10.5px; line-height: 1.4; }
.ti-step.on { border-color: var(--ti-accent-line); background: var(--ti-accent-soft); }
.ti-step.on .ti-step-head { color: var(--ti-text); }
.ti-step.on .ti-step-index { border-color: var(--ti-accent); background: var(--ti-accent); color: #fff; }
.ti-step.done .ti-step-head { color: var(--ti-sub); }
.ti-step.done .ti-step-index { border-color: color-mix(in srgb, var(--ti-success) 40%, transparent); color: var(--ti-success); background: color-mix(in srgb, var(--ti-success) 12%, transparent); }
.ti-progress-panel { border-top: 1px solid var(--ti-border); padding-top: 14px; display: flex; flex-direction: column; gap: 8px; }
.ti-progress-panel-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 11.5px; font-weight: 620; color: var(--ti-sub); }
.ti-queries { display: flex; flex-wrap: wrap; gap: 6px; }
.ti-query { padding: 2px 8px; border-radius: 999px; background: var(--ti-layer2); border: 1px solid var(--ti-border); color: var(--ti-sub); font-size: 10.5px; }
.ti-sources { display: flex; flex-direction: column; gap: 5px; max-height: 232px; overflow: auto; }
.ti-source { display: flex; align-items: flex-start; gap: 8px; padding: 7px 9px; border-radius: 9px; background: color-mix(in srgb, var(--ti-layer2) 70%, transparent); border: 1px solid transparent; }
.ti-source-index { flex: none; width: 16px; height: 16px; margin-top: 1px; border-radius: 5px; display: grid; place-items: center; background: var(--ti-accent-soft); color: var(--ti-accent); font-size: 9.5px; font-weight: 700; }
.ti-source-main { min-width: 0; flex: 1; }
.ti-source-title { font-size: 11.5px; font-weight: 560; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
.ti-source-site { color: var(--ti-sub); font-size: 10px; }
.ti-skeleton { border-radius: 8px; background: linear-gradient(90deg, var(--ti-layer2) 25%, color-mix(in srgb, var(--ti-layer2) 55%, var(--ti-layer)) 45%, var(--ti-layer2) 65%); background-size: 220% 100%; animation: ti-shimmer 1.3s ease infinite; }
.ti-skeleton-row { height: 34px; }

/* ── report ────────────────────────────────────────────── */
.ti-report { display: flex; flex-direction: column; gap: 14px; flex: 1; min-height: 0; }
.ti-report-foot {
  margin-top: auto; padding-top: 12px; border-top: 1px dashed var(--ti-border);
  display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;
  color: var(--ti-sub); font-size: 11px;
}
.ti-report-foot-actions { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.ti-report-head {
  border: 1px solid var(--ti-border); border-radius: 16px; padding: 20px 22px;
  background:
    radial-gradient(680px 240px at 100% -20%, var(--ti-accent-soft), transparent 66%),
    color-mix(in srgb, var(--ti-layer) 88%, transparent);
  display: flex; flex-direction: column; gap: 10px;
}
.ti-report-kicker { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; color: var(--ti-sub); font-size: 11px; }
.ti-report-title { margin: 0; font-size: clamp(20px, 2.1vw, 25px); line-height: 1.3; font-weight: 700; letter-spacing: -.025em; }
.ti-report-oneliner { margin: 0; color: var(--ti-sub); font-size: 13px; line-height: 1.7; max-width: 860px; }
.ti-report-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; color: var(--ti-sub); font-size: 11px; }
.ti-report-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-top: 4px; }
.ti-report-actions .ti-spacer { flex: 1; }
.ti-spacer { flex: 1; }
.ti-tabs { display: inline-flex; align-items: center; gap: 3px; padding: 3px; border-radius: 10px; background: var(--ti-layer2); border: 1px solid var(--ti-border); }
.ti-tab {
  height: 26px; padding: 0 11px; border-radius: 7px; border: 0; background: transparent;
  color: var(--ti-sub); font-size: 11.5px; font-weight: 560;
  display: inline-flex; align-items: center; gap: 5px;
  transition: background .15s ease, color .15s ease;
}
.ti-tab:hover { color: var(--ti-text); }
.ti-tab:focus-visible { outline: 2px solid var(--ti-accent); outline-offset: 1px; }
.ti-tab.on { background: var(--ti-layer); color: var(--ti-text); box-shadow: 0 1px 2px color-mix(in srgb, var(--ti-text) 8%, transparent); }
.ti-tab-badge { min-width: 16px; height: 16px; padding: 0 4px; border-radius: 999px; display: inline-grid; place-items: center; background: var(--ti-accent-soft); color: var(--ti-accent); font-size: 9.5px; font-weight: 700; }

/* 分节卡片 */
/* 报告正文固定单列，避免分节并排导致的阅读断点 */
.ti-sections { display: flex; flex-direction: column; gap: 12px; }
.ti-section {
  border: 1px solid var(--ti-border); border-radius: 14px;
  background: color-mix(in srgb, var(--ti-layer) 86%, transparent);
  overflow: hidden; transition: border-color .18s ease, box-shadow .18s ease;
}
.ti-section:hover { border-color: var(--ti-border2); }
.ti-section.collapsed .ti-section-body { display: none; }
.ti-section-head { display: flex; align-items: center; gap: 9px; padding: 12px 13px; }
.ti-section-badge {
  width: 28px; height: 28px; flex: none; border-radius: 9px; display: grid; place-items: center;
  background: var(--ti-accent-soft); color: var(--ti-accent); border: 1px solid var(--ti-accent-line);
}
.ti-section-head-main { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 7px; }
.ti-section-title { margin: 0; font-size: 13px; font-weight: 650; letter-spacing: -.01em; }
.ti-section-key { color: var(--ti-sub); font-size: 9.5px; letter-spacing: .06em; text-transform: uppercase; }
.ti-section-tools { display: flex; align-items: center; gap: 2px; flex: none; }
.ti-section-body { padding: 2px 15px 15px; }
.ti-section-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.ti-empty-body { color: var(--ti-sub); font-size: 12px; padding: 12px 0 4px; }

/* 归档目录收起后的窄条 */
.ti-body.rail-collapsed { grid-template-columns: 42px minmax(0, 1fr); }
.ti-rail-toggle {
  width: 100%; height: 100%; min-height: 140px; padding: 12px 0;
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  border: 1px solid var(--ti-border); border-radius: 14px;
  background: color-mix(in srgb, var(--ti-layer) 86%, transparent);
  color: var(--ti-sub); cursor: pointer;
  transition: color .15s ease, border-color .15s ease, background .15s ease;
}
.ti-rail-toggle:hover { color: var(--ti-text); border-color: var(--ti-border2); background: var(--ti-layer2); }
.ti-rail-toggle:focus-visible { outline: 2px solid var(--ti-accent); outline-offset: 1px; }
.ti-rail-toggle-label { writing-mode: vertical-rl; letter-spacing: .2em; font-size: 11px; }
.ti-rail-toggle-count {
  min-width: 18px; height: 18px; padding: 0 4px; border-radius: 999px;
  display: inline-grid; place-items: center; font-size: 10px; font-weight: 700;
  color: var(--ti-accent); background: var(--ti-accent-soft); border: 1px solid var(--ti-accent-line);
}

/* 内联 SVG 图 */
.ti-figure {
  margin: 2px 0 14px; border: 1px solid var(--ti-border); border-radius: 12px;
  background: color-mix(in srgb, var(--ti-layer2) 58%, transparent); overflow: hidden;
}
.ti-figure-head {
  display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
  padding: 9px 12px; border-bottom: 1px dashed var(--ti-border);
}
.ti-figure-badge {
  width: 22px; height: 22px; flex: none; border-radius: 7px; display: grid; place-items: center;
  color: var(--ti-accent); background: var(--ti-accent-soft); border: 1px solid var(--ti-accent-line);
}
.ti-figure-title { font-size: 12px; font-weight: 650; color: var(--ti-text); }
.ti-figure-hint { margin-left: auto; font-size: 10.5px; color: var(--ti-sub); }
.ti-figure-canvas { padding: 10px 12px 12px; overflow-x: auto; }
.ti-svg { display: block; width: 100%; height: auto; min-width: 500px; font-family: inherit; }
.ti-svg text { font-family: inherit; }

/* markdown-lite */
.ti-rich { color: var(--ti-text); font-size: 12.5px; line-height: 1.75; overflow-wrap: anywhere; }
.ti-rich p { margin: 0 0 9px; }
.ti-rich p:last-child { margin-bottom: 0; }
.ti-rich h4 { margin: 13px 0 6px; font-size: 12.5px; font-weight: 680; color: var(--ti-text); }
.ti-rich h4:first-child { margin-top: 0; }
.ti-rich strong { font-weight: 650; }
.ti-rich code { font-family: var(--ti-mono); font-size: 11px; padding: 1px 5px; border-radius: 5px; background: var(--ti-layer2); border: 1px solid var(--ti-border); }
.ti-rich a { color: var(--ti-accent); text-decoration: none; border-bottom: 1px solid var(--ti-accent-line); }
.ti-rich a:hover { border-bottom-color: var(--ti-accent); }
.ti-rich ul, .ti-rich ol { margin: 0 0 9px; padding-left: 20px; display: flex; flex-direction: column; gap: 3px; }
.ti-rich li { line-height: 1.7; }
.ti-rich li::marker { color: var(--ti-accent); }
.ti-rich-empty { color: var(--ti-sub); font-size: 12px; margin: 0; }

/* 参考 */
.ti-refs {
  border: 1px solid var(--ti-border); border-radius: 14px; padding: 16px 18px;
  background: color-mix(in srgb, var(--ti-layer) 84%, transparent);
  display: flex; flex-direction: column; gap: 9px;
}
.ti-refs-head { display: flex; align-items: center; gap: 8px; }
.ti-refs-title { margin: 0; font-size: 13px; font-weight: 650; }
.ti-refs-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; }
.ti-ref { display: flex; align-items: flex-start; gap: 9px; padding: 7px 9px; border-radius: 9px; border: 1px solid transparent; background: color-mix(in srgb, var(--ti-layer2) 55%, transparent); }
.ti-ref-index { flex: none; width: 18px; height: 18px; margin-top: 1px; border-radius: 6px; display: grid; place-items: center; background: var(--ti-layer); border: 1px solid var(--ti-border); color: var(--ti-sub); font-size: 9.5px; font-weight: 700; font-variant-numeric: tabular-nums; }
.ti-ref-main { min-width: 0; flex: 1; }
.ti-ref-link { display: inline-flex; align-items: flex-start; gap: 4px; color: var(--ti-accent); font-size: 12px; font-weight: 560; line-height: 1.5; text-decoration: none; word-break: break-all; }
.ti-ref-link:hover { text-decoration: underline; }
.ti-ref-link svg { flex: none; margin-top: 2px; }
.ti-ref-note { margin-top: 1px; color: var(--ti-sub); font-size: 11px; line-height: 1.55; }
.ti-ref-url { color: var(--ti-sub); font-size: 10px; font-family: var(--ti-mono); opacity: .75; word-break: break-all; }

/* ── history ──────────────────────────────────────────── */
.ti-history { display: flex; flex-direction: column; gap: 12px; }
.ti-history-head { border: 1px solid var(--ti-border); border-radius: 14px; padding: 16px 18px; background: color-mix(in srgb, var(--ti-layer) 86%, transparent); display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.ti-history-title { margin: 0; font-size: 15px; font-weight: 660; }
.ti-history-sub { margin: 3px 0 0; color: var(--ti-sub); font-size: 11.5px; }
.ti-history-list { display: flex; flex-direction: column; gap: 8px; }
.ti-rev {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  border: 1px solid var(--ti-border); border-radius: 12px; padding: 11px 14px;
  background: color-mix(in srgb, var(--ti-layer) 82%, transparent);
  transition: border-color .16s ease;
}
.ti-rev:hover { border-color: var(--ti-border2); }
.ti-rev.current { border-color: var(--ti-accent-line); background: color-mix(in srgb, var(--ti-accent) 6%, var(--ti-layer)); }
.ti-rev-main { flex: 1; min-width: 200px; }
.ti-rev-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ti-rev-badge { display: inline-flex; align-items: center; height: 20px; padding: 0 7px; border-radius: 6px; background: var(--ti-accent-soft); color: var(--ti-accent); font-size: 10.5px; font-weight: 700; font-variant-numeric: tabular-nums; }
.ti-rev-note { font-size: 12.5px; font-weight: 560; line-height: 1.5; overflow-wrap: anywhere; }
.ti-rev-meta { margin-top: 2px; color: var(--ti-sub); font-size: 10.5px; }
.ti-rev-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

/* ── modal / forms ─────────────────────────────────────── */
.ti-overlay {
  position: fixed; inset: 0; z-index: 80; display: flex; align-items: center; justify-content: center;
  padding: max(20px, calc(var(--dsh-frame-top-clearance, 0px) + 12px)) 20px 20px;
  background: color-mix(in srgb, var(--dsw-alias-bg-overlay) 62%, transparent);
  backdrop-filter: blur(7px);
  animation: ti-fade .18s ease both;
}
.ti-modal {
  width: min(640px, 100%); max-height: min(86vh, 900px); display: flex; flex-direction: column;
  border: 1px solid var(--ti-border2); border-radius: 18px;
  background: var(--ti-layer); color: var(--ti-text);
  box-shadow: 0 40px 100px -40px rgba(0, 0, 0, .45);
  animation: ti-rise .24s cubic-bezier(.2, .75, .25, 1) both;
  outline: none;
}
.ti-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; padding: 19px 21px 13px; border-bottom: 1px solid var(--ti-border); }
.ti-modal-title { margin: 0; font-size: 16px; font-weight: 680; letter-spacing: -.02em; }
.ti-modal-sub { margin: 3px 0 0; color: var(--ti-sub); font-size: 11.5px; line-height: 1.6; }
.ti-modal-body { padding: 16px 21px; overflow-y: auto; display: flex; flex-direction: column; gap: 13px; }
.ti-modal-foot { display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 12px 21px 16px; border-top: 1px solid var(--ti-border); }
.ti-form { display: flex; flex-direction: column; gap: 13px; }
.ti-switch { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: 11px; border: 1px solid var(--ti-border); background: var(--ti-layer2); cursor: pointer; position: relative; }
.ti-switch:focus-within { border-color: var(--ti-accent); box-shadow: 0 0 0 3px var(--ti-accent-soft); }
.ti-switch-track {
  width: 34px; height: 20px; flex: none; margin-top: 1px; border-radius: 999px;
  background: var(--ti-border2); position: relative; transition: background .16s ease;
}
.ti-switch-track::after {
  content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%;
  background: var(--ti-layer); box-shadow: 0 1px 3px rgba(0, 0, 0, .2); transition: transform .16s ease;
}
.ti-switch input { position: absolute; opacity: 0; pointer-events: none; }
.ti-switch.on .ti-switch-track { background: var(--ti-accent); }
.ti-switch.on .ti-switch-track::after { transform: translateX(14px); }
.ti-switch-main { min-width: 0; }
.ti-switch-title { font-size: 12.5px; font-weight: 600; }
.ti-switch-desc { margin-top: 1px; color: var(--ti-sub); font-size: 10.5px; line-height: 1.5; }
.ti-preview-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; color: var(--ti-sub); font-size: 11px; }
.ti-preview-section { border-top: 1px solid var(--ti-border); padding-top: 11px; }
.ti-preview-section:first-of-type { border-top: 0; padding-top: 0; }

/* ── toast / empty / spinner ───────────────────────────── */
.ti-toast {
  position: fixed; left: 50%; bottom: 26px; z-index: 120; transform: translateX(-50%);
  display: inline-flex; align-items: center; gap: 8px; padding: 10px 15px;
  border-radius: 11px; border: 1px solid var(--ti-border2);
  background: color-mix(in srgb, var(--ti-layer) 94%, transparent);
  backdrop-filter: blur(12px);
  color: var(--ti-text); font-size: 12.5px; font-weight: 520; max-width: min(560px, calc(100vw - 40px));
  box-shadow: 0 22px 50px -22px rgba(0, 0, 0, .32);
  animation: ti-toast-in .22s cubic-bezier(.2, .75, .25, 1) both;
}
.ti-toast svg { flex: none; }
.ti-toast.success svg { color: var(--ti-success); }
.ti-toast.error svg { color: var(--ti-danger); }
.ti-toast.info svg { color: var(--ti-accent); }
.ti-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  padding: 46px 22px; text-align: center; color: var(--ti-sub);
  border: 1px dashed var(--ti-border2); border-radius: 16px;
  background: color-mix(in srgb, var(--ti-layer) 55%, transparent);
}
.ti-empty-icon { width: 44px; height: 44px; border-radius: 13px; display: grid; place-items: center; background: var(--ti-layer2); color: var(--ti-sub); margin-bottom: 4px; }
.ti-empty-title { font-size: 13.5px; font-weight: 620; color: var(--ti-text); }
.ti-empty-body { max-width: 400px; font-size: 12px; line-height: 1.65; }
.ti-spinner { width: 15px; height: 15px; flex: none; border-radius: 50%; border: 2px solid var(--ti-border2); border-top-color: var(--ti-accent); animation: ti-spin .8s linear infinite; }
.ti-spinner.lg { width: 26px; height: 26px; border-width: 2.5px; }
.ti-loading-row { display: inline-flex; align-items: center; gap: 8px; color: var(--ti-sub); font-size: 11.5px; }

/* 错误卡 */
.ti-error-card {
  border: 1px solid color-mix(in srgb, var(--ti-danger) 30%, transparent);
  border-radius: 15px; padding: 20px 22px;
  background: color-mix(in srgb, var(--ti-danger) 6%, var(--ti-layer));
  display: flex; flex-direction: column; gap: 10px;
}
.ti-error-head { display: flex; align-items: center; gap: 9px; color: var(--ti-danger); }
.ti-error-title { margin: 0; font-size: 14px; font-weight: 680; }
.ti-error-body { margin: 0; color: var(--ti-text); font-size: 12.5px; line-height: 1.7; overflow-wrap: anywhere; }
.ti-error-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-top: 2px; }

@keyframes ti-spin { to { transform: rotate(360deg); } }
@keyframes ti-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes ti-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes ti-toast-in { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }
@keyframes ti-shimmer { from { background-position: 180% 0; } to { background-position: -80% 0; } }

/* ── 页面崩溃兜底 ──────────────────────────────────────── */
.ti-crash {
  min-height: 100%; margin: 0 auto; padding: 48px 24px; max-width: 860px;
  display: flex; flex-direction: column; gap: 12px; color: var(--ti-text);
}
.ti-crash-title { margin: 0; font-size: 18px; font-weight: 680; }
.ti-crash-sub { margin: 0; color: var(--ti-sub); font-size: 12.5px; line-height: 1.7; }
.ti-crash-detail {
  margin: 0; padding: 12px 14px; border: 1px solid var(--ti-border); border-radius: 10px;
  background: var(--ti-layer2); color: var(--ti-sub); font-family: var(--ti-mono);
  font-size: 11px; line-height: 1.6; white-space: pre-wrap; overflow: auto; max-height: 46vh;
}

/* ── responsive ────────────────────────────────────────── */
@media (max-width: 1024px) {
  .ti-inner { padding-left: 16px; padding-right: 16px; }
  .ti-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 860px) {
  .ti-inner { height: auto; min-height: 100%; overflow-y: auto; }
  .ti-body { grid-template-columns: 1fr; }
  .ti-rail { max-height: 236px; }
  .ti-head { flex-direction: column; align-items: stretch; }
  .ti-head-actions { justify-content: flex-start; }
  .ti-main { overflow: visible; }
}
`;

/* ── 图标 ─────────────────────────────────────────────────── */

const TI_ICONS = {
  compass: [['circle', { cx: 12, cy: 12, r: 8.6 }], ['path', { d: 'm15.4 8.6-2 4.8-4.8 2 2-4.8 4.8-2Z' }]],
  refresh: [['path', { d: 'M20 11a8 8 0 1 0-2.3 6.2' }], ['path', { d: 'M20 4v7h-7' }]],
  plus: [['path', { d: 'M12 5v14M5 12h14' }]],
  search: [['circle', { cx: 11, cy: 11, r: 6.4 }], ['path', { d: 'm16 16 4.2 4.2' }]],
  trash: [['path', { d: 'M4 7h16M9.5 7V4.8h5V7M6.5 7l.8 12.2A1.8 1.8 0 0 0 9.1 21h5.8a1.8 1.8 0 0 0 1.8-1.8L17.5 7' }], ['path', { d: 'M10 11v6M14 11v6' }]],
  edit: [['path', { d: 'M4 20h4.5L20 8.5 15.5 4 4 15.5V20Z' }], ['path', { d: 'm13.5 6 4.5 4.5' }]],
  copy: [['rect', { x: 8.5, y: 8.5, width: 11.5, height: 11.5, rx: 2.2 }], ['path', { d: 'M15.5 8.5V5.7A2.2 2.2 0 0 0 13.3 3.5H5.7A2.2 2.2 0 0 0 3.5 5.7v7.6a2.2 2.2 0 0 0 2.2 2.2h2.8' }]],
  download: [['path', { d: 'M12 4v10' }], ['path', { d: 'm8 10 4 4 4-4' }], ['path', { d: 'M5 19h14' }]],
  check: [['path', { d: 'm4.5 12.5 5 5 10-11' }]],
  x: [['path', { d: 'M6 6l12 12M18 6 6 18' }]],
  clock: [['circle', { cx: 12, cy: 12, r: 8.5 }], ['path', { d: 'M12 7v5.2l3.4 2' }]],
  alert: [['path', { d: 'M12 3.5 21 20H3L12 3.5Z' }], ['path', { d: 'M12 9v5' }], ['circle', { cx: 12, cy: 17, r: .9, fill: 'currentColor', stroke: 'none' }]],
  spark: [['path', { d: 'm12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z' }]],
  book: [['path', { d: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z' }], ['path', { d: 'M4 18.5A2.5 2.5 0 0 1 6.5 16H20' }]],
  flame: [['path', { d: 'M12 21c3.6 0 6.2-2.3 6.2-5.7 0-2.5-1.4-4.2-3-5.8-1.3-1.3-2.6-2.6-2.9-4.5-1.9 1.3-3.2 3.1-3.2 4.6 0 .9.4 1.7.9 2.2-1 .2-2-.7-2.2-1.9-.5.9-.8 2-.8 3.1C7 18.2 9.2 21 12 21Z' }]],
  layers: [['path', { d: 'm12 3 8.5 4.6L12 12.2 3.5 7.6 12 3Z' }], ['path', { d: 'm3.5 12 8.5 4.6 8.5-4.6' }], ['path', { d: 'm3.5 16.4 8.5 4.6 8.5-4.6' }]],
  chart: [['path', { d: 'M4 20V10M10 20V4M16 20v-7M22 20H2' }]],
  blueprint: [['rect', { x: 3.2, y: 4.4, width: 17.6, height: 15.2, rx: 2.6 }], ['path', { d: 'M3.2 9.6h17.6M9 4.4v15.2M15 9.6v10' }]],
  chevronDown: [['path', { d: 'm6 9 6 6 6-6' }]],
  chevronRight: [['path', { d: 'm9 6 6 6-6 6' }]],
  chevronLeft: [['path', { d: 'm15 6-6 6 6 6' }]],
  external: [['path', { d: 'M14 4h6v6' }], ['path', { d: 'M20 4 11 13' }], ['path', { d: 'M18 14v4.2A1.8 1.8 0 0 1 16.2 20H5.8A1.8 1.8 0 0 1 4 18.2V7.8A1.8 1.8 0 0 1 5.8 6H10' }]],
  globe: [['circle', { cx: 12, cy: 12, r: 8.6 }], ['path', { d: 'M3.6 12h16.8M12 3.4c2.4 2.4 3.6 5.4 3.6 8.6s-1.2 6.2-3.6 8.6c-2.4-2.4-3.6-5.4-3.6-8.6S9.6 5.8 12 3.4Z' }]],
  cpu: [['rect', { x: 6, y: 6, width: 12, height: 12, rx: 2.4 }], ['path', { d: 'M10 3v3M14 3v3M10 18v3M14 18v3M3 10h3M3 14h3M18 10h3M18 14h3' }]],
  history: [['path', { d: 'M4 12a8 8 0 1 0 2.4-5.7' }], ['path', { d: 'M4 4v4.5h4.5' }], ['path', { d: 'M12 7.6v4.8l3.2 1.9' }]],
  stop: [['rect', { x: 6.5, y: 6.5, width: 11, height: 11, rx: 2.4 }]],
  file: [['path', { d: 'M13.5 3H6.8A1.8 1.8 0 0 0 5 4.8v14.4A1.8 1.8 0 0 0 6.8 21h10.4a1.8 1.8 0 0 0 1.8-1.8V8.2L13.5 3Z' }], ['path', { d: 'M13.5 3v5.2H19' }]],
  info: [['circle', { cx: 12, cy: 12, r: 8.6 }], ['path', { d: 'M12 10.5V17' }], ['circle', { cx: 12, cy: 7.6, r: .9, fill: 'currentColor', stroke: 'none' }]],
  send: [['path', { d: 'M20 4 3.6 10.8l6.4 2.4 2.4 6.4L20 4Z' }], ['path', { d: 'M10 13.2 20 4' }]],
  dot: [['circle', { cx: 12, cy: 12, r: 4, fill: 'currentColor', stroke: 'none' }]],
};

function TiIcon(props) {
  const name = (props && props.name) || 'spark';
  const size = (props && props.size) || 16;
  const parts = TI_ICONS[name] || TI_ICONS.spark;
  return e(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: (props && props.strokeWidth) || 1.7,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
      style: props && props.style ? props.style : undefined,
    },
    parts.map((part, index) => e(part[0], Object.assign({ key: index }, part[1]))),
  );
}

/* ── 原语 ─────────────────────────────────────────────────── */

function TiBtn(props) {
  const variant = props.variant || 'ghost';
  const size = props.size === 'sm' ? 'sm' : '';
  const classes = [
    'ti-btn',
    'ti-btn-' + variant,
    size === 'sm' ? 'ti-btn-sm' : '',
    !props.children ? 'ti-btn-icon' : '',
    props.className || '',
  ]
    .filter(Boolean)
    .join(' ');
  return e(
    'button',
    {
      type: 'button',
      className: classes,
      onClick: props.onClick,
      disabled: props.disabled,
      title: props.title,
      'aria-label': props['aria-label'] || props.title,
    },
    props.icon ? e(TiIcon, { name: props.icon, size: size === 'sm' ? 13 : 15 }) : null,
    props.children ? e('span', null, props.children) : null,
  );
}

function TiIconBtn(props) {
  return e(
    'button',
    {
      type: 'button',
      className: 'ti-iconbtn' + (props.danger ? ' danger' : ''),
      onClick: props.onClick,
      title: props.title,
      'aria-label': props.title,
      disabled: props.disabled,
    },
    e(TiIcon, { name: props.icon || 'info', size: props.size || 15 }),
  );
}

function TiChip(props) {
  const tone = props.tone || '';
  return e(
    'span',
    { className: 'ti-chip' + (tone ? ' ti-chip-' + tone : ''), title: props.title },
    props.dot ? e('span', { className: 'ti-chip-dot' }) : null,
    props.icon ? e(TiIcon, { name: props.icon, size: 12 }) : null,
    props.children,
  );
}

function TiSpinner(props) {
  return e('span', { className: 'ti-spinner' + (props && props.large ? ' lg' : ''), 'aria-hidden': 'true' });
}

function TiEmpty(props) {
  return e(
    'div',
    { className: 'ti-empty' },
    e('div', { className: 'ti-empty-icon' }, e(TiIcon, { name: props.icon || 'spark', size: 20 })),
    e('div', { className: 'ti-empty-title' }, props.title || '这里还是空的'),
    props.body ? e('div', { className: 'ti-empty-body' }, props.body) : null,
    props.action ? e('div', { style: { marginTop: 10 } }, props.action) : null,
  );
}

function TiToast(props) {
  const toast = props.toast;
  if (!toast) return null;
  const tone = toast.tone || 'info';
  return e(
    'div',
    { className: 'ti-toast ' + tone, role: 'status', 'aria-live': 'polite' },
    e(TiIcon, { name: tone === 'success' ? 'check' : tone === 'error' ? 'alert' : 'info', size: 15 }),
    e('span', null, toast.text),
  );
}

function TiModal(props) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(props.onClose);
  onCloseRef.current = props.onClose;

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && onCloseRef.current) {
        event.stopPropagation();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (dialogRef.current && typeof dialogRef.current.focus === 'function') dialogRef.current.focus();
  }, []);

  return e(
    'div',
    {
      className: 'ti-overlay',
      onMouseDown: (event) => {
        if (event.target === event.currentTarget && props.onClose) props.onClose();
      },
    },
    e(
      'div',
      {
        ref: dialogRef,
        className: 'ti-modal',
        style: props.width ? { width: 'min(' + props.width + 'px, 100%)' } : undefined,
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': props.title,
        tabIndex: -1,
      },
      e(
        'div',
        { className: 'ti-modal-head' },
        e(
          'div',
          null,
          e('h3', { className: 'ti-modal-title' }, props.title),
          props.sub ? e('p', { className: 'ti-modal-sub' }, props.sub) : null,
        ),
        props.onClose ? e(TiIconBtn, { icon: 'x', title: '关闭', onClick: props.onClose }) : null,
      ),
      e('div', { className: 'ti-modal-body' }, props.children),
      props.footer ? e('div', { className: 'ti-modal-foot' }, props.footer) : null,
    ),
  );
}

function TiField(props) {
  return e(
    'label',
    { className: 'ti-gen-row' },
    e(
      'span',
      { className: 'ti-label' },
      e('span', null, props.label, props.required ? e('em', null, '*') : null),
      props.tip ? e('span', { className: 'ti-label-tip' }, props.tip) : null,
    ),
    props.children,
    props.hint ? e('span', { className: 'ti-hint' }, props.hint) : null,
  );
}

function TiConfirmDialog(props) {
  const state = props.state;
  if (!state) return null;
  return e(
    TiModal,
    {
      title: state.title || '确认',
      sub: state.body,
      width: 440,
      onClose: props.onClose,
      footer: [
        e(TiBtn, { key: 'cancel', onClick: props.onClose }, '取消'),
        e(
          TiBtn,
          {
            key: 'ok',
            variant: state.danger ? 'danger' : 'primary',
            onClick: () => {
              if (state.action) state.action();
              props.onClose();
            },
          },
          state.ok || '确定',
        ),
      ],
    },
    e('p', { style: { margin: 0, color: 'var(--ti-sub)', fontSize: 13, lineHeight: 1.75 } }, state.detail || '这个操作不可撤销。'),
  );
}

/* ── 安全 markdown-lite 渲染 ─────────────────────────────── */

/** 行内语法：**粗体**、`代码`、[文字](http链接)。全部转 React 元素，无 innerHTML。 */
function tiInlineNodes(text, keyPrefix) {
  const source = String(text || '');
  const nodes = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
  let lastIndex = 0;
  let tokenIndex = 0;
  let match = pattern.exec(source);
  while (match) {
    if (match.index > lastIndex) nodes.push(source.slice(lastIndex, match.index));
    const token = match[0];
    const key = keyPrefix + '-' + tokenIndex;
    if (token.slice(0, 2) === '**' && token.slice(-2) === '**') {
      nodes.push(e('strong', { key }, token.slice(2, -2)));
    } else if (token.charAt(0) === '`' && token.slice(-1) === '`') {
      nodes.push(e('code', { key }, token.slice(1, -1)));
    } else {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      if (link && /^https?:\/\//i.test(link[2])) {
        nodes.push(e('a', { key, href: link[2], target: '_blank', rel: 'noopener noreferrer' }, link[1]));
      } else {
        nodes.push(token);
      }
    }
    lastIndex = match.index + token.length;
    tokenIndex += 1;
    match = pattern.exec(source);
  }
  if (lastIndex < source.length) nodes.push(source.slice(lastIndex));
  return nodes;
}

/** 把 markdown-lite 文本解析为 React 元素数组（## 小标题 / 列表 / 段落）。 */
function tiParseMarkdown(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let paragraph = [];
  let listItems = [];
  let listOrdered = false;
  let blockIndex = 0;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const joined = paragraph.join(' ');
    blocks.push(e('p', { key: 'p' + blockIndex }, tiInlineNodes(joined, 'p' + blockIndex)));
    blockIndex += 1;
    paragraph = [];
  };
  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(
      e(
        listOrdered ? 'ol' : 'ul',
        { key: 'l' + blockIndex },
        listItems.map((item, index) =>
          e('li', { key: 'li' + blockIndex + '-' + index }, tiInlineNodes(item, 'li' + blockIndex + '-' + index)),
        ),
      ),
    );
    blockIndex += 1;
    listItems = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }
    const heading = /^(#{2,4})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push(e('h4', { key: 'h' + blockIndex }, tiInlineNodes(heading[2], 'h' + blockIndex)));
      blockIndex += 1;
      return;
    }
    const unordered = /^[-*]\s+(.+)$/.exec(trimmed);
    if (unordered) {
      flushParagraph();
      if (listItems.length && listOrdered) flushList();
      listOrdered = false;
      listItems.push(unordered[1]);
      return;
    }
    const ordered = /^\d+[.)]\s+(.+)$/.exec(trimmed);
    if (ordered) {
      flushParagraph();
      if (listItems.length && !listOrdered) flushList();
      listOrdered = true;
      listItems.push(ordered[1]);
      return;
    }
    if (listItems.length) flushList();
    paragraph.push(trimmed);
  });
  flushParagraph();
  flushList();
  return blocks;
}

/** 渲染 markdown-lite；空内容给出占位。 */
function TiRichText(props) {
  const blocks = useMemo(() => tiParseMarkdown(props.text), [props.text]);
  if (!blocks.length) {
    return e('p', { className: 'ti-rich-empty' }, props.emptyText || '（暂无内容）');
  }
  return e('div', { className: 'ti-rich' }, blocks);
}


/* ── 20-generate.js ── */
/* ─────────────────────────────────────────────────────────────
 * 技术洞察 · 生成流程
 * 空态输入卡、生成中进度视图（四阶段 + 实时来源 + 取消）、错误卡，
 * 以及 insight / refine 两个 SSE 请求的薄封装。
 * ───────────────────────────────────────────────────────────── */

/** 输入区：技术名称 + 关注点 + 深度 + 一键洞察 + 示例 chip。 */
function TiGenerator(props) {
  const draft = props.draft || { topic: '', focus: '', depth: 'standard' };
  const topicRef = useRef(null);
  const depthMeta = TI_DEPTHS.filter((item) => item.id === draft.depth)[0] || TI_DEPTHS[1];
  const canSubmit = String(draft.topic || '').trim().length > 0 && !props.disabled;

  useEffect(() => {
    if (topicRef.current && typeof topicRef.current.focus === 'function') topicRef.current.focus();
  }, []);

  const submit = () => {
    if (!canSubmit) return;
    props.onSubmit();
  };

  return e(
    'div',
    { className: 'ti-generator ti-anim' },
    e(
      'div',
      { className: 'ti-gen-hero' },
      e(
        'div',
        { className: 'ti-gen-kicker' },
        e('span', { className: 'ti-chip-dot' }),
        e('span', null, '联网检索 · 结构化成稿 · 本地归档'),
      ),
      e('h2', { className: 'ti-gen-title' }, '输入一个技术，得到一份能直接用的洞察'),
      e(
        'p',
        { className: 'ti-gen-desc' },
        'Host 会先联网检索公开资料、抓取正文，再交给当前 DSH 默认模型，按「技术介绍 / 技术方案设计 / 关键难点 / 使用场景 / 业界状态」成稿，并自动归档到本地，随时可以补充修订。',
      ),
    ),
    e(
      'div',
      { className: 'ti-gen-card' },
      e(
        TiField,
        {
          label: '技术名称',
          required: true,
          tip: '必填 · Ctrl / ⌘ + Enter 直接生成',
        },
        e('textarea', {
          ref: topicRef,
          className: 'ti-textarea ti-topic',
          value: draft.topic,
          rows: 2,
          placeholder: '例如：向量数据库、RISC-V、智能体记忆、液冷数据中心…',
          'aria-label': '技术名称',
          onChange: (event) => props.onDraftChange({ topic: event.target.value }),
          onKeyDown: (event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              submit();
            }
          },
        }),
      ),
      e(
        TiField,
        { label: '关注点（可选）', hint: '告诉模型你更关心什么，报告会围绕它展开重点。' },
        e('input', {
          className: 'ti-input',
          value: draft.focus,
          placeholder: '例如：工程落地与选型、成本与性能取舍、生态成熟度…',
          'aria-label': '关注点',
          onChange: (event) => props.onDraftChange({ focus: event.target.value }),
        }),
      ),
      e(
        'div',
        { className: 'ti-gen-row' },
        e('span', { className: 'ti-label' }, e('span', null, '洞察深度'), e('span', { className: 'ti-label-tip' }, depthMeta.hint)),
        e(
          'div',
          { className: 'ti-depth-row', role: 'group', 'aria-label': '洞察深度' },
          TI_DEPTHS.map((item) =>
            e(
              'button',
              {
                key: item.id,
                type: 'button',
                className: 'ti-depth' + (draft.depth === item.id ? ' on' : ''),
                'aria-pressed': draft.depth === item.id,
                onClick: () => props.onDraftChange({ depth: item.id }),
              },
              e('span', null, item.label),
              e('small', null, item.hint),
            ),
          ),
        ),
      ),
      e(
        'div',
        { className: 'ti-gen-foot' },
        e(
          'div',
          { className: 'ti-examples' },
          e('span', null, '试试：'),
          TI_EXAMPLES.map((name) =>
            e(
              'button',
              {
                key: name,
                type: 'button',
                className: 'ti-example',
                onClick: () => props.onDraftChange({ topic: name }),
              },
              name,
            ),
          ),
        ),
        e(
          TiBtn,
          { variant: 'primary', icon: 'spark', disabled: !canSubmit, onClick: submit },
          props.disabled ? '生成中…' : '一键洞察',
        ),
      ),
      props.disabled
        ? e('div', { className: 'ti-hint' }, '当前有任务正在运行，完成或取消后才能发起新的洞察。')
        : null,
    ),
  );
}

/** 生成中视图：四阶段步骤条 + 进度 + 检索词 + 实时来源 + 用时 + 取消。 */
function TiProgressView(props) {
  const job = props.job || {};
  const isRefine = job.kind === 'refine';
  const sources = Array.isArray(job.sources) ? job.sources : [];
  const queries = Array.isArray(job.queries) ? job.queries : [];
  const activeIndex = (() => {
    const index = TI_STAGES.findIndex((item) => item.key === job.stage);
    return index === -1 ? 0 : index;
  })();
  const percent = tiClamp((Number(job.progress) || 0) * 100, 3, 100);
  const stageLabel = job.stageLabel || (TI_STAGES[activeIndex] && TI_STAGES[activeIndex].label) || '准备中';

  return e(
    'div',
    { className: 'ti-progress-card ti-anim' },
    e(
      'div',
      { className: 'ti-progress-head' },
      e(
        'div',
        null,
        e(
          'h2',
          { className: 'ti-progress-title' },
          isRefine ? '正在补充修订' : '正在生成技术洞察',
        ),
        e(
          'p',
          { className: 'ti-progress-sub' },
          (isRefine ? '修订对象：' : '技术主题：') + (job.topic || '—') + ' · ' + stageLabel,
        ),
      ),
      e(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
        e(
          'span',
          { className: 'ti-progress-time' },
          e(TiIcon, { name: 'clock', size: 13 }),
          '已用 ' + tiFormatElapsed(props.elapsed),
        ),
        e(
          TiBtn,
          { variant: 'ghost', size: 'sm', icon: 'stop', onClick: props.onCancel },
          '取消',
        ),
      ),
    ),
    e(
      'div',
      { className: 'ti-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(percent), 'aria-label': '生成进度' },
      e('div', { className: 'ti-bar-fill', style: { width: percent + '%' } }),
    ),
    e(
      'div',
      { className: 'ti-steps' },
      TI_STAGES.map((stage, index) => {
        const state = index < activeIndex ? 'done' : index === activeIndex ? 'on' : '';
        return e(
          'div',
          { key: stage.key, className: 'ti-step' + (state ? ' ' + state : '') },
          e(
            'div',
            { className: 'ti-step-head' },
            e('span', { className: 'ti-step-index' }, state === 'done' ? e(TiIcon, { name: 'check', size: 10, strokeWidth: 2.4 }) : String(index + 1)),
            e('span', null, stage.label),
          ),
          e('div', { className: 'ti-step-hint' }, stage.hint),
        );
      }),
    ),
    e(
      'div',
      { className: 'ti-progress-panel' },
      e(
        'div',
        { className: 'ti-progress-panel-title' },
        e('span', null, isRefine && !job.useWeb ? '基于现有报告与分析推理' : '检索词'),
        queries.length ? e('span', null, queries.length + ' 组') : null,
      ),
      queries.length
        ? e(
            'div',
            { className: 'ti-queries' },
            queries.map((query, index) => e('span', { key: query + index, className: 'ti-query' }, query)),
          )
        : e('span', { className: 'ti-hint' }, job.stage === 'search' ? '正在生成检索词…' : '尚未产生检索词'),
    ),
    e(
      'div',
      { className: 'ti-progress-panel' },
      e(
        'div',
        { className: 'ti-progress-panel-title' },
        e('span', null, '已发现来源'),
        e('span', null, sources.length ? sources.length + ' 条（最多展示 12 条）' : '等待检索结果'),
      ),
      sources.length
        ? e(
            'div',
            { className: 'ti-sources' },
            sources.slice(0, 12).map((source, index) =>
              e(
                'div',
                { key: source.url || index, className: 'ti-source' },
                e('span', { className: 'ti-source-index' }, String(index + 1)),
                e(
                  'div',
                  { className: 'ti-source-main' },
                  e('div', { className: 'ti-source-title', title: source.title }, source.title || source.url),
                  e('div', { className: 'ti-source-site' }, tiSiteOf(source)),
                ),
              ),
            ),
          )
        : e(
            'div',
            { className: 'ti-sources' },
            e('div', { className: 'ti-skeleton ti-skeleton-row' }),
            e('div', { className: 'ti-skeleton ti-skeleton-row' }),
            e('div', { className: 'ti-skeleton ti-skeleton-row' }),
          ),
    ),
  );
}

/** 可读错误卡：保留输入，支持重试 / 返回。 */
function TiInsightError(props) {
  return e(
    'div',
    { className: 'ti-error-card ti-anim', role: 'alert' },
    e(
      'div',
      { className: 'ti-error-head' },
      e(TiIcon, { name: 'alert', size: 17 }),
      e('h2', { className: 'ti-error-title' }, props.title || '洞察生成失败'),
    ),
    e('p', { className: 'ti-error-body' }, props.message || '发生了未知错误，请重试。'),
    props.code ? e('div', { className: 'ti-hint' }, '错误码：' + props.code) : null,
    e(
      'div',
      { className: 'ti-error-actions' },
      props.onRetry ? e(TiBtn, { variant: 'primary', size: 'sm', icon: 'refresh', onClick: props.onRetry }, '重试') : null,
      props.onBack ? e(TiBtn, { size: 'sm', onClick: props.onBack }, '返回') : null,
    ),
  );
}


/* ── 25-visuals.js ── */
/* ─────────────────────────────────────────────────────────────
 * 技术洞察 · 可视化
 * 模型只产出结构化数据（层/条目、分数、坐标、时间），这里用内联 SVG 渲染。
 * 不执行模型生成的任意 HTML/SVG，避免注入；颜色全部走宿主主题 token。
 * ───────────────────────────────────────────────────────────── */

/** 四个固定分节各自对应的图。 */
const TI_SECTION_VISUALS = {
  solution: 'architecture',
  difficulties: 'difficulty',
  scenarios: 'matrix',
  industry: 'timeline',
};

/** 通用图容器：标题 + 画布。 */
function TiFigure(props) {
  const visual = props.visual;
  if (!visual || typeof visual !== 'object') return null;
  let svg = null;
  let hint = '';
  if (props.kind === 'architecture') {
    svg = e(TiArchitectureSvg, { visual });
    hint = '分层自下而上：下层为上层提供能力';
  } else if (props.kind === 'difficulty') {
    svg = e(TiDifficultySvg, { visual });
    hint = '条越长表示工程落地越难（0–100）';
  } else if (props.kind === 'matrix') {
    svg = e(TiMatrixSvg, { visual });
    hint = '右上角通常是优先落地场景';
  } else if (props.kind === 'timeline') {
    svg = e(TiTimelineSvg, { visual });
    hint = '按公开资料中的时间点整理';
  }
  if (!svg) return null;
  return e(
    'figure',
    { className: 'ti-figure' },
    e(
      'div',
      { className: 'ti-figure-head' },
      e('span', { className: 'ti-figure-badge' }, e(TiIcon, { name: 'chart', size: 13 })),
      e('figcaption', { className: 'ti-figure-title' }, visual.title || '技术图谱'),
      hint ? e('span', { className: 'ti-figure-hint' }, hint) : null,
    ),
    e('div', { className: 'ti-figure-canvas' }, svg),
  );
}

/** 分层架构图：纵向分层 + 层间箭头。 */
function TiArchitectureSvg(props) {
  const layers = Array.isArray(props.visual.layers) ? props.visual.layers : [];
  if (layers.length === 0) return null;
  const width = 760;
  const rowH = 62;
  const gap = 24;
  const top = 14;
  const height = top * 2 + layers.length * rowH + (layers.length - 1) * gap;
  const parts = [];
  layers.forEach((layer, index) => {
    const y = top + index * (rowH + gap);
    const items = (layer.items || []).join('   ·   ');
    parts.push(
      e(
        'g',
        { key: 'layer-' + index },
        e('rect', {
          x: 12,
          y: y,
          width: width - 24,
          height: rowH,
          rx: 12,
          fill: 'var(--ti-figure-fill)',
          stroke: 'var(--ti-figure-stroke)',
          strokeWidth: 1.1,
        }),
        e('rect', { x: 12, y: y, width: 5, height: rowH, rx: 2.5, fill: 'var(--ti-accent)' }),
        e(
          'text',
          { x: 32, y: y + rowH / 2 + 5, fill: 'var(--ti-text)', fontSize: 13.5, fontWeight: 650 },
          layer.name,
        ),
        items
          ? e(
              'text',
              { x: 168, y: y + rowH / 2 + 4.5, fill: 'var(--ti-sub)', fontSize: 12 },
              items,
            )
          : null,
      ),
    );
    if (index < layers.length - 1) {
      const start = y + rowH + 3;
      parts.push(
        e('path', {
          key: 'arrow-' + index,
          d: `M ${width / 2} ${start} L ${width / 2} ${start + gap - 6}`,
          stroke: 'var(--ti-figure-stroke)',
          strokeWidth: 1.6,
          markerEnd: 'url(#ti-arrow-head)',
        }),
      );
    }
  });
  return e(
    'svg',
    {
      className: 'ti-svg',
      viewBox: `0 0 ${width} ${height}`,
      role: 'img',
      'aria-label': props.visual.title || '技术分层架构图',
    },
    e(
      'defs',
      null,
      e(
        'marker',
        {
          id: 'ti-arrow-head',
          viewBox: '0 0 10 10',
          refX: 8,
          refY: 5,
          markerWidth: 6,
          markerHeight: 6,
          orient: 'auto-start-reverse',
        },
        e('path', { d: 'M 0 0 L 10 5 L 0 10 Z', fill: 'var(--ti-figure-stroke)' }),
      ),
    ),
    parts,
  );
}

/** 关键难点：横向强度条。 */
function TiDifficultySvg(props) {
  const items = Array.isArray(props.visual.items) ? props.visual.items : [];
  if (items.length === 0) return null;
  const width = 760;
  const rowH = 56;
  const top = 12;
  const height = top * 2 + items.length * rowH;
  const barX = 196;
  const barW = 420;
  const parts = [];
  items.forEach((item, index) => {
    const y = top + index * rowH;
    const score = Math.min(100, Math.max(0, Number(item.score) || 0));
    const barLen = Math.max(4, (score / 100) * barW);
    parts.push(
      e(
        'g',
        { key: 'diff-' + index },
        e('text', { x: 12, y: y + 20, fill: 'var(--ti-text)', fontSize: 12.5, fontWeight: 600 }, item.name),
        e('rect', { x: barX, y: y + 6, width: barW, height: 12, rx: 6, fill: 'var(--ti-layer2)' }),
        e('rect', { x: barX, y: y + 6, width: barLen, height: 12, rx: 6, fill: 'var(--ti-accent)' }),
        e(
          'text',
          { x: barX + barW + 10, y: y + 17, fill: 'var(--ti-sub)', fontSize: 11.5, fontWeight: 600 },
          String(score),
        ),
        e(
          'text',
          { x: barX, y: y + 38, fill: 'var(--ti-sub)', fontSize: 11 },
          item.reason ? tiTruncate(item.reason, 52) : '',
        ),
      ),
    );
  });
  return e(
    'svg',
    {
      className: 'ti-svg',
      viewBox: `0 0 ${width} ${height}`,
      role: 'img',
      'aria-label': props.visual.title || '关键难点强度图',
    },
    parts,
  );
}

/** 场景价值矩阵：x=落地成熟度，y=业务价值，四象限散点。 */
function TiMatrixSvg(props) {
  const items = Array.isArray(props.visual.items) ? props.visual.items : [];
  if (items.length === 0) return null;
  const width = 720;
  const height = 452;
  const left = 86;
  const right = width - 36;
  const top = 26;
  const bottom = height - 66;
  const plotW = right - left;
  const plotH = bottom - top;
  const cx = (x) => left + (Math.min(100, Math.max(0, Number(x) || 0)) / 100) * plotW;
  const cy = (y) => bottom - (Math.min(100, Math.max(0, Number(y) || 0)) / 100) * plotH;
  const midX = left + plotW / 2;
  const midY = top + plotH / 2;
  const parts = [
    e('rect', { key: 'tl', x: left, y: top, width: plotW / 2, height: plotH / 2, fill: 'var(--ti-accent-soft)' }),
    e('rect', { key: 'br', x: midX, y: midY, width: plotW / 2, height: plotH / 2, fill: 'var(--ti-accent-soft)' }),
    e('line', { key: 'vx', x1: midX, y1: top, x2: midX, y2: bottom, stroke: 'var(--ti-figure-stroke)', strokeDasharray: '4 5' }),
    e('line', { key: 'hy', x1: left, y1: midY, x2: right, y2: midY, stroke: 'var(--ti-figure-stroke)', strokeDasharray: '4 5' }),
    e('rect', { key: 'frame', x: left, y: top, width: plotW, height: plotH, fill: 'none', stroke: 'var(--ti-figure-stroke)' }),
    e('text', { key: 'xlabel', x: left + plotW / 2, y: height - 30, textAnchor: 'middle', fill: 'var(--ti-sub)', fontSize: 11.5 }, props.visual.xLabel + ' →'),
    e(
      'text',
      {
        key: 'ylabel',
        x: 24,
        y: top + plotH / 2,
        textAnchor: 'middle',
        fill: 'var(--ti-sub)',
        fontSize: 11.5,
        transform: `rotate(-90 24 ${top + plotH / 2})`,
      },
      props.visual.yLabel + ' →',
    ),
  ];
  items.forEach((item, index) => {
    const x = cx(item.x);
    const y = cy(item.y);
    const anchor = x > right - 120 ? 'end' : 'start';
    const tx = anchor === 'end' ? x - 10 : x + 10;
    parts.push(
      e(
        'g',
        { key: 'point-' + index },
        e('circle', { cx: x, cy: y, r: 6, fill: 'var(--ti-accent)', stroke: 'var(--ti-layer)', strokeWidth: 2 }),
        e('text', { x: tx, y: y - 6, textAnchor: anchor, fill: 'var(--ti-text)', fontSize: 11.5, fontWeight: 600 }, item.name),
        e('text', { x: tx, y: y + 15, textAnchor: anchor, fill: 'var(--ti-sub)', fontSize: 10 }, item.x + ' / ' + item.y),
      ),
    );
  });
  return e(
    'svg',
    {
      className: 'ti-svg',
      viewBox: `0 0 ${width} ${height}`,
      role: 'img',
      'aria-label': props.visual.title || '场景价值矩阵',
    },
    parts,
  );
}

/** 业界时间线：纵向时间轴。 */
function TiTimelineSvg(props) {
  const items = Array.isArray(props.visual.items) ? props.visual.items : [];
  if (items.length === 0) return null;
  const width = 760;
  const rowH = 58;
  const top = 14;
  const height = top * 2 + items.length * rowH;
  const axisX = 138;
  const parts = [
    e('line', { key: 'axis', x1: axisX, y1: top + 8, x2: axisX, y2: height - top - 8, stroke: 'var(--ti-figure-stroke)', strokeWidth: 1.4 }),
  ];
  items.forEach((item, index) => {
    const y = top + index * rowH;
    parts.push(
      e(
        'g',
        { key: 'event-' + index },
        e('text', { x: axisX - 16, y: y + 16, textAnchor: 'end', fill: 'var(--ti-sub)', fontSize: 11.5, fontWeight: 600 }, item.time || '—'),
        e('circle', { cx: axisX, cy: y + 12, r: 4.2, fill: 'var(--ti-accent)' }),
        e('text', { x: axisX + 18, y: y + 16, fill: 'var(--ti-text)', fontSize: 12.5, fontWeight: 650 }, item.title),
        item.detail
          ? e('text', { x: axisX + 18, y: y + 35, fill: 'var(--ti-sub)', fontSize: 11 }, tiTruncate(item.detail, 58))
          : null,
      ),
    );
  });
  return e(
    'svg',
    {
      className: 'ti-svg',
      viewBox: `0 0 ${width} ${height}`,
      role: 'img',
      'aria-label': props.visual.title || '业界采用时间线',
    },
    parts,
  );
}


/* ── 30-report.js ── */
/* ─────────────────────────────────────────────────────────────
 * 技术洞察 · 报告视图
 * 报告头部 / 四个固定分节（折叠 + 手动编辑）/ 相关参考 /
 * 修订历史（查看预览、回滚）/ 补充修订弹窗。
 * ───────────────────────────────────────────────────────────── */

/** 分节卡片：折叠、编辑、保存。 */
function TiSectionCard(props) {
  const section = props.section;
  const meta = TI_SECTIONS.filter((item) => item.key === section.key)[0] || TI_SECTIONS[0];
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.body || '');

  /* 外部报告切换时同步草稿，避免编辑到上一份报告的内容。 */
  useEffect(() => {
    setDraft(section.body || '');
    setEditing(false);
  }, [section.body, props.reportId]);

  const save = () => {
    props.onSave(section.key, draft);
    setEditing(false);
  };

  return e(
    'section',
    { className: 'ti-section' + (collapsed ? ' collapsed' : '') },
    e(
      'div',
      { className: 'ti-section-head' },
      e('span', { className: 'ti-section-badge' }, e(TiIcon, { name: meta.icon, size: 15 })),
      e(
        'button',
        {
          type: 'button',
          className: 'ti-section-head-main',
          style: { background: 'transparent', border: 0, padding: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer' },
          onClick: () => setCollapsed((value) => !value),
          'aria-expanded': !collapsed,
          title: collapsed ? '展开分节' : '收起分节',
        },
        e('h3', { className: 'ti-section-title' }, section.title || meta.label),
        e('span', { className: 'ti-section-key' }, meta.key),
        e(TiIcon, { name: collapsed ? 'chevronRight' : 'chevronDown', size: 13, style: { color: 'var(--ti-sub)' } }),
      ),
      e(
        'div',
        { className: 'ti-section-tools' },
        editing
          ? null
          : e(TiIconBtn, { icon: 'edit', title: '手动编辑本节', onClick: () => setEditing(true) }),
      ),
    ),
    e(
      'div',
      { className: 'ti-section-body' },
      editing
        ? e(
            'div',
            null,
            e('textarea', {
              className: 'ti-textarea',
              value: draft,
              rows: 10,
              autoFocus: true,
              onChange: (event) => setDraft(event.target.value),
              'aria-label': section.title + ' 正文',
            }),
            e(
              'div',
              { className: 'ti-section-foot' },
              e('span', { className: 'ti-hint' }, '支持 markdown-lite：## 小标题、- 列表、**粗体**、`代码`、[链接](https://…)'),
              e(
                'span',
                { style: { display: 'inline-flex', gap: 6 } },
                e(TiBtn, { size: 'sm', onClick: () => { setDraft(section.body || ''); setEditing(false); } }, '取消'),
                e(TiBtn, { size: 'sm', variant: 'primary', icon: 'check', onClick: save }, '保存'),
              ),
            ),
          )
        : [
            props.visual ? e(TiFigure, { key: 'figure', kind: props.visualKind, visual: props.visual }) : null,
            e(TiRichText, {
              key: 'rich',
              text: section.body,
              emptyText: '这一节还没有内容，点击右上角编辑补充。',
            }),
          ],
    ),
  );
}

/** 修订历史列表（倒序）+ 只读预览。 */
function TiHistoryView(props) {
  const entry = props.entry;
  const revisions = (entry.revisions || []).slice().sort((a, b) => b.rev - a.rev);
  const [previewRev, setPreviewRev] = useState(null);
  const preview = previewRev === null ? null : revisions.filter((item) => item.rev === previewRev)[0];

  return e(
    'div',
    { className: 'ti-history ti-anim' },
    e(
      'div',
      { className: 'ti-history-head' },
      e(
        'div',
        null,
        e('h2', { className: 'ti-history-title' }, '修订历史'),
        e('p', { className: 'ti-history-sub' }, '共 ' + revisions.length + ' 个版本。回滚不会删除历史，而是把旧版本作为新版本追加。'),
      ),
      e(TiBtn, { size: 'sm', icon: 'edit', onClick: props.onBack }, '返回报告'),
    ),
    e(
      'div',
      { className: 'ti-history-list' },
      revisions.map((revision) =>
        e(
          'div',
          { key: revision.rev, className: 'ti-rev' + (revision.rev === entry.currentRev ? ' current' : '') },
          e(
            'div',
            { className: 'ti-rev-main' },
            e(
              'div',
              { className: 'ti-rev-top' },
              e('span', { className: 'ti-rev-badge' }, 'v' + revision.rev),
              revision.rev === entry.currentRev ? e(TiChip, { tone: 'good' }, '当前版本') : null,
              e('span', { className: 'ti-rev-note' }, revision.note || '未命名修订'),
            ),
            e('div', { className: 'ti-rev-meta' }, '时间：' + tiFormatDateTime(revision.at)),
          ),
          e(
            'div',
            { className: 'ti-rev-actions' },
            e(TiBtn, { size: 'sm', icon: 'file', onClick: () => setPreviewRev(revision.rev) }, '查看'),
            revision.rev === entry.currentRev
              ? null
              : e(TiBtn, { size: 'sm', variant: 'soft', icon: 'history', onClick: () => props.onRollback(revision.rev) }, '回滚到此版本'),
          ),
        ),
      ),
    ),
    preview
      ? e(TiRevisionPreview, { revision: preview, onClose: () => setPreviewRev(null) })
      : null,
  );
}

/** 历史版本只读预览弹窗。 */
function TiRevisionPreview(props) {
  const revision = props.revision;
  const report = revision.report || {};
  const sections = Array.isArray(report.sections) ? report.sections : [];
  return e(
    TiModal,
    {
      title: 'v' + revision.rev + ' · ' + (revision.note || '历史版本'),
      sub: '保存时间：' + tiFormatDateTime(revision.at) + '（只读预览）',
      width: 760,
      onClose: props.onClose,
      footer: [e(TiBtn, { key: 'close', onClick: props.onClose }, '关闭')],
    },
    e(
      'div',
      { className: 'ti-preview-meta' },
      e(TiChip, { icon: 'clock' }, tiFormatDateTime(revision.at)),
      report.model ? e(TiChip, { icon: 'cpu' }, report.model) : null,
      Number.isFinite(report.sourceCount) ? e(TiChip, { icon: 'globe' }, report.sourceCount + ' 个来源') : null,
    ),
    report.title ? e('div', { style: { fontSize: 16, fontWeight: 660, lineHeight: 1.4 } }, report.title) : null,
    report.oneLiner ? e('p', { style: { margin: 0, color: 'var(--ti-sub)', fontSize: 12.5, lineHeight: 1.7 } }, report.oneLiner) : null,
    sections.length
      ? sections.map((section) =>
          e(
            'div',
            { key: section.key || section.title, className: 'ti-preview-section' },
            e('div', { style: { fontSize: 12.5, fontWeight: 650, marginBottom: 4 } }, section.title || ''),
            e(TiRichText, { text: section.body }),
          ),
        )
      : e('p', { className: 'ti-hint' }, '这个历史版本没有可预览的分节内容。'),
  );
}

/** 补充修订弹窗：修订指令必填 + 联网开关（默认开）。 */
function TiRefineDialog(props) {
  const [instruction, setInstruction] = useState('');
  const [useWeb, setUseWeb] = useState(true);
  const canSubmit = instruction.trim().length > 0 && !props.disabled;

  const submit = () => {
    if (!canSubmit) return;
    props.onSubmit(instruction.trim(), useWeb);
  };

  return e(
    TiModal,
    {
      title: '补充修订',
      sub: '说明要补充或修正的方向；完成后会追加一个新版本，历史版本仍可查看与回滚。',
      width: 580,
      onClose: props.onClose,
      footer: [
        e(TiBtn, { key: 'cancel', onClick: props.onClose }, '取消'),
        e(
          TiBtn,
          { key: 'ok', variant: 'primary', icon: 'spark', disabled: !canSubmit, onClick: submit },
          '开始修订',
        ),
      ],
    },
    e(
      TiField,
      {
        label: '修订指令',
        required: true,
        hint: '示例：补充近一年国内厂商的落地案例，并给出与竞品的对比。',
      },
      e('textarea', {
        className: 'ti-textarea',
        value: instruction,
        rows: 5,
        autoFocus: true,
        placeholder: '例如：补充近一年国内厂商的落地案例；把「关键难点」写得更偏工程实践…',
        'aria-label': '修订指令',
        onChange: (event) => setInstruction(event.target.value),
      }),
    ),
    e(
      'label',
      { className: 'ti-switch' + (useWeb ? ' on' : '') },
      e('input', {
        type: 'checkbox',
        checked: useWeb,
        onChange: (event) => setUseWeb(event.target.checked),
      }),
      e('span', { className: 'ti-switch-track', 'aria-hidden': 'true' }),
      e(
        'div',
        { className: 'ti-switch-main' },
        e('div', { className: 'ti-switch-title' }, '联网检索新资料'),
        e(
          'div',
          { className: 'ti-switch-desc' },
          useWeb
            ? '开启：会重新联网检索并抓取正文，补充最新信息。'
            : '关闭：不联网，只基于现有报告和修订指令改写。',
        ),
      ),
    ),
  );
}

/** 报告主视图：头部 + 分节 / 修订历史 tab + 相关参考。 */
function TiReportView(props) {
  const report = props.report;
  const entry = props.entry;
  const [tab, setTab] = useState('report');
  const [metaEditing, setMetaEditing] = useState(false);
  const [metaDraft, setMetaDraft] = useState({ title: report.title, oneLiner: report.oneLiner });

  /* 切换到另一份报告时回到报告 tab 并重置编辑态。 */
  useEffect(() => {
    setTab('report');
    setMetaEditing(false);
    setMetaDraft({ title: report.title, oneLiner: report.oneLiner });
  }, [report.id]);

  const revisionCount = (entry.revisions || []).length;
  const saveMeta = () => {
    props.onSaveMeta({
      title: String(metaDraft.title || '').trim() || report.title,
      oneLiner: String(metaDraft.oneLiner || '').trim(),
    });
    setMetaEditing(false);
  };

  return e(
    'div',
    { className: 'ti-report ti-anim' },
    e(
      'div',
      { className: 'ti-report-head' },
      e(
        'div',
        { className: 'ti-report-kicker' },
        e(TiChip, { tone: 'brand', icon: 'book' }, report.topic || '技术洞察'),
        e(TiChip, { icon: 'history' }, 'v' + entry.currentRev),
        report.model ? e(TiChip, { icon: 'cpu' }, report.model) : null,
        Number.isFinite(report.sourceCount) ? e(TiChip, { icon: 'globe' }, report.sourceCount + ' 个来源') : null,
      ),
      metaEditing
        ? e(
            'div',
            { className: 'ti-form' },
            e(
              TiField,
              { label: '报告标题' },
              e('input', {
                className: 'ti-input',
                value: metaDraft.title,
                onChange: (event) => setMetaDraft((current) => Object.assign({}, current, { title: event.target.value })),
                'aria-label': '报告标题',
              }),
            ),
            e(
              TiField,
              { label: '一句话结论' },
              e('textarea', {
                className: 'ti-textarea',
                value: metaDraft.oneLiner,
                rows: 2,
                onChange: (event) => setMetaDraft((current) => Object.assign({}, current, { oneLiner: event.target.value })),
                'aria-label': '一句话结论',
              }),
            ),
            e(
              'div',
              { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
              e(TiBtn, { size: 'sm', variant: 'primary', icon: 'check', onClick: saveMeta }, '保存标题与结论'),
              e(
                TiBtn,
                {
                  size: 'sm',
                  onClick: () => {
                    setMetaDraft({ title: report.title, oneLiner: report.oneLiner });
                    setMetaEditing(false);
                  },
                },
                '取消',
              ),
            ),
          )
        : [
            e('h1', { key: 'title', className: 'ti-report-title' }, report.title),
            report.oneLiner ? e('p', { key: 'one', className: 'ti-report-oneliner' }, report.oneLiner) : null,
          ],
      e(
        'div',
        { className: 'ti-report-meta' },
        e('span', null, '生成于 ' + tiFormatDateTime(report.createdAt)),
        e('span', { className: 'ti-item-dot' }),
        e('span', null, '更新于 ' + tiFormatDateTime(report.updatedAt)),
        e('span', { className: 'ti-item-dot' }),
        e('span', null, '当前版本 v' + entry.currentRev + ' / 共 ' + revisionCount + ' 个版本'),
        report.queries && report.queries.length ? e('span', { className: 'ti-item-dot' }) : null,
        report.queries && report.queries.length ? e('span', null, report.queries.length + ' 组检索词') : null,
      ),
      e(
        'div',
        { className: 'ti-report-actions' },
        e(TiBtn, { variant: 'primary', icon: 'spark', onClick: props.onRefine, disabled: props.busy }, '补充修订'),
        e(
          TiBtn,
          {
            icon: 'edit',
            onClick: () => {
              setMetaDraft({ title: report.title, oneLiner: report.oneLiner });
              setMetaEditing((value) => !value);
            },
          },
          metaEditing ? '收起编辑' : '手动编辑',
        ),
        e(TiBtn, { icon: 'copy', onClick: props.onCopy }, '复制 Markdown'),
        e(TiBtn, { icon: 'download', onClick: props.onExport }, '导出 .md'),
        e(TiBtn, { variant: 'danger', icon: 'trash', onClick: props.onDelete }, '删除'),
        e('span', { className: 'ti-spacer' }),
        e(
          'div',
          { className: 'ti-tabs', role: 'tablist', 'aria-label': '报告视图切换' },
          e(
            'button',
            {
              type: 'button',
              role: 'tab',
              'aria-selected': tab === 'report',
              className: 'ti-tab' + (tab === 'report' ? ' on' : ''),
              onClick: () => setTab('report'),
            },
            e(TiIcon, { name: 'book', size: 13 }),
            '报告',
          ),
          e(
            'button',
            {
              type: 'button',
              role: 'tab',
              'aria-selected': tab === 'history',
              className: 'ti-tab' + (tab === 'history' ? ' on' : ''),
              onClick: () => setTab('history'),
            },
            e(TiIcon, { name: 'history', size: 13 }),
            '修订历史',
            e('span', { className: 'ti-tab-badge' }, String(revisionCount)),
          ),
        ),
      ),
    ),
    tab === 'history'
      ? e(TiHistoryView, {
          entry,
          onBack: () => setTab('report'),
          onRollback: props.onRollback,
        })
      : [
          e(
            'div',
            { key: 'sections', className: 'ti-sections' },
            report.sections.map((section) =>
              e(TiSectionCard, {
                key: section.key,
                section,
                reportId: report.id,
                visualKind: TI_SECTION_VISUALS[section.key] || null,
                visual: report.visuals ? report.visuals[TI_SECTION_VISUALS[section.key] || ''] || null : null,
                onSave: props.onSaveSection,
              }),
            ),
          ),
          e(
            'div',
            { key: 'refs', className: 'ti-refs' },
            e(
              'div',
              { className: 'ti-refs-head' },
              e(TiIcon, { name: 'globe', size: 15, style: { color: 'var(--ti-accent)' } }),
              e('h3', { className: 'ti-refs-title' }, '相关参考'),
              e('span', { className: 'ti-hint' }, report.references.length ? report.references.length + ' 条' : ''),
            ),
            report.references.length
              ? e(
                  'ol',
                  { className: 'ti-refs-list' },
                  report.references.map((ref, index) =>
                    e(
                      'li',
                      { key: ref.url + index, className: 'ti-ref' },
                      e('span', { className: 'ti-ref-index' }, String(index + 1)),
                      e(
                        'div',
                        { className: 'ti-ref-main' },
                        e(
                          'a',
                          {
                            className: 'ti-ref-link',
                            href: ref.url,
                            target: '_blank',
                            rel: 'noopener noreferrer',
                            title: ref.url,
                          },
                          e('span', null, ref.title),
                          e(TiIcon, { name: 'external', size: 11 }),
                        ),
                        ref.note ? e('div', { className: 'ti-ref-note' }, ref.note) : null,
                        e('div', { className: 'ti-ref-url' }, ref.url),
                      ),
                    ),
                  ),
                )
              : e('p', { className: 'ti-hint' }, '这份报告没有记录参考来源。'),
          ),
          e(
            'div',
            { key: 'foot', className: 'ti-report-foot' },
            e('span', null, '报告结束 · 由「技术洞察」生成 · ' + report.references.length + ' 条参考'),
            e(
              'span',
              { className: 'ti-report-foot-actions' },
              e(TiBtn, { size: 'sm', icon: 'spark', onClick: props.onRefine, disabled: props.busy }, '继续补充修订'),
              e(TiBtn, { size: 'sm', icon: 'download', onClick: props.onExport }, '导出 .md'),
            ),
          ),
        ],
  );
}


/* ── 40-archive.js ── */
/* ─────────────────────────────────────────────────────────────
 * 技术洞察 · 归档列表（左栏）
 * 搜索、选中、版本数 / 来源数 / 日期展示、单条删除。
 * ───────────────────────────────────────────────────────────── */

function TiArchiveItem(props) {
  const entry = props.entry;
  const report = entry.report || {};
  return e(
    'div',
    { className: 'ti-item' + (props.selected ? ' on' : '') },
    e(
      'button',
      {
        type: 'button',
        className: 'ti-item-main',
        onClick: props.onSelect,
        'aria-current': props.selected ? 'true' : undefined,
        title: report.title,
      },
      e('div', { className: 'ti-item-title' }, report.title || report.topic || '未命名报告'),
      e(
        'div',
        { className: 'ti-item-meta' },
        e('b', null, 'v' + entry.currentRev),
        e('span', { className: 'ti-item-dot' }),
        e('span', null, (Number.isFinite(report.sourceCount) ? report.sourceCount : 0) + ' 来源'),
        e('span', { className: 'ti-item-dot' }),
        e('span', null, tiFormatShortDate(entry.archivedAt)),
      ),
    ),
    e(
      'button',
      {
        type: 'button',
        className: 'ti-item-del',
        title: '删除这份归档',
        'aria-label': '删除「' + (report.title || '归档报告') + '」',
        onClick: (event) => {
          event.stopPropagation();
          props.onDelete();
        },
      },
      e(TiIcon, { name: 'trash', size: 12 }),
    ),
  );
}

/** 生成中的临时条目：点击可回到进度视图。 */
function TiArchivePending(props) {
  const pending = props.pending || {};
  const refining = pending.kind === 'refine';
  return e(
    'div',
    { className: 'ti-item ti-item-pending' + (props.selected ? ' on' : '') },
    e(
      'button',
      {
        type: 'button',
        className: 'ti-item-main',
        onClick: props.onSelect,
        title: pending.topic || '生成中',
      },
      e(
        'div',
        { className: 'ti-item-title' },
        (refining ? '修订中 · ' : '') + (pending.topic || '新洞察'),
      ),
      e(
        'div',
        { className: 'ti-item-meta' },
        e(
          'span',
          { className: 'ti-pending-tag' },
          e(TiSpinner, null),
          refining ? '修订中' : '生成中',
        ),
        e('span', { className: 'ti-item-dot' }),
        e('span', null, pending.stageLabel || '准备中'),
      ),
    ),
  );
}

function TiArchive(props) {
  const entries = Array.isArray(props.entries) ? props.entries : [];
  const keyword = String(props.query || '').trim().toLowerCase();
  const filtered = keyword
    ? entries.filter((entry) => {
        const report = entry.report || {};
        const haystack = [report.title, report.topic, report.oneLiner].filter(Boolean).join(' ').toLowerCase();
        return haystack.indexOf(keyword) !== -1;
      })
    : entries;
  const sorted = filtered.slice().sort((a, b) => {
    const left = tiParseDate(a.archivedAt);
    const right = tiParseDate(b.archivedAt);
    return (right ? right.getTime() : 0) - (left ? left.getTime() : 0);
  });

  return e(
    'aside',
    { className: 'ti-rail', 'aria-label': '技术洞察归档' },
    e(
      'div',
      { className: 'ti-rail-head' },
      e(
        'div',
        { className: 'ti-rail-title-row' },
        e('span', { className: 'ti-rail-title' }, '归档报告'),
        e(
          'span',
          { className: 'ti-rail-head-actions' },
          e('span', { className: 'ti-rail-count' }, entries.length + (props.pending ? 1 : 0) + ' 份'),
          e(TiIconBtn, {
            icon: 'chevronLeft',
            title: '收起归档目录',
            onClick: props.onCollapse,
          }),
        ),
      ),
      e(
        'div',
        { className: 'ti-search' },
        e(TiIcon, { name: 'search', size: 13 }),
        e('input', {
          type: 'search',
          value: props.query,
          placeholder: '搜索标题或主题',
          'aria-label': '搜索归档报告',
          onChange: (event) => props.onQueryChange(event.target.value),
        }),
      ),
    ),
    e(
      'div',
      { className: 'ti-rail-list' },
      props.pending
        ? e(TiArchivePending, {
            pending: props.pending,
            selected: props.pendingSelected,
            onSelect: props.onSelectPending,
          })
        : null,
      sorted.length
        ? sorted.map((entry) =>
            e(TiArchiveItem, {
              key: entry.report.id,
              entry,
              selected: entry.report.id === props.selectedId,
              onSelect: () => props.onSelect(entry.report.id),
              onDelete: () => props.onDelete(entry),
            }),
          )
        : e(
            'div',
            { className: 'ti-rail-empty' },
            entries.length
              ? '没有匹配的归档报告，换个关键词试试。'
              : '还没有归档报告。生成第一份洞察后，会自动出现在这里。',
          ),
    ),
  );
}

/** 归档目录收起后的窄条：点击图标重新展开。 */
function TiArchiveToggle(props) {
  return e(
    'button',
    {
      type: 'button',
      className: 'ti-rail-toggle',
      title: '展开归档目录',
      'aria-label': '展开归档目录',
      onClick: props.onExpand,
    },
    e(TiIcon, { name: 'chevronRight', size: 14 }),
    e('span', { className: 'ti-rail-toggle-label' }, '归档'),
    props.count ? e('span', { className: 'ti-rail-toggle-count' }, String(props.count)) : null,
  );
}


/* ── 50-page.js ── */
/* ─────────────────────────────────────────────────────────────
 * 技术洞察 · 页面外壳与状态编排
 * 负责：本地归档 store 的读写、状态 chip、生成 / 修订 / 编辑 / 回滚 / 删除
 * 等交互，以及左栏归档 + 右栏主内容的布局。
 * ───────────────────────────────────────────────────────────── */

function Page() {
  const [store, setStoreState] = useState(() => tiReadStore());
  const storeRef = useRef(store);
  const [toast, setToast] = useState(null);
  const [status, setStatus] = useState({ state: 'loading' });
  const [query, setQuery] = useState('');
  const [job, setJob] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null);
  const [dialog, setDialog] = useState(null);
  const pollTimerRef = useRef(0);
  const currentJobIdRef = useRef('');
  const jobTokenRef = useRef(0);
  const lastRequestRef = useRef(null);

  const selectedEntry = useMemo(
    () => store.reports.filter((entry) => entry.report.id === store.selectedId)[0] || null,
    [store.reports, store.selectedId],
  );
  /* 渲染前统一做一次结构归一化，保证四个固定分节与安全字段。 */
  const selectedReport = useMemo(
    () => (selectedEntry ? tiNormalizeReport(selectedEntry.report) : null),
    [selectedEntry],
  );

  /* ── 归档持久化 ─────────────────────────────────────── */

  const railCollapsed = !!(store.prefs && store.prefs.railCollapsed);


  const notify = useCallback((text, tone) => {
    setToast({ id: tiUid('toast'), text: text, tone: tone || 'info' });
  }, []);

  const commit = useCallback(
    (updater) => {
      const current = storeRef.current;
      const next = typeof updater === 'function' ? updater(current) : updater;
      if (!next) return current;
      storeRef.current = next;
      setStoreState(next);
      const result = tiWriteStore(next);
      if (!result.ok) notify(result.message, 'error');
      return next;
    },
    [notify],
  );

  /* 归档目录折叠状态持久化到本地 prefs。 */
  const toggleRail = useCallback(() => {
    commit((current) =>
      Object.assign({}, current, {
        prefs: Object.assign({}, current.prefs, { railCollapsed: !current.prefs.railCollapsed }),
      }),
    );
  }, [commit]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  /* ── 状态 chip ──────────────────────────────────────── */

  const refreshStatus = useCallback(() => {
    setStatus({ state: 'loading' });
    tiFetchStatus().then((next) => setStatus(next));
  }, []);

  useEffect(() => {
    let alive = true;
    tiFetchStatus().then((next) => {
      if (alive) setStatus(next);
    });
    /* 页面重新挂载时续接后台任务：运行中恢复进度，已完成则补归档。 */
    tiFetchLatestJob()
      .then((remote) => {
        if (!alive || !remote) return;
        if (remote.status === 'running') {
          const token = jobTokenRef.current + 1;
          jobTokenRef.current = token;
          currentJobIdRef.current = remote.id;
          commit((current) => Object.assign({}, current, { selectedId: TI_PENDING_ID }));
          setJob(jobToStateRef.current(remote));
          pollJobRef.current(remote.id, token);
          return;
        }
        if (remote.status === 'done' && remote.report) {
          if (storeRef.current.reports.some((entry) => entry.report.id === remote.report.id)) return;
          if (remote.kind === 'refine') archiveRefineRef.current(remote.report, remote.instruction);
          else archiveInsightRef.current(remote.report);
        }
      })
      .catch(() => {
        /* 后台任务查询失败不阻塞页面 */
      });
    return () => {
      alive = false;
      /* 卸载只停止轮询，不取消 Host 后台任务：切走页面后任务继续执行。 */
      if (pollTimerRef.current) {
        window.clearTimeout(pollTimerRef.current);
        pollTimerRef.current = 0;
      }
    };
  }, []);

  /* ── 生成用时计时器 ─────────────────────────────────── */

  const jobStartedAt = job ? job.startedAt : 0;
  useEffect(() => {
    if (!jobStartedAt) {
      setElapsed(0);
      return undefined;
    }
    setElapsed(Date.now() - jobStartedAt);
    const timer = window.setInterval(() => setElapsed(Date.now() - jobStartedAt), 200);
    return () => window.clearInterval(timer);
  }, [jobStartedAt]);

  /* 供挂载 effect 调用的最新实现（effect 只跑一次，避免依赖顺序问题）。 */
  const jobToStateRef = useRef(null);
  const pollJobRef = useRef(null);
  const archiveInsightRef = useRef(null);
  const archiveRefineRef = useRef(null);

  /* ── 后台任务：轮询 / 归档 / 取消 ────────────────────── */
  /* 生成在 Host 后台执行，页面只负责启动和轮询；切换插件/页面不会中断任务，
     回来时通过 latest job 自动续接进度或补归档。 */

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = 0;
    }
  }, []);

  const jobToState = (remote) => {
    const startedAt = tiParseDate(remote.startedAt);
    return Object.assign(tiEmptyJob(), {
      jobId: remote.id,
      kind: remote.kind,
      topic: remote.topic || '',
      depth: remote.depth || 'standard',
      instruction: remote.instruction || '',
      useWeb: true,
      stage: remote.stage || '',
      stageLabel: remote.stageLabel || '准备中',
      progress: Number.isFinite(remote.progress) ? remote.progress : 0,
      queries: Array.isArray(remote.queries) ? remote.queries : [],
      sources: Array.isArray(remote.sources) ? remote.sources : [],
      startedAt: startedAt ? startedAt.getTime() : Date.now(),
    });
  };

  /** 新洞察完成：按 report.id 去重后入归档。 */
  const archiveInsight = useCallback(
    (report) => {
      const archivedAt = new Date().toISOString();
      const entry = {
        report,
        archivedAt,
        revisions: [{ rev: 1, at: archivedAt, note: '初始洞察', report }],
        currentRev: 1,
      };
      commit((current) => {
        const shouldSelect = current.selectedId === TI_PENDING_ID || !current.selectedId;
        if (current.reports.some((item) => item.report.id === report.id)) {
          return Object.assign({}, current, { selectedId: shouldSelect ? report.id : current.selectedId });
        }
        return Object.assign({}, current, {
          reports: [entry].concat(current.reports),
          selectedId: shouldSelect ? report.id : current.selectedId,
        });
      });
      notify('洞察报告已生成并归档', 'success');
    },
    [commit, notify],
  );

  /** 修订完成：追加 revision；原报告已被删除时退化为新归档。 */
  const archiveRefine = useCallback(
    (report, instruction) => {
      const note = tiTruncate(instruction || '补充修订', 60);
      let nextRev = 0;
      commit((current) => {
        const shouldSelect = current.selectedId === TI_PENDING_ID || !current.selectedId || current.selectedId === report.id;
        if (!current.reports.some((entry) => entry.report.id === report.id)) {
          const archivedAt = new Date().toISOString();
          nextRev = Number.isFinite(report.revision) ? report.revision : 1;
          const entry = {
            report,
            archivedAt,
            revisions: [{ rev: nextRev, at: archivedAt, note, report }],
            currentRev: nextRev,
          };
          return Object.assign({}, current, {
            reports: [entry].concat(current.reports),
            selectedId: shouldSelect ? report.id : current.selectedId,
          });
        }
        const reports = current.reports.map((entry) => {
          if (entry.report.id !== report.id) return entry;
          nextRev = Math.max(entry.currentRev + 1, Number.isFinite(report.revision) ? report.revision : 0);
          const nextReport = Object.assign({}, report, {
            revision: nextRev,
            updatedAt: report.updatedAt || new Date().toISOString(),
          });
          return Object.assign({}, entry, {
            report: nextReport,
            revisions: entry.revisions.concat([
              { rev: nextRev, at: new Date().toISOString(), note, report: nextReport },
            ]),
            currentRev: nextRev,
          });
        });
        return Object.assign({}, current, {
          reports,
          selectedId: shouldSelect ? report.id : current.selectedId,
        });
      });
      notify('修订完成，已追加 v' + nextRev + ' 并归档', 'success');
    },
    [commit, notify],
  );

  /** 轮询后台任务直到结束；token 用于避免旧轮询覆盖新任务。 */
  const pollJob = useCallback(
    (jobId, token) => {
      let failures = 0;
      const tick = () => {
        if (jobTokenRef.current !== token) return;
        tiFetchJob(jobId)
          .then((remote) => {
            if (jobTokenRef.current !== token) return;
            if (!remote) {
              currentJobIdRef.current = '';
              setJob(null);
              notify('后台任务已过期，请重新发起。', 'error');
              return;
            }
            if (remote.status === 'running') {
              setJob(jobToState(remote));
              pollTimerRef.current = window.setTimeout(tick, 900);
              return;
            }
            currentJobIdRef.current = '';
            setJob(null);
            if (remote.status === 'done' && remote.report) {
              if (remote.kind === 'refine') archiveRefine(remote.report, remote.instruction);
              else archiveInsight(remote.report);
            } else if (remote.status === 'cancelled') {
              notify('已取消，输入内容已保留', 'info');
            } else {
              const message = remote.error && remote.error.message ? remote.error.message : '任务失败，请重试。';
              setError({
                title: remote.kind === 'refine' ? '补充修订失败' : '洞察生成失败',
                message,
                code: remote.error && remote.error.code,
                retryable: true,
              });
              notify('任务失败：' + message, 'error');
            }
          })
          .catch((failure) => {
            if (jobTokenRef.current !== token) return;
            failures += 1;
            if (failures < 4) {
              pollTimerRef.current = window.setTimeout(tick, 1500);
              return;
            }
            currentJobIdRef.current = '';
            setJob(null);
            const message = (failure && failure.message) || '无法获取后台任务状态';
            setError({ title: '任务状态获取失败', message, code: failure && failure.code, retryable: true });
            notify('任务状态获取失败：' + message, 'error');
          });
      };
      tick();
    },
    [archiveInsight, archiveRefine, notify],
  );

  /* ── 发起洞察生成（Host 后台任务） ───────────────────── */

  const startInsight = useCallback(
    (payload) => {
      const token = jobTokenRef.current + 1;
      jobTokenRef.current = token;
      lastRequestRef.current = { kind: 'insight', payload };
      setError(null);
      /* 立刻在归档目录里出现一条“生成中”，并选中它展示进度。 */
      commit((current) => Object.assign({}, current, { selectedId: TI_PENDING_ID }));
      setJob(
        Object.assign(tiEmptyJob(), {
          kind: 'insight',
          topic: payload.topic,
          focus: payload.focus,
          depth: payload.depth,
          startedAt: Date.now(),
          stage: 'preparing',
          stageLabel: '正在启动后台任务…',
          progress: 0.02,
        }),
      );
      tiStartJob('insight', payload)
        .then((remote) => {
          if (jobTokenRef.current !== token) return;
          currentJobIdRef.current = remote.id;
          setJob(jobToState(remote));
          pollJob(remote.id, token);
        })
        .catch((failure) => {
          if (jobTokenRef.current !== token) return;
          setJob(null);
          const message = (failure && failure.message) || '生成失败，请重试。';
          setError({ title: '洞察生成失败', message, code: failure && failure.code, retryable: true });
          notify('生成失败：' + message, 'error');
        });
    },
    [commit, notify, pollJob],
  );

  /* ── 发起补充修订（Host 后台任务） ───────────────────── */

  const startRefine = useCallback(
    (payload) => {
      const token = jobTokenRef.current + 1;
      jobTokenRef.current = token;
      lastRequestRef.current = { kind: 'refine', payload };
      setError(null);
      commit((current) => Object.assign({}, current, { selectedId: TI_PENDING_ID }));
      setJob(
        Object.assign(tiEmptyJob(), {
          kind: 'refine',
          topic: payload.report.topic || payload.report.title || '',
          instruction: payload.instruction,
          useWeb: payload.useWeb !== false,
          startedAt: Date.now(),
          stage: 'preparing',
          stageLabel: '正在启动后台修订任务…',
          progress: 0.02,
        }),
      );
      tiStartJob('refine', payload)
        .then((remote) => {
          if (jobTokenRef.current !== token) return;
          currentJobIdRef.current = remote.id;
          setJob(jobToState(remote));
          pollJob(remote.id, token);
        })
        .catch((failure) => {
          if (jobTokenRef.current !== token) return;
          setJob(null);
          const message = (failure && failure.message) || '修订失败，请重试。';
          setError({ title: '补充修订失败', message, code: failure && failure.code, retryable: true });
          notify('修订失败：' + message, 'error');
        });
    },
    [commit, notify, pollJob],
  );

  const cancelJob = useCallback(() => {
    const id = currentJobIdRef.current;
    jobTokenRef.current += 1;
    stopPolling();
    currentJobIdRef.current = '';
    setJob(null);
    commit((current) =>
      current.selectedId === TI_PENDING_ID ? Object.assign({}, current, { selectedId: '' }) : current,
    );
    if (id) {
      tiCancelJob(id).catch(() => {
        /* Host 侧可能已经结束 */
      });
    }
    notify('已取消，输入内容已保留', 'info');
  }, [commit, notify, stopPolling]);

  const retryLast = useCallback(() => {
    const request = lastRequestRef.current;
    setError(null);
    if (!request) return;
    if (request.kind === 'insight') startInsight(request.payload);
    else if (request.kind === 'refine') startRefine(request.payload);
  }, [startInsight, startRefine]);

  /* 挂载 effect 只跑一次，通过 ref 拿到最新的任务处理函数。 */
  jobToStateRef.current = jobToState;
  pollJobRef.current = pollJob;
  archiveInsightRef.current = archiveInsight;
  archiveRefineRef.current = archiveRefine;

  /* ── 归档增删改 ─────────────────────────────────────── */

  /** 追加一个修订版本（手动编辑 / 回滚统一走这里，不破坏历史）。 */
  const appendRevision = useCallback(
    (reportId, buildNextReport, note) => {
      commit((current) => {
        const reports = current.reports.map((entry) => {
          if (entry.report.id !== reportId) return entry;
          const nextRev = entry.currentRev + 1;
          /* 本地版本号与 Report.revision 保持一致，回传 Host 修订时可作为起点。 */
          const nextReport = Object.assign({}, buildNextReport(entry.report, nextRev), { revision: nextRev });
          return Object.assign({}, entry, {
            report: nextReport,
            revisions: entry.revisions.concat([
              { rev: nextRev, at: new Date().toISOString(), note, report: nextReport },
            ]),
            currentRev: nextRev,
          });
        });
        return Object.assign({}, current, { reports });
      });
    },
    [commit],
  );

  const saveSection = useCallback(
    (key, body) => {
      if (!selectedEntry) return;
      const meta = TI_SECTIONS.filter((item) => item.key === key)[0];
      const reportId = selectedEntry.report.id;
      appendRevision(
        reportId,
        (base) =>
          Object.assign({}, base, {
            sections: base.sections.map((section) =>
              section.key === key ? Object.assign({}, section, { body }) : section,
            ),
            updatedAt: new Date().toISOString(),
          }),
        '手动编辑 · ' + (meta ? meta.label : key),
      );
      notify('分节已保存，并生成新版本', 'success');
    },
    [appendRevision, notify, selectedEntry],
  );

  const saveMeta = useCallback(
    (draft) => {
      if (!selectedEntry) return;
      appendRevision(
        selectedEntry.report.id,
        (base) =>
          Object.assign({}, base, {
            title: draft.title || base.title,
            oneLiner: draft.oneLiner,
            updatedAt: new Date().toISOString(),
          }),
        '手动编辑 · 标题与结论',
      );
      notify('标题与一句话结论已更新', 'success');
    },
    [appendRevision, notify, selectedEntry],
  );

  const rollback = useCallback(
    (rev) => {
      if (!selectedEntry) return;
      const target = selectedEntry.revisions.filter((item) => item.rev === rev)[0];
      if (!target) {
        notify('找不到 v' + rev + ' 的内容', 'error');
        return;
      }
      appendRevision(
        selectedEntry.report.id,
        () =>
          Object.assign({}, tiDeepCopy(target.report), {
            revision: selectedEntry.currentRev + 1,
            updatedAt: new Date().toISOString(),
          }),
        '回滚到 v' + rev,
      );
      notify('已回滚到 v' + rev + '，并作为新版本保存', 'success');
    },
    [appendRevision, notify, selectedEntry],
  );

  const deleteEntry = useCallback(
    (entry) => {
      const id = entry.report.id;
      commit((current) =>
        Object.assign({}, current, {
          reports: current.reports.filter((item) => item.report.id !== id),
          selectedId: current.selectedId === id ? '' : current.selectedId,
        }),
      );
      notify('归档报告已删除', 'success');
    },
    [commit, notify],
  );

  /* ── 报告操作 ───────────────────────────────────────── */

  const copyMarkdown = useCallback(() => {
    if (!selectedEntry) return;
    tiCopyText(tiReportToMarkdown(selectedEntry.report)).then((ok) => {
      notify(ok ? 'Markdown 已复制到剪贴板' : '复制失败，请手动选择文本', ok ? 'success' : 'error');
    });
  }, [notify, selectedEntry]);

  const exportMarkdown = useCallback(() => {
    if (!selectedEntry) return;
    const markdown = tiReportToMarkdown(selectedEntry.report);
    const ok = tiDownloadText(tiReportFileName(selectedEntry.report), markdown);
    notify(ok ? '已开始下载 .md 文件' : '导出失败，请重试', ok ? 'success' : 'error');
  }, [notify, selectedEntry]);

  /* ── 输入区交互 ─────────────────────────────────────── */

  const onDraftChange = useCallback(
    (patch) => {
      commit((current) =>
        Object.assign({}, current, {
          draft: Object.assign({}, current.draft, patch),
          prefs: patch.depth ? Object.assign({}, current.prefs, { depth: patch.depth }) : current.prefs,
        }),
      );
    },
    [commit],
  );

  const submitInsight = useCallback(() => {
    const draft = storeRef.current.draft;
    const topic = String(draft.topic || '').trim();
    if (!topic) {
      notify('请先填写技术名称', 'error');
      return;
    }
    startInsight({ topic, focus: String(draft.focus || '').trim(), depth: draft.depth || 'standard' });
  }, [notify, startInsight]);

  const startNew = useCallback(() => {
    setError(null);
    setDialog(null);
    commit((current) => Object.assign({}, current, { selectedId: '' }));
  }, [commit]);

  const selectEntry = useCallback(
    (id) => {
      setError(null);
      setDialog(null);
      commit((current) => Object.assign({}, current, { selectedId: id }));
    },
    [commit],
  );

  const submitRefine = useCallback(
    (instruction, useWeb) => {
      if (!selectedEntry) return;
      setDialog(null);
      startRefine({ report: selectedEntry.report, instruction, useWeb });
    },
    [selectedEntry, startRefine],
  );

  /* ── 渲染 ───────────────────────────────────────────── */

  const busy = !!job;

  const renderStatusChips = () => {
    if (status.state === 'loading') {
      return [e(TiChip, { key: 'loading', tone: 'idle' }, e(TiSpinner, null), '正在检查环境')];
    }
    if (status.state === 'unknown') {
      return [
        e(
          TiChip,
          { key: 'unknown', tone: 'idle', dot: true, title: status.message || '无法获取 Host 状态' },
          '状态未知',
        ),
      ];
    }
    const modelLabel = status.modelName || status.model || '未选择模型';
    const modelTone = status.ready ? 'good' : 'warn';
    const webReady = status.webReady && status.fetchReady;
    return [
      e(
        TiChip,
        {
          key: 'model',
          tone: modelTone,
          icon: 'cpu',
          title: status.ready ? '当前 DSH 模型：' + modelLabel : status.message || '模型未就绪',
        },
        status.ready ? '模型 ' + modelLabel : '模型未就绪',
      ),
      e(
        TiChip,
        {
          key: 'web',
          tone: webReady ? 'good' : 'warn',
          icon: 'globe',
          title: webReady ? '联网检索可用' : '联网检索不可用，生成可能失败',
        },
        webReady ? '联网检索就绪' : '联网检索不可用',
      ),
    ];
  };

  const renderMain = () => {
    const viewingPending = store.selectedId === TI_PENDING_ID || !store.selectedId;
    /* 任务进行中：只有选中“生成中”条目或没有选中时才显示进度；
       用户点开其他归档报告时正常查看报告，不会被进度页卡住。 */
    if (job && viewingPending) {
      return e(TiProgressView, { job, elapsed, onCancel: cancelJob });
    }
    if (error && viewingPending) {
      return e(TiInsightError, {
        title: error.title,
        message: error.message,
        code: error.code,
        onRetry: error.retryable ? retryLast : null,
        onBack: () => setError(null),
      });
    }
    if (selectedEntry && selectedReport) {
      return e(TiReportView, {
        key: selectedReport.id,
        report: selectedReport,
        entry: selectedEntry,
        busy: busy,
        onRefine: () => setDialog({ kind: 'refine' }),
        onCopy: copyMarkdown,
        onExport: exportMarkdown,
        onDelete: () => setDialog({ kind: 'delete', entry: selectedEntry }),
        onSaveSection: saveSection,
        onSaveMeta: saveMeta,
        onRollback: rollback,
      });
    }
    if (job) {
      return e(TiProgressView, { job, elapsed, onCancel: cancelJob });
    }
    if (error) {
      return e(TiInsightError, {
        title: error.title,
        message: error.message,
        code: error.code,
        onRetry: error.retryable ? retryLast : null,
        onBack: () => setError(null),
      });
    }
    return e(TiGenerator, {
      draft: store.draft,
      disabled: busy,
      onDraftChange,
      onSubmit: submitInsight,
    });
  };

  const requestDelete = useCallback(
    (entry) => {
      if (busy) {
        notify('正在生成或修订，请先取消或等待完成后再删除', 'info');
        return;
      }
      setDialog({ kind: 'delete', entry });
    },
    [busy, notify],
  );

  const deleteDialogState =
    dialog && dialog.kind === 'delete'
      ? {
          title: '删除归档报告',
          body: '确定删除「' + (dialog.entry.report.title || '这份报告') + '」？',
          detail: '报告及其全部修订版本都会从本地归档中移除，操作不可恢复。',
          ok: '删除',
          danger: true,
          action: () => deleteEntry(dialog.entry),
        }
      : null;

  return e(
    'div',
    { className: 'ti-root' },
    e('style', null, TI_CSS),
    e(
      'div',
      { className: 'ti-inner' },
      e(
        'header',
        { className: 'ti-head' },
        e(
          'div',
          { className: 'ti-brand' },
          e('div', { className: 'ti-logo' }, e(TiIcon, { name: 'compass', size: 22, strokeWidth: 1.7 })),
          e(
            'div',
            { style: { minWidth: 0 } },
            e(
              'div',
              { className: 'ti-title-row' },
              e('h1', { className: 'ti-title' }, '技术洞察'),
              status.state === 'ok' && status.version ? e(TiChip, { tone: 'brand' }, 'v' + status.version) : null,
            ),
            e(
              'p',
              { className: 'ti-sub' },
              '联网检索 + 模型分析，一键生成技术介绍、技术方案设计、关键难点、使用场景与业界状态；自动归档，可多次修订与回滚。',
            ),
          ),
        ),
        e(
          'div',
          { className: 'ti-head-actions' },
          e('div', { className: 'ti-chips' }, renderStatusChips()),
          e(TiIconBtn, {
            icon: 'refresh',
            title: '刷新环境状态',
            disabled: status.state === 'loading',
            onClick: refreshStatus,
          }),
          e(TiBtn, { variant: 'primary', icon: 'plus', disabled: busy, onClick: startNew }, '新建洞察'),
        ),
      ),
      e(
        'div',
        { className: 'ti-body' + (railCollapsed ? ' rail-collapsed' : '') },
        railCollapsed
          ? e(TiArchiveToggle, { count: store.reports.length + (job ? 1 : 0), onExpand: toggleRail })
          : e(TiArchive, {
              entries: store.reports,
              selectedId: store.selectedId,
              query: query,
              onQueryChange: setQuery,
              onSelect: selectEntry,
              onDelete: requestDelete,
              onCollapse: toggleRail,
              pending: job
                ? {
                    kind: job.kind,
                    topic: job.topic,
                    stageLabel: job.stageLabel,
                  }
                : null,
              pendingSelected: store.selectedId === TI_PENDING_ID,
              onSelectPending: () =>
                commit((current) => Object.assign({}, current, { selectedId: TI_PENDING_ID })),
            }),
        e('main', { className: 'ti-main' }, e('div', { className: 'ti-main-inner' }, renderMain())),
      ),
    ),
    dialog && dialog.kind === 'refine' && selectedEntry
      ? e(TiRefineDialog, {
          disabled: busy,
          onClose: () => setDialog(null),
          onSubmit: submitRefine,
        })
      : null,
    e(TiConfirmDialog, { state: deleteDialogState, onClose: () => setDialog(null) }),
    e(TiToast, { toast: toast }),
  );
}


/* ── 90-apply.js ── */
/* ─────────────────────────────────────────────────────────────
 * 技术洞察 · Client 入口
 * 注册左侧导航入口（sidebar.panellist）与主面板（main）。
 * 注册模式与宿主页面一致：同一个面板 id 同时驱动侧栏与 main。
 * ───────────────────────────────────────────────────────────── */

/** 侧栏图标：16×16 线性 SVG，跟随 currentColor。 */
function TiPanelIcon(props) {
  const size = (props && props.size) || 16;
  return e(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.7,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
    },
    e('circle', { cx: 11, cy: 11, r: 6.6 }),
    e('path', { d: 'm16 16 4.4 4.4' }),
    e('path', { d: 'M8.2 13.2V9.4M11 13.2V7.4M13.8 13.2v-2.4' }),
  );
}

/**
 * 页面级错误边界：任何渲染异常都显示可读错误而不是白屏。
 * 同时把错误打到 console，便于用户反馈。
 */
class TiErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error: error || new Error('未知渲染错误') };
  }

  componentDidCatch(error, info) {
    try {
      console.error('[tech-insight] 页面渲染出错：', error, info);
    } catch (failure) {
      /* 忽略日志失败 */
    }
  }

  render() {
    if (this.state.error) {
      return e(
        'div',
        { className: 'ti-crash', role: 'alert' },
        e('h2', { className: 'ti-crash-title' }, '技术洞察页面渲染出错'),
        e(
          'p',
          { className: 'ti-crash-sub' },
          '页面没有白屏是错误边界的兜底。可以点“重新渲染”重试；如果反复出现，请把下面的错误信息反馈给插件维护者。',
        ),
        e('pre', { className: 'ti-crash-detail' }, String((this.state.error && this.state.error.stack) || this.state.error)),
        e(
          'button',
          { type: 'button', className: 'ti-btn ti-btn-soft', onClick: () => this.setState({ error: null }) },
          '重新渲染',
        ),
      );
    }
    return this.props.children;
  }
}

function TiPage() {
  return e(TiErrorBoundary, null, e(Page));
}

function apply(ctx) {
  ctx.slots.inject('main', () =>
    ctx.slots.register(
      { name: 'main', key: TI_PANEL_ID },
      TiPage,
    ),
  );

  ctx.slots.inject('sidebar.panellist', () =>
    ctx.slots.register(
      {
        name: 'sidebar.panellist',
        id: TI_PANEL_ID,
        order: 7,
        label: () => '技术洞察',
      },
      TiPanelIcon,
    ),
  );
}


    return { inject: ['slots'], apply };
  },
});
