import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { insertLink, backupName, save } from '../lib/save.js';

const HTML = '<!doctype html>\n<html><head>\n<link rel="preload" href="f.woff2" as="font">\n<link rel="stylesheet" href="css/style.css?v=1">\n</head><body></body></html>\n';

test('insertLink adds the marker link right after the last stylesheet, once', () => {
  const a = insertLink(HTML, 'css/js-art.css');
  assert.equal(a.changed, true);
  assert.ok(a.html.includes('<link rel="stylesheet" href="css/style.css?v=1"><!-- js-art --><link rel="stylesheet" href="css/js-art.css" data-js-art>'));
  const b = insertLink(a.html, 'css/js-art.css');
  assert.equal(b.changed, false);
  assert.equal(b.html, a.html);
});

test('insertLink falls back to before </head>', () => {
  const { html } = insertLink('<html><head><title>x</title></head><body></body></html>', 'a.css');
  assert.ok(html.includes('<!-- js-art --><link rel="stylesheet" href="a.css" data-js-art></head>'));
});

test('backupName is a zero-padded local timestamp', () => {
  assert.equal(backupName(new Date(2026, 9, 6, 9, 5, 3)), '2026-10-06_09-05-03.css');
});

test('save writes css and state, backs up, and links html only once', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'js-art-'));
  const root = path.join(tmp, 'site'), toolDir = path.join(tmp, 'tool');
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(path.join(root, 'index.html'), HTML);
  const opts = { root, out: 'css/js-art.css', toolDir };

  const r1 = await save({ ...opts, css: 'h1 {}\n', state: { v: 1 }, now: new Date(2026, 0, 1, 0, 0, 1) });
  assert.equal(r1.backup, null);
  assert.deepEqual(r1.linked, ['index.html']);
  assert.equal(await fs.readFile(path.join(root, 'css/js-art.css'), 'utf8'), 'h1 {}\n');

  const r2 = await save({ ...opts, css: 'p {}\n', state: { v: 2 }, now: new Date(2026, 0, 1, 0, 0, 2) });
  assert.deepEqual(r2.linked, []);
  assert.equal(await fs.readFile(r2.backup, 'utf8'), 'h1 {}\n');
  assert.equal(path.basename(r2.backup), '2026-01-01_00-00-02.css');
  assert.deepEqual(JSON.parse(await fs.readFile(r2.backup.replace(/\.css$/, '.json'), 'utf8')), { v: 1 });
  const html = await fs.readFile(path.join(root, 'index.html'), 'utf8');
  assert.equal(html.split('<!-- js-art -->').length, 2);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(toolDir, 'state.json'), 'utf8')), { v: 2 });
  await fs.rm(tmp, { recursive: true, force: true });
});

test('save writes edited texts into the page HTML and backs the page up; failures are reported', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'js-art-'));
  const root = path.join(tmp, 'site'), toolDir = path.join(tmp, 'tool');
  await fs.mkdir(root, { recursive: true });
  const page = path.join(root, 'index.html');
  await fs.writeFile(page, '<html><head></head><body><h1>Hello</h1><p>Same</p><p>Same</p></body></html>');
  const texts = [
    { from: 'Hello', to: 'Привет', index: 0, total: 1 },
    { from: 'Same', to: 'X', index: 1, total: 3 },
  ];
  const r = await save({ root, out: 'css/js-art.css', toolDir, css: '', state: {}, texts, pageFile: page, now: new Date(2026, 0, 1, 0, 0, 1) });
  assert.deepEqual(r.texts.map(t => t.ok), [true, false]);
  const html = await fs.readFile(page, 'utf8');
  assert.ok(html.includes('<h1>Привет</h1>') && html.includes('<p>Same</p><p>Same</p>'));
  assert.ok((await fs.readdir(path.join(toolDir, 'history'))).some(n => n.endsWith('_index.html')));
});
