/* ── 30-llm.js · 规则驱动的模拟 LLM（计划 + 流式输出） ──
 *
 * 这是教学用的「假模型」：完全离线、规则驱动、可复现。
 * 它只做两件事：
 *   1. labNextStep(ctx)：决定下一步——要么直接给最终回答，要么发起一次工具调用；
 *   2. labStreamAnswer(text, opts)：把最终回答分块流式吐出来（真实节奏由 engine 注入）。
 *
 * 重要：模型绝不伪造工具结果。算术、时间、记忆都必须通过 20-tools.js 的
 * LAB_TOOLS 真实执行，engine 把结果作为 lastTool 再传回模型。
 */

/* ── 固定文案（中文、口语、尽量 ≤ 120 字） ── */
const LAB_LLM_EMPTY_TEXT =
  '你好，我是教学用的迷你 Agent。可以试试「帮助」「算一下 (12+30)*3」或「记住 我的项目代号是 Orion」。';

const LAB_LLM_HELP_TEXT =
  '我是教学用的迷你 Agent，能力有：算术、时间、掷骰子、随机选择、生成密码、单位换算、记住/回忆事实、查看工具和原理。' +
  '可以试试：「算一下 (12+30)*3」「掷两个 20 面骰子」「从 火锅、烧烤、日料 里帮我选一个」「100 公里等于多少英里」。';

const LAB_LLM_GREETING_TEXT =
  '你好！我是 Agent Lab 里规则驱动的迷你模型，离线、可复现。输入「算一下 (12+30)*3」' +
  '看看 agent 如何调用工具，或输入「帮助」查看能力清单。';

const LAB_LLM_TOOLS_TEXT =
  '我挂着 8 个工具：calculator（四则/幂运算）、clock（时间日期）、dice_roll（掷骰子）、' +
  'random_pick（随机选择）、password_generate（生成密码）、unit_convert（单位换算）、' +
  'memory_write（写长期记忆）、memory_search（检索记忆）。模型只决定调用哪个工具、传什么参数，结果由工具真实返回。';

const LAB_LLM_PRINCIPLE_TEXT =
  '我是一个最小可解释的 agent 循环：接收输入 → 组装上下文 → 模型决定（直接回答或调用工具）→ ' +
  '执行工具并把结果放回上下文 → 模型再决定，直到给出最终回答。我是规则驱动的模拟模型，不联网，' +
  '但结构和真实 LLM Agent 一致。';

const LAB_LLM_FORGET_TEXT =
  '想清空记忆的话，请在右侧「记忆」面板点「清空」，或调用 clearMemory()。' +
  '我不会在对话里直接删记忆，避免误操作。';

/* ─────────────────────────────────────────────────────────────
 * 意图识别
 * ─────────────────────────────────────────────────────────────
 */

function labLlmIsHelpQ(input) {
  return /^\/help\b/i.test(input) || /帮助|你能做什么|能干什么|会做什么|怎么用|使用说明/.test(input);
}

function labLlmIsGreetingQ(input) {
  return /^(你好|您好|嗨|哈喽|哈啰|hello|hi|hey|早上好|中午好|下午好|晚上好|在吗)[\s!！。.～~]*$/i.test(input);
}

function labLlmIsToolsQ(input) {
  return (
    /^工具[\s?？。！!]*$/.test(input) ||
    /(有哪些|有什么|几个|哪些).{0,4}工具|工具.{0,6}(列表|有哪些|是什么|作用|介绍)|tools?\b/i.test(input)
  );
}

function labLlmIsPrincipleQ(input) {
  return /你是谁|你是什么|怎么工作|如何工作|工作原理|原理|agent.{0,6}(循环|怎么|如何)|介绍.{0,4}自己|自我介绍一下|怎么运行|如何运行/i.test(
    input,
  );
}

function labLlmIsForgetQ(input) {
  return /忘掉|忘记|清空记忆|清除记忆|删除记忆|删掉记忆/.test(input);
}

function labLlmIsCompactQ(input) {
  return /压缩|compact|总结.{0,4}上下文|上下文.{0,6}(满|超|预算|压缩)/i.test(input);
}

function labLlmIsTimeQ(input) {
  const trimmed = input.replace(/[。！？?！\s]+$/g, '');
  if (/^(时间|日期|今天|现在|几点|几号)$/.test(trimmed)) return true;
  return /现在.{0,4}(几点|时间|日期|时刻)|当前.{0,4}(时间|日期)|今天.{0,4}(几号|日期|星期|周几)|(几点|几号|星期几|周几)(了|啊|呀)?[？?]?$|\bnow\b|\bclock\b/i.test(
    input,
  );
}

function labLlmIsRecallQ(input) {
  return /我的.{1,24}?(是什么|是多少|呢|叫什么|叫啥|多少)|你还记得|还记不记得|记得.{0,8}吗|回忆|记忆(里|中|库|面板)|^记忆$|查.{0,6}记忆|找.{0,6}记忆/.test(
    input,
  );
}

function labLlmIsWriteQ(input) {
  return /记住|记一下|记一记|记下|记好|保存|存一下|存下|我的.{1,20}是/.test(input);
}

/* 「记住/保存」类意图：用于工具结果返回后的链式记忆写入 */
function labLlmWantsSave(input) {
  return /记住|记下|记一下|记一记|保存|存一下|存下/.test(input);
}

/* 从「我的X是什么」等问题里抽出检索关键词；泛化的「你还记得什么」返回空串，
 * 让 memory_search 返回最近记忆。 */
function labLlmRecallQuery(input) {
  if (/^(你还记得什么|你还记得些什么|还记得什么|你记得什么|记得什么|记忆|回忆|回忆一下|你还记得吗|你记得吗)[？?。！!\s]*$/.test(input)) {
    return '';
  }
  const matched = /我的(.{1,24}?)(?:是什么|是多少|呢|叫什么|叫啥|多少)/.exec(input);
  if (matched && matched[1].trim()) return matched[1].trim();
  const stripped = input
    .replace(/你还记得|还记不记得|记得|回忆|记忆|一下|帮我|请问|吗|呢|什么|查|找|的|是/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped || input;
}

/* 从表达式中抽出可以交给 calculator 的算式；抽不到返回 null */
function labLlmExtractExpression(input) {
  /* 把非算式字符替换成空格，再去掉空格，得到连续算式 */
  const cleaned = input.replace(/[^0-9+\-*/%^().\s]/g, ' ').replace(/\s+/g, '');
  if (!cleaned) return null;
  if (!/[0-9]/.test(cleaned)) return null;
  if (!/[+\-*/%^]/.test(cleaned)) return null;
  /* 括号必须配平 */
  let depth = 0;
  for (const ch of cleaned) {
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth < 0) return null;
    }
  }
  if (depth !== 0) return null;
  /* 不能以运算符结尾 / 开头（一元符号除外） */
  if (/[+\-*/%^]$/.test(cleaned)) return null;
  if (/^[*/%^]/.test(cleaned)) return null;
  return cleaned;
}

/* 把「记住 …」类输入解析成 { key, value }；解析失败返回 null */
function labLlmExtractMemory(input) {
  let text = input;
  /* 去掉开头的命令词 */
  const stripped = text.replace(/^(请|麻烦|帮我|帮忙)?\s*(记住|记一下|记一记|记下|记好|保存一下|保存|存一下|存下)[：:，,、\s]*/, '');
  if (stripped !== text) text = stripped.trim();
  if (!text) return null;
  let matched = /^我的(.{1,20}?)是(.+)$/.exec(text);
  if (matched) return { key: labLlmTrimPunct(matched[1]), value: labLlmTrimPunct(matched[2]) };
  matched = /^我的(.{1,20}?)叫(.+)$/.exec(text);
  if (matched) return { key: labLlmTrimPunct(matched[1]), value: labLlmTrimPunct(matched[2]) };
  /* 「X 是 Y」这类自然表达（例如「项目 是 阿波罗」） */
  matched = /^(.{1,20}?)\s*是\s*(.+)$/.exec(text);
  if (matched) return { key: labLlmTrimPunct(matched[1]), value: labLlmTrimPunct(matched[2]) };
  matched = /^(.{1,30}?)\s*(?:=|：|:)\s*(.+)$/.exec(text);
  if (matched) return { key: labLlmTrimPunct(matched[1]), value: labLlmTrimPunct(matched[2]) };
  /* 「记住：X」这类没有分隔符的内容，统一放到「备忘」下 */
  return { key: '备忘', value: labLlmTrimPunct(text) };
}

function labLlmTrimPunct(text) {
  return String(text == null ? '' : text)
    .replace(/^[「『"'“\s]+|[」』"'”\s]+$/g, '')
    .replace(/[。！!？?；;，,、\s]+$/g, '')
    .trim();
}

/* ─────────────────────────────────────────────────────────────
 * 随机 / 实用工具意图
 * ─────────────────────────────────────────────────────────────
 */

const LAB_CN_NUMBERS = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

function labLlmChineseNumber(text) {
  if (!text) return null;
  if (text === '十') return 10;
  if (text.length === 1 && LAB_CN_NUMBERS[text]) return LAB_CN_NUMBERS[text];
  if (text.length === 2 && text[0] === '十' && LAB_CN_NUMBERS[text[1]]) return 10 + LAB_CN_NUMBERS[text[1]];
  return null;
}

function labLlmIsDiceQ(input) {
  return /掷骰|骰子|roll\s*(a\s*)?dice|\bdice\b|随机点数|抽个签|抽签/i.test(input);
}

function labLlmDiceArgs(input) {
  let sides = 6;
  let count = 1;
  const dnd = /(\d+)\s*[dD](\d+)/.exec(input);
  if (dnd) {
    count = Math.max(1, Math.min(20, Number(dnd[1])));
    sides = Math.max(2, Math.min(1000, Number(dnd[2])));
    return { sides: sides, count: count };
  }
  const sidesMatch = /(\d+)\s*面/.exec(input);
  if (sidesMatch) sides = Math.max(2, Math.min(1000, Number(sidesMatch[1])));
  const countArabic = /(\d+)\s*(?:个|颗|次)/.exec(input);
  if (countArabic) count = Math.max(1, Math.min(20, Number(countArabic[1])));
  else {
    const countChinese = /([一二两三四五六七八九十]+)\s*(?:个|颗|次)/.exec(input);
    const parsed = labLlmChineseNumber(countChinese && countChinese[1]);
    if (parsed) count = Math.max(1, Math.min(20, parsed));
  }
  return { sides: sides, count: count };
}

function labLlmIsPickQ(input) {
  return /(帮我|给我|替我|帮忙)?\s*(选|挑|抽)\s*(一个|个|一下|哪|出)|随机选|随机挑|二选一|决定一下|选择困难|吃啥|吃什么/i.test(input);
}

function labLlmPickItems(input) {
  let text = String(input || '');
  const fromMatch = /从(.+?)(?:里|中|之间|当中|里面)?\s*(?:帮我|给我|替我|帮忙)?\s*(?:选|挑|抽)/.exec(text);
  if (fromMatch) text = fromMatch[1];
  else {
    const tail = /(?:选|挑|抽)(?:一个|个|一下)?[：:，,\s]*(.+)$/.exec(text);
    if (tail) text = tail[1];
  }
  let items = [];
  if (/还是/.test(text)) items = text.split(/还是/);
  else items = text.split(/[、,，;；\/]|\s+和\s+|\s+或\s+/);
  const cleaned = [];
  for (let i = 0; i < items.length && cleaned.length < 20; i += 1) {
    const item = labLlmTrimPunct(items[i])
      .replace(/^(帮我|给我|替我|帮忙|请|麻烦)?\s*(选|挑|抽)(一个|个)?/, '')
      .replace(/^(从|在)/, '')
      .replace(/(里|中|之间|当中|里面)$/, '')
      .replace(/(吧|呢|呗|啊)$/, '')
      .trim();
    if (item && cleaned.indexOf(item) < 0) cleaned.push(item);
  }
  return cleaned.length >= 2 ? cleaned : null;
}

function labLlmIsPasswordQ(input) {
  return /(生成|创建|来|做|给我).{0,8}密码|随机密码|password/i.test(input);
}

function labLlmPasswordArgs(input) {
  let length = 16;
  const match = /(\d{1,2})\s*位/.exec(input);
  if (match) length = Math.max(6, Math.min(64, Number(match[1])));
  const asciiOnly = /纯字母|只要字母|不要数字|不含数字/.test(input);
  const noSymbols = asciiOnly || /不要符号|不含符号|纯数字|只要数字/.test(input);
  const symbols = !noSymbols;
  const numbers = !(asciiOnly || /纯字母|只要字母/.test(input));
  return { length: length, numbers: numbers, symbols: symbols };
}

function labLlmUnitArgs(input) {
  const unitPattern = typeof LAB_UNIT_WORD_PATTERN === 'string' ? LAB_UNIT_WORD_PATTERN : '';
  if (!unitPattern) return null;
  const regex = new RegExp(
    '([-\\d.]+)\\s*(' + unitPattern + ')\\s*(?:等于|是|转成|换成|换算成|换算为|转|到|->|→|to)\\s*(?:多少)?\\s*(' + unitPattern + ')',
    'i',
  );
  const match = regex.exec(input);
  if (!match) return null;
  const value = Number(match[1]);
  if (!isFinite(value)) return null;
  return { value: value, from: match[2], to: match[3] };
}

/* ─────────────────────────────────────────────────────────────
 * 下一步决策（工具调用 / 最终回答）
 * ─────────────────────────────────────────────────────────────
 */
function labNextStep(ctx) {
  const input = labCleanText(ctx && ctx.input, LAB_MAX_INPUT_CHARS);
  const step = ctx && typeof ctx.step === 'number' && ctx.step > 0 ? ctx.step : 1;

  /* 已经执行过工具 → 根据工具结果继续 */
  if (ctx && ctx.lastTool && ctx.lastTool.name) return labLlmContinue(ctx, input);

  if (!input) return { type: 'final', text: LAB_LLM_EMPTY_TEXT };
  if (labLlmIsHelpQ(input)) return { type: 'final', text: LAB_LLM_HELP_TEXT };
  if (labLlmIsGreetingQ(input)) return { type: 'final', text: LAB_LLM_GREETING_TEXT };
  if (labLlmIsToolsQ(input)) return { type: 'final', text: LAB_LLM_TOOLS_TEXT };
  if (labLlmIsPrincipleQ(input)) return { type: 'final', text: LAB_LLM_PRINCIPLE_TEXT };
  if (labLlmIsForgetQ(input)) return { type: 'final', text: LAB_LLM_FORGET_TEXT };
  if (labLlmIsCompactQ(input)) return { type: 'final', text: labLlmCompactText(ctx) };

  /* 时间 → clock（可链式记住） */
  if (labLlmIsTimeQ(input)) return { type: 'tool_call', name: 'clock', args: { format: 'full' } };

  /* 算术 → calculator（可链式记住结果） */
  const expression = labLlmExtractExpression(input);
  if (expression) return { type: 'tool_call', name: 'calculator', args: { expression: expression } };

  /* 掷骰子 */
  if (labLlmIsDiceQ(input)) return { type: 'tool_call', name: 'dice_roll', args: labLlmDiceArgs(input) };

  /* 随机选择 */
  if (labLlmIsPickQ(input)) {
    const items = labLlmPickItems(input);
    if (items) return { type: 'tool_call', name: 'random_pick', args: { items: items } };
  }

  /* 生成密码 */
  if (labLlmIsPasswordQ(input)) return { type: 'tool_call', name: 'password_generate', args: labLlmPasswordArgs(input) };

  /* 单位换算 */
  const unit = labLlmUnitArgs(input);
  if (unit) return { type: 'tool_call', name: 'unit_convert', args: unit };

  /* 回忆 → memory_search */
  if (labLlmIsRecallQ(input)) {
    return { type: 'tool_call', name: 'memory_search', args: { query: labLlmRecallQuery(input) } };
  }

  /* 写入记忆 → memory_write */
  if (labLlmIsWriteQ(input)) {
    const memory = labLlmExtractMemory(input);
    if (!memory || !memory.key || !memory.value) {
      return {
        type: 'final',
        text: '要记什么？可以这样说：「记住 我的项目代号是 Orion」或「记住 截止日期 = 周五」。',
      };
    }
    return { type: 'tool_call', name: 'memory_write', args: { key: memory.key, value: memory.value } };
  }

  /* 兜底：承认规则模型、复述输入、结合召回记忆与示例 */
  return { type: 'final', text: labLlmFallbackText(ctx, input) };
}

/* 工具结果 → 下一步（最终回答或链式工具调用） */
function labLlmContinue(ctx, input) {
  const tool = ctx.lastTool || {};
  const args = (tool.args && typeof tool.args === 'object' ? tool.args : {}) || {};
  const result = tool.result && typeof tool.result === 'object' ? tool.result : {};
  const display = tool.display === null || tool.display === undefined ? '' : String(tool.display);
  const reason = display.replace(/^错误：/, '');
  const wantsSave = labLlmWantsSave(input);

  if (tool.name === 'calculator') {
    if (!tool.ok) {
      return {
        type: 'final',
        text: '这个表达式我算不出来：' + (reason || '计算失败') + '。可以换一个式子，比如 12+30。',
      };
    }
    if (wantsSave) {
      return { type: 'tool_call', name: 'memory_write', args: { key: '计算结果', value: display } };
    }
    const expression = args.expression ? String(args.expression) : '';
    const head = expression ? expression + ' = ' + display + '。' : display + '。';
    return {
      type: 'final',
      text: head + '这是 calculator 工具真实算出来的结果，我只负责决定调用它。',
    };
  }

  if (tool.name === 'clock') {
    if (!tool.ok) {
      return { type: 'final', text: '读取时间失败了：' + (reason || '未知原因') + '。' };
    }
    if (wantsSave) {
      return { type: 'tool_call', name: 'memory_write', args: { key: '当前时间', value: display } };
    }
    const weekday = result.weekday ? '（' + result.weekday + '）' : '';
    return { type: 'final', text: '现在是 ' + display + weekday + '。这是 clock 工具返回的本机时间。' };
  }

  const saveKeys = { dice_roll: '掷骰结果', random_pick: '随机选择', password_generate: '生成密码', unit_convert: '换算结果' };
  if (saveKeys[tool.name] && tool.ok && wantsSave) {
    return { type: 'tool_call', name: 'memory_write', args: { key: saveKeys[tool.name], value: display } };
  }

  if (tool.name === 'dice_roll') {
    if (!tool.ok) return { type: 'final', text: '骰子没掷成：' + (reason || '未知原因') + '。' };
    return { type: 'final', text: '🎲 掷出 ' + display + '。这是 dice_roll 工具真实生成的点数，我只是决定调用它。' };
  }

  if (tool.name === 'random_pick') {
    if (!tool.ok) return { type: 'final', text: '随机选择失败了：' + (reason || '未知原因') + '。' };
    return { type: 'final', text: '我选：' + display + '。要不要换个选项，或者再抽一次？' };
  }

  if (tool.name === 'password_generate') {
    if (!tool.ok) return { type: 'final', text: '密码生成失败了：' + (reason || '未知原因') + '。' };
    return { type: 'final', text: '生成好了：' + display + '。这只是本地随机生成，重要账号建议用密码管理器保存。' };
  }

  if (tool.name === 'unit_convert') {
    if (!tool.ok) return { type: 'final', text: '换算失败了：' + (reason || '未知原因') + '。' };
    return { type: 'final', text: display + '。这是 unit_convert 工具的实际换算结果。' };
  }

  if (tool.name === 'memory_write') {
    if (!tool.ok) {
      return { type: 'final', text: '保存记忆失败了：' + (reason || '未知原因') + '。' };
    }
    const key = result.key !== undefined ? result.key : args.key || '';
    const value = result.value !== undefined ? result.value : args.value || '';
    return {
      type: 'final',
      text: '已经记住：' + key + ' = ' + value + '。之后你问「' + key + '是什么」，我会用 memory_search 检索出来。',
    };
  }

  if (tool.name === 'memory_search') {
    if (!tool.ok) {
      return { type: 'final', text: '检索记忆失败了：' + (reason || '未知原因') + '。' };
    }
    const matches = Array.isArray(result.matches) ? result.matches : [];
    if (!matches.length) {
      return {
        type: 'final',
        text: '我这边没有找到相关记忆——你还没告诉过我，或者它已经被清空了。要不要现在「记住 …」一下？',
      };
    }
    const facts = matches
      .slice(0, 3)
      .map(function (item) {
        return item.key + ' = ' + item.value;
      })
      .join('；');
    return {
      type: 'final',
      text: '我记得：' + facts + '。这些是从长期记忆里检索到的，跨会话共享。',
    };
  }

  return { type: 'final', text: '工具 ' + tool.name + ' 返回：' + (display || '（空结果）') + '。' };
}

/* 压缩意图的回答：尽量给出真实的压缩前后对比 */
function labLlmCompactText(ctx) {
  const usage = (ctx && ctx.usage) || {};
  const used = typeof usage.used === 'number' ? usage.used : 0;
  const limit = typeof usage.limit === 'number' ? usage.limit : LAB_BUDGET;
  const compression = ctx && ctx.compression;
  if (compression && typeof compression.before === 'number' && typeof compression.after === 'number') {
    return (
      '最近一次压缩把上下文从 ' +
      compression.before +
      ' tok 降到 ' +
      compression.after +
      ' tok。超过预算 90% 会自动压缩：保留最近 ' +
      LAB_RECENT_KEEP +
      ' 条消息，其余折叠成摘要；也可以点「压缩」立即执行。'
    );
  }
  return (
    '当前上下文 ' +
    used +
    '/' +
    limit +
    ' tok，超过 90% 会自动压缩：保留最近 ' +
    LAB_RECENT_KEEP +
    ' 条消息，其余折叠成摘要。点「压缩」可立即执行，右侧检查器能看到前后对比。'
  );
}

/* 兜底回答：承认规则模型，复述输入，结合召回记忆给示例 */
function labLlmFallbackText(ctx, input) {
  const hits = ctx && Array.isArray(ctx.hits) ? ctx.hits : [];
  let head = '我是规则驱动的模拟模型，没完全理解「' + truncate(input, 18) + '」。';
  if (hits.length > 0) {
    const fact = hits[0];
    head += '我记得' + fact.key + ' = ' + fact.value + '。';
  }
  return head + '可以试试：「帮助」「算一下 (12+30)*3」「掷两个 20 面骰子」「从 火锅、烧烤、日料 里选一个」。';
}

/* ─────────────────────────────────────────────────────────────
 * 流式输出
 * ─────────────────────────────────────────────────────────────
 * 按字符分块；pace 控制块间隔（fast≈3ms / normal≈14ms / slow≈30ms），
 * 总时长压到 ~1.5s 以内。sleep / cancelled / onToken 全部由 engine 注入，
 * 便于测试注入 no-op sleep，也便于 dispose 时立刻停下。
 */
async function labStreamAnswer(text, opts) {
  const options = opts || {};
  const sleep = typeof options.sleep === 'function' ? options.sleep : null;
  const cancelled = typeof options.cancelled === 'function' ? options.cancelled : function () {
    return false;
  };
  const onToken = typeof options.onToken === 'function' ? options.onToken : function () {};
  const pace = labNormalizePace(options.pace);
  const base = LAB_PACE_DELAYS[pace] || LAB_PACE_DELAYS.normal;
  const chars = Array.from(String(text === null || text === undefined ? '' : text));
  if (!chars.length) return true;

  /* 最多 60 块，块越大节奏越稳 */
  const chunkSize = Math.max(1, Math.ceil(chars.length / 60));
  const chunks = [];
  for (let i = 0; i < chars.length; i += chunkSize) {
    chunks.push(chars.slice(i, i + chunkSize).join(''));
  }
  /* 保证总等待时间不超过约 1.5s */
  const interval = Math.max(1, Math.min(base, Math.floor(1500 / Math.max(1, chunks.length))));

  for (let i = 0; i < chunks.length; i += 1) {
    if (cancelled()) return false;
    if (sleep) await sleep(interval);
    if (cancelled()) return false;
    onToken(chunks[i], i === chunks.length - 1);
  }
  return true;
}
