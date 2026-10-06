/* Text edits. Unlike the style edits they change the page's text, so they are shown live by setting the
   element's textContent and are written into the HTML source on save (lib/text.js). Only leaf elements
   (no child elements) are editable. An edit is {selector, prop: '@text', value: {from, to}}. */

const trim = s => s.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
const norm = s => trim(s).replace(/[ \t\r\n]+/g, ' ');
const SKIP = /^(script|style|noscript|template|title)$/i;

export const isLeaf = el => el.children.length === 0 && !SKIP.test(el.localName) && !!trim(el.textContent);

/* elements currently showing an edit: selector → {el, full: the text before the edit} */
const live = new Map();

/* the text as the site's code has it, even while an edit is shown */
export function originalText(el) {
  for (const t of live.values()) if (t.el === el) return t.full;
  return el.textContent;
}

/* the original's own leading/trailing whitespace is kept around the new text */
const shown = (t, to) => {
  const core = trim(t.full), at = t.full.indexOf(core);
  return core ? t.full.slice(0, at) + to + t.full.slice(at + core.length) : to;
};

function show(t, to) {
  const text = shown(t, to);
  if (t.el.textContent !== text) t.el.textContent = text;
}

/* makes the page match the edit list: new edits applied, removed ones reverted */
export function applyTexts(edits) {
  const now = new Map(edits.filter(e => e.prop === '@text').map(e => [e.selector, e.value]));
  for (const [sel, t] of live) if (!now.has(sel)) { t.el.textContent = t.full; live.delete(sel); }
  for (const [sel, v] of now) {
    let t = live.get(sel);
    if (!t) {
      let el = null;
      try { el = document.querySelector(sel); } catch { /* exotic selector */ }
      if (!el) continue;
      t = { el, full: el.textContent };
      live.set(sel, t);
    }
    show(t, v.to);
  }
}

/* what the server needs to find each text in the HTML: how many leaf elements carry the same text, and which one */
export function textPayload(edits) {
  const now = new Map(edits.filter(e => e.prop === '@text').map(e => [e.selector, e.value]));
  const items = [...live].filter(([sel]) => now.has(sel));
  items.forEach(([, t]) => { t.el.textContent = t.full; });
  try {
    const leafs = [...document.body.querySelectorAll('*')].filter(isLeaf);
    return items.map(([selector, t]) => {
      const same = leafs.filter(e => norm(e.textContent) === norm(t.full));
      return { selector, from: trim(t.full), to: now.get(selector).to, index: same.indexOf(t.el), total: same.length };
    });
  } finally {
    items.forEach(([sel, t]) => show(t, now.get(sel).to));
  }
}

/* the edit is now part of the HTML: stop tracking it, keep the new text on the page */
export const bake = selector => { live.delete(selector); };
