/* ─────────────────────────────────────────────────────────────
 * 技术洞察 · 可视化
 * 模型只产出结构化数据（层/条目、分数、坐标、时间），这里用内联 SVG 渲染。
 * 不执行模型生成的任意 HTML/SVG，避免注入；颜色全部走宿主主题 token。
 * ───────────────────────────────────────────────────────────── */

/** 四个固定分节各自对应的图。 */
const TI_SECTION_VISUALS = {
  solution: 'architecture',
  difficulties: 'difficulty',
  scenarios: 'matrix',
  industry: 'timeline',
};

/** 通用图容器：标题 + 画布。 */
function TiFigure(props) {
  const visual = props.visual;
  if (!visual || typeof visual !== 'object') return null;
  let svg = null;
  let hint = '';
  if (props.kind === 'architecture') {
    svg = e(TiArchitectureSvg, { visual });
    hint = '分层自下而上：下层为上层提供能力';
  } else if (props.kind === 'difficulty') {
    svg = e(TiDifficultySvg, { visual });
    hint = '条越长表示工程落地越难（0–100）';
  } else if (props.kind === 'matrix') {
    svg = e(TiMatrixSvg, { visual });
    hint = '右上角通常是优先落地场景';
  } else if (props.kind === 'timeline') {
    svg = e(TiTimelineSvg, { visual });
    hint = '按公开资料中的时间点整理';
  }
  if (!svg) return null;
  return e(
    'figure',
    { className: 'ti-figure' },
    e(
      'div',
      { className: 'ti-figure-head' },
      e('span', { className: 'ti-figure-badge' }, e(TiIcon, { name: 'chart', size: 13 })),
      e('figcaption', { className: 'ti-figure-title' }, visual.title || '技术图谱'),
      hint ? e('span', { className: 'ti-figure-hint' }, hint) : null,
    ),
    e('div', { className: 'ti-figure-canvas' }, svg),
  );
}

/** 分层架构图：纵向分层 + 层间箭头。 */
function TiArchitectureSvg(props) {
  const layers = Array.isArray(props.visual.layers) ? props.visual.layers : [];
  if (layers.length === 0) return null;
  const width = 760;
  const rowH = 62;
  const gap = 24;
  const top = 14;
  const height = top * 2 + layers.length * rowH + (layers.length - 1) * gap;
  const parts = [];
  layers.forEach((layer, index) => {
    const y = top + index * (rowH + gap);
    const items = (layer.items || []).join('   ·   ');
    parts.push(
      e(
        'g',
        { key: 'layer-' + index },
        e('rect', {
          x: 12,
          y: y,
          width: width - 24,
          height: rowH,
          rx: 12,
          fill: 'var(--ti-figure-fill)',
          stroke: 'var(--ti-figure-stroke)',
          strokeWidth: 1.1,
        }),
        e('rect', { x: 12, y: y, width: 5, height: rowH, rx: 2.5, fill: 'var(--ti-accent)' }),
        e(
          'text',
          { x: 32, y: y + rowH / 2 + 5, fill: 'var(--ti-text)', fontSize: 13.5, fontWeight: 650 },
          layer.name,
        ),
        items
          ? e(
              'text',
              { x: 168, y: y + rowH / 2 + 4.5, fill: 'var(--ti-sub)', fontSize: 12 },
              items,
            )
          : null,
      ),
    );
    if (index < layers.length - 1) {
      const start = y + rowH + 3;
      parts.push(
        e('path', {
          key: 'arrow-' + index,
          d: `M ${width / 2} ${start} L ${width / 2} ${start + gap - 6}`,
          stroke: 'var(--ti-figure-stroke)',
          strokeWidth: 1.6,
          markerEnd: 'url(#ti-arrow-head)',
        }),
      );
    }
  });
  return e(
    'svg',
    {
      className: 'ti-svg',
      viewBox: `0 0 ${width} ${height}`,
      role: 'img',
      'aria-label': props.visual.title || '技术分层架构图',
    },
    e(
      'defs',
      null,
      e(
        'marker',
        {
          id: 'ti-arrow-head',
          viewBox: '0 0 10 10',
          refX: 8,
          refY: 5,
          markerWidth: 6,
          markerHeight: 6,
          orient: 'auto-start-reverse',
        },
        e('path', { d: 'M 0 0 L 10 5 L 0 10 Z', fill: 'var(--ti-figure-stroke)' }),
      ),
    ),
    parts,
  );
}

/** 关键难点：横向强度条。 */
function TiDifficultySvg(props) {
  const items = Array.isArray(props.visual.items) ? props.visual.items : [];
  if (items.length === 0) return null;
  const width = 760;
  const rowH = 56;
  const top = 12;
  const height = top * 2 + items.length * rowH;
  const barX = 196;
  const barW = 420;
  const parts = [];
  items.forEach((item, index) => {
    const y = top + index * rowH;
    const score = Math.min(100, Math.max(0, Number(item.score) || 0));
    const barLen = Math.max(4, (score / 100) * barW);
    parts.push(
      e(
        'g',
        { key: 'diff-' + index },
        e('text', { x: 12, y: y + 20, fill: 'var(--ti-text)', fontSize: 12.5, fontWeight: 600 }, item.name),
        e('rect', { x: barX, y: y + 6, width: barW, height: 12, rx: 6, fill: 'var(--ti-layer2)' }),
        e('rect', { x: barX, y: y + 6, width: barLen, height: 12, rx: 6, fill: 'var(--ti-accent)' }),
        e(
          'text',
          { x: barX + barW + 10, y: y + 17, fill: 'var(--ti-sub)', fontSize: 11.5, fontWeight: 600 },
          String(score),
        ),
        e(
          'text',
          { x: barX, y: y + 38, fill: 'var(--ti-sub)', fontSize: 11 },
          item.reason ? tiTruncate(item.reason, 52) : '',
        ),
      ),
    );
  });
  return e(
    'svg',
    {
      className: 'ti-svg',
      viewBox: `0 0 ${width} ${height}`,
      role: 'img',
      'aria-label': props.visual.title || '关键难点强度图',
    },
    parts,
  );
}

/** 场景价值矩阵：x=落地成熟度，y=业务价值，四象限散点。 */
function TiMatrixSvg(props) {
  const items = Array.isArray(props.visual.items) ? props.visual.items : [];
  if (items.length === 0) return null;
  const width = 720;
  const height = 452;
  const left = 86;
  const right = width - 36;
  const top = 26;
  const bottom = height - 66;
  const plotW = right - left;
  const plotH = bottom - top;
  const cx = (x) => left + (Math.min(100, Math.max(0, Number(x) || 0)) / 100) * plotW;
  const cy = (y) => bottom - (Math.min(100, Math.max(0, Number(y) || 0)) / 100) * plotH;
  const midX = left + plotW / 2;
  const midY = top + plotH / 2;
  const parts = [
    e('rect', { key: 'tl', x: left, y: top, width: plotW / 2, height: plotH / 2, fill: 'var(--ti-accent-soft)' }),
    e('rect', { key: 'br', x: midX, y: midY, width: plotW / 2, height: plotH / 2, fill: 'var(--ti-accent-soft)' }),
    e('line', { key: 'vx', x1: midX, y1: top, x2: midX, y2: bottom, stroke: 'var(--ti-figure-stroke)', strokeDasharray: '4 5' }),
    e('line', { key: 'hy', x1: left, y1: midY, x2: right, y2: midY, stroke: 'var(--ti-figure-stroke)', strokeDasharray: '4 5' }),
    e('rect', { key: 'frame', x: left, y: top, width: plotW, height: plotH, fill: 'none', stroke: 'var(--ti-figure-stroke)' }),
    e('text', { key: 'xlabel', x: left + plotW / 2, y: height - 30, textAnchor: 'middle', fill: 'var(--ti-sub)', fontSize: 11.5 }, props.visual.xLabel + ' →'),
    e(
      'text',
      {
        key: 'ylabel',
        x: 24,
        y: top + plotH / 2,
        textAnchor: 'middle',
        fill: 'var(--ti-sub)',
        fontSize: 11.5,
        transform: `rotate(-90 24 ${top + plotH / 2})`,
      },
      props.visual.yLabel + ' →',
    ),
  ];
  items.forEach((item, index) => {
    const x = cx(item.x);
    const y = cy(item.y);
    const anchor = x > right - 120 ? 'end' : 'start';
    const tx = anchor === 'end' ? x - 10 : x + 10;
    parts.push(
      e(
        'g',
        { key: 'point-' + index },
        e('circle', { cx: x, cy: y, r: 6, fill: 'var(--ti-accent)', stroke: 'var(--ti-layer)', strokeWidth: 2 }),
        e('text', { x: tx, y: y - 6, textAnchor: anchor, fill: 'var(--ti-text)', fontSize: 11.5, fontWeight: 600 }, item.name),
        e('text', { x: tx, y: y + 15, textAnchor: anchor, fill: 'var(--ti-sub)', fontSize: 10 }, item.x + ' / ' + item.y),
      ),
    );
  });
  return e(
    'svg',
    {
      className: 'ti-svg',
      viewBox: `0 0 ${width} ${height}`,
      role: 'img',
      'aria-label': props.visual.title || '场景价值矩阵',
    },
    parts,
  );
}

/** 业界时间线：纵向时间轴。 */
function TiTimelineSvg(props) {
  const items = Array.isArray(props.visual.items) ? props.visual.items : [];
  if (items.length === 0) return null;
  const width = 760;
  const rowH = 58;
  const top = 14;
  const height = top * 2 + items.length * rowH;
  const axisX = 138;
  const parts = [
    e('line', { key: 'axis', x1: axisX, y1: top + 8, x2: axisX, y2: height - top - 8, stroke: 'var(--ti-figure-stroke)', strokeWidth: 1.4 }),
  ];
  items.forEach((item, index) => {
    const y = top + index * rowH;
    parts.push(
      e(
        'g',
        { key: 'event-' + index },
        e('text', { x: axisX - 16, y: y + 16, textAnchor: 'end', fill: 'var(--ti-sub)', fontSize: 11.5, fontWeight: 600 }, item.time || '—'),
        e('circle', { cx: axisX, cy: y + 12, r: 4.2, fill: 'var(--ti-accent)' }),
        e('text', { x: axisX + 18, y: y + 16, fill: 'var(--ti-text)', fontSize: 12.5, fontWeight: 650 }, item.title),
        item.detail
          ? e('text', { x: axisX + 18, y: y + 35, fill: 'var(--ti-sub)', fontSize: 11 }, tiTruncate(item.detail, 58))
          : null,
      ),
    );
  });
  return e(
    'svg',
    {
      className: 'ti-svg',
      viewBox: `0 0 ${width} ${height}`,
      role: 'img',
      'aria-label': props.visual.title || '业界采用时间线',
    },
    parts,
  );
}
