/* Reading the page as the code made it: original values, declared CSS values, the colour palette. */
import { parseColor, formatColor } from './color.js';
import { selectorFor } from './selector.js';

const isOwnSheet = sheet => {
  const n = sheet.ownerNode;
  return !!n && (n.id === 'js-art-live' || (n.href || '').includes('js-art.css'));
};

/* every style rule of same-origin sheets that currently applies (media matched), with its media chain */
function* activeRules() {
  function* walk(rules, media) {
    for (const r of rules) {
      if (r.selectorText !== undefined && r.style) yield { rule: r, media };
      else if (r.media && r.cssRules) {
        if (matchMedia(r.media.mediaText).matches) yield* walk(r.cssRules, [...media, r.media.mediaText]);
      } else if (r.cssRules) yield* walk(r.cssRules, media);
    }
  }
  for (const sheet of document.styleSheets) {
    if (sheet.disabled || isOwnSheet(sheet)) continue;
    let rules;
    try { rules = sheet.cssRules; } catch { continue; } /* cross-origin */
    yield* walk(rules, []);
  }
}

const matches = (el, sel) => { try { return el.matches(sel); } catch { return false; } };

/* Runs fn with JS-Art's own styles switched off, so computed values are the site's originals.
   Transitions are frozen meanwhile, otherwise the site's own transitions would report (and animate) stale values. */
export function withOverridesDisabled(fn) {
  const nodes = [document.getElementById('js-art-live'), ...document.querySelectorAll('link[href*="js-art.css"]')]
    .filter(n => n && n.sheet && !n.sheet.disabled);
  const freeze = document.createElement('style');
  freeze.textContent = '*,*::before,*::after{transition:none!important}';
  document.head.append(freeze);
  nodes.forEach(n => { n.sheet.disabled = true; });
  try {
    return fn();
  } finally {
    nodes.forEach(n => { n.sheet.disabled = false; });
    void document.documentElement.offsetHeight; /* flush while transitions are still frozen */
    freeze.remove();
  }
}

/* The value the stylesheet author wrote for prop on el (last matching rule wins; inline style first). */
export function declaredValue(el, prop) {
  const inline = el.style && el.style.getPropertyValue(prop);
  if (inline) return inline.trim();
  let found = null;
  for (const { rule } of activeRules()) {
    const v = rule.style.getPropertyValue(prop);
    if (v && matches(el, rule.selectorText)) found = v.trim();
  }
  return found;
}

/* Colour custom properties declared on the root element for the current theme. */
export function rootColorVars() {
  const root = document.documentElement, cs = getComputedStyle(root), vars = new Map();
  for (const { rule, media } of activeRules()) {
    if (!matches(root, rule.selectorText)) continue;
    for (const name of rule.style) {
      if (name.startsWith('--')) vars.set(name, { name, selector: rule.selectorText, media: media.join(' and ') });
    }
  }
  return [...vars.values()]
    .map(v => ({ ...v, value: cs.getPropertyValue(v.name).trim() }))
    .filter(v => parseColor(v.value));
}

/* Fallback palette for sites without colour variables: the largest painted backgrounds. */
export function topBackgrounds(n = 5) {
  const by = new Map();
  const vw = innerWidth, dh = document.documentElement.scrollHeight;
  for (const el of [document.documentElement, document.body, ...document.body.querySelectorAll('*')]) {
    if (el.localName === 'js-art-root') continue;
    const c = parseColor(getComputedStyle(el).backgroundColor);
    if (!c || c.a === 0) continue;
    const r = el.getBoundingClientRect();
    const area = Math.max(0, Math.min(r.width, vw)) * Math.max(0, Math.min(r.height, dh));
    if (!area) continue;
    const key = formatColor(c);
    const e = by.get(key) || { color: key, area: 0, el, selectors: new Set() };
    e.area += area;
    if (e.selectors.size < 6) e.selectors.add(el === document.documentElement ? 'html' : el === document.body ? 'body' : selectorFor(el, 'all'));
    by.set(key, e);
  }
  return [...by.values()].sort((a, b) => b.area - a.area).slice(0, n)
    .map(({ color, el, selectors }) => ({ color, el, selectors: [...selectors] }));
}
