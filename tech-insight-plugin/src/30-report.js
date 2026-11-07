/* ─────────────────────────────────────────────────────────────
 * 技术洞察 · 报告视图
 * 报告头部 / 四个固定分节（折叠 + 手动编辑）/ 相关参考 /
 * 修订历史（查看预览、回滚）/ 补充修订弹窗。
 * ───────────────────────────────────────────────────────────── */

/** 分节卡片：折叠、编辑、保存。 */
function TiSectionCard(props) {
  const section = props.section;
  const meta = TI_SECTIONS.filter((item) => item.key === section.key)[0] || TI_SECTIONS[0];
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.body || '');

  /* 外部报告切换时同步草稿，避免编辑到上一份报告的内容。 */
  useEffect(() => {
    setDraft(section.body || '');
    setEditing(false);
  }, [section.body, props.reportId]);

  const save = () => {
    props.onSave(section.key, draft);
    setEditing(false);
  };

  return e(
    'section',
    { className: 'ti-section' + (collapsed ? ' collapsed' : '') },
    e(
      'div',
      { className: 'ti-section-head' },
      e('span', { className: 'ti-section-badge' }, e(TiIcon, { name: meta.icon, size: 15 })),
      e(
        'button',
        {
          type: 'button',
          className: 'ti-section-head-main',
          style: { background: 'transparent', border: 0, padding: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer' },
          onClick: () => setCollapsed((value) => !value),
          'aria-expanded': !collapsed,
          title: collapsed ? '展开分节' : '收起分节',
        },
        e('h3', { className: 'ti-section-title' }, section.title || meta.label),
        e('span', { className: 'ti-section-key' }, meta.key),
        e(TiIcon, { name: collapsed ? 'chevronRight' : 'chevronDown', size: 13, style: { color: 'var(--ti-sub)' } }),
      ),
      e(
        'div',
        { className: 'ti-section-tools' },
        editing
          ? null
          : e(TiIconBtn, { icon: 'edit', title: '手动编辑本节', onClick: () => setEditing(true) }),
      ),
    ),
    e(
      'div',
      { className: 'ti-section-body' },
      editing
        ? e(
            'div',
            null,
            e('textarea', {
              className: 'ti-textarea',
              value: draft,
              rows: 10,
              autoFocus: true,
              onChange: (event) => setDraft(event.target.value),
              'aria-label': section.title + ' 正文',
            }),
            e(
              'div',
              { className: 'ti-section-foot' },
              e('span', { className: 'ti-hint' }, '支持 markdown-lite：## 小标题、- 列表、**粗体**、`代码`、[链接](https://…)'),
              e(
                'span',
                { style: { display: 'inline-flex', gap: 6 } },
                e(TiBtn, { size: 'sm', onClick: () => { setDraft(section.body || ''); setEditing(false); } }, '取消'),
                e(TiBtn, { size: 'sm', variant: 'primary', icon: 'check', onClick: save }, '保存'),
              ),
            ),
          )
        : [
            props.visual ? e(TiFigure, { key: 'figure', kind: props.visualKind, visual: props.visual }) : null,
            e(TiRichText, {
              key: 'rich',
              text: section.body,
              emptyText: '这一节还没有内容，点击右上角编辑补充。',
            }),
          ],
    ),
  );
}

/** 修订历史列表（倒序）+ 只读预览。 */
function TiHistoryView(props) {
  const entry = props.entry;
  const revisions = (entry.revisions || []).slice().sort((a, b) => b.rev - a.rev);
  const [previewRev, setPreviewRev] = useState(null);
  const preview = previewRev === null ? null : revisions.filter((item) => item.rev === previewRev)[0];

  return e(
    'div',
    { className: 'ti-history ti-anim' },
    e(
      'div',
      { className: 'ti-history-head' },
      e(
        'div',
        null,
        e('h2', { className: 'ti-history-title' }, '修订历史'),
        e('p', { className: 'ti-history-sub' }, '共 ' + revisions.length + ' 个版本。回滚不会删除历史，而是把旧版本作为新版本追加。'),
      ),
      e(TiBtn, { size: 'sm', icon: 'edit', onClick: props.onBack }, '返回报告'),
    ),
    e(
      'div',
      { className: 'ti-history-list' },
      revisions.map((revision) =>
        e(
          'div',
          { key: revision.rev, className: 'ti-rev' + (revision.rev === entry.currentRev ? ' current' : '') },
          e(
            'div',
            { className: 'ti-rev-main' },
            e(
              'div',
              { className: 'ti-rev-top' },
              e('span', { className: 'ti-rev-badge' }, 'v' + revision.rev),
              revision.rev === entry.currentRev ? e(TiChip, { tone: 'good' }, '当前版本') : null,
              e('span', { className: 'ti-rev-note' }, revision.note || '未命名修订'),
            ),
            e('div', { className: 'ti-rev-meta' }, '时间：' + tiFormatDateTime(revision.at)),
          ),
          e(
            'div',
            { className: 'ti-rev-actions' },
            e(TiBtn, { size: 'sm', icon: 'file', onClick: () => setPreviewRev(revision.rev) }, '查看'),
            revision.rev === entry.currentRev
              ? null
              : e(TiBtn, { size: 'sm', variant: 'soft', icon: 'history', onClick: () => props.onRollback(revision.rev) }, '回滚到此版本'),
          ),
        ),
      ),
    ),
    preview
      ? e(TiRevisionPreview, { revision: preview, onClose: () => setPreviewRev(null) })
      : null,
  );
}

/** 历史版本只读预览弹窗。 */
function TiRevisionPreview(props) {
  const revision = props.revision;
  const report = revision.report || {};
  const sections = Array.isArray(report.sections) ? report.sections : [];
  return e(
    TiModal,
    {
      title: 'v' + revision.rev + ' · ' + (revision.note || '历史版本'),
      sub: '保存时间：' + tiFormatDateTime(revision.at) + '（只读预览）',
      width: 760,
      onClose: props.onClose,
      footer: [e(TiBtn, { key: 'close', onClick: props.onClose }, '关闭')],
    },
    e(
      'div',
      { className: 'ti-preview-meta' },
      e(TiChip, { icon: 'clock' }, tiFormatDateTime(revision.at)),
      report.model ? e(TiChip, { icon: 'cpu' }, report.model) : null,
      Number.isFinite(report.sourceCount) ? e(TiChip, { icon: 'globe' }, report.sourceCount + ' 个来源') : null,
    ),
    report.title ? e('div', { style: { fontSize: 16, fontWeight: 660, lineHeight: 1.4 } }, report.title) : null,
    report.oneLiner ? e('p', { style: { margin: 0, color: 'var(--ti-sub)', fontSize: 12.5, lineHeight: 1.7 } }, report.oneLiner) : null,
    sections.length
      ? sections.map((section) =>
          e(
            'div',
            { key: section.key || section.title, className: 'ti-preview-section' },
            e('div', { style: { fontSize: 12.5, fontWeight: 650, marginBottom: 4 } }, section.title || ''),
            e(TiRichText, { text: section.body }),
          ),
        )
      : e('p', { className: 'ti-hint' }, '这个历史版本没有可预览的分节内容。'),
  );
}

/** 补充修订弹窗：修订指令必填 + 联网开关（默认开）。 */
function TiRefineDialog(props) {
  const [instruction, setInstruction] = useState('');
  const [useWeb, setUseWeb] = useState(true);
  const canSubmit = instruction.trim().length > 0 && !props.disabled;

  const submit = () => {
    if (!canSubmit) return;
    props.onSubmit(instruction.trim(), useWeb);
  };

  return e(
    TiModal,
    {
      title: '补充修订',
      sub: '说明要补充或修正的方向；完成后会追加一个新版本，历史版本仍可查看与回滚。',
      width: 580,
      onClose: props.onClose,
      footer: [
        e(TiBtn, { key: 'cancel', onClick: props.onClose }, '取消'),
        e(
          TiBtn,
          { key: 'ok', variant: 'primary', icon: 'spark', disabled: !canSubmit, onClick: submit },
          '开始修订',
        ),
      ],
    },
    e(
      TiField,
      {
        label: '修订指令',
        required: true,
        hint: '示例：补充近一年国内厂商的落地案例，并给出与竞品的对比。',
      },
      e('textarea', {
        className: 'ti-textarea',
        value: instruction,
        rows: 5,
        autoFocus: true,
        placeholder: '例如：补充近一年国内厂商的落地案例；把「关键难点」写得更偏工程实践…',
        'aria-label': '修订指令',
        onChange: (event) => setInstruction(event.target.value),
      }),
    ),
    e(
      'label',
      { className: 'ti-switch' + (useWeb ? ' on' : '') },
      e('input', {
        type: 'checkbox',
        checked: useWeb,
        onChange: (event) => setUseWeb(event.target.checked),
      }),
      e('span', { className: 'ti-switch-track', 'aria-hidden': 'true' }),
      e(
        'div',
        { className: 'ti-switch-main' },
        e('div', { className: 'ti-switch-title' }, '联网检索新资料'),
        e(
          'div',
          { className: 'ti-switch-desc' },
          useWeb
            ? '开启：会重新联网检索并抓取正文，补充最新信息。'
            : '关闭：不联网，只基于现有报告和修订指令改写。',
        ),
      ),
    ),
  );
}

/** 报告主视图：头部 + 分节 / 修订历史 tab + 相关参考。 */
function TiReportView(props) {
  const report = props.report;
  const entry = props.entry;
  const [tab, setTab] = useState('report');
  const [metaEditing, setMetaEditing] = useState(false);
  const [metaDraft, setMetaDraft] = useState({ title: report.title, oneLiner: report.oneLiner });

  /* 切换到另一份报告时回到报告 tab 并重置编辑态。 */
  useEffect(() => {
    setTab('report');
    setMetaEditing(false);
    setMetaDraft({ title: report.title, oneLiner: report.oneLiner });
  }, [report.id]);

  const revisionCount = (entry.revisions || []).length;
  const saveMeta = () => {
    props.onSaveMeta({
      title: String(metaDraft.title || '').trim() || report.title,
      oneLiner: String(metaDraft.oneLiner || '').trim(),
    });
    setMetaEditing(false);
  };

  return e(
    'div',
    { className: 'ti-report ti-anim' },
    e(
      'div',
      { className: 'ti-report-head' },
      e(
        'div',
        { className: 'ti-report-kicker' },
        e(TiChip, { tone: 'brand', icon: 'book' }, report.topic || '技术洞察'),
        e(TiChip, { icon: 'history' }, 'v' + entry.currentRev),
        report.model ? e(TiChip, { icon: 'cpu' }, report.model) : null,
        Number.isFinite(report.sourceCount) ? e(TiChip, { icon: 'globe' }, report.sourceCount + ' 个来源') : null,
      ),
      metaEditing
        ? e(
            'div',
            { className: 'ti-form' },
            e(
              TiField,
              { label: '报告标题' },
              e('input', {
                className: 'ti-input',
                value: metaDraft.title,
                onChange: (event) => setMetaDraft((current) => Object.assign({}, current, { title: event.target.value })),
                'aria-label': '报告标题',
              }),
            ),
            e(
              TiField,
              { label: '一句话结论' },
              e('textarea', {
                className: 'ti-textarea',
                value: metaDraft.oneLiner,
                rows: 2,
                onChange: (event) => setMetaDraft((current) => Object.assign({}, current, { oneLiner: event.target.value })),
                'aria-label': '一句话结论',
              }),
            ),
            e(
              'div',
              { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
              e(TiBtn, { size: 'sm', variant: 'primary', icon: 'check', onClick: saveMeta }, '保存标题与结论'),
              e(
                TiBtn,
                {
                  size: 'sm',
                  onClick: () => {
                    setMetaDraft({ title: report.title, oneLiner: report.oneLiner });
                    setMetaEditing(false);
                  },
                },
                '取消',
              ),
            ),
          )
        : [
            e('h1', { key: 'title', className: 'ti-report-title' }, report.title),
            report.oneLiner ? e('p', { key: 'one', className: 'ti-report-oneliner' }, report.oneLiner) : null,
          ],
      e(
        'div',
        { className: 'ti-report-meta' },
        e('span', null, '生成于 ' + tiFormatDateTime(report.createdAt)),
        e('span', { className: 'ti-item-dot' }),
        e('span', null, '更新于 ' + tiFormatDateTime(report.updatedAt)),
        e('span', { className: 'ti-item-dot' }),
        e('span', null, '当前版本 v' + entry.currentRev + ' / 共 ' + revisionCount + ' 个版本'),
        report.queries && report.queries.length ? e('span', { className: 'ti-item-dot' }) : null,
        report.queries && report.queries.length ? e('span', null, report.queries.length + ' 组检索词') : null,
      ),
      e(
        'div',
        { className: 'ti-report-actions' },
        e(TiBtn, { variant: 'primary', icon: 'spark', onClick: props.onRefine, disabled: props.busy }, '补充修订'),
        e(
          TiBtn,
          {
            icon: 'edit',
            onClick: () => {
              setMetaDraft({ title: report.title, oneLiner: report.oneLiner });
              setMetaEditing((value) => !value);
            },
          },
          metaEditing ? '收起编辑' : '手动编辑',
        ),
        e(TiBtn, { icon: 'copy', onClick: props.onCopy }, '复制 Markdown'),
        e(TiBtn, { icon: 'download', onClick: props.onExport }, '导出 .md'),
        e(TiBtn, { variant: 'danger', icon: 'trash', onClick: props.onDelete }, '删除'),
        e('span', { className: 'ti-spacer' }),
        e(
          'div',
          { className: 'ti-tabs', role: 'tablist', 'aria-label': '报告视图切换' },
          e(
            'button',
            {
              type: 'button',
              role: 'tab',
              'aria-selected': tab === 'report',
              className: 'ti-tab' + (tab === 'report' ? ' on' : ''),
              onClick: () => setTab('report'),
            },
            e(TiIcon, { name: 'book', size: 13 }),
            '报告',
          ),
          e(
            'button',
            {
              type: 'button',
              role: 'tab',
              'aria-selected': tab === 'history',
              className: 'ti-tab' + (tab === 'history' ? ' on' : ''),
              onClick: () => setTab('history'),
            },
            e(TiIcon, { name: 'history', size: 13 }),
            '修订历史',
            e('span', { className: 'ti-tab-badge' }, String(revisionCount)),
          ),
        ),
      ),
    ),
    tab === 'history'
      ? e(TiHistoryView, {
          entry,
          onBack: () => setTab('report'),
          onRollback: props.onRollback,
        })
      : [
          e(
            'div',
            { key: 'sections', className: 'ti-sections' },
            report.sections.map((section) =>
              e(TiSectionCard, {
                key: section.key,
                section,
                reportId: report.id,
                visualKind: TI_SECTION_VISUALS[section.key] || null,
                visual: report.visuals ? report.visuals[TI_SECTION_VISUALS[section.key] || ''] || null : null,
                onSave: props.onSaveSection,
              }),
            ),
          ),
          e(
            'div',
            { key: 'refs', className: 'ti-refs' },
            e(
              'div',
              { className: 'ti-refs-head' },
              e(TiIcon, { name: 'globe', size: 15, style: { color: 'var(--ti-accent)' } }),
              e('h3', { className: 'ti-refs-title' }, '相关参考'),
              e('span', { className: 'ti-hint' }, report.references.length ? report.references.length + ' 条' : ''),
            ),
            report.references.length
              ? e(
                  'ol',
                  { className: 'ti-refs-list' },
                  report.references.map((ref, index) =>
                    e(
                      'li',
                      { key: ref.url + index, className: 'ti-ref' },
                      e('span', { className: 'ti-ref-index' }, String(index + 1)),
                      e(
                        'div',
                        { className: 'ti-ref-main' },
                        e(
                          'a',
                          {
                            className: 'ti-ref-link',
                            href: ref.url,
                            target: '_blank',
                            rel: 'noopener noreferrer',
                            title: ref.url,
                          },
                          e('span', null, ref.title),
                          e(TiIcon, { name: 'external', size: 11 }),
                        ),
                        ref.note ? e('div', { className: 'ti-ref-note' }, ref.note) : null,
                        e('div', { className: 'ti-ref-url' }, ref.url),
                      ),
                    ),
                  ),
                )
              : e('p', { className: 'ti-hint' }, '这份报告没有记录参考来源。'),
          ),
          e(
            'div',
            { key: 'foot', className: 'ti-report-foot' },
            e('span', null, '报告结束 · 由「技术洞察」生成 · ' + report.references.length + ' 条参考'),
            e(
              'span',
              { className: 'ti-report-foot-actions' },
              e(TiBtn, { size: 'sm', icon: 'spark', onClick: props.onRefine, disabled: props.busy }, '继续补充修订'),
              e(TiBtn, { size: 'sm', icon: 'download', onClick: props.onExport }, '导出 .md'),
            ),
          ),
        ],
  );
}
