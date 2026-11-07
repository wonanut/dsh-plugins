/* ─────────────────────────────────────────────────────────────
 * Agent 实验室 · 模拟 TUI 终端
 * A dark terminal-styled chat surface. Everything rendered here comes from
 * lab.snapshot().transcript, so the terminal shows the same events the engine
 * actually emits (context assembly, tool calls, memory writes, compaction).
 * ───────────────────────────────────────────────────────────── */

const TUI_CSS = `
.al-tui-panel {
  grid-area: tui;
  --t-bg: #0b0e14;
  --t-bg2: #0f1420;
  --t-bg3: #151c2c;
  --t-text: #d7dee9;
  --t-dim: #7d8798;
  --t-border: #1e2735;
  --t-green: #7ee787;
  --t-blue: #79c0ff;
  --t-purple: #d2a8ff;
  --t-amber: #ffa657;
  --t-red: #ff7b72;
  --t-cyan: #56d4dd;
  --t-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  height: 100%;
  min-height: 0;
  border-color: #1b2432;
  background: var(--t-bg);
  box-shadow: 0 24px 60px -34px rgba(3, 7, 18, .72), 0 0 0 1px rgba(255, 255, 255, .02) inset;
}
.al-tui-panel .al-panel-head {
  background: linear-gradient(180deg, #111827, #0d1422);
  border-bottom-color: var(--t-border);
  min-height: 44px;
  padding-left: 12px;
}
.al-term-dots { display: flex; align-items: center; gap: 5px; margin-right: 2px; }
.al-term-dots i { width: 9px; height: 9px; border-radius: 50%; display: block; }
.al-term-dots i:nth-child(1) { background: #ff5f57; }
.al-term-dots i:nth-child(2) { background: #febc2e; }
.al-term-dots i:nth-child(3) { background: #28c840; }
.al-term-title { font-family: var(--t-mono); font-size: 11.5px; color: #94a3b8; letter-spacing: .02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.al-term-title b { color: #e2e8f0; font-weight: 600; }
.al-term-headright { display: flex; align-items: center; gap: 8px; flex: none; }
.al-live {
  display: inline-flex; align-items: center; gap: 5px; height: 22px; padding: 0 8px;
  border-radius: 999px; border: 1px solid var(--t-border); background: #0e1524;
  font-family: var(--t-mono); font-size: 10px; color: #94a3b8; white-space: nowrap;
}
.al-live i { width: 6px; height: 6px; border-radius: 50%; background: #64748b; display: block; }
.al-live.run i { background: #7ee787; box-shadow: 0 0 0 0 rgba(126, 231, 135, .55); animation: al-pulse 1.5s infinite; }
.al-live.err i { background: #ff7b72; }
@keyframes al-pulse {
  0% { box-shadow: 0 0 0 0 rgba(126, 231, 135, .5); }
  70% { box-shadow: 0 0 0 6px rgba(126, 231, 135, 0); }
  100% { box-shadow: 0 0 0 0 rgba(126, 231, 135, 0); }
}
.al-pace { display: inline-flex; align-items: center; gap: 1px; padding: 2px; border-radius: 7px; background: #0e1524; border: 1px solid var(--t-border); }
.al-pace button {
  height: 18px; padding: 0 6px; border: 0; border-radius: 5px; background: transparent;
  font-family: var(--t-mono); font-size: 9.5px; color: #7d8798; transition: background .15s ease, color .15s ease;
}
.al-pace button:hover { color: #d7dee9; }
.al-pace button.on { background: #1c2740; color: #d2a8ff; }
.al-term-tokens { font-family: var(--t-mono); font-size: 10px; color: #7d8798; white-space: nowrap; }
.al-term-tokens b { color: #79c0ff; font-weight: 600; }
.al-mode { display: inline-flex; align-items: center; gap: 1px; padding: 2px; border-radius: 7px; background: #0e1524; border: 1px solid var(--t-border); }
.al-mode button {
  height: 18px; padding: 0 7px; border: 0; border-radius: 5px; background: transparent;
  font-family: var(--t-mono); font-size: 9.5px; color: #7d8798; transition: background .15s ease, color .15s ease;
}
.al-mode button:hover { color: #d7dee9; }
.al-mode button.on { background: #1c2740; color: #7ee787; }
.al-mode button.on.real { color: #d2a8ff; }
.al-mode button:disabled { opacity: .38; cursor: not-allowed; }
.al-term-model {
  display: inline-flex; align-items: center; gap: 4px; height: 20px; padding: 0 7px;
  border-radius: 6px; border: 1px solid #26344a; background: #0e1524;
  font-family: var(--t-mono); font-size: 9.5px; color: #8fa3bd; white-space: nowrap; max-width: 180px;
  overflow: hidden; text-overflow: ellipsis;
}
.al-term-model.real { color: #d2a8ff; border-color: #3b3060; background: #17122a; }
.al-term-model.warn { color: #ffa657; border-color: #4a3520; background: #231a10; }

.al-term-log {
  flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden;
  padding: 14px 16px 18px;
  background:
    radial-gradient(900px 220px at 50% 0%, rgba(56, 102, 255, .07), transparent 70%),
    var(--t-bg);
  scroll-behavior: smooth;
}
.al-term-log::-webkit-scrollbar { width: 9px; }
.al-term-log::-webkit-scrollbar-thumb { background: #243044; border: 3px solid transparent; border-radius: 999px; background-clip: content-box; }
.al-term-log::-webkit-scrollbar-thumb:hover { background: #3a4a66; background-clip: content-box; }

.al-term-line {
  display: flex; gap: 8px; align-items: flex-start;
  padding: 2px 0; font-family: var(--t-mono); font-size: 12.5px; line-height: 1.7;
  color: var(--t-text);
}
.al-term-prefix { flex: none; width: 15px; text-align: center; color: var(--t-dim); font-size: 11.5px; user-select: none; padding-top: 1px; }
.al-term-text { flex: 1; min-width: 0; white-space: pre-wrap; word-break: break-word; }
.al-ln-user .al-term-prefix { color: var(--t-green); }
.al-ln-user .al-term-text { color: #f0f4fa; font-weight: 520; }
.al-ln-banner { margin: 0 0 10px; padding: 9px 11px; border: 1px solid #1d2b40; border-left: 3px solid #7ee787; border-radius: 8px; background: #0d1725; }
.al-ln-banner .al-term-prefix { color: var(--t-green); }
.al-ln-banner .al-term-text { color: #9fb0c7; font-size: 11.5px; line-height: 1.65; }
.al-ln-meta { padding: 1px 0; }
.al-ln-meta .al-term-prefix, .al-ln-meta .al-term-text { color: #66748a; font-size: 11px; }
.al-ln-info .al-term-prefix, .al-ln-info .al-term-text { color: #7d8798; font-size: 11.5px; }
.al-ln-llm .al-term-prefix { color: var(--t-purple); }
.al-ln-llm .al-term-text { color: #e3d9ff; }
.al-ln-agent .al-term-prefix { color: var(--t-cyan); }
.al-ln-agent .al-term-text { color: #c9f1f4; }
.al-ln-tool .al-term-prefix, .al-ln-tool .al-term-text { color: var(--t-amber); }
.al-ln-toolresult .al-term-prefix, .al-ln-toolresult .al-term-text { color: #8fbf8f; }
.al-ln-memory .al-term-prefix, .al-ln-memory .al-term-text { color: var(--t-purple); }
.al-ln-compress .al-term-prefix, .al-ln-compress .al-term-text { color: #e5b567; }
.al-ln-error .al-term-prefix, .al-ln-error .al-term-text { color: var(--t-red); }
.al-ln-banner + .al-term-line { margin-top: 2px; }
.al-cursor {
  display: inline-block; width: 7px; height: 14px; margin-left: 2px; vertical-align: -2px;
  background: var(--t-purple); animation: al-blink 1s steps(2, start) infinite;
}
@keyframes al-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }

.al-suggest { margin: 12px 0 2px; display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 7px; }
.al-suggest-btn {
  display: flex; align-items: flex-start; gap: 8px; text-align: left;
  padding: 9px 10px; border-radius: 9px; border: 1px solid #1c2738; background: #0d1420;
  color: #aab8cc; font-size: 11.5px; line-height: 1.5; font-family: var(--t-mono);
  transition: border-color .15s ease, background .15s ease, transform .15s ease, color .15s ease;
}
.al-suggest-btn:hover { border-color: #35507a; background: #111b2c; color: #dbe6f5; transform: translateY(-1px); }
.al-suggest-btn svg { flex: none; margin-top: 1px; color: #79c0ff; }
.al-suggest-head { grid-column: 1 / -1; display: flex; align-items: center; gap: 6px; margin-top: 2px; color: #66748a; font-family: var(--t-mono); font-size: 10.5px; letter-spacing: .02em; }
.al-term-empty { padding: 10px 2px 0; }

.al-term-foot { flex: none; border-top: 1px solid var(--t-border); background: #0c111c; }
.al-term-ctx {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 13px 1px; cursor: pointer;
  font-family: var(--t-mono); font-size: 10px; color: #7d8798;
  transition: color .15s ease;
}
.al-term-ctx:hover { color: #d7dee9; }
.al-term-ctx-label { color: #8b98ab; white-space: nowrap; }
.al-term-ctx-bar {
  flex: 1; height: 4px; min-width: 48px; border-radius: 999px;
  background: #1b2433; overflow: hidden;
}
.al-term-ctx-bar i { display: block; height: 100%; border-radius: 999px; transition: width .25s ease, background .25s ease; }
.al-term-ctx-num { color: #aab8cc; white-space: nowrap; font-variant-numeric: tabular-nums; }
.al-term-ctx-window { color: #66748a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 230px; }
@media (max-width: 640px) { .al-term-ctx-window { display: none; } }
.al-term-cmdbar { display: flex; align-items: center; gap: 5px; padding: 7px 12px 0; overflow-x: auto; scrollbar-width: none; }
.al-term-cmdbar::-webkit-scrollbar { display: none; }
.al-term-cmd {
  display: inline-flex; align-items: center; gap: 4px; height: 23px; padding: 0 8px; flex: none;
  border: 1px solid #1c2738; border-radius: 6px; background: transparent; color: #7d8798;
  font-family: var(--t-mono); font-size: 10px; white-space: nowrap;
  transition: color .15s ease, border-color .15s ease, background .15s ease;
}
.al-term-cmd:hover { color: #d7dee9; border-color: #33445f; background: #111a29; }
.al-term-cmd:disabled { opacity: .4; cursor: not-allowed; }
.al-term-inputrow { display: flex; align-items: flex-end; gap: 8px; padding: 7px 10px 4px 14px; }
.al-term-prompt { flex: none; color: var(--t-green); font-family: var(--t-mono); font-size: 13px; line-height: 26px; user-select: none; }
.al-term-textarea {
  flex: 1; min-width: 0; resize: none; border: 0; outline: 0; background: transparent;
  color: #eef3fb; font-family: var(--t-mono); font-size: 12.5px; line-height: 1.7;
  padding: 4px 0 3px; max-height: 108px; min-height: 26px;
}
.al-term-textarea::placeholder { color: #55637a; }
.al-term-send {
  flex: none; width: 30px; height: 30px; display: grid; place-items: center;
  border: 1px solid #2b3a55; border-radius: 8px; background: #16233a; color: #9fc0ff;
  transition: background .15s ease, border-color .15s ease, color .15s ease, opacity .15s ease;
}
.al-term-send:hover { background: #1d2f4d; border-color: #3d5680; color: #d7e6ff; }
.al-term-send:disabled { opacity: .35; cursor: not-allowed; }
.al-term-hint { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 0 13px 9px; }
.al-term-hint span { color: #566178; font-family: var(--t-mono); font-size: 10px; }
.al-term-hint .al-kbd { background: #0f1726; border-color: #263349; color: #8494ab; box-shadow: none; height: 16px; font-size: 9px; }
.al-term-hint-left { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
@media (max-width: 640px) {
  .al-term-title { display: none; }
  .al-term-tokens { display: none; }
}
@media (max-width: 1180px) {
  .al-tui-panel { height: 560px; min-height: 560px; }
}
@media (max-width: 720px) {
  .al-tui-panel { height: 520px; min-height: 520px; }
  .al-term-hint { padding-bottom: 7px; }
}
`;

const TUI_SUGGESTIONS = [
  { icon: 'bolt', text: '算一下 (12+30)*3，然后记住结果' },
  { icon: 'memory', text: '记住 我的项目代号是 Orion' },
  { icon: 'search', text: '我的项目代号是什么？' },
  { icon: 'clock', text: '现在几点？记下来' },
  { icon: 'tools', text: '你有哪些工具？' },
  { icon: 'cpu', text: '讲讲你是怎么工作的' },
  { icon: 'spark', text: '掷两个 20 面骰子' },
  { icon: 'smile', text: '从 火锅、烧烤、日料 里帮我选一个' },
];

function TermLine(props) {
  const line = props.line;
  const kind = line.kind || 'info';
  const prefix = kind === 'user' ? '›'
    : kind === 'llm' ? '◆'
      : kind === 'agent' ? '●'
        : kind === 'tool' ? '⚙'
          : kind === 'toolresult' ? '←'
            : kind === 'memory' ? '◈'
              : kind === 'compress' ? '⇣'
                : kind === 'error' ? '✕'
                  : kind === 'banner' ? '▌'
                    : kind === 'meta' ? '·' : '·';
  return e(
    'div',
    { className: 'al-term-line al-ln-' + kind },
    e('span', { className: 'al-term-prefix' }, prefix),
    e(
      'span',
      { className: 'al-term-text' },
      line.text,
      line.streaming ? e('span', { className: 'al-cursor' }) : null,
    ),
  );
}

function TuiPanel(props) {
  const view = props.view;
  const pace = view.pace || 'normal';
  const [draft, setDraft] = useState('');
  const logRef = useRef(null);
  const areaRef = useRef(null);
  const stickRef = useRef(true);
  const transcript = view.transcript || [];
  const busy = Boolean(view.busy);
  const hasUser = transcript.some((line) => line.kind === 'user');
  const memCount = (view.memory || []).length;
  const used = view.context ? view.context.used : 0;
  const limit = view.context ? view.context.limit : 0;
  const realMode = view.modelMode === 'real';
  const realAvailable = Boolean(props.realStatus && props.realStatus.available);
  const realUnavailableReason = props.realStatus && props.realStatus.error ? props.realStatus.error : '';
  const contextPct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const contextColor = contextPct > 90 ? '#ff7b72' : contextPct > 70 ? '#ffa657' : '#7ee787';
  const realWindow = props.realStatus && props.realStatus.contextWindow;
  const realModelName = (view.model && (view.model.modelName || view.model.model)) || (props.realStatus && (props.realStatus.modelName || props.realStatus.model)) || 'DeepSeek';
  const realModeTitle = realMode
    ? realAvailable
      ? '真实 DeepSeek：' + realModelName + ' · 每轮消耗账号额度'
      : '真实模式未连接：' + (realUnavailableReason || '请检查 DeepSeek 账号登录')
    : '模拟模式：规则驱动、离线、可复现';

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.style.height = 'auto';
    area.style.height = Math.min(108, Math.max(26, area.scrollHeight)) + 'px';
  }, [draft]);

  useEffect(() => {
    const log = logRef.current;
    if (!log || !stickRef.current) return;
    log.scrollTop = log.scrollHeight;
  }, [transcript.length, view.streaming && view.streaming.text]);

  const onScroll = () => {
    const log = logRef.current;
    if (!log) return;
    stickRef.current = log.scrollHeight - log.scrollTop - log.clientHeight < 90;
  };

  const submit = (text) => {
    const value = String(text == null ? draft : text).trim();
    if (!value || busy) return;
    stickRef.current = true;
    setDraft('');
    if (props.onSend) props.onSend(value);
  };

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !(event.nativeEvent && event.nativeEvent.isComposing)) {
      event.preventDefault();
      submit();
    }
  };

  return e(
    'section',
    { className: 'al-panel al-tui-panel', 'aria-label': 'Agent 实验室 TUI' },
    e(
      'header',
      { className: 'al-panel-head' },
      e(
        'div',
        { className: 'al-panel-title', style: { minWidth: 0 } },
        e('span', { className: 'al-term-dots' }, e('i'), e('i'), e('i')),
        e('span', { className: 'al-term-title' }, e('b', null, 'agent-lab'), ' — tui · ', props.activeTitle || '会话'),
      ),
      e(
        'div',
        { className: 'al-term-headright' },
        e(
          'span',
          { className: 'al-term-model' + (view.modelMode === 'real' ? (props.realStatus && props.realStatus.available ? ' real' : ' warn') : ''), title: realModeTitle },
          view.modelMode === 'real'
            ? (props.realStatus && props.realStatus.available
              ? '真实 · ' + ((view.model && (view.model.modelName || view.model.model)) || (props.realStatus.modelName || props.realStatus.model) || 'DeepSeek')
              : '真实模式 · 未连接')
            : '离线模拟',
        ),
        e(
          'span',
          { className: 'al-mode', role: 'group', 'aria-label': '模型模式' },
          e(
            'button',
            { type: 'button', className: realMode ? '' : 'on', disabled: busy, onClick: () => props.onMode && props.onMode('sim'), title: '本地规则模拟：离线、可复现、不消耗额度' },
            '模拟',
          ),
          e(
            'button',
            {
              type: 'button',
              className: 'real' + (realMode ? ' on' : ''),
              disabled: busy || !realAvailable,
              onClick: () => props.onMode && props.onMode('real'),
              title: realAvailable ? '调用 DSH 当前模型：' + (props.realStatus.modelName || props.realStatus.model) + '（消耗账号额度）' : '真实模型不可用：' + (realUnavailableReason || '请检查 DeepSeek 登录'),
            },
            '真实',
          ),
        ),
        e('span', { className: 'al-pace', role: 'group', 'aria-label': '模拟速度' },
          ['slow', 'normal', 'fast'].map((item) =>
            e(
              'button',
              {
                key: item,
                type: 'button',
                className: pace === item ? 'on' : '',
                onClick: () => props.onPace && props.onPace(item),
                title: { slow: '慢速演示', normal: '正常速度', fast: '快速' }[item],
              },
              { slow: '慢', normal: '中', fast: '快' }[item],
            ),
          ),
        ),
        e(
          'span',
          { className: 'al-live' + (busy ? ' run' : '') },
          e('i'),
          busy ? '运行中' : '就绪',
        ),
      ),
    ),
    e(
      'div',
      { className: 'al-term-log', ref: logRef, onScroll, role: 'log', 'aria-live': 'polite' },
      transcript.map((line) => e(TermLine, { key: line.id, line })),
      !hasUser
        ? e(
            'div',
            { className: 'al-term-empty' },
            e('div', { className: 'al-suggest-head' }, e(Icon, { name: 'wand', size: 12 }), '试试这些输入，观察右侧的流转'),
            e(
              'div',
              { className: 'al-suggest' },
              TUI_SUGGESTIONS.map((item) =>
                e(
                  'button',
                  { key: item.text, type: 'button', className: 'al-suggest-btn', onClick: () => submit(item.text), disabled: busy },
                  e(Icon, { name: item.icon, size: 13 }),
                  e('span', null, item.text),
                ),
              ),
            ),
          )
        : null,
    ),
    e(
      'footer',
      { className: 'al-term-foot' },
      e(
        'div',
        {
          className: 'al-term-ctx',
          role: 'button',
          tabIndex: 0,
          onClick: () => props.onCommand && props.onCommand('context'),
          title: '点击查看检查器「上下文」：教学预算 ' + limit + ' tok' + (realMode && realWindow ? ' · 真实模型窗口 ' + realWindow + ' tok' : ''),
        },
        e('span', { className: 'al-term-ctx-label' }, '上下文'),
        e('span', { className: 'al-term-ctx-bar' }, e('i', { style: { width: contextPct + '%', background: contextColor } })),
        e('span', { className: 'al-term-ctx-num' }, used + ' / ' + limit + ' tok · ' + contextPct + '%'),
        e(
          'span',
          { className: 'al-term-ctx-window' },
          realMode && realWindow ? '真实窗口 ' + alFormatTokens(realWindow) : '教学预算 ' + alFormatTokens(limit) + ' · 超出自动压缩',
        ),
      ),
      e(
        'div',
        { className: 'al-term-cmdbar' },
        e(
          'button',
          { type: 'button', className: 'al-term-cmd', onClick: () => props.onCommand && props.onCommand('compact'), disabled: busy || (view.messages || []).length < 3, title: '手动压缩上下文' },
          e(Icon, { name: 'compress', size: 11 }), '/compact',
        ),
        e(
          'button',
          { type: 'button', className: 'al-term-cmd', onClick: () => props.onCommand && props.onCommand('new'), disabled: busy, title: '新建会话' },
          e(Icon, { name: 'plus', size: 11 }), '/new',
        ),
        e(
          'button',
          { type: 'button', className: 'al-term-cmd', onClick: () => props.onCommand && props.onCommand('memory'), title: '查看长期记忆' },
          e(Icon, { name: 'memory', size: 11 }), '/memory · ' + memCount,
        ),
        e(
          'button',
          { type: 'button', className: 'al-term-cmd', onClick: () => props.onCommand && props.onCommand('clear'), disabled: busy, title: '清空当前会话，开新会话' },
          e(Icon, { name: 'refresh', size: 11 }), '/clear',
        ),
        e(
          'button',
          { type: 'button', className: 'al-term-cmd', onClick: () => submit('/help'), disabled: busy, title: '查看命令' },
          e(Icon, { name: 'info', size: 11 }), '/help',
        ),
      ),
      e(
        'div',
        { className: 'al-term-inputrow' },
        e('span', { className: 'al-term-prompt' }, '›'),
        e('textarea', {
          ref: areaRef,
          className: 'al-term-textarea',
          value: draft,
          rows: 1,
          placeholder: busy ? 'Agent 正在运行，稍候…' : '输入消息，Enter 发送；试试「记住 我的项目代号是 Orion」',
          spellCheck: false,
          onChange: (event) => setDraft(event.target.value),
          onKeyDown,
          disabled: busy,
          'aria-label': '输入消息',
        }),
        e(
          'button',
          { type: 'button', className: 'al-term-send', onClick: () => submit(), disabled: busy || !draft.trim(), title: '发送' },
          e(Icon, { name: 'send', size: 15 }),
        ),
      ),
      e(
        'div',
        { className: 'al-term-hint' },
        e(
          'div',
          { className: 'al-term-hint-left' },
          e('span', null, e('span', { className: 'al-kbd' }, 'Enter'), ' 发送 · '),
          e('span', null, e('span', { className: 'al-kbd' }, 'Shift+Enter'), ' 换行 · '),
          e('span', null, e('span', { className: 'al-kbd' }, '/'), ' 命令'),
        ),
        e('span', null, '对话与记忆保存在本机浏览器'),
      ),
    ),
  );
}
