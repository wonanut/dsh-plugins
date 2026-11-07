/* ─────────────────────────────────────────────────────────────
 * Agent 实验室 · 70-docs.js — 原理页
 *
 * 中文教学长文 + 纯 CSS 图解。组件由 90-page.js 直接调用：
 *   function DocsPage(props)
 * 可选 props.onNavigate(pageId)：页面外壳若提供，本页会渲染跳转按钮；
 * 未提供时自动退化为文字提示，不依赖外壳实现。
 *
 * 约束：普通 JS，无 import/export/JSX；React / e / hooks 由外层提供。
 * 所有 class 使用 al-doc- 前缀；颜色优先使用 --dsw-alias-* token。
 * ───────────────────────────────────────────────────────────── */

const DOC_CSS = `
.al-doc-page {
  --al-doc-bg: var(--dsw-alias-bg-base, #ffffff);
  --al-doc-panel: var(--dsw-alias-bg-layer-1, #ffffff);
  --al-doc-panel-2: var(--dsw-alias-bg-layer-2, #f6f7f9);
  --al-doc-panel-3: var(--dsw-alias-bg-layer-3, #eceff3);
  --al-doc-text: var(--dsw-alias-label-primary, #171a21);
  --al-doc-sub: var(--dsw-alias-label-secondary, #5b6472);
  --al-doc-ter: var(--dsw-alias-label-tertiary, #8b93a1);
  --al-doc-border: var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.1));
  --al-doc-border-2: var(--dsw-alias-border-l2, rgba(15, 23, 42, 0.18));
  --al-doc-brand: var(--dsw-alias-brand-primary, #4d6bfe);
  --al-doc-tint: color-mix(in srgb, var(--al-doc-brand) 10%, transparent);
  --al-doc-tint-2: color-mix(in srgb, var(--al-doc-brand) 18%, transparent);
  --al-doc-brand-text: color-mix(in srgb, var(--al-doc-brand) 76%, var(--al-doc-text));
  --al-doc-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --al-doc-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  box-sizing: border-box;
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: 4px 4px 72px;
  color: var(--al-doc-text);
  font-family: var(--al-doc-sans);
  font-size: 14px;
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
}
.al-doc-page * { box-sizing: border-box; }

/* ── 头部 ── */
.al-doc-hero { padding: 16px 2px 24px; border-bottom: 1px solid var(--al-doc-border); margin-bottom: 26px; }
.al-doc-eyebrow { font-family: var(--al-doc-mono); font-size: 11px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--al-doc-ter); }
.al-doc-title { margin: 10px 0 12px; font-size: clamp(24px, 3.4vw, 34px); line-height: 1.24; font-weight: 700; letter-spacing: -0.01em; color: var(--al-doc-text); }
.al-doc-lead { margin: 0; max-width: 80ch; color: var(--al-doc-sub); font-size: 14.5px; line-height: 1.85; }
.al-doc-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.al-doc-chip { display: inline-flex; align-items: center; gap: 7px; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--al-doc-border); background: var(--al-doc-panel-2); color: var(--al-doc-sub); font-size: 12px; line-height: 1.6; }
.al-doc-chip-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--al-doc-brand); opacity: 0.85; }

/* ── 双栏：目录 + 正文 ── */
.al-doc-layout { display: grid; grid-template-columns: 196px minmax(0, 1fr); gap: 34px; align-items: start; }
.al-doc-toc { position: sticky; top: 16px; }
.al-doc-toc-title { font-family: var(--al-doc-mono); font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--al-doc-ter); margin-bottom: 10px; }
.al-doc-toc-list { display: flex; flex-direction: column; gap: 2px; border-left: 1px solid var(--al-doc-border); }
.al-doc-toc-item { appearance: none; display: flex; align-items: baseline; gap: 7px; width: 100%; margin-left: -1px; padding: 6px 10px; border: 0; border-left: 2px solid transparent; border-radius: 0 6px 6px 0; background: transparent; color: var(--al-doc-sub); font: inherit; font-size: 12.5px; line-height: 1.5; text-align: left; cursor: pointer; }
.al-doc-toc-item:hover { color: var(--al-doc-text); background: var(--al-doc-panel-2); border-left-color: var(--al-doc-border-2); }
.al-doc-toc-no { flex: none; font-family: var(--al-doc-mono); font-size: 10px; color: var(--al-doc-ter); }
.al-doc-main { min-width: 0; }

/* ── 章节 ── */
.al-doc-sec-wrap { scroll-margin-top: 20px; }
.al-doc-sec { padding: 26px 0 30px; border-bottom: 1px dashed var(--al-doc-border); }
.al-doc-sec:last-child { border-bottom: 0; }
.al-doc-sec-head { display: flex; flex-direction: column; gap: 7px; margin-bottom: 16px; }
.al-doc-sec-kicker { display: flex; align-items: center; gap: 9px; }
.al-doc-sec-no { font-family: var(--al-doc-mono); font-size: 11px; font-weight: 600; color: var(--al-doc-brand-text); background: var(--al-doc-tint); padding: 3px 7px; border-radius: 6px; line-height: 1.3; }
.al-doc-sec-title { margin: 0; font-size: 19px; line-height: 1.35; font-weight: 650; letter-spacing: -0.005em; color: var(--al-doc-text); }
.al-doc-sec-lead { margin: 0; max-width: 76ch; color: var(--al-doc-sub); font-size: 13.5px; line-height: 1.85; }

/* ── 正文元素 ── */
.al-doc-p { margin: 12px 0; max-width: 76ch; color: var(--al-doc-sub); font-size: 13.5px; line-height: 1.85; }
.al-doc-p strong, .al-doc-list strong, .al-doc-ordered strong { color: var(--al-doc-text); font-weight: 650; }
.al-doc-list, .al-doc-ordered { margin: 10px 0 14px; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; color: var(--al-doc-sub); font-size: 13.5px; line-height: 1.8; }
.al-doc-list li::marker { color: var(--al-doc-ter); }
.al-doc-ordered li::marker { color: var(--al-doc-ter); font-family: var(--al-doc-mono); font-size: 12px; }
.al-doc-inline { font-family: var(--al-doc-mono); font-size: 12px; padding: 1px 5px; border-radius: 5px; border: 1px solid var(--al-doc-border); background: var(--al-doc-panel-3); color: var(--al-doc-text); white-space: nowrap; }

/* ── 卡片 / 网格 ── */
.al-doc-grid { display: grid; gap: 12px; margin: 16px 0; }
.al-doc-grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.al-doc-grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.al-doc-grid-auto { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
.al-doc-card { padding: 14px 15px; border: 1px solid var(--al-doc-border); border-radius: 12px; background: var(--al-doc-panel); }
.al-doc-card-icon { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; margin-bottom: 8px; border-radius: 8px; background: var(--al-doc-tint); color: var(--al-doc-brand-text); font-family: var(--al-doc-mono); font-size: 13px; font-weight: 700; }
.al-doc-card-title { margin-bottom: 4px; color: var(--al-doc-text); font-size: 13.5px; font-weight: 650; }
.al-doc-card-body { color: var(--al-doc-sub); font-size: 12.5px; line-height: 1.75; }

/* ── 公式条 ── */
.al-doc-formula { display: flex; flex-wrap: wrap; align-items: center; gap: 9px; margin: 14px 0 4px; padding: 16px; border: 1px solid var(--al-doc-border); border-radius: 12px; background: linear-gradient(180deg, var(--al-doc-panel), var(--al-doc-panel-2)); }
.al-doc-formula-term { padding: 5px 11px; border: 1px solid var(--al-doc-border); border-radius: 8px; background: var(--al-doc-panel); color: var(--al-doc-text); font-family: var(--al-doc-mono); font-size: 13px; font-weight: 650; }
.al-doc-formula-op { color: var(--al-doc-ter); font-family: var(--al-doc-mono); font-size: 13px; }
.al-doc-formula-note { margin: 6px 0 0; color: var(--al-doc-ter); font-size: 12px; line-height: 1.7; }

/* ── 最小循环图 ── */
.al-doc-loop { margin: 16px 0 6px; padding: 18px 16px 12px; border: 1px solid var(--al-doc-border); border-radius: 14px; background: var(--al-doc-panel-2); overflow-x: auto; }
.al-doc-loop-row { display: flex; align-items: center; gap: 9px; min-width: max-content; padding-bottom: 4px; }
.al-doc-loop-node { flex: none; min-width: 108px; padding: 9px 12px; border: 1px solid var(--al-doc-border); border-radius: 10px; background: var(--al-doc-panel); }
.al-doc-loop-node-input { border-color: color-mix(in srgb, var(--al-doc-brand) 42%, var(--al-doc-border)); }
.al-doc-loop-node-title { color: var(--al-doc-text); font-size: 12.5px; font-weight: 650; }
.al-doc-loop-node-sub { margin-top: 2px; max-width: 150px; color: var(--al-doc-ter); font-size: 10.5px; line-height: 1.45; }
.al-doc-loop-arrow { flex: none; color: var(--al-doc-ter); font-size: 15px; }
.al-doc-loop-core { flex: none; display: flex; align-items: stretch; gap: 8px; padding: 7px; border: 1px dashed color-mix(in srgb, var(--al-doc-brand) 45%, var(--al-doc-border-2)); border-radius: 12px; background: var(--al-doc-tint); animation: al-doc-breathe 3.2s ease-in-out infinite; }
.al-doc-loop-core-node { padding: 7px 11px; border: 1px solid var(--al-doc-border); border-radius: 8px; background: var(--al-doc-panel); color: var(--al-doc-text); font-size: 12px; font-weight: 600; white-space: nowrap; }
.al-doc-loop-core-swap { display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--al-doc-brand-text); font-size: 15px; line-height: 1; }
.al-doc-loop-core-swap small { margin-top: 3px; color: var(--al-doc-ter); font-size: 9.5px; white-space: nowrap; }
.al-doc-loop-foot { margin-top: 10px; color: var(--al-doc-ter); font-size: 11.5px; line-height: 1.7; text-align: center; }
@keyframes al-doc-breathe {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0, 0, 0, 0); }
  50% { box-shadow: 0 0 0 4px var(--al-doc-tint); }
}

/* ── 流转时间线 ── */
.al-doc-journey { list-style: none; margin: 16px 0 8px; padding: 0; }
.al-doc-journey-item { position: relative; margin-left: 7px; padding: 0 0 16px 30px; border-left: 1px solid var(--al-doc-border); }
.al-doc-journey-item:last-child { padding-bottom: 0; border-left-color: transparent; }
.al-doc-journey-dot { position: absolute; left: -6.5px; top: 4px; width: 12px; height: 12px; border-radius: 50%; background: var(--al-doc-brand); box-shadow: 0 0 0 3px var(--al-doc-panel-2); opacity: 0.9; }
.al-doc-journey-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.al-doc-stage { padding: 3px 6px; border-radius: 5px; background: var(--al-doc-tint); color: var(--al-doc-brand-text); font-family: var(--al-doc-mono); font-size: 10.5px; font-weight: 600; line-height: 1.2; }
.al-doc-journey-title { color: var(--al-doc-text); font-size: 13.5px; font-weight: 650; }
.al-doc-journey-text { margin: 3px 0 0; color: var(--al-doc-sub); font-size: 12.5px; line-height: 1.7; }
.al-doc-journey-where { margin-top: 5px; color: var(--al-doc-ter); font-size: 11.5px; line-height: 1.6; }
.al-doc-journey-where b { color: var(--al-doc-sub); font-weight: 600; }

/* ── 流程链 ── */
.al-doc-flowchain { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; margin: 14px 0; padding: 12px 14px; border: 1px dashed var(--al-doc-border-2); border-radius: 10px; background: var(--al-doc-panel-2); font-size: 12px; color: var(--al-doc-sub); }
.al-doc-flowchain-step { padding: 3px 8px; border: 1px solid var(--al-doc-border); border-radius: 6px; background: var(--al-doc-panel); color: var(--al-doc-text); font-family: var(--al-doc-mono); font-size: 11px; white-space: nowrap; }
.al-doc-flowchain-arrow { color: var(--al-doc-ter); }

/* ── 上下文预算条 ── */
.al-doc-budget { margin: 16px 0 4px; padding: 14px 15px 12px; border: 1px solid var(--al-doc-border); border-radius: 12px; background: var(--al-doc-panel-2); }
.al-doc-budget-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px 12px; margin-bottom: 9px; color: var(--al-doc-sub); font-size: 12px; }
.al-doc-budget-used { color: var(--al-doc-text); font-family: var(--al-doc-mono); font-size: 11.5px; }
.al-doc-bar { position: relative; display: flex; height: 22px; overflow: hidden; border-radius: 6px; background: var(--al-doc-panel-3); }
.al-doc-bar-seg { height: 100%; }
.al-doc-bar-seg-system { background: #4d6bfe; }
.al-doc-bar-seg-summary { background: #a371f7; }
.al-doc-bar-seg-memory { background: #2da44e; }
.al-doc-bar-seg-recent { background: #d4a72c; }
.al-doc-bar-seg-input { background: #f85149; }
.al-doc-bar-marker { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--al-doc-text); opacity: 0.5; }
.al-doc-legend { display: flex; flex-wrap: wrap; gap: 5px 15px; margin-top: 9px; color: var(--al-doc-sub); font-size: 11.5px; }
.al-doc-legend-item { display: inline-flex; align-items: center; gap: 6px; }
.al-doc-legend-dot { width: 8px; height: 8px; border-radius: 2px; }
.al-doc-legend-tok { color: var(--al-doc-ter); font-family: var(--al-doc-mono); font-size: 10.5px; }

/* ── 提示条 ── */
.al-doc-note { display: flex; gap: 10px; margin: 14px 0; padding: 12px 14px; border: 1px solid var(--al-doc-border); border-radius: 10px; background: var(--al-doc-panel-2); color: var(--al-doc-sub); font-size: 12.5px; line-height: 1.75; }
.al-doc-note-icon { flex: none; width: 20px; height: 20px; margin-top: 1px; border-radius: 50%; background: var(--al-doc-tint); color: var(--al-doc-brand-text); font-family: var(--al-doc-mono); font-size: 11px; font-weight: 700; line-height: 20px; text-align: center; }
.al-doc-note-body { min-width: 0; }
.al-doc-note-title { display: block; margin-bottom: 2px; color: var(--al-doc-text); font-weight: 650; }
.al-doc-note-warn { border-color: color-mix(in srgb, #f85149 32%, var(--al-doc-border)); background: color-mix(in srgb, #f85149 7%, var(--al-doc-panel)); }
.al-doc-note-warn .al-doc-note-icon { background: color-mix(in srgb, #f85149 16%, transparent); color: color-mix(in srgb, #f85149 72%, var(--al-doc-text)); }
.al-doc-note-tip { border-color: color-mix(in srgb, #2da44e 30%, var(--al-doc-border)); background: color-mix(in srgb, #2da44e 7%, var(--al-doc-panel)); }
.al-doc-note-tip .al-doc-note-icon { background: color-mix(in srgb, #2da44e 16%, transparent); color: color-mix(in srgb, #2da44e 72%, var(--al-doc-text)); }

/* ── 表格 ── */
.al-doc-table-wrap { margin: 14px 0; overflow-x: auto; border: 1px solid var(--al-doc-border); border-radius: 10px; }
.al-doc-table { width: 100%; min-width: 520px; border-collapse: collapse; font-size: 12.5px; }
.al-doc-table th { padding: 8px 12px; border-bottom: 1px solid var(--al-doc-border); background: var(--al-doc-panel-2); color: var(--al-doc-sub); font-weight: 600; text-align: left; white-space: nowrap; }
.al-doc-table td { padding: 9px 12px; border-bottom: 1px solid var(--al-doc-border); color: var(--al-doc-sub); line-height: 1.65; vertical-align: top; }
.al-doc-table tr:last-child td { border-bottom: 0; }
.al-doc-table td:first-child { color: var(--al-doc-text); font-weight: 600; }

/* ── 代码块 ── */
.al-doc-code { margin: 14px 0; overflow: hidden; border: 1px solid var(--al-doc-border); border-radius: 10px; background: var(--al-doc-panel-2); }
.al-doc-code-head { display: flex; align-items: center; gap: 7px; padding: 7px 12px; border-bottom: 1px solid var(--al-doc-border); background: var(--al-doc-panel); color: var(--al-doc-ter); font-family: var(--al-doc-mono); font-size: 11px; }
.al-doc-code-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--al-doc-brand); opacity: 0.7; }
.al-doc-pre { margin: 0; padding: 12px 14px; overflow-x: auto; color: var(--al-doc-text); font-family: var(--al-doc-mono); font-size: 12px; line-height: 1.7; tab-size: 2; white-space: pre; }

/* ── 编号步骤 ── */
.al-doc-steps { counter-reset: al-doc-step; list-style: none; margin: 14px 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.al-doc-step { position: relative; padding: 10px 12px 10px 44px; border: 1px solid var(--al-doc-border); border-radius: 10px; background: var(--al-doc-panel); color: var(--al-doc-sub); font-size: 12.5px; line-height: 1.7; }
.al-doc-step::before { counter-increment: al-doc-step; content: counter(al-doc-step); position: absolute; left: 13px; top: 10px; width: 20px; height: 20px; border-radius: 50%; background: var(--al-doc-tint); color: var(--al-doc-brand-text); font-family: var(--al-doc-mono); font-size: 11px; font-weight: 700; line-height: 20px; text-align: center; }
.al-doc-step strong { color: var(--al-doc-text); font-weight: 650; }

/* ── 页脚 ── */
.al-doc-foot { margin-top: 10px; padding: 22px 0 0; color: var(--al-doc-ter); font-size: 12.5px; line-height: 1.8; }
.al-doc-foot p { margin: 0 0 10px; }
.al-doc-btn { appearance: none; display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border: 1px solid var(--al-doc-border-2); border-radius: 8px; background: var(--al-doc-tint); color: var(--al-doc-brand-text); font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; }
.al-doc-btn:hover { background: var(--al-doc-tint-2); }

/* ── 响应式 ── */
@media (max-width: 900px) {
  .al-doc-layout { grid-template-columns: minmax(0, 1fr); gap: 10px; }
  .al-doc-toc { position: static; }
  .al-doc-toc-list { flex-direction: row; gap: 4px; overflow-x: auto; padding-bottom: 6px; border-left: 0; }
  .al-doc-toc-item { flex: none; width: auto; margin-left: 0; border-left: 0; border-bottom: 2px solid transparent; border-radius: 6px; white-space: nowrap; }
  .al-doc-toc-item:hover { border-bottom-color: var(--al-doc-border-2); }
  .al-doc-grid-2, .al-doc-grid-3 { grid-template-columns: minmax(0, 1fr); }
  .al-doc-sec { padding: 22px 0 26px; }
}
@media (max-width: 560px) {
  .al-doc-page { padding-bottom: 48px; }
  .al-doc-title { font-size: 23px; }
  .al-doc-loop { padding: 14px 12px 10px; }
}
@media (prefers-reduced-motion: reduce) {
  .al-doc-loop-core { animation: none; }
}
`;

/* ── 小型展示原语 ─────────────────────────────────────────── */

function DocInline(props) {
  return e('code', { className: 'al-doc-inline' }, props.children);
}

function DocP(props) {
  return e('p', { className: 'al-doc-p' }, props.children);
}

function DocList(props) {
  const items = props.items || [];
  return e('ul', { className: 'al-doc-list' }, items.map(function (item, index) {
    return e('li', { key: index }, item);
  }));
}

function DocOrdered(props) {
  const items = props.items || [];
  return e('ol', { className: 'al-doc-ordered' }, items.map(function (item, index) {
    return e('li', { key: index }, item);
  }));
}

function DocCode(props) {
  return e('div', { className: 'al-doc-code' },
    props.label ? e('div', { className: 'al-doc-code-head' },
      e('span', { className: 'al-doc-code-dot' }),
      e('span', null, props.label)
    ) : null,
    e('pre', { className: 'al-doc-pre' }, props.code)
  );
}

function DocNote(props) {
  const kind = props.kind || 'info';
  return e('div', { className: 'al-doc-note al-doc-note-' + kind },
    e('span', { className: 'al-doc-note-icon' }, props.icon || 'i'),
    e('div', { className: 'al-doc-note-body' },
      props.title ? e('strong', { className: 'al-doc-note-title' }, props.title) : null,
      props.children
    )
  );
}

function DocCard(props) {
  return e('div', { className: 'al-doc-card' },
    props.icon ? e('span', { className: 'al-doc-card-icon' }, props.icon) : null,
    e('div', { className: 'al-doc-card-title' }, props.title),
    e('div', { className: 'al-doc-card-body' }, props.children)
  );
}

function DocGrid(props) {
  const cols = props.cols || 2;
  const modifier = cols === 'auto' ? 'al-doc-grid-auto' : 'al-doc-grid-' + cols;
  return e('div', { className: 'al-doc-grid ' + modifier }, props.children);
}

function DocTable(props) {
  const head = props.head || [];
  const rows = props.rows || [];
  return e('div', { className: 'al-doc-table-wrap' },
    e('table', { className: 'al-doc-table' },
      e('thead', null,
        e('tr', null, head.map(function (cell, index) {
          return e('th', { key: index }, cell);
        }))
      ),
      e('tbody', null, rows.map(function (row, rowIndex) {
        return e('tr', { key: rowIndex }, row.map(function (cell, cellIndex) {
          return e('td', { key: cellIndex }, cell);
        }));
      }))
    )
  );
}

function DocSec(props) {
  return e('section', { className: 'al-doc-sec' },
    e('div', { className: 'al-doc-sec-head' },
      e('div', { className: 'al-doc-sec-kicker' },
        e('span', { className: 'al-doc-sec-no' }, props.no),
        e('h2', { className: 'al-doc-sec-title' }, props.title)
      ),
      props.lead ? e('p', { className: 'al-doc-sec-lead' }, props.lead) : null
    ),
    props.children
  );
}

function DocFlowChain(props) {
  const steps = props.steps || [];
  const nodes = [];
  steps.forEach(function (step, index) {
    if (index > 0) {
      nodes.push(e('span', { key: 'arrow-' + index, className: 'al-doc-flowchain-arrow' }, '→'));
    }
    nodes.push(e('span', { key: 'step-' + index, className: 'al-doc-flowchain-step' }, step));
  });
  return e('div', { className: 'al-doc-flowchain' }, nodes);
}

function DocSteps(props) {
  const items = props.items || [];
  return e('ol', { className: 'al-doc-steps' }, items.map(function (item, index) {
    return e('li', { key: index, className: 'al-doc-step' }, item);
  }));
}

function DocChip(props) {
  return e('span', { className: 'al-doc-chip' },
    e('span', { className: 'al-doc-chip-dot' }),
    props.children
  );
}

/* ── 图解：最小循环 ──────────────────────────────────────── */

function DocLoopDiagram() {
  function node(title, sub, extraClass) {
    return e('div', { className: 'al-doc-loop-node' + (extraClass ? ' ' + extraClass : '') },
      e('div', { className: 'al-doc-loop-node-title' }, title),
      e('div', { className: 'al-doc-loop-node-sub' }, sub)
    );
  }

  return e('div', { className: 'al-doc-loop' },
    e('div', { className: 'al-doc-loop-row' },
      node('用户输入', '一句话进入插件', 'al-doc-loop-node-input'),
      e('span', { className: 'al-doc-loop-arrow' }, '→'),
      node('组装上下文', 'system + 摘要 + 记忆 + 历史 + 输入'),
      e('span', { className: 'al-doc-loop-arrow' }, '→'),
      e('div', { className: 'al-doc-loop-core' },
        e('div', { className: 'al-doc-loop-core-node' }, '模型决策'),
        e('div', { className: 'al-doc-loop-core-swap' }, '⇄', e('small', null, '结果回填')),
        e('div', { className: 'al-doc-loop-core-node' }, '执行工具')
      ),
      e('span', { className: 'al-doc-loop-arrow' }, '→'),
      node('最终回答', '流式输出，turn 结束')
    ),
    e('div', { className: 'al-doc-loop-foot' },
      '模型与工具之间的这一对箭头，就是 Agent 的心脏：模型只会「提议」调用，真正执行并回填结果的是宿主代码；循环最多 ',
      e(DocInline, null, 'LAB_MAX_STEPS'),
      ' 步。'
    )
  );
}

/* ── 图解：上下文预算 ────────────────────────────────────── */

const DOC_CONTEXT_SEGMENTS = [
  { id: 'system', label: 'system', tokens: 118, note: '角色与规则' },
  { id: 'summary', label: 'summary', tokens: 62, note: '历史压缩摘要' },
  { id: 'memory', label: 'memory', tokens: 34, note: '本轮召回的长记忆（≤ 3 条）' },
  { id: 'recent', label: 'recent', tokens: 152, note: '最近的消息' },
  { id: 'input', label: 'input', tokens: 20, note: '本轮输入' },
];

function DocBudgetBar() {
  const limit = 1000;
  const used = DOC_CONTEXT_SEGMENTS.reduce(function (sum, item) {
    return sum + item.tokens;
  }, 0);
  const markerLeft = 90;

  return e('div', { className: 'al-doc-budget' },
    e('div', { className: 'al-doc-budget-head' },
      e('span', null, '本轮上下文拼装示例（教学尺度）'),
      e('span', { className: 'al-doc-budget-used' },
        used + ' / ' + limit + ' tok · ' + Math.round((used / limit) * 100) + '%'
      )
    ),
    e('div', { className: 'al-doc-bar' },
      DOC_CONTEXT_SEGMENTS.map(function (segment) {
        return e('div', {
          key: segment.id,
          className: 'al-doc-bar-seg al-doc-bar-seg-' + segment.id,
          style: { width: ((segment.tokens / limit) * 100).toFixed(2) + '%' },
          title: segment.note,
        });
      }),
      e('div', { className: 'al-doc-bar-marker', style: { left: markerLeft + '%' }, title: '压缩阈值：90% 预算' })
    ),
    e('div', { className: 'al-doc-legend' }, DOC_CONTEXT_SEGMENTS.map(function (segment) {
      return e('span', { key: segment.id, className: 'al-doc-legend-item' },
        e('span', {
          className: 'al-doc-legend-dot',
          style: { background: 'var(--al-doc-bar-seg-' + segment.id + ', var(--al-doc-brand))' },
        }),
        e('span', null, segment.label),
        e('span', { className: 'al-doc-legend-tok' }, segment.tokens + ' tok'),
        e('span', { className: 'al-doc-legend-tok' }, '· ' + segment.note)
      );
    })),
    e('p', { className: 'al-doc-formula-note' },
      '竖线是 90% 压缩阈值：示例中的 ',
      used,
      ' tok 已越过 90%（378 tok），下一次模型调用前会触发压缩。数字仅用于演示，实际值随对话变化。'
    )
  );
}

/* ── 第 01 节：什么是 Agent ─────────────────────────────── */

function DocSectionWhat(props) {
  return e(DocSec, {
    no: props.no,
    title: '一句话：Agent = LLM + 工具 + 循环 + 记忆',
    lead: '去掉所有产品包装，一个 agent 就是四个部件的组合：模型负责决策，工具负责行动，循环负责推进，记忆负责延续。缺一件，能力就退化一次。',
  },
    e('div', { className: 'al-doc-formula' },
      e('span', { className: 'al-doc-formula-term' }, 'Agent'),
      e('span', { className: 'al-doc-formula-op' }, '='),
      e('span', { className: 'al-doc-formula-term' }, 'LLM'),
      e('span', { className: 'al-doc-formula-op' }, '×'),
      e('span', { className: 'al-doc-formula-term' }, '工具'),
      e('span', { className: 'al-doc-formula-op' }, '×'),
      e('span', { className: 'al-doc-formula-term' }, '循环'),
      e('span', { className: 'al-doc-formula-op' }, '×'),
      e('span', { className: 'al-doc-formula-term' }, '记忆')
    ),
    e('p', { className: 'al-doc-formula-note' },
      '为什么是乘而不是加：任何一项缺失，整体都会明显退化 —— 下面的表格就是每个部件缺席时的样子。'
    ),
    e('p', { className: 'al-doc-p' },
      '在真实产品里，这四个部件还会配上权限、沙箱、日志、计费等等，但那些是工程外壳。理解 agent，先把这四个词放在心里。'
    ),
    e(DocGrid, { cols: 'auto' },
      e(DocCard, { icon: 'LLM', title: '模型：决策' },
        '读入上下文，输出下一步：一句回答，或者一次工具调用。本插件用规则驱动的模拟模型（',
        e(DocInline, null, '30-llm.js'),
        '）作为默认模型，离线、可复现；也可以在终端右上角切到「真实」，调用 DSH 当前登录的 DeepSeek 模型。'
      ),
      e(DocCard, { icon: 'Fn', title: '工具：行动' },
        '模型自己不能查时间、不能算数、更写不了记忆。工具是它对外部世界唯一的通道。本插件有 8 个：calculator、clock、dice_roll、random_pick、password_generate、unit_convert、memory_write、memory_search。'
      ),
      e(DocCard, { icon: '↻', title: '循环：推进' },
        '工具结果写回消息后再次调用模型，直到拿到最终回答。本插件封顶 ',
        e(DocInline, null, 'LAB_MAX_STEPS = 4'),
        ' 步，超过就报错，避免「死循环烧钱」。'
      ),
      e(DocCard, { icon: 'Mem', title: '记忆：延续' },
        '模型每次调用都从零开始，记忆由宿主在调用前注入上下文。本插件的长期记忆存在 localStorage，跨会话共享。'
      )
    ),
    e(DocTable, {
      head: ['缺哪一块', '会变成什么'],
      rows: [
        ['只有 LLM', '会聊天但不能做事 —— 普通聊天机器人。'],
        ['有工具但没有循环', '只能调用一次，无法根据结果继续 —— 函数调用演示。'],
        ['没有记忆', '每次对话都从零开始 —— 失忆的助手。'],
        ['没有 LLM（纯脚本）', '行为完全可预测，但没有泛化能力 —— 自动化脚本。'],
      ],
    }),
    e(DocNote, { kind: 'tip', icon: '✓', title: '带着问题往下读' },
      '接下来每一节都对应一个部件：最小循环（循环）、一次输入的旅程（四个部件如何串起来）、上下文与压缩、记忆、会话、工具协议。读完后，去「体验」页跑一句 ',
      e(DocInline, null, '算一下 (12+30)*3 然后记住结果'),
      '，你会看到两次工具调用和一次记忆写入。'
    )
  );
}

/* ── 第 02 节：最小循环 ─────────────────────────────────── */

const DOC_LOOP_PSEUDO = [
  'messages = [system, ...history, input]',
  '',
  'for (let step = 1; step <= LAB_MAX_STEPS; step++) {',
  '  const reply = await model(messages, LAB_TOOLS);      // ① 决策',
  '  if (reply.type === "final") return reply.text;       // ② 收敛，结束',
  '  const result = await runTool(reply.name, reply.args); // ③ 执行工具',
  '  messages.push({ role: "tool", ...result });          // ④ 回填，进入下一圈',
  '}',
  '',
  'throw new Error("超过步数上限仍未收敛");                // 兜底：不会无限循环',
].join('\n');

function DocSectionLoop(props) {
  return e(DocSec, {
    no: props.no,
    title: '最小循环：一个环，两个出口',
    lead: '把产品细节全部拿掉，agent 的核心就是下面这个环。本插件每一轮对话都是它的展开，右侧检查器的「流转」页签会逐帧记录它。',
  },
    e(DocLoopDiagram),
    e('p', { className: 'al-doc-p' },
      '循环的出口只有两个：模型返回 ',
      e(DocInline, null, 'final'),
      '（正常结束），或者超过 ',
      e(DocInline, null, 'LAB_MAX_STEPS'),
      '（错误结束）。除此之外没有「悄悄停下」的路径 —— 每一轮都留下可检查的轨迹。'
    ),
    e(DocCode, { label: '伪代码 · 最小 agent 循环', code: DOC_LOOP_PSEUDO }),
    e(DocNote, { icon: 'i', title: '三个必须分清的词' },
      '模型这一步的输出只有两种：调工具（',
      e(DocInline, null, "type: 'tool_call'"),
      '）或最终回答（',
      e(DocInline, null, "type: 'final'"),
      '）。本插件把「计划」压缩成这两种形状，引擎才能用同一个循环处理所有输入。'
    ),
    e('p', { className: 'al-doc-p' },
      '真实 LLM 的循环与此完全同构，区别只在 ',
      e(DocInline, null, 'model()'),
      ' 内部是一次网络请求（可能是流式 SSE），而不是本地规则函数。'
    )
  );
}

/* ── 第 03 节：一次输入的旅程 ───────────────────────────── */

const DOC_JOURNEY = [
  {
    id: 'input',
    title: '记录输入',
    text: '把用户输入变成一条 user 消息，创建本轮 turn，标记开始时间。',
    where: '终端出现用户行；检查器「流转」出现 input 节点。',
  },
  {
    id: 'context',
    title: '组装上下文',
    text: '按 system → summary → memory（≤ 3 条召回）→ recent → input 的顺序拼出这一轮真正发给模型的内容。',
    where: '检查器「上下文」的堆叠条与各段 token 数更新。',
  },
  {
    id: 'compress',
    title: '需要时压缩',
    text: '若组装后已用 token 超过预算的 90%，把除最近 4 条之外的消息折叠进累计摘要，再重新组装。',
    where: '终端出现 ⇣ 压缩行；「上下文」的 summary 与 used 发生变化。',
  },
  {
    id: 'model',
    title: '模型决策',
    text: '把 messages 和工具 schema 一起发给模型。模型返回一次工具调用，或者最终回答；这一步可能发生多次（最多 4 步）。',
    where: '「流转」的 model 节点可展开看到 messages、toolSchemas 与 response。',
  },
  {
    id: 'tool',
    title: '执行工具',
    text: '宿主在注册表里按名字找到函数，校验参数后执行，把 { ok, result, display } 写回一条 tool 消息。',
    where: '终端出现 ⚙ 调用行与 ← 结果行；「流转」多一个 tool 节点。',
  },
  {
    id: 'memory',
    title: '写入记忆（可选）',
    text: '如果本轮调用了 memory_write，长期记忆会新增或更新一条；下一轮组装上下文时可能被关键词召回。',
    where: '「记忆」页签出现新条目；终端出现 ◈ 记忆已保存。',
  },
  {
    id: 'output',
    title: '输出回答',
    text: '模型给出最终回答，按字符流式播报；turn 结束，统计本轮 tokens、工具次数，并持久化会话。',
    where: '终端输出 agent 行；「流转」所有节点变为完成态。',
  },
];

function DocSectionJourney(props) {
  return e(DocSec, {
    no: props.no,
    title: '一次输入在插件里经历了什么',
    lead: '每个阶段都对应 turn 里的一个 stage 节点。把它们和右侧检查器的三个页签对上号，你就拿到了这个插件的调试地图。',
  },
    e('ol', { className: 'al-doc-journey' }, DOC_JOURNEY.map(function (stage, index) {
      return e('li', { key: stage.id, className: 'al-doc-journey-item' },
        e('span', { className: 'al-doc-journey-dot' }),
        e('div', { className: 'al-doc-journey-head' },
          e('span', { className: 'al-doc-stage' }, stage.id),
          e('span', { className: 'al-doc-journey-title' }, (index + 1) + '. ' + stage.title)
        ),
        e('p', { className: 'al-doc-journey-text' }, stage.text),
        e('p', { className: 'al-doc-journey-where' },
          e('b', null, '去看：'),
          stage.where
        )
      );
    })),
    e('div', { className: 'al-doc-grid al-doc-grid-3' },
      e(DocCard, { icon: 'msg', title: 'messages：消息' },
        '真正的对话记录（role + content），会持久化，是「给模型的原件」。user / assistant / tool 三种角色交替出现。'
      ),
      e(DocCard, { icon: 'ctx', title: 'context：上下文' },
        '本轮真正发出去的拼装结果，用完即弃；同一份消息在不同预算与记忆下会拼出不同的上下文。'
      ),
      e(DocCard, { icon: 'ui', title: 'transcript：终端行' },
        '给人看的展示层（banner / user / llm / tool / compress / agent…），不会发给模型，只负责让过程可读。'
      )
    ),
    e(DocNote, { icon: 'i', title: '单向数据流' },
      '引擎从不直接改 UI：它只广播事件（',
      e(DocInline, null, 'stage'),
      ' / ',
      e(DocInline, null, 'token'),
      ' / ',
      e(DocInline, null, 'memory'),
      ' / ',
      e(DocInline, null, 'compression'),
      ' / ',
      e(DocInline, null, 'turn_end'),
      ' …），界面收到后重新读取 ',
      e(DocInline, null, 'snapshot()'),
      ' 渲染。所以 UI 永远不会「自己编造」状态，看到的都是引擎的真实快照。'
    )
  );
}

/* ── 第 04 节：上下文与预算 ─────────────────────────────── */

function DocSectionContext(props) {
  return e(DocSec, {
    no: props.no,
    title: '上下文：一份有预算的临时视图',
    lead: '上下文不是「聊天记录」，而是每次调用前重新拼出来的一份视图。它的大小有预算，超了就要压缩 —— 这是所有 agent 框架最关键的工程问题之一。',
  },
    e('p', { className: 'al-doc-p' },
      '每次模型调用前，引擎按固定顺序拼装上下文，并同时更新检查器里的分段统计：'
    ),
    e(DocFlowChain, { steps: ['system', 'summary', 'memory', 'recent', 'input'] }),
    e(DocList, {
      items: [
        [e('strong', null, 'system：'), '固定的角色与规则（', e(DocInline, null, 'LAB_SYSTEM_PROMPT'), '），告诉模型它是谁、能做什么。'],
        [e('strong', null, 'summary：'), '历史消息被压缩后的累计摘要，只有发生过压缩才存在。'],
        [e('strong', null, 'memory：'), '按本轮输入关键词召回的长期记忆，最多 3 条，作为 system 消息注入。'],
        [e('strong', null, 'recent：'), '当前会话最近的消息；压缩后「新」消息与旧摘要并存。'],
        [e('strong', null, 'input：'), '本轮用户输入。'],
      ],
    }),
    e(DocBudgetBar),
    e('p', { className: 'al-doc-p' },
      '本插件用 ',
      e(DocInline, null, 'estimateTokens'),
      ' 估算 token：CJK 约 1 token/字，其他字符约 4 字符/token，向上取整。真实模型用 BPE 分词，数字会不同，但用来建立「预算」直觉足够了。教学预算 ',
      e(DocInline, null, 'LAB_BUDGET = 1000'),
      ' 是等比缩小过的；真实模型通常从几万到上百万 token。'
    ),
    e('p', { className: 'al-doc-p' },
      e('strong', null, '为什么要在意预算？'),
      '窗口有硬上限，超了直接报错；token 就是钱，输入越长越贵；无关内容越多，模型越容易抓错重点（真实系统里也存在长上下文中段信息被忽略的现象）；输入越长，首字延迟也越高。'
    ),
    e('DocCode', {
      label: 'turn.stages 里的一个节点（示意）',
      code: [
        '{',
        '  id: "stage_3",',
        '  kind: "tool",',
        '  title: "调用 calculator",',
        '  meta: "1 次工具调用 · 12 tok",',
        '  status: "done",',
        '  detail: { name: "calculator", args: { expression: "(12+30)*3" }, ok: true, display: "126" },',
        '  at: 1762400000000,',
        '}',
      ].join('\n'),
    }),
    e(DocNote, { kind: 'tip', icon: '⇣', title: '压缩：预算快满时的折叠' },
      '触发条件：模型调用前 ',
      e(DocInline, null, 'used > limit * 0.9'),
      '（默认 1000 的 90% 触发；页面可调 1K / 2K / 8K / 32K / 128K / 1M；一轮结束时若已超过 90% 也会立即压缩，不必等下一条消息）。做法：把除最近 ',
      e(DocInline, null, 'LAB_RECENT_KEEP = 4'),
      ' 条之外的消息折叠成结构化摘要：', e('strong', null, '关键内容'), '（用户意图 / 助手结论 / 工具结果）、', e('strong', null, '未完成任务清单'), '、', e('strong', null, '下一个任务'), '。同时记录压缩次数与省下的 token。终端会看到形如 ',
      e(DocInline, null, '⇣ 上下文已压缩 · 186 → 92 tok'),
      ' 的行。手动触发（',
      e(DocInline, null, 'compact()'),
      '）则无条件压缩；消息不足 3 条时只加一行提示。'
    ),
    e(DocNote, { kind: 'warn', icon: '!', title: '压缩是有损的' },
      '摘要会丢掉细节。所以真正重要的事实（「项目代号是 Orion」）应该写进长期记忆，而不是指望它活过下一次压缩。这也是真实 agent 产品里「记忆」和「压缩」要分开设计的原因。'
    )
  );
}

/* ── 第 05 节：记忆 ─────────────────────────────────────── */

function DocSectionMemory(props) {
  return e(DocSec, {
    no: props.no,
    title: '记忆：给无状态的模型装外挂',
    lead: '模型本身不记得任何事，每次调用都是全新开始。所谓记忆，是宿主替它保存、并在调用前重新注入的信息。本插件把它分成两层。',
  },
    e(DocGrid, { cols: 2 },
      e(DocCard, { icon: '短', title: '短期记忆：当前会话的消息' },
        '就是 messages 里那段历史。它随会话生灭，受上下文预算和压缩影响：压缩后旧消息变成摘要，细节不再完整。'
      ),
      e(DocCard, { icon: '长', title: '长期记忆：跨会话的键值事实' },
        '存在 localStorage，结构是 { id, key, value, source, sessionId, createdAt, updatedAt }。它独立于会话，删会话不会删记忆。'
      )
    ),
    e(DocFlowChain, { steps: ['用户输入', '关键词召回 ≤ 3 条', '注入 system', '模型据此回答'] }),
    e(DocP, null,
      '长期记忆有两条读写路径：',
      e('strong', null, '自动召回'),
      '（引擎在每轮组装上下文时按关键词匹配，最多 3 条）和',
      e('strong', null, '工具读写'),
      '（模型通过 ',
      e(DocInline, null, 'memory_write'),
      ' / ',
      e(DocInline, null, 'memory_search'),
      ' 主动存取）。前者保证「该记得的会被想起」，后者让模型能判断「我现在需要查记忆」。'
    ),
    e(DocCode, {
      label: '一条长期记忆（示意）',
      code: [
        '{',
        '  id: "mem_1",',
        '  key: "项目代号",',
        '  value: "Orion",',
        '  source: "memory_write",',
        '  sessionId: "s_1",',
        '  createdAt: 1762400000000,',
        '  updatedAt: 1762400000000,',
        '}',
      ].join('\n'),
    }),
    e(DocNote, { kind: 'tip', icon: '✦', title: '试一试' },
      '在「体验」页输入 ',
      e(DocInline, null, '记住 我的项目代号是 Orion'),
      '，然后新建一个会话，问 ',
      e(DocInline, null, '我的项目代号是什么'),
      '。会话是新的、消息是空的，但记忆还在 —— 这就是短期记忆与长期记忆的区别。'
    ),
    e(DocP, null,
      '本插件的关键词召回简单、可解释，适合教学。真实系统通常升级为向量检索 / 知识库（RAG），还要考虑去重、时效、权限与隐私。但接口位置是一样的：查询 → 检索 → 注入。'
    ),
  );
}

/* ── 第 06 节：会话 ─────────────────────────────────────── */

function DocSectionSession(props) {
  return e(DocSec, {
    no: props.no,
    title: '会话：换上下文，不换记忆',
    lead: '会话是一段独立的消息历史。新建会话 = 把上下文清空重来；长期记忆则继续共享。这个划分决定了「什么该隔离、什么该延续」。',
  },
    e(DocList, {
      items: [
        [e('strong', null, '为什么要分会话：'), '不同任务互不污染；上下文更短更省 token；随时可以回到旧线索继续。'],
        [e('strong', null, '生命周期：'), '新建 → 切换 → 删除。删除当前会话时，自动切到下一个或新建一个，不会把你留在空白状态。'],
        [e('strong', null, '隔离与共享：'), '消息、transcript 按会话隔离；长期记忆全局共享。'],
        [e('strong', null, '持久化：'), 'turn 结束、记忆变化、会话操作后写入 storage；刷新页面或重启后仍在。'],
      ],
    }),
    e(DocP, null, '本插件为了保证浏览器里也稳定可控，设了几道上限：最多保留 20 个会话；每个会话最多 120 条消息（超出丢最旧的）；每个会话 transcript 最多 200 行。存储键是 ',
      e(DocInline, null, 'dsh.agent-lab.v1'),
      '，在「会话」栏的入口里可以清空并重建。'
    ),
    e(DocCode, {
      label: '会话对象（示意）',
      code: [
        '{',
        '  id: "s_1",',
        '  title: "算一下 (12+30)*3",',
        '  createdAt: 1762400000000,',
        '  updatedAt: 1762400001200,',
        '  messageCount: 6,',
        '  tokens: 214,',
        '  compressions: 0,',
        '  turns: 1,',
        '}',
      ].join('\n'),
    }),
    e(DocNote, { icon: 'i', title: '真实系统里的会话' },
      '生产环境还要处理：多端同步、并发 turn、会话分享/导出、审计与合规、跨设备记忆同步。这些是工程问题，不改变「会话隔离上下文」的基本模型。'
    )
  );
}

/* ── 第 07 节：工具协议 ─────────────────────────────────── */

const DOC_TOOL_SHAPE = [
  'const LAB_TOOLS = [{',
  '  name: "calculator",',
  '  description: "安全计算四则/幂/括号表达式",',
  '  parameters: {',
  '    type: "object",',
  '    properties: { expression: { type: "string", description: "要计算的表达式" } },',
  '    required: ["expression"],',
  '  },',
  '  // 可以是 async；出错不要 throw，返回 { ok: false } 让模型看到错误',
  '  run(args, ctx) {',
  '    return { ok: true, result: 126, display: "126" };',
  '  },',
  '}];',
].join('\n');

const DOC_TOOL_FLOW = [
  '// ① 模型的这一步输出（本插件由 30-llm.js 产生，真实 LLM 由 API 返回）',
  '{ type: "tool_call", name: "calculator", args: { expression: "(12+30)*3" } }',
  '',
  '// ② 宿主在注册表里查找、执行，并把结果写回一条 tool 消息',
  'const tool = LAB_TOOLS.find((item) => item.name === call.name);',
  'const outcome = await tool.run(call.args, ctx);',
  'messages.push({ role: "tool", toolName: call.name, content: outcome.display });',
  '',
  '// ③ 带着工具结果进入下一圈循环，直到模型返回 final',
].join('\n');

function DocSectionProtocol(props) {
  return e(DocSec, {
    no: props.no,
    title: '工具调用协议：工具只是函数',
    lead: '工具调用不神秘：模型说出「想调哪个函数、参数是什么」，宿主照着执行，再把结果贴回对话。所有 agent 框架的工具协议都是这句话的不同写法。',
  },
    e(DocSteps, {
      items: [
        [e('strong', null, '声明：'), '宿主把工具名、描述与 JSON Schema 随请求一起发给模型，让模型知道「有什么、怎么调」。'],
        [e('strong', null, '决策：'), '模型输出一次工具调用（name + JSON 参数），或者直接给出最终回答。'],
        [e('strong', null, '校验：'), '宿主检查参数能否解析、字段类型是否符合 schema。模型给的参数永远不可信。'],
        [e('strong', null, '执行：'), '按名字找到注册表里的函数，调用 ', e(DocInline, null, 'run(args, ctx)'), '。'],
        [e('strong', null, '回填：'), '把 ', e(DocInline, null, '{ ok, result, display }'), ' 作为 tool 消息追加进对话；display 给终端看，result 给程序用。'],
        [e('strong', null, '循环：'), '回到第 1 步再次调用模型，直到它给出 final。'],
      ],
    }),
    e(DocCode, { label: 'JavaScript · 工具注册的形状', code: DOC_TOOL_SHAPE }),
    e(DocCode, { label: 'JavaScript · 模型提议 → 宿主执行', code: DOC_TOOL_FLOW }),
    e('p', { className: 'al-doc-p' },
      e('strong', null, '为什么偏偏是「函数 + JSON Schema」？'),
      '因为模型只会输出文本，而 JSON 是它最擅长的结构化文本；schema 让「能调什么、参数长什么样」变成可机器校验的契约。函数则是最小、可测试、可 mock、可替换的单元。'
    ),
    e(DocList, {
      items: [
        [e('strong', null, '安全边界：'), '模型只「提议」，执行权始终在宿主。危险工具要加权限与沙箱 —— 弹窗确认不是可靠的安全模型，隔离执行环境才是。'],
        [e('strong', null, '错误即数据：'), '工具失败返回 ok:false 而不是抛异常，模型能看到错误并自行纠正。本插件的工具实现都遵守这一点。'],
        [e('strong', null, '可组合：'), '新增工具 = 注册一个函数 + 写清描述，循环和协议不用改。'],
      ],
    }),
    e(DocTable, {
      head: ['工具', '作用', '关键参数'],
      rows: [
        ['calculator', '安全计算四则 / 幂 / 括号表达式', 'expression（字符串）'],
        ['clock', '返回当前时间/日期', '无'],
        ['dice_roll', '掷骰子，返回点数与合计', 'sides, count'],
        ['random_pick', '从候选项里随机选一个', 'items（数组）'],
        ['password_generate', '生成随机密码', 'length, numbers, symbols'],
        ['unit_convert', '长度/重量/温度/体积/速度/数据换算', 'value, from, to'],
        ['memory_write', '写入或更新一条长期记忆', 'key, value'],
        ['memory_search', '按关键词检索长期记忆', 'query'],
      ],
    }),
    e(DocNote, { icon: 'i', title: '和真实 API 的关系' },
      'OpenAI、Anthropic 等模型的 tools / function calling 字段，就是这套协议的标准版本：请求带工具声明，响应里带 name + JSON 参数。本插件把它收敛成 ',
      e(DocInline, null, "type: 'tool_call'"),
      ' 和 ',
      e(DocInline, null, "type: 'final'"),
      ' 两种形状，方便教学。'
    )
  );
}

/* ── 第 08 节：pi 的极简哲学 ────────────────────────────── */

function DocSectionPi(props) {
  return e(DocSec, {
    no: props.no,
    title: 'pi 的极简哲学：小核心，大扩展',
    lead: 'pi（pi.dev）是一个刻意做小的 coding agent harness。它的价值主张不是功能多，而是可理解、可修改、可观测 —— 这正好是本插件的设计参考。',
  },
    e(DocList, {
      items: [
        [e('strong', null, '小核心：'), '系统提示很短，内置工具只有 read / write / edit / bash 四个；MCP、子 agent、计划 UI、待办等交给扩展和用户习惯，而不是默认塞进来。'],
        [e('strong', null, '上下文优先：'), '作者认为 harness 最关键的部件是上下文管理与压缩，而不是继续叠加功能 —— 上下文的质量直接决定模型表现。'],
        [e('strong', null, '最大可扩展：'), '自定义工具、自定义 UI、自定义压缩、权限门、模型 provider、树状会话都留成接口。用一句话概括：让系统更容易改，而不是更容易欣赏。'],
        [e('strong', null, '可观测、可控：'), '反对黑箱；对「审批弹窗 = 安全」持怀疑态度，认为容器 / 沙箱是更可靠的边界。'],
      ],
    }),
    e(DocP, null,
      '本插件借了它三点：',
      e('strong', null, '工具克制'),
      '（只保留四个能讲清楚的能力）、',
      e('strong', null, '全部源码可读'),
      '（构建时内嵌 ',
      e(DocInline, null, 'SOURCES'),
      '，「源码」页所见即所跑）、',
      e('strong', null, '复杂度放在看得见的地方'),
      '（常量集中在 ',
      e(DocInline, null, '00-core.js'),
      '，循环、预算、压缩都在一个文件里）。'
    ),
    e(DocNote, { kind: 'warn', icon: '!', title: '极简不是免费' },
      '它把复杂度转移给了模型和用户。真实生产环境仍然需要权限、沙箱、审计、限流与可观测性；教学版有意省略这些外壳，只保留主干，以便看清 agent 到底在做什么。'
    ),
    e(DocNote, { icon: '⌘', title: '出处说明' },
      '以上是对 pi 作者 Mario Zechner 公开分享的设计取向的提炼（pi.dev），不是 pi 的文档，也没有复刻其代码。本插件的工具与 pi 的工具完全不同，相同的只是「少而可读」的取向。'
    )
  );
}

/* ── 第 09 节：对照真实 DSH ─────────────────────────────── */

function DocSectionHarness(props) {
  return e(DocSec, {
    no: props.no,
    title: '本插件与真实 DSH Agent 的对应',
    lead: '这个页面本身就是一个真实的 DSH Web 客户端插件。把教学插件和真实 DSH Agent 摆在一起，会发现骨架完全一样，差别主要在规模与工程保障。',
  },
    e(DocTable, {
      head: ['环节', '本插件（教学版）', '真实 DSH Agent'],
      rows: [
        ['决策者', '模拟模型（30-llm.js，离线可复现）或真实 DeepSeek（45-real-client.js + Host 路由）', '云端或本地大模型，流式返回并支持工具调用'],
        ['工具', 'calculator / clock / dice_roll / random_pick / password_generate / unit_convert / memory_write / memory_search', '终端命令、读写文件、搜索、网页等真实工具，带权限与沙箱'],
        ['循环', 'createLab 的 turn 循环，LAB_MAX_STEPS = 4', 'Agent 运行时驱动同一套循环，步数由配置与预算约束'],
        ['上下文', 'system + summary + memory + recent + input，默认 1000 token（可调）', 'system prompt + 技能 + 工具说明 + 历史，以万计的 token 窗口'],
        ['压缩', '90% 阈值触发，折叠旧消息进摘要', '窗口将满时摘要/裁剪，并持久化'],
        ['记忆', 'localStorage 键值 + 关键词召回', '会话存储、记忆机制与检索'],
        ['会话', '最多 20 个，每会话 120 条消息', '持久化会话、并发与多端'],
        ['界面', '本插件注册到 DSH 的 Web UI', '同一套 DSH Web 客户端插件系统'],
      ],
    }),
    e('p', { className: 'al-doc-p' }, e('strong', null, '这个插件是怎么跑进 DSH 的：')),
    e(DocSteps, {
      items: [
        ['package.json', ' 声明 ',
          e(DocInline, null, 'dsh.bundle.patch'),
          ' 与 ',
          e(DocInline, null, 'dsh.client'),
          '，告诉 DSH 这是一个 Web 客户端 bundle。'],
        ['build.mjs', ' 把 ',
          e(DocInline, null, 'src/*.js'),
          ' 按编号拼成一个 Client factory，并把每个源文件以 JSON 字符串注入为 ',
          e(DocInline, null, 'SOURCES'),
          '。'],
        ['DSH Web', ' 通过 ',
          e(DocInline, null, 'window.__ModuleLoader__'),
          ' 加载这个 factory，并提供 React 等依赖。'],
        ['95-apply.js', ' 把「Agent 实验室」注册到左侧栏与主区域 slot。'],
        ['90-page.js', ' 组装页面外壳与会话栏；「原理」「源码」页签分别渲染本文件与 80-source.js。'],
      ],
    }),
    e(DocNote, { kind: 'tip', icon: '◎', title: '所见即所跑' },
      '你在「源码」页看到的字符串，就是构建时注入的 ',
      e(DocInline, null, 'SOURCES'),
      ' —— 不是从服务器另取的文档，也不是压缩后的产物。构建产物 ',
      e(DocInline, null, 'client.js'),
      ' 与源码页展示的内容是同一份代码的两种形态。'
    ),
    e(DocP, null,
      '真实的 DSH Agent 还要处理：真实的模型鉴权与计费、工具权限与沙箱、流式输出的取消、会话落盘、上下文窗口的真实 token 计数。本插件为了离线与可读性，把这些等比缩小了 —— 但每一块的接口位置都能在下面的源码阅读顺序里找到。'
    )
  );
}

/* ── 第 10 节：真实 DeepSeek 模式 ───────────────────────── */

const DOC_REAL_CLIENT = [
  '// 45-real-client.js（简化）：把引擎上下文交给 Host 路由',
  'async function realModelAdapter({ messages, tools }) {',
  '  const res = await fetch("/agent-lab/complete", {',
  '    method: "POST",',
  '    headers: { "content-type": "application/json" },',
  '    body: JSON.stringify({ messages, tools, thinking: false }),',
  '  });',
  '  const data = await res.json();',
  '  if (!data.ok) throw new Error(data.error.message);',
  '  if (data.toolCalls.length > 0) {',
  '    return { type: "tool_call", name: data.toolCalls[0].name, args: data.toolCalls[0].args };',
  '  }',
  '  return { type: "final", text: data.text };',
  '}',
].join('\n');

const DOC_REAL_HOST = [
  '// index.js（Host 半侧，简化）：用 DSH 当前账号模型发一次请求',
  'const { provider, model } = ctx.agentDefaultModel.currentSelection();',
  'for await (const chunk of ctx.llm.stream({',
  '  provider, model,',
  '  system, messages, tools,',
  '  maxTokens: 900,',
  '  reasoningEffort: "off", // 教学用：关闭 thinking，聚焦原生 tool-call',
  '})) {',
  '  if (chunk.type === "text-delta") text += chunk.text;',
  '  if (chunk.type === "tool-call-delta") collectToolCall(chunk);',
  '}',
  '// 汇总为 { text, toolCalls, usage, latencyMs } 返回给浏览器',
].join('\n');

function DocSectionRealLLM(props) {
  return e(DocSec, {
    no: props.no,
    title: '真实 DeepSeek 模式：同一个循环，真模型决策',
    lead: '体验页终端右上角可以在「模拟 / 真实」之间切换。真实模式调用你 DSH 当前选中的 DeepSeek 模型（本机为 deepseek-account / deepseek-flash），但循环、工具、记忆、压缩仍由本插件自己执行 —— 换掉的只有「模型决策」这一层。',
  },
    e(DocFlowChain, {
      steps: ['Client 适配器', '同源 POST /agent-lab/complete', 'Host：ctx.llm.stream', '当前 DeepSeek 模型', 'tool_calls', '引擎执行工具 → 回填 → 下一轮'],
    }),
    e(DocP, null,
      '为什么不让浏览器直接请求模型 API：',
      e('strong', null, '密钥不能下发。 '),
      '浏览器请求只发到同源路由 ',
      e(DocInline, null, '/agent-lab/complete'),
      '，由 DSH Connection 校验登录态与 Origin；DeepSeek 账号凭证由 DSH 的 provider adapter 在 Host 侧解析，页面与构建产物里都不含 token 或 API key。'
    ),
    e(DocSteps, {
      items: [
        ['浏览器', '只调用同源接口；拿不到账号 token，也绕不过 DSH 的认证与 Host/Origin 检查。'],
        ['Host', 'index.js 通过 ',
          e(DocInline, null, 'agentDefaultModel.currentSelection()'),
          ' 读取当前 DSH 模型，再用 ',
          e(DocInline, null, 'ctx.llm.stream()'),
          ' 请求；账号鉴权由 adapter 完成。'],
        ['模型', '请求携带全部 8 个工具的 schema；模型返回原生 tool_calls，或直接返回 final 文本。'],
        ['引擎', '10-engine.js 执行工具，把 assistant(tool_call) 与 tool(result) 写回上下文，再发起下一次请求，直到 final。'],
      ],
    }),
    e(DocCode, { label: 'JavaScript · Client 适配器（45-real-client.js 的简化）', code: DOC_REAL_CLIENT }),
    e(DocCode, { label: 'JavaScript · Host 路由（index.js 的简化）', code: DOC_REAL_HOST }),
    e(DocNote, { icon: 'i', title: '教学取舍：关闭 thinking' },
      'DeepSeek 的 thinking 模式要求把 reasoning 块原样带回下一轮工具调用；为了让教学循环保持最小可解释，真实模式显式传入 ',
      e(DocInline, null, 'reasoningEffort: "off"'),
      '，只保留原生 tool-call 协议。真实产品需要保留 reasoning 与 replay 状态，DSH 的 Agent Loop 已经处理了这些。'
    ),
    e(DocNote, { kind: 'warn', icon: '!', title: '真实模式会消耗账号额度' },
      '一次工具调用至少产生两次模型请求：决定调用工具一次、拿到工具结果后生成回答再一次。当前模型跟随 DSH 设置 → 模型；切换模型后下一次请求生效。终端会显示每次请求的模型、耗时与 token 用量。'
    ),
    e(DocP, null,
      '当前版本是「完整响应后回传」：Host 聚齐 text / tool_calls / usage 再返回，终端仍用本地打字动画呈现。要做到逐 token 流式，可以把这条路由换成 SSE，把 text-delta 直接转给引擎的 token 事件 —— 循环与工具层不需要改。'
    ),
    e(DocNote, { icon: 'i', title: '失败时的表现' },
      '未登录、额度不足、限流、上下文超窗都会以中文错误行出现在终端，并保留在「流转」的模型阶段里；如果 Host 路由没有加载，真实模式按钮会禁用并显示原因。'
    )
  );
}

/* ── 第 11 节：新增一个工具 ─────────────────────────────── */

const DOC_NEW_TOOL = [
  '// 20-tools.js：把这样一个对象加进 LAB_TOOLS 数组即可',
  '{',
  '  name: "dice_roll",',
  '  description: "掷一个 n 面骰子，返回 1..n 的随机整数；用户说「掷骰子/随机数」时使用",',
  '  parameters: {',
  '    type: "object",',
  '    properties: {',
  '      sides: { type: "number", description: "骰子面数，默认 6，范围 2..100" },',
  '    },',
  '    required: [],',
  '  },',
  '  run(args) {',
  '    const raw = Number(args && args.sides);',
  '    const sides = Number.isFinite(raw) ? Math.max(2, Math.min(100, Math.round(raw))) : 6;',
  '    const value = 1 + Math.floor(Math.random() * sides);',
  '    return { ok: true, result: { sides, value }, display: "🎲 " + value + " / " + sides };',
  '  },',
  '}',
].join('\n');

function DocSectionNewTool(props) {
  return e(DocSec, {
    no: props.no,
    title: '如何新增一个工具',
    lead: '加工具只需要两步：注册一个函数，然后让模型知道它。规则模型靠一条意图规则，真实 LLM 靠随请求发出的 schema。',
  },
    e(DocSteps, {
      items: [
        [e('strong', null, '写工具：'), '按 ',
          e(DocInline, null, 'name / description / parameters / run'),
          ' 的形状写一个函数。'],
        [e('strong', null, '注册：'), '把它加进 ',
          e(DocInline, null, '20-tools.js'),
          ' 的 ',
          e(DocInline, null, 'LAB_TOOLS'),
          ' 数组。'],
        [e('strong', null, '让模型会调用：'), '本插件的模拟模型（',
          e(DocInline, null, '30-llm.js'),
          '）需要加一条识别「掷骰子」的意图规则并返回 ',
          e(DocInline, null, "type: 'tool_call'"),
          '；换成真实 LLM 后不需要写规则，schema 随请求发过去，模型会自己决定。'],
        [e('strong', null, '验证：'), '在「体验」页输入「掷一个 20 面骰子」，检查器「流转」应出现 tool 阶段、终端出现 ⚙ 与 ← 行；跑一遍无头测试；重新构建后「源码」页会自动包含新代码。'],
      ],
    }),
    e(DocCode, { label: 'JavaScript · 新增 dice_roll 工具', code: DOC_NEW_TOOL }),
    e(DocNote, { kind: 'tip', icon: '✓', title: '好工具的五个习惯' },
      '① description 写清「何时用 + 参数含义」，这是模型选择工具的唯一依据；② 参数永远校验与兜底，不信任模型；③ 失败返回 ',
      e(DocInline, null, 'ok: false'),
      ' 而不是抛异常；④ ',
      e(DocInline, null, 'display'),
      ' 面向人、',
      e(DocInline, null, 'result'),
      ' 面向程序；⑤ 像普通函数一样单测边界情况。'
    ),
    e(DocP, null,
      '注意：',
      e(DocInline, null, 'run'),
      ' 可以是 async，引擎会 await；真实工具（读写文件、执行命令）必须加权限与沙箱约束，不能把模型给的参数直接丢给系统执行。'
    )
  );
}

/* ── 第 12 节：源码阅读顺序 ─────────────────────────────── */

function DocSectionReading(props) {
  return e(DocSec, {
    no: props.no,
    title: '建议的源码阅读顺序',
    lead: '按「从最小单元到整体」的顺序读，每一站都配一次体验页操作。源码页里所有文件都是普通 JavaScript，没有构建魔法。',
  },
    e(DocOrdered, {
      items: [
        [e(DocInline, null, '00-core.js'), ' —— 先建立「预算」直觉：常量、token 估算、时间与截断工具。'],
        [e(DocInline, null, '20-tools.js'), ' —— 工具就是函数的最短完整例子；看懂它，后面所有「模型能做什么」都顺了。'],
        [e(DocInline, null, '30-llm.js'), ' —— 规则模型如何把一句话变成 tool_call 或 final；对照体验页的多次工具调用看。'],
        [e(DocInline, null, '10-engine.js'), ' —— 核心：会话、上下文组装、压缩、turn 循环、持久化、事件与 snapshot。'],
        [e(DocInline, null, '45-real-client.js → index.js（Host 半侧）'), ' —— 真实模型模式：同源适配器 + Host 的 ctx.llm 路由；先看状态接口，再看 complete 如何聚合并返回 tool_calls。'],
        [e(DocInline, null, '40-ui-kit.js → 50-tui.js → 60-inspector.js'), ' —— 界面如何把状态渲染成终端与三个检查器页签（可按兴趣略读）。'],
        [e(DocInline, null, '70-docs.js → 80-source.js'), ' —— 你正在读的原理页与源码浏览器；看看讲解如何与实现一一对应。'],
        [e(DocInline, null, '90-page.js → 95-apply.js'), ' —— 最后看外壳与 DSH slot 注册，「插件是怎么变成页面的」在这里收尾。'],
      ],
    }),
    e(DocNote, { icon: 'i', title: '读源码的正确姿势' },
      '打开「源码」页，左边选文件、右边读代码；遇到看不懂的常量就回「体验」页触发一次对应行为，再回「流转」页签看它产生了什么。读代码 + 跑行为 + 看数据，比只看代码快得多。'
    )
  );
}

/* ── 页面注册表 ─────────────────────────────────────────── */

const DOC_PAGE_SECTIONS = [
  { id: 'what', no: '01', title: '什么是 Agent', Comp: DocSectionWhat },
  { id: 'loop', no: '02', title: '最小循环', Comp: DocSectionLoop },
  { id: 'journey', no: '03', title: '一次输入的旅程', Comp: DocSectionJourney },
  { id: 'context', no: '04', title: '上下文与压缩', Comp: DocSectionContext },
  { id: 'memory', no: '05', title: '记忆', Comp: DocSectionMemory },
  { id: 'session', no: '06', title: '会话', Comp: DocSectionSession },
  { id: 'protocol', no: '07', title: '工具调用协议', Comp: DocSectionProtocol },
  { id: 'pi', no: '08', title: 'pi 的极简哲学', Comp: DocSectionPi },
  { id: 'harness', no: '09', title: '对照真实 DSH', Comp: DocSectionHarness },
  { id: 'real-llm', no: '10', title: '真实 DeepSeek 模式', Comp: DocSectionRealLLM },
  { id: 'new-tool', no: '11', title: '新增工具', Comp: DocSectionNewTool },
  { id: 'reading', no: '12', title: '源码阅读顺序', Comp: DocSectionReading },
];

/* ── 页面组件 ───────────────────────────────────────────── */

function DocsPage(props) {
  const handlers = props || {};
  const onNavigate = typeof handlers.onNavigate === 'function' ? handlers.onNavigate : null;
  const sectionRefs = useRef({});

  const registerRef = useCallback(function (id) {
    return function (node) {
      sectionRefs.current[id] = node;
    };
  }, []);

  const jumpTo = useCallback(function (id) {
    const node = sectionRefs.current[id];
    if (node && typeof node.scrollIntoView === 'function') {
      try {
        node.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (error) {
        /* 旧浏览器不支持平滑滚动时静默降级 */
      }
    }
  }, []);

  const sourceStats = useMemo(function () {
    if (typeof SOURCES === 'undefined' || !Array.isArray(SOURCES)) return null;
    let lines = 0;
    SOURCES.forEach(function (source) {
      lines += String((source && source.code) || '').split('\n').length;
    });
    return { files: SOURCES.length, lines: lines };
  }, []);

  return e('div', { className: 'al-doc-page' },
    e('style', { dangerouslySetInnerHTML: { __html: DOC_CSS } }),

    e('header', { className: 'al-doc-hero' },
      e('div', { className: 'al-doc-eyebrow' }, 'AGENT LAB · 原理'),
      e('h1', { className: 'al-doc-title' }, 'Agent 是怎样工作的'),
      e('p', { className: 'al-doc-lead' },
        '一个 Agent 不是魔法，而是「模型 + 工具 + 循环 + 记忆」的组合。这一页用当前插件作为活体样本，拆开一次输入从进入、拼装、决策、调工具到写回记忆的完整旅程 —— 默认用可复现的模拟模型，也可以一键切到真实 DeepSeek 模型。你可以在「体验」页亲手跑一遍，再到「源码」页核对每一行实现。'
      ),
      e('div', { className: 'al-doc-chips' },
        e(DocChip, null, '模拟模式可离线 · 真实模式联网'),
        e(DocChip, null, '模拟 / 真实双模式'),
        e(DocChip, null, '源码全部内嵌可读'),
        sourceStats ? e(DocChip, null, sourceStats.files + ' 个源文件 · 约 ' + sourceStats.lines + ' 行') : null
      )
    ),

    e('div', { className: 'al-doc-layout' },
      e('aside', { className: 'al-doc-toc' },
        e('div', { className: 'al-doc-toc-title' }, '本文目录'),
        e('nav', { className: 'al-doc-toc-list' },
          DOC_PAGE_SECTIONS.map(function (section) {
            return e('button', {
              key: section.id,
              type: 'button',
              className: 'al-doc-toc-item',
              onClick: function () { jumpTo(section.id); },
            },
              e('span', { className: 'al-doc-toc-no' }, section.no),
              e('span', null, section.title)
            );
          })
        )
      ),

      e('main', { className: 'al-doc-main' },
        DOC_PAGE_SECTIONS.map(function (section) {
          return e('div', { key: section.id, className: 'al-doc-sec-wrap', ref: registerRef(section.id) },
            e(section.Comp, { no: section.no })
          );
        }),

        e('footer', { className: 'al-doc-foot' },
          e('p', null,
            '本页由 Agent 实验室插件的 ',
            e(DocInline, null, '70-docs.js'),
            ' 渲染 —— 它和「体验」「源码」页是同一个 Client 里的普通 JavaScript，没有外部文档或网络资源。'
          ),
          e('p', null,
            '提醒：默认的模拟模型是规则驱动实现，用来把 agent 的骨架讲清楚、离线可复现；切到真实模式后，回答来自你 DSH 当前选中的 DeepSeek 模型，质量与额度都遵循该模型。'
          ),
          onNavigate
            ? e('button', {
              type: 'button',
              className: 'al-doc-btn',
              onClick: function () { onNavigate('source'); },
            }, '去「源码」页看真实代码 →')
            : e('p', null, '提示：切到顶部「源码」页，可以看到本页正在运行的每一行代码。')
        )
      )
    )
  );
}
