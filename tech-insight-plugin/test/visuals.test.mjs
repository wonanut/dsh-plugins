/**
 * Client 可视化组件测试：用 vm 加载 00-core/10-ui/25-visuals 三个源文件，
 * 直接调用四个内联 SVG 组件，验证它们能渲染出预期元素且不抛错。
 * （这些组件是纯函数，不依赖 React hooks。）
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.join(root, '..');

function loadVisuals() {
  const files = ['00-core.js', '10-ui.js', '25-visuals.js'];
  const body = files
    .map((file) => fs.readFileSync(path.join(pluginRoot, 'src', file), 'utf8'))
    .join('\n\n');

  const e = (type, props, ...children) => ({
    type,
    props: props || {},
    children: children.flatMap((child) => (Array.isArray(child) ? child : [child])).filter((child) => child !== null && child !== undefined && child !== false),
  });
  const React = {
    createElement: e,
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect: () => {},
    useMemo: (factory) => factory(),
    useRef: (value) => ({ current: value }),
    useCallback: (fn) => fn,
  };
  const sandbox = { React, e, console };
  const context = vm.createContext(sandbox);
  vm.runInContext(
    body +
      '\n;globalThis.__visuals = { TiFigure, TiArchitectureSvg, TiDifficultySvg, TiMatrixSvg, TiTimelineSvg, TI_SECTION_VISUALS, tiNormalizeVisuals };',
    context,
    { filename: 'visuals-bundle.js' },
  );
  return sandbox.__visuals;
}

/** 递归收集渲染树里的文本，便于断言。 */
function textOf(node, out = []) {
  if (node === null || node === undefined || node === false) return out;
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) textOf(child, out);
    return out;
  }
  if (node && typeof node === 'object' && 'props' in node) {
    for (const child of node.children || []) textOf(child, out);
  }
  return out;
}

function findType(node, type, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const child of node) findType(child, type, out);
    return out;
  }
  if (node.type === type) out.push(node);
  for (const child of node.children || []) findType(child, type, out);
  return out;
}

const VISUALS = {
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
};

test('四个分节都有对应的可视化类型', () => {
  const { TI_SECTION_VISUALS } = loadVisuals();
  assert.equal(
    JSON.stringify(TI_SECTION_VISUALS),
    JSON.stringify({
      solution: 'architecture',
      difficulties: 'difficulty',
      scenarios: 'matrix',
      industry: 'timeline',
    }),
  );
});

test('架构图渲染分层、条目与层间箭头', () => {
  const { TiArchitectureSvg } = loadVisuals();
  const tree = TiArchitectureSvg({ visual: VISUALS.architecture });
  const texts = textOf(tree).join(' ');
  for (const label of ['接入层', '计算层', '存储层', 'SDK/API', 'ANN 检索', '向量索引']) assert.ok(texts.includes(label), label);
  assert.ok(findType(tree, 'svg').length === 1);
  assert.ok(findType(tree, 'path').length >= 2);
});

test('难点强度图按分数绘制条宽', () => {
  const { TiDifficultySvg } = loadVisuals();
  const tree = TiDifficultySvg({ visual: VISUALS.difficulty });
  const texts = textOf(tree).join(' ');
  assert.ok(texts.includes('召回精度'));
  assert.ok(texts.includes('82'));
  assert.ok(texts.includes('近似索引有精度损失'));
  const rects = findType(tree, 'rect');
  assert.ok(rects.length >= 4);
});

test('场景矩阵渲染坐标轴与散点', () => {
  const { TiMatrixSvg } = loadVisuals();
  const tree = TiMatrixSvg({ visual: VISUALS.matrix });
  const texts = textOf(tree).join(' ');
  assert.ok(texts.includes('落地成熟度'));
  assert.ok(texts.includes('业务价值'));
  assert.ok(texts.includes('RAG 检索'));
  assert.ok(findType(tree, 'circle').length === 2);
});

test('时间线渲染时间、事件与说明', () => {
  const { TiTimelineSvg } = loadVisuals();
  const tree = TiTimelineSvg({ visual: VISUALS.timeline });
  const texts = textOf(tree).join(' ');
  assert.ok(texts.includes('2023'));
  assert.ok(texts.includes('RAG 普及'));
  assert.ok(texts.includes('云厂商托管'));
});

test('TiFigure 按 kind 选择图并输出标题，缺失数据返回 null', () => {
  const { TiFigure } = loadVisuals();
  const arch = TiFigure({ kind: 'architecture', visual: VISUALS.architecture });
  assert.ok(textOf(arch).join(' ').includes('向量数据库分层架构'));
  assert.equal(TiFigure({ kind: 'architecture', visual: null }), null);
  assert.equal(TiFigure({ kind: 'unknown', visual: VISUALS.matrix }), null);
});

test('客户端 visual 归一化会丢弃不完整块', () => {
  const { tiNormalizeVisuals } = loadVisuals();
  const good = tiNormalizeVisuals(VISUALS);
  assert.equal(good.architecture.layers.length, 3);
  assert.equal(good.difficulty.items[0].score, 82);
  assert.equal(good.matrix.items.length, 2);
  assert.equal(good.timeline.items.length, 2);

  const bad = tiNormalizeVisuals({
    architecture: { layers: [{ name: '只有一层', items: [] }] },
    difficulty: { items: [{ name: '', score: 'x' }] },
    matrix: { items: [] },
    timeline: 'nope',
  });
  assert.equal(bad, null);
});
