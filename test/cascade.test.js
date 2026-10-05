import test from 'node:test';
import assert from 'node:assert/strict';
import { specificity, splitSelectors, pickWinner, groupsFor, scaledEdits, offsetEdits, factorEdits } from '../client/cascade.js';

test('specificity counts ids, classes/attributes/pseudo-classes and types', () => {
  assert.deepEqual(specificity('h1'), [0, 0, 1]);
  assert.deepEqual(specificity('.hero h1'), [0, 1, 1]);
  assert.deepEqual(specificity('#work > div'), [1, 0, 1]);
  assert.deepEqual(specificity(':root[data-theme="dark"]'), [0, 2, 0]);
  assert.deepEqual(specificity(':root:not([data-theme="light"])'), [0, 2, 0]);
  assert.deepEqual(specificity('a:hover::after'), [0, 1, 2]);
  assert.deepEqual(specificity(':where(.x) p'), [0, 0, 1]);
  assert.deepEqual(specificity('*'), [0, 0, 0]);
});

test('splitSelectors splits on top-level commas only', () => {
  assert.deepEqual(splitSelectors('h1,h2, .a:is(b, c)'), ['h1', 'h2', '.a:is(b, c)']);
  assert.deepEqual(splitSelectors('[data-x="a,b"], p'), ['[data-x="a,b"]', 'p']);
});

test('pickWinner: !important, then specificity, then source order', () => {
  const c = (value, spec, order, important = false) => ({ value, spec, order, important });
  assert.equal(pickWinner([c('a', [0, 1, 1], 1), c('b', [0, 0, 1], 2)]).value, 'a');
  assert.equal(pickWinner([c('a', [0, 1, 0], 1), c('b', [0, 1, 0], 2)]).value, 'b');
  assert.equal(pickWinner([c('a', [1, 0, 0], 1), c('b', [0, 0, 1], 2, true)]).value, 'b');
  assert.equal(pickWinner([]), null);
});

test('groupsFor: one group per declaring selector, scoped to the tag; inline skipped; undeclared → tag', () => {
  const groups = groupsFor('p', [
    { part: '.mono', value: '.75rem' },
    { part: '.hero-lead', value: 'clamp(1.1rem,1.7vw,1.4rem)' },
    { part: '.hero-lead', value: 'clamp(1.1rem,1.7vw,1.4rem)' },
    { part: 'p', value: '1rem', important: true },
    { inline: true, value: '0' },
    null,
  ]);
  /* tag:is(part) already outranks the declaring rule, so edits stay weak (inline styles and :hover still win);
     only an !important original needs !important */
  assert.deepEqual(groups, [
    { selector: 'p:is(.mono)', base: '.75rem', weak: true },
    { selector: 'p:is(.hero-lead)', base: 'clamp(1.1rem,1.7vw,1.4rem)', weak: true },
    { selector: 'p', base: '1rem', weak: false },
  ]);
  assert.deepEqual(groupsFor('p', [null]), [{ selector: 'p', base: null, weak: true }]);
});

test('scaledEdits multiplies each group, weak groups scale the inherited size (1em)', () => {
  const g = [{ selector: 'p:is(.mono)', base: '.75rem', weak: false }, { selector: 'p', base: null, weak: true }];
  assert.deepEqual(scaledEdits(g, 'font-size', 1.2), [
    { selector: 'p:is(.mono)', prop: 'font-size', value: 'calc(.75rem * 1.2)', weak: false },
    { selector: 'p', prop: 'font-size', value: 'calc(1em * 1.2)', weak: true },
  ]);
  assert.deepEqual(scaledEdits([{ selector: 'section', base: null, weak: true }], 'padding-top', 1.2), []);
});

test('offsetEdits shifts each declared value; undeclared falls back to the offset alone', () => {
  const g = [{ selector: 'h1:is(.hero h1)', base: '-.055em', weak: false }, { selector: 'h1', base: null, weak: true }];
  assert.deepEqual(offsetEdits(g, 'letter-spacing', 0.02, 'em'), [
    { selector: 'h1:is(.hero h1)', prop: 'letter-spacing', value: 'calc(-.055em + 0.02em)', weak: false },
    { selector: 'h1', prop: 'letter-spacing', value: '0.02em', weak: true },
  ]);
  assert.equal(offsetEdits(g, 'letter-spacing', -0.01, 'em')[0].value, 'calc(-.055em - 0.01em)');
});

test('factorEdits multiplies unitless values and falls back to the computed ratio for undeclared ones', () => {
  const g = [{ selector: 'h1:is(.hero h1)', base: '.92', weak: false }, { selector: 'h1', base: null, weak: true }];
  assert.deepEqual(factorEdits(g, 'line-height', 1.1, 1.6).map(e => e.value), ['calc(.92 * 1.1)', '1.76']);
});
