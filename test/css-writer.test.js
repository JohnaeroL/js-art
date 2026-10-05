import test from 'node:test';
import assert from 'node:assert/strict';
import { serialize, scaleValue, HEADER } from '../client/css-writer.js';

test('groups declarations by selector in first-seen order, !important except custom properties', () => {
  const css = serialize([
    { selector: 'h1', prop: 'color', value: '#000' },
    { selector: ':root', prop: '--bg', value: '#fff' },
    { selector: 'h1', prop: 'letter-spacing', value: '0.01em' },
  ]);
  assert.equal(css, 'h1 {\n  color: #000 !important;\n  letter-spacing: 0.01em !important;\n}\n\n:root {\n  --bg: #fff;\n}\n');
});

test('filter functions of one selector merge into a single filter declaration', () => {
  const css = serialize([
    { selector: 'html', prop: 'filter:contrast', value: '1.2' },
    { selector: 'html', prop: 'filter:brightness', value: '0.9' },
  ]);
  assert.equal(css.match(/filter:/g).length, 1);
  assert.ok(css.includes('filter: contrast(1.2) brightness(0.9) !important;'));
});

test('extra fields such as ui are ignored', () => {
  assert.equal(serialize([{ selector: 'p', prop: 'color', value: 'red', ui: { k: 1 } }]), 'p {\n  color: red !important;\n}\n');
});

test('empty edit list with header is just the header', () => {
  assert.equal(serialize([], { header: true }), HEADER + '\n');
  assert.equal(serialize([]), '');
  assert.ok(serialize([{ selector: 'p', prop: 'color', value: 'red' }], { header: true }).startsWith(HEADER + '\n\np {'));
});

test('scaleValue wraps the declared value in calc and drops k = 1', () => {
  assert.equal(scaleValue('clamp(3rem,10vw,9rem)', 1.2), 'calc(clamp(3rem,10vw,9rem) * 1.2)');
  assert.equal(scaleValue('16px', 1), '16px');
  assert.equal(scaleValue('1rem', 1.23456), 'calc(1rem * 1.235)');
});

test('selectors wrapped in @media are emitted inside that media block', () => {
  const css = serialize([{ selector: '@media (prefers-color-scheme:dark){:root:not([data-theme="light"])}', prop: '--bg', value: '#111' }]);
  assert.equal(css, '@media (prefers-color-scheme:dark) {\n  :root:not([data-theme="light"]) {\n    --bg: #111;\n  }\n}\n');
});
