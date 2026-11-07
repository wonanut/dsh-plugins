/* ─────────────────────────────────────────────────────────────
 * 技术洞察 · UI 层
 * 全局样式（.ti- 前缀）与通用原语：图标、按钮、chip、弹窗、Toast、空态、
 * 安全 markdown-lite 渲染（只生成 React 元素，不做 HTML 注入）。
 * ───────────────────────────────────────────────────────────── */

const TI_CSS = `
.ti-root {
  --ti-bg: var(--dsw-alias-bg-base);
  --ti-layer: var(--dsw-alias-bg-layer-1);
  --ti-layer2: var(--dsw-alias-bg-layer-2);
  --ti-sidebar: var(--dsw-specific-sidebar-fill);
  --ti-text: var(--dsw-alias-label-primary);
  --ti-sub: var(--dsw-alias-label-secondary);
  --ti-tert: var(--dsw-alias-label-secondary);
  --ti-border: var(--dsw-alias-border-l1);
  --ti-border2: var(--dsw-alias-border-l2);
  --ti-brand: var(--dsw-alias-brand-primary);
  --ti-danger: var(--dsw-alias-state-error-primary);
  --ti-success: var(--dsw-alias-state-success-primary);
  --ti-warn: var(--dsw-alias-state-warn-primary);
  --ti-idle: var(--dsw-alias-state-idle-primary);
  --ti-accent: #0EA5E9;
  --ti-accent-soft: color-mix(in srgb, var(--ti-accent) 12%, transparent);
  --ti-accent-line: color-mix(in srgb, var(--ti-accent) 26%, transparent);
  --ti-accent-glow: color-mix(in srgb, var(--ti-accent) 32%, transparent);
  --ti-figure-fill: color-mix(in srgb, var(--ti-layer2) 76%, transparent);
  --ti-figure-stroke: color-mix(in srgb, var(--ti-border2) 88%, transparent);
  --ti-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 100%;
  overflow: hidden;
  color: var(--ti-text);
  background:
    radial-gradient(1100px 460px at 8% -12%, var(--ti-accent-soft), transparent 62%),
    radial-gradient(880px 420px at 100% 0%, color-mix(in srgb, var(--ti-brand) 5%, transparent), transparent 58%),
    var(--ti-bg);
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
.ti-root, .ti-root * { box-sizing: border-box; }
.ti-root :where(button, input, textarea, select) { font: inherit; color: inherit; }
.ti-root button { cursor: pointer; }
.ti-root ::selection { background: var(--ti-accent-glow); }
.ti-root ::-webkit-scrollbar { width: 10px; height: 10px; }
.ti-root ::-webkit-scrollbar-thumb { background: var(--ti-border2); border: 3px solid transparent; border-radius: 999px; background-clip: content-box; }
.ti-root ::-webkit-scrollbar-thumb:hover { background: var(--ti-sub); background-clip: content-box; }
.ti-root ::-webkit-scrollbar-track { background: transparent; }

.ti-inner {
  width: min(1560px, 100%);
  height: 100%;
  min-height: 0;
  margin: 0 auto;
  padding: calc(var(--dsh-frame-top-clearance, 0px) + 18px) 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ── header ─────────────────────────────────────────────── */
.ti-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; flex: none; }
.ti-brand { display: flex; align-items: center; gap: 13px; min-width: 0; }
.ti-logo {
  width: 44px; height: 44px; flex: none; border-radius: 13px;
  display: grid; place-items: center; color: #fff;
  background: linear-gradient(145deg, var(--ti-accent), color-mix(in srgb, var(--ti-accent) 58%, var(--dsw-alias-bg-overlay)));
  box-shadow: 0 10px 22px -12px var(--ti-accent-glow), inset 0 1px 0 rgba(255, 255, 255, .26);
  position: relative; overflow: hidden;
}
.ti-logo::after {
  content: ''; position: absolute; inset: -42% -10% auto auto; width: 72%; height: 90%;
  background: radial-gradient(circle, rgba(255, 255, 255, .38), transparent 68%);
  transform: rotate(18deg);
}
.ti-logo svg { position: relative; z-index: 1; }
.ti-title-row { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
.ti-title { margin: 0; font-size: 21px; line-height: 1.25; font-weight: 680; letter-spacing: -.02em; }
.ti-sub { margin: 3px 0 0; color: var(--ti-sub); font-size: 12.5px; max-width: 780px; }
.ti-head-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; flex: none; }

/* ── status chips ──────────────────────────────────────── */
.ti-chips { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.ti-chip {
  display: inline-flex; align-items: center; gap: 5px;
  height: 24px; padding: 0 9px; border-radius: 999px;
  border: 1px solid var(--ti-border); background: color-mix(in srgb, var(--ti-layer) 76%, transparent);
  color: var(--ti-sub); font-size: 11px; font-weight: 560; white-space: nowrap;
}
.ti-chip svg { flex: none; }
.ti-chip-brand { color: var(--ti-accent); border-color: var(--ti-accent-line); background: var(--ti-accent-soft); }
.ti-chip-good { color: var(--ti-success); border-color: color-mix(in srgb, var(--ti-success) 28%, transparent); background: color-mix(in srgb, var(--ti-success) 10%, transparent); }
.ti-chip-warn { color: var(--ti-warn); border-color: color-mix(in srgb, var(--ti-warn) 28%, transparent); background: color-mix(in srgb, var(--ti-warn) 10%, transparent); }
.ti-chip-idle { color: var(--ti-idle); border-color: color-mix(in srgb, var(--ti-idle) 26%, transparent); background: color-mix(in srgb, var(--ti-idle) 8%, transparent); }
.ti-chip-danger { color: var(--ti-danger); border-color: color-mix(in srgb, var(--ti-danger) 28%, transparent); background: color-mix(in srgb, var(--ti-danger) 9%, transparent); }
.ti-chip-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

/* ── buttons ───────────────────────────────────────────── */
.ti-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 34px; padding: 0 13px; border-radius: 10px;
  border: 1px solid transparent; background: transparent; color: var(--ti-text);
  font-size: 12.5px; font-weight: 560; white-space: nowrap; user-select: none;
  transition: transform .15s ease, background .15s ease, border-color .15s ease, box-shadow .15s ease, opacity .15s ease, color .15s ease;
}
.ti-btn:hover { transform: translateY(-1px); }
.ti-btn:active { transform: translateY(0); }
.ti-btn:disabled { opacity: .42; cursor: not-allowed; transform: none; }
.ti-btn:focus-visible { outline: 2px solid var(--ti-accent); outline-offset: 2px; }
.ti-btn-sm { height: 28px; padding: 0 10px; font-size: 12px; border-radius: 8px; gap: 4px; }
.ti-btn-primary {
  color: #fff;
  background: linear-gradient(135deg, var(--ti-accent), color-mix(in srgb, var(--ti-accent) 62%, var(--dsw-alias-bg-overlay)));
  box-shadow: 0 8px 18px -10px var(--ti-accent-glow), inset 0 1px 0 rgba(255, 255, 255, .22);
}
.ti-btn-primary span, .ti-btn-primary svg { color: #fff; }
.ti-btn-primary:hover { box-shadow: 0 12px 24px -10px var(--ti-accent-glow), inset 0 1px 0 rgba(255, 255, 255, .3); }
.ti-btn-soft { color: var(--ti-accent); background: var(--ti-accent-soft); }
.ti-btn-soft:hover { background: color-mix(in srgb, var(--ti-accent) 18%, transparent); }
.ti-btn-ghost { color: var(--ti-sub); border-color: var(--ti-border); background: var(--ti-layer); }
.ti-btn-ghost:hover { color: var(--ti-text); border-color: var(--ti-border2); background: var(--ti-layer2); }
.ti-btn-danger { color: var(--ti-danger); border-color: color-mix(in srgb, var(--ti-danger) 26%, transparent); background: transparent; }
.ti-btn-danger:hover { background: color-mix(in srgb, var(--ti-danger) 9%, transparent); }
.ti-btn-icon { width: 34px; padding: 0; }
.ti-btn-icon.ti-btn-sm { width: 28px; }
.ti-iconbtn {
  width: 28px; height: 28px; display: inline-grid; place-items: center; flex: none;
  border: 1px solid transparent; background: transparent; border-radius: 8px; color: var(--ti-sub);
  transition: background .15s ease, color .15s ease, border-color .15s ease, opacity .15s ease;
}
.ti-iconbtn:hover { background: var(--ti-layer2); color: var(--ti-text); border-color: var(--ti-border); }
.ti-iconbtn:focus-visible { outline: 2px solid var(--ti-accent); outline-offset: 2px; }
.ti-iconbtn.danger:hover { color: var(--ti-danger); background: color-mix(in srgb, var(--ti-danger) 10%, transparent); border-color: color-mix(in srgb, var(--ti-danger) 22%, transparent); }
.ti-iconbtn:disabled { opacity: .35; cursor: not-allowed; }

/* ── layout body ───────────────────────────────────────── */
.ti-body { flex: 1; min-height: 0; display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 16px; }
.ti-rail {
  display: flex; flex-direction: column; min-height: 0; overflow: hidden;
  border: 1px solid var(--ti-border); border-radius: 15px;
  background: color-mix(in srgb, var(--ti-layer) 82%, transparent);
}
.ti-rail-head { padding: 12px 12px 9px; display: flex; flex-direction: column; gap: 8px; flex: none; border-bottom: 1px solid var(--ti-border); }
.ti-rail-head-actions { display: flex; align-items: center; gap: 4px; flex: none; }
.ti-rail-title-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ti-rail-title { font-size: 12px; font-weight: 650; letter-spacing: .02em; }
.ti-rail-count { color: var(--ti-sub); font-size: 11px; font-variant-numeric: tabular-nums; }
.ti-rail-list { flex: 1; min-height: 0; overflow: auto; padding: 6px; display: flex; flex-direction: column; gap: 4px; }
.ti-item-pending { border-style: dashed; border-color: var(--ti-accent-line); background: color-mix(in srgb, var(--ti-accent) 6%, transparent); }
.ti-pending-tag {
  display: inline-flex; align-items: center; gap: 5px;
  color: var(--ti-accent); font-size: 10.5px; font-weight: 650; white-space: nowrap;
}
.ti-pending-tag .ti-spinner { width: 10px; height: 10px; border-width: 1.6px; }

.ti-rail-empty { padding: 26px 16px; text-align: center; color: var(--ti-sub); font-size: 12px; line-height: 1.7; }
.ti-search { position: relative; }
.ti-search svg { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); color: var(--ti-sub); pointer-events: none; }
.ti-search input {
  width: 100%; height: 31px; padding: 0 10px 0 29px;
  border: 1px solid var(--ti-border); border-radius: 9px;
  background: var(--ti-layer2); color: var(--ti-text); font-size: 12px; outline: none;
  transition: border-color .16s ease, box-shadow .16s ease;
}
.ti-search input::placeholder { color: var(--ti-sub); }
.ti-search input:focus { border-color: var(--ti-accent); box-shadow: 0 0 0 3px var(--ti-accent-soft); }

/* ── archive items ─────────────────────────────────────── */
.ti-item {
  display: block; width: 100%; text-align: left; position: relative;
  border-radius: 10px; border: 1px solid transparent;
  background: transparent; color: var(--ti-text);
  transition: background .15s ease, border-color .15s ease;
}
.ti-item:hover { background: var(--ti-layer2); border-color: var(--ti-border); }
.ti-item-main {
  display: block; width: 100%; text-align: left; padding: 9px 10px;
  border: 0; border-radius: inherit; background: transparent; color: inherit;
}
.ti-item-main:focus-visible { outline: 2px solid var(--ti-accent); outline-offset: 1px; }
.ti-item.on { background: var(--ti-accent-soft); border-color: var(--ti-accent-line); }
.ti-item-title {
  font-size: 12.5px; font-weight: 600; line-height: 1.42;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  padding-right: 22px;
}
.ti-item-meta { margin-top: 4px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; color: var(--ti-sub); font-size: 10.5px; }
.ti-item-meta b { font-weight: 600; color: var(--ti-sub); }
.ti-item-dot { width: 3px; height: 3px; border-radius: 50%; background: var(--ti-border2); }
.ti-item-del {
  position: absolute; top: 7px; right: 6px; width: 22px; height: 22px;
  display: grid; place-items: center; border: 0; border-radius: 6px;
  background: transparent; color: var(--ti-sub); opacity: 0;
  transition: opacity .14s ease, background .14s ease, color .14s ease;
}
.ti-item:hover .ti-item-del, .ti-item:focus-within .ti-item-del { opacity: 1; }
.ti-item-del:hover { background: color-mix(in srgb, var(--ti-danger) 12%, transparent); color: var(--ti-danger); }
.ti-item-del:focus-visible { opacity: 1; outline: 2px solid var(--ti-accent); outline-offset: 1px; }

/* ── main scroll area ──────────────────────────────────── */
.ti-main { min-height: 0; overflow: auto; padding: 2px 4px 8px 2px; display: flex; flex-direction: column; }
/* 报告区铺满可用宽度，避免宽屏下右侧大片留白 */
.ti-main-inner { display: flex; flex-direction: column; gap: 14px; width: 100%; min-height: 100%; flex: 1; }
.ti-anim { animation: ti-rise .22s cubic-bezier(.2, .75, .25, 1) both; }

/* ── generator / empty ─────────────────────────────────── */
.ti-generator { display: flex; flex-direction: column; gap: 16px; }
.ti-gen-hero {
  border: 1px solid var(--ti-border); border-radius: 16px;
  background:
    radial-gradient(620px 260px at 100% 0%, var(--ti-accent-soft), transparent 68%),
    color-mix(in srgb, var(--ti-layer) 88%, transparent);
  padding: 24px; display: flex; flex-direction: column; gap: 6px;
}
.ti-gen-kicker { display: inline-flex; align-items: center; gap: 7px; color: var(--ti-accent); font-size: 11px; font-weight: 640; letter-spacing: .08em; text-transform: uppercase; }
.ti-gen-title { margin: 6px 0 2px; font-size: clamp(22px, 2.3vw, 28px); line-height: 1.2; font-weight: 700; letter-spacing: -.03em; }
.ti-gen-desc { margin: 0; color: var(--ti-sub); font-size: 13px; max-width: 620px; }
.ti-gen-card {
  border: 1px solid var(--ti-border); border-radius: 16px; padding: 20px;
  background: color-mix(in srgb, var(--ti-layer) 86%, transparent);
  display: flex; flex-direction: column; gap: 14px;
}
.ti-label { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; color: var(--ti-sub); font-size: 11.5px; font-weight: 580; }
.ti-label em { font-style: normal; color: var(--ti-danger); margin-left: 2px; }
.ti-label-tip { color: var(--ti-sub); font-size: 10.5px; font-weight: 500; }
.ti-input, .ti-textarea {
  width: 100%; border: 1px solid var(--ti-border); border-radius: 11px;
  background: var(--ti-layer2); color: var(--ti-text); padding: 10px 12px;
  font-size: 13px; line-height: 1.6; outline: none;
  transition: border-color .16s ease, box-shadow .16s ease, background .16s ease;
}
.ti-textarea { resize: vertical; min-height: 64px; }
.ti-input:focus, .ti-textarea:focus { border-color: var(--ti-accent); background: var(--ti-layer); box-shadow: 0 0 0 3px var(--ti-accent-soft); }
.ti-input::placeholder, .ti-textarea::placeholder { color: var(--ti-sub); }
.ti-textarea.ti-topic { min-height: 54px; max-height: 140px; font-size: 15px; }
.ti-gen-row { display: flex; flex-direction: column; gap: 6px; }
.ti-depth-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ti-depth {
  display: inline-flex; align-items: baseline; gap: 6px;
  padding: 7px 12px; border-radius: 10px; border: 1px solid var(--ti-border);
  background: var(--ti-layer2); color: var(--ti-sub); font-size: 12px; font-weight: 560;
  transition: background .15s ease, border-color .15s ease, color .15s ease, box-shadow .15s ease;
}
.ti-depth small { color: var(--ti-sub); font-size: 10.5px; font-weight: 500; }
.ti-depth:hover { color: var(--ti-text); border-color: var(--ti-border2); }
.ti-depth:focus-visible { outline: 2px solid var(--ti-accent); outline-offset: 2px; }
.ti-depth.on { color: var(--ti-accent); border-color: var(--ti-accent); background: var(--ti-accent-soft); box-shadow: 0 0 0 3px var(--ti-accent-soft); }
.ti-depth.on small { color: var(--ti-accent); opacity: .8; }
.ti-gen-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding-top: 2px; }
.ti-examples { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; color: var(--ti-sub); font-size: 11px; }
.ti-example {
  height: 24px; padding: 0 9px; border-radius: 999px; border: 1px dashed var(--ti-border2);
  background: transparent; color: var(--ti-sub); font-size: 11px;
  transition: color .15s ease, border-color .15s ease, background .15s ease;
}
.ti-example:hover { color: var(--ti-accent); border-color: var(--ti-accent-line); background: var(--ti-accent-soft); }
.ti-example:focus-visible { outline: 2px solid var(--ti-accent); outline-offset: 2px; }
.ti-hint { color: var(--ti-sub); font-size: 10.5px; line-height: 1.5; }
.ti-error-text { color: var(--ti-danger); font-size: 11.5px; }

/* ── progress ──────────────────────────────────────────── */
.ti-progress-card {
  border: 1px solid var(--ti-border); border-radius: 16px; padding: 22px;
  background: color-mix(in srgb, var(--ti-layer) 88%, transparent);
  display: flex; flex-direction: column; gap: 18px;
}
.ti-progress-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.ti-progress-title { margin: 0; font-size: 16px; font-weight: 660; letter-spacing: -.015em; }
.ti-progress-sub { margin: 3px 0 0; color: var(--ti-sub); font-size: 12px; }
.ti-progress-time { color: var(--ti-sub); font-size: 12px; font-variant-numeric: tabular-nums; display: inline-flex; align-items: center; gap: 5px; }
.ti-bar { height: 6px; border-radius: 999px; background: var(--ti-layer2); overflow: hidden; }
.ti-bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--ti-accent), color-mix(in srgb, var(--ti-accent) 62%, var(--ti-brand))); transition: width .35s ease; }
.ti-steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.ti-step {
  border: 1px solid var(--ti-border); border-radius: 11px; padding: 10px 11px;
  background: color-mix(in srgb, var(--ti-layer2) 64%, transparent);
  display: flex; flex-direction: column; gap: 3px; min-width: 0;
  transition: border-color .2s ease, background .2s ease;
}
.ti-step-head { display: flex; align-items: center; gap: 6px; color: var(--ti-sub); font-size: 12px; font-weight: 600; }
.ti-step-index {
  width: 17px; height: 17px; flex: none; border-radius: 50%;
  display: grid; place-items: center; font-size: 9.5px; font-weight: 700;
  border: 1px solid var(--ti-border2); color: var(--ti-sub); background: transparent;
}
.ti-step-hint { color: var(--ti-sub); font-size: 10.5px; line-height: 1.4; }
.ti-step.on { border-color: var(--ti-accent-line); background: var(--ti-accent-soft); }
.ti-step.on .ti-step-head { color: var(--ti-text); }
.ti-step.on .ti-step-index { border-color: var(--ti-accent); background: var(--ti-accent); color: #fff; }
.ti-step.done .ti-step-head { color: var(--ti-sub); }
.ti-step.done .ti-step-index { border-color: color-mix(in srgb, var(--ti-success) 40%, transparent); color: var(--ti-success); background: color-mix(in srgb, var(--ti-success) 12%, transparent); }
.ti-progress-panel { border-top: 1px solid var(--ti-border); padding-top: 14px; display: flex; flex-direction: column; gap: 8px; }
.ti-progress-panel-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 11.5px; font-weight: 620; color: var(--ti-sub); }
.ti-queries { display: flex; flex-wrap: wrap; gap: 6px; }
.ti-query { padding: 2px 8px; border-radius: 999px; background: var(--ti-layer2); border: 1px solid var(--ti-border); color: var(--ti-sub); font-size: 10.5px; }
.ti-sources { display: flex; flex-direction: column; gap: 5px; max-height: 232px; overflow: auto; }
.ti-source { display: flex; align-items: flex-start; gap: 8px; padding: 7px 9px; border-radius: 9px; background: color-mix(in srgb, var(--ti-layer2) 70%, transparent); border: 1px solid transparent; }
.ti-source-index { flex: none; width: 16px; height: 16px; margin-top: 1px; border-radius: 5px; display: grid; place-items: center; background: var(--ti-accent-soft); color: var(--ti-accent); font-size: 9.5px; font-weight: 700; }
.ti-source-main { min-width: 0; flex: 1; }
.ti-source-title { font-size: 11.5px; font-weight: 560; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
.ti-source-site { color: var(--ti-sub); font-size: 10px; }
.ti-skeleton { border-radius: 8px; background: linear-gradient(90deg, var(--ti-layer2) 25%, color-mix(in srgb, var(--ti-layer2) 55%, var(--ti-layer)) 45%, var(--ti-layer2) 65%); background-size: 220% 100%; animation: ti-shimmer 1.3s ease infinite; }
.ti-skeleton-row { height: 34px; }

/* ── report ────────────────────────────────────────────── */
.ti-report { display: flex; flex-direction: column; gap: 14px; flex: 1; min-height: 0; }
.ti-report-foot {
  margin-top: auto; padding-top: 12px; border-top: 1px dashed var(--ti-border);
  display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;
  color: var(--ti-sub); font-size: 11px;
}
.ti-report-foot-actions { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.ti-report-head {
  border: 1px solid var(--ti-border); border-radius: 16px; padding: 20px 22px;
  background:
    radial-gradient(680px 240px at 100% -20%, var(--ti-accent-soft), transparent 66%),
    color-mix(in srgb, var(--ti-layer) 88%, transparent);
  display: flex; flex-direction: column; gap: 10px;
}
.ti-report-kicker { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; color: var(--ti-sub); font-size: 11px; }
.ti-report-title { margin: 0; font-size: clamp(20px, 2.1vw, 25px); line-height: 1.3; font-weight: 700; letter-spacing: -.025em; }
.ti-report-oneliner { margin: 0; color: var(--ti-sub); font-size: 13px; line-height: 1.7; max-width: 860px; }
.ti-report-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; color: var(--ti-sub); font-size: 11px; }
.ti-report-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-top: 4px; }
.ti-report-actions .ti-spacer { flex: 1; }
.ti-spacer { flex: 1; }
.ti-tabs { display: inline-flex; align-items: center; gap: 3px; padding: 3px; border-radius: 10px; background: var(--ti-layer2); border: 1px solid var(--ti-border); }
.ti-tab {
  height: 26px; padding: 0 11px; border-radius: 7px; border: 0; background: transparent;
  color: var(--ti-sub); font-size: 11.5px; font-weight: 560;
  display: inline-flex; align-items: center; gap: 5px;
  transition: background .15s ease, color .15s ease;
}
.ti-tab:hover { color: var(--ti-text); }
.ti-tab:focus-visible { outline: 2px solid var(--ti-accent); outline-offset: 1px; }
.ti-tab.on { background: var(--ti-layer); color: var(--ti-text); box-shadow: 0 1px 2px color-mix(in srgb, var(--ti-text) 8%, transparent); }
.ti-tab-badge { min-width: 16px; height: 16px; padding: 0 4px; border-radius: 999px; display: inline-grid; place-items: center; background: var(--ti-accent-soft); color: var(--ti-accent); font-size: 9.5px; font-weight: 700; }

/* 分节卡片 */
/* 报告正文固定单列，避免分节并排导致的阅读断点 */
.ti-sections { display: flex; flex-direction: column; gap: 12px; }
.ti-section {
  border: 1px solid var(--ti-border); border-radius: 14px;
  background: color-mix(in srgb, var(--ti-layer) 86%, transparent);
  overflow: hidden; transition: border-color .18s ease, box-shadow .18s ease;
}
.ti-section:hover { border-color: var(--ti-border2); }
.ti-section.collapsed .ti-section-body { display: none; }
.ti-section-head { display: flex; align-items: center; gap: 9px; padding: 12px 13px; }
.ti-section-badge {
  width: 28px; height: 28px; flex: none; border-radius: 9px; display: grid; place-items: center;
  background: var(--ti-accent-soft); color: var(--ti-accent); border: 1px solid var(--ti-accent-line);
}
.ti-section-head-main { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 7px; }
.ti-section-title { margin: 0; font-size: 13px; font-weight: 650; letter-spacing: -.01em; }
.ti-section-key { color: var(--ti-sub); font-size: 9.5px; letter-spacing: .06em; text-transform: uppercase; }
.ti-section-tools { display: flex; align-items: center; gap: 2px; flex: none; }
.ti-section-body { padding: 2px 15px 15px; }
.ti-section-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.ti-empty-body { color: var(--ti-sub); font-size: 12px; padding: 12px 0 4px; }

/* 归档目录收起后的窄条 */
.ti-body.rail-collapsed { grid-template-columns: 42px minmax(0, 1fr); }
.ti-rail-toggle {
  width: 100%; height: 100%; min-height: 140px; padding: 12px 0;
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  border: 1px solid var(--ti-border); border-radius: 14px;
  background: color-mix(in srgb, var(--ti-layer) 86%, transparent);
  color: var(--ti-sub); cursor: pointer;
  transition: color .15s ease, border-color .15s ease, background .15s ease;
}
.ti-rail-toggle:hover { color: var(--ti-text); border-color: var(--ti-border2); background: var(--ti-layer2); }
.ti-rail-toggle:focus-visible { outline: 2px solid var(--ti-accent); outline-offset: 1px; }
.ti-rail-toggle-label { writing-mode: vertical-rl; letter-spacing: .2em; font-size: 11px; }
.ti-rail-toggle-count {
  min-width: 18px; height: 18px; padding: 0 4px; border-radius: 999px;
  display: inline-grid; place-items: center; font-size: 10px; font-weight: 700;
  color: var(--ti-accent); background: var(--ti-accent-soft); border: 1px solid var(--ti-accent-line);
}

/* 内联 SVG 图 */
.ti-figure {
  margin: 2px 0 14px; border: 1px solid var(--ti-border); border-radius: 12px;
  background: color-mix(in srgb, var(--ti-layer2) 58%, transparent); overflow: hidden;
}
.ti-figure-head {
  display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
  padding: 9px 12px; border-bottom: 1px dashed var(--ti-border);
}
.ti-figure-badge {
  width: 22px; height: 22px; flex: none; border-radius: 7px; display: grid; place-items: center;
  color: var(--ti-accent); background: var(--ti-accent-soft); border: 1px solid var(--ti-accent-line);
}
.ti-figure-title { font-size: 12px; font-weight: 650; color: var(--ti-text); }
.ti-figure-hint { margin-left: auto; font-size: 10.5px; color: var(--ti-sub); }
.ti-figure-canvas { padding: 10px 12px 12px; overflow-x: auto; }
.ti-svg { display: block; width: 100%; height: auto; min-width: 500px; font-family: inherit; }
.ti-svg text { font-family: inherit; }

/* markdown-lite */
.ti-rich { color: var(--ti-text); font-size: 12.5px; line-height: 1.75; overflow-wrap: anywhere; }
.ti-rich p { margin: 0 0 9px; }
.ti-rich p:last-child { margin-bottom: 0; }
.ti-rich h4 { margin: 13px 0 6px; font-size: 12.5px; font-weight: 680; color: var(--ti-text); }
.ti-rich h4:first-child { margin-top: 0; }
.ti-rich strong { font-weight: 650; }
.ti-rich code { font-family: var(--ti-mono); font-size: 11px; padding: 1px 5px; border-radius: 5px; background: var(--ti-layer2); border: 1px solid var(--ti-border); }
.ti-rich a { color: var(--ti-accent); text-decoration: none; border-bottom: 1px solid var(--ti-accent-line); }
.ti-rich a:hover { border-bottom-color: var(--ti-accent); }
.ti-rich ul, .ti-rich ol { margin: 0 0 9px; padding-left: 20px; display: flex; flex-direction: column; gap: 3px; }
.ti-rich li { line-height: 1.7; }
.ti-rich li::marker { color: var(--ti-accent); }
.ti-rich-empty { color: var(--ti-sub); font-size: 12px; margin: 0; }

/* 参考 */
.ti-refs {
  border: 1px solid var(--ti-border); border-radius: 14px; padding: 16px 18px;
  background: color-mix(in srgb, var(--ti-layer) 84%, transparent);
  display: flex; flex-direction: column; gap: 9px;
}
.ti-refs-head { display: flex; align-items: center; gap: 8px; }
.ti-refs-title { margin: 0; font-size: 13px; font-weight: 650; }
.ti-refs-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; }
.ti-ref { display: flex; align-items: flex-start; gap: 9px; padding: 7px 9px; border-radius: 9px; border: 1px solid transparent; background: color-mix(in srgb, var(--ti-layer2) 55%, transparent); }
.ti-ref-index { flex: none; width: 18px; height: 18px; margin-top: 1px; border-radius: 6px; display: grid; place-items: center; background: var(--ti-layer); border: 1px solid var(--ti-border); color: var(--ti-sub); font-size: 9.5px; font-weight: 700; font-variant-numeric: tabular-nums; }
.ti-ref-main { min-width: 0; flex: 1; }
.ti-ref-link { display: inline-flex; align-items: flex-start; gap: 4px; color: var(--ti-accent); font-size: 12px; font-weight: 560; line-height: 1.5; text-decoration: none; word-break: break-all; }
.ti-ref-link:hover { text-decoration: underline; }
.ti-ref-link svg { flex: none; margin-top: 2px; }
.ti-ref-note { margin-top: 1px; color: var(--ti-sub); font-size: 11px; line-height: 1.55; }
.ti-ref-url { color: var(--ti-sub); font-size: 10px; font-family: var(--ti-mono); opacity: .75; word-break: break-all; }

/* ── history ──────────────────────────────────────────── */
.ti-history { display: flex; flex-direction: column; gap: 12px; }
.ti-history-head { border: 1px solid var(--ti-border); border-radius: 14px; padding: 16px 18px; background: color-mix(in srgb, var(--ti-layer) 86%, transparent); display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.ti-history-title { margin: 0; font-size: 15px; font-weight: 660; }
.ti-history-sub { margin: 3px 0 0; color: var(--ti-sub); font-size: 11.5px; }
.ti-history-list { display: flex; flex-direction: column; gap: 8px; }
.ti-rev {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  border: 1px solid var(--ti-border); border-radius: 12px; padding: 11px 14px;
  background: color-mix(in srgb, var(--ti-layer) 82%, transparent);
  transition: border-color .16s ease;
}
.ti-rev:hover { border-color: var(--ti-border2); }
.ti-rev.current { border-color: var(--ti-accent-line); background: color-mix(in srgb, var(--ti-accent) 6%, var(--ti-layer)); }
.ti-rev-main { flex: 1; min-width: 200px; }
.ti-rev-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ti-rev-badge { display: inline-flex; align-items: center; height: 20px; padding: 0 7px; border-radius: 6px; background: var(--ti-accent-soft); color: var(--ti-accent); font-size: 10.5px; font-weight: 700; font-variant-numeric: tabular-nums; }
.ti-rev-note { font-size: 12.5px; font-weight: 560; line-height: 1.5; overflow-wrap: anywhere; }
.ti-rev-meta { margin-top: 2px; color: var(--ti-sub); font-size: 10.5px; }
.ti-rev-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

/* ── modal / forms ─────────────────────────────────────── */
.ti-overlay {
  position: fixed; inset: 0; z-index: 80; display: flex; align-items: center; justify-content: center;
  padding: max(20px, calc(var(--dsh-frame-top-clearance, 0px) + 12px)) 20px 20px;
  background: color-mix(in srgb, var(--dsw-alias-bg-overlay) 62%, transparent);
  backdrop-filter: blur(7px);
  animation: ti-fade .18s ease both;
}
.ti-modal {
  width: min(640px, 100%); max-height: min(86vh, 900px); display: flex; flex-direction: column;
  border: 1px solid var(--ti-border2); border-radius: 18px;
  background: var(--ti-layer); color: var(--ti-text);
  box-shadow: 0 40px 100px -40px rgba(0, 0, 0, .45);
  animation: ti-rise .24s cubic-bezier(.2, .75, .25, 1) both;
  outline: none;
}
.ti-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; padding: 19px 21px 13px; border-bottom: 1px solid var(--ti-border); }
.ti-modal-title { margin: 0; font-size: 16px; font-weight: 680; letter-spacing: -.02em; }
.ti-modal-sub { margin: 3px 0 0; color: var(--ti-sub); font-size: 11.5px; line-height: 1.6; }
.ti-modal-body { padding: 16px 21px; overflow-y: auto; display: flex; flex-direction: column; gap: 13px; }
.ti-modal-foot { display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 12px 21px 16px; border-top: 1px solid var(--ti-border); }
.ti-form { display: flex; flex-direction: column; gap: 13px; }
.ti-switch { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: 11px; border: 1px solid var(--ti-border); background: var(--ti-layer2); cursor: pointer; position: relative; }
.ti-switch:focus-within { border-color: var(--ti-accent); box-shadow: 0 0 0 3px var(--ti-accent-soft); }
.ti-switch-track {
  width: 34px; height: 20px; flex: none; margin-top: 1px; border-radius: 999px;
  background: var(--ti-border2); position: relative; transition: background .16s ease;
}
.ti-switch-track::after {
  content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%;
  background: var(--ti-layer); box-shadow: 0 1px 3px rgba(0, 0, 0, .2); transition: transform .16s ease;
}
.ti-switch input { position: absolute; opacity: 0; pointer-events: none; }
.ti-switch.on .ti-switch-track { background: var(--ti-accent); }
.ti-switch.on .ti-switch-track::after { transform: translateX(14px); }
.ti-switch-main { min-width: 0; }
.ti-switch-title { font-size: 12.5px; font-weight: 600; }
.ti-switch-desc { margin-top: 1px; color: var(--ti-sub); font-size: 10.5px; line-height: 1.5; }
.ti-preview-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; color: var(--ti-sub); font-size: 11px; }
.ti-preview-section { border-top: 1px solid var(--ti-border); padding-top: 11px; }
.ti-preview-section:first-of-type { border-top: 0; padding-top: 0; }

/* ── toast / empty / spinner ───────────────────────────── */
.ti-toast {
  position: fixed; left: 50%; bottom: 26px; z-index: 120; transform: translateX(-50%);
  display: inline-flex; align-items: center; gap: 8px; padding: 10px 15px;
  border-radius: 11px; border: 1px solid var(--ti-border2);
  background: color-mix(in srgb, var(--ti-layer) 94%, transparent);
  backdrop-filter: blur(12px);
  color: var(--ti-text); font-size: 12.5px; font-weight: 520; max-width: min(560px, calc(100vw - 40px));
  box-shadow: 0 22px 50px -22px rgba(0, 0, 0, .32);
  animation: ti-toast-in .22s cubic-bezier(.2, .75, .25, 1) both;
}
.ti-toast svg { flex: none; }
.ti-toast.success svg { color: var(--ti-success); }
.ti-toast.error svg { color: var(--ti-danger); }
.ti-toast.info svg { color: var(--ti-accent); }
.ti-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  padding: 46px 22px; text-align: center; color: var(--ti-sub);
  border: 1px dashed var(--ti-border2); border-radius: 16px;
  background: color-mix(in srgb, var(--ti-layer) 55%, transparent);
}
.ti-empty-icon { width: 44px; height: 44px; border-radius: 13px; display: grid; place-items: center; background: var(--ti-layer2); color: var(--ti-sub); margin-bottom: 4px; }
.ti-empty-title { font-size: 13.5px; font-weight: 620; color: var(--ti-text); }
.ti-empty-body { max-width: 400px; font-size: 12px; line-height: 1.65; }
.ti-spinner { width: 15px; height: 15px; flex: none; border-radius: 50%; border: 2px solid var(--ti-border2); border-top-color: var(--ti-accent); animation: ti-spin .8s linear infinite; }
.ti-spinner.lg { width: 26px; height: 26px; border-width: 2.5px; }
.ti-loading-row { display: inline-flex; align-items: center; gap: 8px; color: var(--ti-sub); font-size: 11.5px; }

/* 错误卡 */
.ti-error-card {
  border: 1px solid color-mix(in srgb, var(--ti-danger) 30%, transparent);
  border-radius: 15px; padding: 20px 22px;
  background: color-mix(in srgb, var(--ti-danger) 6%, var(--ti-layer));
  display: flex; flex-direction: column; gap: 10px;
}
.ti-error-head { display: flex; align-items: center; gap: 9px; color: var(--ti-danger); }
.ti-error-title { margin: 0; font-size: 14px; font-weight: 680; }
.ti-error-body { margin: 0; color: var(--ti-text); font-size: 12.5px; line-height: 1.7; overflow-wrap: anywhere; }
.ti-error-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-top: 2px; }

@keyframes ti-spin { to { transform: rotate(360deg); } }
@keyframes ti-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes ti-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes ti-toast-in { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }
@keyframes ti-shimmer { from { background-position: 180% 0; } to { background-position: -80% 0; } }

/* ── 页面崩溃兜底 ──────────────────────────────────────── */
.ti-crash {
  min-height: 100%; margin: 0 auto; padding: 48px 24px; max-width: 860px;
  display: flex; flex-direction: column; gap: 12px; color: var(--ti-text);
}
.ti-crash-title { margin: 0; font-size: 18px; font-weight: 680; }
.ti-crash-sub { margin: 0; color: var(--ti-sub); font-size: 12.5px; line-height: 1.7; }
.ti-crash-detail {
  margin: 0; padding: 12px 14px; border: 1px solid var(--ti-border); border-radius: 10px;
  background: var(--ti-layer2); color: var(--ti-sub); font-family: var(--ti-mono);
  font-size: 11px; line-height: 1.6; white-space: pre-wrap; overflow: auto; max-height: 46vh;
}

/* ── responsive ────────────────────────────────────────── */
@media (max-width: 1024px) {
  .ti-inner { padding-left: 16px; padding-right: 16px; }
  .ti-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 860px) {
  .ti-inner { height: auto; min-height: 100%; overflow-y: auto; }
  .ti-body { grid-template-columns: 1fr; }
  .ti-rail { max-height: 236px; }
  .ti-head { flex-direction: column; align-items: stretch; }
  .ti-head-actions { justify-content: flex-start; }
  .ti-main { overflow: visible; }
}
`;

/* ── 图标 ─────────────────────────────────────────────────── */

const TI_ICONS = {
  compass: [['circle', { cx: 12, cy: 12, r: 8.6 }], ['path', { d: 'm15.4 8.6-2 4.8-4.8 2 2-4.8 4.8-2Z' }]],
  refresh: [['path', { d: 'M20 11a8 8 0 1 0-2.3 6.2' }], ['path', { d: 'M20 4v7h-7' }]],
  plus: [['path', { d: 'M12 5v14M5 12h14' }]],
  search: [['circle', { cx: 11, cy: 11, r: 6.4 }], ['path', { d: 'm16 16 4.2 4.2' }]],
  trash: [['path', { d: 'M4 7h16M9.5 7V4.8h5V7M6.5 7l.8 12.2A1.8 1.8 0 0 0 9.1 21h5.8a1.8 1.8 0 0 0 1.8-1.8L17.5 7' }], ['path', { d: 'M10 11v6M14 11v6' }]],
  edit: [['path', { d: 'M4 20h4.5L20 8.5 15.5 4 4 15.5V20Z' }], ['path', { d: 'm13.5 6 4.5 4.5' }]],
  copy: [['rect', { x: 8.5, y: 8.5, width: 11.5, height: 11.5, rx: 2.2 }], ['path', { d: 'M15.5 8.5V5.7A2.2 2.2 0 0 0 13.3 3.5H5.7A2.2 2.2 0 0 0 3.5 5.7v7.6a2.2 2.2 0 0 0 2.2 2.2h2.8' }]],
  download: [['path', { d: 'M12 4v10' }], ['path', { d: 'm8 10 4 4 4-4' }], ['path', { d: 'M5 19h14' }]],
  check: [['path', { d: 'm4.5 12.5 5 5 10-11' }]],
  x: [['path', { d: 'M6 6l12 12M18 6 6 18' }]],
  clock: [['circle', { cx: 12, cy: 12, r: 8.5 }], ['path', { d: 'M12 7v5.2l3.4 2' }]],
  alert: [['path', { d: 'M12 3.5 21 20H3L12 3.5Z' }], ['path', { d: 'M12 9v5' }], ['circle', { cx: 12, cy: 17, r: .9, fill: 'currentColor', stroke: 'none' }]],
  spark: [['path', { d: 'm12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z' }]],
  book: [['path', { d: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z' }], ['path', { d: 'M4 18.5A2.5 2.5 0 0 1 6.5 16H20' }]],
  flame: [['path', { d: 'M12 21c3.6 0 6.2-2.3 6.2-5.7 0-2.5-1.4-4.2-3-5.8-1.3-1.3-2.6-2.6-2.9-4.5-1.9 1.3-3.2 3.1-3.2 4.6 0 .9.4 1.7.9 2.2-1 .2-2-.7-2.2-1.9-.5.9-.8 2-.8 3.1C7 18.2 9.2 21 12 21Z' }]],
  layers: [['path', { d: 'm12 3 8.5 4.6L12 12.2 3.5 7.6 12 3Z' }], ['path', { d: 'm3.5 12 8.5 4.6 8.5-4.6' }], ['path', { d: 'm3.5 16.4 8.5 4.6 8.5-4.6' }]],
  chart: [['path', { d: 'M4 20V10M10 20V4M16 20v-7M22 20H2' }]],
  blueprint: [['rect', { x: 3.2, y: 4.4, width: 17.6, height: 15.2, rx: 2.6 }], ['path', { d: 'M3.2 9.6h17.6M9 4.4v15.2M15 9.6v10' }]],
  chevronDown: [['path', { d: 'm6 9 6 6 6-6' }]],
  chevronRight: [['path', { d: 'm9 6 6 6-6 6' }]],
  chevronLeft: [['path', { d: 'm15 6-6 6 6 6' }]],
  external: [['path', { d: 'M14 4h6v6' }], ['path', { d: 'M20 4 11 13' }], ['path', { d: 'M18 14v4.2A1.8 1.8 0 0 1 16.2 20H5.8A1.8 1.8 0 0 1 4 18.2V7.8A1.8 1.8 0 0 1 5.8 6H10' }]],
  globe: [['circle', { cx: 12, cy: 12, r: 8.6 }], ['path', { d: 'M3.6 12h16.8M12 3.4c2.4 2.4 3.6 5.4 3.6 8.6s-1.2 6.2-3.6 8.6c-2.4-2.4-3.6-5.4-3.6-8.6S9.6 5.8 12 3.4Z' }]],
  cpu: [['rect', { x: 6, y: 6, width: 12, height: 12, rx: 2.4 }], ['path', { d: 'M10 3v3M14 3v3M10 18v3M14 18v3M3 10h3M3 14h3M18 10h3M18 14h3' }]],
  history: [['path', { d: 'M4 12a8 8 0 1 0 2.4-5.7' }], ['path', { d: 'M4 4v4.5h4.5' }], ['path', { d: 'M12 7.6v4.8l3.2 1.9' }]],
  stop: [['rect', { x: 6.5, y: 6.5, width: 11, height: 11, rx: 2.4 }]],
  file: [['path', { d: 'M13.5 3H6.8A1.8 1.8 0 0 0 5 4.8v14.4A1.8 1.8 0 0 0 6.8 21h10.4a1.8 1.8 0 0 0 1.8-1.8V8.2L13.5 3Z' }], ['path', { d: 'M13.5 3v5.2H19' }]],
  info: [['circle', { cx: 12, cy: 12, r: 8.6 }], ['path', { d: 'M12 10.5V17' }], ['circle', { cx: 12, cy: 7.6, r: .9, fill: 'currentColor', stroke: 'none' }]],
  send: [['path', { d: 'M20 4 3.6 10.8l6.4 2.4 2.4 6.4L20 4Z' }], ['path', { d: 'M10 13.2 20 4' }]],
  dot: [['circle', { cx: 12, cy: 12, r: 4, fill: 'currentColor', stroke: 'none' }]],
};

function TiIcon(props) {
  const name = (props && props.name) || 'spark';
  const size = (props && props.size) || 16;
  const parts = TI_ICONS[name] || TI_ICONS.spark;
  return e(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: (props && props.strokeWidth) || 1.7,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
      style: props && props.style ? props.style : undefined,
    },
    parts.map((part, index) => e(part[0], Object.assign({ key: index }, part[1]))),
  );
}

/* ── 原语 ─────────────────────────────────────────────────── */

function TiBtn(props) {
  const variant = props.variant || 'ghost';
  const size = props.size === 'sm' ? 'sm' : '';
  const classes = [
    'ti-btn',
    'ti-btn-' + variant,
    size === 'sm' ? 'ti-btn-sm' : '',
    !props.children ? 'ti-btn-icon' : '',
    props.className || '',
  ]
    .filter(Boolean)
    .join(' ');
  return e(
    'button',
    {
      type: 'button',
      className: classes,
      onClick: props.onClick,
      disabled: props.disabled,
      title: props.title,
      'aria-label': props['aria-label'] || props.title,
    },
    props.icon ? e(TiIcon, { name: props.icon, size: size === 'sm' ? 13 : 15 }) : null,
    props.children ? e('span', null, props.children) : null,
  );
}

function TiIconBtn(props) {
  return e(
    'button',
    {
      type: 'button',
      className: 'ti-iconbtn' + (props.danger ? ' danger' : ''),
      onClick: props.onClick,
      title: props.title,
      'aria-label': props.title,
      disabled: props.disabled,
    },
    e(TiIcon, { name: props.icon || 'info', size: props.size || 15 }),
  );
}

function TiChip(props) {
  const tone = props.tone || '';
  return e(
    'span',
    { className: 'ti-chip' + (tone ? ' ti-chip-' + tone : ''), title: props.title },
    props.dot ? e('span', { className: 'ti-chip-dot' }) : null,
    props.icon ? e(TiIcon, { name: props.icon, size: 12 }) : null,
    props.children,
  );
}

function TiSpinner(props) {
  return e('span', { className: 'ti-spinner' + (props && props.large ? ' lg' : ''), 'aria-hidden': 'true' });
}

function TiEmpty(props) {
  return e(
    'div',
    { className: 'ti-empty' },
    e('div', { className: 'ti-empty-icon' }, e(TiIcon, { name: props.icon || 'spark', size: 20 })),
    e('div', { className: 'ti-empty-title' }, props.title || '这里还是空的'),
    props.body ? e('div', { className: 'ti-empty-body' }, props.body) : null,
    props.action ? e('div', { style: { marginTop: 10 } }, props.action) : null,
  );
}

function TiToast(props) {
  const toast = props.toast;
  if (!toast) return null;
  const tone = toast.tone || 'info';
  return e(
    'div',
    { className: 'ti-toast ' + tone, role: 'status', 'aria-live': 'polite' },
    e(TiIcon, { name: tone === 'success' ? 'check' : tone === 'error' ? 'alert' : 'info', size: 15 }),
    e('span', null, toast.text),
  );
}

function TiModal(props) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(props.onClose);
  onCloseRef.current = props.onClose;

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && onCloseRef.current) {
        event.stopPropagation();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (dialogRef.current && typeof dialogRef.current.focus === 'function') dialogRef.current.focus();
  }, []);

  return e(
    'div',
    {
      className: 'ti-overlay',
      onMouseDown: (event) => {
        if (event.target === event.currentTarget && props.onClose) props.onClose();
      },
    },
    e(
      'div',
      {
        ref: dialogRef,
        className: 'ti-modal',
        style: props.width ? { width: 'min(' + props.width + 'px, 100%)' } : undefined,
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': props.title,
        tabIndex: -1,
      },
      e(
        'div',
        { className: 'ti-modal-head' },
        e(
          'div',
          null,
          e('h3', { className: 'ti-modal-title' }, props.title),
          props.sub ? e('p', { className: 'ti-modal-sub' }, props.sub) : null,
        ),
        props.onClose ? e(TiIconBtn, { icon: 'x', title: '关闭', onClick: props.onClose }) : null,
      ),
      e('div', { className: 'ti-modal-body' }, props.children),
      props.footer ? e('div', { className: 'ti-modal-foot' }, props.footer) : null,
    ),
  );
}

function TiField(props) {
  return e(
    'label',
    { className: 'ti-gen-row' },
    e(
      'span',
      { className: 'ti-label' },
      e('span', null, props.label, props.required ? e('em', null, '*') : null),
      props.tip ? e('span', { className: 'ti-label-tip' }, props.tip) : null,
    ),
    props.children,
    props.hint ? e('span', { className: 'ti-hint' }, props.hint) : null,
  );
}

function TiConfirmDialog(props) {
  const state = props.state;
  if (!state) return null;
  return e(
    TiModal,
    {
      title: state.title || '确认',
      sub: state.body,
      width: 440,
      onClose: props.onClose,
      footer: [
        e(TiBtn, { key: 'cancel', onClick: props.onClose }, '取消'),
        e(
          TiBtn,
          {
            key: 'ok',
            variant: state.danger ? 'danger' : 'primary',
            onClick: () => {
              if (state.action) state.action();
              props.onClose();
            },
          },
          state.ok || '确定',
        ),
      ],
    },
    e('p', { style: { margin: 0, color: 'var(--ti-sub)', fontSize: 13, lineHeight: 1.75 } }, state.detail || '这个操作不可撤销。'),
  );
}

/* ── 安全 markdown-lite 渲染 ─────────────────────────────── */

/** 行内语法：**粗体**、`代码`、[文字](http链接)。全部转 React 元素，无 innerHTML。 */
function tiInlineNodes(text, keyPrefix) {
  const source = String(text || '');
  const nodes = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
  let lastIndex = 0;
  let tokenIndex = 0;
  let match = pattern.exec(source);
  while (match) {
    if (match.index > lastIndex) nodes.push(source.slice(lastIndex, match.index));
    const token = match[0];
    const key = keyPrefix + '-' + tokenIndex;
    if (token.slice(0, 2) === '**' && token.slice(-2) === '**') {
      nodes.push(e('strong', { key }, token.slice(2, -2)));
    } else if (token.charAt(0) === '`' && token.slice(-1) === '`') {
      nodes.push(e('code', { key }, token.slice(1, -1)));
    } else {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      if (link && /^https?:\/\//i.test(link[2])) {
        nodes.push(e('a', { key, href: link[2], target: '_blank', rel: 'noopener noreferrer' }, link[1]));
      } else {
        nodes.push(token);
      }
    }
    lastIndex = match.index + token.length;
    tokenIndex += 1;
    match = pattern.exec(source);
  }
  if (lastIndex < source.length) nodes.push(source.slice(lastIndex));
  return nodes;
}

/** 把 markdown-lite 文本解析为 React 元素数组（## 小标题 / 列表 / 段落）。 */
function tiParseMarkdown(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let paragraph = [];
  let listItems = [];
  let listOrdered = false;
  let blockIndex = 0;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const joined = paragraph.join(' ');
    blocks.push(e('p', { key: 'p' + blockIndex }, tiInlineNodes(joined, 'p' + blockIndex)));
    blockIndex += 1;
    paragraph = [];
  };
  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(
      e(
        listOrdered ? 'ol' : 'ul',
        { key: 'l' + blockIndex },
        listItems.map((item, index) =>
          e('li', { key: 'li' + blockIndex + '-' + index }, tiInlineNodes(item, 'li' + blockIndex + '-' + index)),
        ),
      ),
    );
    blockIndex += 1;
    listItems = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }
    const heading = /^(#{2,4})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push(e('h4', { key: 'h' + blockIndex }, tiInlineNodes(heading[2], 'h' + blockIndex)));
      blockIndex += 1;
      return;
    }
    const unordered = /^[-*]\s+(.+)$/.exec(trimmed);
    if (unordered) {
      flushParagraph();
      if (listItems.length && listOrdered) flushList();
      listOrdered = false;
      listItems.push(unordered[1]);
      return;
    }
    const ordered = /^\d+[.)]\s+(.+)$/.exec(trimmed);
    if (ordered) {
      flushParagraph();
      if (listItems.length && !listOrdered) flushList();
      listOrdered = true;
      listItems.push(ordered[1]);
      return;
    }
    if (listItems.length) flushList();
    paragraph.push(trimmed);
  });
  flushParagraph();
  flushList();
  return blocks;
}

/** 渲染 markdown-lite；空内容给出占位。 */
function TiRichText(props) {
  const blocks = useMemo(() => tiParseMarkdown(props.text), [props.text]);
  if (!blocks.length) {
    return e('p', { className: 'ti-rich-empty' }, props.emptyText || '（暂无内容）');
  }
  return e('div', { className: 'ti-rich' }, blocks);
}
