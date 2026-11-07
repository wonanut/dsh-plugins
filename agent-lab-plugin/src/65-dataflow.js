/* ─────────────────────────────────────────────────────────────
 * Agent 实验室 · 数据流转视图
 * 把当前轮次的 turn.stages 渲染成一条可点击、可回放的流水线：
 * 每一步的输入、上下文、模型响应、工具结果、记忆写入与输出都能单独查看。
 * 数据全部来自 snapshot().turn.stages[].detail —— 与检查器同一份事实来源。
 * ───────────────────────────────────────────────────────────── */

const DF_BUDGETS = [1000, 2000, 8000, 32000, 128000, 1048576];

const DF_STAGE_META = {
  input: { icon: 'terminal', label: '输入', tone: 'neutral' },
  context: { icon: 'layers', label: '上下文', tone: 'brand' },
  compress: { icon: 'compress', label: '压缩', tone: 'warn' },
  model: { icon: 'cpu', label: '模型', tone: 'violet' },
  tool: { icon: 'tools', label: '工具', tone: 'warn' },
  memory: { icon: 'memory', label: '记忆', tone: 'good' },
  output: { icon: 'send', label: '输出', tone: 'good' },
};

const DF_EXPLAIN = {
  input: '用户输入被记录为一条 user 消息，并创建本轮 turn。它后面的所有步骤都以这条消息为起点。',
  context: '引擎把 system prompt、历史摘要、长期记忆、最近消息和本轮输入拼成一次模型请求。右侧「结构化数据」里的 segments 就是这次请求的 token 构成。',
  compress: '上下文接近预算时，旧消息被折叠进历史摘要。before / after 是压缩前后的真实需求 token；removed 是被折叠的消息。',
  model: '模型只做一次决策：返回一句最终回答，或者发起工具调用。真实模式下这里还能看到 provider、model、耗时与 token 用量。',
  tool: '工具由插件执行，不是模型执行。模型只给出 name + args；结果作为 tool 消息写回上下文，供下一步模型读取。',
  memory: 'memory_write 成功后，插件把这条事实写入跨会话长期记忆；下一轮组装上下文时可能被关键词召回。',
  output: '最终回答写回会话并流式显示；同时重新组装一次上下文，让检查器看到本轮结束后的真实占用。',
};

const DF_CSS = `
.df-page {
  --df-line: var(--al-border);
  max-width: 1180px; margin: 0 auto; padding: 4px 4px 66px;
  color: var(--al-text); font-size: 13px;
}
.df-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; flex-wrap: wrap; padding: 14px 2px 18px; border-bottom: 1px solid var(--df-line); }
.df-eyebrow { font-family: var(--al-mono); font-size: 10px; letter-spacing: .16em; color: var(--al-ter); font-weight: 600; text-transform: uppercase; }
.df-title { margin: 7px 0 6px; font-size: 26px; line-height: 1.25; letter-spacing: -.02em; font-weight: 700; }
.df-sub { margin: 0; color: var(--al-sub); font-size: 12.5px; line-height: 1.7; max-width: 72ch; }
.df-head-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.df-budget { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 8px; border: 1px solid var(--al-border); border-radius: 9px; background: var(--al-layer); font-size: 11px; color: var(--al-sub); }
.df-budget select { height: 24px; border: 1px solid var(--al-border2); border-radius: 6px; background: var(--al-layer2); color: var(--al-text); font-size: 11px; padding: 0 4px; }
.df-controls { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 14px 2px 4px; }
.df-replay { display: flex; align-items: center; gap: 5px; }
.df-replay .al-btn { height: 30px; }
.df-stepinfo { font-size: 11px; color: var(--al-ter); font-variant-numeric: tabular-nums; }
.df-flow {
  display: flex; align-items: stretch; gap: 0; overflow-x: auto; padding: 12px 2px 14px;
  scrollbar-width: thin;
}
.df-node {
  flex: none; width: 118px; display: flex; flex-direction: column; gap: 5px; align-items: flex-start;
  padding: 9px 10px; border: 1px solid var(--al-border); border-radius: 10px;
  background: color-mix(in srgb, var(--al-layer) 86%, transparent);
  color: var(--al-text); text-align: left; position: relative;
  transition: border-color .15s ease, background .15s ease, transform .15s ease, box-shadow .15s ease;
}
.df-node:hover { border-color: var(--al-border2); transform: translateY(-1px); }
.df-node.on { border-color: var(--al-accent); background: var(--al-accent-soft); box-shadow: 0 0 0 1px var(--al-accent) inset; }
.df-node .df-node-top { display: flex; align-items: center; gap: 5px; width: 100%; }
.df-node .df-node-kind { font-size: 9px; font-weight: 650; letter-spacing: .04em; color: var(--al-ter); }
.df-node.on .df-node-kind { color: var(--al-accent); }
.df-node .df-node-title { font-size: 11.5px; font-weight: 600; line-height: 1.35; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; }
.df-node .df-node-meta { font-size: 9.5px; color: var(--al-ter); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; font-variant-numeric: tabular-nums; }
.df-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--al-ter); flex: none; }
.df-dot.done { background: var(--al-good); }
.df-dot.active { background: var(--al-accent); animation: al-stage-pulse 1.6s infinite; }
.df-dot.error { background: var(--al-danger); }
.df-arrow { align-self: center; flex: none; padding: 0 4px; color: var(--al-ter); font-size: 12px; user-select: none; }
.df-body { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(260px, .85fr); gap: 13px; align-items: start; }
.df-card { border: 1px solid var(--al-border); border-radius: 13px; background: color-mix(in srgb, var(--al-layer) 88%, transparent); overflow: hidden; }
.df-card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 12px; border-bottom: 1px solid var(--al-border); }
.df-card-title { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 640; }
.df-card-title svg { color: var(--al-accent); }
.df-card-meta { font-size: 10px; color: var(--al-ter); font-variant-numeric: tabular-nums; }
.df-card-body { padding: 11px 12px 13px; }
.df-explain { margin: 0 0 10px; padding: 8px 10px; border-left: 3px solid var(--al-accent); border-radius: 0 7px 7px 0; background: var(--al-accent-soft); color: var(--al-sub); font-size: 11.5px; line-height: 1.65; }
.df-row { display: flex; align-items: flex-start; gap: 8px; padding: 4px 0; border-bottom: 1px dashed color-mix(in srgb, var(--al-border) 70%, transparent); }
.df-row:last-child { border-bottom: 0; }
.df-k { flex: none; width: 56px; padding-top: 8px; font-size: 10px; color: var(--al-ter); }
.df-v { flex: 1; min-width: 0; font-size: 11.5px; color: var(--al-text); word-break: break-word; }
.df-text { display: block; margin: 0; padding: 8px 9px; border-radius: 8px; background: var(--al-layer2); border: 1px solid var(--al-border); font-family: var(--al-mono); font-size: 11px; line-height: 1.65; white-space: pre-wrap; word-break: break-word; max-height: 240px; overflow: auto; }
.df-msgs { display: flex; flex-direction: column; gap: 5px; }
.df-msg { display: flex; gap: 6px; align-items: flex-start; padding: 4px 6px; border-radius: 6px; background: color-mix(in srgb, var(--al-layer2) 55%, transparent); }
.df-msg .al-role { flex: none; margin-top: 1px; }
.df-msg span:last-child { font-size: 10.5px; line-height: 1.55; color: var(--al-sub); word-break: break-word; }
.df-hits { display: flex; flex-direction: column; gap: 4px; }
.df-hit { font-size: 10.5px; padding: 5px 7px; border-radius: 6px; background: color-mix(in srgb, #14b8a6 8%, transparent); border: 1px solid color-mix(in srgb, #14b8a6 22%, transparent); }
.df-hit b { color: #0f766e; }
.df-note { margin-top: 10px; font-size: 10.5px; color: var(--al-ter); line-height: 1.6; }
.df-empty { padding: 50px 0; }
.df-raw .al-json { max-height: 420px; margin: 0; }
@media (max-width: 900px) {
  .df-body { grid-template-columns: minmax(0, 1fr); }
  .df-title { font-size: 22px; }
  .df-node { width: 106px; }
}
`;

function dfToneClass(tone) {
  return tone === 'brand' ? 'al-chip-brand'
    : tone === 'warn' ? 'al-chip-warn'
      : tone === 'good' ? 'al-chip-good'
        : tone === 'violet' ? 'al-chip-violet' : '';
}

function dfRoleLabel(role) {
  if (role === 'user') return 'user';
  if (role === 'assistant') return 'assistant';
  if (role === 'tool') return 'tool';
  return role || 'system';
}

function dfTokenText(tokens) {
  return tokens === null || tokens === undefined ? '—' : alFormatTokens(tokens) + ' tok';
}

function DFStageDetail(props) {
  const stage = props.stage;
  const detail = stage.detail || {};
  const view = props.view;
  if (stage.kind === 'input') {
    return e('div', null,
      e(DFRow, { label: '输入' }, e('span', { className: 'df-text' }, detail.text || view.turn.input)),
      e(DFRow, { label: '规模' }, (detail.chars || 0) + ' 字 · ' + dfTokenText(detail.tokens)),
    );
  }
  if (stage.kind === 'context') {
    return e('div', null,
      e(TokenBar, { segments: detail.segments || [], limit: detail.limit || view.context.limit, height: 8 }),
      e(DFRow, { label: '消息' }, String(detail.messageCount || 0) + ' 条 · ' + dfTokenText(detail.used)),
      detail.summary ? e(DFRow, { label: '摘要' }, e('span', { className: 'df-text', style: { maxHeight: 130 } }, detail.summary)) : null,
      (detail.hits || []).length
        ? e(DFRow, { label: '召回' }, e('div', { className: 'df-hits' }, detail.hits.map((hit) => e('div', { key: hit.id, className: 'df-hit' }, e('b', null, hit.key), '：' + hit.value))))
        : e(DFRow, { label: '召回' }, '本轮没有召回长期记忆'),
    );
  }
  if (stage.kind === 'compress') {
    return e('div', null,
      e(DFRow, { label: '前后' }, (detail.before || 0) + ' → ' + (detail.after || 0) + ' tok'),
      e(DFRow, { label: '折叠' }, String(detail.removed || 0) + ' 条消息 · 保留最近 ' + String(detail.keep || 0) + ' 条'),
      e(DFRow, { label: '触发' }, detail.reason === 'manual' ? '手动 /compact' : '自动（超过预算 90%）'),
      detail.summary ? e(DFRow, { label: '摘要' }, e('span', { className: 'df-text', style: { maxHeight: 150 } }, detail.summary)) : null,
    );
  }
  if (stage.kind === 'model') {
    const response = detail.response || {};
    const real = detail.model;
    return e('div', null,
      e(DFRow, { label: '步骤' }, '第 ' + String(detail.step || 1) + ' 步'),
      real
        ? e(DFRow, { label: '真实模型' }, (real.provider || '') + ' / ' + (real.model || '') + (real.latencyMs != null ? ' · ' + real.latencyMs + ' ms' : ''))
        : e(DFRow, { label: '模型' }, '本地规则模拟模型'),
      real && real.usage
        ? e(DFRow, { label: '用量' }, '输入 ' + (real.usage.inputTokens || 0) + ' / 输出 ' + (real.usage.outputTokens || 0) + ' tok')
        : null,
      e(DFRow, { label: '响应' }, response.type === 'tool_call'
        ? 'tool_call · ' + response.name + ' ' + JSON.stringify(response.args || {})
        : ('final · ' + (response.text || ''))),
      (detail.messages || []).length
        ? e(DFRow, { label: '请求消息' }, e('div', { className: 'df-msgs' }, detail.messages.map((message, index) => e('div', { key: index, className: 'df-msg' },
            e('span', { className: 'al-role al-role-' + dfRoleLabel(message.role) }, dfRoleLabel(message.role)),
            e('span', null, (message.content || '').slice(0, 160)),
          ))))
        : null,
      e(DFRow, { label: '工具' }, String((detail.toolSchemas || []).length) + ' 个 schema 随请求发送'),
    );
  }
  if (stage.kind === 'tool') {
    return e('div', null,
      e(DFRow, { label: '工具' }, detail.name || stage.title),
      e(DFRow, { label: '参数' }, e(JsonView, { value: detail.args || {}, style: { maxHeight: 130 } })),
      e(DFRow, { label: '结果' }, e(JsonView, { value: detail.result, style: { maxHeight: 160 } })),
      e(DFRow, { label: '状态' }, detail.ok ? '成功 · ' + (detail.durationMs != null ? detail.durationMs + ' ms' : '') : '失败'),
    );
  }
  if (stage.kind === 'memory') {
    return e('div', null,
      e(DFRow, { label: '写入' }, (detail.key || '') + ' = ' + (detail.value || '')),
      e(DFRow, { label: '记忆 ID' }, detail.id || '—'),
    );
  }
  if (stage.kind === 'output') {
    return e('div', null,
      e(DFRow, { label: '回答' }, e('span', { className: 'df-text', style: { maxHeight: 220 } }, detail.text || '')),
      e(DFRow, { label: '本轮' }, String(detail.steps || 0) + ' 步 · ' + String(detail.toolCalls || 0) + ' 次工具 · ' + dfTokenText(detail.tokens)),
    );
  }
  return e(JsonView, { value: detail });
}

function DFRow(props) {
  return e('div', { className: 'df-row' }, e('span', { className: 'df-k' }, props.label), e('div', { className: 'df-v' }, props.children));
}

function DataFlowPage(props) {
  const view = props.view;
  const turn = view.turn;
  const stages = turn ? turn.stages || [] : [];
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef(null);

  const lastActive = useMemo(() => {
    for (let i = stages.length - 1; i >= 0; i -= 1) if (stages[i].status === 'active') return i;
    return stages.length ? stages.length - 1 : 0;
  }, [stages]);

  useEffect(() => {
    setSelected(stages.length ? lastActive : 0);
    setPlaying(false);
  }, [turn && turn.id]);

  useEffect(() => {
    if (turn && turn.status === 'running' && stages.length) setSelected(stages.length - 1);
  }, [stages.length, turn && turn.status]);

  useEffect(() => {
    if (!playing) {
      if (timer.current) { clearInterval(timer.current); timer.current = null; }
      return undefined;
    }
    timer.current = setInterval(() => {
      setSelected((prev) => {
        if (prev >= stages.length - 1) { setPlaying(false); return prev; }
        return prev + 1;
      });
    }, 900);
    return () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
  }, [playing, stages.length]);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const current = stages[selected] || null;
  const meta = current ? DF_STAGE_META[current.kind] || DF_STAGE_META.input : DF_STAGE_META.input;
  const options = (DF_BUDGETS.indexOf(view.context.limit) >= 0 ? DF_BUDGETS : DF_BUDGETS.concat([view.context.limit])).filter((n) => Number.isFinite(n) && n > 0);

  return e(
    'div',
    { className: 'df-page' },
    e('style', { dangerouslySetInnerHTML: { __html: DF_CSS } }),
    e(
      'header',
      { className: 'df-head' },
      e(
        'div',
        null,
        e('div', { className: 'df-eyebrow' }, 'AGENT DATAFLOW'),
        e('h1', { className: 'df-title' }, 'Agent 数据流转'),
        e('p', { className: 'df-sub' }, '还原当前轮次的每一个小步骤：输入、上下文拼装、压缩、模型请求与响应、工具执行、记忆写入、输出。点节点可跳转，也可以逐步回放。'),
      ),
      e(
        'div',
        { className: 'df-head-actions' },
        e(
          'label',
          { className: 'df-budget' },
          '教学预算',
          e(
            'select',
            { value: view.context.limit, onChange: (event) => props.onBudget && props.onBudget(Number(event.target.value)) },
            options.map((n) => e('option', { key: n, value: n }, alFormatTokens(n) + ' tok')),
          ),
        ),
        e(Chip, { tone: turn && turn.status === 'running' ? 'brand' : turn && turn.status === 'error' ? 'danger' : 'good', icon: turn && turn.status === 'running' ? 'bolt' : 'check' }, turn ? (turn.status === 'running' ? '运行中' : turn.status === 'error' ? '出错' : '完成') : '等待输入'),
        e(Chip, { icon: 'layers' }, view.modelMode === 'real' ? '真实模型' : '模拟模型'),
      ),
    ),
    !turn
      ? e('div', { className: 'df-empty' }, e(Empty, { icon: 'route', title: '还没有可回放的数据', body: '先到「体验 TUI」发一条消息；这里会把本轮从输入到输出的每一步展开，可逐节点查看数据。' }))
      : e(
          'div',
          null,
          e(
            'div',
            { className: 'df-controls' },
            e(
              'div',
              { className: 'df-replay' },
              e(Btn, { size: 'sm', variant: 'ghost', icon: 'chevronLeft', disabled: selected <= 0, onClick: () => { setPlaying(false); setSelected(Math.max(0, selected - 1)); } }, '上一步'),
              e(Btn, { size: 'sm', variant: playing ? 'soft' : 'primary', icon: playing ? 'pause' : 'play', onClick: () => { if (selected >= stages.length - 1) setSelected(0); setPlaying(!playing); } }, playing ? '暂停' : '播放'),
              e(Btn, { size: 'sm', variant: 'ghost', icon: 'chevronRight', disabled: selected >= stages.length - 1, onClick: () => { setPlaying(false); setSelected(Math.min(stages.length - 1, selected + 1)); } }, '下一步'),
            ),
            e('div', { className: 'df-stepinfo' }, '第 ' + String(selected + 1) + ' / ' + String(stages.length) + ' 步 · ' + (current ? current.title : '') + (turn.status === 'running' ? ' · 实时跟随中' : '')),
          ),
          e(
            'div',
            { className: 'df-flow' },
            stages.map((stage, index) =>
              e(
                'div',
                { key: stage.id, style: { display: 'flex', alignItems: 'stretch' } },
                e(
                  'button',
                  {
                    type: 'button',
                    className: 'df-node' + (index === selected ? ' on' : ''),
                    onClick: () => { setPlaying(false); setSelected(index); },
                    title: stage.title,
                  },
                  e('div', { className: 'df-node-top' },
                    e('span', { className: 'df-dot ' + (stage.status || '') }),
                    e('span', { className: 'df-node-kind' }, (DF_STAGE_META[stage.kind] || DF_STAGE_META.input).label),
                  ),
                  e('span', { className: 'df-node-title' }, stage.title),
                  e('span', { className: 'df-node-meta' }, stage.meta || ''),
                ),
                index < stages.length - 1 ? e('span', { className: 'df-arrow' }, '→') : null,
              ),
            ),
          ),
          e(
            'div',
            { className: 'df-body' },
            e(
              'section',
              { className: 'df-card' },
              e(
                'div',
                { className: 'df-card-head' },
                e('div', { className: 'df-card-title' }, e(Icon, { name: meta.icon, size: 14 }), '第 ' + String(selected + 1) + ' 步 · ' + (current ? current.title : '')),
                e('span', { className: 'df-card-meta' }, (current && current.meta) || ''),
              ),
              e(
                'div',
                { className: 'df-card-body' },
                e('p', { className: 'df-explain' }, DF_EXPLAIN[current ? current.kind : 'input'] || ''),
                current ? e(DFStageDetail, { stage: current, view }) : null,
              ),
            ),
            e(
              'aside',
              { className: 'df-card df-raw' },
              e('div', { className: 'df-card-head' }, e('div', { className: 'df-card-title' }, e(Icon, { name: 'code', size: 13 }), '结构化数据'), e('span', { className: 'df-card-meta' }, 'stage.detail')),
              e('div', { className: 'df-card-body' }, e(JsonView, { value: current ? current.detail : null, style: { maxHeight: 420 } })),
            ),
          ),
          e('p', { className: 'df-note' }, '数据来源：lab.snapshot().turn.stages[].detail；页面只渲染快照，不额外编造状态。运行中会自动跟随最新步骤；点击任意节点或「上一步 / 下一步」可脱离实时回看。'),
        ),
  );
}
