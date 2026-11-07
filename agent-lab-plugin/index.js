/**
 * Host half of the Agent 实验室 bundle.
 *
 * The page itself is the Client half (client.js). This half exists so the
 * "真实 DeepSeek" mode can call the model configured in the current DSH
 * profile: it exposes two authenticated same-origin JSON routes.
 *
 *   GET  /agent-lab/status    → current provider/model + sign-in availability
 *   POST /agent-lab/complete  → one chat completion with tool schemas
 *
 * No credentials ever leave the Host: ctx.llm owns provider auth and the
 * DeepSeek account token is resolved by the adapter. Both routes apply the
 * same Connection trust checks as every other browser API.
 */

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(JSON.stringify(payload));
}

function readJson(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(text ? JSON.parse(text) : {});
      } catch (error) {
        reject(new Error('请求体不是合法 JSON'));
      }
    });
    req.on('error', reject);
  });
}

function text(value, max) {
  const string = value === null || value === undefined ? '' : String(value);
  return string.length > max ? string.slice(0, max) : string;
}

function asMessageContent(value) {
  return [{ type: 'text', text: text(value, 20000) }];
}

/**
 * Convert the plugin's simple message list into the LLM service's request
 * message shapes. User messages stay request-only (no id/source); assistant
 * and tool messages are durable shapes with a stable synthetic id so provider
 * adapters can correlate tool calls.
 */
function toRequestMessages(messages, provider, model) {
  const out = [];
  let index = 0;
  for (const message of Array.isArray(messages) ? messages : []) {
    if (!message || typeof message !== 'object') continue;
    const role = message.role;
    if (role === 'system') continue; /* folded into the system string by the caller */
    if (role === 'user') {
      out.push({ role: 'user', content: asMessageContent(message.content) });
      continue;
    }
    index += 1;
    const id = 'agent-lab-' + role + '-' + index;
    if (role === 'assistant') {
      const content = [];
      const body = text(message.content, 20000);
      if (body) content.push({ type: 'text', text: body });
      const calls = Array.isArray(message.toolCalls) ? message.toolCalls : [];
      for (const call of calls) {
        if (!call || typeof call !== 'object') continue;
        const callId = text(call.id, 120) || 'call-' + index;
        content.push({
          type: 'tool-call',
          id: callId,
          name: text(call.name, 80),
          arguments: typeof call.args === 'string' ? call.args : JSON.stringify(call.args || {}),
        });
      }
      out.push({
        id,
        role: 'assistant',
        content,
        source: { kind: 'model', provider, model },
      });
      continue;
    }
    if (role === 'tool') {
      const callId = text(message.toolCallId, 120);
      if (!callId) continue;
      out.push({
        id,
        role: 'tool',
        toolCallId: callId,
        source: { kind: 'tool', callId },
        content: asMessageContent(message.content),
        ...(message.isError ? { isError: true } : {}),
      });
    }
  }
  return out;
}

function normalizeTools(tools) {
  if (!Array.isArray(tools)) return undefined;
  const out = [];
  for (const tool of tools) {
    if (!tool || typeof tool.name !== 'string' || !tool.name) continue;
    out.push({
      name: tool.name,
      description: text(tool.description, 2000),
      parameters: tool.parameters && typeof tool.parameters === 'object' ? tool.parameters : { type: 'object', properties: {} },
    });
  }
  return out.length ? out : undefined;
}

/** Combine the plugin's system messages into the single system string. */
function systemOf(body, messages) {
  const parts = [];
  if (typeof body.system === 'string' && body.system.trim()) parts.push(body.system.trim());
  for (const message of Array.isArray(messages) ? messages : []) {
    if (message && message.role === 'system' && typeof message.content === 'string' && message.content.trim()) {
      parts.push(message.content.trim());
    }
  }
  return parts.join('\n\n');
}

/** Turn provider-neutral failure codes into a message the learner can act on. */
function explainFailure(failure) {
  const code = failure && typeof failure.code === 'string' ? failure.code : 'UNKNOWN';
  const message = failure && typeof failure.message === 'string' ? failure.message : '模型调用失败';
  if (code === 'ACCOUNT_SIGN_IN_REQUIRED' || code === 'MISSING_CREDENTIAL') {
    return { code, message: '当前 DeepSeek 账号未登录或登录已失效，请先在 DSH 设置中登录账号。' };
  }
  if (code === 'ACCOUNT_QUOTA' || code === 'QUOTA') {
    return { code, message: 'DeepSeek 账号额度不足，请充值或更换模型后再试。' };
  }
  if (code === 'CONTEXT_WINDOW_EXCEEDED') {
    return { code, message: '上下文超出模型窗口，请先压缩上下文再试。' };
  }
  if (code === 'RATE_LIMIT') return { code, message: '请求被限流，请稍后再试。' };
  if (code === 'MODEL_UNSUPPORTED' || code === 'CLIENT_UPGRADE_REQUIRED') {
    return { code, message: '当前 DSH 版本或模型配置不支持该模型，请在设置里更换模型。' };
  }
  return { code, message };
}

/**
 * Wait for the Web carrier before registering routes: at process startup a
 * plugin may be activated before webServer is available, and a missing
 * service at apply time would silently skip both routes (they would only
 * appear after a manual plugin toggle).
 */
export const inject = ['webServer'];

export function apply(ctx) {
  const webServer = ctx.get('webServer');
  const connection = ctx.get('connection');
  if (!webServer) return;

  const reject = (req) => {
    if (!connection || typeof connection.requestRejection !== 'function') return 503;
    return connection.requestRejection({ headers: req.headers });
  };

  const statusHandler = async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendJson(res, 405, { ok: false, error: { message: '只支持 GET' } });
      return;
    }
    const rejection = reject(req);
    if (rejection) {
      sendJson(res, rejection, { ok: false, error: { message: '未认证的请求' } });
      return;
    }
    const llm = ctx.get('llm');
    const agentDefaultModel = ctx.get('agentDefaultModel');
    const selection = agentDefaultModel ? agentDefaultModel.currentSelection() : null;
    const provider = selection && typeof selection.provider === 'string' ? selection.provider : '';
    const model = selection && typeof selection.model === 'string' ? selection.model : '';
    let signedIn = null;
    if (provider === 'deepseek-account') {
      const account = ctx.get('deepseekAccount');
      if (account && typeof account.getState === 'function') {
        try {
          const state = await account.getState();
          signedIn = state && state.status === 'credential-stored';
        } catch (error) {
          signedIn = false;
        }
      }
    }
    let modelName = model;
    let models = [];
    let contextWindow = null;
    let maxOutputTokens = null;
    if (llm && provider) {
      try {
        const list = await llm.listModels(provider);
        models = list.map((item) => ({ id: item.id, name: item.name || item.id }));
        const hit = list.find((item) => item.id === model);
        if (hit && hit.name) modelName = hit.name;
      } catch (error) {
        /* 模型目录不可用时只返回 id */
      }
      try {
        const resolved = await llm.resolveModelInfo(provider, model);
        if (resolved && resolved.context && Number.isFinite(resolved.context.contextWindow)) {
          contextWindow = resolved.context.contextWindow;
        }
        if (resolved && Number.isFinite(resolved.defaultMaxTokens)) {
          maxOutputTokens = resolved.defaultMaxTokens;
        }
      } catch (error) {
        /* 能力解析失败时窗口未知 */
      }
    }
    sendJson(res, 200, {
      ok: Boolean(llm && provider && model),
      provider,
      model,
      modelName,
      reasoningEffort: selection && selection.reasoningEffort ? String(selection.reasoningEffort) : null,
      signedIn,
      models,
      contextWindow,
      maxOutputTokens,
    });
  };

  const completeHandler = async (req, res) => {
    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, error: { message: '只支持 POST' } });
      return;
    }
    const rejection = reject(req);
    if (rejection) {
      sendJson(res, rejection, { ok: false, error: { message: '未认证的请求' } });
      return;
    }
    const llm = ctx.get('llm');
    const agentDefaultModel = ctx.get('agentDefaultModel');
    if (!llm || !agentDefaultModel) {
      sendJson(res, 503, { ok: false, error: { code: 'LLM_UNAVAILABLE', message: 'Host 侧没有可用的 llm 服务。' } });
      return;
    }
    let body;
    try {
      body = await readJson(req, 256 * 1024);
    } catch (error) {
      sendJson(res, 400, { ok: false, error: { code: 'BAD_REQUEST', message: error.message || '请求体不合法' } });
      return;
    }
    const selection = agentDefaultModel.currentSelection();
    const provider = selection && typeof selection.provider === 'string' ? selection.provider : '';
    const model = selection && typeof selection.model === 'string' ? selection.model : '';
    if (!provider || !model) {
      sendJson(res, 503, { ok: false, error: { code: 'NO_MODEL', message: '当前 profile 没有选择默认模型。' } });
      return;
    }
    const messages = toRequestMessages(body.messages, provider, model);
    if (!messages.length) {
      sendJson(res, 400, { ok: false, error: { code: 'NO_MESSAGES', message: '请求里没有可发送的消息。' } });
      return;
    }
    const maxTokens = Math.max(64, Math.min(2048, Number(body.maxTokens) || 800));
    const temperature = Math.max(0, Math.min(1.5, Number(body.temperature)));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    const onClose = () => {
      if (!res.writableEnded) controller.abort();
    };
    res.on('close', onClose);
    const startedAt = Date.now();
    let textOut = '';
    const toolCalls = new Map();
    let usage = null;
    let finish = null;
    try {
      const stream = llm.stream({
        provider,
        model,
        system: systemOf(body, body.messages) || undefined,
        messages,
        tools: normalizeTools(body.tools),
        maxTokens,
        ...(Number.isFinite(temperature) ? { temperature } : {}),
        ...(body.thinking === false
          ? { reasoningEffort: 'off' }
          : selection.reasoningEffort
            ? { reasoningEffort: selection.reasoningEffort }
            : {}),
        signal: controller.signal,
      });
      for await (const chunk of stream) {
        if (chunk.type === 'text-delta') {
          textOut += chunk.text;
        } else if (chunk.type === 'tool-call-delta') {
          const current = toolCalls.get(chunk.index) || { id: chunk.id, name: '', args: '' };
          if (chunk.name) current.name = chunk.name;
          current.args += chunk.argumentsDelta || '';
          toolCalls.set(chunk.index, current);
        } else if (chunk.type === 'block-end') {
          const block = chunk.block;
          if (block && block.type === 'tool-call') {
            toolCalls.set(chunk.index, {
              id: block.id,
              name: block.name,
              args: typeof block.arguments === 'string' ? block.arguments : JSON.stringify(block.arguments || {}),
            });
          } else if (block && block.type === 'text' && !textOut) {
            textOut = block.text;
          }
        } else if (chunk.type === 'usage') {
          usage = chunk.usage;
        } else if (chunk.type === 'finish') {
          finish = chunk.reason;
        }
      }
      if (finish && (finish.kind === 'error' || finish.kind === 'aborted')) {
        const explained = explainFailure(finish.failure || {});
        sendJson(res, finish.kind === 'aborted' ? 504 : 502, {
          ok: false,
          error: explained,
          provider,
          model,
          latencyMs: Date.now() - startedAt,
        });
        return;
      }
      const calls = [];
      for (const call of toolCalls.values()) {
        let args = call.args;
        try {
          args = call.args ? JSON.parse(call.args) : {};
        } catch (error) {
          /* 保留原始字符串，客户端工具会返回参数错误 */
        }
        calls.push({ id: call.id, name: call.name, args });
      }
      sendJson(res, 200, {
        ok: true,
        text: textOut,
        toolCalls: calls,
        usage,
        finish: finish ? finish.kind : 'stop',
        provider,
        model,
        latencyMs: Date.now() - startedAt,
      });
    } catch (error) {
      const aborted = controller.signal.aborted;
      sendJson(res, aborted ? 504 : 502, {
        ok: false,
        error: {
          code: aborted ? 'ABORTED' : 'TRANSPORT',
          message: aborted ? '模型请求超时或被取消。' : error && error.message ? error.message : '模型调用失败',
        },
        provider,
        model,
        latencyMs: Date.now() - startedAt,
      });
    } finally {
      clearTimeout(timer);
      res.off('close', onClose);
    }
  };

  ctx.effect(() =>
    webServer.register({ kind: 'exact', path: '/agent-lab/status', handler: statusHandler }),
  );
  ctx.effect(() =>
    webServer.register({ kind: 'exact', path: '/agent-lab/complete', handler: completeHandler }),
  );
}
