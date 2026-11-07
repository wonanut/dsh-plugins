/* ─────────────────────────────────────────────────────────────
 * Agent 实验室 · 检查器
 * Three live views over the same snapshot:
 *   流转  – the stage-by-stage pipeline of the current turn
 *   上下文 – token budget, retrieved memories, summary and the exact messages
 *   记忆  – short-term (session) vs long-term (cross-session) memory
 * ───────────────────────────────────────────────────────────── */

const INSPECTOR_CSS = `
.al-inspector-panel { grid-area: inspector; }
.al-inspector-tabs { display: flex; gap: 3px; padding: 7px 8px; border-bottom: 1px solid var(--al-border); flex: none; background: color-mix(in srgb, var(--al-layer) 50%, transparent); }
.al-itab {
  flex: 1; min-width: 0; display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  height: 27px; padding: 0 6px; border: 1px solid transparent; border-radius: 7px;
  background: transparent; color: var(--al-ter); font-size: 11.5px; font-weight: 560; white-space: nowrap;
  transition: color .15s ease, background .15s ease, border-color .15s ease;
}
.al-itab:hover { color: var(--al-text); background: var(--al-layer2); }
.al-itab.on { color: var(--al-accent); background: var(--al-accent-soft); border-color: color-mix(in srgb, var(--al-accent) 22%, transparent); }
.al-itab-badge { font-size: 9.5px; font-weight: 650; padding: 0 4px; height: 14px; line-height: 14px; border-radius: 999px; background: var(--al-layer2); color: var(--al-ter); }
.al-itab.on .al-itab-badge { background: color-mix(in srgb, var(--al-accent) 18%, transparent); color: var(--al-accent); }
.al-insp-body { flex: 1; min-height: 0; overflow-y: auto; padding: 10px 12px 16px; }
.al-insp-section { margin-bottom: 14px; }
.al-insp-section:last-child { margin-bottom: 2px; }
.al-insp-label {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  margin: 0 0 6px; font-size: 10.5px; font-weight: 620; color: var(--al-ter);
  letter-spacing: .04em; text-transform: none;
}
.al-insp-label .al-chip { height: 19px; font-size: 10px; }
.al-insp-note { font-size: 10.5px; color: var(--al-ter); line-height: 1.55; }
.al-insp-note code, .al-insp-note .al-code-inline { font-size: 10px; }

/* flow */
.al-flow-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
.al-flow-input {
  margin: 0 0 10px; padding: 8px 10px; border-radius: 9px;
  border: 1px solid var(--al-border); border-left: 3px solid var(--al-accent);
  background: color-mix(in srgb, var(--al-accent) 6%, transparent);
  font-size: 11.5px; line-height: 1.55; word-break: break-word;
}
.al-flow-input b { font-size: 10px; color: var(--al-ter); font-weight: 600; display: block; margin-bottom: 2px; }
.al-stage { display: flex; gap: 8px; }
.al-stage-rail { flex: none; display: flex; flex-direction: column; align-items: center; width: 14px; padding-top: 5px; }
.al-stage-dot {
  width: 9px; height: 9px; border-radius: 50%; flex: none;
  border: 2px solid var(--al-border2); background: var(--al-layer);
  transition: background .2s ease, border-color .2s ease, box-shadow .2s ease;
}
.al-stage-dot.done { background: var(--al-good); border-color: var(--al-good); }
.al-stage-dot.active { background: var(--al-accent); border-color: var(--al-accent); animation: al-stage-pulse 1.6s infinite; }
.al-stage-dot.error { background: var(--al-danger); border-color: var(--al-danger); }
@keyframes al-stage-pulse {
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--al-accent) 42%, transparent); }
  70% { box-shadow: 0 0 0 7px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}
.al-stage-line { flex: 1; width: 1px; background: var(--al-border); min-height: 12px; margin: 3px 0; }
.al-stage:last-child .al-stage-line { display: none; }
.al-stage-main { flex: 1; min-width: 0; padding-bottom: 9px; }
.al-stage-head {
  width: 100%; display: flex; align-items: center; gap: 7px; padding: 4px 6px;
  border: 1px solid transparent; border-radius: 8px; background: transparent; text-align: left;
  transition: background .15s ease, border-color .15s ease;
}
.al-stage-head:hover { background: var(--al-layer2); }
.al-stage[data-open='true'] .al-stage-head { background: var(--al-layer2); border-color: var(--al-border); }
.al-stage-kind { width: 22px; height: 22px; flex: none; border-radius: 6px; display: grid; place-items: center; background: var(--al-layer2); color: var(--al-sub); }
.al-stage-kind.active { color: var(--al-accent); background: var(--al-accent-soft); }
.al-stage-kind.error { color: var(--al-danger); background: color-mix(in srgb, var(--al-danger) 10%, transparent); }
.al-stage-title { flex: 1; min-width: 0; font-size: 11.5px; font-weight: 560; color: var(--al-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.al-stage-meta { flex: none; font-size: 10px; color: var(--al-ter); font-variant-numeric: tabular-nums; max-width: 92px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.al-stage-chev { flex: none; color: var(--al-ter); transition: transform .15s ease; }
.al-stage[data-open='true'] .al-stage-chev { transform: rotate(90deg); }
.al-stage-detail {
  margin: 3px 0 0 28px; padding: 8px; border-radius: 8px;
  border: 1px solid var(--al-border); background: color-mix(in srgb, var(--al-layer2) 52%, transparent);
  font-size: 11px; color: var(--al-sub); animation: al-detail-in .16s ease;
}
@keyframes al-detail-in { from { opacity: 0; transform: translateY(-2px); } to { opacity: 1; transform: translateY(0); } }
.al-detail-text { margin: 0; font-size: 11px; line-height: 1.65; white-space: pre-wrap; word-break: break-word; }
.al-detail-row { display: flex; align-items: baseline; gap: 6px; margin-bottom: 5px; }
.al-detail-row:last-child { margin-bottom: 0; }
.al-detail-k { flex: none; font-size: 10px; color: var(--al-ter); min-width: 42px; }
.al-detail-v { flex: 1; min-width: 0; font-size: 11px; color: var(--al-text); word-break: break-word; }
.al-detail-kv { display: flex; flex-wrap: wrap; gap: 4px; }
.al-kv-pill { display: inline-flex; gap: 4px; align-items: baseline; padding: 2px 7px; border-radius: 6px; background: var(--al-layer2); font-size: 10.5px; }
.al-kv-pill b { color: var(--al-accent); font-weight: 600; }
.al-role { display: inline-flex; align-items: center; height: 15px; padding: 0 5px; border-radius: 4px; font-size: 9px; font-weight: 650; letter-spacing: .02em; }
.al-role-user { background: rgba(34, 197, 94, .13); color: #15803d; }
.al-role-assistant { background: rgba(139, 92, 246, .13); color: #7c3aed; }
.al-role-tool { background: rgba(245, 158, 11, .14); color: #b45309; }
.al-role-system { background: rgba(107, 114, 128, .14); color: var(--al-sub); }
.al-stage-io { margin-top: 6px; }
.al-stage-io > * + * { margin-top: 5px; }
.al-mini-msg { display: flex; gap: 5px; align-items: baseline; padding: 2px 0; font-size: 10.5px; line-height: 1.5; }
.al-mini-msg .al-role { flex: none; transform: scale(.92); transform-origin: left center; }
.al-mini-msg span:last-child { color: var(--al-sub); word-break: break-word; }
.al-flow-stats { display: flex; flex-wrap: wrap; gap: 5px 12px; margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--al-border); font-size: 10px; color: var(--al-ter); }
.al-flow-stats b { color: var(--al-text); font-weight: 600; font-variant-numeric: tabular-nums; }

/* context */
.al-budget { padding: 10px 11px; border-radius: 10px; border: 1px solid var(--al-border); background: color-mix(in srgb, var(--al-layer2) 45%, transparent); margin-bottom: 12px; }
.al-budget-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.al-budget-num { font-size: 20px; font-weight: 700; letter-spacing: -.03em; line-height: 1; font-variant-numeric: tabular-nums; }
.al-budget-num span { font-size: 10.5px; font-weight: 500; color: var(--al-ter); letter-spacing: 0; }
.al-budget-sub { font-size: 10px; color: var(--al-ter); text-align: right; line-height: 1.4; }
.al-win-row { display: flex; flex-wrap: wrap; gap: 5px 14px; margin-top: 9px; padding-top: 8px; border-top: 1px dashed var(--al-border); font-size: 10.5px; color: var(--al-sub); }
.al-win-row b { color: var(--al-text); font-weight: 620; font-variant-numeric: tabular-nums; }
.al-win-row .al-win-real b { color: #7c3aed; }
.al-budget-control { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--al-border); }
.al-budget-control span { font-size: 10.5px; color: var(--al-ter); }
.al-budget-control select {
  height: 26px; border: 1px solid var(--al-border2); border-radius: 7px;
  background: var(--al-layer); color: var(--al-text); font-size: 11px; padding: 0 6px;
}
.al-hit-list { display: flex; flex-direction: column; gap: 5px; }
.al-hit { padding: 6px 8px; border-radius: 7px; border: 1px solid color-mix(in srgb, #14b8a6 24%, transparent); background: color-mix(in srgb, #14b8a6 7%, transparent); }
.al-hit b { display: block; font-size: 10px; color: #0f766e; font-weight: 640; }
.al-hit span { font-size: 10.5px; color: var(--al-sub); word-break: break-word; }
.al-summary-box { padding: 8px 10px; border-radius: 8px; border: 1px dashed color-mix(in srgb, var(--al-warn) 40%, transparent); background: color-mix(in srgb, var(--al-warn) 7%, transparent); }
.al-summary-box p { margin: 0; font-size: 10.5px; line-height: 1.6; color: var(--al-sub); white-space: pre-wrap; word-break: break-word; max-height: 130px; overflow: auto; }
.al-msg-list { display: flex; flex-direction: column; gap: 5px; }
.al-msg {
  border: 1px solid var(--al-border); border-radius: 8px; background: color-mix(in srgb, var(--al-layer) 70%, transparent);
  overflow: hidden;
}
.al-msg-head { display: flex; align-items: center; gap: 5px; padding: 5px 7px; background: color-mix(in srgb, var(--al-layer2) 48%, transparent); }
.al-msg-kind { font-size: 9px; color: var(--al-ter); padding: 0 4px; border-radius: 3px; background: var(--al-layer2); }
.al-msg-tok { margin-left: auto; font-size: 9.5px; color: var(--al-ter); font-variant-numeric: tabular-nums; flex: none; }
.al-msg-body {
  padding: 5px 8px 7px; font-size: 10.5px; line-height: 1.58; color: var(--al-sub);
  white-space: pre-wrap; word-break: break-word; max-height: 92px; overflow: hidden;
  display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical;
}
.al-msg-body.open { display: block; max-height: 260px; overflow: auto; }
.al-msg-more { border: 0; background: transparent; color: var(--al-accent); font-size: 10px; padding: 0 8px 6px; }
.al-context-foot { margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--al-border); }

/* memory */
.al-mem-list { display: flex; flex-direction: column; gap: 6px; }
.al-mem {
  display: flex; align-items: flex-start; gap: 7px; padding: 7px 8px;
  border: 1px solid var(--al-border); border-radius: 8px; background: color-mix(in srgb, var(--al-layer2) 40%, transparent);
}
.al-mem-icon { flex: none; width: 20px; height: 20px; border-radius: 6px; display: grid; place-items: center; background: var(--al-accent-soft); color: var(--al-accent); margin-top: 1px; }
.al-mem-main { flex: 1; min-width: 0; }
.al-mem-key { font-size: 11px; font-weight: 620; color: var(--al-text); word-break: break-word; }
.al-mem-value { font-size: 10.5px; color: var(--al-sub); line-height: 1.55; word-break: break-word; margin-top: 1px; white-space: pre-wrap; }
.al-mem-meta { display: flex; align-items: center; gap: 6px; margin-top: 3px; font-size: 9px; color: var(--al-ter); }
.al-mem-del { flex: none; }
.al-mem-del.confirm { color: var(--al-danger); }
.al-mini-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-bottom: 12px; }
`;

const STAGE_META = {
  input: { icon: 'terminal', label: '输入' },
  context: { icon: 'layers', label: '上下文' },
  compress: { icon: 'compress', label: '压缩' },
  model: { icon: 'cpu', label: '模型' },
  tool: { icon: 'tools', label: '工具' },
  memory: { icon: 'memory', label: '记忆' },
  output: { icon: 'send', label: '输出' },
};

function fmtDuration(ms) {
  const value = Math.max(0, Math.round(ms || 0));
  if (value < 1000) return value + ' ms';
  return (value / 1000).toFixed(value < 10000 ? 1 : 0) + ' s';
}

function truncateText(text, max) {
  const value = String(text == null ? '' : text);
  return value.length > max ? value.slice(0, max) + '…' : value;
}

function StageDetail(props) {
  const stage = props.stage;
  const detail = stage.detail;
  if (detail == null) return e('p', { className: 'al-detail-text' }, '（无额外细节）');

  if (stage.kind === 'input') {
    return e('p', { className: 'al-detail-text' }, typeof detail === 'string' ? detail : (detail.text || prettyJson(detail)));
  }

  if (stage.kind === 'context') {
    const info = detail || {};
    return e(
      'div',
      null,
      info.segments
        ? e('div', { style: { marginBottom: 8 } }, e(TokenBar, { segments: info.segments, limit: info.limit, height: 7, showLegend: true }))
        : null,
      e('div', { className: 'al-detail-row' }, e('span', { className: 'al-detail-k' }, '消息'), e('span', { className: 'al-detail-v' }, (info.messageCount != null ? info.messageCount : (info.messages || []).length) + ' 条 · 约 ' + (info.used != null ? info.used : '?') + ' tok')),
      info.hits && info.hits.length
        ? e('div', { className: 'al-detail-row' }, e('span', { className: 'al-detail-k' }, '召回'), e('div', { className: 'al-detail-v al-detail-kv' }, info.hits.map((hit) => e('span', { key: hit.id, className: 'al-kv-pill' }, e('b', null, hit.key), '= ' + truncateText(hit.value, 26)))))
        : null,
      info.summary ? e('div', { className: 'al-detail-row' }, e('span', { className: 'al-detail-k' }, '摘要'), e('span', { className: 'al-detail-v' }, truncateText(info.summary, 160))) : null,
      info.messages && info.messages.length
        ? e('div', { className: 'al-stage-io' }, info.messages.map((message, index) => e('div', { className: 'al-mini-msg', key: index }, e('span', { className: 'al-role al-role-' + (message.role || 'system') }, message.role || 'system'), e('span', null, truncateText(message.content, 110)))))
        : null,
    );
  }

  if (stage.kind === 'compress') {
    return e(
      'div',
      null,
      e('div', { className: 'al-detail-row' }, e('span', { className: 'al-detail-k' }, 'token'), e('span', { className: 'al-detail-v' }, (detail.before != null ? detail.before : '?') + ' → ' + (detail.after != null ? detail.after : '?') + ' tok · 折叠 ' + (detail.removed != null ? detail.removed : '?') + ' 条消息')),
      detail.summary ? e('div', { className: 'al-summary-box' }, e('p', null, detail.summary)) : null,
    );
  }

  if (stage.kind === 'model') {
    const response = detail.response || {};
    const isTool = response.type === 'tool_call';
    return e(
      'div',
      null,
      e('div', { className: 'al-detail-row' }, e('span', { className: 'al-detail-k' }, '第 ' + (detail.step || 1) + ' 步'), e('span', { className: 'al-detail-v' }, isTool ? '模型决定调用工具 ' + response.name : '模型直接给出最终回答')),
      detail.model
        ? e('div', { className: 'al-detail-row' }, e('span', { className: 'al-detail-k' }, '模型'), e('span', { className: 'al-detail-v' }, (detail.model.provider || '') + ' / ' + (detail.model.model || '') + (detail.model.latencyMs != null ? ' · ' + detail.model.latencyMs + ' ms' : '') + (detail.model.usage ? ' · 输入 ' + (detail.model.usage.inputTokens || 0) + ' / 输出 ' + (detail.model.usage.outputTokens || 0) + ' tok' : '')))
        : null,
      isTool
        ? e('div', { className: 'al-stage-io' }, e(JsonView, { value: response.args, style: { maxHeight: 120 } }))
        : e('p', { className: 'al-detail-text' }, truncateText(response.text || '', 260)),
      detail.toolSchemas
        ? e('details', { className: 'al-stage-io' }, e('summary', { className: 'al-insp-note', style: { cursor: 'pointer', marginBottom: 4 } }, '模型这次看到的工具定义（' + detail.toolSchemas.length + ' 个）'), e(JsonView, { value: detail.toolSchemas, style: { maxHeight: 180 } }))
        : null,
      detail.messages
        ? e('details', { className: 'al-stage-io' }, e('summary', { className: 'al-insp-note', style: { cursor: 'pointer', marginBottom: 4 } }, '发给模型的消息（' + detail.messages.length + ' 条）'), e(JsonView, { value: detail.messages, style: { maxHeight: 180 } }))
        : null,
    );
  }

  if (stage.kind === 'tool') {
    const info = detail || {};
    return e(
      'div',
      null,
      e('div', { className: 'al-detail-row' }, e('span', { className: 'al-detail-k' }, '工具'), e('span', { className: 'al-detail-v' }, info.name || stage.title)),
      info.args ? e('div', { className: 'al-stage-io' }, e(JsonView, { value: info.args, style: { maxHeight: 110 } })) : null,
      e('div', { className: 'al-stage-io' }, e('div', { className: 'al-insp-label', style: { marginBottom: 4 } }, info.ok === false ? '结果 · 失败' : '结果'), e(JsonView, { value: info.result, style: { maxHeight: 130 } })),
    );
  }

  if (stage.kind === 'output') {
    return e('p', { className: 'al-detail-text' }, typeof detail === 'string' ? detail : (detail.text || prettyJson(detail)));
  }

  return e(JsonView, { value: detail, style: { maxHeight: 220 } });
}

function StageRow(props) {
  const stage = props.stage;
  const meta = STAGE_META[stage.kind] || STAGE_META.input;
  const open = props.open;
  return e(
    'div',
    { className: 'al-stage', 'data-open': open ? 'true' : 'false' },
    e(
      'div',
      { className: 'al-stage-rail' },
      e('span', { className: 'al-stage-dot ' + (stage.status || '') }),
      e('span', { className: 'al-stage-line' }),
    ),
    e(
      'div',
      { className: 'al-stage-main' },
      e(
        'button',
        { type: 'button', className: 'al-stage-head', onClick: props.onToggle, 'aria-expanded': open ? 'true' : 'false' },
        e('span', { className: 'al-stage-kind ' + (stage.status || '') }, e(Icon, { name: meta.icon, size: 12 })),
        e('span', { className: 'al-stage-title' }, stage.title || meta.label),
        e('span', { className: 'al-stage-meta' }, stage.meta || ''),
        e('span', { className: 'al-stage-chev' }, e(Icon, { name: 'chevronRight', size: 12 })),
      ),
      open ? e('div', { className: 'al-stage-detail' }, e(StageDetail, { stage })) : null,
    ),
  );
}

function FlowTab(props) {
  const view = props.view;
  const turn = view.turn;
  const [openId, setOpenId] = useState(null);
  const activeStage = turn ? (turn.stages || []).slice().reverse().find((stage) => stage.status === 'active') : null;
  const activeId = activeStage ? activeStage.id : null;

  useEffect(() => {
    if (!turn) {
      setOpenId(null);
      return;
    }
    if (activeId) setOpenId(activeId);
  }, [turn && turn.id, activeId]);

  if (!turn) {
    return e(
      'div',
      null,
      e(
        'div',
        { className: 'al-flow-head' },
        e(Chip, { tone: 'brand', icon: 'route' }, '等待输入'),
        e('span', { className: 'al-insp-note' }, '实时'),
      ),
      e(Empty, {
        icon: 'route',
        title: '还没有处理链路',
        body: '在左边终端发一条消息，这里会逐步出现：输入 → 上下文组装 → 模型推理 → 工具执行 → 记忆 → 输出。点任一环节可展开细节。',
      }),
      e(
        'div',
        { className: 'al-insp-section', style: { marginTop: 10 } },
        e('div', { className: 'al-insp-label' }, '一轮消息里发生了什么'),
        e(
          'div',
          { className: 'al-stages-preview', style: { display: 'flex', flexDirection: 'column', gap: 7 } },
          [
            ['terminal', '输入被追加到会话日志'],
            ['layers', '系统提示 + 摘要 + 召回记忆 + 最近消息 → 上下文'],
            ['compress', '超过 token 预算时，旧消息折叠成摘要'],
            ['cpu', '模型只返回「工具调用」或「最终回答」'],
            ['tools', '框架执行工具，把结果作为消息写回上下文'],
            ['memory', '需要记住的事实写进跨会话长期记忆'],
            ['send', '最终回答流式显示，并持久化整个会话'],
          ].map((row) =>
            e(
              'div',
              { key: row[1], style: { display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 10.5, color: 'var(--al-sub)', lineHeight: 1.5 } },
              e('span', { style: { color: 'var(--al-accent)', flex: 'none', marginTop: 1 } }, e(Icon, { name: row[0], size: 12 })),
              e('span', null, row[1]),
            ),
          ),
        ),
      ),
    );
  }

  const stages = turn.stages || [];
  const toolCalls = stages.filter((stage) => stage.kind === 'tool').length;
  const modelCalls = stages.filter((stage) => stage.kind === 'model').length;
  const duration = turn.endedAt ? turn.endedAt - turn.startedAt : Date.now() - turn.startedAt;

  return e(
    'div',
    null,
    e(
      'div',
      { className: 'al-flow-head' },
      e(Chip, { tone: turn.status === 'running' ? 'brand' : turn.status === 'error' ? 'danger' : 'good', icon: turn.status === 'running' ? 'bolt' : turn.status === 'error' ? 'alert' : 'check' }, turn.status === 'running' ? '运行中' : turn.status === 'error' ? '出错' : '完成'),
      e(Chip, { tone: view.modelMode === 'real' ? 'violet' : 'neutral', icon: view.modelMode === 'real' ? 'bolt' : 'cpu' }, view.modelMode === 'real' ? '真实模型' : '模拟模型'),
      e('span', { className: 'al-insp-note' }, fmtDuration(duration)),
    ),
    e('div', { className: 'al-flow-input' }, e('b', null, '用户输入'), turn.input),
    e(
      'div',
      null,
      stages.map((stage) =>
        e(StageRow, {
          key: stage.id,
          stage,
          open: openId === stage.id,
          onToggle: () => setOpenId(openId === stage.id ? null : stage.id),
        }),
      ),
    ),
    e(
      'div',
      { className: 'al-flow-stats' },
      e('span', null, '模型调用 ', e('b', null, String(modelCalls))),
      e('span', null, '工具调用 ', e('b', null, String(toolCalls))),
      e('span', null, '上下文 ', e('b', null, (view.context ? view.context.used : '?') + ' tok')),
      e('span', null, '压缩 ', e('b', null, String(view.stats ? view.stats.compressions : 0))),
    ),
    e(
      'div',
      { className: 'al-insp-section', style: { marginTop: 10 } },
      e('div', { className: 'al-insp-note' }, '提示：模型只看得到「上下文」里的消息；工具结果必须写回上下文，模型才能继续。'),
    ),
  );
}

function ContextMsg(props) {
  const message = props.message;
  const [open, setOpen] = useState(false);
  const content = message.content || '';
  const canExpand = content.length > 180;
  return e(
    'div',
    { className: 'al-msg' },
    e(
      'div',
      { className: 'al-msg-head' },
      e('span', { className: 'al-role al-role-' + (message.role || 'system') }, message.role || 'system'),
      message.kind ? e('span', { className: 'al-msg-kind' }, message.kind) : null,
      message.toolName ? e('span', { className: 'al-msg-kind' }, message.toolName) : null,
      e('span', { className: 'al-msg-tok' }, message.tokens + ' tok'),
    ),
    e('div', { className: 'al-msg-body' + (open ? ' open' : '') }, content || '（空）'),
    canExpand ? e('button', { type: 'button', className: 'al-msg-more', onClick: () => setOpen(!open) }, open ? '收起' : '展开全文') : null,
  );
}

function ContextTab(props) {
  const view = props.view;
  const budgetOptions = [1000, 2000, 8000, 32000, 128000, 1048576];
  const context = view.context || { limit: 0, used: 0, segments: [], hits: [], summary: null };
  const messages = view.messages || [];
  const pct = context.limit > 0 ? Math.round((context.used / context.limit) * 100) : 0;
  return e(
    'div',
    null,
    e(
      'div',
      { className: 'al-budget' },
      e(
        'div',
        { className: 'al-budget-top' },
        e('div', { className: 'al-budget-num' }, String(context.used), e('span', null, ' / ' + context.limit + ' tok')),
        e('div', { className: 'al-budget-sub' }, '预算占用 ' + pct + '%', e('br'), '超出 90% 自动压缩'),
      ),
      e(TokenBar, { segments: context.segments || [], limit: context.limit, height: 9 }),
      e(
        'div',
        { className: 'al-win-row' },
        e('span', null, '教学预算 ', e('b', null, alFormatTokens(context.limit) + ' tok')),
        e(
          'span',
          { className: 'al-win-real' },
          '真实模型窗口 ',
          e('b', null, view.model && view.model.contextWindow ? alFormatTokens(view.model.contextWindow) + ' tok' : '—'),
        ),
        view.model && view.model.maxOutputTokens
          ? e('span', null, '输出上限 ', e('b', null, alFormatTokens(view.model.maxOutputTokens) + ' tok'))
          : null,
      ),
      e(
        'div',
        { className: 'al-budget-control' },
        e('span', null, '教学预算（实时生效）'),
        e(
          'select',
          {
            value: context.limit,
            onChange: (event) => props.onBudget && props.onBudget(Number(event.target.value)),
            title: '调整教学上下文预算；数值越大压缩触发越少',
          },
          (budgetOptions.indexOf(context.limit) >= 0 ? budgetOptions : budgetOptions.concat([context.limit]))
            .filter((n) => Number.isFinite(n) && n > 0)
            .map((n) => e('option', { key: n, value: n }, alFormatTokens(n) + ' tok')),
        ),
      ),
      e(
        'div',
        { className: 'al-insp-note', style: { marginTop: 5 } },
        '压缩阈值基于教学预算；真实模型窗口来自 DSH 模型元数据，只作参考。默认 8000 tok，可按需调大。',
      ),
    ),
    e(
      'div',
      { className: 'al-insp-section' },
      e('div', { className: 'al-insp-label' }, e('span', null, '本轮自动召回'), e(Chip, { tone: (context.hits || []).length ? 'good' : 'neutral' }, String((context.hits || []).length) + ' 条')),
      (context.hits || []).length
        ? e('div', { className: 'al-hit-list' }, context.hits.map((hit) => e('div', { key: hit.id, className: 'al-hit' }, e('b', null, hit.key), e('span', null, hit.value))))
        : e('div', { className: 'al-insp-note' }, '没有匹配的长期记忆。长期记忆只在关键词相关时才会注入，避免污染上下文。'),
    ),
    e(
      'div',
      { className: 'al-insp-section' },
      e('div', { className: 'al-insp-label' }, e('span', null, '历史摘要 · 关键内容 / 未完成任务 / 下一步'), context.summary ? e(Chip, { tone: 'warn' }, '已生效') : null),
      context.summary
        ? e('div', { className: 'al-summary-box' }, e('p', null, context.summary))
        : e('div', { className: 'al-insp-note' }, '还没有压缩。等上下文接近预算，旧消息会被折叠成摘要；也可以点终端里的 /compact。'),
    ),
    e(
      'div',
      { className: 'al-insp-section' },
      e('div', { className: 'al-insp-label' }, e('span', null, '模型将看到的完整消息'), e('span', { className: 'al-insp-note' }, String(messages.length) + ' 条')),
      messages.length
        ? e('div', { className: 'al-msg-list' }, messages.map((message) => e(ContextMsg, { key: message.id, message })))
        : e('div', { className: 'al-insp-note' }, '还没有消息。'),
      e(
        'div',
        { className: 'al-context-foot al-insp-note' },
        '顺序：system 提示 → 历史摘要 → 召回记忆 → 对话消息 → 本轮输入。工具调用和结果也是消息，所以模型能「看见」自己刚才做了什么。',
      ),
    ),
  );
}

function MemoryTab(props) {
  const view = props.view;
  const memory = view.memory || [];
  const [confirmId, setConfirmId] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const stats = view.stats || {};
  const session = (view.sessions || []).find((item) => item.id === view.activeId);
  return e(
    'div',
    null,
    e(
      'div',
      { className: 'al-mini-stats' },
      e(Stat, { value: String(memory.length), label: '长期记忆' }),
      e(Stat, { value: String((view.messages || []).length), label: '本会话消息' }),
      e(Stat, { value: String(stats.compressions || 0), label: '累计压缩' }),
    ),
    e(
      'div',
      { className: 'al-insp-section' },
      e('div', { className: 'al-insp-label' }, e('span', null, '长期记忆 · 跨会话'), e(Chip, { tone: 'violet', icon: 'memory' }, 'localStorage')),
      memory.length
        ? e(
            'div',
            { className: 'al-mem-list' },
            memory.map((entry) =>
              e(
                'div',
                { key: entry.id, className: 'al-mem' },
                e('span', { className: 'al-mem-icon' }, e(Icon, { name: 'key', size: 11 })),
                e(
                  'div',
                  { className: 'al-mem-main' },
                  e('div', { className: 'al-mem-key' }, entry.key),
                  e('div', { className: 'al-mem-value' }, entry.value),
                  e(
                    'div',
                    { className: 'al-mem-meta' },
                    e('span', null, entry.source || '记忆工具'),
                    e('span', null, '·'),
                    e('span', null, fmtTime(entry.updatedAt || entry.createdAt)),
                  ),
                ),
                e(IconBtn, {
                  icon: confirmId === entry.id ? 'alert' : 'trash',
                  size: 13,
                  danger: confirmId === entry.id,
                  className: 'al-mem-del' + (confirmId === entry.id ? ' confirm' : ''),
                  title: confirmId === entry.id ? '再点一次删除' : '删除这条记忆',
                  onClick: () => {
                    if (confirmId === entry.id) {
                      props.onDeleteMemory(entry.id);
                      setConfirmId(null);
                    } else {
                      setConfirmId(entry.id);
                    }
                  },
                }),
              ),
            ),
          )
        : e(Empty, { icon: 'memory', title: '还没有长期记忆', body: '对它说「记住 我的项目代号是 Orion」，下次换一个会话它也能想起来。' }),
    ),
    e(
      'div',
      { className: 'al-insp-section' },
      e('div', { className: 'al-insp-label' }, e('span', null, '短期记忆 · 当前会话'), session ? e('span', { className: 'al-insp-note' }, session.messageCount + ' 条 / ' + session.tokens + ' tok') : null),
      e('div', { className: 'al-insp-note' }, '短期记忆就是当前会话的消息窗口：每次请求都会把最近的消息重新发回模型。窗口满之前靠压缩摘要续命，跨会话则靠上面的长期记忆。'),
      e(
        'div',
        { style: { marginTop: 8 } },
        confirmClear
          ? e(
              'div',
              { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
              e(Btn, { size: 'sm', variant: 'danger', onClick: () => { props.onClearMemory(); setConfirmClear(false); } }, '确认清空 ' + memory.length + ' 条'),
              e(Btn, { size: 'sm', variant: 'ghost', onClick: () => setConfirmClear(false) }, '取消'),
            )
          : e(Btn, { size: 'sm', variant: 'ghost', icon: 'trash', disabled: memory.length === 0, onClick: () => setConfirmClear(true) }, '清空长期记忆'),
      ),
    ),
    e(
      'div',
      { className: 'al-insp-section' },
      e('div', { className: 'al-insp-label' }, '记忆的写入路径'),
      e('div', { className: 'al-insp-note' }, '模型决定调用 memory_write → 工具把 key/value 写进长期记忆 → 下一轮按输入关键词召回并注入 system 消息。所有过程都能在「流转」里看到。'),
    ),
  );
}

function Inspector(props) {
  const view = props.view;
  const tab = props.tab;
  const memoryCount = (view.memory || []).length;
  const context = view.context || { used: 0 };
  const stages = view.turn ? (view.turn.stages || []).length : 0;
  return e(
    'section',
    { className: 'al-panel al-inspector-panel', 'aria-label': '检查器' },
    e(
      'header',
      { className: 'al-panel-head' },
      e('div', { className: 'al-panel-title' }, e(Icon, { name: 'search', size: 14 }), '检查器', e('span', { className: 'al-panel-sub' }, '实时')),
      e(Chip, { tone: view.busy ? 'brand' : 'neutral', icon: view.busy ? 'bolt' : 'check' }, view.busy ? '运行中' : '空闲'),
    ),
    e(
      'div',
      { className: 'al-inspector-tabs', role: 'tablist', 'aria-label': '检查器视图' },
      [
        { id: 'flow', icon: 'route', label: '流转', badge: stages || null },
        { id: 'context', icon: 'layers', label: '上下文', badge: context.used + '' },
        { id: 'memory', icon: 'memory', label: '记忆', badge: memoryCount + '' },
      ].map((item) =>
        e(
          'button',
          { key: item.id, type: 'button', role: 'tab', 'aria-selected': tab === item.id, className: 'al-itab' + (tab === item.id ? ' on' : ''), onClick: () => props.onTab(item.id) },
          e(Icon, { name: item.icon, size: 12 }),
          item.label,
          item.badge ? e('span', { className: 'al-itab-badge' }, item.badge) : null,
        ),
      ),
    ),
    e(
      'div',
      { className: 'al-insp-body' },
      tab === 'flow' ? e(FlowTab, { view }) : tab === 'context' ? e(ContextTab, { view, onBudget: props.onBudget }) : e(MemoryTab, { view, onDeleteMemory: props.onDeleteMemory, onClearMemory: props.onClearMemory }),
    ),
  );
}
