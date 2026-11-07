/* ─────────────────────────────────────────────────────────────
 * 技术洞察 · 页面外壳与状态编排
 * 负责：本地归档 store 的读写、状态 chip、生成 / 修订 / 编辑 / 回滚 / 删除
 * 等交互，以及左栏归档 + 右栏主内容的布局。
 * ───────────────────────────────────────────────────────────── */

function Page() {
  const [store, setStoreState] = useState(() => tiReadStore());
  const storeRef = useRef(store);
  const [toast, setToast] = useState(null);
  const [status, setStatus] = useState({ state: 'loading' });
  const [query, setQuery] = useState('');
  const [job, setJob] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null);
  const [dialog, setDialog] = useState(null);
  const pollTimerRef = useRef(0);
  const currentJobIdRef = useRef('');
  const jobTokenRef = useRef(0);
  const lastRequestRef = useRef(null);

  const selectedEntry = useMemo(
    () => store.reports.filter((entry) => entry.report.id === store.selectedId)[0] || null,
    [store.reports, store.selectedId],
  );
  /* 渲染前统一做一次结构归一化，保证四个固定分节与安全字段。 */
  const selectedReport = useMemo(
    () => (selectedEntry ? tiNormalizeReport(selectedEntry.report) : null),
    [selectedEntry],
  );

  /* ── 归档持久化 ─────────────────────────────────────── */

  const railCollapsed = !!(store.prefs && store.prefs.railCollapsed);


  const notify = useCallback((text, tone) => {
    setToast({ id: tiUid('toast'), text: text, tone: tone || 'info' });
  }, []);

  const commit = useCallback(
    (updater) => {
      const current = storeRef.current;
      const next = typeof updater === 'function' ? updater(current) : updater;
      if (!next) return current;
      storeRef.current = next;
      setStoreState(next);
      const result = tiWriteStore(next);
      if (!result.ok) notify(result.message, 'error');
      return next;
    },
    [notify],
  );

  /* 归档目录折叠状态持久化到本地 prefs。 */
  const toggleRail = useCallback(() => {
    commit((current) =>
      Object.assign({}, current, {
        prefs: Object.assign({}, current.prefs, { railCollapsed: !current.prefs.railCollapsed }),
      }),
    );
  }, [commit]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  /* ── 状态 chip ──────────────────────────────────────── */

  const refreshStatus = useCallback(() => {
    setStatus({ state: 'loading' });
    tiFetchStatus().then((next) => setStatus(next));
  }, []);

  useEffect(() => {
    let alive = true;
    tiFetchStatus().then((next) => {
      if (alive) setStatus(next);
    });
    /* 页面重新挂载时续接后台任务：运行中恢复进度，已完成则补归档。 */
    tiFetchLatestJob()
      .then((remote) => {
        if (!alive || !remote) return;
        if (remote.status === 'running') {
          const token = jobTokenRef.current + 1;
          jobTokenRef.current = token;
          currentJobIdRef.current = remote.id;
          commit((current) => Object.assign({}, current, { selectedId: TI_PENDING_ID }));
          setJob(jobToStateRef.current(remote));
          pollJobRef.current(remote.id, token);
          return;
        }
        if (remote.status === 'done' && remote.report) {
          if (storeRef.current.reports.some((entry) => entry.report.id === remote.report.id)) return;
          if (remote.kind === 'refine') archiveRefineRef.current(remote.report, remote.instruction);
          else archiveInsightRef.current(remote.report);
        }
      })
      .catch(() => {
        /* 后台任务查询失败不阻塞页面 */
      });
    return () => {
      alive = false;
      /* 卸载只停止轮询，不取消 Host 后台任务：切走页面后任务继续执行。 */
      if (pollTimerRef.current) {
        window.clearTimeout(pollTimerRef.current);
        pollTimerRef.current = 0;
      }
    };
  }, []);

  /* ── 生成用时计时器 ─────────────────────────────────── */

  const jobStartedAt = job ? job.startedAt : 0;
  useEffect(() => {
    if (!jobStartedAt) {
      setElapsed(0);
      return undefined;
    }
    setElapsed(Date.now() - jobStartedAt);
    const timer = window.setInterval(() => setElapsed(Date.now() - jobStartedAt), 200);
    return () => window.clearInterval(timer);
  }, [jobStartedAt]);

  /* 供挂载 effect 调用的最新实现（effect 只跑一次，避免依赖顺序问题）。 */
  const jobToStateRef = useRef(null);
  const pollJobRef = useRef(null);
  const archiveInsightRef = useRef(null);
  const archiveRefineRef = useRef(null);

  /* ── 后台任务：轮询 / 归档 / 取消 ────────────────────── */
  /* 生成在 Host 后台执行，页面只负责启动和轮询；切换插件/页面不会中断任务，
     回来时通过 latest job 自动续接进度或补归档。 */

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = 0;
    }
  }, []);

  const jobToState = (remote) => {
    const startedAt = tiParseDate(remote.startedAt);
    return Object.assign(tiEmptyJob(), {
      jobId: remote.id,
      kind: remote.kind,
      topic: remote.topic || '',
      depth: remote.depth || 'standard',
      instruction: remote.instruction || '',
      useWeb: true,
      stage: remote.stage || '',
      stageLabel: remote.stageLabel || '准备中',
      progress: Number.isFinite(remote.progress) ? remote.progress : 0,
      queries: Array.isArray(remote.queries) ? remote.queries : [],
      sources: Array.isArray(remote.sources) ? remote.sources : [],
      startedAt: startedAt ? startedAt.getTime() : Date.now(),
    });
  };

  /** 新洞察完成：按 report.id 去重后入归档。 */
  const archiveInsight = useCallback(
    (report) => {
      const archivedAt = new Date().toISOString();
      const entry = {
        report,
        archivedAt,
        revisions: [{ rev: 1, at: archivedAt, note: '初始洞察', report }],
        currentRev: 1,
      };
      commit((current) => {
        const shouldSelect = current.selectedId === TI_PENDING_ID || !current.selectedId;
        if (current.reports.some((item) => item.report.id === report.id)) {
          return Object.assign({}, current, { selectedId: shouldSelect ? report.id : current.selectedId });
        }
        return Object.assign({}, current, {
          reports: [entry].concat(current.reports),
          selectedId: shouldSelect ? report.id : current.selectedId,
        });
      });
      notify('洞察报告已生成并归档', 'success');
    },
    [commit, notify],
  );

  /** 修订完成：追加 revision；原报告已被删除时退化为新归档。 */
  const archiveRefine = useCallback(
    (report, instruction) => {
      const note = tiTruncate(instruction || '补充修订', 60);
      let nextRev = 0;
      commit((current) => {
        const shouldSelect = current.selectedId === TI_PENDING_ID || !current.selectedId || current.selectedId === report.id;
        if (!current.reports.some((entry) => entry.report.id === report.id)) {
          const archivedAt = new Date().toISOString();
          nextRev = Number.isFinite(report.revision) ? report.revision : 1;
          const entry = {
            report,
            archivedAt,
            revisions: [{ rev: nextRev, at: archivedAt, note, report }],
            currentRev: nextRev,
          };
          return Object.assign({}, current, {
            reports: [entry].concat(current.reports),
            selectedId: shouldSelect ? report.id : current.selectedId,
          });
        }
        const reports = current.reports.map((entry) => {
          if (entry.report.id !== report.id) return entry;
          nextRev = Math.max(entry.currentRev + 1, Number.isFinite(report.revision) ? report.revision : 0);
          const nextReport = Object.assign({}, report, {
            revision: nextRev,
            updatedAt: report.updatedAt || new Date().toISOString(),
          });
          return Object.assign({}, entry, {
            report: nextReport,
            revisions: entry.revisions.concat([
              { rev: nextRev, at: new Date().toISOString(), note, report: nextReport },
            ]),
            currentRev: nextRev,
          });
        });
        return Object.assign({}, current, {
          reports,
          selectedId: shouldSelect ? report.id : current.selectedId,
        });
      });
      notify('修订完成，已追加 v' + nextRev + ' 并归档', 'success');
    },
    [commit, notify],
  );

  /** 轮询后台任务直到结束；token 用于避免旧轮询覆盖新任务。 */
  const pollJob = useCallback(
    (jobId, token) => {
      let failures = 0;
      const tick = () => {
        if (jobTokenRef.current !== token) return;
        tiFetchJob(jobId)
          .then((remote) => {
            if (jobTokenRef.current !== token) return;
            if (!remote) {
              currentJobIdRef.current = '';
              setJob(null);
              notify('后台任务已过期，请重新发起。', 'error');
              return;
            }
            if (remote.status === 'running') {
              setJob(jobToState(remote));
              pollTimerRef.current = window.setTimeout(tick, 900);
              return;
            }
            currentJobIdRef.current = '';
            setJob(null);
            if (remote.status === 'done' && remote.report) {
              if (remote.kind === 'refine') archiveRefine(remote.report, remote.instruction);
              else archiveInsight(remote.report);
            } else if (remote.status === 'cancelled') {
              notify('已取消，输入内容已保留', 'info');
            } else {
              const message = remote.error && remote.error.message ? remote.error.message : '任务失败，请重试。';
              setError({
                title: remote.kind === 'refine' ? '补充修订失败' : '洞察生成失败',
                message,
                code: remote.error && remote.error.code,
                retryable: true,
              });
              notify('任务失败：' + message, 'error');
            }
          })
          .catch((failure) => {
            if (jobTokenRef.current !== token) return;
            failures += 1;
            if (failures < 4) {
              pollTimerRef.current = window.setTimeout(tick, 1500);
              return;
            }
            currentJobIdRef.current = '';
            setJob(null);
            const message = (failure && failure.message) || '无法获取后台任务状态';
            setError({ title: '任务状态获取失败', message, code: failure && failure.code, retryable: true });
            notify('任务状态获取失败：' + message, 'error');
          });
      };
      tick();
    },
    [archiveInsight, archiveRefine, notify],
  );

  /* ── 发起洞察生成（Host 后台任务） ───────────────────── */

  const startInsight = useCallback(
    (payload) => {
      const token = jobTokenRef.current + 1;
      jobTokenRef.current = token;
      lastRequestRef.current = { kind: 'insight', payload };
      setError(null);
      /* 立刻在归档目录里出现一条“生成中”，并选中它展示进度。 */
      commit((current) => Object.assign({}, current, { selectedId: TI_PENDING_ID }));
      setJob(
        Object.assign(tiEmptyJob(), {
          kind: 'insight',
          topic: payload.topic,
          focus: payload.focus,
          depth: payload.depth,
          startedAt: Date.now(),
          stage: 'preparing',
          stageLabel: '正在启动后台任务…',
          progress: 0.02,
        }),
      );
      tiStartJob('insight', payload)
        .then((remote) => {
          if (jobTokenRef.current !== token) return;
          currentJobIdRef.current = remote.id;
          setJob(jobToState(remote));
          pollJob(remote.id, token);
        })
        .catch((failure) => {
          if (jobTokenRef.current !== token) return;
          setJob(null);
          const message = (failure && failure.message) || '生成失败，请重试。';
          setError({ title: '洞察生成失败', message, code: failure && failure.code, retryable: true });
          notify('生成失败：' + message, 'error');
        });
    },
    [commit, notify, pollJob],
  );

  /* ── 发起补充修订（Host 后台任务） ───────────────────── */

  const startRefine = useCallback(
    (payload) => {
      const token = jobTokenRef.current + 1;
      jobTokenRef.current = token;
      lastRequestRef.current = { kind: 'refine', payload };
      setError(null);
      commit((current) => Object.assign({}, current, { selectedId: TI_PENDING_ID }));
      setJob(
        Object.assign(tiEmptyJob(), {
          kind: 'refine',
          topic: payload.report.topic || payload.report.title || '',
          instruction: payload.instruction,
          useWeb: payload.useWeb !== false,
          startedAt: Date.now(),
          stage: 'preparing',
          stageLabel: '正在启动后台修订任务…',
          progress: 0.02,
        }),
      );
      tiStartJob('refine', payload)
        .then((remote) => {
          if (jobTokenRef.current !== token) return;
          currentJobIdRef.current = remote.id;
          setJob(jobToState(remote));
          pollJob(remote.id, token);
        })
        .catch((failure) => {
          if (jobTokenRef.current !== token) return;
          setJob(null);
          const message = (failure && failure.message) || '修订失败，请重试。';
          setError({ title: '补充修订失败', message, code: failure && failure.code, retryable: true });
          notify('修订失败：' + message, 'error');
        });
    },
    [commit, notify, pollJob],
  );

  const cancelJob = useCallback(() => {
    const id = currentJobIdRef.current;
    jobTokenRef.current += 1;
    stopPolling();
    currentJobIdRef.current = '';
    setJob(null);
    commit((current) =>
      current.selectedId === TI_PENDING_ID ? Object.assign({}, current, { selectedId: '' }) : current,
    );
    if (id) {
      tiCancelJob(id).catch(() => {
        /* Host 侧可能已经结束 */
      });
    }
    notify('已取消，输入内容已保留', 'info');
  }, [commit, notify, stopPolling]);

  const retryLast = useCallback(() => {
    const request = lastRequestRef.current;
    setError(null);
    if (!request) return;
    if (request.kind === 'insight') startInsight(request.payload);
    else if (request.kind === 'refine') startRefine(request.payload);
  }, [startInsight, startRefine]);

  /* 挂载 effect 只跑一次，通过 ref 拿到最新的任务处理函数。 */
  jobToStateRef.current = jobToState;
  pollJobRef.current = pollJob;
  archiveInsightRef.current = archiveInsight;
  archiveRefineRef.current = archiveRefine;

  /* ── 归档增删改 ─────────────────────────────────────── */

  /** 追加一个修订版本（手动编辑 / 回滚统一走这里，不破坏历史）。 */
  const appendRevision = useCallback(
    (reportId, buildNextReport, note) => {
      commit((current) => {
        const reports = current.reports.map((entry) => {
          if (entry.report.id !== reportId) return entry;
          const nextRev = entry.currentRev + 1;
          /* 本地版本号与 Report.revision 保持一致，回传 Host 修订时可作为起点。 */
          const nextReport = Object.assign({}, buildNextReport(entry.report, nextRev), { revision: nextRev });
          return Object.assign({}, entry, {
            report: nextReport,
            revisions: entry.revisions.concat([
              { rev: nextRev, at: new Date().toISOString(), note, report: nextReport },
            ]),
            currentRev: nextRev,
          });
        });
        return Object.assign({}, current, { reports });
      });
    },
    [commit],
  );

  const saveSection = useCallback(
    (key, body) => {
      if (!selectedEntry) return;
      const meta = TI_SECTIONS.filter((item) => item.key === key)[0];
      const reportId = selectedEntry.report.id;
      appendRevision(
        reportId,
        (base) =>
          Object.assign({}, base, {
            sections: base.sections.map((section) =>
              section.key === key ? Object.assign({}, section, { body }) : section,
            ),
            updatedAt: new Date().toISOString(),
          }),
        '手动编辑 · ' + (meta ? meta.label : key),
      );
      notify('分节已保存，并生成新版本', 'success');
    },
    [appendRevision, notify, selectedEntry],
  );

  const saveMeta = useCallback(
    (draft) => {
      if (!selectedEntry) return;
      appendRevision(
        selectedEntry.report.id,
        (base) =>
          Object.assign({}, base, {
            title: draft.title || base.title,
            oneLiner: draft.oneLiner,
            updatedAt: new Date().toISOString(),
          }),
        '手动编辑 · 标题与结论',
      );
      notify('标题与一句话结论已更新', 'success');
    },
    [appendRevision, notify, selectedEntry],
  );

  const rollback = useCallback(
    (rev) => {
      if (!selectedEntry) return;
      const target = selectedEntry.revisions.filter((item) => item.rev === rev)[0];
      if (!target) {
        notify('找不到 v' + rev + ' 的内容', 'error');
        return;
      }
      appendRevision(
        selectedEntry.report.id,
        () =>
          Object.assign({}, tiDeepCopy(target.report), {
            revision: selectedEntry.currentRev + 1,
            updatedAt: new Date().toISOString(),
          }),
        '回滚到 v' + rev,
      );
      notify('已回滚到 v' + rev + '，并作为新版本保存', 'success');
    },
    [appendRevision, notify, selectedEntry],
  );

  const deleteEntry = useCallback(
    (entry) => {
      const id = entry.report.id;
      commit((current) =>
        Object.assign({}, current, {
          reports: current.reports.filter((item) => item.report.id !== id),
          selectedId: current.selectedId === id ? '' : current.selectedId,
        }),
      );
      notify('归档报告已删除', 'success');
    },
    [commit, notify],
  );

  /* ── 报告操作 ───────────────────────────────────────── */

  const copyMarkdown = useCallback(() => {
    if (!selectedEntry) return;
    tiCopyText(tiReportToMarkdown(selectedEntry.report)).then((ok) => {
      notify(ok ? 'Markdown 已复制到剪贴板' : '复制失败，请手动选择文本', ok ? 'success' : 'error');
    });
  }, [notify, selectedEntry]);

  const exportMarkdown = useCallback(() => {
    if (!selectedEntry) return;
    const markdown = tiReportToMarkdown(selectedEntry.report);
    const ok = tiDownloadText(tiReportFileName(selectedEntry.report), markdown);
    notify(ok ? '已开始下载 .md 文件' : '导出失败，请重试', ok ? 'success' : 'error');
  }, [notify, selectedEntry]);

  /* ── 输入区交互 ─────────────────────────────────────── */

  const onDraftChange = useCallback(
    (patch) => {
      commit((current) =>
        Object.assign({}, current, {
          draft: Object.assign({}, current.draft, patch),
          prefs: patch.depth ? Object.assign({}, current.prefs, { depth: patch.depth }) : current.prefs,
        }),
      );
    },
    [commit],
  );

  const submitInsight = useCallback(() => {
    const draft = storeRef.current.draft;
    const topic = String(draft.topic || '').trim();
    if (!topic) {
      notify('请先填写技术名称', 'error');
      return;
    }
    startInsight({ topic, focus: String(draft.focus || '').trim(), depth: draft.depth || 'standard' });
  }, [notify, startInsight]);

  const startNew = useCallback(() => {
    setError(null);
    setDialog(null);
    commit((current) => Object.assign({}, current, { selectedId: '' }));
  }, [commit]);

  const selectEntry = useCallback(
    (id) => {
      setError(null);
      setDialog(null);
      commit((current) => Object.assign({}, current, { selectedId: id }));
    },
    [commit],
  );

  const submitRefine = useCallback(
    (instruction, useWeb) => {
      if (!selectedEntry) return;
      setDialog(null);
      startRefine({ report: selectedEntry.report, instruction, useWeb });
    },
    [selectedEntry, startRefine],
  );

  /* ── 渲染 ───────────────────────────────────────────── */

  const busy = !!job;

  const renderStatusChips = () => {
    if (status.state === 'loading') {
      return [e(TiChip, { key: 'loading', tone: 'idle' }, e(TiSpinner, null), '正在检查环境')];
    }
    if (status.state === 'unknown') {
      return [
        e(
          TiChip,
          { key: 'unknown', tone: 'idle', dot: true, title: status.message || '无法获取 Host 状态' },
          '状态未知',
        ),
      ];
    }
    const modelLabel = status.modelName || status.model || '未选择模型';
    const modelTone = status.ready ? 'good' : 'warn';
    const webReady = status.webReady && status.fetchReady;
    return [
      e(
        TiChip,
        {
          key: 'model',
          tone: modelTone,
          icon: 'cpu',
          title: status.ready ? '当前 DSH 模型：' + modelLabel : status.message || '模型未就绪',
        },
        status.ready ? '模型 ' + modelLabel : '模型未就绪',
      ),
      e(
        TiChip,
        {
          key: 'web',
          tone: webReady ? 'good' : 'warn',
          icon: 'globe',
          title: webReady ? '联网检索可用' : '联网检索不可用，生成可能失败',
        },
        webReady ? '联网检索就绪' : '联网检索不可用',
      ),
    ];
  };

  const renderMain = () => {
    const viewingPending = store.selectedId === TI_PENDING_ID || !store.selectedId;
    /* 任务进行中：只有选中“生成中”条目或没有选中时才显示进度；
       用户点开其他归档报告时正常查看报告，不会被进度页卡住。 */
    if (job && viewingPending) {
      return e(TiProgressView, { job, elapsed, onCancel: cancelJob });
    }
    if (error && viewingPending) {
      return e(TiInsightError, {
        title: error.title,
        message: error.message,
        code: error.code,
        onRetry: error.retryable ? retryLast : null,
        onBack: () => setError(null),
      });
    }
    if (selectedEntry && selectedReport) {
      return e(TiReportView, {
        key: selectedReport.id,
        report: selectedReport,
        entry: selectedEntry,
        busy: busy,
        onRefine: () => setDialog({ kind: 'refine' }),
        onCopy: copyMarkdown,
        onExport: exportMarkdown,
        onDelete: () => setDialog({ kind: 'delete', entry: selectedEntry }),
        onSaveSection: saveSection,
        onSaveMeta: saveMeta,
        onRollback: rollback,
      });
    }
    if (job) {
      return e(TiProgressView, { job, elapsed, onCancel: cancelJob });
    }
    if (error) {
      return e(TiInsightError, {
        title: error.title,
        message: error.message,
        code: error.code,
        onRetry: error.retryable ? retryLast : null,
        onBack: () => setError(null),
      });
    }
    return e(TiGenerator, {
      draft: store.draft,
      disabled: busy,
      onDraftChange,
      onSubmit: submitInsight,
    });
  };

  const requestDelete = useCallback(
    (entry) => {
      if (busy) {
        notify('正在生成或修订，请先取消或等待完成后再删除', 'info');
        return;
      }
      setDialog({ kind: 'delete', entry });
    },
    [busy, notify],
  );

  const deleteDialogState =
    dialog && dialog.kind === 'delete'
      ? {
          title: '删除归档报告',
          body: '确定删除「' + (dialog.entry.report.title || '这份报告') + '」？',
          detail: '报告及其全部修订版本都会从本地归档中移除，操作不可恢复。',
          ok: '删除',
          danger: true,
          action: () => deleteEntry(dialog.entry),
        }
      : null;

  return e(
    'div',
    { className: 'ti-root' },
    e('style', null, TI_CSS),
    e(
      'div',
      { className: 'ti-inner' },
      e(
        'header',
        { className: 'ti-head' },
        e(
          'div',
          { className: 'ti-brand' },
          e('div', { className: 'ti-logo' }, e(TiIcon, { name: 'compass', size: 22, strokeWidth: 1.7 })),
          e(
            'div',
            { style: { minWidth: 0 } },
            e(
              'div',
              { className: 'ti-title-row' },
              e('h1', { className: 'ti-title' }, '技术洞察'),
              status.state === 'ok' && status.version ? e(TiChip, { tone: 'brand' }, 'v' + status.version) : null,
            ),
            e(
              'p',
              { className: 'ti-sub' },
              '联网检索 + 模型分析，一键生成技术介绍、技术方案设计、关键难点、使用场景与业界状态；自动归档，可多次修订与回滚。',
            ),
          ),
        ),
        e(
          'div',
          { className: 'ti-head-actions' },
          e('div', { className: 'ti-chips' }, renderStatusChips()),
          e(TiIconBtn, {
            icon: 'refresh',
            title: '刷新环境状态',
            disabled: status.state === 'loading',
            onClick: refreshStatus,
          }),
          e(TiBtn, { variant: 'primary', icon: 'plus', disabled: busy, onClick: startNew }, '新建洞察'),
        ),
      ),
      e(
        'div',
        { className: 'ti-body' + (railCollapsed ? ' rail-collapsed' : '') },
        railCollapsed
          ? e(TiArchiveToggle, { count: store.reports.length + (job ? 1 : 0), onExpand: toggleRail })
          : e(TiArchive, {
              entries: store.reports,
              selectedId: store.selectedId,
              query: query,
              onQueryChange: setQuery,
              onSelect: selectEntry,
              onDelete: requestDelete,
              onCollapse: toggleRail,
              pending: job
                ? {
                    kind: job.kind,
                    topic: job.topic,
                    stageLabel: job.stageLabel,
                  }
                : null,
              pendingSelected: store.selectedId === TI_PENDING_ID,
              onSelectPending: () =>
                commit((current) => Object.assign({}, current, { selectedId: TI_PENDING_ID })),
            }),
        e('main', { className: 'ti-main' }, e('div', { className: 'ti-main-inner' }, renderMain())),
      ),
    ),
    dialog && dialog.kind === 'refine' && selectedEntry
      ? e(TiRefineDialog, {
          disabled: busy,
          onClose: () => setDialog(null),
          onSubmit: submitRefine,
        })
      : null,
    e(TiConfirmDialog, { state: deleteDialogState, onClose: () => setDialog(null) }),
    e(TiToast, { toast: toast }),
  );
}
