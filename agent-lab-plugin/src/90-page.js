/* ─────────────────────────────────────────────────────────────
 * Agent 实验室 · 页面外壳
 * Owns the runtime lifecycle (createLab / dispose), the three top-level tabs,
 * the session column, command shortcuts and the toast surface.
 * ───────────────────────────────────────────────────────────── */

const AL_TABS = [
  { id: 'lab', label: '体验 TUI', icon: 'terminal' },
  { id: 'dataflow', label: '数据流', icon: 'route' },
  { id: 'source', label: '源码', icon: 'code' },
  { id: 'docs', label: '原理', icon: 'book' },
];

function SessionsPanel(props) {
  const view = props.view;
  const busy = Boolean(view.busy);
  const sessions = view.sessions || [];
  const [confirmId, setConfirmId] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (confirmId && !sessions.some((session) => session.id === confirmId)) setConfirmId(null);
  }, [sessions, confirmId]);

  return e(
    'aside',
    { className: 'al-panel al-sessions-panel', 'aria-label': '会话列表' },
    e(
      'header',
      { className: 'al-panel-head' },
      e(
        'div',
        { className: 'al-panel-title' },
        e(Icon, { name: 'layers', size: 14 }),
        '会话',
        e('span', { className: 'al-panel-sub' }, String(sessions.length)),
      ),
      e(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: 2 } },
        e(IconBtn, { icon: 'chevronLeft', size: 14, title: '折叠会话目录', onClick: props.onCollapse }),
        e(IconBtn, { icon: 'plus', title: '新建会话', onClick: props.onNew, disabled: busy }),
      ),
    ),
    e(
      'div',
      { className: 'al-panel-body al-session-list' },
      sessions.map((session) => {
        const active = session.id === view.activeId;
        const confirming = confirmId === session.id;
        return e(
          'div',
          {
            key: session.id,
            className: 'al-session' + (active ? ' on' : ''),
            role: 'button',
            tabIndex: 0,
            'aria-current': active ? 'true' : undefined,
            onClick: () => { if (!busy && !active) props.onSwitch(session.id); },
            onKeyDown: (event) => { if (event.key === 'Enter' && !busy && !active) props.onSwitch(session.id); },
            title: busy ? '运行中不能切换会话' : '切换到该会话',
          },
          e(
            'div',
            { className: 'al-session-top' },
            e('span', { className: 'al-session-title' }, session.title || '新会话'),
            e(IconBtn, {
              icon: confirming ? 'alert' : 'trash',
              size: 12,
              danger: confirming,
              className: 'al-session-del' + (confirming ? ' confirm' : ''),
              title: confirming ? '再点一次删除' : '删除会话',
              onClick: (event) => {
                event.stopPropagation();
                if (confirming) {
                  props.onDelete(session.id);
                  setConfirmId(null);
                } else {
                  setConfirmId(session.id);
                }
              },
            }),
          ),
          e(
            'div',
            { className: 'al-session-meta' },
            e('span', null, session.messageCount + ' 条'),
            e('span', null, '·'),
            e('span', null, session.tokens + ' tok'),
            e('span', null, '·'),
            e('span', null, fmtClock(session.updatedAt)),
          ),
        );
      }),
      sessions.length === 0
        ? e(Empty, { icon: 'layers', title: '还没有会话', body: '新建一个会话，或者直接回到终端开始输入。' })
        : null,
    ),
    e(
      'footer',
      { className: 'al-panel-foot' },
      e('span', { title: '长期记忆跨会话共享' }, '记忆 ', String((view.memory || []).length), ' 条'),
      confirmReset
        ? e(
            'span',
            { style: { display: 'flex', gap: 5 } },
            e(Btn, { size: 'sm', variant: 'danger', onClick: () => { props.onReset(); setConfirmReset(false); } }, '确认重置'),
            e(Btn, { size: 'sm', variant: 'ghost', onClick: () => setConfirmReset(false) }, '取消'),
          )
        : e(IconBtn, { icon: 'refresh', size: 12, title: '重置全部本地数据', onClick: () => setConfirmReset(true), disabled: busy }),
    ),
  );
}

function SessionsRail(props) {
  return e(
    'button',
    { type: 'button', className: 'al-sessions-rail', onClick: props.onExpand, title: '展开会话目录' },
    e('span', { className: 'al-rail-icon' }, e(Icon, { name: 'layers', size: 15 })),
    e(Icon, { name: 'chevronRight', size: 12 }),
    e('span', { className: 'al-rail-text' }, '会话 ' + String(props.count || 0)),
  );
}

function PageLoader(props) {
  return e(
    'div',
    { className: 'al-empty', style: { flex: 1 } },
    e('div', { className: 'al-empty-icon' }, e(Icon, { name: props.error ? 'alert' : 'terminal', size: 20 })),
    e('div', { className: 'al-empty-title' }, props.error ? '初始化失败' : '正在初始化迷你 Agent…'),
    e('div', { className: 'al-empty-body' }, props.error || '加载会话、记忆与本地示例数据。'),
  );
}

function Page(props) {
  const [view, setView] = useState(null);
  const [tab, setTab] = useState('lab');
  const [inspectorTab, setInspectorTab] = useState('flow');
  const [loadError, setLoadError] = useState(null);
  const [toast, setToast] = useState(null);
  const [realStatus, setRealStatus] = useState(null);
  const [sessionsCollapsed, setSessionsCollapsed] = useState(() => {
    try {
      const raw = localStorage.getItem('dsh.agent-lab.ui.v1');
      return Boolean(raw && JSON.parse(raw).sessionsCollapsed === true);
    } catch (error) {
      return false;
    }
  });
  const labRef = useRef(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((text, icon) => {
    setToast({ text, icon: icon || 'check' });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  useEffect(() => {
    let lab;
    try {
      lab = createLab();
    } catch (error) {
      setLoadError((error && error.message) || 'createLab 失败');
      return undefined;
    }
    labRef.current = lab;
    const unsubscribe = lab.onEvent(() => setView(lab.snapshot()));
    lab.setModelAdapter(alCreateRealModelAdapter());
    setView(lab.snapshot());
    let alive = true;
    alRealModelStatus()
      .then((status) => {
        if (!alive) return;
        setRealStatus(status);
        lab.setModelInfo(status);
        if (lab.snapshot().modelMode === 'real' && !status.available) {
          lab.setModelMode('sim');
          showToast('真实模型不可用，已切回模拟模式', 'alert');
        }
      })
      .catch((error) => {
        if (!alive) return;
        const status = { available: false, error: (error && error.message) || '无法连接 Host 路由' };
        setRealStatus(status);
        lab.setModelInfo({ available: false });
        if (lab.snapshot().modelMode === 'real') {
          lab.setModelMode('sim');
          showToast('真实模型不可用，已切回模拟模式', 'alert');
        }
      });
    return () => {
      alive = false;
      unsubscribe();
      lab.dispose();
      labRef.current = null;
    };
  }, [showToast]);

  const newSession = useCallback(() => {
    const lab = labRef.current;
    if (!lab) return;
    lab.newSession();
    setInspectorTab('flow');
  }, []);

  const onBudget = useCallback((value) => {
    const lab = labRef.current;
    if (!lab) return;
    if (lab.setBudget(value)) showToast('教学预算已调整为 ' + alFormatTokens(value) + ' tok', 'layers');
    else showToast('正在运行中，结束后再调整预算', 'alert');
  }, [showToast]);

  const toggleSessions = useCallback(() => {
    setSessionsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('dsh.agent-lab.ui.v1', JSON.stringify({ sessionsCollapsed: next }));
      } catch (error) {
        /* 本地存储不可用时只影响记忆 */
      }
      return next;
    });
  }, []);

  const onSend = useCallback((raw) => {
    const lab = labRef.current;
    if (!lab) return;
    const text = String(raw == null ? '' : raw).trim();
    if (!text) return;
    if (text === '/compact') {
      lab.compact();
      showToast('正在压缩上下文', 'compress');
      return;
    }
    if (text === '/new' || text === '/clear') {
      lab.newSession();
      setInspectorTab('flow');
      showToast(text === '/clear' ? '已开始新会话' : '已新建会话', 'plus');
      return;
    }
    if (text === '/memory') {
      setInspectorTab('memory');
      showToast('已切到记忆面板', 'memory');
      return;
    }
    if (text === '/flow') {
      setInspectorTab('flow');
      showToast('已切到流转面板', 'route');
      return;
    }
    lab.submit(text);
  }, [showToast]);

  const onCommand = useCallback((name) => {
    const lab = labRef.current;
    if (!lab) return;
    if (name === 'compact') {
      lab.compact();
      showToast('正在压缩上下文', 'compress');
    } else if (name === 'new') {
      lab.newSession();
      setInspectorTab('flow');
      showToast('已新建会话', 'plus');
    } else if (name === 'clear') {
      lab.newSession();
      setInspectorTab('flow');
      showToast('已开始新会话', 'refresh');
    } else if (name === 'memory') {
      setInspectorTab('memory');
    } else if (name === 'context') {
      setInspectorTab('context');
    }
  }, [showToast]);

  const onModelMode = useCallback((mode) => {
    const lab = labRef.current;
    if (!lab) return;
    if (mode === 'real') {
      if (!realStatus || !realStatus.available) {
        showToast(realStatus && realStatus.error ? '真实模型不可用：' + realStatus.error : '真实模型不可用：请检查 DeepSeek 账号登录', 'alert');
        return;
      }
      const changed = lab.setModelMode('real');
      if (changed) showToast('真实模式 · ' + (realStatus.modelName || realStatus.model) + '（消耗账号额度）', 'bolt');
      return;
    }
    if (lab.setModelMode('sim')) showToast('已切回模拟模式', 'cpu');
  }, [realStatus, showToast]);

  const onLaunchReal = useCallback(() => {
    if (!props.onLaunchReal) return;
    const prompt = (view && view.lastInput) || '用一个最小 agent 的循环解释工具调用是什么。';
    let ok = false;
    try {
      ok = props.onLaunchReal(prompt);
    } catch (error) {
      ok = false;
    }
    showToast(ok ? '已在新会话中用真实 Agent 运行' : '当前环境无法创建会话', ok ? 'external' : 'alert');
  }, [props.onLaunchReal, view, showToast]);

  if (!view) {
    return e(
      'div',
      { className: 'al-root' },
      e('style', { dangerouslySetInnerHTML: { __html: AL_CSS + TUI_CSS + INSPECTOR_CSS } }),
      e('div', { className: 'al-inner' }, e(PageLoader, { error: loadError })),
    );
  }

  const activeSession = (view.sessions || []).find((session) => session.id === view.activeId);
  const activeTitle = activeSession ? activeSession.title : '新会话';

  return e(
    'div',
    { className: 'al-root' },
    e('style', { dangerouslySetInnerHTML: { __html: AL_CSS + TUI_CSS + INSPECTOR_CSS } }),
    e(
      'div',
      { className: 'al-inner' },
      e(
        'header',
        { className: 'al-head' },
        e(
          'div',
          { className: 'al-brand' },
          e('div', { className: 'al-logo' }, e(Icon, { name: 'terminal', size: 23, strokeWidth: 1.8 })),
          e(
            'div',
            { style: { minWidth: 0 } },
            e(
              'div',
              { className: 'al-title-row' },
              e('h1', { className: 'al-title' }, 'Agent 实验室'),
              e(Chip, { tone: 'brand', icon: 'spark' }, '迷你 Agent'),
              view.modelMode === 'real'
                ? e(Chip, { tone: 'violet', icon: 'bolt' }, '真实 · ' + ((realStatus && (realStatus.modelName || realStatus.model)) || 'DeepSeek'))
                : e(Chip, { icon: 'cpu' }, '模拟 · 离线'),
            ),
            e('p', { className: 'al-sub' }, '输入一句话，实时看它经过上下文、模型、工具与记忆；再翻源码和原理，把 agent 拆开看。'),
          ),
        ),
        e(
          'div',
          { className: 'al-head-actions' },
          e(
            'div',
            { className: 'al-model-switch', role: 'group', 'aria-label': '模型模式' },
            e('span', { className: 'al-ms-label' }, '模型模式'),
            e(
              'button',
              {
                type: 'button',
                className: view.modelMode === 'real' ? '' : 'on',
                disabled: view.busy,
                onClick: () => onModelMode('sim'),
                title: '本地规则模拟：离线、可复现、不消耗额度',
              },
              '模拟',
            ),
            e(
              'button',
              {
                type: 'button',
                className: 'real' + (view.modelMode === 'real' ? ' on' : ''),
                disabled: view.busy || !(realStatus && realStatus.available),
                onClick: () => onModelMode('real'),
                title: realStatus && realStatus.available
                  ? '调用 DSH 当前模型：' + (realStatus.modelName || realStatus.model) + '（消耗账号额度）'
                  : '真实模型不可用：' + ((realStatus && realStatus.error) || '请检查 DeepSeek 账号登录'),
              },
              '真实 DeepSeek' + (realStatus && realStatus.available ? ' · ' + (realStatus.modelName || realStatus.model) : ''),
            ),
          ),
          props.onLaunchReal
            ? e(Btn, { variant: 'ghost', icon: 'external', onClick: onLaunchReal, title: '把当前这轮输入交给 DSH 主 Agent（含工具与工作区）再跑一遍' }, '交给 DSH Agent')
            : null,
          e(Btn, { variant: 'primary', icon: 'plus', onClick: newSession, disabled: view.busy }, '新建会话'),
        ),
      ),
      e(
        'div',
        { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', flex: 'none' } },
        e(
          'div',
          { className: 'al-tabs', role: 'tablist', 'aria-label': 'Agent 实验室导航' },
          AL_TABS.map((item) =>
            e(
              'button',
              {
                key: item.id,
                type: 'button',
                role: 'tab',
                'aria-selected': tab === item.id,
                className: 'al-tab' + (tab === item.id ? ' on' : ''),
                onClick: () => setTab(item.id),
              },
              e(Icon, { name: item.icon, size: 13 }),
              item.label,
            ),
          ),
        ),
        e(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 } },
          e(Chip, { tone: view.busy ? 'brand' : 'neutral', icon: view.busy ? 'bolt' : 'check' }, view.busy ? 'Agent 运行中' : '就绪'),
          e('span', { className: 'al-panel-sub', style: { whiteSpace: 'nowrap' } }, '所有状态实时同步到检查器'),
        ),
      ),
      tab === 'lab'
        ? e(
            'div',
            { className: 'al-tabpane' },
            e(
              'div',
              { className: 'al-lab' + (sessionsCollapsed ? ' collapsed' : '') },
              sessionsCollapsed
                ? e(SessionsRail, { count: view.sessions.length, onExpand: toggleSessions })
                : e(SessionsPanel, {
                    view,
                    onNew: newSession,
                    onCollapse: toggleSessions,
                    onSwitch: (id) => { const lab = labRef.current; if (lab) lab.switchSession(id); },
                    onDelete: (id) => {
                      const lab = labRef.current;
                      if (!lab) return;
                      lab.deleteSession(id);
                      showToast('已删除会话', 'trash');
                    },
                    onReset: () => {
                      const lab = labRef.current;
                      if (!lab) return;
                      lab.resetAll();
                      setInspectorTab('flow');
                      showToast('已重置本地数据', 'refresh');
                    },
                  }),
              e(TuiPanel, {
                view,
                activeTitle,
                realStatus,
                onMode: onModelMode,
                onSend,
                onCommand,
                onPace: (pace) => { const lab = labRef.current; if (lab) lab.setPace(pace); },
              }),
              e(Inspector, {
                view,
                tab: inspectorTab,
                onTab: setInspectorTab,
                onDeleteMemory: (id) => { const lab = labRef.current; if (lab) lab.deleteMemory(id); },
                onClearMemory: () => { const lab = labRef.current; if (lab) lab.clearMemory(); },
                onBudget,
              }),
            ),
          )
        : tab === 'dataflow'
          ? e('div', { className: 'al-tabpane scroll' }, e(DataFlowPage, { view, onBudget }))
        : tab === 'source'
          ? e('div', { className: 'al-tabpane scroll' }, e(SourcePage))
          : e(
              'div',
              { className: 'al-tabpane scroll' },
              e(DocsPage, {
                onNavigate: (pageId) => {
                  if (pageId === 'source' || pageId === 'lab' || pageId === 'docs') setTab(pageId);
                },
              }),
            ),
    ),
    toast ? e('div', { className: 'al-toast', role: 'status' }, e(Icon, { name: toast.icon, size: 14 }), toast.text) : null,
  );
}
