/* Cascade helpers for page-scope edits: which rule really sets a value, and how to scale every rule that
   sets it for a tag, instead of forcing one value onto all elements of that tag. Pure — tested in Node. */

const round = (v, d = 3) => Math.round(v * 10 ** d) / 10 ** d;

/* top-level comma split that respects (), [] and quotes */
export function splitSelectors(list) {
  const out = [];
  let depth = 0, quote = null, cur = '';
  for (const ch of list) {
    if (quote) { if (ch === quote) quote = null; }
    else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const add = (x, y) => [x[0] + y[0], x[1] + y[1], x[2] + y[2]];
const cmp = (x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
const maxSpec = list => splitSelectors(list).map(specificity).reduce((m, s) => (cmp(s, m) > 0 ? s : m), [0, 0, 0]);

/* [ids, classes+attributes+pseudo-classes, types+pseudo-elements] of one complex selector */
export function specificity(sel) {
  let spec = [0, 0, 0];
  let s = sel;
  /* functional pseudo-classes first, their arguments decide their weight */
  const fn = /:(where|is|not|has|matches|-webkit-any|nth-child|nth-last-child|nth-of-type|nth-last-of-type|host|host-context|lang|dir)\(/i;
  for (let m = s.match(fn); m; m = s.match(fn)) {
    let depth = 0, end = m.index + m[0].length - 1;
    for (; end < s.length; end++) {
      if (s[end] === '(') depth++;
      else if (s[end] === ')' && --depth === 0) break;
    }
    const name = m[1].toLowerCase(), inner = s.slice(m.index + m[0].length, end);
    if (['is', 'not', 'has', 'matches', '-webkit-any'].includes(name)) spec = add(spec, maxSpec(inner));
    else if (name !== 'where') spec = add(spec, [0, 1, 0]);
    s = s.slice(0, m.index) + s.slice(end + 1);
  }
  const take = (re, i) => { s = s.replace(re, () => { spec[i]++; return ''; }); };
  take(/\[(?:[^\]"']|"[^"]*"|'[^']*')*\]/g, 1);
  take(/::[\w-]+/g, 2);
  take(/:(?:before|after|first-line|first-letter)\b/gi, 2);
  take(/:[\w-]+/g, 1);
  take(/#[\w-]+/g, 0);
  take(/\.[\w-]+/g, 1);
  spec[2] += s.split(/[\s>+~]+/).filter(t => /^[a-z]/i.test(t)).length;
  return spec;
}

/* the declaration that wins: !important first, then specificity, then later in source */
export function pickWinner(cands) {
  let best = null;
  for (const c of cands) {
    if (!best || (c.important !== best.important ? c.important : (cmp(c.spec, best.spec) || c.order - best.order) > 0)) best = c;
  }
  return best;
}

/* items: per element of `tag`, its winning declaration {part, value, important}, {inline: true} or null (nothing declared).
   Each declaring selector becomes `tag:is(part)` so the edit stays on this tag. That selector already outranks
   the declaring rule, so the edit is weak (no !important) and inline styles and :hover rules keep working —
   only an !important original needs !important. Undeclared (inherited) values get one weak `tag` rule unless
   `tag` itself is a declaring selector. */
export function groupsFor(tag, items) {
  const groups = new Map();
  let undeclared = false;
  for (const it of items) {
    if (!it) { undeclared = true; continue; }
    if (it.inline) continue;
    const selector = it.part.trim().toLowerCase() === tag ? tag : `${tag}:is(${it.part})`;
    if (!groups.has(selector)) groups.set(selector, { selector, base: it.value, weak: !it.important });
  }
  if (undeclared && !groups.has(tag)) groups.set(tag, { selector: tag, base: null, weak: true });
  return [...groups.values()];
}

export function scaledEdits(groups, prop, k) {
  return groups.flatMap(g => {
    /* an inherited font-size scales from the parent's size; other undeclared values are 0 — nothing to scale */
    const base = g.base ?? (prop === 'font-size' ? '1em' : null);
    return base == null ? [] : [{ selector: g.selector, prop, value: `calc(${base} * ${round(k)})`, weak: g.weak }];
  });
}

export function offsetEdits(groups, prop, d, unit) {
  const r = round(d);
  return groups.map(g => ({
    selector: g.selector, prop, weak: g.weak,
    value: g.base == null ? `${r}${unit}` : `calc(${g.base} ${r < 0 ? '-' : '+'} ${Math.abs(r)}${unit})`,
  }));
}

export function factorEdits(groups, prop, k, fallback) {
  return groups.map(g => ({
    selector: g.selector, prop, weak: g.weak,
    value: g.base == null ? String(round(fallback * k)) : `calc(${g.base} * ${round(k)})`,
  }));
}
