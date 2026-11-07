/**
 * test/extra-tools.test.mjs · 新增趣味工具与规则模型意图测试
 * 覆盖 dice_roll / random_pick / password_generate / unit_convert，
 * 以及模拟模型能否正确选择并回答这些工具。
 * 运行：node test/extra-tools.test.mjs
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
  '\n;globalThis.__LAB__ = { createLab: createLab, LAB_TOOLS: LAB_TOOLS, LAB_UNIT_ALIASES: LAB_UNIT_ALIASES };\n';
const sandbox = { console, setTimeout, clearTimeout };
vm.createContext(sandbox);
new vm.Script(bundle, { filename: 'agent-lab.tools.vm.js' }).runInContext(sandbox);
const { createLab, LAB_TOOLS } = sandbox.__LAB__;

let passCount = 0;
let failCount = 0;
const failures = [];
function ok(condition, message) {
  if (!condition) throw new Error(message);
}
function eq(actual, expected, message) {
  if (actual !== expected) throw new Error(message + '：期望 ' + JSON.stringify(expected) + '，实际 ' + JSON.stringify(actual));
}
function includes(haystack, needle, message) {
  if (String(haystack).indexOf(needle) < 0) throw new Error(message + '：未包含 ' + JSON.stringify(needle) + '（实际：' + String(haystack).slice(0, 240) + '）');
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
function tool(name) {
  return LAB_TOOLS.find((item) => item.name === name);
}
function makeLab() {
  const data = new Map();
  return createLab({
    sleep: async () => {},
    pace: 'fast',
    storage: {
      getItem: (key) => (data.has(key) ? data.get(key) : null),
      setItem: (key, value) => data.set(key, String(value)),
      removeItem: (key) => data.delete(key),
    },
  });
}
function transcript(snapshot) {
  return snapshot.transcript.map((line) => line.text).join('\n');
}

await test('工具注册表：8 个工具且 schema 完整', async () => {
  eq(LAB_TOOLS.length, 8, '工具数量');
  for (const name of ['calculator', 'clock', 'dice_roll', 'random_pick', 'password_generate', 'unit_convert', 'memory_write', 'memory_search']) {
    const item = tool(name);
    ok(item, '缺少工具 ' + name);
    ok(item.parameters && item.parameters.type === 'object', name + ' 参数 schema');
  }
});

await test('dice_roll：面数 / 个数 / 范围', async () => {
  const result = tool('dice_roll').run({ sides: 6, count: 2 }, {});
  ok(result.ok, '应成功');
  eq(result.result.rolls.length, 2, '掷两个');
  for (const value of result.result.rolls) ok(value >= 1 && value <= 6, '点数范围');
  eq(result.result.total, result.result.rolls[0] + result.result.rolls[1], '合计');
  const dnd = tool('dice_roll').run({ sides: 20, count: 3 }, {});
  ok(dnd.result.rolls.every((n) => n >= 1 && n <= 20), 'D20 范围');
});

await test('random_pick：从候选项中选一个', async () => {
  const items = ['火锅', '烧烤', '日料'];
  const result = tool('random_pick').run({ items }, {});
  ok(result.ok, '应成功');
  ok(items.indexOf(result.result.choice) >= 0, '结果必须在候选中');
  eq(tool('random_pick').run({ items: ['只有一个'] }, {}).ok, false, '少于两个应失败');
});

await test('password_generate：长度与字符集', async () => {
  const result = tool('password_generate').run({ length: 20, numbers: true, symbols: true }, {});
  ok(result.ok, '应成功');
  eq(result.result.password.length, 20, '长度');
  ok(/[a-z]/.test(result.result.password), '包含小写');
  ok(/[A-Z]/.test(result.result.password), '包含大写');
  ok(/[0-9]/.test(result.result.password), '包含数字');
  ok(/[!@#$%^&*_=+?]/.test(result.result.password), '包含符号');
  eq(tool('password_generate').run({ length: 4 }, {}).result.length, 6, '长度下限修正为 6');
});

await test('unit_convert：长度 / 温度 / 重量', async () => {
  const km = tool('unit_convert').run({ value: 100, from: '公里', to: '英里' }, {});
  ok(km.ok, '公里→英里应成功');
  ok(Math.abs(km.result.converted - 62.137119) < 0.001, '100 公里 ≈ 62.137 英里，实际 ' + km.result.converted);
  const temp = tool('unit_convert').run({ value: 0, from: '摄氏度', to: '华氏度' }, {});
  eq(temp.result.converted, 32, '0°C = 32°F');
  const mass = tool('unit_convert').run({ value: 1, from: 'kg', to: 'lb' }, {});
  ok(Math.abs(mass.result.converted - 2.204623) < 0.001, '1kg ≈ 2.2046lb');
  eq(tool('unit_convert').run({ value: 1, from: 'kg', to: 'km' }, {}).ok, false, '不同量纲应失败');
  eq(tool('unit_convert').run({ value: 1, from: '斤', to: 'kg' }, {}).result.converted, 0.5, '1 斤 = 0.5kg');
});

await test('模拟模型：掷骰子意图与工具链', async () => {
  const lab = makeLab();
  await lab.submit('掷两个 20 面骰子');
  const snap = lab.snapshot();
  const text = transcript(snap);
  includes(text, 'dice_roll', '应调用 dice_roll');
  includes(text, '🎲', '回答应带骰子结果');
  eq(snap.turn.status, 'done', 'turn 完成');
});

await test('模拟模型：随机选择意图', async () => {
  const lab = makeLab();
  await lab.submit('从 火锅、烧烤、日料 里帮我选一个');
  const snap = lab.snapshot();
  includes(transcript(snap), 'random_pick', '应调用 random_pick');
  includes(transcript(snap), '我选：', '回答应给出选择');
});

await test('模拟模型：生成密码意图', async () => {
  const lab = makeLab();
  await lab.submit('生成一个 20 位密码');
  const snap = lab.snapshot();
  includes(transcript(snap), 'password_generate', '应调用 password_generate');
  includes(transcript(snap), '20 位', '回答应说明长度');
});

await test('模拟模型：单位换算意图', async () => {
  const lab = makeLab();
  await lab.submit('100 公里等于多少英里');
  const snap = lab.snapshot();
  const text = transcript(snap);
  includes(text, 'unit_convert', '应调用 unit_convert');
  includes(text, '62.13', '换算结果应正确');
});

await test('模拟模型：工具结果可链式写入长期记忆', async () => {
  const lab = makeLab();
  await lab.submit('掷两个骰子，然后记住结果');
  const snap = lab.snapshot();
  const text = transcript(snap);
  includes(text, 'dice_roll', '应调用 dice_roll');
  includes(text, 'memory_write', '应链式调用 memory_write');
  const entry = snap.memory.find((item) => item.key === '掷骰结果');
  ok(entry && entry.value, '长期记忆应包含掷骰结果');
});

console.log('\n────────────────────────────────────────────────────────');
if (failCount === 0) {
  console.log(passCount + ' PASS · 0 FAIL · 新增工具全部通过');
  process.exit(0);
}
console.log(passCount + ' PASS · ' + failCount + ' FAIL');
for (const failure of failures) console.log('  ✗ ' + failure.name + ' · ' + failure.message);
process.exit(1);
