/**
 * Builds client.js from src/*.js.
 *
 * The Web Client loads one plain-JS module per plugin: a lazy factory registered
 * on window.__ModuleLoader__. The numbered sources are concatenated in file
 * order into that factory; later files see earlier declarations.
 *
 * Usage:
 *   node build.mjs            → writes client.js and syntax-checks it
 *   node build.mjs --check    → syntax-check only, does not write
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

/** Build order matters: later files see earlier declarations in one scope. */
const FILES = [
  '00-core.js',
  '10-ui.js',
  '20-generate.js',
  '25-visuals.js',
  '30-report.js',
  '40-archive.js',
  '50-page.js',
  '90-apply.js',
];

const missing = FILES.filter((file) => !fs.existsSync(path.join(root, 'src', file)));
if (missing.length > 0) {
  console.error('[build] missing source files:', missing.join(', '));
  process.exit(1);
}

const body = FILES
  .map((file) => `/* ── ${file} ── */\n${fs.readFileSync(path.join(root, 'src', file), 'utf8')}`)
  .join('\n\n');

const output = `/* Generated from src/*.js by build.mjs — do not edit by hand. */
window.__ModuleLoader__.load({
  id: '@local/dsh-tech-insight',
  factory(require) {
    const React = require('react');
    const e = React.createElement;
    const { useState, useEffect, useMemo, useRef, useCallback } = React;

${body}

    return { inject: ['slots'], apply };
  },
});
`;

if (process.argv.includes('--check')) {
  new vm.Script(output, { filename: 'client.js' });
  console.log('[build] syntax OK,', output.length, 'bytes (not written)');
  process.exit(0);
}

const target = path.join(root, 'client.js');
fs.writeFileSync(target, output);
new vm.Script(output, { filename: target });
console.log(`[build] wrote ${target} (${output.length} bytes, ${FILES.length} sources)`);
