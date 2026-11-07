/* ─────────────────────────────────────────────────────────────
 * Agent 实验室 · 真实模型客户端
 * The browser half of the "真实 DeepSeek" mode. It talks to the bundle's
 * Host routes (index.js), which call the model configured in this DSH
 * profile through ctx.llm. The mini-agent loop, tools and memory stay in this
 * plugin — only the model decision step is delegated to the real model.
 * ───────────────────────────────────────────────────────────── */

const AL_MODEL_STATUS_PATH = '/agent-lab/status';
const AL_MODEL_COMPLETE_PATH = '/agent-lab/complete';

const AL_REAL_SYSTEM_SUFFIX =
  '你现在以真实模型模式驱动一个教学用迷你 Agent。可用工具以请求里的 schema 为准：calculator（计算）、clock（时间）、' +
  'dice_roll（掷骰子）、random_pick（随机选择）、password_generate（生成密码）、unit_convert（单位换算）、' +
  'memory_write（写入长期记忆）、memory_search（检索长期记忆）。需要外部能力时必须调用工具，' +
  '不要凭空编造工具结果；同一轮只调用一个工具。回答用简体中文、口语、简洁（一般不超过 120 字）。';

const AL_REAL_SYSTEM_SUFFIX_FALLBACK =
  '真实模型暂时不可用。请先检查 DSH 设置里的 DeepSeek 账号登录状态，或刷新页面。';

async function alModelFetchJson(path, options) {
  const init = options || {};
  let response;
  try {
    response = await fetch(path, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...init,
      headers: { accept: 'application/json', ...(init.headers || {}) },
    });
  } catch (error) {
    throw new Error('无法连接本地 Host 路由：' + ((error && error.message) || '网络错误'));
  }
  let data = null;
  try {
    const raw = await response.text();
    data = raw ? JSON.parse(raw) : {};
  } catch (error) {
    data = null;
  }
  if (!response.ok) {
    const message = data && data.error && data.error.message ? data.error.message : 'HTTP ' + response.status;
    const failure = new Error(message);
    failure.code = data && data.error && data.error.code ? data.error.code : 'HTTP_' + response.status;
    throw failure;
  }
  if (!data || data.ok !== true) {
    const message = data && data.error && data.error.message ? data.error.message : 'Host 返回了无法识别的响应';
    const failure = new Error(message);
    failure.code = data && data.error && data.error.code ? data.error.code : 'BAD_RESPONSE';
    throw failure;
  }
  return data;
}

/** Read the current DSH model selection + availability without exposing secrets. */
async function alRealModelStatus() {
  const data = await alModelFetchJson(AL_MODEL_STATUS_PATH, { method: 'GET' });
  return {
    available: Boolean(data.ok && data.provider && data.model),
    provider: data.provider || '',
    model: data.model || '',
    modelName: data.modelName || data.model || '',
    reasoningEffort: data.reasoningEffort || '',
    signedIn: data.signedIn,
    models: Array.isArray(data.models) ? data.models : [],
    contextWindow: Number.isFinite(data.contextWindow) ? data.contextWindow : null,
    maxOutputTokens: Number.isFinite(data.maxOutputTokens) ? data.maxOutputTokens : null,
  };
}

/** Human-readable token counts for the terminal footer (420 / 128K / 1M). */
function alFormatTokens(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1000000) return (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'K';
  return String(Math.round(n));
}

/**
 * Convert the engine's context messages into the simple wire format the Host
 * route expects. System messages fold into `system`; assistant tool-call and
 * tool-result messages keep their call ids so the model sees a valid loop.
 */
function alRealWireMessages(modelMessages) {
  const systemParts = [];
  const messages = [];
  const list = Array.isArray(modelMessages) ? modelMessages : [];
  for (let i = 0; i < list.length; i += 1) {
    const message = list[i];
    if (!message || typeof message !== 'object') continue;
    if (message.role === 'system') {
      if (typeof message.content === 'string' && message.content.trim()) systemParts.push(message.content.trim());
      continue;
    }
    if (message.role === 'user') {
      messages.push({ role: 'user', content: String(message.content || '') });
      continue;
    }
    if (message.role === 'assistant') {
      const toolCalls = [];
      if (message.kind === 'tool_call' && message.toolCallId) {
        let args = message.toolArgs;
        if (typeof args !== 'string') args = JSON.stringify(args || {});
        toolCalls.push({ id: message.toolCallId, name: message.toolName || '', args });
      }
      messages.push({ role: 'assistant', content: String(message.content || ''), toolCalls });
      continue;
    }
    if (message.role === 'tool') {
      messages.push({
        role: 'tool',
        content: String(message.content || ''),
        toolCallId: message.toolCallId || '',
        isError: String(message.content || '').indexOf('错误：') === 0,
      });
    }
  }
  return { system: systemParts.join('\n\n'), messages };
}

/**
 * Build the async adapter the engine calls once per model step in real mode.
 * Returns {type:'tool_call'|'final', ...}; the engine executes tools itself.
 */
function alCreateRealModelAdapter(options) {
  const settings = options || {};
  return async function realModelAdapter(request) {
    const wire = alRealWireMessages(request.messages);
    const system = [wire.system, AL_REAL_SYSTEM_SUFFIX].filter(Boolean).join('\n\n');
    const payload = {
      system: system,
      messages: wire.messages,
      tools: request.tools || [],
      /* 教学模式关闭 thinking：避免把 reasoning 块回传进下一轮工具循环，
       * 让模型请求保持最小可解释，同时保留原生 tool-call 协议。 */
      thinking: false,
      maxTokens: 900,
      temperature: 0.3,
    };
    const startedAt = Date.now();
    const data = await alModelFetchJson(AL_MODEL_COMPLETE_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (typeof request.cancelled === 'function' && request.cancelled()) {
      throw new Error('本轮已取消');
    }
    const latencyMs = typeof data.latencyMs === 'number' ? data.latencyMs : Math.max(0, Date.now() - startedAt);
    const meta = {
      provider: data.provider || '',
      model: data.model || '',
      latencyMs: latencyMs,
      usage: data.usage || null,
    };
    if (Array.isArray(data.toolCalls) && data.toolCalls.length) {
      const call = data.toolCalls[0];
      let args = call.args;
      if (typeof args === 'string') {
        try {
          args = JSON.parse(args);
        } catch (error) {
          args = {};
        }
      }
      if (!args || typeof args !== 'object') args = {};
      return {
        type: 'tool_call',
        name: String(call.name || ''),
        args: args,
        text: typeof data.text === 'string' ? data.text : '',
        ...meta,
      };
    }
    return {
      type: 'final',
      text: typeof data.text === 'string' && data.text.trim() ? data.text : '（真实模型没有返回内容）',
      ...meta,
    };
  };
}

/** Describe the current mode for the terminal header. */
function alRealModeLabel(view, status) {
  if (!view || view.modelMode !== 'real') return '模拟模型 · 离线';
  const model = (view.model && (view.model.modelName || view.model.model)) || (status && (status.modelName || status.model)) || 'DeepSeek';
  return '真实 · ' + model;
}
