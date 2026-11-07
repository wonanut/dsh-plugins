/**
 * test/real-mode.test.mjs · 真实模型模式无头测试
 *
 * 不联网：用注入的 modelAdapter 模拟 Host 的真实模型响应，验证
 *   - 引擎在 real 模式下走异步 adapter，而不是规则模型
 *   - 工具调用消息携带 toolCallId / toolArgs，并写回 tool 消息
 *   - 第二轮上下文顺序为 user → assistant(tool_call) → tool
 *   - 模型 stage 记录 provider/model/usage/latency，snapshot 暴露模式与用量
 *   - 未注入 adapter 时给出明确错误
 *   - 模式持久化与切回模拟
 *
 * 运行：node test/real-mode.test.mjs
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
  '\n;globalThis.__LAB__ = { createLab: createLab, LAB_STORAGE_KEY: LAB_STORAGE_KEY };\n';

const sandbox = { console, setTimeout, clearTimeout };
vm.createContext(sandbox);
new vm.Script(bundle, { filename: 'agent-lab.real.vm.js' }).runInContext(sandbox);
const { createLab } = sandbox.__LAB__;

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
    throw new Error(message + '：未包含 ' + JSON.stringify(needle) + '（实际：' + String(haystack).slice(0, 300) + '）');
  }
}
async function test(name, fn) {
  try {
    await fn();
    passCount += 1;
    console.log('PASS ' + name);
  } catch (error) {
    failCount += 1;
    failures.push({ name, message: error.message });
    console.log('FAIL ' + name + ' · ' + error.message);
  }
}
function mockStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

const USAGE = { inputTokens: 320, outputTokens: 24, totalTokens: 344 };

await test('真实模式：异步 adapter + 工具调用 + 回填结果', async () => {
  const lab = createLab({ sleep: async () => {}, storage: mockStorage() });
  const calls = [];
  lab.setModelAdapter(async (request) => {
    calls.push(request);
    if (calls.length === 1) {
      return {
        type: 'tool_call',
        name: 'calculator',
        args: { expression: '(12+30)*3' },
        provider: 'deepseek-account',
        model: 'deepseek-flash',
        latencyMs: 800,
        usage: USAGE,
      };
    }
    return {
      type: 'final',
      text: '(12+30)*3 = 126',
      provider: 'deepseek-account',
      model: 'deepseek-flash',
      latencyMs: 600,
      usage: USAGE,
    };
  });
  eq(lab.setModelMode('real'), true, '切换到真实模式');
  await lab.submit('算一下 (12+30)*3');
  const s = lab.snapshot();
  eq(calls.length, 2, '真实模型被调用两次');
  eq(s.modelMode, 'real', 'snapshot.modelMode');
  eq(s.model.provider, 'deepseek-account', 'snapshot.model.provider');
  eq(s.model.lastUsage.inputTokens, 320, 'snapshot.model.lastUsage');
  const text = s.transcript.map((line) => line.text).join('\n');
  includes(text, '真实模型 · deepseek-flash · 800 ms', 'transcript 记录真实模型调用');
  includes(text, '126', '工具结果或最终回答包含 126');
  const assistantCall = s.messages.find((message) => message.kind === 'tool_call');
  ok(assistantCall && assistantCall.toolCallId, 'assistant tool_call 带 toolCallId');
  const toolResult = s.messages.find((message) => message.role === 'tool');
  ok(toolResult && toolResult.toolCallId === assistantCall.toolCallId, 'tool 消息复用同一个 toolCallId');
  const modelStage = s.turn.stages.find((stage) => stage.kind === 'model');
  ok(modelStage.detail.model && modelStage.detail.model.model === 'deepseek-flash', 'model stage 记录模型信息');
  /* 第二轮上下文顺序：user → assistant(tool_call) → tool */
  const second = calls[1].messages;
  const userIndex = second.findIndex((message) => message.role === 'user');
  const callIndex = second.findIndex((message) => message.kind === 'tool_call');
  const toolIndex = second.findIndex((message) => message.role === 'tool');
  ok(userIndex >= 0 && callIndex > userIndex && toolIndex > callIndex, '第二轮消息顺序 user → assistant(tool_call) → tool');
});

await test('真实模式：未注入 adapter 时明确报错', async () => {
  const lab = createLab({ sleep: async () => {}, storage: mockStorage() });
  lab.setModelMode('real');
  await lab.submit('你好');
  const s = lab.snapshot();
  const text = s.transcript.map((line) => line.text).join('\n');
  includes(text, '真实模型适配器未连接', '错误提示');
  eq(s.turn.status, 'error', 'turn 状态');
});

await test('真实模式：模式可持久化，切回模拟后走规则模型', async () => {
  const storage = mockStorage();
  const first = createLab({ sleep: async () => {}, storage });
  first.setModelMode('real');
  first.dispose();
  const second = createLab({ sleep: async () => {}, storage });
  eq(second.snapshot().modelMode, 'real', '重建后仍是真实模式');
  let realCalls = 0;
  second.setModelAdapter(async () => {
    realCalls += 1;
    return { type: 'final', text: '真实回答', provider: 'deepseek-account', model: 'deepseek-flash', latencyMs: 10, usage: USAGE };
  });
  await second.submit('你好');
  eq(realCalls, 1, '真实 adapter 被调用');
  second.setModelMode('sim');
  await second.submit('帮助');
  eq(realCalls, 1, '切回模拟后不再调用真实 adapter');
  const text = second.snapshot().transcript.map((line) => line.text).join('\n');
  includes(text, '我是教学用的迷你 Agent', '模拟模型回答');
});

await test('真实模式：调用失败转为可读错误，不抛出到 UI', async () => {
  const lab = createLab({ sleep: async () => {}, storage: mockStorage() });
  lab.setModelMode('real');
  lab.setModelAdapter(async () => {
    throw new Error('DeepSeek 账号额度不足');
  });
  await lab.submit('帮我算一下 1+1');
  const s = lab.snapshot();
  const text = s.transcript.map((line) => line.text).join('\n');
  includes(text, 'DeepSeek 账号额度不足', '错误文本进入 transcript');
  eq(s.turn.status, 'error', 'turn 错误状态');
  eq(s.busy, false, '失败后回到空闲');
  eq(s.model.lastError, 'DeepSeek 账号额度不足', 'snapshot.model.lastError');
});

console.log('\n────────────────────────────────────────────────────────');
if (failCount === 0) {
  console.log(passCount + ' PASS · 0 FAIL · 真实模式全部通过');
  process.exit(0);
}
console.log(passCount + ' PASS · ' + failCount + ' FAIL');
for (const failure of failures) console.log('  ✗ ' + failure.name + ' · ' + failure.message);
process.exit(1);
