import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseFaces, slug, ensureFamily, localizeFonts } from '../lib/fonts.js';
import { serialize } from '../client/css-writer.js';

const GOOGLE_CSS = `/* cyrillic-ext */
@font-face {
  font-family: 'Lora';
  font-weight: 400;
  src: url(https://fonts.gstatic.com/a.woff2) format('woff2');
  unicode-range: U+0460-052F;
}
/* cyrillic */
@font-face {
  font-family: 'Lora';
  font-weight: 400;
  src: url(https://fonts.gstatic.com/b.woff2) format('woff2');
  unicode-range: U+0400-045F;
}
/* latin */
@font-face {
  font-family: 'Lora';
  font-weight: 700;
  src: url(https://fonts.gstatic.com/b.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}
`;

function fakeFetch(calls) {
  return async url => {
    calls.push(url);
    if (url.includes('fonts.googleapis.com')) return { ok: true, status: 200, text: async () => GOOGLE_CSS };
    return { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode('FONT:' + url).buffer };
  };
}

test('parseFaces returns the subset of every @font-face block', () => {
  assert.deepEqual(parseFaces(GOOGLE_CSS).map(f => f.subset), ['cyrillic-ext', 'cyrillic', 'latin']);
  assert.equal(slug('Source Sans 3'), 'source-sans-3');
});

test('ensureFamily keeps latin and cyrillic, downloads a shared file once, and caches the rules', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'js-art-f-'));
  const calls = [];
  const css = await ensureFamily({ name: 'Lora', fontsDir: dir, fetchImpl: fakeFetch(calls) });
  assert.ok(!css.includes('cyrillic-ext') && css.includes('/* cyrillic */') && css.includes('/* latin */'));
  assert.equal(calls.filter(u => u.includes('gstatic')).length, 1); /* b.woff2 serves two faces */
  const files = (await fs.readdir(dir)).filter(f => f.endsWith('.woff2'));
  assert.equal(files.length, 1);
  assert.ok(css.includes(`url("${files[0]}")`));
  const again = [];
  assert.equal(await ensureFamily({ name: 'Lora', fontsDir: dir, fetchImpl: fakeFetch(again) }), css);
  assert.equal(again.length, 0);
});

test('localizeFonts swaps the Google @import for local rules with urls relative to the css', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'js-art-f-'));
  const edits = [{ selector: 'h1', prop: 'font-family', value: '"Lora", serif' }];
  const css = serialize(edits, { header: true, imports: true });
  assert.ok(css.includes('@import url("https://fonts.googleapis.com'));
  const r = await localizeFonts({ css, names: ['Lora'], fontsDir: path.join(root, 'fonts', 'js-art'), cssDir: path.join(root, 'css'), fetchImpl: fakeFetch([]) });
  assert.ok(!r.css.includes('googleapis'));
  assert.match(r.css, /url\("\.\.\/fonts\/js-art\/lora-(?:cyrillic|latin)-[0-9a-f]{8}\.woff2"\)/);
  assert.ok(r.css.indexOf('@font-face') < r.css.indexOf('h1 {'));
  assert.deepEqual(r.results, [{ name: 'Lora', ok: true }]);
});

test('a font that cannot be fetched keeps the Google @import and is reported', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'js-art-f-'));
  const css = serialize([{ selector: 'h1', prop: 'font-family', value: '"Lora", serif' }], { imports: true });
  const down = async () => ({ ok: false, status: 503 });
  const r = await localizeFonts({ css, names: ['Lora'], fontsDir: path.join(root, 'f'), cssDir: root, fetchImpl: down });
  assert.equal(r.css, css);
  assert.equal(r.results[0].ok, false);
});
