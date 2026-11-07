/* ── 00-core.js · 常量、token 估算与通用工具 ──
 *
 * 本文件是普通脚本，会被 build.mjs 按文件名顺序拼进同一个 Client factory
 * 作用域。这里只放常量与纯函数：
 *   - 不访问 document / window；
 *   - 不依赖 React；
 *   - 唯一的外部交互是 globalThis.localStorage（已用 try/catch 保护，见 10-engine）。
 */

/* ── 上下文预算与会话限制（契约 v1 数字，不要随意改） ── */
const LAB_BUDGET = 1000; /* 教学上下文预算默认值（可在页面中调整；估算 token） */
const LAB_RECENT_KEEP = 4; /* 压缩时保留的最近消息条数 */
const LAB_MAX_STEPS = 4; /* 单轮最多模型步数 */
const LAB_STORAGE_KEY = 'dsh.agent-lab.v1';

/* ── 内部容量上限 ── */
const LAB_MAX_SESSIONS = 20; /* 最多保留 20 个会话 */
const LAB_MAX_MESSAGES = 120; /* 每会话消息上限 */
const LAB_MAX_TRANSCRIPT = 200; /* 每会话 transcript 行数上限 */
const LAB_MEMORY_LIMIT = 60; /* 长期记忆条数上限 */
const LAB_MAX_SUMMARY_LINES = 30; /* 摘要行数上限（累计式压缩） */
const LAB_MAX_INPUT_CHARS = 600; /* 单条输入最多保留的字符数 */
const LAB_COMPRESS_RATIO = 0.9; /* 超过 limit * 0.9 时触发自动压缩 */
const LAB_COMPRESS_TARGET_RATIO = 0.88; /* 压缩后尽量回到 limit * 0.88 以下，避免连续触发 */
const LAB_SUMMARY_TOKEN_RATIO = 0.16; /* 摘要最多占预算的 16%（累计式但按 token 裁剪） */
const LAB_MSG_OVERHEAD = 4; /* 每条消息在上下文里额外占用的估算 token（角色/分隔） */

/* ── pacing：模型的流式节奏（毫秒）与阶段停顿 ── */
const LAB_PACE_NAMES = ['fast', 'normal', 'slow'];
const LAB_PACE_DELAYS = { fast: 3, normal: 14, slow: 30 };
const LAB_STAGE_DELAYS = { fast: 6, normal: 40, slow: 90 };

/* ── 首次运行 / 新会话的首行 banner ── */
const LAB_BANNER = 'Agent Lab v0.1 · 模拟 / 真实 DeepSeek 双模式 · 输入 /help 查看命令';

/* ── 迷你 Agent 的 system prompt（中文，约 105 tok，留足上下文预算） ── */
const LAB_SYSTEM_PROMPT =
  '你是「Agent 实验室」的教学用迷你 Agent，由规则驱动的模拟模型扮演：不联网、可复现。' +
  '你演示最小 agent 循环——理解输入、组装上下文、决定回答或调用工具、读取真实工具结果、' +
  '再继续下一步，直到给出最终回答。请用简体中文简洁回答。';

/* ─────────────────────────────────────────────────────────────
 * token 估算
 * ─────────────────────────────────────────────────────────────
 * 规则（契约）：CJK 约 1 token/字，其他约 4 字符/token，向上取整。
 * 用码点遍历，避免把 emoji 的代理对拆开。
 */
function estimateTokens(text) {
  if (text === null || text === undefined) return 0;
  const s = String(text);
  if (!s) return 0;
  let cjk = 0;
  let other = 0;
  for (const ch of s) {
    if (labIsCjkChar(ch)) cjk += 1;
    else other += 1;
  }
  return Math.ceil(cjk + other / 4);
}

/* CJK / 全角标点按 1 字 ≈ 1 token 估算 */
function labIsCjkChar(ch) {
  const code = ch.codePointAt(0);
  if (code >= 0x2e80 && code <= 0x9fff) return true; /* CJK 部首、汉字、假名、CJK 标点 */
  if (code >= 0xf900 && code <= 0xfaff) return true; /* CJK 兼容汉字 */
  if (code >= 0xff00 && code <= 0xffef) return true; /* 全角字符与标点 */
  return false;
}

/* 字符数（按码点计，用于输入阶段的 meta） */
function labCharCount(text) {
  if (text === null || text === undefined) return 0;
  let n = 0;
  for (const ch of String(text)) n += 1;
  return n;
}

/* ─────────────────────────────────────────────────────────────
 * 时间格式化
 * ─────────────────────────────────────────────────────────────
 */
function labPad2(n) {
  return n < 10 ? '0' + n : String(n);
}

/* HH:MM:SS */
function fmtClock(ts) {
  const d = new Date(typeof ts === 'number' ? ts : Date.now());
  if (isNaN(d.getTime())) return '--:--:--';
  return labPad2(d.getHours()) + ':' + labPad2(d.getMinutes()) + ':' + labPad2(d.getSeconds());
}

/* YYYY-MM-DD HH:MM */
function fmtTime(ts) {
  const d = new Date(typeof ts === 'number' ? ts : Date.now());
  if (isNaN(d.getTime())) return '----/--/-- --:--';
  return (
    d.getFullYear() +
    '-' +
    labPad2(d.getMonth() + 1) +
    '-' +
    labPad2(d.getDate()) +
    ' ' +
    labPad2(d.getHours()) +
    ':' +
    labPad2(d.getMinutes())
  );
}

/* ─────────────────────────────────────────────────────────────
 * 文本工具
 * ─────────────────────────────────────────────────────────────
 * truncate(text, n)：最多 n 个字符（含省略号），按码点裁剪。
 */
function truncate(text, n) {
  const s = text === null || text === undefined ? '' : String(text);
  if (typeof n !== 'number' || n <= 0) return '';
  const chars = Array.from(s);
  if (chars.length <= n) return chars.join('');
  if (n <= 1) return '…';
  return chars.slice(0, n - 1).join('') + '…';
}

/* 折叠空白并裁剪到最多 max 个字符；用于输入/记忆等用户文本 */
function labCleanText(text, max) {
  const s = (text === null || text === undefined ? '' : String(text)).replace(/\s+/g, ' ').trim();
  if (typeof max === 'number' && max > 0) return truncate(s, max);
  return s;
}

/* 按 token 预算裁剪文本：保证 estimateTokens(结果) <= maxTokens */
function labTruncateToTokens(text, maxTokens) {
  const s = text === null || text === undefined ? '' : String(text);
  if (typeof maxTokens !== 'number' || maxTokens <= 0) return '';
  if (estimateTokens(s) <= maxTokens) return s;
  const chars = Array.from(s);
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = chars.slice(0, mid).join('') + '…';
    if (estimateTokens(candidate) <= maxTokens) lo = mid;
    else hi = mid - 1;
  }
  return lo > 0 ? chars.slice(0, lo).join('') + '…' : '';
}

/* ─────────────────────────────────────────────────────────────
 * id 生成（可用 options.id 覆盖，便于测试/可复现）
 * ─────────────────────────────────────────────────────────────
 */
let LAB_UID_SEQ = 0;

function uid(prefix) {
  LAB_UID_SEQ += 1;
  const tail = Math.floor(Math.random() * 0x1000000)
    .toString(36)
    .slice(-4);
  return String(prefix || 'id') + '_' + LAB_UID_SEQ.toString(36) + tail;
}

/* ─────────────────────────────────────────────────────────────
 * 其他纯工具
 * ─────────────────────────────────────────────────────────────
 */

/* 可 JSON 序列化的深拷贝；只用于纯数据（transcript detail / snapshot） */
function labClone(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    const list = [];
    for (let i = 0; i < value.length; i += 1) list.push(labClone(value[i]));
    return list;
  }
  const out = {};
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    out[key] = labClone(value[key]);
  }
  return out;
}

/* JSON.stringify 的安全版本（工具参数展示用） */
function labJson(value) {
  try {
    const text = JSON.stringify(value);
    return typeof text === 'string' ? text : '{}';
  } catch (err) {
    return '{}';
  }
}

/* 把任意异常转成一行中文可读的错误信息 */
function labErrorMessage(err) {
  if (err && typeof err.message === 'string' && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return '未知错误';
}

/* pace 归一化 */
function labNormalizePace(pace) {
  return LAB_PACE_NAMES.indexOf(pace) >= 0 ? pace : 'normal';
}

/* 阶段停顿（毫秒）；测试注入 no-op sleep 后不影响速度 */
function labStageDelayMs(pace) {
  return LAB_STAGE_DELAYS[labNormalizePace(pace)] || LAB_STAGE_DELAYS.normal;
}
