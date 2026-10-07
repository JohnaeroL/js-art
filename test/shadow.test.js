import test from 'node:test';
import assert from 'node:assert/strict';
import { parseShadow } from '../client/controls.js';

test('parseShadow reads the first shadow of a computed value', () => {
  assert.deepEqual(parseShadow('rgba(0, 0, 0, 0.2) 0px 4px 8px 2px'),
    { x: 0, y: 4, blur: 8, spread: 2, color: { r: 0, g: 0, b: 0, a: 0.2 }, inset: false });
  const two = parseShadow('rgb(255, 0, 0) 1px -2px 3px 0px inset, rgba(0, 0, 0, 0.5) 0px 0px 9px 0px');
  assert.equal(two.inset, true);
  assert.deepEqual([two.x, two.y, two.blur, two.color.r], [1, -2, 3, 255]);
});

test('parseShadow of "none" is a neutral shadow', () => {
  const s = parseShadow('none');
  assert.deepEqual([s.x, s.y, s.blur, s.spread, s.inset], [0, 0, 0, 0, false]);
});
