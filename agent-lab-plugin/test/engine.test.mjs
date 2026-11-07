/**
 * test/engine.test.mjs · 引擎无头测试
 *
 * 用 node:vm 把 src/00-core.js + 10-engine.js + 20-tools.js + 30-llm.js
 * 按 build.mjs 的顺序拼成一段普通脚本执行，再通过 globalThis.__LAB__ 取回
 * createLab / estimateTokens / LAB_TOOLS 等入口。
 *
 * 运行：node test/engine.test.mjs
 * 输出 PASS / FAIL 行；全部通过 exit 0，任何失败 exit 1。
 *
 * 注意：所有 createLab 都注入 sleep: async () => {}，所以测试瞬间完成；
 * 只有「dispose 取消进行中的 turn」用例改用真实的极短 sleep 来制造并发窗口。
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(here, '..', 'src');

const files = ['00-core.js', '10-engine.js', '20-tools.js', '30-llm.js'];
const bundle =
  files.map((file) => fs.readFileSync(path.join(srcDir, file), 'utf8')).join('\n\n') +
  '\n;globalThis.__LAB__ = {' +
  ' createLab: createLab, estimateTokens: estimateTokens, LAB_TOOLS: LAB_TOOLS,' +
  ' LAB_BUDGET: LAB_BUDGET, LAB_RECENT_KEEP: LAB_RECENT_KEEP, LAB_MAX_STEPS: LAB_MAX_STEPS,' +
  ' LAB_STORAGE_KEY: LAB_STORAGE_KEY, LAB_SYSTEM_PROMPT: LAB_SYSTEM_PROMPT,' +
  ' LAB_MAX_TRANSCRIPT: LAB_MAX_TRANSCRIPT, LAB_MAX_SESSIONS: LAB_MAX_SESSIONS,' +
  ' LAB_MAX_MESSAGES: LAB_MAX_MESSAGES, LAB_TOOL_SCHEMAS: LAB_TOOL_SCHEMAS' +
  ' };\n';

/* vm 的 context 自带 Date / JSON / Math / globalThis 等内置对象；
 * 只需要补上宿主环境里的 console 与定时器即可。 */
const sandbox = { console, setTimeout, clearTimeout };
vm.createContext(sandbox);
new vm.Script(bundle, { filename: 'agent-lab.bundle.vm.js' }).runInContext(sandbox);

const LAB = sandbox.__LAB__;
if (!LAB || typeof LAB.createLab !== 'function') {
  console.error('FAIL 无法从 vm 中取回 __LAB__（引擎脚本加载失败）');
  process.exit(1);
}
const {
  createLab,
  estimateTokens,
  LAB_TOOLS,
  LAB_BUDGET,
  LAB_RECENT_KEEP,
  LAB_MAX_STEPS,
  LAB_STORAGE_KEY,
  LAB_SYSTEM_PROMPT,
  LAB_MAX_TRANSCRIPT,
  LAB_MAX_MESSAGES,
  LAB_MAX_SESSIONS,
  LAB_TOOL_SCHEMAS,
} = LAB;

/* ── 测试工具 ── */

let passCount = 0;
let failCount = 0;
const failures = [];

function ok(condition, message) {
  if (!condition) throw new Error(message);
}

function eq(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message + '：期望 ' + JSON.stringify(expected) + '，实际 ' + JSON.stringify(actual));
  }
}

function includes(haystack, needle, message) {
  if (String(haystack).indexOf(needle) < 0) {
    throw new Error(message + '：未包含 ' + JSON.stringify(needle) + '（实际文本：' + String(haystack).slice(0, 400) + '）');
  }
}

function mockStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

function makeLab(extra) {
  return createLab(
    Object.assign({ sleep: async () => {}, storage: mockStorage(), pace: 'fast' }, extra || {}),
  );
}

function transcriptText(snapshot) {
  return snapshot.transcript.map((line) => line.text).join('\n');
}

function lastLineOfKind(snapshot, kind) {
  for (let i = snapshot.transcript.length - 1; i >= 0; i -= 1) {
    if (snapshot.transcript[i].kind === kind) return snapshot.transcript[i].text;
  }
  return '';
}

function linesOfKind(snapshot, kind) {
  return snapshot.transcript.filter((line) => line.kind === kind);
}

function sumSegments(snapshot) {
  return snapshot.context.segments.reduce((total, segment) => total + segment.tokens, 0);
}

async function test(name, fn) {
  try {
    await fn();
    passCount += 1;
    console.log('PASS ' + name);
  } catch (err) {
    failCount += 1;
    failures.push(name + ' · ' + (err && err.message ? err.message : String(err)));
    console.log('FAIL ' + name + ' · ' + (err && err.message ? err.message : String(err)));
  }
}

/* ─────────────────────────────────────────────────────────────
 * 用例 1：常量、token 估算与工具 schema
 * ───────────────────────────────────────────────────────────── */
await test('token 估算 / 常量 / 工具 schema', async () => {
  eq(estimateTokens(''), 0, '空串 token');
  eq(estimateTokens(null), 0, 'null token');
  eq(estimateTokens(undefined), 0, 'undefined token');
  eq(estimateTokens('你好'), 2, '两个汉字应为 2 token');
  eq(estimateTokens('hello'), 2, '5 个拉丁字符应向上取整为 2 token');
  eq(estimateTokens('a'.repeat(8)), 2, '8 个拉丁字符应为 2 token');
  eq(estimateTokens('中'.repeat(10)), 10, '10 个汉字应为 10 token');
  ok(estimateTokens(LAB_SYSTEM_PROMPT) > 0, 'system prompt token 应大于 0');

  eq(LAB_BUDGET, 1000, 'LAB_BUDGET 契约值');
  eq(LAB_RECENT_KEEP, 4, 'LAB_RECENT_KEEP 契约值');
  eq(LAB_MAX_STEPS, 4, 'LAB_MAX_STEPS 契约值');
  eq(LAB_STORAGE_KEY, 'dsh.agent-lab.v1', 'LAB_STORAGE_KEY 契约值');
  eq(LAB_MAX_TRANSCRIPT, 200, 'transcript 上限');
  eq(LAB_MAX_MESSAGES, 120, '消息上限');
  eq(LAB_MAX_SESSIONS, 20, '会话上限');

  eq(LAB_TOOLS.length, 8, '工具数量应为 8');
  eq(
    LAB_TOOLS.map((tool) => tool.name).join(','),
    'calculator,clock,dice_roll,random_pick,password_generate,unit_convert,memory_write,memory_search',
    '工具名与顺序',
  );
  for (const tool of LAB_TOOLS) {
    ok(typeof tool.name === 'string' && tool.name, '工具 name');
    ok(typeof tool.description === 'string' && tool.description.length > 0, '工具 description');
    eq(tool.parameters && tool.parameters.type, 'object', '工具 parameters.type');
    eq(typeof tool.run, 'function', '工具 run 必须是函数');
  }
  ok(Array.isArray(LAB_TOOL_SCHEMAS) && LAB_TOOL_SCHEMAS.length === 8, 'LAB_TOOL_SCHEMAS 应有 8 项');
  ok(LAB_TOOL_SCHEMAS.every((schema) => schema.run === undefined), 'tool schema 不应携带 run');
  const calc = LAB_TOOLS.find((tool) => tool.name === 'calculator');
  eq(calc.run({ expression: '(12+30)*3' }).display, '126', 'calculator 基本运算');
  eq(calc.run({ expression: '2^10' }).display, '1024', 'calculator 幂运算');
  eq(calc.run({ expression: '2+3*4' }).display, '14', 'calculator 优先级');
  eq(calc.run({ expression: '-(2+3)' }).display, '-5', 'calculator 一元负号');
  eq(calc.run({ expression: '1/0' }).ok, false, 'calculator 除零必须失败');
  includes(calc.run({ expression: '1/0' }).display, '除数', '除零错误信息');
  eq(calc.run({ expression: 'alert(1)' }).ok, false, 'calculator 拒绝非算式');
  eq(calc.run({}).ok, false, 'calculator 缺少表达式必须失败');
});

/* ─────────────────────────────────────────────────────────────
 * 用例 2：算术 → 真实工具调用 → 最终回答
 * ───────────────────────────────────────────────────────────── */
await test('算术：工具调用链与最终回答', async () => {
  const lab = makeLab();
  const events = [];
  const off = lab.onEvent((event) => events.push(event.type));
  await lab.submit('算一下 (12+30)*3');
  const snap = lab.snapshot();
  const text = transcriptText(snap);

  /* transcript.text 是纯文本；TUI 会按 kind 加行首符号（⚙ / ←），渲染结果即契约示例 */
  includes(text, 'calculator {"expression":"(12+30)*3"}', 'transcript 应有工具调用行');
  includes(text, '{"expression":"(12+30)*3"}', '工具参数 JSON');
  eq(linesOfKind(snap, 'toolresult')[0].text, '126', 'transcript 应有工具结果行');
  includes(lastLineOfKind(snap, 'agent'), '126', '最终回答应包含 126');
  eq(snap.stats.turns, 1, 'turn 计数');
  eq(snap.stats.toolCalls, 1, '工具调用次数');
  eq(snap.turn.status, 'done', 'turn 状态');
  ok(snap.turn.endedAt !== null, 'turn 应记录结束时间');
  ok(snap.busy === false, '结束后 busy 必须为 false');

  ok(snap.messages.some((message) => message.role === 'tool'), 'messages 应含 tool 角色');
  ok(
    snap.messages.some((message) => message.role === 'assistant' && message.kind === 'tool_call'),
    'messages 应含 assistant tool_call',
  );
  ok(
    snap.messages.some((message) => message.role === 'assistant' && message.kind === 'final'),
    'messages 应含 assistant final',
  );
  ok(
    snap.messages.every((message) => typeof message.tokens === 'number' && message.tokens > 0),
    '每条消息都应有 token 估算',
  );

  const stageKinds = snap.turn.stages.map((stage) => stage.kind);
  for (const kind of ['input', 'context', 'model', 'tool', 'output']) {
    ok(stageKinds.indexOf(kind) >= 0, 'stages 应包含 ' + kind);
  }
  eq(stageKinds[0], 'input', '第一个 stage 应是 input');
  eq(stageKinds[stageKinds.length - 1], 'output', '最后一个 stage 应是 output');
  const modelStage = snap.turn.stages.find((stage) => stage.kind === 'model');
  ok(modelStage.detail && Array.isArray(modelStage.detail.messages), 'model stage detail.messages 必须是数组');
  eq(modelStage.detail.toolSchemas.length, 8, 'model stage 应带 8 个工具 schema');
  eq(modelStage.detail.step, 1, 'model stage step');
  ok(modelStage.detail.response && modelStage.detail.response.type === 'tool_call', 'model stage response 记录工具调用');

  eq(sumSegments(snap), snap.context.used, 'context.used 必须等于 segments 之和');
  ok(snap.context.used <= snap.context.limit, 'context.used 不得超过 limit');
  eq(snap.context.segments.length, 5, 'context.segments 应有 5 段');
  eq(
    snap.context.segments.map((segment) => segment.id).join(','),
    'system,summary,memory,recent,input',
    'segment 顺序与 id',
  );

  for (const type of ['turn_start', 'stage', 'context', 'line', 'message', 'tool_call', 'tool_result', 'turn_end']) {
    ok(events.indexOf(type) >= 0, '事件流应包含 ' + type);
  }
  ok(events.indexOf('token') >= 0, '最终回答应通过 token 事件流式输出');
  ok(events.indexOf('state') >= 0, 'turn 结束应发出 state');
  off();
  const before = events.length;
  await lab.submit('帮助');
  eq(events.length, before, '退订后不应再收到事件');
});

/* ─────────────────────────────────────────────────────────────
 * 用例 3：多步任务 —— 先计算，再记住结果（两次真实工具调用）
 * ───────────────────────────────────────────────────────────── */
await test('多步：计算后记住结果（两次工具调用）', async () => {
  const lab = makeLab();
  await lab.submit('算一下 (12+30)*3 然后记住结果');
  const snap = lab.snapshot();
  const text = transcriptText(snap);
  eq(snap.stats.toolCalls, 2, '应发生两次工具调用');
  eq(linesOfKind(snap, 'tool').length, 2, '应有两行工具调用');
  eq(linesOfKind(snap, 'toolresult').length, 2, '应有两行工具结果');
  includes(text, 'calculator {"expression":"(12+30)*3"}', '第一步调用 calculator');
  includes(text, 'memory_write {"key":"计算结果","value":"126"}', '第二步调用 memory_write');
  includes(text, '记忆已保存 · 计算结果 = 126', '应有记忆写入行');
  includes(text, '126', '最终回答应提到 126');
  const mem = snap.memory.find((item) => item.key === '计算结果');
  ok(mem && mem.value === '126', '长期记忆应保存 计算结果 = 126');
  const modelStages = snap.turn.stages.filter((stage) => stage.kind === 'model');
  eq(modelStages.length, 3, '应为 3 个模型步（计算 → 记忆 → 回答）');
  const memoryLines = linesOfKind(snap, 'memory');
  eq(memoryLines.length, 1, '应有一行 memory transcript');
  eq(snap.turn.status, 'done', 'turn 状态');
});

/* ─────────────────────────────────────────────────────────────
 * 用例 4：记忆跨会话共享
 * ───────────────────────────────────────────────────────────── */
await test('记忆：写入、跨会话召回、会话隔离', async () => {
  const lab = makeLab();
  await lab.submit('记住 我的项目代号是 Orion');
  let snap = lab.snapshot();
  includes(transcriptText(snap), '记忆已保存 · 项目代号 = Orion', '记忆写入行格式');
  const memoryItem = snap.memory.find((item) => item.key === '项目代号');
  ok(memoryItem && memoryItem.value === 'Orion', 'memory 应保存 项目代号 = Orion');
  ok(typeof memoryItem.source === 'string' && memoryItem.source.length > 0, 'memory.source 应存在');
  const oldSessionId = snap.activeId;
  const oldMessages = snap.messages.length;

  ok(lab.newSession() === true, 'newSession 应成功');
  snap = lab.snapshot();
  eq(snap.messages.length, 0, '新会话消息应隔离');
  ok(snap.activeId !== oldSessionId, '新会话 activeId 应不同');
  eq(snap.memory.length, 1, '长期记忆应跨会话共享');
  eq(snap.sessions.length, 2, '应有两个会话');

  await lab.submit('我的项目代号是什么');
  snap = lab.snapshot();
  includes(lastLineOfKind(snap, 'agent'), 'Orion', '跨会话回忆应包含 Orion');
  ok(
    linesOfKind(snap, 'tool').some((line) => line.text.indexOf('memory_search') === 0),
    '回忆应调用 memory_search',
  );
  ok(snap.context.hits.length >= 1, '本轮 context.hits 应命中长期记忆');
  eq(snap.context.hits[0].key, '项目代号', '召回记忆的 key');

  ok(lab.switchSession(oldSessionId) === true, 'switchSession 应成功');
  snap = lab.snapshot();
  eq(snap.activeId, oldSessionId, '切换后 activeId');
  eq(snap.messages.length, oldMessages, '切换后恢复原会消息');
});

/* ─────────────────────────────────────────────────────────────
 * 用例 5：自动压缩
 * ───────────────────────────────────────────────────────────── */
await test('压缩：连续 12 轮触发自动压缩', async () => {
  const lab = makeLab({ budget: 420 });
  const events = [];
  const off = lab.onEvent((event) => events.push(event.type));
  for (let i = 0; i < 12; i += 1) await lab.submit('你好');
  const snap = lab.snapshot();
  const text = transcriptText(snap);
  ok(snap.stats.compressions > 0, '应触发自动压缩（compressions > 0）');
  ok(snap.stats.compressions <= 12, '压缩次数应与轮数同量级，不能每步反复压缩');
  ok(snap.context.summary && snap.context.summary.length > 0, 'context.summary 应非空');
  includes(snap.context.summary, '【关键内容】', '结构化摘要应包含关键内容');
  includes(snap.context.summary, '【未完成任务】', '结构化摘要应包含未完成任务');
  includes(snap.context.summary, '【下一个任务】', '结构化摘要应包含下一个任务');
  ok(snap.context.used <= snap.context.limit, '压缩后 context.used 不得超过 limit');
  eq(sumSegments(snap), snap.context.used, 'context.used 必须等于 segments 之和');
  includes(text, '上下文已压缩 · ', 'transcript 应有压缩行');
  ok(events.indexOf('compression') >= 0, '应发出 compression 事件');
  eq(snap.stats.turns, 12, '应完成 12 轮');
  ok(snap.sessions[0].messageCount <= LAB_MAX_MESSAGES, '会话消息数不超过上限');
  ok(snap.transcript.length <= LAB_MAX_TRANSCRIPT, 'transcript 不超过上限');
  ok(snap.stats.tokensSaved > 0, '压缩应真实节省 token');
  /* 压缩行数字：before > after */
  const compressLines = linesOfKind(snap, 'compress');
  ok(compressLines.length > 0, '至少有 1 行压缩记录');
  const ratio = /上下文已压缩 · (\d+) → (\d+) tok/.exec(compressLines[compressLines.length - 1].text);
  ok(ratio && Number(ratio[1]) > Number(ratio[2]), '压缩行应为 before > after');
  off();
});

/* ─────────────────────────────────────────────────────────────
 * 用例 6：会话新建 / 切换 / 删除
 * ───────────────────────────────────────────────────────────── */
await test('会话：newSession / switchSession / deleteSession', async () => {
  const lab = makeLab();
  await lab.submit('记住 我的项目代号是 Orion');
  await lab.submit('你好');
  let snap = lab.snapshot();
  const firstId = snap.activeId;
  const firstMessageCount = snap.messages.length;
  ok(firstMessageCount > 0, '第一个会话应有消息');

  eq(lab.newSession(), true, 'newSession 返回 true');
  snap = lab.snapshot();
  eq(snap.sessions.length, 2, '应有 2 个会话');
  eq(snap.messages.length, 0, '新会话无消息');
  await lab.submit('帮助');
  snap = lab.snapshot();
  const secondId = snap.activeId;
  ok(snap.messages.length > 0, '第二个会话应有消息');

  eq(lab.switchSession(firstId), true, 'switchSession 返回 true');
  snap = lab.snapshot();
  eq(snap.activeId, firstId, '切回第一个会话');
  eq(snap.messages.length, firstMessageCount, '恢复原会话消息数');
  eq(lab.switchSession('not-exist'), false, '切换不存在的会话返回 false');
  eq(lab.switchSession(secondId), true, '再切到第二个会话');

  eq(lab.deleteSession(firstId), true, 'deleteSession 返回 true');
  snap = lab.snapshot();
  eq(snap.sessions.length, 1, '删除后剩 1 个会话');
  eq(snap.activeId, secondId, '未删当前会话时 activeId 不变');
  eq(lab.deleteSession('not-exist'), false, '删除不存在的会话返回 false');

  eq(lab.deleteSession(secondId), true, '删除当前会话');
  snap = lab.snapshot();
  eq(snap.sessions.length, 1, '删掉当前会话后自动新建');
  ok(snap.activeId !== secondId, '应切到新会话');
  eq(snap.messages.length, 0, '新会话无消息');
  eq(snap.memory.length, 1, '记忆仍共享');
  eq(lab.newSession(), true, '可继续新建会话');
});

/* ─────────────────────────────────────────────────────────────
 * 用例 7：持久化跨实例恢复
 * ───────────────────────────────────────────────────────────── */
await test('持久化：dispose 后同 storage 重建可恢复', async () => {
  const storage = mockStorage();
  const lab1 = createLab({ sleep: async () => {}, storage, pace: 'fast' });
  await lab1.submit('记住 我的项目代号是 Orion');
  await lab1.submit('算一下 1+1');
  const before = lab1.snapshot();
  ok(before.sessions.length >= 1, '重建前应有会话');
  ok(before.messages.length > 0, '重建前应有消息');
  ok(before.memory.length >= 1, '重建前应有记忆');
  lab1.dispose();

  const lab2 = createLab({ sleep: async () => {}, storage, pace: 'fast' });
  const after = lab2.snapshot();
  eq(after.sessions.length, before.sessions.length, '恢复会话数量');
  eq(after.activeId, before.activeId, '恢复 activeId');
  eq(after.memory.length, before.memory.length, '恢复长期记忆数量');
  eq(after.messages.length, before.messages.length, '恢复消息数量');
  eq(after.stats.turns, before.stats.turns, '恢复 stats.turns');
  eq(after.transcript[0].kind, 'banner', '恢复后首行仍是 banner');
  includes(transcriptText(after), '记住 我的项目代号是 Orion', '恢复后 transcript 仍在');
  const mem = after.memory.find((item) => item.key === '项目代号');
  ok(mem && mem.value === 'Orion', '恢复后记忆内容正确');

  await lab2.submit('我的项目代号是什么');
  includes(lastLineOfKind(lab2.snapshot(), 'agent'), 'Orion', '恢复后仍可召回记忆');
  lab2.dispose();
});

/* ─────────────────────────────────────────────────────────────
 * 用例 8：手动 compact
 * ───────────────────────────────────────────────────────────── */
await test('手动 compact：折叠历史 / 空会话 info 行', async () => {
  const lab = makeLab();
  await lab.submit('你好');
  await lab.submit('帮助');
  await lab.submit('算一下 1+1');
  const before = lab.snapshot().stats.compressions;
  eq(lab.compact(), true, '手动 compact 应返回 true');
  const snap = lab.snapshot();
  ok(snap.stats.compressions >= before + 1, '手动压缩应增加压缩次数');
  ok(snap.context.summary && snap.context.summary.length > 0, '手动压缩后 summary 非空');
  includes(transcriptText(snap), '上下文已压缩 · ', '手动压缩应写 transcript 行');
  const manualLine = linesOfKind(snap, 'compress').pop();
  const manualMatch = /上下文已压缩 · (\d+) → (\d+) tok/.exec(manualLine.text);
  ok(manualMatch && Number(manualMatch[2]) < Number(manualMatch[1]), '手动 compress 行也应 after < before：' + manualLine.text);
  ok(snap.context.used <= snap.context.limit, '手动压缩后 used <= limit');

  const fresh = makeLab();
  const freshBefore = fresh.snapshot().transcript.length;
  eq(fresh.compact(), false, '空会话 compact 返回 false');
  const freshSnap = fresh.snapshot();
  eq(freshSnap.stats.compressions, 0, '空会话不增加压缩次数');
  eq(freshSnap.transcript.length, freshBefore + 1, '空会话 compact 只加一行 info');
  includes(transcriptText(freshSnap), '消息太少', '空会话 compact 的 info 文案');
});

/* ─────────────────────────────────────────────────────────────
 * 用例 9：工具失败与时钟 / 查不到记忆
 * ───────────────────────────────────────────────────────────── */
await test('工具失败与时钟 / 查不到记忆的降级', async () => {
  const lab = makeLab();
  await lab.submit('计算 1/0');
  let snap = lab.snapshot();
  eq(linesOfKind(snap, 'toolresult')[0].text, '错误：除数不能为 0', '除零应产生错误结果行');
  includes(lastLineOfKind(snap, 'agent'), '算不出来', '最终回答应明确提到失败');
  eq(snap.turn.status, 'done', '工具失败不应让 turn 崩溃');
  eq(snap.stats.toolCalls, 1, '失败工具也计入调用次数');

  await lab.submit('计算 1 + 2 * 3');
  snap = lab.snapshot();
  includes(lastLineOfKind(snap, 'agent'), '7', '算术回答');

  await lab.submit('现在几点？');
  snap = lab.snapshot();
  ok(
    linesOfKind(snap, 'tool').some((line) => line.text.indexOf('clock') === 0),
    '时间意图应调用 clock',
  );
  includes(lastLineOfKind(snap, 'agent'), '现在是', '时间回答');

  await lab.submit('我的项目代号是什么');
  snap = lab.snapshot();
  includes(lastLineOfKind(snap, 'agent'), '没有找到', '无记忆时应明确说没有');
});

/* ─────────────────────────────────────────────────────────────
 * 用例 10：意图边界（截止日期不误触 clock / 泛化回忆 / X 是 Y）
 * ───────────────────────────────────────────────────────────── */
await test('意图边界：截止日期 / 泛化回忆 / X 是 Y', async () => {
  const lab = makeLab();
  await lab.submit('记住 截止日期 = 周五');
  let snap = lab.snapshot();
  ok(
    snap.memory.some((item) => item.key === '截止日期' && item.value === '周五'),
    '「截止日期」应写入记忆，而不是触发 clock',
  );
  eq(
    linesOfKind(snap, 'tool').filter((line) => line.text.indexOf('clock') === 0).length,
    0,
    '「截止日期」不应调用 clock',
  );
  includes(transcriptText(snap), '记忆已保存 · 截止日期 = 周五', '记忆写入行');

  await lab.submit('记住 项目 是 阿波罗');
  snap = lab.snapshot();
  ok(
    snap.memory.some((item) => item.key === '项目' && item.value === '阿波罗'),
    '「X 是 Y」应解析出 key/value',
  );

  await lab.submit('你还记得什么');
  const agent = lastLineOfKind(lab.snapshot(), 'agent');
  includes(agent, '截止日期', '泛化回忆应列出长期记忆');
  includes(agent, '阿波罗', '泛化回忆应列出长期记忆');
});

/* ─────────────────────────────────────────────────────────────
 * 用例 11：snapshot 不可变 / 事件 / dispose
 * ───────────────────────────────────────────────────────────── */
await test('snapshot 不可变、事件订阅、dispose 取消 turn', async () => {
  const lab = makeLab();
  const first = lab.snapshot();
  const second = lab.snapshot();
  ok(first !== second, 'snapshot 每次返回新对象');
  eq(JSON.stringify(first), JSON.stringify(second), '未变化时两次 snapshot 内容一致');
  ok(first.sessions !== second.sessions, 'snapshot 内部数组也应新建');
  ok(first.transcript !== second.transcript, 'transcript 数组也应新建');
  eq(first.busy, false, '空闲时 busy=false');
  eq(first.turn, null, '空闲时 turn=null');
  eq(first.streaming, null, '空闲时 streaming=null');
  eq(first.pace, 'fast', 'pace 来自 options');
  eq(first.transcript[0].kind, 'banner', '首行是 banner');
  eq(
    first.transcript[0].text,
    'Agent Lab v0.1 · 模拟 / 真实 DeepSeek 双模式 · 输入 /help 查看命令',
    'banner 文案',
  );
  eq(first.stats.turns, 0, '初始 turns=0');
  eq(first.stats.toolCalls, 0, '初始 toolCalls=0');
  eq(first.context.used, sumSegments(first), '初始 context.used 一致');
  ok(first.context.used <= first.context.limit, '初始 context.used <= limit');
  eq(first.context.limit, 1000, '默认预算 1000');

  /* dispose 取消进行中的 turn：用真实但极短的 sleep 制造并发窗口 */
  const slow = createLab({
    sleep: () => new Promise((resolve) => setTimeout(resolve, 1)),
    storage: mockStorage(),
    pace: 'fast',
  });
  const pending = slow.submit('算一下 (12+30)*3');
  ok(slow.snapshot().busy === true, '提交后立即 busy=true');
  slow.dispose();
  await pending;
  const afterDispose = slow.snapshot();
  eq(afterDispose.busy, false, 'dispose 后 busy=false');
  ok(afterDispose.turn && afterDispose.turn.status !== 'running', 'dispose 后 turn 不再是 running');
  ok(Array.isArray(afterDispose.sessions) && afterDispose.sessions.length >= 1, 'dispose 后 snapshot 仍可用');
  const messagesBefore = afterDispose.messages.length;
  await slow.submit('你好');
  eq(slow.snapshot().messages.length, messagesBefore, 'dispose 后 submit 不应再产生消息');

  lab.setPace('slow');
  eq(lab.snapshot().pace, 'slow', 'setPace 生效');
  const off = lab.onEvent(() => {
    throw new Error('UI 回调异常不应影响引擎');
  });
  await lab.submit('你好');
  off();
  eq(lab.snapshot().turn.status, 'done', 'UI 回调抛异常时引擎仍完成 turn');
});

/* ─────────────────────────────────────────────────────────────
 * 用例 12：并发 submit 拒绝重复 + 空输入
 * ───────────────────────────────────────────────────────────── */
await test('并发 submit 拒绝重复、空输入直接 resolve', async () => {
  const lab = makeLab();
  const first = lab.submit('你好');
  const second = lab.submit('帮助');
  await first;
  await second;
  const snap = lab.snapshot();
  eq(snap.stats.turns, 1, '并发 submit 只应执行一轮');
  eq(snap.messages.filter((message) => message.role === 'user').length, 1, '只应有一条 user 消息');
  eq(linesOfKind(snap, 'user').length, 1, '只应有一条 user transcript');
  eq(snap.turn.input, '你好', '执行的是第一个输入');

  const turnsBefore = snap.stats.turns;
  const messagesBefore = snap.messages.length;
  await lab.submit('   ');
  await lab.submit('');
  await lab.submit(null);
  const after = lab.snapshot();
  eq(after.stats.turns, turnsBefore, '空输入不应产生 turn');
  eq(after.messages.length, messagesBefore, '空输入不应产生消息');
});

/* ─────────────────────────────────────────────────────────────
 * 用例 13：Snapshot 结构与字段完整性
 * ───────────────────────────────────────────────────────────── */
await test('Snapshot 字段完整性与一致性', async () => {
  const lab = makeLab();
  await lab.submit('算一下 (12+30)*3');
  const snap = lab.snapshot();

  for (const key of [
    'busy',
    'pace',
    'activeId',
    'sessions',
    'messages',
    'transcript',
    'memory',
    'context',
    'turn',
    'streaming',
    'stats',
    'lastInput',
  ]) {
    ok(Object.prototype.hasOwnProperty.call(snap, key), 'snapshot 缺少字段 ' + key);
  }
  eq(snap.lastInput, '算一下 (12+30)*3', 'lastInput');
  eq(snap.sessions[0].id, snap.activeId, 'sessions[0] 是 active');
  for (const key of [
    'id',
    'title',
    'createdAt',
    'updatedAt',
    'messageCount',
    'tokens',
    'compressions',
    'turns',
  ]) {
    ok(Object.prototype.hasOwnProperty.call(snap.sessions[0], key), 'session 缺少字段 ' + key);
  }
  for (const message of snap.messages) {
    for (const key of ['id', 'role', 'content', 'tokens', 'at']) {
      ok(Object.prototype.hasOwnProperty.call(message, key), 'message 缺少字段 ' + key);
    }
    ok(['user', 'assistant', 'tool', 'system'].indexOf(message.role) >= 0, 'message.role 合法');
  }
  for (const line of snap.transcript) {
    for (const key of ['id', 'kind', 'text', 'at']) {
      ok(Object.prototype.hasOwnProperty.call(line, key), 'transcript 行缺少字段 ' + key);
    }
  }
  for (const segment of snap.context.segments) {
    for (const key of ['id', 'label', 'tokens']) {
      ok(Object.prototype.hasOwnProperty.call(segment, key), 'segment 缺少字段 ' + key);
    }
    eq(typeof segment.label, 'string', 'segment.label 是字符串');
  }
  for (const stage of snap.turn.stages) {
    for (const key of ['id', 'kind', 'title', 'meta', 'status', 'detail', 'at']) {
      ok(Object.prototype.hasOwnProperty.call(stage, key), 'stage 缺少字段 ' + key);
    }
    ok(['active', 'done', 'error'].indexOf(stage.status) >= 0, 'stage.status 合法');
    ok(['input', 'context', 'compress', 'model', 'tool', 'memory', 'output'].indexOf(stage.kind) >= 0, 'stage.kind 合法');
  }
  eq(snap.turn.stages.every((stage) => stage.status !== 'active'), true, '结束后不应有 active stage');
  eq(typeof snap.turn.startedAt, 'number', 'turn.startedAt');
  ok(typeof snap.turn.endedAt === 'number', 'turn.endedAt');
  for (const key of ['turns', 'toolCalls', 'compressions', 'tokensSaved', 'totalTokens']) {
    ok(typeof snap.stats[key] === 'number', 'stats.' + key + ' 应为数字');
  }
  ok(snap.stats.totalTokens > 0, 'totalTokens 应累计模型消耗');
});

/* ─────────────────────────────────────────────────────────────
 * 用例 14：记忆 API / resetAll / 斜杠命令
 * ───────────────────────────────────────────────────────────── */
await test('记忆 API / resetAll / 斜杠命令映射', async () => {
  const storage = mockStorage();
  const lab = createLab({ sleep: async () => {}, storage, pace: 'fast' });
  await lab.submit('记住 我的项目代号是 Orion');
  let snap = lab.snapshot();
  eq(snap.memory.length, 1, '写入 1 条记忆');
  const memoryId = snap.memory[0].id;
  eq(lab.deleteMemory('not-exist'), false, '删除不存在的记忆返回 false');
  eq(lab.deleteMemory(memoryId), true, 'deleteMemory 返回 true');
  eq(lab.snapshot().memory.length, 0, '删除后记忆为空');
  await lab.submit('记住 我的爱好是潜水');
  eq(lab.snapshot().memory.length, 1, '再次写入记忆');
  eq(lab.clearMemory(), 1, 'clearMemory 返回清空条数');
  eq(lab.snapshot().memory.length, 0, '清空后记忆为空');

  await lab.submit('/help');
  includes(lastLineOfKind(lab.snapshot(), 'agent'), '算一下', 'submit(/help) 应直接回答帮助');
  await lab.submit('/compact');
  includes(lastLineOfKind(lab.snapshot(), 'agent'), '压缩', 'submit(/compact) 应解释压缩');

  eq(lab.resetAll(), true, 'resetAll 返回 true');
  snap = lab.snapshot();
  eq(snap.messages.length, 0, 'resetAll 清空消息');
  eq(snap.memory.length, 0, 'resetAll 清空记忆');
  eq(snap.sessions.length, 1, 'resetAll 重建一个会话');
  eq(snap.stats.turns, 0, 'resetAll 清零统计');
  eq(snap.transcript[0].kind, 'banner', 'resetAll 后首行仍是 banner');
  eq(snap.busy, false, 'resetAll 后空闲');
  const lab2 = createLab({ sleep: async () => {}, storage, pace: 'fast' });
  eq(lab2.snapshot().memory.length, 0, 'resetAll 清空持久化记忆');
  eq(lab2.snapshot().messages.length, 0, 'resetAll 清空持久化消息');
  lab.dispose();
  lab2.dispose();
});

/* ─────────────────────────────────────────────────────────────
 * 用例 15：max steps 未收敛 → error 行 + turn error
 * ───────────────────────────────────────────────────────────── */
await test('max steps：超过 LAB_MAX_STEPS 未收敛转为错误', async () => {
  /* 通过替换 vm 全局里的 labNextStep 制造一个「永远要调工具」的模型 */
  const originalLabNextStep = sandbox.labNextStep;
  ok(typeof originalLabNextStep === 'function', 'vm 中应能取到 labNextStep');
  sandbox.labNextStep = function () {
    return { type: 'tool_call', name: 'clock', args: {} };
  };
  try {
    const lab = makeLab();
    const events = [];
    lab.onEvent((event) => events.push(event.type));
    await lab.submit('你好');
    const snap = lab.snapshot();
    eq(snap.turn.status, 'error', '未收敛的 turn 应为 error');
    eq(snap.stats.toolCalls, LAB_MAX_STEPS, '每个模型步都执行了工具');
    eq(linesOfKind(snap, 'error').length >= 1, true, '应有 error transcript 行');
    includes(transcriptText(snap), '最大步数', '错误文案应提到最大步数');
    ok(events.indexOf('error') >= 0, '应发出 error 事件');
    ok(events.indexOf('turn_end') >= 0, 'turn_end 仍应发出');
    eq(snap.busy, false, '结束后 busy=false');
    eq(snap.stats.turns, 1, '失败 turn 也计入 turns');
  } finally {
    sandbox.labNextStep = originalLabNextStep;
  }
  /* 恢复后引擎仍正常 */
  const lab = makeLab();
  await lab.submit('你好');
  eq(lab.snapshot().turn.status, 'done', '恢复 labNextStep 后 turn 正常');
});

/* ─────────────────────────────────────────────────────────────
 * 用例 16：进行中 compact 不打断 turn
 * ───────────────────────────────────────────────────────────── */
await test('进行中 compact：只加 info 行、不打断 turn', async () => {
  const lab = createLab({
    sleep: () => new Promise((resolve) => setTimeout(resolve, 1)),
    storage: mockStorage(),
    pace: 'fast',
  });
  const pending = lab.submit('你好');
  eq(lab.compact(), false, 'busy 时 compact 返回 false');
  await pending;
  const snap = lab.snapshot();
  includes(transcriptText(snap), '本轮还在进行', '忙碌时 compact 给出 info 行');
  eq(snap.turn.status, 'done', '原 turn 应正常完成');
});

/* ─────────────────────────────────────────────────────────────
 * 用例 17：回归 —— 压缩只发生在 turn 的 context 阶段（工具轮不压缩）
 * ───────────────────────────────────────────────────────────── */
await test('压缩只发生在 context 阶段（含工具轮）且 after < before', async () => {
  const lab = makeLab({ budget: 420 });
  const inputs = [
    '你好',
    '算一下 (12+30)*3 然后记住结果',
    '记住 我的爱好是潜水',
    '现在几点，记下来',
    '我的爱好是什么',
    '帮助',
    '1+1',
    '你有哪些工具',
  ];
  for (let i = 0; i < inputs.length; i += 1) {
    await lab.submit(inputs[i]);
    const snap = lab.snapshot();
    eq(snap.turn.status, 'done', '第 ' + (i + 1) + ' 轮应正常完成');
    ok(snap.context.used <= snap.context.limit, '第 ' + (i + 1) + ' 轮 context.used <= limit');
    const stages = snap.turn.stages;
    const firstModelIndex = stages.findIndex((stage) => stage.kind === 'model');
    ok(firstModelIndex >= 0, '每轮都应有 model stage');
    stages.forEach((stage, index) => {
      if (stage.kind !== 'compress') return;
      ok(
        index < firstModelIndex,
        '第 ' + (i + 1) + ' 轮：compress stage 必须在第一次 model 调用之前（实际位置 ' + index + ' / model ' + firstModelIndex + '）',
      );
    });
    /* 工具 stage 的 meta 不应出现无意义的「0 ms」 */
    stages.forEach((stage) => {
      if (stage.kind !== 'tool') return;
      ok(stage.meta.indexOf(' 0 ms') < 0, 'tool stage meta 不应显示 0 ms（实际：' + stage.meta + '）');
    });
  }
  const snap = lab.snapshot();
  ok(snap.stats.compressions > 0, '8 轮混合输入应至少触发一次自动压缩');
  const compressLines = linesOfKind(snap, 'compress');
  ok(compressLines.length > 0, '应有 compress transcript 行');
  compressLines.forEach((line) => {
    const matched = /上下文已压缩 · (\d+) → (\d+) tok/.exec(line.text);
    ok(matched, '压缩行格式：' + line.text);
    ok(Number(matched[2]) < Number(matched[1]), '自动压缩必须 after < before：' + line.text);
  });
});

/* ─────────────────────────────────────────────────────────────
 * 汇总
 * ───────────────────────────────────────────────────────────── */
console.log('\n' + '─'.repeat(56));
if (failCount === 0) {
  console.log(passCount + ' PASS · 0 FAIL · 全部通过 (' + (passCount + failCount) + ' 项)');
  process.exitCode = 0;
} else {
  console.log(passCount + ' PASS · ' + failCount + ' FAIL (' + (passCount + failCount) + ' 项)');
  for (const failure of failures) console.log('  ✗ ' + failure);
  process.exitCode = 1;
}
