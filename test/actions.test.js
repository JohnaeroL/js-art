import test from 'node:test';
import assert from 'node:assert/strict';
import { same, planApply, planReset, shortcut, saveOutcome } from '../client/actions.js';

const px = (prop, lock = 'padding') => ({
  kind: 'range', step: 1, lock, selector: '.box', prop,
  keys: [{ selector: '.box', prop }],
  edits: v => [{ selector: '.box', prop, value: `${v}px` }],
});

test('same compares ranges by half a step and colours by their CSS form', () => {
  assert.equal(same({ kind: 'range', step: 0.01 }, 1.004, 1), true);
  assert.equal(same({ kind: 'range', step: 0.01 }, 1.01, 1), false);
  assert.equal(same({ kind: 'color' }, { r: 1, g: 2, b: 3, a: 1 }, { r: 1, g: 2, b: 3, a: 1 }), true);
});

test('planApply writes every target; the original value removes the edits', () => {
  assert.deepEqual(planApply({ c: px('padding-top'), orig: 10 }, 30), [['.box', 'padding-top', '30px', 30, false]]);
  assert.deepEqual(planApply({ c: px('padding-top'), orig: 10 }, 10), [['.box', 'padding-top', null, 10, false]]);
});

test('locked siblings get the same value, compared against their own originals', () => {
  const top = { c: px('padding-top'), orig: 10 }, left = { c: px('padding-left'), orig: 20 };
  assert.deepEqual(planApply(top, 20, [left]), [
    ['.box', 'padding-top', '20px', 20, false],
    ['.box', 'padding-left', null, 20, false],
  ]);
});

test('reset clears only its own row, even when locked (siblings keep their edits)', () => {
  const top = { c: px('padding-top'), orig: 10 };
  assert.deepEqual(planReset(top), [['.box', 'padding-top', null, undefined, false]]);
});

test('grouped controls write and clear all of their selectors', () => {
  const c = {
    kind: 'range', step: 0.01,
    keys: [{ selector: 'p:is(.a)', prop: 'font-size' }, { selector: 'p', prop: 'font-size' }],
    edits: k => [{ selector: 'p:is(.a)', prop: 'font-size', value: `calc(1rem * ${k})` }, { selector: 'p', prop: 'font-size', value: `calc(1em * ${k})`, weak: true }],
  };
  assert.deepEqual(planApply({ c, orig: 1 }, 1.2), [
    ['p:is(.a)', 'font-size', 'calc(1rem * 1.2)', 1.2, false],
    ['p', 'font-size', 'calc(1em * 1.2)', 1.2, true],
  ]);
  assert.deepEqual(planApply({ c, orig: 1 }, 1).map(e => e[2]), [null, null]);
});

test('shortcuts use the physical key, so a Cyrillic layout works', () => {
  assert.equal(shortcut({ code: 'KeyZ', key: 'я', ctrlKey: true }), 'undo');
  assert.equal(shortcut({ code: 'KeyZ', key: 'Я', ctrlKey: true, shiftKey: true }), 'redo');
  assert.equal(shortcut({ code: 'KeyY', key: 'н', metaKey: true }), 'redo');
  assert.equal(shortcut({ code: 'Escape', key: 'Escape' }), 'close');
  assert.equal(shortcut({ code: 'KeyZ', key: 'z' }), null);
});

test('saveOutcome: only a JSON {ok} body means the JS-Art server answered', () => {
  assert.equal(saveOutcome(200, { ok: true }), 'ok');
  assert.equal(saveOutcome(500, { ok: false, error: 'EACCES' }), 'error');
  assert.equal(saveOutcome(501, null), 'no-server');
  assert.equal(saveOutcome(404, null), 'no-server');
  assert.equal(saveOutcome(200, { unrelated: 1 }), 'no-server');
});

test('forScreen wraps keys and edits in the media condition, but not text edits', async () => {
  const { forScreen, SCREENS } = await import('../client/actions.js');
  const cond = SCREENS.mobile;
  const groups = [{ controls: [
    px('padding-top'),
    { kind: 'text', keys: [{ selector: '#t', prop: '@text' }], edits: v => [{ selector: '#t', prop: '@text', value: v }] },
  ] }];
  forScreen(groups, cond);
  const [a, t] = groups[0].controls;
  assert.deepEqual(a.keys, [{ selector: `@media ${cond}{.box}`, prop: 'padding-top' }]);
  assert.equal(a.edits(5)[0].selector, `@media ${cond}{.box}`);
  assert.equal(t.keys[0].selector, '#t');
  assert.equal(forScreen(groups, null), groups);
});
