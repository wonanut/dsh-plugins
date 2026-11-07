/* ─────────────────────────────────────────────────────────────
 * Agent 实验室 · 80-source.js — 源码浏览器
 *
 * 数据来自构建时注入的全局 SOURCES：
 *   [{ id, name, role, code }]
 * 左侧文件列表（名称 + 角色），右侧代码区（行号 / 等宽 / 横向滚动 /
 * 一键复制 / 轻量语法高亮）。高亮只负责“上色”，渲染文本与原始源码
 * 完全一致；复制永远复制原始 code。
 *
 * 组件由 90-page.js 直接调用：
 *   function SourcePage(props)
 * 可选 props：
 *   sources  覆盖 SOURCES（仅调试/测试用）
 *   initialId 初始选中的文件 id
 *
 * 约束：普通 JS，无 import/export/JSX；React / e / hooks 由外层提供。
 * 所有 class 使用 al-src- 前缀；颜色优先使用 --dsw-alias-* token。
 * ───────────────────────────────────────────────────────────── */

const SRC_CSS = `
.al-src-page {
  --al-src-bg: var(--dsw-alias-bg-base, #ffffff);
  --al-src-panel: var(--dsw-alias-bg-layer-1, #ffffff);
  --al-src-panel-2: var(--dsw-alias-bg-layer-2, #f6f7f9);
  --al-src-panel-3: var(--dsw-alias-bg-layer-3, #eceff3);
  --al-src-text: var(--dsw-alias-label-primary, #171a21);
  --al-src-sub: var(--dsw-alias-label-secondary, #5b6472);
  --al-src-ter: var(--dsw-alias-label-tertiary, #8b93a1);
  --al-src-border: var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.1));
  --al-src-border-2: var(--dsw-alias-border-l2, rgba(15, 23, 42, 0.18));
  --al-src-brand: var(--dsw-alias-brand-primary, #4d6bfe);
  --al-src-tint: color-mix(in srgb, var(--al-src-brand) 11%, transparent);
  --al-src-brand-text: color-mix(in srgb, var(--al-src-brand) 76%, var(--al-src-text));
  --al-src-code-bg: var(--al-src-panel-2);
  --al-src-gutter-bg: var(--al-src-panel-3);
  --al-src-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --al-src-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  --al-src-tok-comment: var(--al-src-ter);
  --al-src-tok-string: color-mix(in srgb, #1a7f37 55%, var(--al-src-text));
  --al-src-tok-template: color-mix(in srgb, #116329 48%, var(--al-src-text));
  --al-src-tok-keyword: color-mix(in srgb, #8250df 55%, var(--al-src-text));
  --al-src-tok-number: color-mix(in srgb, #bc4c00 55%, var(--al-src-text));
  --al-src-tok-builtin: color-mix(in srgb, #0969da 48%, var(--al-src-text));
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 4px 4px 12px;
  color: var(--al-src-text);
  font-family: var(--al-src-sans);
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
.al-src-page * { box-sizing: border-box; }

/* ── 头部 ── */
.al-src-head { flex: none; padding: 14px 2px 2px; }
.al-src-eyebrow { font-family: var(--al-src-mono); font-size: 11px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--al-src-ter); }
.al-src-title { margin: 8px 0 10px; color: var(--al-src-text); font-size: clamp(21px, 2.6vw, 28px); line-height: 1.28; font-weight: 700; letter-spacing: -0.01em; }
.al-src-lead { margin: 0; max-width: 84ch; color: var(--al-src-sub); font-size: 13.5px; line-height: 1.8; }
.al-src-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 13px; }
.al-src-chip { display: inline-flex; align-items: center; gap: 7px; padding: 3px 10px; border: 1px solid var(--al-src-border); border-radius: 999px; background: var(--al-src-panel-2); color: var(--al-src-sub); font-size: 12px; line-height: 1.6; }
.al-src-chip-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--al-src-brand); opacity: 0.85; }

/* ── 主体：文件列表 + 代码区 ── */
.al-src-work { flex: 1 1 auto; display: grid; grid-template-columns: 268px minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); gap: 12px; min-height: 0; }
.al-src-side { display: flex; flex-direction: column; min-height: 0; overflow: hidden; border: 1px solid var(--al-src-border); border-radius: 12px; background: var(--al-src-panel); }
.al-src-side-head { flex: none; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--al-src-border); background: var(--al-src-panel-2); }
.al-src-side-title { color: var(--al-src-sub); font-size: 11.5px; font-weight: 600; letter-spacing: 0.04em; }
.al-src-side-count { color: var(--al-src-ter); font-family: var(--al-src-mono); font-size: 10.5px; }
.al-src-files { flex: 1 1 auto; min-height: 120px; overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 2px; }
.al-src-file { appearance: none; display: flex; flex-direction: column; gap: 2px; width: 100%; padding: 7px 9px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: var(--al-src-sub); font: inherit; text-align: left; cursor: pointer; }
.al-src-file:hover { background: var(--al-src-panel-2); }
.al-src-file.is-active { border-color: color-mix(in srgb, var(--al-src-brand) 26%, transparent); background: var(--al-src-tint); }
.al-src-file:focus-visible { outline: 2px solid var(--al-src-brand); outline-offset: 1px; }
.al-src-file-top { display: flex; align-items: center; gap: 7px; }
.al-src-file-no { flex: none; width: 18px; color: var(--al-src-ter); font-family: var(--al-src-mono); font-size: 10px; }
.al-src-file-name { color: var(--al-src-text); font-family: var(--al-src-mono); font-size: 12px; font-weight: 600; word-break: break-all; }
.al-src-file.is-active .al-src-file-name { color: var(--al-src-brand-text); }
.al-src-file-role { padding-left: 25px; color: var(--al-src-ter); font-size: 11px; line-height: 1.5; }
.al-src-file-meta { padding-left: 25px; color: var(--al-src-ter); font-family: var(--al-src-mono); font-size: 10px; }

.al-src-main { display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: hidden; border: 1px solid var(--al-src-border); border-radius: 12px; background: var(--al-src-panel); }
.al-src-toolbar { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; padding: 9px 12px; border-bottom: 1px solid var(--al-src-border); background: var(--al-src-panel-2); }
.al-src-toolbar-name { color: var(--al-src-text); font-family: var(--al-src-mono); font-size: 12px; font-weight: 600; }
.al-src-toolbar-role { color: var(--al-src-ter); font-size: 11.5px; }
.al-src-toolbar-spacer { flex: 1 1 auto; }
.al-src-meta { color: var(--al-src-ter); font-family: var(--al-src-mono); font-size: 10.5px; white-space: nowrap; }
.al-src-copy { appearance: none; display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border: 1px solid var(--al-src-border-2); border-radius: 7px; background: var(--al-src-panel); color: var(--al-src-sub); font: inherit; font-size: 11.5px; cursor: pointer; white-space: nowrap; }
.al-src-copy:hover { border-color: var(--al-src-brand); color: var(--al-src-text); }
.al-src-copy:focus-visible { outline: 2px solid var(--al-src-brand); outline-offset: 1px; }
.al-src-copy.is-done { border-color: color-mix(in srgb, #2da44e 45%, var(--al-src-border)); color: var(--al-src-tok-string); }
.al-src-copy.is-fail { border-color: color-mix(in srgb, #f85149 45%, var(--al-src-border)); color: color-mix(in srgb, #f85149 70%, var(--al-src-text)); }
.al-src-copy-glyph { font-family: var(--al-src-mono); font-size: 12px; line-height: 1; }

/* ── 代码区 ── */
.al-src-scroll { flex: 1 1 auto; min-height: 240px; max-height: min(72vh, 900px); overflow: auto; background: var(--al-src-code-bg); }
.al-src-body { display: flex; align-items: flex-start; min-width: max-content; }
.al-src-gutter { position: sticky; left: 0; z-index: 2; flex: none; padding: 12px 10px 12px 12px; border-right: 1px solid var(--al-src-border); background: var(--al-src-gutter-bg); user-select: none; }
.al-src-ln { height: 20px; min-width: 2.8em; color: var(--al-src-ter); font-family: var(--al-src-mono); font-size: 12px; line-height: 20px; text-align: right; font-variant-numeric: tabular-nums; }
.al-src-pre { flex: none; margin: 0; padding: 12px 18px 12px 14px; color: var(--al-src-text); font-family: var(--al-src-mono); font-size: 12px; line-height: 20px; tab-size: 2; }
.al-src-line { height: 20px; line-height: 20px; white-space: pre; }
.al-src-tok-comment { color: var(--al-src-tok-comment); font-style: italic; }
.al-src-tok-string { color: var(--al-src-tok-string); }
.al-src-tok-template { color: var(--al-src-tok-template); }
.al-src-tok-keyword { color: var(--al-src-tok-keyword); font-weight: 600; }
.al-src-tok-number { color: var(--al-src-tok-number); }
.al-src-tok-builtin { color: var(--al-src-tok-builtin); }
.al-src-tok-plain { color: var(--al-src-text); }

/* ── 空状态 / 页脚 ── */
.al-src-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 240px; padding: 40px 24px; color: var(--al-src-sub); text-align: center; font-size: 12.5px; line-height: 1.75; }
.al-src-empty-title { color: var(--al-src-text); font-size: 13.5px; font-weight: 650; }
.al-src-empty-code { padding: 2px 6px; border: 1px solid var(--al-src-border); border-radius: 5px; background: var(--al-src-panel-2); color: var(--al-src-text); font-family: var(--al-src-mono); font-size: 11.5px; }
.al-src-hint { flex: none; margin: 0; padding: 0 2px; color: var(--al-src-ter); font-size: 11.5px; line-height: 1.6; }

/* ── 响应式 ── */
@media (max-width: 880px) {
  .al-src-work { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); }
  .al-src-side { max-height: 200px; }
  .al-src-scroll { max-height: min(64vh, 720px); }
}
@media (max-width: 560px) {
  .al-src-title { font-size: 20px; }
  .al-src-page { gap: 10px; }
}
@media (prefers-reduced-motion: reduce) {
  .al-src-page * { transition: none !important; }
}
`;

/* ── 语法高亮：轻量 tokenizer ────────────────────────────────
 * 只识别 注释 / 字符串 / 模板字符串 / 关键字 / 内置对象 / 数字。
 * 关键约束：所有 token 首尾相接覆盖整个源码，渲染出去的文本与原始
 * 源码逐字符一致；跨行块注释与多行模板字符串按 '\n' 切开后逐行上色。
 */

const SRC_KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
  'do', 'switch', 'case', 'break', 'continue', 'new', 'typeof', 'instanceof',
  'this', 'class', 'extends', 'super', 'async', 'await', 'try', 'catch',
  'finally', 'throw', 'delete', 'in', 'of', 'void', 'yield', 'static',
  'import', 'export', 'from', 'default', 'null', 'undefined', 'true', 'false',
]);

const SRC_BUILTINS = new Set([
  'React', 'JSON', 'Math', 'Object', 'Array', 'String', 'Number', 'Boolean',
  'Promise', 'Set', 'Map', 'Symbol', 'Date', 'Error', 'console', 'globalThis',
  'window', 'document', 'navigator', 'localStorage', 'parseInt', 'parseFloat',
  'isNaN', 'setTimeout', 'clearTimeout', 'requestAnimationFrame',
]);

function sourceIsDigit(ch) {
  return ch >= '0' && ch <= '9';
}

function sourceIsIdentStart(ch) {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$';
}

function sourceIsIdentPart(ch) {
  return sourceIsIdentStart(ch) || sourceIsDigit(ch);
}

function sourceTokenize(code) {
  const tokens = [];
  const length = code.length;
  let index = 0;

  while (index < length) {
    const ch = code[index];
    const next = code[index + 1];

    // 块注释：可能跨行
    if (ch === '/' && next === '*') {
      const closing = code.indexOf('*/', index + 2);
      const end = closing < 0 ? length : closing + 2;
      tokens.push({ type: 'comment', text: code.slice(index, end) });
      index = end;
      continue;
    }

    // 行注释
    if (ch === '/' && next === '/') {
      const closing = code.indexOf('\n', index + 2);
      const end = closing < 0 ? length : closing;
      tokens.push({ type: 'comment', text: code.slice(index, end) });
      index = end;
      continue;
    }

    // 单/双引号字符串（不允许跨行；未闭合时到行尾为止）
    if (ch === '"' || ch === "'") {
      let cursor = index + 1;
      while (cursor < length) {
        const current = code[cursor];
        if (current === '\\') {
          cursor += 2;
          continue;
        }
        if (current === '\n') break;
        if (current === ch) {
          cursor += 1;
          break;
        }
        cursor += 1;
      }
      if (cursor > length) cursor = length;
      tokens.push({ type: 'string', text: code.slice(index, cursor) });
      index = cursor;
      continue;
    }

    // 模板字符串：允许跨行，跳过 ${...} 内部直到配对，转义字符整体跳过
    if (ch === '`') {
      let cursor = index + 1;
      let depth = 0;
      while (cursor < length) {
        const current = code[cursor];
        if (current === '\\') {
          cursor += 2;
          continue;
        }
        if (current === '`' && depth === 0) {
          cursor += 1;
          break;
        }
        if (current === '$' && code[cursor + 1] === '{') {
          depth += 1;
          cursor += 2;
          continue;
        }
        if (current === '{' && depth > 0) {
          depth += 1;
          cursor += 1;
          continue;
        }
        if (current === '}' && depth > 0) {
          depth -= 1;
          cursor += 1;
          continue;
        }
        cursor += 1;
      }
      if (cursor > length) cursor = length;
      tokens.push({ type: 'template', text: code.slice(index, cursor) });
      index = cursor;
      continue;
    }

    // 数字：十进制 / 十六进制 / 二进制 / 八进制 / 小数 / 指数
    if (sourceIsDigit(ch)) {
      let cursor = index + 1;
      if (ch === '0' && (code[index + 1] === 'x' || code[index + 1] === 'X')) {
        cursor = index + 2;
        while (cursor < length && /[0-9a-fA-F_]/.test(code[cursor])) cursor += 1;
      } else if (ch === '0' && (code[index + 1] === 'b' || code[index + 1] === 'B')) {
        cursor = index + 2;
        while (cursor < length && (code[cursor] === '0' || code[cursor] === '1' || code[cursor] === '_')) cursor += 1;
      } else if (ch === '0' && (code[index + 1] === 'o' || code[index + 1] === 'O')) {
        cursor = index + 2;
        while (cursor < length && /[0-7_]/.test(code[cursor])) cursor += 1;
      } else {
        while (cursor < length && (sourceIsDigit(code[cursor]) || code[cursor] === '_')) cursor += 1;
        if (code[cursor] === '.') {
          cursor += 1;
          while (cursor < length && (sourceIsDigit(code[cursor]) || code[cursor] === '_')) cursor += 1;
        }
        if (code[cursor] === 'e' || code[cursor] === 'E') {
          cursor += 1;
          if (code[cursor] === '+' || code[cursor] === '-') cursor += 1;
          while (cursor < length && sourceIsDigit(code[cursor])) cursor += 1;
        }
      }
      tokens.push({ type: 'number', text: code.slice(index, cursor) });
      index = cursor;
      continue;
    }

    // 标识符 / 关键字
    if (sourceIsIdentStart(ch)) {
      let cursor = index + 1;
      while (cursor < length && sourceIsIdentPart(code[cursor])) cursor += 1;
      const word = code.slice(index, cursor);
      const type = SRC_KEYWORDS.has(word) ? 'keyword' : (SRC_BUILTINS.has(word) ? 'builtin' : 'plain');
      tokens.push({ type: type, text: word });
      index = cursor;
      continue;
    }

    // 其余字符：成段累积，避免产生太多单字符 span
    let cursor = index + 1;
    while (cursor < length) {
      const current = code[cursor];
      if (current === '/' && (code[cursor + 1] === '*' || code[cursor + 1] === '/')) break;
      if (current === '"' || current === "'" || current === '`') break;
      if (sourceIsDigit(current) || sourceIsIdentStart(current)) break;
      cursor += 1;
    }
    tokens.push({ type: 'plain', text: code.slice(index, cursor) });
    index = cursor;
  }

  return tokens;
}

/** 把 token 流按换行切成“行 → token 片段”，供逐行渲染。 */
function sourceHighlightLines(code) {
  const tokens = sourceTokenize(code);
  const lines = [[]];

  for (let t = 0; t < tokens.length; t += 1) {
    const token = tokens[t];
    const parts = token.text.split('\n');
    for (let p = 0; p < parts.length; p += 1) {
      if (p > 0) lines.push([]);
      if (parts[p].length > 0) {
        lines[lines.length - 1].push({ type: token.type, text: parts[p] });
      }
    }
  }

  // 源码以换行结尾时，最后会多出一个空行：展示层去掉它，行号更自然
  if (lines.length > 1 && lines[lines.length - 1].length === 0) {
    lines.pop();
  }

  return lines;
}

/* ── 小工具 ─────────────────────────────────────────────── */

function sourceFormatBytes(size) {
  const bytes = Number(size) || 0;
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function sourceLineCount(text) {
  const value = String(text || '');
  if (value.length === 0) return 1;
  return value.split('\n').length;
}

function sourcePad2(value) {
  return value < 10 ? '0' + value : String(value);
}

function sourceChip(props) {
  return e('span', { className: 'al-src-chip' },
    e('span', { className: 'al-src-chip-dot' }),
    props.children
  );
}

/* ── 文件列表 ───────────────────────────────────────────── */

function SourceFileList(props) {
  const list = props.list || [];
  const activeIndex = props.activeIndex;
  const onSelect = props.onSelect;

  if (list.length === 0) {
    return e('aside', { className: 'al-src-side' },
      e('div', { className: 'al-src-side-head' },
        e('span', { className: 'al-src-side-title' }, '源文件'),
        e('span', { className: 'al-src-side-count' }, '0 个')
      ),
      e('div', { className: 'al-src-files' })
    );
  }

  return e('aside', { className: 'al-src-side' },
    e('div', { className: 'al-src-side-head' },
      e('span', { className: 'al-src-side-title' }, '源文件'),
      e('span', { className: 'al-src-side-count' }, list.length + ' 个 · 构建快照')
    ),
    e('div', { className: 'al-src-files' }, list.map(function (item, index) {
      const active = index === activeIndex;
      const name = (item && item.name) || (item && item.id) || 'unknown.js';
      const code = (item && item.code) || '';
      return e('button', {
        key: (item && item.id) || index,
        type: 'button',
        className: 'al-src-file' + (active ? ' is-active' : ''),
        'aria-current': active ? 'true' : undefined,
        title: (item && item.role) || name,
        onClick: function () { onSelect(index); },
      },
        e('span', { className: 'al-src-file-top' },
          e('span', { className: 'al-src-file-no' }, sourcePad2(index + 1)),
          e('span', { className: 'al-src-file-name' }, name)
        ),
        item && item.role ? e('span', { className: 'al-src-file-role' }, item.role) : null,
        e('span', { className: 'al-src-file-meta' },
          sourceLineCount(code) + ' 行 · ' + sourceFormatBytes(code.length)
        )
      );
    }))
  );
}

/* ── 代码区 ─────────────────────────────────────────────── */

function SourceCodeBody(props) {
  const lines = props.lines || [];

  return e('div', { className: 'al-src-body' },
    e('div', { className: 'al-src-gutter', 'aria-hidden': 'true' },
      lines.map(function (_, index) {
        return e('div', { key: index, className: 'al-src-ln' }, String(index + 1));
      })
    ),
    e('div', { className: 'al-src-pre' },
      lines.map(function (tokens, lineIndex) {
        const children = tokens.length === 0
          ? '\u00a0'
          : tokens.map(function (token, tokenIndex) {
            return e('span', {
              key: tokenIndex,
              className: 'al-src-tok al-src-tok-' + token.type,
            }, token.text);
          });
        return e('div', { key: lineIndex, className: 'al-src-line' }, children);
      })
    )
  );
}

/* ── 页面组件 ───────────────────────────────────────────── */

function SourcePage(props) {
  const options = props || {};
  const injected = typeof SOURCES !== 'undefined' && Array.isArray(SOURCES) ? SOURCES : [];
  const list = Array.isArray(options.sources) ? options.sources : injected;
  const hasSources = list.length > 0;

  const [activeIndex, setActiveIndex] = useState(function () {
    const preferred = options.initialId;
    if (preferred != null) {
      for (let i = 0; i < list.length; i += 1) {
        if (list[i] && list[i].id === preferred) return i;
      }
    }
    return 0;
  });

  const [copyState, setCopyState] = useState('');
  const copyTimer = useRef(null);

  useEffect(function () {
    return function () {
      if (copyTimer.current) {
        clearTimeout(copyTimer.current);
        copyTimer.current = null;
      }
    };
  }, []);

  const active = list[activeIndex] || list[0] || null;
  const code = active ? String(active.code || '') : '';
  const lineCount = code.length === 0 ? 0 : sourceLineCount(code);

  const lines = useMemo(function () {
    return code.length === 0 ? [] : sourceHighlightLines(code);
  }, [code]);

  const totals = useMemo(function () {
    let bytes = 0;
    let linesCount = 0;
    list.forEach(function (item) {
      const text = String((item && item.code) || '');
      bytes += text.length;
      linesCount += sourceLineCount(text);
    });
    return { files: list.length, bytes: bytes, lines: linesCount };
  }, [list]);

  const totalBytes = code.length;

  const copyCode = useCallback(function () {
    if (!code) return;
    const write = function () {
      try {
        const nav = typeof globalThis !== 'undefined' ? globalThis.navigator : null;
        if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
          return nav.clipboard.writeText(code).then(function () { return true; }).catch(function () { return false; });
        }
      } catch (error) {
        /* 剪贴板不可用：走失败态提示，绝不抛错影响页面 */
      }
      return Promise.resolve(false);
    };
    write().then(function (ok) {
      setCopyState(ok ? 'done' : 'fail');
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(function () { setCopyState(''); }, 1800);
    });
  }, [code]);

  function handleSelect(index) {
    setActiveIndex(index);
    setCopyState('');
  }

  return e('div', { className: 'al-src-page' },
    e('style', { dangerouslySetInnerHTML: { __html: SRC_CSS } }),

    e('header', { className: 'al-src-head' },
      e('div', { className: 'al-src-eyebrow' }, 'AGENT LAB · 源码'),
      e('h1', { className: 'al-src-title' }, '这就是当前页面正在运行的代码'),
      e('p', { className: 'al-src-lead' },
        '构建时 build.mjs 把 src/*.js 的内容作为 JSON 字符串注入 SOURCES；DSH 加载的 client.js、你在「体验」和「原理」页看到的界面，全部由下面这些文件生成。左边选文件，右边读代码 —— 没有隐藏，也没有压缩混淆。'
      ),
      e('div', { className: 'al-src-chips' },
        sourceChip({ children: (hasSources ? totals.files : 0) + ' 个源文件' }),
        sourceChip({ children: sourceFormatBytes(hasSources ? totals.bytes : 0) }),
        sourceChip({ children: '纯 JavaScript · 无外部依赖' }),
        sourceChip({ children: '构建快照 · 与 client.js 一致' })
      )
    ),

    e('div', { className: 'al-src-work' },
      e(SourceFileList, {
        list: list,
        activeIndex: list.indexOf(active),
        onSelect: handleSelect,
      }),

      e('section', { className: 'al-src-main' },
        e('div', { className: 'al-src-toolbar' },
          e('span', { className: 'al-src-toolbar-name' }, active ? ((active.name || active.id) || 'unknown.js') : '无文件'),
          active && active.role ? e('span', { className: 'al-src-toolbar-role' }, active.role) : null,
          e('span', { className: 'al-src-toolbar-spacer' }),
          active ? e('span', { className: 'al-src-meta' },
            lineCount + ' 行 · ' + sourceFormatBytes(totalBytes)
          ) : null,
          active ? e('button', {
            type: 'button',
            className: 'al-src-copy' + (copyState === 'done' ? ' is-done' : copyState === 'fail' ? ' is-fail' : ''),
            title: '复制当前文件的全部源码',
            onClick: copyCode,
          },
            e('span', { className: 'al-src-copy-glyph' }, copyState === 'done' ? '✓' : copyState === 'fail' ? '!' : '⧉'),
            e('span', null, copyState === 'done' ? '已复制' : copyState === 'fail' ? '复制失败' : '复制源码')
          ) : null
        ),

        e('div', { className: 'al-src-scroll' },
          active
            ? e(SourceCodeBody, { lines: lines })
            : e('div', { className: 'al-src-empty' },
              e('span', { className: 'al-src-empty-title' }, '没有检测到内嵌源码'),
              e('span', null,
                '全局 SOURCES 没有被注入或为空。这通常意味着直接打开了 src 里的源文件，而不是构建后的 client.js。'
              ),
              e('span', null,
                '运行 ',
                e('code', { className: 'al-src-empty-code' }, 'node build.mjs'),
                ' 重新构建，然后刷新页面即可。'
              )
            )
        )
      )
    ),

    e('p', { className: 'al-src-hint' },
      'SOURCES 是构建时快照：修改 src 里的文件后需要重新运行 node build.mjs，本页才会显示新代码。语法高亮是插件内自写的轻量 tokenizer（注释 / 字符串 / 模板字符串 / 关键字 / 数字），复制按钮复制的始终是原始源码。'
    )
  );
}
