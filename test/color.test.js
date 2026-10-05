import test from 'node:test';
import assert from 'node:assert/strict';
import { parseColor, toHex, formatColor } from '../client/color.js';

test('parses 6- and 3-digit hex', () => {
  assert.deepEqual(parseColor('#f2ece2'), { r: 242, g: 236, b: 226, a: 1 });
  assert.deepEqual(parseColor('#abc'), { r: 170, g: 187, b: 204, a: 1 });
});

test('parses 8-digit hex alpha', () => {
  assert.ok(Math.abs(parseColor('#ff000080').a - 0.5) <= 0.01);
});

test('parses rgba with commas and rgb with slash alpha', () => {
  assert.deepEqual(parseColor('rgba(58,35,24,.18)'), { r: 58, g: 35, b: 24, a: 0.18 });
  assert.equal(parseColor('rgb(242 236 226 / 50%)').a, 0.5);
});

test('parses hsl and transparent', () => {
  assert.deepEqual(parseColor('hsl(0, 100%, 50%)'), { r: 255, g: 0, b: 0, a: 1 });
  assert.equal(parseColor('transparent').a, 0);
});

test('rejects non-colors, tolerates case and whitespace', () => {
  assert.equal(parseColor('clamp(1rem,2vw,3rem)'), null);
  assert.equal(parseColor('1px'), null);
  assert.deepEqual(parseColor('  #E8501E '), { r: 232, g: 80, b: 30, a: 1 });
});

test('formats opaque as hex and translucent as rgba', () => {
  assert.equal(formatColor({ r: 232, g: 80, b: 30, a: 1 }), '#e8501e');
  assert.equal(formatColor({ r: 232, g: 80, b: 30, a: 0.456 }), 'rgba(232, 80, 30, 0.46)');
  assert.equal(toHex({ r: 1, g: 2, b: 3 }), '#010203');
});
