/* ── 20-tools.js · 工具注册表与四个工具实现 ──
 *
 * 工具协议（契约 v1）：
 *   { name, description, parameters, run(args, ctx) -> { ok, result, display } }
 * - run 可以是 async；
 * - ctx 由 engine 注入：{ now, memory, sessionId, writeMemory, searchMemory }；
 * - 工具执行失败不抛异常，返回 { ok:false, result:{error}, display:'错误：…' }。
 *
 * 模拟 LLM（30-llm.js）只负责「决定调哪个工具、传什么参数」，
 * 真正的计算 / 时间 / 记忆读写全部在这里完成，模型不会伪造工具结果。
 */

/* ── 安全计算器：词法分析 + 递归下降求值 ──
 * 支持数字、+ - * / % ^、括号与一元正负号；不执行 eval / Function。
 */

function labCalcTokenize(expression) {
  const source = String(expression === null || expression === undefined ? '' : expression).replace(/\s+/g, '');
  if (!source) return null;
  const tokens = [];
  let i = 0;
  while (i < source.length) {
    const ch = source.charAt(i);
    if (ch >= '0' && ch <= '9') {
      let j = i;
      let dots = 0;
      while (j < source.length && (source.charAt(j) === '.' || (source.charAt(j) >= '0' && source.charAt(j) <= '9'))) {
        if (source.charAt(j) === '.') dots += 1;
        j += 1;
      }
      if (dots > 1) return null;
      const raw = source.slice(i, j);
      const num = Number(raw);
      if (!isFinite(num)) return null;
      tokens.push({ type: 'num', value: num });
      i = j;
      continue;
    }
    if ('+-*/%^()'.indexOf(ch) >= 0) {
      tokens.push({ type: ch });
      i += 1;
      continue;
    }
    return null; /* 出现不认识的字符 → 语法不合法 */
  }
  return tokens;
}

function labCalcParse(tokens) {
  let pos = 0;

  function peek() {
    return tokens[pos];
  }

  function fail(message) {
    throw new Error(message);
  }

  function parseExpression() {
    let left = parseTerm();
    while (peek() && (peek().type === '+' || peek().type === '-')) {
      const op = tokens[pos].type;
      pos += 1;
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseTerm() {
    let left = parseUnary();
    while (peek() && (peek().type === '*' || peek().type === '/' || peek().type === '%')) {
      const op = tokens[pos].type;
      pos += 1;
      const right = parseUnary();
      if (op === '*') {
        left = left * right;
      } else if (op === '/') {
        if (right === 0) fail('除数不能为 0');
        left = left / right;
      } else {
        if (right === 0) fail('取余的除数不能为 0');
        left = left % right;
      }
    }
    return left;
  }

  function parseUnary() {
    if (peek() && peek().type === '-') {
      pos += 1;
      return -parseUnary();
    }
    if (peek() && peek().type === '+') {
      pos += 1;
      return parseUnary();
    }
    return parsePower();
  }

  function parsePower() {
    const base = parsePrimary();
    if (peek() && peek().type === '^') {
      pos += 1;
      const exponent = parseUnary(); /* 右结合，且允许 2^-1 */
      return Math.pow(base, exponent);
    }
    return base;
  }

  function parsePrimary() {
    const token = peek();
    if (!token) fail('表达式不完整');
    if (token.type === 'num') {
      pos += 1;
      return token.value;
    }
    if (token.type === '(') {
      pos += 1;
      const value = parseExpression();
      if (!peek() || peek().type !== ')') fail('括号不匹配');
      pos += 1;
      return value;
    }
    fail('这里需要一个数字或左括号');
    return 0;
  }

  const result = parseExpression();
  if (pos !== tokens.length) fail('表达式有多余内容');
  return result;
}

/* 计算器工具 */
const LAB_CALCULATOR = {
  name: 'calculator',
  description: '安全计算四则 / 幂 / 括号表达式，返回数值结果',
  parameters: {
    type: 'object',
    properties: {
      expression: { type: 'string', description: '要计算的表达式，例如 (12+30)*3' },
    },
    required: ['expression'],
  },
  run(args, ctx) {
    try {
      const expression = args && typeof args.expression === 'string' ? args.expression : '';
      if (!expression.trim()) return labToolError('缺少表达式');
      const tokens = labCalcTokenize(expression);
      if (!tokens) return labToolError('只能计算数字与 + - * / % ^ ( )');
      const value = labCalcParse(tokens);
      if (typeof value !== 'number' || !isFinite(value)) return labToolError('计算结果不是有限数字');
      let rounded = Math.round(value * 1e12) / 1e12;
      if (Object.is(rounded, -0)) rounded = 0;
      return {
        ok: true,
        result: { expression: expression.trim(), value: rounded },
        display: String(rounded),
      };
    } catch (err) {
      return labToolError(labErrorMessage(err));
    }
  },
};

/* 时钟工具 */
const LAB_CLOCK = {
  name: 'clock',
  description: '读取本机当前时间与日期，可指定 format=time/date/full',
  parameters: {
    type: 'object',
    properties: {
      format: { type: 'string', description: 'time | date | full，默认 full' },
    },
    required: [],
  },
  run(args, ctx) {
    try {
      const ts = ctx && typeof ctx.now === 'function' ? ctx.now() : Date.now();
      const d = new Date(ts);
      if (isNaN(d.getTime())) return labToolError('时钟不可用');
      const time = labPad2(d.getHours()) + ':' + labPad2(d.getMinutes()) + ':' + labPad2(d.getSeconds());
      const date = d.getFullYear() + '-' + labPad2(d.getMonth() + 1) + '-' + labPad2(d.getDate());
      const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
      const weekday = weekdays[d.getDay()];
      const format = args && typeof args.format === 'string' ? args.format : 'full';
      let display;
      if (format === 'time') display = time;
      else if (format === 'date') display = date + ' ' + weekday;
      else display = date + ' ' + time;
      return {
        ok: true,
        result: {
          iso: d.toISOString(),
          timestamp: ts,
          date: date,
          time: time,
          weekday: weekday,
          timezoneOffset: d.getTimezoneOffset(),
        },
        display: display,
      };
    } catch (err) {
      return labToolError(labErrorMessage(err));
    }
  },
};

/* 写长期记忆工具 */
const LAB_MEMORY_WRITE = {
  name: 'memory_write',
  description: '把一条事实写入长期记忆（跨会话共享），相同 key 会覆盖更新',
  parameters: {
    type: 'object',
    properties: {
      key: { type: 'string', description: '记忆名称，例如 项目代号' },
      value: { type: 'string', description: '记忆内容，例如 Orion' },
    },
    required: ['key', 'value'],
  },
  run(args, ctx) {
    try {
      const key = labCleanText(args && args.key, 40);
      const value = labCleanText(args && args.value, 240);
      if (!key) return labToolError('缺少记忆名称 key');
      if (!value) return labToolError('缺少记忆内容 value');
      if (!ctx || typeof ctx.writeMemory !== 'function') return labToolError('记忆服务不可用');
      const item = ctx.writeMemory({
        key: key,
        value: value,
        source: '记忆工具',
        sessionId: ctx.sessionId,
      });
      if (!item) return labToolError('写入记忆失败');
      return {
        ok: true,
        result: { id: item.id, key: item.key, value: item.value },
        display: item.key + ' = ' + item.value,
      };
    } catch (err) {
      return labToolError(labErrorMessage(err));
    }
  },
};

/* 检索长期记忆工具 */
const LAB_MEMORY_SEARCH = {
  name: 'memory_search',
  description: '按关键词检索长期记忆，返回最相关的几条事实',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '关键词或问题，例如 项目代号' },
    },
    required: ['query'],
  },
  run(args, ctx) {
    try {
      if (!ctx || typeof ctx.searchMemory !== 'function') return labToolError('记忆服务不可用');
      const query = labCleanText(args && args.query, 120);
      const matches = ctx.searchMemory(query || '') || [];
      const list = matches.map(function (item) {
        return { id: item.id, key: item.key, value: item.value };
      });
      return {
        ok: true,
        result: { query: query, count: list.length, matches: list },
        display: list.length
          ? list
              .map(function (item) {
                return item.key + ' = ' + item.value;
              })
              .join('；')
          : '没有找到相关记忆',
      };
    } catch (err) {
      return labToolError(labErrorMessage(err));
    }
  },
};

/* ─────────────────────────────────────────────────────────────
 * 随机 / 实用工具：让教学 agent 能玩、也能派上用场
 * ───────────────────────────────────────────────────────────── */

function labToolRandomInt(max) {
  const limit = Math.max(1, Math.floor(max));
  try {
    const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
    if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
      const array = new Uint32Array(1);
      cryptoObj.getRandomValues(array);
      return array[0] % limit;
    }
  } catch (error) {
    /* 浏览器不支持 crypto 时退回 Math.random */
  }
  return Math.floor(Math.random() * limit);
}

function labClampInt(raw, min, max, fallback) {
  const number = Number(raw);
  if (!isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

/* 掷骰子 */
const LAB_DICE = {
  name: 'dice_roll',
  description: '掷骰子，支持指定面数与个数，返回每次点数与合计。用户说「掷骰子/roll/随机点数/抽个签」时使用。',
  parameters: {
    type: 'object',
    properties: {
      sides: { type: 'integer', description: '骰子面数，默认 6，范围 2..1000' },
      count: { type: 'integer', description: '掷几个，默认 1，范围 1..20' },
    },
    required: [],
  },
  run(args) {
    try {
      const sides = labClampInt(args && args.sides, 2, 1000, 6);
      const count = labClampInt(args && args.count, 1, 20, 1);
      const rolls = [];
      let total = 0;
      for (let i = 0; i < count; i += 1) {
        const value = labToolRandomInt(sides) + 1;
        rolls.push(value);
        total += value;
      }
      return {
        ok: true,
        result: { sides: sides, count: count, rolls: rolls, total: total },
        display: rolls.join(' + ') + (count > 1 ? ' = ' + total : '') + '（D' + sides + '）',
      };
    } catch (error) {
      return labToolError(labErrorMessage(error));
    }
  },
};

/* 从候选项里随机选一个 */
const LAB_RANDOM_PICK = {
  name: 'random_pick',
  description: '从两个或多个候选项里随机挑一个，适合「帮我选/二选一/抽一个」。不要用它替代用户做重要决策，只做随机选择。',
  parameters: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        description: '候选项列表，至少 2 个、最多 20 个',
        items: { type: 'string' },
      },
    },
    required: ['items'],
  },
  run(args) {
    try {
      const raw = args && Array.isArray(args.items) ? args.items : [];
      const items = [];
      for (let i = 0; i < raw.length && items.length < 20; i += 1) {
        const item = labCleanText(raw[i], 60);
        if (item) items.push(item);
      }
      if (items.length < 2) return labToolError('至少需要两个候选项，例如：火锅、烧烤、日料');
      const index = labToolRandomInt(items.length);
      return {
        ok: true,
        result: { items: items, index: index, choice: items[index] },
        display: items[index] + '（从 ' + items.length + ' 个选项中随机选出）',
      };
    } catch (error) {
      return labToolError(labErrorMessage(error));
    }
  },
};

/* 生成随机密码 */
const LAB_PASSWORD = {
  name: 'password_generate',
  description: '生成随机密码，可指定长度以及是否包含数字/符号。用户说「生成密码/随机密码」时使用。',
  parameters: {
    type: 'object',
    properties: {
      length: { type: 'integer', description: '密码长度，默认 16，范围 6..64' },
      numbers: { type: 'boolean', description: '是否包含数字，默认 true' },
      symbols: { type: 'boolean', description: '是否包含特殊符号，默认 true' },
    },
    required: [],
  },
  run(args) {
    try {
      const length = labClampInt(args && args.length, 6, 64, 16);
      const withNumbers = !(args && args.numbers === false);
      const withSymbols = !(args && args.symbols === false);
      const lower = 'abcdefghijkmnopqrstuvwxyz';
      const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
      const digits = '23456789';
      const symbols = '!@#$%^&*-_=+?';
      let alphabet = lower + upper;
      const required = [lower[labToolRandomInt(lower.length)], upper[labToolRandomInt(upper.length)]];
      if (withNumbers) {
        alphabet += digits;
        required.push(digits[labToolRandomInt(digits.length)]);
      }
      if (withSymbols) {
        alphabet += symbols;
        required.push(symbols[labToolRandomInt(symbols.length)]);
      }
      const chars = required.slice(0, length);
      while (chars.length < length) chars.push(alphabet[labToolRandomInt(alphabet.length)]);
      /* 洗牌，避免固定位置总是某类字符 */
      for (let i = chars.length - 1; i > 0; i -= 1) {
        const j = labToolRandomInt(i + 1);
        const tmp = chars[i];
        chars[i] = chars[j];
        chars[j] = tmp;
      }
      const password = chars.join('');
      return {
        ok: true,
        result: { password: password, length: length, numbers: withNumbers, symbols: withSymbols },
        display: password + '（' + length + ' 位）',
      };
    } catch (error) {
      return labToolError(labErrorMessage(error));
    }
  },
};

/* 单位换算 */
const LAB_UNIT_ALIASES = {
  m: 'm', 米: 'm', meter: 'm', meters: 'm', metre: 'm', metres: 'm',
  km: 'km', 公里: 'km', 千米: 'km', kilometer: 'km', kilometers: 'km', kilometre: 'km', kilometres: 'km',
  cm: 'cm', 厘米: 'cm', centimeter: 'cm', centimeters: 'cm',
  mm: 'mm', 毫米: 'mm', millimeter: 'mm', millimeters: 'mm',
  mi: 'mi', 英里: 'mi', mile: 'mi', miles: 'mi',
  yd: 'yd', 码: 'yd', yard: 'yd', yards: 'yd',
  ft: 'ft', 英尺: 'ft', foot: 'ft', feet: 'ft',
  in: 'in', 英寸: 'in', inch: 'in', inches: 'in',
  kg: 'kg', 公斤: 'kg', 千克: 'kg', kilogram: 'kg', kilograms: 'kg',
  g: 'g', 克: 'g', gram: 'g', grams: 'g',
  mg: 'mg', 毫克: 'mg', milligram: 'mg', milligrams: 'mg',
  t: 't', 吨: 't', ton: 't', tons: 't',
  jin: 'jin', 斤: 'jin',
  lb: 'lb', 磅: 'lb', pound: 'lb', pounds: 'lb',
  oz: 'oz', 盎司: 'oz', ounce: 'oz', ounces: 'oz',
  l: 'l', 升: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  ml: 'ml', 毫升: 'ml', milliliter: 'ml', milliliters: 'ml',
  gal: 'gal', 加仑: 'gal', gallon: 'gal', gallons: 'gal',
  mps: 'mps', 'm/s': 'mps', 米每秒: 'mps',
  kmh: 'kmh', 'km/h': 'kmh', 公里每小时: 'kmh', 千米每小时: 'kmh',
  mph: 'mph', 'mi/h': 'mph', 英里每小时: 'mph',
  b: 'b', 字节: 'b', byte: 'b', bytes: 'b',
  kb: 'kb', 千字节: 'kb', kilobyte: 'kb', kilobytes: 'kb',
  mb: 'mb', 兆字节: 'mb', megabyte: 'mb', megabytes: 'mb',
  gb: 'gb', 吉字节: 'gb', gigabyte: 'gb', gigabytes: 'gb',
  c: 'c', '°c': 'c', 摄氏度: 'c', 摄氏: 'c', celsius: 'c', centigrade: 'c', '℃': 'c',
  f: 'f', '°f': 'f', 华氏度: 'f', 华氏: 'f', fahrenheit: 'f', '℉': 'f',
  k: 'k', 开尔文: 'k', kelvin: 'k',
};

const LAB_UNIT_TABLE = {
  m: { kind: 'length', factor: 1, label: '米' },
  km: { kind: 'length', factor: 1000, label: '公里' },
  cm: { kind: 'length', factor: 0.01, label: '厘米' },
  mm: { kind: 'length', factor: 0.001, label: '毫米' },
  mi: { kind: 'length', factor: 1609.344, label: '英里' },
  yd: { kind: 'length', factor: 0.9144, label: '码' },
  ft: { kind: 'length', factor: 0.3048, label: '英尺' },
  in: { kind: 'length', factor: 0.0254, label: '英寸' },
  kg: { kind: 'mass', factor: 1, label: '公斤' },
  g: { kind: 'mass', factor: 0.001, label: '克' },
  mg: { kind: 'mass', factor: 0.000001, label: '毫克' },
  t: { kind: 'mass', factor: 1000, label: '吨' },
  jin: { kind: 'mass', factor: 0.5, label: '斤' },
  lb: { kind: 'mass', factor: 0.45359237, label: '磅' },
  oz: { kind: 'mass', factor: 0.028349523125, label: '盎司' },
  l: { kind: 'volume', factor: 1, label: '升' },
  ml: { kind: 'volume', factor: 0.001, label: '毫升' },
  gal: { kind: 'volume', factor: 3.785411784, label: '加仑' },
  mps: { kind: 'speed', factor: 1, label: '米/秒' },
  kmh: { kind: 'speed', factor: 0.2777777778, label: '公里/小时' },
  mph: { kind: 'speed', factor: 0.44704, label: '英里/小时' },
  b: { kind: 'data', factor: 1, label: '字节' },
  kb: { kind: 'data', factor: 1024, label: 'KB' },
  mb: { kind: 'data', factor: 1048576, label: 'MB' },
  gb: { kind: 'data', factor: 1073741824, label: 'GB' },
};

function labEscapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* 供规则模型识别单位词（按长度倒序，长词优先） */
const LAB_UNIT_WORD_PATTERN = Object.keys(LAB_UNIT_ALIASES)
  .sort(function (a, b) {
    return b.length - a.length;
  })
  .map(labEscapeRegExp)
  .join('|');

function labNormalizeUnit(raw) {
  const key = String(raw === null || raw === undefined ? '' : raw).trim().toLowerCase();
  return LAB_UNIT_ALIASES[key] || null;
}

function labRoundNumber(value) {
  if (!isFinite(value)) return value;
  return Math.round(value * 1e6) / 1e6;
}

function labTemperatureConvert(value, from, to) {
  let celsius;
  if (from === 'c') celsius = value;
  else if (from === 'f') celsius = (value - 32) * 5 / 9;
  else celsius = value - 273.15;
  if (to === 'c') return celsius;
  if (to === 'f') return celsius * 9 / 5 + 32;
  return celsius + 273.15;
}

const LAB_UNIT_CONVERT = {
  name: 'unit_convert',
  description: '换算单位：长度（米/公里/英里/英尺/英寸）、重量（公斤/斤/磅）、温度（摄氏/华氏/开尔文）、体积、速度、数据大小。用户说「X 等于多少 Y」「换算」时使用。',
  parameters: {
    type: 'object',
    properties: {
      value: { type: 'number', description: '要换算的数值' },
      from: { type: 'string', description: '原单位，例如 公里 / km / 摄氏度 / kg' },
      to: { type: 'string', description: '目标单位，例如 英里 / mi / 华氏度 / 磅' },
    },
    required: ['value', 'from', 'to'],
  },
  run(args) {
    try {
      const value = Number(args && args.value);
      if (!isFinite(value)) return labToolError('缺少有效的数值');
      const from = labNormalizeUnit(args && args.from);
      const to = labNormalizeUnit(args && args.to);
      if (!from) return labToolError('不认识原单位：' + String(args && args.from));
      if (!to) return labToolError('不认识目标单位：' + String(args && args.to));
      const isTemp = from === 'c' || from === 'f' || from === 'k' || to === 'c' || to === 'f' || to === 'k';
      let converted;
      let fromLabel = from.toUpperCase();
      let toLabel = to.toUpperCase();
      if (isTemp) {
        if (!((from === 'c' || from === 'f' || from === 'k') && (to === 'c' || to === 'f' || to === 'k'))) {
          return labToolError('温度只能和温度互相换算');
        }
        converted = labTemperatureConvert(value, from, to);
        fromLabel = { c: '°C', f: '°F', k: 'K' }[from];
        toLabel = { c: '°C', f: '°F', k: 'K' }[to];
      } else {
        const source = LAB_UNIT_TABLE[from];
        const target = LAB_UNIT_TABLE[to];
        if (!source || !target) return labToolError('这个单位暂不支持换算');
        if (source.kind !== target.kind) return labToolError('不能把「' + source.label + '」和「' + target.label + '」互相换算');
        converted = value * source.factor / target.factor;
        fromLabel = source.label;
        toLabel = target.label;
      }
      const rounded = labRoundNumber(converted);
      return {
        ok: true,
        result: { value: value, from: from, to: to, converted: rounded, kind: isTemp ? 'temperature' : LAB_UNIT_TABLE[from].kind },
        display: value + ' ' + fromLabel + ' = ' + rounded + ' ' + toLabel,
      };
    } catch (error) {
      return labToolError(labErrorMessage(error));
    }
  },
};

/* ── 工具注册表（engine 按 name 查找；UI 可据此展示） ── */
const LAB_TOOLS = [
  LAB_CALCULATOR,
  LAB_CLOCK,
  LAB_DICE,
  LAB_RANDOM_PICK,
  LAB_PASSWORD,
  LAB_UNIT_CONVERT,
  LAB_MEMORY_WRITE,
  LAB_MEMORY_SEARCH,
];

/* 发给模型的工具 schema（去掉 run，model stage detail 里会用到） */
const LAB_TOOL_SCHEMAS = LAB_TOOLS.map(function (tool) {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  };
});

/* 统一构造工具失败结果 */
function labToolError(message) {
  const text = labCleanText(message, 120) || '工具调用失败';
  return { ok: false, result: { error: text }, display: '错误：' + text };
}
