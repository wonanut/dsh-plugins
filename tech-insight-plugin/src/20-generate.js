/* ─────────────────────────────────────────────────────────────
 * 技术洞察 · 生成流程
 * 空态输入卡、生成中进度视图（四阶段 + 实时来源 + 取消）、错误卡，
 * 以及 insight / refine 两个 SSE 请求的薄封装。
 * ───────────────────────────────────────────────────────────── */

/** 输入区：技术名称 + 关注点 + 深度 + 一键洞察 + 示例 chip。 */
function TiGenerator(props) {
  const draft = props.draft || { topic: '', focus: '', depth: 'standard' };
  const topicRef = useRef(null);
  const depthMeta = TI_DEPTHS.filter((item) => item.id === draft.depth)[0] || TI_DEPTHS[1];
  const canSubmit = String(draft.topic || '').trim().length > 0 && !props.disabled;

  useEffect(() => {
    if (topicRef.current && typeof topicRef.current.focus === 'function') topicRef.current.focus();
  }, []);

  const submit = () => {
    if (!canSubmit) return;
    props.onSubmit();
  };

  return e(
    'div',
    { className: 'ti-generator ti-anim' },
    e(
      'div',
      { className: 'ti-gen-hero' },
      e(
        'div',
        { className: 'ti-gen-kicker' },
        e('span', { className: 'ti-chip-dot' }),
        e('span', null, '联网检索 · 结构化成稿 · 本地归档'),
      ),
      e('h2', { className: 'ti-gen-title' }, '输入一个技术，得到一份能直接用的洞察'),
      e(
        'p',
        { className: 'ti-gen-desc' },
        'Host 会先联网检索公开资料、抓取正文，再交给当前 DSH 默认模型，按「技术介绍 / 技术方案设计 / 关键难点 / 使用场景 / 业界状态」成稿，并自动归档到本地，随时可以补充修订。',
      ),
    ),
    e(
      'div',
      { className: 'ti-gen-card' },
      e(
        TiField,
        {
          label: '技术名称',
          required: true,
          tip: '必填 · Ctrl / ⌘ + Enter 直接生成',
        },
        e('textarea', {
          ref: topicRef,
          className: 'ti-textarea ti-topic',
          value: draft.topic,
          rows: 2,
          placeholder: '例如：向量数据库、RISC-V、智能体记忆、液冷数据中心…',
          'aria-label': '技术名称',
          onChange: (event) => props.onDraftChange({ topic: event.target.value }),
          onKeyDown: (event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              submit();
            }
          },
        }),
      ),
      e(
        TiField,
        { label: '关注点（可选）', hint: '告诉模型你更关心什么，报告会围绕它展开重点。' },
        e('input', {
          className: 'ti-input',
          value: draft.focus,
          placeholder: '例如：工程落地与选型、成本与性能取舍、生态成熟度…',
          'aria-label': '关注点',
          onChange: (event) => props.onDraftChange({ focus: event.target.value }),
        }),
      ),
      e(
        'div',
        { className: 'ti-gen-row' },
        e('span', { className: 'ti-label' }, e('span', null, '洞察深度'), e('span', { className: 'ti-label-tip' }, depthMeta.hint)),
        e(
          'div',
          { className: 'ti-depth-row', role: 'group', 'aria-label': '洞察深度' },
          TI_DEPTHS.map((item) =>
            e(
              'button',
              {
                key: item.id,
                type: 'button',
                className: 'ti-depth' + (draft.depth === item.id ? ' on' : ''),
                'aria-pressed': draft.depth === item.id,
                onClick: () => props.onDraftChange({ depth: item.id }),
              },
              e('span', null, item.label),
              e('small', null, item.hint),
            ),
          ),
        ),
      ),
      e(
        'div',
        { className: 'ti-gen-foot' },
        e(
          'div',
          { className: 'ti-examples' },
          e('span', null, '试试：'),
          TI_EXAMPLES.map((name) =>
            e(
              'button',
              {
                key: name,
                type: 'button',
                className: 'ti-example',
                onClick: () => props.onDraftChange({ topic: name }),
              },
              name,
            ),
          ),
        ),
        e(
          TiBtn,
          { variant: 'primary', icon: 'spark', disabled: !canSubmit, onClick: submit },
          props.disabled ? '生成中…' : '一键洞察',
        ),
      ),
      props.disabled
        ? e('div', { className: 'ti-hint' }, '当前有任务正在运行，完成或取消后才能发起新的洞察。')
        : null,
    ),
  );
}

/** 生成中视图：四阶段步骤条 + 进度 + 检索词 + 实时来源 + 用时 + 取消。 */
function TiProgressView(props) {
  const job = props.job || {};
  const isRefine = job.kind === 'refine';
  const sources = Array.isArray(job.sources) ? job.sources : [];
  const queries = Array.isArray(job.queries) ? job.queries : [];
  const activeIndex = (() => {
    const index = TI_STAGES.findIndex((item) => item.key === job.stage);
    return index === -1 ? 0 : index;
  })();
  const percent = tiClamp((Number(job.progress) || 0) * 100, 3, 100);
  const stageLabel = job.stageLabel || (TI_STAGES[activeIndex] && TI_STAGES[activeIndex].label) || '准备中';

  return e(
    'div',
    { className: 'ti-progress-card ti-anim' },
    e(
      'div',
      { className: 'ti-progress-head' },
      e(
        'div',
        null,
        e(
          'h2',
          { className: 'ti-progress-title' },
          isRefine ? '正在补充修订' : '正在生成技术洞察',
        ),
        e(
          'p',
          { className: 'ti-progress-sub' },
          (isRefine ? '修订对象：' : '技术主题：') + (job.topic || '—') + ' · ' + stageLabel,
        ),
      ),
      e(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
        e(
          'span',
          { className: 'ti-progress-time' },
          e(TiIcon, { name: 'clock', size: 13 }),
          '已用 ' + tiFormatElapsed(props.elapsed),
        ),
        e(
          TiBtn,
          { variant: 'ghost', size: 'sm', icon: 'stop', onClick: props.onCancel },
          '取消',
        ),
      ),
    ),
    e(
      'div',
      { className: 'ti-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(percent), 'aria-label': '生成进度' },
      e('div', { className: 'ti-bar-fill', style: { width: percent + '%' } }),
    ),
    e(
      'div',
      { className: 'ti-steps' },
      TI_STAGES.map((stage, index) => {
        const state = index < activeIndex ? 'done' : index === activeIndex ? 'on' : '';
        return e(
          'div',
          { key: stage.key, className: 'ti-step' + (state ? ' ' + state : '') },
          e(
            'div',
            { className: 'ti-step-head' },
            e('span', { className: 'ti-step-index' }, state === 'done' ? e(TiIcon, { name: 'check', size: 10, strokeWidth: 2.4 }) : String(index + 1)),
            e('span', null, stage.label),
          ),
          e('div', { className: 'ti-step-hint' }, stage.hint),
        );
      }),
    ),
    e(
      'div',
      { className: 'ti-progress-panel' },
      e(
        'div',
        { className: 'ti-progress-panel-title' },
        e('span', null, isRefine && !job.useWeb ? '基于现有报告与分析推理' : '检索词'),
        queries.length ? e('span', null, queries.length + ' 组') : null,
      ),
      queries.length
        ? e(
            'div',
            { className: 'ti-queries' },
            queries.map((query, index) => e('span', { key: query + index, className: 'ti-query' }, query)),
          )
        : e('span', { className: 'ti-hint' }, job.stage === 'search' ? '正在生成检索词…' : '尚未产生检索词'),
    ),
    e(
      'div',
      { className: 'ti-progress-panel' },
      e(
        'div',
        { className: 'ti-progress-panel-title' },
        e('span', null, '已发现来源'),
        e('span', null, sources.length ? sources.length + ' 条（最多展示 12 条）' : '等待检索结果'),
      ),
      sources.length
        ? e(
            'div',
            { className: 'ti-sources' },
            sources.slice(0, 12).map((source, index) =>
              e(
                'div',
                { key: source.url || index, className: 'ti-source' },
                e('span', { className: 'ti-source-index' }, String(index + 1)),
                e(
                  'div',
                  { className: 'ti-source-main' },
                  e('div', { className: 'ti-source-title', title: source.title }, source.title || source.url),
                  e('div', { className: 'ti-source-site' }, tiSiteOf(source)),
                ),
              ),
            ),
          )
        : e(
            'div',
            { className: 'ti-sources' },
            e('div', { className: 'ti-skeleton ti-skeleton-row' }),
            e('div', { className: 'ti-skeleton ti-skeleton-row' }),
            e('div', { className: 'ti-skeleton ti-skeleton-row' }),
          ),
    ),
  );
}

/** 可读错误卡：保留输入，支持重试 / 返回。 */
function TiInsightError(props) {
  return e(
    'div',
    { className: 'ti-error-card ti-anim', role: 'alert' },
    e(
      'div',
      { className: 'ti-error-head' },
      e(TiIcon, { name: 'alert', size: 17 }),
      e('h2', { className: 'ti-error-title' }, props.title || '洞察生成失败'),
    ),
    e('p', { className: 'ti-error-body' }, props.message || '发生了未知错误，请重试。'),
    props.code ? e('div', { className: 'ti-hint' }, '错误码：' + props.code) : null,
    e(
      'div',
      { className: 'ti-error-actions' },
      props.onRetry ? e(TiBtn, { variant: 'primary', size: 'sm', icon: 'refresh', onClick: props.onRetry }, '重试') : null,
      props.onBack ? e(TiBtn, { size: 'sm', onClick: props.onBack }, '返回') : null,
    ),
  );
}
