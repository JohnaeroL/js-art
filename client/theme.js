/* Site themes (light / dark): which theme an edit is for. A site switches its theme in one of three ways, and
   the edit is written so that it only applies to that theme:
     attr  — <html data-theme="dark">   → :root[data-theme="dark"] .card { … }
     class — <html class="dark">        → :root.dark .card { … }
     media — prefers-color-scheme       → @media (prefers-color-scheme: dark) { .card { … } }
   Light is "not dark", so a site that only styles its dark theme still works. Pure — tested in Node. */
import { splitSelectors } from './cascade.js';
import { withMedia } from './css-writer.js';

const ATTRS = ['data-theme', 'data-bs-theme', 'data-color-scheme', 'data-color-mode', 'data-mode'];
const CLASSES = ['dark', 'dark-mode', 'dark-theme', 'theme-dark'];
const isDark = v => /dark|night|black/i.test(v);
const isLight = v => /light|day|white/i.test(v);

/* sources: {selectors: every rule's selector text, attrs: {name: value} of <html>, classes: <html> classes} */
export function detectScheme({ selectors = [], attrs = {}, classes = [] } = {}) {
  for (const name of ATTRS) {
    const vals = [];
    if (attrs[name] != null) vals.push(attrs[name]);
    const re = new RegExp('\\[' + name + '\\s*=\\s*["\']?([\\w-]+)["\']?\\s*\\]', 'g');
    for (const sel of selectors) for (const m of sel.matchAll(re)) vals.push(m[1]);
    const dark = vals.find(isDark);
    if (dark) return { kind: 'attr', name, dark, light: vals.find(isLight) || 'light' };
  }
  for (const c of CLASSES) {
    const re = new RegExp('\\.' + c + '(?![\\w-])');
    if (classes.includes(c) || selectors.some(sel => re.test(sel))) return { kind: 'class', dark: c };
  }
  return { kind: 'media' };
}

const MEDIA = { dark: '(prefers-color-scheme: dark)', light: '(not (prefers-color-scheme: dark))' };

/* the selector (possibly "@media …{sel}") restricted to a theme: 'light' | 'dark' */
export function withTheme(selector, scheme, theme) {
  if (scheme.kind === 'media') return withMedia(selector, MEDIA[theme]);
  const m = selector.match(/^@media\s*(.+?)\s*\{(.+)\}$/s);
  const inner = m ? m[2] : selector;
  const root = scheme.kind === 'attr'
    ? (theme === 'dark' ? `:root[${scheme.name}="${scheme.dark}"]` : `:root:not([${scheme.name}="${scheme.dark}"])`)
    : (theme === 'dark' ? `:root.${scheme.dark}` : `:root:not(.${scheme.dark})`);
  const wrapped = splitSelectors(inner).map(p => (p === 'html' || p === ':root' ? root : `${root} ${p}`)).join(', ');
  return m ? `@media ${m[1]}{${wrapped}}` : wrapped;
}

/* Rewrites the controls of the groups to read and write for one theme. Custom properties ('--…') are left alone:
   a palette edit is already written into the rule that declares the variable, i.e. into its theme. Text edits too. */
export function forTheme(groups, scheme, theme) {
  if (!theme || theme === 'all') return groups;
  const wrap = k => (k.prop.startsWith('@') || k.prop.startsWith('--') ? k : { ...k, selector: withTheme(k.selector, scheme, theme) });
  for (const g of groups) {
    for (const c of g.controls) {
      const edits = c.edits;
      c.keys = c.keys.map(wrap);
      c.edits = v => edits(v).map(wrap);
    }
  }
  return groups;
}
