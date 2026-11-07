/* ─────────────────────────────────────────────────────────────
 * Agent 实验室 · Client entry
 * Registers the standalone sidebar entry (left rail) and its main panel.
 * The slot registration pattern is the same one used by shipped pages:
 *   sidebar.panellist  → the icon + label in the left navigation
 *   main               → the page body, dispatched by the same id
 * ───────────────────────────────────────────────────────────── */

function AgentLabPanelIcon(props) {
  const size = (props && props.size) || 16;
  return e(
    'svg',
    {
      width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round',
      'aria-hidden': 'true',
    },
    e('rect', { x: 3.2, y: 4.4, width: 17.6, height: 15.2, rx: 3 }),
    e('path', { d: 'M7.4 9.4l2.6 2.6-2.6 2.6' }),
    e('path', { d: 'M12.8 14.6h4' }),
  );
}

function apply(ctx) {
  const launchReal = (prompt) => {
    const workspace = ctx.uiWorkspace || ctx.get('uiWorkspace');
    if (!workspace || typeof workspace.startSession !== 'function') return false;
    try {
      workspace.startSession(void 0, { prompt: prompt, whenDraftExists: 'append' });
      return true;
    } catch (error) {
      return false;
    }
  };

  ctx.slots.inject('main', () =>
    ctx.slots.register(
      {
        name: 'main',
        key: 'agent-lab',
        inject: () => ({ onLaunchReal: launchReal }),
      },
      Page,
    ),
  );

  ctx.slots.inject('sidebar.panellist', () =>
    ctx.slots.register(
      {
        name: 'sidebar.panellist',
        id: 'agent-lab',
        order: 6,
        label: () => 'Agent 实验室',
      },
      AgentLabPanelIcon,
    ),
  );
}
