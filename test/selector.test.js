import test from 'node:test';
import assert from 'node:assert/strict';
import { selectorFor, STATE_CLASSES } from '../client/selector.js';

/* minimal element stand-in: tagName, id, classList, parentElement, children */
const mk = (tag, { id = '', cls = '', parent = null } = {}) => {
  const el = { tagName: tag.toUpperCase(), id, classList: cls.split(' ').filter(Boolean), parentElement: parent, children: [] };
  if (parent) parent.children.push(el);
  return el;
};
const html = mk('html');
const body = mk('body', { parent: html });

test('state classes are skipped for "all"', () => {
  assert.ok(STATE_CLASSES.includes('in') && STATE_CLASSES.includes('active'));
  const row = mk('div', { cls: 'srow reveal in', parent: body });
  assert.equal(selectorFor(row, 'all'), '.srow');
});

test('class-less element is scoped by the nearest classed ancestor', () => {
  const row = mk('div', { cls: 'srow', parent: body });
  assert.equal(selectorFor(mk('h3', { parent: row }), 'all'), '.srow h3');
  const hero = mk('section', { cls: 'hero', parent: body });
  const wrap = mk('div', { parent: hero });
  assert.equal(selectorFor(mk('p', { parent: wrap }), 'all'), '.hero p');
});

test('id is used when there is no class; plain tag as last resort', () => {
  assert.equal(selectorFor(mk('section', { id: 'work', parent: body }), 'all'), '#work');
  const nav = mk('nav', { parent: body });
  assert.equal(selectorFor(mk('a', { cls: 'active', parent: nav }), 'all'), 'a');
});

test('"one" builds an nth-of-type path from the nearest id', () => {
  const work = mk('section', { id: 'work', parent: body });
  const div = mk('div', { parent: work });
  mk('article', { parent: div });
  const second = mk('article', { parent: div });
  assert.equal(selectorFor(second, 'one'), '#work > div:nth-of-type(1) > article:nth-of-type(2)');
});

test('"one" starts from body when no ancestor has an id', () => {
  const main = mk('main', { parent: body });
  const p = mk('p', { parent: main });
  assert.match(selectorFor(p, 'one'), /^body > main:nth-of-type\(\d+\) > p:nth-of-type\(1\)$/);
});

test('special characters in classes are escaped', () => {
  assert.equal(selectorFor(mk('div', { cls: 'md:flex', parent: body }), 'all'), '.md\\:flex');
});
