/**
 * Host 路由集成测试：用假的 ctx / req / res 驱动 index.js 注册的 handler。
 *
 * 任务在 Host 后台执行，HTTP 只负责启动/轮询/取消，因此测试通过轮询
 * GET /tech-insight/job 等待任务结束，验证后台任务与页面连接解耦。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import { apply } from '../index.js';

const RAW = {
  title: '向量数据库技术洞察',
  oneLiner: '向量数据库是 RAG 的基础设施，成本与一致性仍是门槛。',
  sections: {
    introduction: '## 是什么\n向量数据库存储高维向量。',
    solution: '## 总体架构\n分层架构。\n\n## 落地步骤\n1. 验证',
    difficulties: '## 精度\n近似索引有精度损失。',
    scenarios: '## RAG\n企业知识库。',
    industry: '## 现状\n云厂商均已提供托管服务。',
  },
  references: [
    { title: 'Milvus', url: 'https://milvus.io/docs', note: '产品能力' },
    { title: '论文', url: 'https://arxiv.org/abs/2401.00001', note: '索引原理' },
  ],
  visuals: {
    architecture: {
      title: '分层架构',
      layers: [
        { name: '接入层', items: ['API'] },
        { name: '存储层', items: ['索引'] },
      ],
    },
    difficulty: {
      title: '难点强度',
      items: [
        { name: '精度', score: 80, reason: '近似损失' },
        { name: '成本', score: 70, reason: '内存高' },
      ],
    },
    matrix: {
      title: '场景矩阵',
      xLabel: '成熟度',
      yLabel: '价值',
      items: [
        { name: 'RAG', x: 80, y: 90 },
        { name: '多模态', x: 40, y: 70 },
      ],
    },
    timeline: {
      title: '时间线',
      items: [
        { time: '2024', title: '普及', detail: '成为标配' },
        { time: '2026', title: '当前', detail: '持续演进' },
      ],
    },
  },
};

const SOURCES = [
  { url: 'https://milvus.io/docs', title: 'Milvus 文档', snippet: '向量检索' },
  { url: 'https://arxiv.org/abs/2401.00001', title: '索引论文', snippet: 'ANN' },
  { url: 'https://example.com/a', title: '案例 A', snippet: '落地' },
];

function makeWeb(overrides = {}) {
  return {
    async searchReady() {
      return true;
    },
    async fetchReady() {
      return true;
    },
    async search() {
      return { sources: SOURCES, truncated: false };
    },
    async fetch(request) {
      return {
        url: request.url,
        statusCode: 200,
        truncated: false,
        body: { kind: 'html', content: '<p>' + '正文'.repeat(100) + '</p>' },
      };
    },
    ...overrides,
  };
}

function makeLlm() {
  return {
    async resolveModelInfo() {
      return { id: 'deepseek-flash', defaultMaxTokens: 8192, reasoning: { efforts: [{ id: 'low' }, { id: 'high' }] } };
    },
    stream() {
      const text = JSON.stringify(RAW);
      return (async function* () {
        yield { type: 'text-delta', index: 0, text };
        yield { type: 'finish', reason: { kind: 'stop' } };
      })();
    },
  };
}

class FakeRes extends EventEmitter {
  constructor() {
    super();
    this.status = 0;
    this.headers = {};
    this.chunks = [];
    this.writableEnded = false;
    this.destroyed = false;
  }
  writeHead(status, headers) {
    this.status = status;
    this.headers = headers || {};
    return this;
  }
  write(chunk) {
    this.chunks.push(String(chunk));
    return true;
  }
  end(chunk) {
    if (chunk !== undefined) this.chunks.push(String(chunk));
    this.writableEnded = true;
    this.emit('close');
  }
  get text() {
    return this.chunks.join('');
  }
  get json() {
    return JSON.parse(this.text);
  }
}

class FakeReq extends EventEmitter {
  constructor(method, body, url) {
    super();
    this.method = method;
    this.headers = { origin: 'http://127.0.0.1:57457' };
    this.url = url || '/tech-insight/status';
    this._body = body;
  }
  start() {
    if (this._body === undefined) {
      this.emit('end');
      return;
    }
    this.emit('data', Buffer.from(JSON.stringify(this._body)));
    this.emit('end');
  }
}

function makeCtx({ web = makeWeb(), llm = makeLlm(), rejection = 0, agents = null, lateConnection = false } = {}) {
  const routes = new Map();
  const services = {
    agents,
    webServer: {
      register(route) {
        routes.set(route.path, route.handler);
        return () => routes.delete(route.path);
      },
    },
    connection: lateConnection ? undefined : { requestRejection: () => rejection },
    web,
    llm,
    agentDefaultModel: { currentSelection: () => ({ provider: 'deepseek-account', model: 'deepseek-flash' }) },
  };
  const ctx = { get: (name) => services[name], effect: (fn) => fn() };
  apply(ctx);
  return { routes, services };
}

async function call(handler, method, body, url) {
  const req = new FakeReq(method, body, url);
  const res = new FakeRes();
  const promise = handler(req, res);
  req.start();
  await promise;
  return res;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitJob(routes, id, predicate, attempts = 100) {
  for (let index = 0; index < attempts; index += 1) {
    const res = await call(routes.get('/tech-insight/job'), 'GET', undefined, '/tech-insight/job?id=' + encodeURIComponent(id));
    const job = res.json.job;
    if (job && predicate(job)) return job;
    await sleep(10);
  }
  throw new Error('job did not reach expected state: ' + id);
}

test('registers the five routes', () => {
  const { routes } = makeCtx();
  assert.deepEqual(Array.from(routes.keys()).sort(), [
    '/tech-insight/insight',
    '/tech-insight/job',
    '/tech-insight/job/cancel',
    '/tech-insight/refine',
    '/tech-insight/status',
  ]);
});

test('GET /status returns model and web readiness', async () => {
  const { routes } = makeCtx();
  const res = await call(routes.get('/tech-insight/status'), 'GET');
  assert.equal(res.status, 200);
  const payload = res.json;
  assert.equal(payload.ok, true);
  assert.equal(payload.ready, true);
  assert.equal(payload.provider, 'deepseek-account');
  assert.equal(payload.webReady, true);
});

test('status returns 401 when the connection is rejected', async () => {
  const { routes } = makeCtx({ rejection: 401 });
  const res = await call(routes.get('/tech-insight/status'), 'GET');
  assert.equal(res.status, 401);
  assert.equal(res.json.error.code, 'UNAUTHORIZED');
});

test('status returns 405 for other methods', async () => {
  const { routes } = makeCtx();
  const res = await call(routes.get('/tech-insight/status'), 'POST', {});
  assert.equal(res.status, 405);
});

test('POST /insight starts a background job that completes independently', async () => {
  const { routes } = makeCtx();
  const started = await call(routes.get('/tech-insight/insight'), 'POST', { topic: '向量数据库', depth: 'quick' });
  assert.equal(started.status, 200);
  const job = started.json.job;
  assert.equal(job.status, 'running');
  assert.match(job.id, /^ti-job-/);
  assert.equal(job.kind, 'insight');

  const done = await waitJob(routes, job.id, (item) => item.status === 'done' || item.status === 'error');
  assert.equal(done.status, 'done');
  assert.equal(done.report.topic, '向量数据库');
  assert.equal(done.report.sections.length, 5);
  assert.ok(done.report.visuals.architecture.layers.length >= 2);
  assert.ok(done.report.id.startsWith('ti-'));
  assert.ok(done.durationMs >= 0);
  assert.ok(done.queries.length > 0);
  assert.ok(done.sources.length > 0);
});

test('POST /insight returns 400 for a missing topic', async () => {
  const { routes } = makeCtx();
  const res = await call(routes.get('/tech-insight/insight'), 'POST', { topic: '  ' });
  assert.equal(res.status, 400);
  assert.equal(res.json.error.code, 'BAD_REQUEST');
});

test('insight emits an error status when web search needs credentials', async () => {
  const { routes } = makeCtx({
    web: makeWeb({
      async search() {
        const error = new Error('DeepSeek search has no API key');
        error.code = 'WEB_PROVIDER_CREDENTIAL_MISSING';
        throw error;
      },
    }),
  });
  const started = await call(routes.get('/tech-insight/insight'), 'POST', { topic: 'x' });
  const job = await waitJob(routes, started.json.job.id, (item) => item.status === 'error');
  assert.equal(job.error.code, 'WEB_CREDENTIAL_MISSING');
  assert.match(job.error.message, /登录 DeepSeek 账号/);
});

test('insight runs its search inside an account-route initiator when one exists', async () => {
  const account = { session: { requestContext: () => ({ provider: 'deepseek-account' }) } };
  let entered = 0;
  let sawInitiator = false;
  const agents = {
    currentInitiator: () => (entered > 0 ? account : undefined),
    list: () => [account],
    roots: () => [account],
    withInitiator: (agent, operation) => {
      entered += 1;
      try {
        return operation();
      } finally {
        entered -= 1;
      }
    },
  };
  const web = makeWeb();
  const originalSearch = web.search;
  web.search = async (request) => {
    sawInitiator = agents.currentInitiator() === account;
    return originalSearch(request);
  };
  const { routes } = makeCtx({ web, agents });
  const started = await call(routes.get('/tech-insight/insight'), 'POST', { topic: '向量数据库', depth: 'quick' });
  const job = await waitJob(routes, started.json.job.id, (item) => item.status === 'done' || item.status === 'error');
  assert.equal(job.status, 'done');
  assert.equal(sawInitiator, true);
});

test('cancel stops a running background job', async () => {
  const slowWeb = makeWeb({
    async search() {
      await sleep(120);
      return { sources: SOURCES, truncated: false };
    },
  });
  const { routes } = makeCtx({ web: slowWeb });
  const started = await call(routes.get('/tech-insight/insight'), 'POST', { topic: '向量数据库' });
  const id = started.json.job.id;
  const cancelled = await call(routes.get('/tech-insight/job/cancel'), 'POST', { id });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.json.job.status, 'cancelled');
  const after = await waitJob(routes, id, (item) => item.status !== 'running');
  assert.equal(after.status, 'cancelled');
});

test('refine runs as a background job and returns a new revision', async () => {
  const { routes } = makeCtx();
  const started = await call(routes.get('/tech-insight/insight'), 'POST', { topic: '向量数据库', depth: 'quick' });
  const first = await waitJob(routes, started.json.job.id, (item) => item.status === 'done' || item.status === 'error');
  assert.equal(first.status, 'done');
  const refined = await call(routes.get('/tech-insight/refine'), 'POST', {
    report: first.report,
    instruction: '补充国内厂商与关键参数',
    useWeb: true,
  });
  const second = await waitJob(routes, refined.json.job.id, (item) => item.status === 'done' || item.status === 'error');
  assert.equal(second.status, 'done');
  assert.equal(second.kind, 'refine');
  assert.equal(second.report.id, first.report.id);
  assert.equal(second.report.revision, first.report.revision + 1);
});

test('GET /job without id returns the latest running job', async () => {
  const slowWeb = makeWeb({
    async search() {
      await sleep(80);
      return { sources: SOURCES, truncated: false };
    },
  });
  const { routes } = makeCtx({ web: slowWeb });
  const started = await call(routes.get('/tech-insight/insight'), 'POST', { topic: '向量数据库' });
  const res = await call(routes.get('/tech-insight/job'), 'GET', undefined, '/tech-insight/job');
  assert.equal(res.json.job.id, started.json.job.id);
  assert.equal(res.json.job.status, 'running');
  await call(routes.get('/tech-insight/job/cancel'), 'POST', { id: started.json.job.id });
});

test('connection is resolved per request, so cold-start ordering cannot reject requests', async () => {
  const { routes, services } = makeCtx({ lateConnection: true });
  /* apply 时 connection 还不存在：修复前这里会被兜底成 503/UNAUTHORIZED。 */
  services.connection = { requestRejection: () => 0 };
  const res = await call(routes.get('/tech-insight/status'), 'GET');
  assert.equal(res.status, 200);
  assert.equal(res.json.ok, true);

  /* 真正未认证时仍然是 401。 */
  const rejecting = makeCtx({ rejection: 401 });
  const rejected = await call(rejecting.routes.get('/tech-insight/status'), 'GET');
  assert.equal(rejected.status, 401);
  assert.equal(rejected.json.error.code, 'UNAUTHORIZED');
});
