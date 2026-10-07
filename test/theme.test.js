import test from 'node:test';
import assert from 'node:assert/strict';
import { detectScheme, withTheme, forTheme } from '../client/theme.js';

test('detectScheme: attribute on <html> or in selectors', () => {
  assert.deepEqual(detectScheme({ attrs: { 'data-theme': 'light' }, selectors: ['[data-theme="dark"] .a'] }),
    { kind: 'attr', name: 'data-theme', dark: 'dark', light: 'light' });
  assert.equal(detectScheme({ selectors: [':root[data-bs-theme=dark] body'] }).name, 'data-bs-theme');
});

test('detectScheme: class, then media as the default', () => {
  assert.deepEqual(detectScheme({ classes: ['dark'] }), { kind: 'class', dark: 'dark' });
  assert.deepEqual(detectScheme({ selectors: ['html.dark-mode .x'] }), { kind: 'class', dark: 'dark-mode' });
  assert.deepEqual(detectScheme({ selectors: ['.card', '.dark-card'] }), { kind: 'media' });
});

test('withTheme: attribute scheme prefixes every selector of a list, html/:root become the root itself', () => {
  const s = { kind: 'attr', name: 'data-theme', dark: 'dark', light: 'light' };
  assert.equal(withTheme('.a, h1', s, 'dark'), ':root[data-theme="dark"] .a, :root[data-theme="dark"] h1');
  assert.equal(withTheme('html', s, 'light'), ':root:not([data-theme="dark"])');
  assert.equal(withTheme('@media (max-width: 767px){.a}', s, 'dark'), '@media (max-width: 767px){:root[data-theme="dark"] .a}');
});

test('withTheme: class and media schemes', () => {
  assert.equal(withTheme('.a', { kind: 'class', dark: 'dark' }, 'dark'), ':root.dark .a');
  assert.equal(withTheme('.a', { kind: 'class', dark: 'dark' }, 'light'), ':root:not(.dark) .a');
  assert.equal(withTheme('.a', { kind: 'media' }, 'dark'), '@media (prefers-color-scheme: dark){.a}');
  assert.equal(withTheme('.a', { kind: 'media' }, 'light'), '@media (not (prefers-color-scheme: dark)){.a}');
});

test('forTheme leaves custom properties and text edits alone, and "all" changes nothing', () => {
  const mk = prop => ({ keys: [{ selector: '.a', prop }], edits: v => [{ selector: '.a', prop, value: v }] });
  const groups = [{ controls: [mk('color'), mk('--bg'), mk('@text')] }];
  assert.equal(forTheme(groups, { kind: 'class', dark: 'dark' }, 'all'), groups);
  forTheme(groups, { kind: 'class', dark: 'dark' }, 'dark');
  const [c, v, t] = groups[0].controls;
  assert.equal(c.keys[0].selector, ':root.dark .a');
  assert.equal(c.edits(1)[0].selector, ':root.dark .a');
  assert.equal(v.keys[0].selector, '.a');
  assert.equal(t.keys[0].selector, '.a');
});
