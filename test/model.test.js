import test from 'node:test';
import assert from 'node:assert/strict';
import { Model } from '../client/model.js';

test('one gesture of many sets is undone in one step', () => {
  const m = new Model(() => {});
  m.begin();
  for (let i = 0; i < 60; i++) m.set('h1', 'color', `rgb(${i},0,0)`);
  assert.equal(m.list().length, 1);
  assert.equal(m.undo(), true);
  assert.deepEqual(m.list(), []);
});

test('redo restores the value; a new begin clears redo', () => {
  const m = new Model(() => {});
  m.begin(); m.set('h1', 'color', 'red', { c: 1 });
  m.undo();
  assert.equal(m.canRedo, true);
  m.redo();
  assert.deepEqual(m.get('h1', 'color'), { selector: 'h1', prop: 'color', value: 'red', ui: { c: 1 } });
  m.undo();
  m.begin(); m.set('p', 'color', 'blue');
  assert.equal(m.canRedo, false);
});

test('undo history is capped at 100 steps', () => {
  const m = new Model(() => {});
  for (let i = 0; i < 105; i++) { m.begin(); m.set('h1', 'color', String(i)); }
  let n = 0;
  while (m.undo()) n++;
  assert.equal(n, 100);
});

test('set null removes; list keeps insertion order', () => {
  const m = new Model(() => {});
  m.set('a', 'x', '1'); m.set('b', 'x', '2'); m.set('a', 'y', '3');
  m.set('b', 'x', null);
  assert.deepEqual(m.list().map(e => e.selector + e.prop), ['ax', 'ay']);
});

test('reset with a filter keeps other edits and is undoable', () => {
  const m = new Model(() => {});
  m.set('h1', 'color', 'red'); m.set('p', 'color', 'blue');
  m.reset(e => e.selector === 'h1');
  assert.deepEqual(m.list().map(e => e.selector), ['p']);
  m.undo();
  assert.equal(m.get('h1', 'color').value, 'red');
});

test('onChange fires on set, undo, redo, reset and load', () => {
  let calls = 0;
  const m = new Model(edits => { calls++; assert.ok(Array.isArray(edits)); });
  m.begin(); m.set('h1', 'color', 'red');
  m.undo(); m.redo(); m.reset(); m.load([{ selector: 'p', prop: 'color', value: 'blue' }]);
  assert.equal(calls, 5);
  assert.equal(m.canUndo, true); /* reset pushed a step; load does not touch history */
});
