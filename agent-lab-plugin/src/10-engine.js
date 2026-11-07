/* ── 10-engine.js · 会话 / 记忆 / 上下文 / 压缩 / 持久化 / createLab ──
 *
 * 这里实现插件里真正在跑的那个「迷你 Agent 引擎」：
 *   - 会话与 transcript（每会话独立消息、共享长期记忆）
 *   - 上下文组装：system + summary + memory + recent + input（token 预算真实计算）
 *   - 自动 / 手动压缩：把旧消息抽取式折叠进 summary
 *   - 一轮 turn 的 agent loop：input → context → (compress) → model ↔ tool → output
 *   - 事件订阅 + 不可变 snapshot（每次调用返回新对象，可安全交给 React）
 *   - storage 持久化（跨实例恢复）
 *
 * 约束：普通脚本；不直接访问 window/document；localStorage 通过注入的 adapter 访问，
 * 默认用 try/catch 保护 globalThis.localStorage，不可用时退化为内存 Map。
 */

/* ─────────────────────────────────────────────────────────────
 * storage 适配器
 * ─────────────────────────────────────────────────────────────
 * 优先使用 options.storage；否则尝试受保护的 globalThis.localStorage；
 * 隐私模式 / sandbox 中访问抛异常时退化为内存态。
 */
function labResolveStorage(provided) {
  if (provided && typeof provided.getItem === 'function' && typeof provided.setItem === 'function') {
    return provided;
  }
  try {
    const local = typeof globalThis !== 'undefined' ? globalThis.localStorage : null;
    if (local && typeof local.getItem === 'function' && typeof local.setItem === 'function') {
      const probe = '__dsh_agent_lab_probe__';
      local.setItem(probe, '1');
      if (typeof local.removeItem === 'function') local.removeItem(probe);
      return local;
    }
  } catch (err) {
    /* localStorage 不可用（隐私模式等）：静默退化为内存态 */
  }
  return labMemoryStorage();
}

function labMemoryStorage() {
  const data = Object.create(null);
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
    removeItem(key) {
      delete data[key];
    },
  };
}

/* ─────────────────────────────────────────────────────────────
 * createLab(options)
 * ─────────────────────────────────────────────────────────────
 */
function createLab(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const now = typeof opts.now === 'function' ? opts.now : function () {
    return Date.now();
  };
  const sleep =
    typeof opts.sleep === 'function'
      ? opts.sleep
      : function (ms) {
          return new Promise(function (resolve) {
            setTimeout(resolve, ms);
          });
        };
  const makeId = typeof opts.id === 'function' ? opts.id : uid;
  let budget =
    typeof opts.budget === 'number' && isFinite(opts.budget) && opts.budget >= 80
      ? Math.floor(opts.budget)
      : LAB_BUDGET;
  let budgetCustom = false;
  const storage = labResolveStorage(opts.storage);
  const listeners = [];
  /* 真实模型模式：adapter 由 Client 注入；provider/model 信息由 Client 查询后回填。 */
  let realAdapter = typeof opts.modelAdapter === 'function' ? opts.modelAdapter : null;
  const modelInfo = {
    provider: '',
    model: '',
    modelName: '',
    signedIn: null,
    available: null,
    contextWindow: null,
    maxOutputTokens: null,
    lastUsage: null,
    lastLatencyMs: null,
    lastError: null,
  };

  /* ── 会话 / 消息 / transcript 构造 ── */

  function makeLine(kind, text, extra) {
    const line = {
      id: makeId('l'),
      kind: kind,
      text: text === null || text === undefined ? '' : String(text),
      at: now(),
    };
    if (extra && extra.streaming) line.streaming = true;
    return line;
  }

  function makeMessage(role, content, extra) {
    const text = content === null || content === undefined ? '' : String(content);
    const message = {
      id: makeId('m'),
      role: role,
      content: text,
      tokens: estimateTokens(text) + LAB_MSG_OVERHEAD,
      at: now(),
    };
    if (extra) {
      if (extra.kind) message.kind = extra.kind;
      if (extra.toolName) message.toolName = extra.toolName;
      if (extra.toolCallId) message.toolCallId = extra.toolCallId;
      if (extra.toolArgs) message.toolArgs = extra.toolArgs;
      if (extra.turnId) message.turnId = extra.turnId;
    }
    return message;
  }

  function createEmptySummary() {
    return { keyPoints: [], openTasks: [], nextTask: '', folded: 0 };
  }

  function cloneSummary(summary) {
    const source = summary && typeof summary === 'object' ? summary : createEmptySummary();
    return {
      keyPoints: Array.isArray(source.keyPoints) ? source.keyPoints.slice(0, 8) : [],
      openTasks: Array.isArray(source.openTasks) ? source.openTasks.slice(0, 8) : [],
      nextTask: typeof source.nextTask === 'string' ? source.nextTask : '',
      folded: safeNonNegative(source.folded),
    };
  }

  function renderSummary(summary) {
    const value = summary || createEmptySummary();
    if (!value.keyPoints.length && !value.openTasks.length && !value.nextTask) return '';
    const lines = ['【关键内容】'];
    if (value.keyPoints.length) {
      for (let i = 0; i < value.keyPoints.length; i += 1) lines.push('- ' + value.keyPoints[i]);
    } else {
      lines.push('- （暂无）');
    }
    lines.push('【未完成任务】');
    if (value.openTasks.length) {
      for (let i = 0; i < value.openTasks.length; i += 1) lines.push('- ' + value.openTasks[i]);
    } else {
      lines.push('- （暂无）');
    }
    lines.push('【下一个任务】');
    lines.push(value.nextTask || '等待用户下一步指令');
    return lines.join('\n');
  }

  function summaryTokenCount(summary) {
    const text = renderSummary(summary);
    return text ? estimateTokens(text) + LAB_MSG_OVERHEAD : 0;
  }

  function trimSummaryObject(summary, cap) {
    const value = summary || createEmptySummary();
    let guard = 0;
    while (summaryTokenCount(value) > cap && guard < 200) {
      guard += 1;
      if (value.keyPoints.length) {
        value.keyPoints.shift();
      } else if (value.openTasks.length) {
        value.openTasks.shift();
      } else if (value.nextTask) {
        const tokens = estimateTokens(value.nextTask);
        value.nextTask = tokens <= 6 ? '' : labTruncateToTokens(value.nextTask, Math.max(4, tokens - 4));
      } else {
        break;
      }
    }
    if (summaryTokenCount(value) > cap) return createEmptySummary();
    return value;
  }

  function pushLimited(list, item, limit) {
    if (!item) return;
    for (let i = 0; i < list.length; i += 1) if (list[i] === item) return;
    list.push(item);
    while (list.length > limit) list.shift();
  }

  function summaryNoise(text) {
    return /^(你好|您好|hi|hello|帮助|\/help|工具|你有哪些工具|你是谁|讲讲你是怎么工作的)[\s!！。.～~]*$/i.test(text);
  }

  function summaryTaskLike(text) {
    if (summaryNoise(text)) return false;
    return /帮我|请|要|需要|把|计算|算|记住|记下|生成|换算|查|写|安排|处理|选|掷|密码|多少|是什么|怎么|如何|下一步|然后|待办|todo/i.test(text);
  }

  function summaryDone(text) {
    return /已经|已完成|完成了|好了|搞定|已记住|已保存|已生成|生成好了|我选|已换算|算好|记得|结果是/.test(text);
  }

  function summaryTaskLabel(text) {
    const first = String(text || '').split(/[。！？!?\n]/)[0];
    return truncate(labCleanText(first, 80), 42);
  }

  function makeSession() {
    const ts = now();
    return {
      id: makeId('s'),
      title: '新会话',
      createdAt: ts,
      updatedAt: ts,
      messages: [],
      transcript: [makeLine('banner', LAB_BANNER)],
      summary: createEmptySummary(),
      compressions: 0,
      turns: 0,
      context: null,
      lastTurn: null,
    };
  }

  function createStats() {
    return { turns: 0, toolCalls: 0, compressions: 0, tokensSaved: 0, totalTokens: 0 };
  }

  function activeSession() {
    for (let i = 0; i < state.sessions.length; i += 1) {
      if (state.sessions[i].id === state.activeId) return state.sessions[i];
    }
    return state.sessions[0] || null;
  }

  function busy() {
    return !!(state.turn && state.turn.status === 'running');
  }

  /* ── 持久化 ── */

  function safeNonNegative(value) {
    const number = Number(value);
    return isFinite(number) && number >= 0 ? number : 0;
  }

  function loadState() {
    let raw = null;
    try {
      raw = storage.getItem(LAB_STORAGE_KEY);
    } catch (err) {
      raw = null;
    }
    if (!raw) return null;
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      return null;
    }
    if (!data || !Array.isArray(data.sessions) || !data.sessions.length) return null;

    const sessions = [];
    for (let i = 0; i < data.sessions.length && sessions.length < LAB_MAX_SESSIONS; i += 1) {
      const rawSession = data.sessions[i];
      if (!rawSession || typeof rawSession.id !== 'string' || !rawSession.id) continue;
      const session = {
        id: rawSession.id,
        title: typeof rawSession.title === 'string' && rawSession.title ? rawSession.title : '新会话',
        createdAt: safeNonNegative(rawSession.createdAt) || now(),
        updatedAt: safeNonNegative(rawSession.updatedAt) || now(),
        messages: [],
        transcript: [],
        summary: createEmptySummary(),
        compressions: safeNonNegative(rawSession.compressions),
        turns: safeNonNegative(rawSession.turns),
        context: null,
        lastTurn: null,
      };
      /* 新格式：结构化 summary 对象；旧格式（summaryLines / 字符串）迁移为关键内容 */
      if (rawSession.summary && typeof rawSession.summary === 'object' && !Array.isArray(rawSession.summary)) {
        session.summary = cloneSummary(rawSession.summary);
      } else if (Array.isArray(rawSession.summaryLines)) {
        const points = [];
        for (let j = 0; j < rawSession.summaryLines.length; j += 1) {
          const text = rawSession.summaryLines[j];
          if (typeof text === 'string' && text) points.push(truncate(text, 60));
        }
        session.summary = { keyPoints: points.slice(-6), openTasks: [], nextTask: '继续回答用户最近的问题', folded: points.length };
      } else if (typeof rawSession.summary === 'string' && rawSession.summary) {
        session.summary = { keyPoints: rawSession.summary.split('；').filter(function (line) { return line; }).slice(-6), openTasks: [], nextTask: '继续回答用户最近的问题', folded: 0 };
      }
      session.summary = trimSummaryObject(session.summary, Math.max(32, Math.floor(budget * LAB_SUMMARY_TOKEN_RATIO)));

      const rawMessages = Array.isArray(rawSession.messages)
        ? rawSession.messages.slice(-LAB_MAX_MESSAGES)
        : [];
      for (let j = 0; j < rawMessages.length; j += 1) {
        const rawMessage = rawMessages[j];
        if (!rawMessage || typeof rawMessage.content !== 'string') continue;
        const role =
          ['user', 'assistant', 'tool', 'system'].indexOf(rawMessage.role) >= 0 ? rawMessage.role : 'assistant';
        const message = {
          id: typeof rawMessage.id === 'string' && rawMessage.id ? rawMessage.id : makeId('m'),
          role: role,
          content: rawMessage.content,
          tokens: estimateTokens(rawMessage.content) + LAB_MSG_OVERHEAD,
          at: safeNonNegative(rawMessage.at) || now(),
        };
        if (typeof rawMessage.kind === 'string' && rawMessage.kind) message.kind = rawMessage.kind;
        if (typeof rawMessage.toolName === 'string' && rawMessage.toolName) message.toolName = rawMessage.toolName;
        if (typeof rawMessage.toolCallId === 'string' && rawMessage.toolCallId) message.toolCallId = rawMessage.toolCallId;
        if (typeof rawMessage.toolArgs === 'string' && rawMessage.toolArgs) message.toolArgs = rawMessage.toolArgs;
        session.messages.push(message);
      }

      const rawLines = Array.isArray(rawSession.transcript)
        ? rawSession.transcript.slice(-LAB_MAX_TRANSCRIPT)
        : [];
      for (let j = 0; j < rawLines.length; j += 1) {
        const rawLine = rawLines[j];
        if (!rawLine || typeof rawLine.text !== 'string') continue;
        session.transcript.push({
          id: typeof rawLine.id === 'string' && rawLine.id ? rawLine.id : makeId('l'),
          kind: typeof rawLine.kind === 'string' && rawLine.kind ? rawLine.kind : 'info',
          text: rawLine.text,
          at: safeNonNegative(rawLine.at) || now(),
        });
      }
      if (!session.transcript.length) session.transcript.push(makeLine('banner', LAB_BANNER));

      sessions.push(session);
    }
    if (!sessions.length) return null;

    const memory = [];
    const rawMemory = Array.isArray(data.memory) ? data.memory : [];
    for (let i = 0; i < rawMemory.length && memory.length < LAB_MEMORY_LIMIT; i += 1) {
      const rawItem = rawMemory[i];
      if (!rawItem || typeof rawItem.key !== 'string' || typeof rawItem.value !== 'string') continue;
      if (!rawItem.key || !rawItem.value) continue;
      memory.push({
        id: typeof rawItem.id === 'string' && rawItem.id ? rawItem.id : makeId('mem'),
        key: rawItem.key,
        value: rawItem.value,
        source: typeof rawItem.source === 'string' && rawItem.source ? rawItem.source : '对话',
        sessionId: typeof rawItem.sessionId === 'string' ? rawItem.sessionId : '',
        createdAt: safeNonNegative(rawItem.createdAt) || now(),
        updatedAt: safeNonNegative(rawItem.updatedAt) || now(),
      });
    }

    const rawStats = data.stats && typeof data.stats === 'object' ? data.stats : {};
    const stats = {
      turns: safeNonNegative(rawStats.turns),
      toolCalls: safeNonNegative(rawStats.toolCalls),
      compressions: safeNonNegative(rawStats.compressions),
      tokensSaved: safeNonNegative(rawStats.tokensSaved),
      totalTokens: safeNonNegative(rawStats.totalTokens),
    };

    const activeId = sessions.some(function (session) {
      return session.id === data.activeId;
    })
      ? data.activeId
      : sessions[0].id;

    return {
      pace: labNormalizePace(data.pace),
      modelMode: data.modelMode === 'real' ? 'real' : 'sim',
      budget: Number.isFinite(data.budget) ? data.budget : LAB_BUDGET,
      budgetCustom: data.budgetCustom === true,
      activeId: activeId,
      sessions: sessions,
      memory: memory,
      stats: stats,
      turn: null,
      streaming: null,
      lastInput: typeof data.lastInput === 'string' ? data.lastInput : '',
      lastCompression: null,
      disposed: false,
    };
  }

  function persist() {
    if (state.disposed) return;
    const payload = {
      v: 1,
      pace: state.pace,
      modelMode: state.modelMode,
      budget: budget,
      budgetCustom: budgetCustom,
      activeId: state.activeId,
      lastInput: state.lastInput,
      stats: {
        turns: state.stats.turns,
        toolCalls: state.stats.toolCalls,
        compressions: state.stats.compressions,
        tokensSaved: state.stats.tokensSaved,
        totalTokens: state.stats.totalTokens,
      },
      memory: state.memory.map(function (item) {
        return {
          id: item.id,
          key: item.key,
          value: item.value,
          source: item.source,
          sessionId: item.sessionId,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      }),
      sessions: state.sessions.map(function (session) {
        return {
          id: session.id,
          title: session.title,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          compressions: session.compressions,
          turns: session.turns,
          summary: cloneSummary(session.summary),
          messages: session.messages.slice(-LAB_MAX_MESSAGES).map(snapshotMessage),
          transcript: session.transcript.slice(-LAB_MAX_TRANSCRIPT).map(snapshotLine),
        };
      }),
    };
    try {
      storage.setItem(LAB_STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      /* 存储写满 / 被禁用时静默失败，引擎继续工作 */
    }
  }

  /* ── 初始状态 ── */

  const loaded = loadState();
  const state = loaded || {
    pace: labNormalizePace(opts.pace),
    modelMode: 'sim',
    activeId: '',
    sessions: [],
    memory: [],
    stats: createStats(),
    turn: null,
    streaming: null,
    lastInput: '',
    lastCompression: null,
    disposed: false,
  };
  if (loaded && loaded.budgetCustom === true && Number.isFinite(loaded.budget)) {
    const savedBudget = Math.floor(loaded.budget);
    if (savedBudget >= 800 && savedBudget <= 1048576) {
      budget = savedBudget;
      budgetCustom = true;
    }
  }
  state.disposed = false;
  state.turn = null; /* 上一轮 turn 不持久化：重建后从空闲开始 */
  state.streaming = null;
  state.lastCompression = null;
  if (state.modelMode !== 'real') state.modelMode = 'sim';
  if (!Array.isArray(state.memory)) state.memory = [];
  if (!state.stats) state.stats = createStats();
  if (!state.sessions.length) {
    const firstSession = makeSession();
    state.sessions = [firstSession];
    state.activeId = firstSession.id;
  }
  if (state.pace !== 'fast' && state.pace !== 'normal' && state.pace !== 'slow') state.pace = 'normal';
  for (let i = 0; i < state.sessions.length; i += 1) {
    if (!state.sessions[i].context) {
      state.sessions[i].context = assembleContext(state.sessions[i], '', {}).context;
    }
  }
  if (!activeSession()) state.activeId = state.sessions[0].id;

  /* ── 事件 ── */

  function emit(type, payload) {
    if (state.disposed) return;
    if (!listeners.length) return;
    const event = { type: type };
    if (payload && typeof payload === 'object') {
      const keys = Object.keys(payload);
      for (let i = 0; i < keys.length; i += 1) event[keys[i]] = payload[keys[i]];
    }
    for (let i = 0; i < listeners.length; i += 1) {
      try {
        listeners[i](event);
      } catch (err) {
        /* UI 回调异常不能影响引擎 */
      }
    }
  }

  function onEvent(fn) {
    if (typeof fn !== 'function') return function () {};
    listeners.push(fn);
    return function unsubscribe() {
      const index = listeners.indexOf(fn);
      if (index >= 0) listeners.splice(index, 1);
    };
  }

  /* ── transcript / message 追加 ── */

  function pushTranscript(session, line) {
    session.transcript.push(line);
    while (session.transcript.length > LAB_MAX_TRANSCRIPT) session.transcript.shift();
    session.updatedAt = now();
  }

  function appendMessage(session, role, content, extra) {
    const message = makeMessage(role, content, extra);
    session.messages.push(message);
    while (session.messages.length > LAB_MAX_MESSAGES) session.messages.shift();
    session.updatedAt = now();
    emit('message');
    return message;
  }

  function appendInfoLine(session, text) {
    const line = makeLine('info', text);
    pushTranscript(session, line);
    emit('line');
    return line;
  }

  /* ─────────────────────────────────────────────────────────────
   * 长期记忆
   * ─────────────────────────────────────────────────────────────
   */

  function memoryWords(text) {
    const source = String(text || '').toLowerCase();
    const words = [];
    const latin = source.match(/[a-z0-9_]{2,}/g) || [];
    for (let i = 0; i < latin.length; i += 1) words.push(latin[i]);
    const chunks = source.replace(/[^\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef]+/g, ' ').split(/\s+/);
    const stop = {
      什么: 1,
      怎么: 1,
      我的: 1,
      你的: 1,
      一下: 1,
      记住: 1,
      记忆: 1,
      记得: 1,
      告诉: 1,
      请问: 1,
      帮我: 1,
      现在: 1,
      这个: 1,
      那个: 1,
      多少: 1,
      还是: 1,
    };
    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      if (!chunk) continue;
      if (chunk.length >= 2) words.push(chunk);
      if (chunk.length >= 3) {
        for (let j = 0; j + 2 <= chunk.length; j += 1) words.push(chunk.slice(j, j + 2));
      }
    }
    const seen = Object.create(null);
    const unique = [];
    for (let i = 0; i < words.length; i += 1) {
      const word = words[i];
      if (!word || word.length < 2) continue;
      if (stop[word]) continue;
      if (seen[word]) continue;
      seen[word] = true;
      unique.push(word);
    }
    return unique;
  }

  function memoryScore(item, text, words) {
    const haystack = String(text || '').toLowerCase();
    const key = String(item.key || '').toLowerCase();
    const value = String(item.value || '').toLowerCase();
    let score = 0;
    if (key && haystack.indexOf(key) >= 0) score += 6;
    if (key && words.indexOf(key) >= 0) score += 4;
    for (let i = 0; i < words.length; i += 1) {
      const word = words[i];
      if (!word) continue;
      if (key.indexOf(word) >= 0) score += 3;
      else if (value.indexOf(word) >= 0) score += 1;
    }
    if (value && haystack.indexOf(value) >= 0) score += 2;
    return score;
  }

  function recallMemory(input) {
    const text = labCleanText(input, 200);
    if (!text || !state.memory.length) return [];
    const words = memoryWords(text);
    const scored = [];
    for (let i = 0; i < state.memory.length; i += 1) {
      const score = memoryScore(state.memory[i], text, words);
      if (score > 0) scored.push({ score: score, item: state.memory[i] });
    }
    scored.sort(function (a, b) {
      return b.score - a.score || b.item.updatedAt - a.item.updatedAt;
    });
    return scored.slice(0, 3).map(function (entry) {
      return entry.item;
    });
  }

  function plainMemory(item) {
    return {
      id: item.id,
      key: item.key,
      value: item.value,
      source: item.source,
      sessionId: item.sessionId,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  function searchMemory(query) {
    const text = labCleanText(query, 120);
    if (!state.memory.length) return [];
    if (!text) {
      return state.memory
        .slice()
        .sort(function (a, b) {
          return b.updatedAt - a.updatedAt;
        })
        .slice(0, 5)
        .map(plainMemory);
    }
    const words = memoryWords(text);
    const scored = [];
    for (let i = 0; i < state.memory.length; i += 1) {
      const score = memoryScore(state.memory[i], text, words);
      if (score > 0) scored.push({ score: score, item: state.memory[i] });
    }
    scored.sort(function (a, b) {
      return b.score - a.score || b.item.updatedAt - a.item.updatedAt;
    });
    return scored.slice(0, 3).map(function (entry) {
      return plainMemory(entry.item);
    });
  }

  function writeMemory(record) {
    const source = record && typeof record === 'object' ? record : {};
    const key = labCleanText(source.key, 40);
    const value = labCleanText(source.value, 240);
    if (!key || !value) return null;
    const timestamp = now();
    let item = null;
    for (let i = 0; i < state.memory.length; i += 1) {
      if (state.memory[i].key === key) {
        item = state.memory[i];
        break;
      }
    }
    if (item) {
      item.value = value;
      item.updatedAt = timestamp;
      if (source.source) item.source = source.source;
      if (source.sessionId) item.sessionId = source.sessionId;
    } else {
      item = {
        id: makeId('mem'),
        key: key,
        value: value,
        source: source.source || '对话',
        sessionId: source.sessionId || state.activeId,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      state.memory.push(item);
      while (state.memory.length > LAB_MEMORY_LIMIT) state.memory.shift();
    }
    emit('memory');
    persist();
    return { id: item.id, key: item.key, value: item.value };
  }

  function deleteMemory(id) {
    let index = -1;
    for (let i = 0; i < state.memory.length; i += 1) {
      if (state.memory[i].id === id) {
        index = i;
        break;
      }
    }
    if (index < 0) return false;
    state.memory.splice(index, 1);
    emit('memory');
    persist();
    return true;
  }

  function clearMemory() {
    const count = state.memory.length;
    state.memory = [];
    emit('memory');
    persist();
    return count;
  }

  /* ─────────────────────────────────────────────────────────────
   * 上下文组装
   * ─────────────────────────────────────────────────────────────
   * 返回 { context, modelMessages, hits, summaryText, recent, input, used, limit }。
   * context.used 严格等于 segments 的 token 之和。
   */

  function assembleContext(session, rawInput, options) {
    const settings = options || {};
    const excludeIds = Array.isArray(settings.excludeIds) ? settings.excludeIds : [];
    const inputRaw = labCleanText(rawInput, LAB_MAX_INPUT_CHARS);
    const hitsAll = Array.isArray(settings.hits) ? settings.hits.slice(0, 3) : recallMemory(inputRaw);
    const candidates = [];
    for (let i = 0; i < session.messages.length; i += 1) {
      const message = session.messages[i];
      if (excludeIds.indexOf(message.id) >= 0) continue;
      candidates.push(message);
    }

    let systemText = LAB_SYSTEM_PROMPT;
    let summary = cloneSummary(session.summary);
    let hits = hitsAll.slice(0, 3);
    let modelInput = inputRaw;
    let recent = candidates.slice();

    /* rawUsed：未裁剪前真正想塞给模型的总量。压缩阈值看它，
     * context.used 则始终限制在预算内（局部裁剪后模型实际看到的量）。 */
    let rawUsed = estimateTokens(systemText) + LAB_MSG_OVERHEAD;
    const fullSummaryText = renderSummary(summary);
    if (fullSummaryText) rawUsed += estimateTokens(fullSummaryText) + LAB_MSG_OVERHEAD;
    for (let i = 0; i < hitsAll.length && i < 3; i += 1) {
      rawUsed += estimateTokens('记忆：' + hitsAll[i].key + ' = ' + hitsAll[i].value) + LAB_MSG_OVERHEAD;
    }
    for (let i = 0; i < candidates.length; i += 1) {
      rawUsed += candidates[i].tokens || estimateTokens(candidates[i].content) + LAB_MSG_OVERHEAD;
    }
    if (inputRaw) rawUsed += estimateTokens(inputRaw) + LAB_MSG_OVERHEAD;

    function measure() {
      const summaryText = renderSummary(summary);
      const systemTokens = estimateTokens(systemText) + LAB_MSG_OVERHEAD;
      const summaryTokens = summaryText ? estimateTokens(summaryText) + LAB_MSG_OVERHEAD : 0;
      let memoryTokens = 0;
      for (let i = 0; i < hits.length; i += 1) {
        memoryTokens += estimateTokens('记忆：' + hits[i].key + ' = ' + hits[i].value) + LAB_MSG_OVERHEAD;
      }
      let recentTokens = 0;
      for (let i = 0; i < recent.length; i += 1) {
        recentTokens += recent[i].tokens || estimateTokens(recent[i].content) + LAB_MSG_OVERHEAD;
      }
      const inputTokens = modelInput ? estimateTokens(modelInput) + LAB_MSG_OVERHEAD : 0;
      const used = systemTokens + summaryTokens + memoryTokens + recentTokens + inputTokens;
      return {
        systemTokens: systemTokens,
        summaryTokens: summaryTokens,
        memoryTokens: memoryTokens,
        recentTokens: recentTokens,
        inputTokens: inputTokens,
        used: used,
        summaryText: summaryText,
      };
    }

    let measured = measure();

    /* 极小 budget 兜底：先裁剪 system prompt */
    if (measured.used > budget && measured.systemTokens > budget) {
      systemText = labTruncateToTokens(LAB_SYSTEM_PROMPT, Math.max(8, budget - LAB_MSG_OVERHEAD));
      measured = measure();
    }
    /* 再从最旧的消息开始缩小「模型视图」（session.messages 本身不变），
     * 优先保留压缩后的摘要，避免摘要数字来回跳动 */
    while (measured.used > budget && recent.length > 0) {
      recent.shift();
      measured = measure();
    }
    /* 仍超预算时再精简摘要：先丢最旧的关键内容，再丢未完成任务，最后缩短下一步 */
    let summaryGuard = 0;
    while (measured.used > budget && summaryGuard < 200) {
      summaryGuard += 1;
      if (summary.keyPoints.length) {
        summary.keyPoints.shift();
      } else if (summary.openTasks.length) {
        summary.openTasks.shift();
      } else if (summary.nextTask) {
        const tokens = estimateTokens(summary.nextTask);
        summary.nextTask = tokens <= 6 ? '' : labTruncateToTokens(summary.nextTask, Math.max(4, tokens - 4));
      } else {
        break;
      }
      measured = measure();
    }
    /* 再减少召回的记忆条数 */
    while (measured.used > budget && hits.length > 0) {
      hits = hits.slice(0, hits.length - 1);
      measured = measure();
    }
    /* 最后裁剪本轮输入 */
    if (measured.used > budget) {
      const other = measured.used - measured.inputTokens;
      const maxInput = budget - other - LAB_MSG_OVERHEAD;
      modelInput = maxInput > 0 ? labTruncateToTokens(inputRaw, maxInput) : '';
      measured = measure();
    }
    /* 极端兜底：清空摘要与记忆，只保留 system + 极短输入 */
    if (measured.used > budget) {
      summary = createEmptySummary();
      hits = [];
      const maxInput = budget - measured.systemTokens - LAB_MSG_OVERHEAD;
      modelInput = maxInput > 0 ? labTruncateToTokens(inputRaw, maxInput) : '';
      measured = measure();
    }

    const segments = [
      { id: 'system', label: '系统提示', tokens: measured.systemTokens },
      { id: 'summary', label: '历史摘要', tokens: measured.summaryTokens },
      { id: 'memory', label: '长期记忆', tokens: measured.memoryTokens },
      { id: 'recent', label: '最近消息', tokens: measured.recentTokens },
      { id: 'input', label: '本轮输入', tokens: measured.inputTokens },
    ];

    const modelMessages = [];
    modelMessages.push({ role: 'system', content: systemText });
    if (measured.summaryText) {
      modelMessages.push({ role: 'system', content: '【历史摘要】\n' + measured.summaryText });
    }
    if (hits.length) {
      const hitLines = [];
      for (let i = 0; i < hits.length; i += 1) hitLines.push('- ' + hits[i].key + '：' + hits[i].value);
      modelMessages.push({ role: 'system', content: '【长期记忆】\n' + hitLines.join('\n') });
    }
    /* 当前轮已经产生的 assistant/tool 消息必须排在本轮用户输入之后：
     * 真实 LLM 的 tool-call 协议要求 user → assistant(tool_calls) → tool。
     * 之前的实现把 input 统一追加在末尾，会得到 assistant → tool → user 的非法顺序。 */
    const currentTurnId = typeof settings.turnId === 'string' ? settings.turnId : '';
    let currentTurnStart = recent.length;
    if (currentTurnId) {
      for (let i = 0; i < recent.length; i += 1) {
        if (recent[i].turnId === currentTurnId) {
          currentTurnStart = i;
          break;
        }
      }
    }
    function pushModelMessage(message) {
      const entry = { role: message.role, content: message.content };
      if (message.toolName) entry.toolName = message.toolName;
      if (message.kind === 'tool_call') {
        entry.kind = 'tool_call';
        if (message.toolCallId) entry.toolCallId = message.toolCallId;
        if (message.toolArgs) entry.toolArgs = message.toolArgs;
      }
      if (message.role === 'tool' && message.toolCallId) entry.toolCallId = message.toolCallId;
      modelMessages.push(entry);
    }
    for (let i = 0; i < currentTurnStart; i += 1) pushModelMessage(recent[i]);
    if (modelInput) modelMessages.push({ role: 'user', content: modelInput });
    for (let i = currentTurnStart; i < recent.length; i += 1) pushModelMessage(recent[i]);

    const context = {
      limit: budget,
      used: measured.used,
      segments: segments,
      hits: hits.map(function (hit) {
        return { id: hit.id, key: hit.key, value: hit.value };
      }),
      summary: measured.summaryText || null,
      messageCount: recent.length,
    };

    return {
      context: context,
      modelMessages: modelMessages,
      hits: hits,
      summaryText: measured.summaryText,
      recent: recent,
      input: modelInput,
      used: measured.used,
      rawUsed: Math.max(measured.used, rawUsed),
      limit: budget,
    };
  }

  /* ─────────────────────────────────────────────────────────────
   * 压缩
   * ─────────────────────────────────────────────────────────────
   */

  /* 把被折叠的消息抽取成结构化摘要：
   * 关键内容（用户意图 / 助手结论 / 工具结果）、未完成任务、下一个任务。
   * 这是启发式总结：模型只看到结果，不会看到这些抽取规则本身。 */
  function foldIntoSummary(session, messages) {
    const summary = cloneSummary(session.summary);
    for (let i = 0; i < messages.length; i += 1) {
      const message = messages[i];
      const content = String(message.content || '');
      if (message.role === 'user') {
        const clean = labCleanText(content, 120);
        if (clean && !summaryNoise(clean)) {
          pushLimited(summary.keyPoints, '用户：' + truncate(clean, 38), 5);
          if (summaryTaskLike(clean)) pushLimited(summary.openTasks, summaryTaskLabel(clean), 4);
        }
      } else if (message.role === 'assistant' && (message.kind === 'final' || message.kind === undefined)) {
        const clean = labCleanText(content, 160);
        if (clean) {
          pushLimited(summary.keyPoints, '助手：' + truncate(clean, 42), 5);
          /* 一个任务通常由同一轮助手回答结束：普通回答 → 视为完成；
           * 助手反问 / 要求用户补充 → 保留在「未完成任务」里；
           * 用户明确说了「还没/待办/下一步/稍后」的任务也保留。 */
          if (summary.openTasks.length) {
            const lastTask = summary.openTasks[summary.openTasks.length - 1];
            const explicitPending = /还没|待办|下一步|之后|稍后|明天|提醒我|等我|先别/.test(lastTask);
            const asksBack = /[？?]|吗|要不要|是否需要|请告诉我|你想|可以吗|还是/.test(clean);
            if (!explicitPending && (summaryDone(clean) || !asksBack)) summary.openTasks.pop();
          }
        }
      } else if (message.role === 'tool') {
        const clean = labCleanText(content, 100);
        if (clean) pushLimited(summary.keyPoints, '工具 ' + (message.toolName || '执行') + '：' + truncate(clean, 28), 5);
      }
    }
    summary.folded += messages.length;
    summary.nextTask = summary.openTasks.length
      ? summary.openTasks[summary.openTasks.length - 1]
      : (summary.keyPoints.length ? '继续回答用户最近的问题' : '等待用户下一步指令');
    session.summary = trimSummaryObject(summary, Math.max(32, Math.floor(budget * LAB_SUMMARY_TOKEN_RATIO)));
    return messages.length;
  }

  /* 任务可能在「折叠边界」被拆开：任务进了摘要，回答还留在最近消息里。
   * 用最近消息里的助手最终回答回补一次，避免把已完成任务误报为未完成。 */
  function reconcileSummaryTasks(session) {
    if (!session.summary || !session.summary.openTasks.length) return;
    for (let i = session.messages.length - 1; i >= 0; i -= 1) {
      const message = session.messages[i];
      if (message.role !== 'assistant' || (message.kind !== 'final' && message.kind !== undefined)) continue;
      const text = String(message.content || '');
      const lastTask = session.summary.openTasks[session.summary.openTasks.length - 1];
      const explicitPending = /还没|待办|下一步|之后|稍后|明天|提醒我|等我|先别/.test(lastTask);
      const asksBack = /[？?]|吗|要不要|是否需要|请告诉我|你想|可以吗|还是/.test(text);
      if (!explicitPending && !asksBack) session.summary.openTasks.pop();
      break;
    }
    session.summary.nextTask = session.summary.openTasks.length
      ? session.summary.openTasks[session.summary.openTasks.length - 1]
      : '继续回答用户最近的问题';
  }

  function compressSession(session, options) {
    const settings = options || {};
    const turn = settings.turn || null;
    const input = settings.input || '';
    const manual = !!settings.manual;
    const excludeIds = turn && turn.inputMessageId ? [turn.inputMessageId] : [];
    const beforeAsm = assembleContext(session, input, { excludeIds: excludeIds });

    let keepCount = LAB_RECENT_KEEP;
    if (manual && session.messages.length <= LAB_RECENT_KEEP) {
      keepCount = Math.max(1, Math.floor(session.messages.length / 2));
    }
    const keepStart = Math.max(0, session.messages.length - keepCount);
    const fold = [];
    for (let i = 0; i < session.messages.length; i += 1) {
      const message = session.messages[i];
      const isCurrentTurnMessage = turn && message.turnId === turn.id;
      /* 保留最近消息；一轮 turn 内的消息不在轮内被折叠 */
      if (i >= keepStart || isCurrentTurnMessage) continue;
      fold.push(message);
    }
    if (!fold.length) {
      return { compressed: false, before: Math.max(beforeAsm.used, beforeAsm.rawUsed), after: Math.max(beforeAsm.used, beforeAsm.rawUsed), folded: 0, context: beforeAsm.context };
    }

    /* 先记下折叠前的状态：如果压缩不能真实降低上下文需求，就回滚，
     * 避免出现「418 → 386」「419 → 418」这类没有意义的压缩记录 */
    const messagesBefore = session.messages.slice();
    const summaryBefore = cloneSummary(session.summary);

    const folded = foldIntoSummary(session, fold);
    reconcileSummaryTasks(session);
    const foldIds = [];
    for (let i = 0; i < fold.length; i += 1) foldIds.push(fold[i].id);
    session.messages = session.messages.filter(function (message) {
      return foldIds.indexOf(message.id) < 0;
    });

    let afterAsm = assembleContext(session, input, { excludeIds: excludeIds });
    /* 压缩后若仍高于目标水位，继续精简摘要，避免下一轮立刻再次压缩 */
    let guard = 0;
    while (afterAsm.context.used > budget * LAB_COMPRESS_TARGET_RATIO && guard < 60) {
      guard += 1;
      const summary = session.summary || createEmptySummary();
      if (summary.keyPoints.length) summary.keyPoints.shift();
      else if (summary.openTasks.length) summary.openTasks.shift();
      else if (summary.nextTask) {
        const tokens = estimateTokens(summary.nextTask);
        summary.nextTask = tokens <= 6 ? '' : labTruncateToTokens(summary.nextTask, Math.max(4, tokens - 4));
      } else break;
      session.summary = trimSummaryObject(summary, Math.max(32, Math.floor(budget * LAB_SUMMARY_TOKEN_RATIO)));
      afterAsm = assembleContext(session, input, { excludeIds: excludeIds });
    }

    /* before / after 都按「未裁剪的真实上下文需求」计，保证 after < before 才记录 */
    const before = Math.max(beforeAsm.used, beforeAsm.rawUsed);
    const after = Math.max(afterAsm.used, afterAsm.rawUsed);
    if (after >= before) {
      session.messages = messagesBefore;
      session.summary = summaryBefore;
      session.context = beforeAsm.context;
      return { compressed: false, before: before, after: before, folded: 0, context: beforeAsm.context };
    }

    session.context = afterAsm.context;
    session.compressions += 1;
    state.stats.compressions += 1;
    state.stats.tokensSaved += Math.max(0, before - after);
    state.lastCompression = { before: before, after: after, folded: folded, at: now() };

    /* 注意：TUI 会按 kind 加行首符号（⇣），所以 transcript.text 保持纯文本 */
    pushTranscript(session, makeLine('compress', '上下文已压缩 · ' + before + ' → ' + after + ' tok'));
    emit('compression');
    emit('line');
    if (turn && !settings.silentStage) {
      const stage = beginStage(turn, 'compress', '压缩上下文', before + ' → ' + after + ' tok', {
        before: before,
        after: after,
        folded: folded,
        /* inspector（60-inspector.js）读的是 removed；folded 留给其它消费者 */
        removed: folded,
        keep: session.messages.length,
        limit: budget,
        reason: manual ? 'manual' : 'auto',
        summary: afterAsm.context.summary,
      });
      endStage(stage);
    }
    session.updatedAt = now();
    return { compressed: true, before: before, after: after, folded: folded, context: afterAsm.context };
  }

  function maybeAutoCompress(session, turn, input, asm) {
    let current = asm;
    let attempts = 0;
    while (
      (current.rawUsed > budget * LAB_COMPRESS_RATIO || current.context.used > budget * LAB_COMPRESS_RATIO) &&
      attempts < 2
    ) {
      attempts += 1;
      const result = compressSession(session, { turn: turn, input: input, manual: false });
      if (!result.compressed) break;
      current = assembleContext(session, input, {
        excludeIds: turn && turn.inputMessageId ? [turn.inputMessageId] : [],
      });
      session.context = current.context;
      emit('context');
    }
    return current;
  }

  /* 一轮结束就检查：已超过 90% 预算时立即折叠历史，
   * 而不是等用户再发一条消息。这样底部的百分比不会长期停在 90%+。 */
  function maybeCompressAfterTurn(session, turn, input) {
    const used = session.context ? session.context.used : 0;
    if (used <= budget * LAB_COMPRESS_RATIO) return;
    compressSession(session, { turn: turn, input: input, manual: false, silentStage: true });
  }

  /* ─────────────────────────────────────────────────────────────
   * snapshot（每次返回全新对象）
   * ─────────────────────────────────────────────────────────────
   */

  function snapshotSession(session) {
    let tokens = 0;
    for (let i = 0; i < session.messages.length; i += 1) tokens += session.messages[i].tokens;
    return {
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messageCount: session.messages.length,
      tokens: tokens,
      compressions: session.compressions,
      turns: session.turns,
    };
  }

  function snapshotMessage(message) {
    const out = {
      id: message.id,
      role: message.role,
      content: message.content,
      tokens: message.tokens,
      at: message.at,
    };
    if (message.kind) out.kind = message.kind;
    if (message.toolName) out.toolName = message.toolName;
    if (message.toolCallId) out.toolCallId = message.toolCallId;
    if (message.toolArgs) out.toolArgs = message.toolArgs;
    return out;
  }

  function snapshotLine(line) {
    const out = { id: line.id, kind: line.kind, text: line.text, at: line.at };
    if (line.streaming) out.streaming = true;
    return out;
  }

  function snapshotContext(session) {
    const context =
      session && session.context
        ? session.context
        : { limit: budget, used: 0, segments: [], hits: [], summary: null, messageCount: 0 };
    return {
      limit: context.limit,
      used: context.used,
      segments: context.segments.map(function (segment) {
        return { id: segment.id, label: segment.label, tokens: segment.tokens };
      }),
      hits: context.hits.map(function (hit) {
        return { id: hit.id, key: hit.key, value: hit.value };
      }),
      summary: context.summary,
      messageCount: context.messageCount,
    };
  }

  function snapshotTurn(turn) {
    return {
      id: turn.id,
      input: turn.input,
      status: turn.status,
      startedAt: turn.startedAt,
      endedAt: turn.endedAt,
      stages: turn.stages.map(function (stage) {
        return {
          id: stage.id,
          kind: stage.kind,
          title: stage.title,
          meta: stage.meta,
          status: stage.status,
          detail: labClone(stage.detail),
          at: stage.at,
        };
      }),
    };
  }

  function snapshot() {
    const session = activeSession();
    const turn = state.turn;
    return {
      busy: busy(),
      pace: state.pace,
      modelMode: state.modelMode,
      model: {
        provider: modelInfo.provider,
        model: modelInfo.model,
        modelName: modelInfo.modelName,
        signedIn: modelInfo.signedIn,
        available: modelInfo.available,
        contextWindow: modelInfo.contextWindow,
        maxOutputTokens: modelInfo.maxOutputTokens,
        lastUsage: modelInfo.lastUsage,
        lastLatencyMs: modelInfo.lastLatencyMs,
        lastError: modelInfo.lastError,
      },
      activeId: session ? session.id : '',
      sessions: state.sessions.map(snapshotSession),
      messages: session ? session.messages.map(snapshotMessage) : [],
      transcript: session ? session.transcript.map(snapshotLine) : [],
      memory: state.memory.map(plainMemory),
      context: snapshotContext(session),
      turn: turn ? snapshotTurn(turn) : null,
      streaming: state.streaming ? { lineId: state.streaming.lineId, text: state.streaming.text } : null,
      stats: {
        turns: state.stats.turns,
        toolCalls: state.stats.toolCalls,
        compressions: state.stats.compressions,
        tokensSaved: state.stats.tokensSaved,
        totalTokens: state.stats.totalTokens,
      },
      lastInput: state.lastInput,
    };
  }

  /* ─────────────────────────────────────────────────────────────
   * turn / stage
   * ─────────────────────────────────────────────────────────────
   */

  function makeTurn(input) {
    return {
      id: makeId('t'),
      input: input,
      status: 'running',
      startedAt: now(),
      endedAt: null,
      stages: [],
      inputMessageId: null,
      toolCalls: 0,
      cancelled: false,
    };
  }

  function beginStage(turn, kind, title, meta, detail) {
    const stage = {
      id: makeId('st'),
      kind: kind,
      title: title || '',
      meta: meta || '',
      status: 'active',
      detail: detail === undefined ? null : detail,
      at: now(),
    };
    turn.stages.push(stage);
    emit('stage');
    return stage;
  }

  function endStage(stage, patch) {
    if (!stage) return;
    const update = patch || {};
    if (update.meta !== undefined) stage.meta = update.meta;
    if (update.detail !== undefined) stage.detail = update.detail;
    if (update.title !== undefined) stage.title = update.title;
    stage.status = update.status || 'done';
    emit('stage');
  }

  function shouldAbort(turn, session) {
    return state.disposed || !turn || turn.cancelled || state.sessions.indexOf(session) < 0;
  }

  function contextStageDetail(asm) {
    return {
      used: asm.context.used,
      limit: asm.context.limit,
      messageCount: asm.context.messageCount,
      segments: asm.context.segments.map(function (segment) {
        return { id: segment.id, label: segment.label, tokens: segment.tokens };
      }),
      hits: asm.context.hits.map(function (hit) {
        return { id: hit.id, key: hit.key, value: hit.value };
      }),
      summary: asm.context.summary,
    };
  }

  function findTool(name) {
    for (let i = 0; i < LAB_TOOLS.length; i += 1) {
      if (LAB_TOOLS[i].name === name) return LAB_TOOLS[i];
    }
    return null;
  }

  function toolContext(session) {
    return {
      now: now,
      memory: state.memory,
      sessionId: session.id,
      writeMemory: writeMemory,
      searchMemory: searchMemory,
    };
  }

  function normalizeToolOutcome(outcome) {
    const raw = outcome && typeof outcome === 'object' ? outcome : {};
    const ok = raw.ok === true;
    let result = raw.result;
    if (result === undefined) result = ok ? null : { error: '工具调用失败' };
    let display = typeof raw.display === 'string' ? raw.display : '';
    if (!display) {
      if (typeof result === 'string') display = result;
      else if (result && typeof result === 'object' && typeof result.error === 'string') display = '错误：' + result.error;
      else display = ok ? '（工具没有返回文本）' : '错误：工具调用失败';
    }
    return { ok: ok, result: result, display: display };
  }

  /* ─────────────────────────────────────────────────────────────
   * 一轮 agent loop
   * ─────────────────────────────────────────────────────────────
   */

  async function runTurn(turn, session) {
    const input = turn.input;
    let lastTool = null;
    let steps = 0;
    let toolCalls = 0;
    let finalText = '';
    let converged = false;

    try {
      /* 1. 输入阶段 */
      const inputStage = beginStage(
        turn,
        'input',
        '接收输入',
        labCharCount(input) + ' 字 · ' + estimateTokens(input) + ' tok',
        { text: input, tokens: estimateTokens(input), chars: labCharCount(input) },
      );
      await sleep(labStageDelayMs(state.pace));
      if (shouldAbort(turn, session)) {
        endStage(inputStage, { status: 'error' });
        return finalizeCancelled(turn, session);
      }
      endStage(inputStage);

      /* 2. 上下文阶段 */
      let asm = assembleContext(session, input, {
        excludeIds: turn.inputMessageId ? [turn.inputMessageId] : [],
        turnId: turn.id,
      });
      session.context = asm.context;
      emit('context');
      const contextStage = beginStage(
        turn,
        'context',
        '组装上下文',
        asm.context.messageCount + ' 条消息 · ' + asm.context.used + '/' + budget + ' tok',
        contextStageDetail(asm),
      );
      await sleep(labStageDelayMs(state.pace));
      if (shouldAbort(turn, session)) {
        endStage(contextStage, { status: 'error' });
        return finalizeCancelled(turn, session);
      }
      endStage(contextStage);

      asm = maybeAutoCompress(session, turn, input, asm);
      if (shouldAbort(turn, session)) return finalizeCancelled(turn, session);

      /* 3. 模型 ↔ 工具循环 */
      for (let step = 1; step <= LAB_MAX_STEPS; step += 1) {
        steps = step;
        if (step > 1) {
          /* 工具循环内只重新组装上下文，不再自动压缩：
           * 自动压缩只在一轮开始时（第一次模型调用前）做一次，
           * 否则当前轮消息受保护无法折叠，只会产生无意义的压缩记录。 */
          asm = assembleContext(session, input, {
            excludeIds: turn.inputMessageId ? [turn.inputMessageId] : [],
        turnId: turn.id,
          });
          session.context = asm.context;
          emit('context');
          if (shouldAbort(turn, session)) return finalizeCancelled(turn, session);
        }
        state.stats.totalTokens += asm.context.used;

        const modelStage = beginStage(turn, 'model', '模型第 ' + step + ' 步', '思考中…', {
          step: step,
          messages: asm.modelMessages,
          toolSchemas: LAB_TOOL_SCHEMAS,
          response: null,
        });
        await sleep(labStageDelayMs(state.pace));
        if (shouldAbort(turn, session)) {
          endStage(modelStage, { status: 'error' });
          return finalizeCancelled(turn, session);
        }

        let plan;
        if (state.modelMode === 'real') {
          if (typeof realAdapter !== 'function') {
            endStage(modelStage, { meta: '真实模型未接入', status: 'error' });
            return finalizeTurnError(turn, session, '真实模型适配器未连接，请刷新页面后重试');
          }
          modelStage.detail.real = true;
          try {
            plan = await realAdapter({
              input: input,
              step: step,
              messages: asm.modelMessages,
              tools: LAB_TOOL_SCHEMAS,
              hits: asm.hits,
              lastTool: lastTool,
              usage: { used: asm.context.used, limit: budget },
              cancelled: function () {
                return shouldAbort(turn, session);
              },
            });
          } catch (error) {
            const message = labErrorMessage(error);
            modelInfo.lastError = message;
            modelStage.detail.error = message;
            endStage(modelStage, { meta: '真实模型调用失败', status: 'error' });
            throw error;
          }
          if (shouldAbort(turn, session)) {
            endStage(modelStage, { status: 'error' });
            return finalizeCancelled(turn, session);
          }
          if (plan && typeof plan === 'object') {
            if (plan.provider) modelInfo.provider = String(plan.provider);
            if (plan.model) modelInfo.model = String(plan.model);
            if (plan.usage && typeof plan.usage === 'object') modelInfo.lastUsage = plan.usage;
            if (typeof plan.latencyMs === 'number') modelInfo.lastLatencyMs = plan.latencyMs;
            if (plan.usage || typeof plan.latencyMs === 'number') modelInfo.lastError = null;
            modelStage.detail.model = {
              provider: modelInfo.provider,
              model: modelInfo.model,
              latencyMs: typeof plan.latencyMs === 'number' ? Math.round(plan.latencyMs) : null,
              usage: plan.usage || null,
            };
            const bits = ['真实模型', modelInfo.model || '当前模型'];
            if (typeof plan.latencyMs === 'number') bits.push(Math.round(plan.latencyMs) + ' ms');
            if (plan.usage) bits.push('输入 ' + (plan.usage.inputTokens || 0) + ' / 输出 ' + (plan.usage.outputTokens || 0) + ' tok');
            pushTranscript(session, makeLine('meta', bits.join(' · ')));
            emit('line');
            emit('state');
          }
        } else {
          plan = labNextStep({
            input: input,
            step: step,
            messages: asm.modelMessages,
            hits: asm.hits,
            memory: state.memory,
            usage: { used: asm.context.used, limit: budget },
            compression: state.lastCompression,
            lastTool: lastTool,
            now: now,
          });
        }

        if (!plan || (plan.type !== 'tool_call' && plan.type !== 'final')) {
          modelStage.detail.response = plan || null;
          endStage(modelStage, { meta: '返回无法识别的计划', status: 'error' });
          return finalizeTurnError(turn, session, '模型返回了无法识别的计划');
        }

        if (plan.type === 'tool_call') {
          modelStage.detail.response = plan;
          endStage(modelStage, { meta: '第 ' + step + ' 步 · 调用 ' + String(plan.name) });
          pushTranscript(session, makeLine('llm', '模型第 ' + step + ' 步 · 决定调用 ' + String(plan.name)));
          emit('line');

          const tool = findTool(plan.name);
          const toolArgs = plan.args && typeof plan.args === 'object' ? plan.args : {};
          const toolStage = beginStage(turn, 'tool', '调用 ' + String(plan.name), '执行中…', {
            name: plan.name,
            args: labClone(toolArgs),
          });
          pushTranscript(session, makeLine('tool', String(plan.name) + ' ' + labJson(toolArgs)));
          const callId = makeId('call');
          appendMessage(session, 'assistant', String(plan.name) + '(' + labJson(toolArgs) + ')', {
            kind: 'tool_call',
            toolName: plan.name,
            toolCallId: callId,
            toolArgs: labJson(toolArgs),
            turnId: turn.id,
          });
          emit('tool_call', { name: plan.name });
          emit('line');
          await sleep(labStageDelayMs(state.pace));
          if (shouldAbort(turn, session)) {
            endStage(toolStage, { status: 'error' });
            return finalizeCancelled(turn, session);
          }

          const startedAt = now();
          let outcome = null;
          if (!tool) {
            outcome = {
              ok: false,
              result: { error: '未知工具 ' + String(plan.name) },
              display: '错误：未知工具 ' + String(plan.name),
            };
          } else {
            try {
              outcome = await tool.run(toolArgs, toolContext(session));
            } catch (err) {
              outcome = { ok: false, result: { error: labErrorMessage(err) }, display: '错误：' + labErrorMessage(err) };
            }
          }
          outcome = normalizeToolOutcome(outcome);
          const durationMs = Math.max(0, now() - startedAt);
          endStage(toolStage, {
            meta: String(plan.name) + ' · ' + (durationMs > 0 ? durationMs + ' ms' : '<1 ms'),
            detail: {
              name: plan.name,
              args: labClone(toolArgs),
              ok: outcome.ok,
              result: labClone(outcome.result),
              display: outcome.display,
              durationMs: durationMs,
            },
          });
          pushTranscript(session, makeLine('toolresult', outcome.display));
          appendMessage(session, 'tool', outcome.display, {
            kind: 'tool_result',
            toolName: plan.name,
            toolCallId: callId,
            turnId: turn.id,
          });
          emit('tool_result', { name: plan.name, ok: outcome.ok });
          emit('line');
          toolCalls += 1;
          turn.toolCalls = toolCalls;
          state.stats.toolCalls += 1;

          if (plan.name === 'memory_write' && outcome.ok) {
            const saved = outcome.result && typeof outcome.result === 'object' ? outcome.result : {};
            const memoryStage = beginStage(
              turn,
              'memory',
              '写入长期记忆',
              String(saved.key) + ' = ' + String(saved.value),
              { key: saved.key, value: saved.value, id: saved.id },
            );
            endStage(memoryStage);
            pushTranscript(
              session,
              makeLine('memory', '记忆已保存 · ' + String(saved.key) + ' = ' + String(saved.value)),
            );
            emit('line');
          }

          lastTool = {
            name: plan.name,
            args: toolArgs,
            ok: outcome.ok,
            result: outcome.result,
            display: outcome.display,
          };
          continue;
        }

        /* 最终回答 */
        finalText = typeof plan.text === 'string' ? plan.text : '（模型没有给出回答）';
        modelStage.detail.response = plan;
        endStage(modelStage, { meta: '第 ' + step + ' 步 · 生成回答' });
        pushTranscript(session, makeLine('llm', '模型第 ' + step + ' 步 · 生成回答'));
        emit('line');
        converged = true;
        break;
      }

      if (!converged) return finalizeMaxSteps(turn, session, steps);
      if (shouldAbort(turn, session)) return finalizeCancelled(turn, session);

      /* 4. 流式输出最终回答 */
      finalText = String(finalText || '（本轮没有生成回答）');
      const answerLine = makeLine('agent', '');
      answerLine.streaming = true;
      pushTranscript(session, answerLine);
      state.streaming = { lineId: answerLine.id, text: '' };
      emit('line');
      const streamed = await labStreamAnswer(finalText, {
        pace: state.pace,
        sleep: sleep,
        cancelled: function () {
          return shouldAbort(turn, session);
        },
        onToken: function (chunk) {
          answerLine.text += chunk;
          state.streaming = { lineId: answerLine.id, text: answerLine.text };
          emit('token', { text: chunk });
        },
      });
      answerLine.streaming = false;
      state.streaming = null;
      if (!streamed || shouldAbort(turn, session)) return finalizeCancelled(turn, session);
      appendMessage(session, 'assistant', finalText, { kind: 'final', turnId: turn.id });
      emit('line');

      /* 5. 收尾：重新组装上下文（保留本轮召回记忆），补 output stage 与 meta 行 */
      const endAsm = assembleContext(session, input, {
        excludeIds: turn.inputMessageId ? [turn.inputMessageId] : [],
        turnId: turn.id,
      });
      session.context = endAsm.context;
      emit('context');
      const outputStage = beginStage(
        turn,
        'output',
        '生成输出',
        estimateTokens(finalText) + ' tok · ' + steps + ' 步 · ' + toolCalls + ' 次工具',
        { text: finalText, tokens: estimateTokens(finalText), steps: steps, toolCalls: toolCalls },
      );
      endStage(outputStage);
      maybeCompressAfterTurn(session, turn, input);
      const finalUsed = session.context ? session.context.used : endAsm.context.used;
      pushTranscript(
        session,
        makeLine(
          'meta',
          '完成 · ' + steps + ' 步 · ' + toolCalls + ' 次工具 · 上下文 ' + finalUsed + '/' + budget + ' tok',
        ),
      );
      emit('line');

      turn.status = 'done';
      turn.endedAt = now();
      session.turns += 1;
      session.lastTurn = turn;
      state.stats.turns += 1;
      persist();
      emit('turn_end', { turnId: turn.id });
      emit('state');
    } catch (err) {
      finalizeTurnError(turn, session, labErrorMessage(err));
    }
  }

  function markActiveStageError(turn) {
    for (let i = turn.stages.length - 1; i >= 0; i -= 1) {
      if (turn.stages[i].status === 'active') {
        turn.stages[i].status = 'error';
        return;
      }
    }
  }

  function finalizeCancelled(turn, session) {
    if (!turn || turn.status !== 'running') return;
    turn.status = 'error';
    turn.endedAt = now();
    state.streaming = null;
    markActiveStageError(turn);
    const stillActive = state.sessions.indexOf(session) >= 0;
    if (stillActive) {
      pushTranscript(session, makeLine('info', '本轮已取消'));
      pushTranscript(session, makeLine('meta', '已取消'));
      session.lastTurn = turn;
    }
    persist();
    if (!state.disposed && stillActive) {
      emit('line');
      emit('turn_end', { turnId: turn.id });
      emit('state');
    }
  }

  function finalizeTurnError(turn, session, message) {
    if (!turn || turn.status !== 'running') return;
    turn.status = 'error';
    turn.endedAt = now();
    state.streaming = null;
    markActiveStageError(turn);
    const stillActive = state.sessions.indexOf(session) >= 0;
    if (stillActive) {
      pushTranscript(session, makeLine('error', '发生错误：' + message));
      pushTranscript(session, makeLine('meta', '失败 · ' + truncate(message, 40)));
      session.turns += 1;
      session.lastTurn = turn;
      state.stats.turns += 1;
    }
    persist();
    if (!state.disposed && stillActive) {
      emit('error', { message: message });
      emit('line');
      emit('turn_end', { turnId: turn.id });
      emit('state');
    }
  }

  function finalizeMaxSteps(turn, session, steps) {
    if (!turn || turn.status !== 'running') return;
    const message = '已达到单轮最大步数（' + LAB_MAX_STEPS + '），本轮未收敛';
    turn.status = 'error';
    turn.endedAt = now();
    state.streaming = null;
    markActiveStageError(turn);
    const stillActive = state.sessions.indexOf(session) >= 0;
    if (stillActive) {
      pushTranscript(session, makeLine('error', message));
      pushTranscript(session, makeLine('meta', '失败 · 超过最大步数 ' + steps));
      session.turns += 1;
      session.lastTurn = turn;
      state.stats.turns += 1;
    }
    persist();
    if (!state.disposed && stillActive) {
      emit('error', { message: message });
      emit('line');
      emit('turn_end', { turnId: turn.id });
      emit('state');
    }
  }

  /* ─────────────────────────────────────────────────────────────
   * 公开 API
   * ─────────────────────────────────────────────────────────────
   */

  function submit(rawText) {
    if (state.disposed) return Promise.resolve();
    if (busy()) return Promise.resolve(); /* 并发 submit：直接拒绝重复，不排队 */
    const text = labCleanText(rawText, LAB_MAX_INPUT_CHARS);
    if (!text) return Promise.resolve();
    const session = activeSession();
    if (!session) return Promise.resolve();

    const turn = makeTurn(text);
    state.turn = turn;
    state.lastInput = text;
    state.streaming = null;

    if (!session.title || session.title === '新会话') session.title = truncate(text, 20);
    session.lastTurn = turn;
    emit('turn_start', { turnId: turn.id });
    pushTranscript(session, makeLine('user', text));
    emit('line');
    emit('state');
    const userMessage = appendMessage(session, 'user', text, { turnId: turn.id });
    turn.inputMessageId = userMessage.id;

    return Promise.resolve()
      .then(function () {
        return runTurn(turn, session);
      })
      .catch(function (err) {
        finalizeTurnError(turn, session, labErrorMessage(err));
      });
  }

  function compact() {
    if (state.disposed) return false;
    const session = activeSession();
    if (!session) return false;
    if (busy()) {
      appendInfoLine(session, '本轮还在进行，结束后再压缩');
      return false;
    }
    if (session.messages.length < 3) {
      appendInfoLine(session, '消息太少，暂时不需要压缩');
      persist();
      return false;
    }
    const result = compressSession(session, { manual: true, input: '' });
    if (!result.compressed) {
      appendInfoLine(session, '暂无可折叠的历史消息');
      persist();
      return false;
    }
    session.context = result.context;
    emit('context');
    emit('state');
    persist();
    return true;
  }

  function newSession() {
    if (state.disposed || busy()) return false;
    const session = makeSession();
    state.sessions.unshift(session);
    while (state.sessions.length > LAB_MAX_SESSIONS) state.sessions.pop();
    state.activeId = session.id;
    state.turn = null;
    state.streaming = null;
    session.context = assembleContext(session, '', {}).context;
    emit('state');
    emit('context');
    persist();
    return true;
  }

  function switchSession(id) {
    if (state.disposed || busy()) return false;
    if (typeof id !== 'string') return false;
    let target = null;
    for (let i = 0; i < state.sessions.length; i += 1) {
      if (state.sessions[i].id === id) {
        target = state.sessions[i];
        break;
      }
    }
    if (!target) return false;
    if (target.id === state.activeId) return true;
    state.activeId = target.id;
    state.turn = target.lastTurn || null;
    state.streaming = null;
    if (!target.context) target.context = assembleContext(target, '', {}).context;
    emit('state');
    emit('context');
    persist();
    return true;
  }

  function deleteSession(id) {
    if (state.disposed || busy()) return false;
    if (typeof id !== 'string') return false;
    let index = -1;
    for (let i = 0; i < state.sessions.length; i += 1) {
      if (state.sessions[i].id === id) {
        index = i;
        break;
      }
    }
    if (index < 0) return false;
    const wasActive = state.sessions[index].id === state.activeId;
    state.sessions.splice(index, 1);
    state.streaming = null;
    if (!state.sessions.length) {
      const session = makeSession();
      state.sessions.push(session);
      state.activeId = session.id;
      state.turn = null;
      session.context = assembleContext(session, '', {}).context;
    } else if (wasActive) {
      const next = state.sessions[Math.min(index, state.sessions.length - 1)];
      state.activeId = next.id;
      state.turn = next.lastTurn || null;
      if (!next.context) next.context = assembleContext(next, '', {}).context;
    }
    emit('state');
    emit('context');
    persist();
    return true;
  }

  function setPace(pace) {
    const next = labNormalizePace(pace);
    if (state.pace === next) return true;
    state.pace = next;
    emit('state');
    persist();
    return true;
  }

  function setBudget(value) {
    if (state.disposed) return false;
    const next = Math.floor(Number(value));
    if (!isFinite(next) || next < 800 || next > 1048576) return false;
    if (next === budget) return true;
    if (busy()) return false;
    budget = next;
    budgetCustom = true;
    const session = activeSession();
    if (session) {
      session.context = assembleContext(session, '', {}).context;
      appendInfoLine(session, '教学上下文预算已调整为 ' + budget + ' tok');
    }
    emit('context');
    emit('state');
    persist();
    return true;
  }

  function setModelMode(mode) {
    if (state.disposed) return false;
    const next = mode === 'real' ? 'real' : 'sim';
    if (next === state.modelMode) return true;
    if (busy()) return false;
    state.modelMode = next;
    if (next === 'sim') modelInfo.lastError = null;
    const session = activeSession();
    if (session) {
      const label =
        next === 'real'
          ? '模型模式：真实 DeepSeek（' + (modelInfo.modelName || modelInfo.model || '跟随 DSH 当前模型') + '）'
          : '模型模式：本地规则模拟（离线、可复现）';
      pushTranscript(session, makeLine('info', label));
      emit('line');
    }
    emit('state');
    persist();
    return true;
  }

  function setModelAdapter(adapter) {
    realAdapter = typeof adapter === 'function' ? adapter : null;
    emit('state');
    return true;
  }

  function setModelInfo(info) {
    if (!info || typeof info !== 'object') return false;
    const changed =
      (info.provider !== undefined && String(info.provider) !== modelInfo.provider) ||
      (info.model !== undefined && String(info.model) !== modelInfo.model) ||
      (info.modelName !== undefined && String(info.modelName) !== modelInfo.modelName) ||
      (info.signedIn !== undefined && info.signedIn !== modelInfo.signedIn) ||
      (info.available !== undefined && info.available !== modelInfo.available) ||
      (info.contextWindow !== undefined && info.contextWindow !== modelInfo.contextWindow) ||
      (info.maxOutputTokens !== undefined && info.maxOutputTokens !== modelInfo.maxOutputTokens);
    if (info.provider !== undefined) modelInfo.provider = String(info.provider || '');
    if (info.model !== undefined) modelInfo.model = String(info.model || '');
    if (info.modelName !== undefined) modelInfo.modelName = String(info.modelName || '');
    if (info.signedIn !== undefined) modelInfo.signedIn = info.signedIn;
    if (info.available !== undefined) modelInfo.available = info.available;
    if (info.contextWindow !== undefined) modelInfo.contextWindow = Number.isFinite(info.contextWindow) ? info.contextWindow : null;
    if (info.maxOutputTokens !== undefined) modelInfo.maxOutputTokens = Number.isFinite(info.maxOutputTokens) ? info.maxOutputTokens : null;
    if (changed) emit('state');
    return changed;
  }

  function resetAll() {
    if (state.turn && state.turn.status === 'running') state.turn.cancelled = true;
    state.turn = null;
    state.streaming = null;
    try {
      if (typeof storage.removeItem === 'function') storage.removeItem(LAB_STORAGE_KEY);
      else storage.setItem(LAB_STORAGE_KEY, '');
    } catch (err) {
      /* 忽略存储清理失败 */
    }
    const session = makeSession();
    state.sessions = [session];
    state.activeId = session.id;
    state.memory = [];
    state.stats = createStats();
    state.lastInput = '';
    state.lastCompression = null;
    state.modelMode = 'sim';
    budget = LAB_BUDGET;
    budgetCustom = false;
    modelInfo.lastUsage = null;
    modelInfo.lastLatencyMs = null;
    modelInfo.lastError = null;
    session.context = assembleContext(session, '', {}).context;
    state.disposed = false;
    emit('state');
    emit('memory');
    emit('context');
    persist();
    return true;
  }

  function dispose() {
    if (state.disposed) return;
    if (state.turn && state.turn.status === 'running') state.turn.cancelled = true;
    persist();
    state.streaming = null;
    state.disposed = true;
    listeners.length = 0;
  }

  return {
    snapshot: snapshot,
    onEvent: onEvent,
    submit: submit,
    compact: compact,
    newSession: newSession,
    switchSession: switchSession,
    deleteSession: deleteSession,
    clearMemory: clearMemory,
    deleteMemory: deleteMemory,
    resetAll: resetAll,
    setPace: setPace,
    setBudget: setBudget,
    setModelMode: setModelMode,
    setModelAdapter: setModelAdapter,
    setModelInfo: setModelInfo,
    dispose: dispose,
  };
}
