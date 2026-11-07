/* ─────────────────────────────────────────────────────────────
 * Agent 实验室 · UI kit
 * Shared styles, icons and primitives for the page, terminal and inspector.
 * This file is concatenated into the Client factory by build.mjs.
 * ───────────────────────────────────────────────────────────── */

const AL_CSS = `
.al-root {
  --al-bg: var(--dsw-alias-bg-base);
  --al-layer: var(--dsw-alias-bg-layer-1);
  --al-layer2: var(--dsw-alias-bg-layer-2);
  --al-text: var(--dsw-alias-label-primary);
  --al-sub: var(--dsw-alias-label-secondary);
  --al-ter: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
  --al-border: var(--dsw-alias-border-l1);
  --al-border2: var(--dsw-alias-border-l2);
  --al-brand: var(--dsw-alias-brand-primary);
  --al-danger: var(--dsw-alias-state-error-primary);
  --al-good: var(--dsw-alias-state-success-primary);
  --al-warn: var(--dsw-alias-state-warn-primary);
  --al-accent: #5b7cfa;
  --al-accent-soft: color-mix(in srgb, var(--al-accent) 12%, transparent);
  --al-accent-glow: color-mix(in srgb, var(--al-accent) 30%, transparent);
  --al-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 100%;
  overflow: hidden;
  color: var(--al-text);
  background:
    radial-gradient(1200px 520px at 6% -10%, var(--al-accent-soft), transparent 60%),
    radial-gradient(900px 480px at 100% 0%, color-mix(in srgb, var(--al-brand) 6%, transparent), transparent 55%),
    var(--al-bg);
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
.al-root, .al-root * { box-sizing: border-box; }
.al-root :where(button, input, textarea, select) { font: inherit; color: inherit; }
.al-root button { cursor: pointer; }
.al-root ::selection { background: var(--al-accent-glow); }
.al-root ::-webkit-scrollbar { width: 10px; height: 10px; }
.al-root ::-webkit-scrollbar-thumb { background: var(--al-border2); border: 3px solid transparent; border-radius: 999px; background-clip: content-box; }
.al-root ::-webkit-scrollbar-thumb:hover { background: var(--al-ter); background-clip: content-box; }
.al-root ::-webkit-scrollbar-track { background: transparent; }

.al-inner {
  width: min(1480px, 100%);
  margin: 0 auto;
  padding: calc(var(--dsh-frame-top-clearance, 0px) + 22px) 28px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
  min-height: 0;
}

/* ── header ─────────────────────────────────────────────── */
.al-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; flex: none; }
.al-brand { display: flex; align-items: center; gap: 13px; min-width: 0; }
.al-logo {
  width: 46px; height: 46px; flex: none; border-radius: 14px;
  display: grid; place-items: center; color: #fff;
  background: linear-gradient(145deg, var(--al-accent), color-mix(in srgb, var(--al-accent) 34%, #0d1020));
  box-shadow: 0 10px 24px -12px var(--al-accent-glow), inset 0 1px 0 rgba(255, 255, 255, .28);
  position: relative; overflow: hidden;
}
.al-logo::after {
  content: ''; position: absolute; inset: -45% -12% auto auto; width: 74%; height: 92%;
  background: radial-gradient(circle, rgba(255, 255, 255, .42), transparent 66%);
  transform: rotate(18deg);
}
.al-logo svg { position: relative; z-index: 1; }
.al-title-row { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
.al-title { margin: 0; font-size: 21px; line-height: 1.25; font-weight: 680; letter-spacing: -.02em; }
.al-sub { margin: 3px 0 0; color: var(--al-sub); font-size: 12.5px; max-width: 760px; }
.al-head-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; flex: none; }

/* ── buttons ────────────────────────────────────────────── */
.al-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 34px; padding: 0 13px; border-radius: 10px;
  border: 1px solid transparent; background: transparent; color: var(--al-text);
  font-size: 12.5px; font-weight: 560; white-space: nowrap; user-select: none;
  transition: transform .15s ease, background .15s ease, border-color .15s ease, box-shadow .15s ease, opacity .15s ease, color .15s ease;
}
.al-btn:hover { transform: translateY(-1px); }
.al-btn:active { transform: translateY(0); }
.al-btn:disabled { opacity: .42; cursor: not-allowed; transform: none; }
.al-btn-sm { height: 28px; padding: 0 9px; font-size: 12px; border-radius: 8px; gap: 4px; }
.al-btn-primary {
  color: #fff !important;
  background: linear-gradient(135deg, var(--al-accent), color-mix(in srgb, var(--al-accent) 78%, #101322));
  box-shadow: 0 8px 18px -10px var(--al-accent-glow), inset 0 1px 0 rgba(255, 255, 255, .22);
}
.al-btn-primary span, .al-btn-primary svg { color: #fff !important; }
.al-btn-primary:hover { box-shadow: 0 12px 22px -10px var(--al-accent-glow), inset 0 1px 0 rgba(255, 255, 255, .28); }
.al-btn-soft { color: var(--al-accent); background: var(--al-accent-soft); }
.al-btn-soft:hover { background: color-mix(in srgb, var(--al-accent) 18%, transparent); }
.al-btn-ghost { color: var(--al-sub); border-color: var(--al-border); background: var(--al-layer); }
.al-btn-ghost:hover { color: var(--al-text); border-color: var(--al-border2); background: var(--al-layer2); }
.al-btn-danger { color: var(--al-danger); border-color: color-mix(in srgb, var(--al-danger) 26%, transparent); background: transparent; }
.al-btn-danger:hover { background: color-mix(in srgb, var(--al-danger) 9%, transparent); }
.al-iconbtn {
  width: 28px; height: 28px; display: inline-grid; place-items: center; flex: none;
  border: 1px solid transparent; background: transparent; border-radius: 8px; color: var(--al-ter);
  transition: background .15s ease, color .15s ease, border-color .15s ease, opacity .15s ease;
}
.al-iconbtn:hover { background: var(--al-layer2); color: var(--al-text); border-color: var(--al-border); }
.al-iconbtn.danger:hover { color: var(--al-danger); background: color-mix(in srgb, var(--al-danger) 10%, transparent); border-color: color-mix(in srgb, var(--al-danger) 22%, transparent); }
.al-iconbtn:disabled { opacity: .35; cursor: not-allowed; }

/* ── chips ──────────────────────────────────────────────── */
.al-chip {
  display: inline-flex; align-items: center; gap: 4px;
  height: 23px; padding: 0 8px; border-radius: 999px;
  border: 1px solid var(--al-border); background: color-mix(in srgb, var(--al-layer) 70%, transparent);
  color: var(--al-sub); font-size: 11.5px; font-weight: 520; white-space: nowrap;
}
.al-chip svg { flex: none; }
.al-chip-brand { color: var(--al-accent); border-color: color-mix(in srgb, var(--al-accent) 24%, transparent); background: var(--al-accent-soft); }
.al-chip-good { color: var(--al-good); border-color: color-mix(in srgb, var(--al-good) 26%, transparent); background: color-mix(in srgb, var(--al-good) 10%, transparent); }
.al-chip-warn { color: var(--al-warn); border-color: color-mix(in srgb, var(--al-warn) 26%, transparent); background: color-mix(in srgb, var(--al-warn) 10%, transparent); }
.al-chip-danger { color: var(--al-danger); border-color: color-mix(in srgb, var(--al-danger) 26%, transparent); background: color-mix(in srgb, var(--al-danger) 9%, transparent); }
.al-chip-violet { color: #a78bfa; border-color: rgba(167, 139, 250, .3); background: rgba(167, 139, 250, .1); }

/* ── model mode switch (page header) ─────────────────────── */
.al-model-switch {
  display: inline-flex; align-items: center; gap: 2px; padding: 3px;
  border: 1px solid var(--al-border); border-radius: 10px;
  background: color-mix(in srgb, var(--al-layer) 82%, transparent);
  box-shadow: 0 1px 0 rgba(255, 255, 255, .04) inset;
}
.al-model-switch .al-ms-label {
  padding: 0 5px; font-size: 10px; color: var(--al-ter); white-space: nowrap; letter-spacing: .02em;
}
.al-model-switch button {
  height: 26px; padding: 0 9px; border: 0; border-radius: 7px; background: transparent;
  color: var(--al-sub); font-size: 11.5px; font-weight: 560; white-space: nowrap;
  transition: background .15s ease, color .15s ease;
}
.al-model-switch button:hover { background: var(--al-layer2); color: var(--al-text); }
.al-model-switch button.on { background: var(--al-accent-soft); color: var(--al-accent); }
.al-model-switch button.real.on { background: rgba(124, 58, 237, .13); color: #7c3aed; }
.al-model-switch button:disabled { opacity: .45; cursor: not-allowed; }
@media (max-width: 720px) {
  .al-model-switch .al-ms-label { display: none; }
}

/* ── tabs ───────────────────────────────────────────────── */
.al-tabs {
  display: flex; align-items: center; gap: 4px; flex: none;
  padding: 4px; border: 1px solid var(--al-border); border-radius: 12px;
  background: color-mix(in srgb, var(--al-layer) 72%, transparent);
  backdrop-filter: blur(10px); width: fit-content; max-width: 100%;
  overflow-x: auto; scrollbar-width: none;
}
.al-tabs::-webkit-scrollbar { display: none; }
.al-tab {
  display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px;
  border: 0; border-radius: 8px; background: transparent; color: var(--al-sub);
  font-size: 12.5px; font-weight: 560; white-space: nowrap;
  transition: background .15s ease, color .15s ease, box-shadow .15s ease;
}
.al-tab:hover { color: var(--al-text); background: color-mix(in srgb, var(--al-layer2) 70%, transparent); }
.al-tab.on { color: var(--al-text); background: var(--al-layer); box-shadow: 0 1px 3px rgba(15, 23, 42, .1), 0 0 0 1px var(--al-border); }
.al-tab.on svg { color: var(--al-accent); }
.al-tab-badge {
  min-width: 16px; height: 16px; padding: 0 4px; border-radius: 999px;
  display: inline-grid; place-items: center; font-size: 10px; font-weight: 650;
  background: var(--al-layer2); color: var(--al-ter);
}
.al-tab.on .al-tab-badge { background: var(--al-accent-soft); color: var(--al-accent); }

/* ── tab panes ──────────────────────────────────────────── */
.al-tabpane { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.al-tabpane.scroll { overflow-y: auto; overflow-x: hidden; display: block; padding-bottom: 10px; }

/* ── experience layout ──────────────────────────────────── */
.al-lab {
  flex: 1; min-height: 0; display: grid;
  grid-template-columns: minmax(206px, 232px) minmax(0, 1fr) minmax(318px, 352px);
  grid-template-areas: "sessions tui inspector";
  gap: 14px;
}

.al-lab.collapsed { grid-template-columns: 40px minmax(0, 1fr) minmax(318px, 352px); }
.al-sessions-rail {
  grid-area: sessions; min-height: 0; width: 100%;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 10px 0; border: 1px solid var(--al-border); border-radius: 15px;
  background: color-mix(in srgb, var(--al-layer) 86%, transparent);
  color: var(--al-ter); cursor: pointer;
  transition: background .15s ease, color .15s ease, border-color .15s ease;
}
.al-sessions-rail:hover { color: var(--al-accent); border-color: color-mix(in srgb, var(--al-accent) 28%, transparent); background: var(--al-accent-soft); }
.al-sessions-rail .al-rail-text {
  writing-mode: vertical-rl; letter-spacing: .22em; font-size: 10.5px;
  font-weight: 560; color: inherit; margin-top: 2px;
}
.al-sessions-rail .al-rail-icon { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 8px; background: var(--al-layer2); color: var(--al-sub); }
.al-sessions-rail:hover .al-rail-icon { background: var(--al-layer); color: var(--al-accent); }
@media (max-width: 1180px) {
  .al-lab.collapsed { grid-template-columns: minmax(0, 1fr) !important; grid-template-areas: "sessions" "tui" "inspector" !important; }
  .al-sessions-rail { flex-direction: row; justify-content: center; height: 38px; padding: 0 12px; }
  .al-sessions-rail .al-rail-text { writing-mode: horizontal-tb; letter-spacing: .08em; margin-top: 0; }
}

/* ── panels ─────────────────────────────────────────────── */
.al-panel {
  display: flex; flex-direction: column; min-height: 0; min-width: 0;
  border: 1px solid var(--al-border); border-radius: 15px;
  background: color-mix(in srgb, var(--al-layer) 86%, transparent);
  box-shadow: 0 12px 34px -28px rgba(15, 23, 42, .32);
  overflow: hidden;
}
.al-panel-head {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  min-height: 42px; padding: 7px 10px 7px 13px; border-bottom: 1px solid var(--al-border);
  flex: none; background: color-mix(in srgb, var(--al-layer) 55%, transparent);
}
.al-panel-title { display: flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 640; letter-spacing: -.01em; min-width: 0; }
.al-panel-title svg { color: var(--al-ter); flex: none; }
.al-panel-sub { font-size: 11px; color: var(--al-ter); font-weight: 450; }
.al-panel-body { flex: 1; min-height: 0; overflow-y: auto; }
.al-panel-foot {
  flex: none; display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 8px 12px; border-top: 1px solid var(--al-border);
  font-size: 11px; color: var(--al-ter); background: color-mix(in srgb, var(--al-layer) 55%, transparent);
}

/* ── sessions ───────────────────────────────────────────── */
.al-sessions-panel { grid-area: sessions; }
.al-session-list { padding: 4px 6px 6px; }
.al-session {
  position: relative; width: 100%; display: flex; flex-direction: column; align-items: stretch; gap: 3px;
  margin: 3px 0; padding: 8px 9px; border-radius: 10px;
  border: 1px solid transparent; background: transparent; text-align: left;
  transition: background .15s ease, border-color .15s ease;
}
.al-session:hover { background: var(--al-layer2); }
.al-session.on { background: var(--al-accent-soft); border-color: color-mix(in srgb, var(--al-accent) 30%, transparent); }
.al-session.on::before {
  content: ''; position: absolute; left: -6px; top: 9px; bottom: 9px; width: 3px;
  border-radius: 999px; background: var(--al-accent);
}
.al-session-top { display: flex; align-items: flex-start; gap: 6px; }
.al-session-title {
  flex: 1; min-width: 0; font-size: 12.5px; font-weight: 560; line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word;
}
.al-session.on .al-session-title { color: var(--al-text); }
.al-session-meta { display: flex; align-items: center; gap: 7px; font-size: 10.5px; color: var(--al-ter); }
.al-session-del { opacity: 0; transition: opacity .15s ease; }
.al-session:hover .al-session-del, .al-session:focus-within .al-session-del { opacity: 1; }
.al-session-del.confirm { opacity: 1; color: var(--al-danger); }

/* ── common list rows / stats ───────────────────────────── */
.al-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; padding: 26px 20px; text-align: center; color: var(--al-sub);
}
.al-empty-icon {
  width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center;
  background: var(--al-accent-soft); color: var(--al-accent); margin-bottom: 2px;
}
.al-empty-title { font-size: 13px; font-weight: 620; color: var(--al-text); }
.al-empty-body { font-size: 11.5px; line-height: 1.65; max-width: 250px; color: var(--al-sub); }
.al-stat-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; padding: 8px 10px; }
.al-stat {
  display: flex; flex-direction: column; gap: 1px; padding: 6px 8px; border-radius: 8px;
  background: color-mix(in srgb, var(--al-layer2) 66%, transparent);
}
.al-stat b { font-size: 14px; font-weight: 660; font-variant-numeric: tabular-nums; line-height: 1.2; }
.al-stat span { font-size: 10px; color: var(--al-ter); }

/* ── json / code ────────────────────────────────────────── */
.al-json {
  margin: 0; padding: 9px 10px; border-radius: 9px; overflow: auto;
  background: color-mix(in srgb, var(--al-layer2) 80%, transparent);
  border: 1px solid var(--al-border);
  font-family: var(--al-mono); font-size: 11px; line-height: 1.55;
  color: var(--al-text); white-space: pre; tab-size: 2; max-height: 260px;
}
.al-json-key { color: #8b5cf6; }
.al-json-str { color: #059669; }
.al-json-num { color: #2563eb; }
.al-json-bool { color: #d97706; }
.al-json-null { color: var(--al-ter); }
.al-code-inline {
  font-family: var(--al-mono); font-size: 12px; padding: 1px 5px; border-radius: 5px;
  background: var(--al-layer2); border: 1px solid var(--al-border); white-space: nowrap;
}
.al-kbd {
  display: inline-flex; align-items: center; height: 19px; padding: 0 5px; border-radius: 5px;
  border: 1px solid var(--al-border2); background: var(--al-layer); box-shadow: 0 1px 0 var(--al-border2);
  font-family: var(--al-mono); font-size: 10px; color: var(--al-sub); white-space: nowrap;
}

/* ── token bar ──────────────────────────────────────────── */
.al-tokenbar { display: flex; width: 100%; border-radius: 999px; overflow: hidden; background: var(--al-layer2); }
.al-tokenbar > span { display: block; height: 100%; transition: width .3s ease; }
.al-tokenbar-legend { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 7px; }
.al-legend-item { display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; color: var(--al-ter); }
.al-legend-dot { width: 7px; height: 7px; border-radius: 2px; flex: none; }

/* ── toast ──────────────────────────────────────────────── */
.al-toast {
  position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%);
  z-index: 40; display: flex; align-items: center; gap: 7px;
  padding: 9px 14px; border-radius: 10px;
  background: var(--al-text); color: var(--al-bg);
  font-size: 12px; font-weight: 540;
  box-shadow: 0 14px 34px -12px rgba(15, 23, 42, .45);
  animation: al-toast-in .18s ease;
}
.al-toast svg { color: inherit; }
@keyframes al-toast-in { from { opacity: 0; transform: translate(-50%, 6px); } to { opacity: 1; transform: translate(-50%, 0); } }

/* ── responsive ─────────────────────────────────────────── */
@media (max-width: 1240px) {
  .al-inner { padding-left: 20px; padding-right: 20px; }
}
@media (max-width: 1180px) {
  .al-root { overflow-y: auto; }
  .al-inner { height: auto; min-height: 100%; }
  .al-lab {
    height: auto !important;
    grid-template-columns: minmax(0, 1fr) !important;
    grid-template-areas: "sessions" "tui" "inspector";
  }
  .al-session-list { display: flex; gap: 6px; overflow-x: auto; padding: 8px 10px 10px; }
  .al-session { min-width: 190px; max-width: 260px; margin: 0; flex: none; }
  .al-session.on::before { left: 9px; right: 9px; top: auto; bottom: 0; width: auto; height: 2px; }
  .al-inspector-panel { height: 560px; }
  .al-tabpane { overflow: visible; flex: none; }
  .al-tabpane.scroll { overflow: visible; }
}
@media (max-width: 720px) {
  .al-inner { padding: calc(var(--dsh-frame-top-clearance, 0px) + 14px) 12px 16px; gap: 10px; }
  .al-head { flex-direction: column; gap: 10px; }
  .al-head-actions { width: 100%; justify-content: flex-start; }
  .al-title { font-size: 18px; }
  .al-logo { width: 40px; height: 40px; border-radius: 12px; }
  .al-sub { font-size: 11.5px; }
}
`;

const AL_ICONS = {
  terminal: ['M4 5.5h16v13H4z', 'M7.5 9.5l2.5 2.5-2.5 2.5', 'M13 14.5h3.5'],
  spark: ['M12 3.2l1.7 5 5 1.8-5 1.8-1.7 5-1.7-5-5-1.8 5-1.8z'],
  plus: ['M12 5v14', 'M5 12h14'],
  trash: ['M4.5 6.5h15', 'M9 6.5V4.5h6v2', 'M6.5 6.5l1 13h9l1-13', 'M10 10v6', 'M14 10v6'],
  send: ['M4.5 11.5l15-6.5-6.5 15-2-6-6.5-2.5z'],
  copy: ['M9 9h10v10H9z', 'M5 15V5h10'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  x: ['M6 6l12 12', 'M18 6L6 18'],
  refresh: ['M19.5 12a7.5 7.5 0 1 1-2.2-5.3', 'M19.5 4.5V9H15'],
  book: ['M5 4.5h9a3 3 0 0 1 3 3V19.5H8a3 3 0 0 1-3-3z', 'M5 16.5h12'],
  code: ['M8.5 8.5L5 12l3.5 3.5', 'M15.5 8.5L19 12l-3.5 3.5', 'M13.5 5.5l-3 13'],
  cpu: ['M7 7h10v10H7z', 'M9.5 3.5v3', 'M14.5 3.5v3', 'M9.5 17.5v3', 'M14.5 17.5v3', 'M3.5 9.5h3', 'M3.5 14.5h3', 'M17.5 9.5h3', 'M17.5 14.5h3'],
  brain: ['M9.5 4.5a3 3 0 0 0-3 3 3 3 0 0 0-1.5 5.6A3 3 0 0 0 8 19.5h1.5z', 'M14.5 4.5a3 3 0 0 1 3 3 3 3 0 0 1 1.5 5.6A3 3 0 0 1 16 19.5h-1.5z', 'M9.5 4.5v15', 'M14.5 4.5v15'],
  layers: ['M12 3.5l8.5 4.5-8.5 4.5L3.5 8z', 'M3.5 12.5L12 17l8.5-4.5', 'M3.5 16.5L12 21l8.5-4.5'],
  compress: ['M5 12h14', 'M9 8l-4 4 4 4', 'M15 8l4 4-4 4'],
  memory: ['M6.5 5h11v14h-11z', 'M9.5 8.5h5', 'M9.5 12h5', 'M9.5 15.5h3', 'M6.5 8H4', 'M6.5 16H4', 'M20 8h-2.5', 'M20 16h-2.5'],
  search: ['M10.8 17.6a6.8 6.8 0 1 0 0-13.6 6.8 6.8 0 0 0 0 13.6z', 'M15.8 15.8L20 20'],
  clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5.2l3.2 2'],
  tools: ['M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.4 2.4-2.1-2.1z'],
  arrowRight: ['M5 12h13', 'M13 7l5 5-5 5'],
  play: ['M8 5.5l10 6.5-10 6.5z'],
  pause: ['M9 5.5v13', 'M15 5.5v13'],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 11v5.5', 'M12 7.6v.1'],
  alert: ['M12 3.8l9 15.4H3z', 'M12 9.5v4', 'M12 16.6v.1'],
  dots: ['M6 12h.1', 'M12 12h.1', 'M18 12h.1'],
  external: ['M14 5h5v5', 'M19 5l-7.5 7.5', 'M18.5 14v5.5h-13v-13H11'],
  bolt: ['M13 3.5L5.5 13.5H11l-1 7L18.5 10H13z'],
  key: ['M14 5.5a4.5 4.5 0 1 1-4.4 5.5L4 16.6V20h3.4l1.5-1.5H11v-2h2l1.6-1.6A4.5 4.5 0 0 1 14 5.5z', 'M16.4 8.6v.1'],
  route: ['M5 6.5h4.5a4 4 0 0 1 4 4v3a4 4 0 0 0 4 4H20', 'M17 14.5l3 3-3 3', 'M7.5 3.5l-3 3 3 3'],
  smile: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M8.5 10h.1', 'M15.5 10h.1', 'M8.5 14.5a4.2 4.2 0 0 0 7 0'],
  chevron: ['M8.5 10l3.5 3.5 3.5-3.5'],
  chevronRight: ['M10 8.5l3.5 3.5-3.5 3.5'],
  chevronLeft: ['M14 8.5L10.5 12l3.5 3.5'],
  stop: ['M7 7h10v10H7z'],
  wand: ['M4 20l10-10', 'M14.5 4.5l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z', 'M19 13.5l.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7z'],
};

function Icon(props) {
  const name = (props && props.name) || 'terminal';
  const size = (props && props.size) || 16;
  const strokeWidth = (props && props.strokeWidth) || 1.7;
  const paths = AL_ICONS[name] || AL_ICONS.terminal;
  return e(
    'svg',
    {
      width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      stroke: 'currentColor', strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round',
      'aria-hidden': 'true', focusable: 'false',
    },
    paths.map((d, index) => e('path', { key: index, d })),
  );
}

function Btn(props) {
  const variant = props.variant || 'ghost';
  const size = props.size === 'sm' ? ' al-btn-sm' : '';
  return e(
    'button',
    {
      type: 'button',
      className: 'al-btn al-btn-' + variant + size + (props.className ? ' ' + props.className : ''),
      onClick: props.onClick,
      disabled: props.disabled,
      title: props.title,
      'aria-label': props.title || undefined,
    },
    props.icon ? e(Icon, { name: props.icon, size: size ? 13 : 14 }) : null,
    props.children,
  );
}

function IconBtn(props) {
  return e(
    'button',
    {
      type: 'button',
      className: 'al-iconbtn' + (props.danger ? ' danger' : '') + (props.className ? ' ' + props.className : ''),
      onClick: props.onClick,
      disabled: props.disabled,
      title: props.title,
      'aria-label': props.title || '操作',
    },
    e(Icon, { name: props.icon, size: props.size || 15 }),
  );
}

function Chip(props) {
  const tone = props.tone || 'neutral';
  const toneClass = tone === 'neutral' ? '' : ' al-chip-' + tone;
  return e(
    'span',
    { className: 'al-chip' + toneClass + (props.className ? ' ' + props.className : ''), title: props.title },
    props.icon ? e(Icon, { name: props.icon, size: 12 }) : null,
    props.children,
  );
}

function Empty(props) {
  return e(
    'div',
    { className: 'al-empty' },
    e('div', { className: 'al-empty-icon' }, e(Icon, { name: props.icon || 'spark', size: 19 })),
    props.title ? e('div', { className: 'al-empty-title' }, props.title) : null,
    props.body ? e('div', { className: 'al-empty-body' }, props.body) : null,
    props.action || null,
  );
}

function prettyJson(value) {
  try {
    const text = JSON.stringify(value, null, 2);
    return text === undefined ? String(value) : text;
  } catch (error) {
    return String(value);
  }
}

const AL_JSON_TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

function highlightJson(text) {
  const nodes = [];
  let last = 0;
  let index = 0;
  let match;
  AL_JSON_TOKEN.lastIndex = 0;
  while ((match = AL_JSON_TOKEN.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const key = match[1];
    if (key && match[2]) {
      nodes.push(e('span', { key: index++, className: 'al-json-key' }, key));
      nodes.push(match[2]);
    } else if (key) {
      nodes.push(e('span', { key: index++, className: 'al-json-str' }, key));
    } else if (match[3]) {
      const cls = match[3] === 'null' ? 'al-json-null' : 'al-json-bool';
      nodes.push(e('span', { key: index++, className: cls }, match[3]));
    } else if (match[4]) {
      nodes.push(e('span', { key: index++, className: 'al-json-num' }, match[4]));
    }
    last = AL_JSON_TOKEN.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function JsonView(props) {
  const text = useMemo(() => prettyJson(props.value), [props.value]);
  return e('pre', { className: 'al-json', style: props.style, title: props.title || 'JSON' }, highlightJson(text));
}

function copyText(text) {
  const value = String(text == null ? '' : text);
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(value).catch(() => legacyCopy(value));
  }
  return legacyCopy(value);
}

function legacyCopy(value) {
  return new Promise((resolve, reject) => {
    try {
      const area = document.createElement('textarea');
      area.value = value;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      area.style.pointerEvents = 'none';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(area);
      ok ? resolve(true) : reject(new Error('copy failed'));
    } catch (error) {
      reject(error);
    }
  });
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const copy = useCallback((text) => {
    copyText(text).then(
      () => {
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1600);
      },
      () => setCopied(false),
    );
  }, []);
  return { copied, copy };
}

const AL_SEGMENT_COLORS = {
  system: '#8b5cf6',
  summary: '#f59e0b',
  memory: '#14b8a6',
  recent: '#3b82f6',
  input: '#22c55e',
};

function TokenBar(props) {
  const segments = props.segments || [];
  const limit = props.limit || 0;
  const height = props.height || 8;
  return e(
    'div',
    null,
    e(
      'div',
      { className: 'al-tokenbar', style: { height } },
      segments.map((segment) =>
        e('span', {
          key: segment.id,
          style: {
            width: (limit > 0 ? Math.min(100, (segment.tokens / limit) * 100) : 0) + '%',
            background: AL_SEGMENT_COLORS[segment.id] || 'var(--al-ter)',
          },
          title: segment.label + ' · ' + segment.tokens + ' tok',
        }),
      ),
    ),
    props.showLegend === false
      ? null
      : e(
          'div',
          { className: 'al-tokenbar-legend' },
          segments.map((segment) =>
            e(
              'span',
              { key: segment.id, className: 'al-legend-item' },
              e('span', { className: 'al-legend-dot', style: { background: AL_SEGMENT_COLORS[segment.id] || 'var(--al-ter)' } }),
              segment.label,
              e('span', { style: { fontVariantNumeric: 'tabular-nums' } }, String(segment.tokens)),
            ),
          ),
        ),
  );
}

function Stat(props) {
  return e('div', { className: 'al-stat' }, e('b', null, props.value), e('span', null, props.label));
}
