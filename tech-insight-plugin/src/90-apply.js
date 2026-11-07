/* ─────────────────────────────────────────────────────────────
 * 技术洞察 · Client 入口
 * 注册左侧导航入口（sidebar.panellist）与主面板（main）。
 * 注册模式与宿主页面一致：同一个面板 id 同时驱动侧栏与 main。
 * ───────────────────────────────────────────────────────────── */

/** 侧栏图标：16×16 线性 SVG，跟随 currentColor。 */
function TiPanelIcon(props) {
  const size = (props && props.size) || 16;
  return e(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.7,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
    },
    e('circle', { cx: 11, cy: 11, r: 6.6 }),
    e('path', { d: 'm16 16 4.4 4.4' }),
    e('path', { d: 'M8.2 13.2V9.4M11 13.2V7.4M13.8 13.2v-2.4' }),
  );
}

/**
 * 页面级错误边界：任何渲染异常都显示可读错误而不是白屏。
 * 同时把错误打到 console，便于用户反馈。
 */
class TiErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error: error || new Error('未知渲染错误') };
  }

  componentDidCatch(error, info) {
    try {
      console.error('[tech-insight] 页面渲染出错：', error, info);
    } catch (failure) {
      /* 忽略日志失败 */
    }
  }

  render() {
    if (this.state.error) {
      return e(
        'div',
        { className: 'ti-crash', role: 'alert' },
        e('h2', { className: 'ti-crash-title' }, '技术洞察页面渲染出错'),
        e(
          'p',
          { className: 'ti-crash-sub' },
          '页面没有白屏是错误边界的兜底。可以点“重新渲染”重试；如果反复出现，请把下面的错误信息反馈给插件维护者。',
        ),
        e('pre', { className: 'ti-crash-detail' }, String((this.state.error && this.state.error.stack) || this.state.error)),
        e(
          'button',
          { type: 'button', className: 'ti-btn ti-btn-soft', onClick: () => this.setState({ error: null }) },
          '重新渲染',
        ),
      );
    }
    return this.props.children;
  }
}

function TiPage() {
  return e(TiErrorBoundary, null, e(Page));
}

function apply(ctx) {
  ctx.slots.inject('main', () =>
    ctx.slots.register(
      { name: 'main', key: TI_PANEL_ID },
      TiPage,
    ),
  );

  ctx.slots.inject('sidebar.panellist', () =>
    ctx.slots.register(
      {
        name: 'sidebar.panellist',
        id: TI_PANEL_ID,
        order: 7,
        label: () => '技术洞察',
      },
      TiPanelIcon,
    ),
  );
}
