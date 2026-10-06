import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTextEdits, findText } from '../lib/text.js';

const E = (from, to, index = 0, total = 1) => ({ from, to, index, total });

test('replaces a leaf text, keeping the surrounding whitespace', () => {
  const { html, results } = applyTextEdits('<h1>\n  Hello  world\n</h1>', [E('Hello world', 'Привет')]);
  assert.equal(html, '<h1>\n  Привет\n</h1>');
  assert.deepEqual(results, [{ ok: true }]);
});

test('matches entities in the source and escapes the new text', () => {
  const { html } = applyTextEdits('<p>Tom &amp; Jerry&nbsp;now</p>', [E('Tom & Jerry now', 'a < b & c')]);
  assert.equal(html, '<p>a &lt; b &amp; c</p>');
});

test('the index picks one of several identical texts, total must agree', () => {
  const src = '<a>More</a><a>More</a><a>More</a>';
  assert.equal(applyTextEdits(src, [E('More', 'X', 1, 3)]).html, '<a>More</a><a>X</a><a>More</a>');
  const bad = applyTextEdits(src, [E('More', 'X', 1, 2)]);
  assert.equal(bad.html, src);
  assert.equal(bad.results[0].ok, false);
});

test('text that is missing or mixed with tags is not touched', () => {
  const src = '<p>Hello <b>world</b></p>';
  assert.equal(findText(src, 'Hello').length, 0);
  assert.equal(applyTextEdits(src, [E('Nope', 'x')]).results[0].ok, false);
});

test('several edits are applied together from the original positions', () => {
  const { html, results } = applyTextEdits('<h1>One</h1><p>Two</p>', [E('One', 'Первый и длинный'), E('Two', '2')]);
  assert.equal(html, '<h1>Первый и длинный</h1><p>2</p>');
  assert.ok(results.every(r => r.ok));
});

test('regex characters in the text are literal', () => {
  assert.equal(applyTextEdits('<p>1+1=(2)?</p>', [E('1+1=(2)?', 'ok')]).html, '<p>ok</p>');
});
