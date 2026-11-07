/**
 * Host half of the 技术洞察 bundle.
 *
 * 生成任务由 Host 在后台执行，与浏览器连接解耦：页面切走、插件切换甚至关闭
 * 标签页都不会中断任务。浏览器通过下面的同源路由启动/轮询/取消任务：
 *
 *   GET  /tech-insight/status        当前模型 / 联网检索可用性
 *   POST /tech-insight/insight       启动「一键洞察」后台任务，立即返回 job
 *   POST /tech-insight/refine        启动「补充修订」后台任务，立即返回 job
 *   GET  /tech-insight/job?id=       查询任务（省略 id 时返回最近/进行中的任务）
 *   POST /tech-insight/job/cancel    取消任务 { id }
 *
 * 联网能力来自 Host 的 `web` 服务，模型来自当前 profile 的默认模型选择；
 * 密钥与账号态始终留在 Host，浏览器只拿到进度、报告文本与来源链接。
 */
import { InsightError, createInsightService, normalizeGenerateInput } from './lib/insight.js';

const BODY_LIMIT = 512 * 1024;
const JOB_TIMEOUT_MS = 480 * 1000;
const JOB_LIMIT = 20;
const JOB_TTL_MS = 2 * 60 * 60 * 1000;
const SOURCE_LIMIT = 12;

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(JSON.stringify(payload));
}

function readJson(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new InsightError('BODY_TOO_LARGE', '请求体过大。'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(text ? JSON.parse(text) : {});
      } catch (error) {
        reject(new InsightError('BAD_REQUEST', '请求体不是合法 JSON。'));
      }
    });
    req.on('error', reject);
  });
}

function errorPayload(error) {
  if (error instanceof InsightError) return { code: error.code, message: error.message };
  const code = error && typeof error.code === 'string' ? error.code : 'INTERNAL_ERROR';
  const message = error && typeof error.message === 'string' ? error.message : '服务内部错误。';
  return { code, message };
}

function clampText(value, max) {
  const text = typeof value === 'string' ? value : '';
  return text.length > max ? text.slice(0, max) : text;
}

function siteOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (error) {
    return '';
  }
}

/** 合并来源（按 URL 去重，保留最近 12 条）。 */
function mergeSources(previous, incoming) {
  const list = Array.isArray(previous) ? previous.slice() : [];
  const seen = new Set(list.map((item) => item && item.url).filter(Boolean));
  for (const item of Array.isArray(incoming) ? incoming : []) {
    if (!item || typeof item !== 'object') continue;
    const url = clampText(item.url, 500);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    list.push({
      title: clampText(item.title, 300) || siteOf(url),
      url,
      snippet: clampText(item.snippet, 400),
      site: clampText(item.site, 120) || siteOf(url),
    });
  }
  return list.slice(0, SOURCE_LIMIT);
}

/** 对外暴露的任务视图（运行中不带 report，减少轮询体积）。 */
function jobView(job) {
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    topic: job.topic,
    depth: job.depth,
    instruction: job.instruction,
    stage: job.stage,
    stageLabel: job.stageLabel,
    progress: job.progress,
    queries: job.queries,
    sources: job.sources,
    startedAt: job.startedAt,
    updatedAt: job.updatedAt,
    durationMs: job.durationMs,
    error: job.error,
    report: job.status === 'done' ? job.report : null,
  };
}

export const inject = ['webServer', 'connection'];

export function apply(ctx) {
  const webServer = ctx.get('webServer');
  if (!webServer) return;

  const service = createInsightService({
    getWeb: () => ctx.get('web'),
    getLlm: () => ctx.get('llm'),
    getSelection: () => {
      const selection = ctx.get('agentDefaultModel');
      return selection ? selection.currentSelection() : null;
    },
    /* 检索凭据：deepseek-official 搜索 provider 需要在发起会话的作用域内取账号 token。 */
    getAgents: () => ctx.get('agents'),
  });

  /** 后台任务表：内存态，Host 进程存活期间有效；页面切换不影响任务。 */
  const jobs = new Map();
  const controllers = new Map();
  let jobSeq = 0;

  const pruneJobs = () => {
    const nowMs = Date.now();
    const finished = Array.from(jobs.values())
      .filter((job) => job.status !== 'running')
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
    for (const job of finished) {
      if (jobs.size <= JOB_LIMIT && nowMs - job.updatedAtMs < JOB_TTL_MS) continue;
      jobs.delete(job.id);
    }
    /* 极端情况下仍超限时，从最旧的完成任务开始删。 */
    if (jobs.size > JOB_LIMIT) {
      for (const job of finished.slice(JOB_LIMIT)) jobs.delete(job.id);
    }
  };

  const latestJob = () => {
    let running = null;
    let latest = null;
    for (const job of jobs.values()) {
      if (job.status === 'running' && (!running || job.createdAtMs > running.createdAtMs)) running = job;
      if (!latest || job.createdAtMs > latest.createdAtMs) latest = job;
    }
    return running || latest;
  };

  /** 启动一个后台任务；HTTP 请求立即返回 job，任务在 Host 独立执行。 */
  const startJob = (kind, params) => {
    jobSeq += 1;
    const nowMs = Date.now();
    const job = {
      id: `ti-job-${nowMs.toString(36)}-${jobSeq.toString(36)}`,
      kind,
      status: 'running',
      topic: clampText(params && params.topic, 120),
      depth: clampText(params && params.depth, 20) || 'standard',
      instruction: kind === 'refine' ? clampText(params && params.instruction, 600) : '',
      stage: 'preparing',
      stageLabel: '正在准备…',
      progress: 0.02,
      queries: [],
      sources: [],
      startedAt: new Date(nowMs).toISOString(),
      startedAtMs: nowMs,
      updatedAt: new Date(nowMs).toISOString(),
      updatedAtMs: nowMs,
      durationMs: null,
      error: null,
      report: null,
    };
    jobs.set(job.id, job);

    const controller = new AbortController();
    controllers.set(job.id, controller);
    const touch = () => {
      job.updatedAtMs = Date.now();
      job.updatedAt = new Date(job.updatedAtMs).toISOString();
    };
    const emit = (event, data) => {
      touch();
      if (event === 'stage') {
        if (typeof data.stage === 'string') job.stage = data.stage;
        if (typeof data.label === 'string' && data.label) job.stageLabel = data.label;
        if (Number.isFinite(data.progress)) job.progress = Math.max(0, Math.min(1, data.progress));
      } else if (event === 'queries') {
        job.queries = (Array.isArray(data.queries) ? data.queries : []).filter((item) => typeof item === 'string').slice(0, 12);
      } else if (event === 'sources') {
        job.sources = mergeSources(job.sources, data.sources);
      } else if (event === 'report') {
        if (data && data.report) job.report = data.report;
      }
    };

    const timer = setTimeout(() => {
      if (job.status === 'running') {
        controller.abort();
        if (job.status === 'running') {
          job.status = 'error';
          job.error = { code: 'TIMEOUT', message: '后台任务超时（超过 8 分钟），请降低深度后重试。' };
          touch();
        }
      }
    }, JOB_TIMEOUT_MS);
    if (typeof timer.unref === 'function') timer.unref();

    const run = kind === 'refine' ? service.refine(params, emit, controller.signal) : service.generate(params, emit, controller.signal);
    run
      .then((report) => {
        if (job.status !== 'running') return;
        job.report = report;
        job.status = 'done';
        job.progress = 1;
        job.stage = 'done';
        job.stageLabel = '生成完成';
        job.durationMs = Date.now() - job.startedAtMs;
        touch();
      })
      .catch((error) => {
        if (job.status !== 'running') return;
        if (controller.signal.aborted) {
          job.status = 'cancelled';
          job.error = { code: 'ABORTED', message: '任务已取消。' };
        } else {
          job.status = 'error';
          job.error = errorPayload(error);
        }
        job.durationMs = Date.now() - job.startedAtMs;
        touch();
      })
      .finally(() => {
        clearTimeout(timer);
        controllers.delete(job.id);
        pruneJobs();
      });

    return job;
  };

  /**
   * 与其它浏览器 API 相同的连接信任检查。
   * 注意：必须每次请求时读取 connection。冷启动时插件 apply 可能早于
   * connection 服务就绪，apply 阶段固取会得到 undefined 并把所有请求误拒。
   */
  const rejectionOf = (req) => {
    const connection = ctx.get('connection');
    if (!connection || typeof connection.requestRejection !== 'function') return 503;
    return connection.requestRejection({ headers: req.headers });
  };

  const guard = (req, res, method) => {
    if (req.method !== method) {
      sendJson(res, 405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: `只支持 ${method}` } });
      return false;
    }
    const rejection = rejectionOf(req);
    if (rejection) {
      sendJson(res, rejection, { ok: false, error: { code: 'UNAUTHORIZED', message: '未认证的请求' } });
      return false;
    }
    return true;
  };

  const statusHandler = async (req, res) => {
    if (!guard(req, res, 'GET')) return;
    try {
      sendJson(res, 200, await service.status());
    } catch (error) {
      sendJson(res, 500, { ok: false, error: errorPayload(error) });
    }
  };

  const startHandler = (kind) => async (req, res) => {
    if (!guard(req, res, 'POST')) return;
    let body;
    try {
      body = await readJson(req, BODY_LIMIT);
    } catch (error) {
      sendJson(res, error instanceof InsightError && error.code === 'BODY_TOO_LARGE' ? 413 : 400, {
        ok: false,
        error: errorPayload(error),
      });
      return;
    }
    /* 明显的参数错误同步返回，其余校验失败会体现在任务状态里。 */
    if (kind === 'insight') {
      try {
        normalizeGenerateInput(body);
      } catch (error) {
        sendJson(res, 400, { ok: false, error: errorPayload(error) });
        return;
      }
    } else if (!body || typeof body !== 'object' || !body.report || !clampText(body.instruction, 600).trim()) {
      sendJson(res, 400, { ok: false, error: { code: 'BAD_REQUEST', message: '缺少要修订的报告或修订要求。' } });
      return;
    }
    const job = startJob(kind, body);
    sendJson(res, 200, { ok: true, job: jobView(job) });
  };

  const jobHandler = (req, res) => {
    if (!guard(req, res, 'GET')) return;
    let id = '';
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      id = clampText(url.searchParams.get('id') || '', 120);
    } catch (error) {
      id = '';
    }
    const job = id ? jobs.get(id) : latestJob();
    if (!job) {
      sendJson(res, 200, { ok: true, job: null });
      return;
    }
    sendJson(res, 200, { ok: true, job: jobView(job) });
  };

  const cancelHandler = async (req, res) => {
    if (!guard(req, res, 'POST')) return;
    let body;
    try {
      body = await readJson(req, BODY_LIMIT);
    } catch (error) {
      sendJson(res, 400, { ok: false, error: errorPayload(error) });
      return;
    }
    const id = clampText(body && body.id, 120);
    const job = id ? jobs.get(id) : latestJob();
    if (!job) {
      sendJson(res, 404, { ok: false, error: { code: 'NOT_FOUND', message: '任务不存在或已过期。' } });
      return;
    }
    const controller = controllers.get(job.id);
    if (job.status === 'running' && controller) {
      controller.abort();
      job.status = 'cancelled';
      job.error = { code: 'ABORTED', message: '任务已取消。' };
      job.durationMs = Date.now() - job.startedAtMs;
      job.updatedAtMs = Date.now();
      job.updatedAt = new Date(job.updatedAtMs).toISOString();
    }
    sendJson(res, 200, { ok: true, job: jobView(job) });
  };

  ctx.effect(() =>
    webServer.register({ kind: 'exact', path: '/tech-insight/status', handler: statusHandler }),
  );
  ctx.effect(() =>
    webServer.register({ kind: 'exact', path: '/tech-insight/insight', handler: startHandler('insight') }),
  );
  ctx.effect(() =>
    webServer.register({ kind: 'exact', path: '/tech-insight/refine', handler: startHandler('refine') }),
  );
  ctx.effect(() =>
    webServer.register({ kind: 'exact', path: '/tech-insight/job', handler: jobHandler }),
  );
  ctx.effect(() =>
    webServer.register({ kind: 'exact', path: '/tech-insight/job/cancel', handler: cancelHandler }),
  );
}
