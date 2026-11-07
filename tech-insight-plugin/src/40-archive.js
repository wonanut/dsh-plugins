/* ─────────────────────────────────────────────────────────────
 * 技术洞察 · 归档列表（左栏）
 * 搜索、选中、版本数 / 来源数 / 日期展示、单条删除。
 * ───────────────────────────────────────────────────────────── */

function TiArchiveItem(props) {
  const entry = props.entry;
  const report = entry.report || {};
  return e(
    'div',
    { className: 'ti-item' + (props.selected ? ' on' : '') },
    e(
      'button',
      {
        type: 'button',
        className: 'ti-item-main',
        onClick: props.onSelect,
        'aria-current': props.selected ? 'true' : undefined,
        title: report.title,
      },
      e('div', { className: 'ti-item-title' }, report.title || report.topic || '未命名报告'),
      e(
        'div',
        { className: 'ti-item-meta' },
        e('b', null, 'v' + entry.currentRev),
        e('span', { className: 'ti-item-dot' }),
        e('span', null, (Number.isFinite(report.sourceCount) ? report.sourceCount : 0) + ' 来源'),
        e('span', { className: 'ti-item-dot' }),
        e('span', null, tiFormatShortDate(entry.archivedAt)),
      ),
    ),
    e(
      'button',
      {
        type: 'button',
        className: 'ti-item-del',
        title: '删除这份归档',
        'aria-label': '删除「' + (report.title || '归档报告') + '」',
        onClick: (event) => {
          event.stopPropagation();
          props.onDelete();
        },
      },
      e(TiIcon, { name: 'trash', size: 12 }),
    ),
  );
}

/** 生成中的临时条目：点击可回到进度视图。 */
function TiArchivePending(props) {
  const pending = props.pending || {};
  const refining = pending.kind === 'refine';
  return e(
    'div',
    { className: 'ti-item ti-item-pending' + (props.selected ? ' on' : '') },
    e(
      'button',
      {
        type: 'button',
        className: 'ti-item-main',
        onClick: props.onSelect,
        title: pending.topic || '生成中',
      },
      e(
        'div',
        { className: 'ti-item-title' },
        (refining ? '修订中 · ' : '') + (pending.topic || '新洞察'),
      ),
      e(
        'div',
        { className: 'ti-item-meta' },
        e(
          'span',
          { className: 'ti-pending-tag' },
          e(TiSpinner, null),
          refining ? '修订中' : '生成中',
        ),
        e('span', { className: 'ti-item-dot' }),
        e('span', null, pending.stageLabel || '准备中'),
      ),
    ),
  );
}

function TiArchive(props) {
  const entries = Array.isArray(props.entries) ? props.entries : [];
  const keyword = String(props.query || '').trim().toLowerCase();
  const filtered = keyword
    ? entries.filter((entry) => {
        const report = entry.report || {};
        const haystack = [report.title, report.topic, report.oneLiner].filter(Boolean).join(' ').toLowerCase();
        return haystack.indexOf(keyword) !== -1;
      })
    : entries;
  const sorted = filtered.slice().sort((a, b) => {
    const left = tiParseDate(a.archivedAt);
    const right = tiParseDate(b.archivedAt);
    return (right ? right.getTime() : 0) - (left ? left.getTime() : 0);
  });

  return e(
    'aside',
    { className: 'ti-rail', 'aria-label': '技术洞察归档' },
    e(
      'div',
      { className: 'ti-rail-head' },
      e(
        'div',
        { className: 'ti-rail-title-row' },
        e('span', { className: 'ti-rail-title' }, '归档报告'),
        e(
          'span',
          { className: 'ti-rail-head-actions' },
          e('span', { className: 'ti-rail-count' }, entries.length + (props.pending ? 1 : 0) + ' 份'),
          e(TiIconBtn, {
            icon: 'chevronLeft',
            title: '收起归档目录',
            onClick: props.onCollapse,
          }),
        ),
      ),
      e(
        'div',
        { className: 'ti-search' },
        e(TiIcon, { name: 'search', size: 13 }),
        e('input', {
          type: 'search',
          value: props.query,
          placeholder: '搜索标题或主题',
          'aria-label': '搜索归档报告',
          onChange: (event) => props.onQueryChange(event.target.value),
        }),
      ),
    ),
    e(
      'div',
      { className: 'ti-rail-list' },
      props.pending
        ? e(TiArchivePending, {
            pending: props.pending,
            selected: props.pendingSelected,
            onSelect: props.onSelectPending,
          })
        : null,
      sorted.length
        ? sorted.map((entry) =>
            e(TiArchiveItem, {
              key: entry.report.id,
              entry,
              selected: entry.report.id === props.selectedId,
              onSelect: () => props.onSelect(entry.report.id),
              onDelete: () => props.onDelete(entry),
            }),
          )
        : e(
            'div',
            { className: 'ti-rail-empty' },
            entries.length
              ? '没有匹配的归档报告，换个关键词试试。'
              : '还没有归档报告。生成第一份洞察后，会自动出现在这里。',
          ),
    ),
  );
}

/** 归档目录收起后的窄条：点击图标重新展开。 */
function TiArchiveToggle(props) {
  return e(
    'button',
    {
      type: 'button',
      className: 'ti-rail-toggle',
      title: '展开归档目录',
      'aria-label': '展开归档目录',
      onClick: props.onExpand,
    },
    e(TiIcon, { name: 'chevronRight', size: 14 }),
    e('span', { className: 'ti-rail-toggle-label' }, '归档'),
    props.count ? e('span', { className: 'ti-rail-toggle-count' }, String(props.count)) : null,
  );
}
