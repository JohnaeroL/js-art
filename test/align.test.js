import test from 'node:test';
import assert from 'node:assert/strict';
import { selfEdits, selfKeys, spot } from '../client/align.js';

const obj = e => Object.fromEntries(e);

test('grid items use justify-self / align-self', () => {
  assert.deepEqual(selfEdits('grid', 'x', 'center'), [['justify-self', 'center']]);
  assert.deepEqual(selfEdits('grid', 'y', 'end'), [['align-self', 'end']]);
});

test('flex: the cross axis is align-self, the main axis is auto margins', () => {
  assert.deepEqual(selfEdits('flex-row', 'y', 'center'), [['align-self', 'center']]);
  assert.deepEqual(obj(selfEdits('flex-row', 'x', 'end')), { 'margin-inline-start': 'auto', 'margin-inline-end': '0px' });
  assert.deepEqual(selfEdits('flex-col', 'x', 'start'), [['align-self', 'start']]);
  assert.deepEqual(obj(selfEdits('flex-col', 'y', 'center')), { 'margin-block-start': 'auto', 'margin-block-end': 'auto' });
});

test('block flow: auto margins, shrink-to-content only when needed, display:block for inline elements', () => {
  const plain = obj(selfEdits('block', 'x', 'center'));
  assert.deepEqual(plain, { 'margin-inline-start': 'auto', 'margin-inline-end': 'auto', display: null, 'max-width': null });
  assert.equal(obj(selfEdits('block', 'x', 'center', { fills: true }))['max-width'], 'fit-content');
  assert.equal(obj(selfEdits('block', 'x', 'center', { fills: true, replaced: true }))['max-width'], null);
  assert.equal(obj(selfEdits('block', 'x', 'end', { inlineLevel: true })).display, 'block');
  assert.equal(obj(selfEdits('block', 'x', 'start', { inlineLevel: true, fills: true })).display, null);
});

test('selfKeys lists everything a position may write, so ↺ and a switch can clear it', () => {
  assert.deepEqual(selfKeys('grid', 'x'), ['justify-self']);
  assert.deepEqual(selfKeys('block', 'x').sort(), ['display', 'margin-inline-end', 'margin-inline-start', 'max-width']);
});

test('spot reads the position from the gaps', () => {
  assert.equal(spot(0, 0), 'start');
  assert.equal(spot(100, 100), 'center');
  assert.equal(spot(0, 300), 'start');
  assert.equal(spot(300, 0), 'end');
  assert.equal(spot(1, 2), 'start');
});
