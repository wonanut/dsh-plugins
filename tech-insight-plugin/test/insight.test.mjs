/**
 * Host 纯逻辑测试：node --test test/
 *
 * 不依赖 Cordis runtime：web / llm 都用假实现注入，验证检索→抓取→生成→
 * 规范化的完整管线，以及解析、URL 白名单、修订递增等关键行为。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SECTION_DEFS,
  buildQueries,
  buildRefineQueries,
  extractTextFromHtml,
  mergeSearchResults,
  buildCorpus,
  parseJsonObject,
  normalizeReport,
  newReportId,
  normalizeGenerateInput,
  selectSearchInitiator,
  createInsightService,
} from '../lib/insight.js';

const VALID_RAW = {
  title: '向量数据库技术洞察',
  oneLiner: '向量数据库正在成为 RAG 与多模态检索的基础设施，但成本与一致性仍是主要门槛。',
  sections: {
    introduction: '## 是什么\n向量数据库用于存储和检索高维向量。\n\n## 核心组成\n- 索引\n- 存储',
    solution: '## 总体架构\n接入层 / 计算层 / 存储层。\n\n## 核心流程\n1. 向量化\n2. ANN 检索\n\n## 关键技术选型\n- HNSW vs IVF：HNSW 召回更高、内存更大\n\n## 关键实现与参数\n- M=16，efSearch=64\n\n## 失败处理与可靠性\n- 副本与降级\n\n## 落地步骤\n1. 验证\n2. 试点',
    difficulties: '## 召回与精度\n索引近似导致精度损失。\n\n## 成本\n内存成本高。',
    scenarios: '## RAG 检索\n适合企业知识库。\n\n## 多模态检索\n适合图片视频。',
    industry: '## 采用现状\n头部云厂商均已推出托管服务。\n\n## 主要玩家\nMilvus、Pinecone。',
  },
  references: [
    { title: '官方文档', url: 'https://milvus.io/docs', note: '产品能力' },
    { title: '论文', url: 'https://arxiv.org/abs/2401.00001', note: '索引原理' },
    { title: '伪造链接', url: 'https://made-up.example.com/x', note: '不应保留' },
  ],
  visuals: {
    architecture: {
      title: '向量数据库分层架构',
      layers: [
        { name: '接入层', items: ['SDK/API', '查询网关'] },
        { name: '计算层', items: ['向量化', 'ANN 检索'] },
        { name: '存储层', items: ['向量索引', '元数据'] },
      ],
    },
    difficulty: {
      title: '关键难点强度（0–100）',
      items: [
        { name: '召回精度', score: 82, reason: '近似索引有精度损失' },
        { name: '成本控制', score: 74, reason: '内存成本高' },
      ],
    },
    matrix: {
      title: '场景价值矩阵',
      xLabel: '落地成熟度',
      yLabel: '业务价值',
      items: [
        { name: 'RAG 检索', x: 88, y: 90 },
        { name: '多模态检索', x: 46, y: 76 },
      ],
    },
    timeline: {
      title: '业界采用时间线',
      items: [
        { time: '2023', title: 'RAG 普及', detail: '向量库成为 RAG 标配组件' },
        { time: '2024', title: '云厂商托管', detail: '主流云推出托管向量检索' },
      ],
    },
  },
};

const SOURCES = [
  { url: 'https://milvus.io/docs', title: 'Milvus 文档', snippet: '向量检索', site: 'milvus.io' },
  { url: 'https://arxiv.org/abs/2401.00001', title: '索引论文', snippet: 'ANN', site: 'arxiv.org' },
  { url: 'https://example.com/a', title: '案例 A', snippet: '落地', site: 'example.com' },
  { url: 'https://example.com/b', title: '案例 B', snippet: '厂商', site: 'example.com' },
];

function fakeWeb() {
  const calls = { search: [], fetch: [] };
  return {
    calls,
    async searchReady() {
      return true;
    },
    async fetchReady() {
      return true;
    },
    async search(request) {
      calls.search.push(request.query);
      return {
        content: '检索综述：向量数据库热度持续上升。',
        truncated: false,
        sources: SOURCES.slice(0, 3),
      };
    },
    async fetch(request) {
      calls.fetch.push(request.url);
      return {
        url: request.url,
        statusCode: 200,
        truncated: false,
        body: { kind: 'html', content: '<html><body><script>x</script><h1>标题</h1><p>' + '正文内容'.repeat(80) + '</p></body></html>' },
      };
    },
  };
}

function fakeLlm() {
  const calls = [];
  return {
    calls,
    async resolveModelInfo() {
      return { id: 'deepseek-flash', name: 'DeepSeek', defaultMaxTokens: 8192, context: { contextWindow: 128000 } };
    },
    stream(options) {
      calls.push(options);
      const text = JSON.stringify(VALID_RAW);
      return (async function* () {
        for (const piece of [text.slice(0, 20), text.slice(20)]) {
          yield { type: 'text-delta', index: 0, text: piece };
        }
        yield { type: 'finish', reason: { kind: 'stop' } };
      })();
    },
  };
}

test('buildQueries respects depth and focus', () => {
  assert.equal(buildQueries('向量数据库', '', 'quick').length, 3);
  assert.equal(buildQueries('向量数据库', '', 'standard').length, 6);
  assert.equal(buildQueries('向量数据库', '', 'deep').length, 8);
  assert.ok(buildQueries('向量数据库', '选型', 'quick')[0].includes('选型'));
  assert.equal(buildQueries('   ', '', 'standard').length, 0);
  assert.ok(buildRefineQueries('向量数据库', '补充国内厂商', 'standard').length >= 2);
});

test('queries use the current year instead of a hard-coded year', () => {
  const year = new Date().getFullYear();
  for (const depth of ['quick', 'standard', 'deep']) {
    const text = buildQueries('向量数据库', '', depth).join(' ');
    assert.ok(text.includes(String(year)), depth + ' should use current year ' + year);
    assert.ok(!text.includes('2025') || String(year) === '2025', depth + ' should not hard-code 2025');
  }
  assert.ok(buildQueries('向量数据库', '', 'standard', 2031).join(' ').includes('2031'));
  assert.ok(buildRefineQueries('向量数据库', '补充案例', 'standard', 2032).join(' ').includes('2032'));
});

test('extractTextFromHtml strips scripts/tags and keeps paragraphs', () => {
  const text = extractTextFromHtml('<div><script>bad()</script><h2>标题</h2><p>第一段</p><p>第二段 &amp; 结束</p></div>');
  assert.ok(!text.includes('bad()'));
  assert.ok(text.includes('标题'));
  assert.ok(text.includes('第一段'));
  assert.ok(text.includes('第二段 & 结束'));
});

test('mergeSearchResults dedupes by url and collects answers', () => {
  const merged = mergeSearchResults([
    { content: '综述一', sources: [{ url: 'https://a.com/x/', title: 'A' }, { url: 'https://a.com/x', snippet: '补充' }] },
    { sources: [{ url: 'https://b.com/y', title: 'B', summary: 'B 摘要' }] },
  ]);
  assert.equal(merged.sources.length, 2);
  assert.equal(merged.answers.length, 1);
  assert.equal(merged.sources[0].snippet, '补充');
});

test('buildCorpus keeps source urls and fetched pages under cap', () => {
  const corpus = buildCorpus({ sources: SOURCES, pages: [{ url: SOURCES[0].url, title: 'T', text: 'x'.repeat(300) }], answers: ['a'], maxChars: 5000 });
  assert.ok(corpus.includes('https://milvus.io/docs'));
  assert.ok(corpus.length <= 5000);
});

test('parseJsonObject tolerates fences and prose', () => {
  const parsed = parseJsonObject('好的，结果如下：\n```json\n{"a":1,}\n```\n希望有帮助');
  assert.equal(parsed.a, 1);
  assert.throws(() => parseJsonObject('没有 json'), /无法解析|没有可解析/);
});

test('normalizeReport fills fixed sections, filters non-allowed urls, falls back refs', () => {
  const report = normalizeReport(VALID_RAW, {
    id: 'ti-test',
    revision: 1,
    topic: '向量数据库',
    queries: ['q1'],
    sourceCount: 4,
    model: 'deepseek-flash',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    allowedUrls: new Set(SOURCES.map((s) => s.url)),
    sources: SOURCES,
  });
  assert.deepEqual(report.sections.map((s) => s.key), SECTION_DEFS.map((s) => s.key));
  assert.equal(report.sections.length, 5);
  assert.ok(report.sections.some((section) => section.key === 'solution' && section.body.includes('总体架构')));
  assert.ok(report.sections.every((s) => s.body.length > 0));
  assert.ok(!report.references.some((ref) => ref.url.includes('made-up')));
  assert.ok(report.references.length >= 4);
  assert.equal(report.revision, 1);
  assert.equal(report.generator, 'tech-insight/1.0');
  assert.equal(report.visuals.architecture.layers.length, 3);
  assert.equal(report.visuals.difficulty.items[0].score, 82);
  assert.equal(report.visuals.matrix.items[0].x, 88);
  assert.equal(report.visuals.timeline.items.length, 2);
});

test('normalizeReport rejects empty report body', () => {
  assert.throws(
    () => normalizeReport({ sections: {} }, { topic: 'x', id: 'ti-x', revision: 1, allowedUrls: new Set(), sources: [] }),
    /没有正文内容/,
  );
});

test('normalizeGenerateInput validates topic and depth', () => {
  assert.deepEqual(normalizeGenerateInput({ topic: '  RISC-V ', depth: 'deep' }), { topic: 'RISC-V', focus: '', depth: 'deep' });
  assert.equal(normalizeGenerateInput({ topic: 'a', depth: 'unknown' }).depth, 'standard');
  assert.throws(() => normalizeGenerateInput({ topic: '  ' }), /技术名称/);
});

test('newReportId is prefixed and unique-ish', () => {
  const a = newReportId(1700000000000, () => 0.1);
  const b = newReportId(1700000000000, () => 0.2);
  assert.match(a, /^ti-/);
  assert.notEqual(a, b);
});

test('createInsightService.generate runs search → fetch → llm and emits report', async () => {
  const web = fakeWeb();
  const llm = fakeLlm();
  const events = [];
  const service = createInsightService({
    getWeb: () => web,
    getLlm: () => llm,
    getSelection: () => ({ provider: 'deepseek-account', model: 'deepseek-flash', reasoningEffort: 'low' }),
    now: () => 1700000000000,
    random: () => 0.5,
  });
  const report = await service.generate({ topic: '向量数据库', depth: 'quick' }, (event, data) => events.push({ event, data }));
  assert.equal(report.topic, '向量数据库');
  assert.equal(report.revision, 1);
  assert.equal(report.sections.length, 5);
  assert.equal(web.calls.search.length, 3);
  assert.ok(web.calls.fetch.length > 0);
  assert.ok(events.some((item) => item.event === 'queries'));
  assert.ok(events.some((item) => item.event === 'sources'));
  assert.ok(events.some((item) => item.event === 'stage' && item.data.stage === 'synthesize'));
  assert.ok(events.some((item) => item.event === 'report'));
  assert.ok(llm.calls[0].maxTokens <= 8192);
});

test('createInsightService.generate surfaces web failure with actionable code', async () => {
  const events = [];
  const service = createInsightService({
    getWeb: () => ({
      async search() {
        throw new Error('search down');
      },
      async fetch() {
        throw new Error('nope');
      },
    }),
    getLlm: () => fakeLlm(),
    getSelection: () => ({ provider: 'deepseek-account', model: 'deepseek-flash' }),
  });
  await assert.rejects(
    () => service.generate({ topic: 'x' }, (event, data) => events.push({ event, data })),
    /没有检索到可用资料/,
  );
});

test('createInsightService.refine increments revision and keeps id/createdAt', async () => {
  const web = fakeWeb();
  const llm = fakeLlm();
  const service = createInsightService({
    getWeb: () => web,
    getLlm: () => llm,
    getSelection: () => ({ provider: 'deepseek-account', model: 'deepseek-flash' }),
    now: () => 1700000100000,
    random: () => 0.7,
  });
  const base = normalizeReport(VALID_RAW, {
    id: 'ti-keep',
    revision: 1,
    topic: '向量数据库',
    queries: ['q1'],
    sourceCount: 4,
    model: 'deepseek-flash',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    allowedUrls: new Set(SOURCES.map((s) => s.url)),
    sources: SOURCES,
  });
  const events = [];
  const next = await service.refine(
    { report: base, instruction: '补充国内厂商', useWeb: true },
    (event, data) => events.push({ event, data }),
  );
  assert.equal(next.id, 'ti-keep');
  assert.equal(next.revision, 2);
  assert.equal(next.createdAt, base.createdAt);
  assert.ok(next.updatedAt);
  assert.ok(events.some((item) => item.event === 'report'));
  assert.ok(web.calls.search.length > 0);
});

test('createInsightService.status reports readiness without throwing', async () => {
  const service = createInsightService({
    getWeb: () => ({ async searchReady() { return true; }, async fetchReady() { return false; } }),
    getLlm: () => fakeLlm(),
    getSelection: () => ({ provider: 'deepseek-account', model: 'deepseek-flash' }),
  });
  const status = await service.status();
  assert.equal(status.ok, true);
  assert.equal(status.ready, true);
  assert.equal(status.webReady, true);
  assert.equal(status.fetchReady, false);

  const missing = createInsightService({ getWeb: () => null, getLlm: () => null, getSelection: () => null });
  const missingStatus = await missing.status();
  assert.equal(missingStatus.ready, false);
  assert.match(missingStatus.message, /模型/);
});

test('selectSearchInitiator prefers an agent on the deepseek-account route', () => {
  const account = { session: { requestContext: () => ({ provider: 'deepseek-account' }) } };
  const other = { session: { requestContext: () => ({ provider: 'deepseek-api-key' }) } };
  const agents = {
    currentInitiator: () => undefined,
    list: () => [other, account],
    roots: () => [other, account],
    withInitiator: (agent, operation) => operation(),
  };
  assert.equal(selectSearchInitiator(agents), account);
  assert.equal(selectSearchInitiator(null), null);
  const onlyOther = { currentInitiator: () => undefined, list: () => [other], roots: () => [other] };
  assert.equal(selectSearchInitiator(onlyOther), other);
});

test('createInsightService.generate runs search inside the account initiator scope', async () => {
  const web = fakeWeb();
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
  const service = createInsightService({
    getWeb: () => web,
    getLlm: () => fakeLlm(),
    getSelection: () => ({ provider: 'deepseek-account', model: 'deepseek-flash' }),
    getAgents: () => agents,
  });
  const originalSearch = web.search;
  web.search = async (request) => {
    sawInitiator = agents.currentInitiator() === account;
    return originalSearch(request);
  };
  await service.generate({ topic: '向量数据库', depth: 'quick' }, () => {});
  assert.equal(entered, 0);
  assert.equal(sawInitiator, true);
});

test('createInsightService.generate maps missing search credentials to an actionable code', async () => {
  const service = createInsightService({
    getWeb: () => ({
      async search() {
        const error = new Error('DeepSeek search has no API key');
        error.code = 'WEB_PROVIDER_CREDENTIAL_MISSING';
        throw error;
      },
      async fetch() {
        throw new Error('nope');
      },
    }),
    getLlm: () => fakeLlm(),
    getSelection: () => ({ provider: 'deepseek-account', model: 'deepseek-flash' }),
  });
  await assert.rejects(
    () => service.generate({ topic: 'x' }, () => {}),
    (error) => error.code === 'WEB_CREDENTIAL_MISSING' && /登录 DeepSeek 账号/.test(error.message),
  );
});

test('normalizeReport drops invalid visual blocks but keeps the report', () => {
  const raw = {
    ...VALID_RAW,
    visuals: {
      architecture: { layers: [{ name: '只有一层', items: ['x'] }] },
      difficulty: { items: [{ name: '', score: 'bad' }] },
      matrix: { items: [] },
      timeline: { items: 'not-array' },
    },
  };
  const report = normalizeReport(raw, {
    id: 'ti-test-2',
    revision: 1,
    topic: '向量数据库',
    queries: [],
    sourceCount: 4,
    model: 'deepseek-flash',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    allowedUrls: new Set(SOURCES.map((s) => s.url)),
    sources: SOURCES,
  });
  assert.equal(report.visuals, null);
  assert.equal(report.sections.length, 5);
});

test('generate uses the depth reasoning effort when the model supports it', async () => {
  const seen = [];
  const llm = {
    async resolveModelInfo() {
      return {
        id: 'deepseek-flash',
        defaultMaxTokens: 8192,
        reasoning: { efforts: [{ id: 'off' }, { id: 'low' }, { id: 'high' }, { id: 'max' }], defaultEffort: 'high' },
      };
    },
    stream(options) {
      seen.push(options.reasoningEffort);
      const text = JSON.stringify(VALID_RAW);
      return (async function* () {
        yield { type: 'text-delta', index: 0, text };
        yield { type: 'finish', reason: { kind: 'stop' } };
      })();
    },
  };
  const web = fakeWeb();
  const make = () =>
    createInsightService({
      getWeb: () => web,
      getLlm: () => llm,
      getSelection: () => ({ provider: 'deepseek-account', model: 'deepseek-flash', reasoningEffort: 'low' }),
    });
  await make().generate({ topic: '向量数据库', depth: 'quick' }, () => {});
  await make().generate({ topic: '向量数据库', depth: 'deep' }, () => {});
  /* quick：单次成稿，关闭推理；deep：先用 max 梳理方案要点，再关闭推理成稿。 */
  assert.deepEqual(seen, ['off', 'max', 'off']);
});

test('generate retries with a compact prompt when the model output is truncated', async () => {
  let call = 0;
  const llm = {
    async resolveModelInfo() {
      return { id: 'deepseek-flash', defaultMaxTokens: 8192 };
    },
    stream() {
      call += 1;
      const current = call;
      return (async function* () {
        if (current === 1) {
          /* 第一版模拟被长度上限截断：有半截正文，finish=max-tokens。 */
          yield { type: 'text-delta', index: 0, text: '{"title":"半截' };
          yield { type: 'finish', reason: { kind: 'max-tokens' } };
          return;
        }
        yield { type: 'text-delta', index: 0, text: JSON.stringify(VALID_RAW) };
        yield { type: 'finish', reason: { kind: 'stop' } };
      })();
    },
  };
  const events = [];
  const service = createInsightService({
    getWeb: () => fakeWeb(),
    getLlm: () => llm,
    getSelection: () => ({ provider: 'deepseek-account', model: 'deepseek-flash' }),
  });
  const report = await service.generate(
    { topic: '向量数据库', depth: 'quick' },
    (event, data) => events.push({ event, data }),
  );
  assert.equal(report.sections.length, 5);
  assert.equal(call, 2);
  assert.ok(events.some((item) => item.event === 'stage' && /压缩重试/.test(item.data.label || '')));
});
