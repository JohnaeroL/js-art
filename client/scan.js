/* Reading the page as the code made it: original values, the declarations that win, the colour palette. */
import { parseColor, formatColor } from './color.js';
import { selectorFor } from './selector.js';
import { specificity, splitSelectors, pickWinner } from './cascade.js';

/* the saved overrides file (marked by insertLink) and the live <style> */
export const OVERRIDES = '#js-art-live, link[data-js-art], link[href*="js-art.css"]';
const isOwnSheet = sheet => !!sheet.ownerNode && sheet.ownerNode.matches(OVERRIDES);

const cmp = (x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2];

/* every style rule of same-origin sheets with its media chain and whether that media currently applies */
function* allRules() {
  let order = 0;
  function* walk(rules, media, active) {
    for (const r of rules) {
      if (r.selectorText !== undefined && r.style) yield { rule: r, media, active, order: order++ };
      else if (r.media && r.cssRules) {
        yield* walk(r.cssRules, [...media, r.media.mediaText], active && matchMedia(r.media.mediaText).matches);
      } else if (r.cssRules) yield* walk(r.cssRules, media, active);
    }
  }
  for (const sheet of document.styleSheets) {
    if (sheet.disabled || isOwnSheet(sheet)) continue;
    let rules;
    try { rules = sheet.cssRules; } catch { continue; } /* cross-origin */
    yield* walk(rules, [], true);
  }
}

const matches = (el, sel) => { try { return el.matches(sel); } catch { return false; } };

/* the most specific part of a selector list that matches el, with its specificity */
function matchingPart(el, selectorText) {
  let best = null;
  for (const part of splitSelectors(selectorText)) {
    if (!matches(el, part)) continue;
    const spec = specificity(part);
    if (!best || cmp(spec, best.spec) > 0) best = { part, spec };
  }
  return best;
}

/* Runs fn with JS-Art's own styles switched off, so computed values are the site's originals.
   Transitions are frozen meanwhile, otherwise the site's own transitions would report (and animate) stale values. */
export function withOverridesDisabled(fn) {
  const nodes = [...document.querySelectorAll(OVERRIDES)].filter(n => n.sheet && !n.sheet.disabled);
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

/* The declaration that sets prop on el: {inline: true, value} for a style attribute,
   {part, value, important} for the winning stylesheet rule, null when nothing declares it (inherited/initial). */
/* physical sides are often authored as logical ones (padding-block) — horizontal, left-to-right assumed */
const LOGICAL = {};
for (const box of ['padding', 'margin']) {
  Object.assign(LOGICAL, { [`${box}-top`]: `${box}-block-start`, [`${box}-bottom`]: `${box}-block-end`, [`${box}-left`]: `${box}-inline-start`, [`${box}-right`]: `${box}-inline-end` });
}
const read = (style, prop) => style.getPropertyValue(prop) || (LOGICAL[prop] ? style.getPropertyValue(LOGICAL[prop]) : '');
const priority = (style, prop) => style.getPropertyPriority(prop) || (LOGICAL[prop] ? style.getPropertyPriority(LOGICAL[prop]) : '');

export function winningDeclaration(el, prop) {
  const inline = el.style && read(el.style, prop);
  if (inline) return { inline: true, value: inline.trim() };
  const cands = [];
  for (const { rule, active, order } of allRules()) {
    if (!active) continue;
    const value = read(rule.style, prop);
    if (!value) continue;
    const m = matchingPart(el, rule.selectorText);
    if (m) cands.push({ value: value.trim(), important: priority(rule.style, prop) === 'important', spec: m.spec, part: m.part, order });
  }
  const w = pickWinner(cands);
  return w && { part: w.part, value: w.value, important: w.important };
}

export function declaredValue(el, prop) {
  const d = winningDeclaration(el, prop);
  return d ? d.value : null;
}

/* Colour custom properties on the root element for the current theme: where the winning declaration lives
   (selector + active media) and which currently-inactive media conditions redefine the variable with a
   selector our edit would outrank — the edit is fenced off from those (e.g. a media-only dark theme). */
export function rootColorVars() {
  const root = document.documentElement, cs = getComputedStyle(root);
  const decls = new Map();
  for (const { rule, media, active, order } of allRules()) {
    const m = matchingPart(root, rule.selectorText);
    if (!m) continue;
    for (const name of rule.style) {
      if (!name.startsWith('--')) continue;
      if (!decls.has(name)) decls.set(name, []);
      decls.get(name).push({ ...m, media, active, order, important: rule.style.getPropertyPriority(name) === 'important' });
    }
  }
  const out = [];
  for (const [name, list] of decls) {
    const value = cs.getPropertyValue(name).trim();
    if (!parseColor(value)) continue;
    const w = pickWinner(list.filter(d => d.active));
    if (!w) continue;
    const inactive = [...new Set(list
      .filter(d => !d.active && cmp(d.spec, w.spec) <= 0)
      .map(d => d.media.filter(q => !matchMedia(q).matches).join(' and '))
      .filter(Boolean))];
    out.push({ name, value, selector: w.part, media: w.media, inactive });
  }
  return out;
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
    if (e.selectors.size < 6) e.selectors.add(el === document.documentElement ? 'html' : el === document.body ? 'body' : selectorFor(el, 'all', { stats: classStats }));
    by.set(key, e);
  }
  return [...by.values()].sort((a, b) => b.area - a.area).slice(0, n)
    .map(({ color, el, selectors }) => ({ color, el, selectors: [...selectors] }));
}

/* for selectorFor: how many elements carry a class and whether they all share one tag */
export function classStats(cls) {
  let list;
  try { list = document.getElementsByClassName(cls); } catch { return null; }
  const tag = list[0] && list[0].tagName;
  return { count: list.length, sameTag: [...list].every(e => e.tagName === tag) };
}

/* what detectScheme needs to find out how the site switches themes */
export function themeSources() {
  const selectors = [];
  for (const { rule } of allRules()) if (selectors.length < 5000) selectors.push(rule.selectorText);
  const html = document.documentElement;
  return { selectors, attrs: Object.fromEntries([...html.attributes].map(a => [a.name, a.value])), classes: [...html.classList] };
}
