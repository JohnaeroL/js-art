/* Panel decisions kept out of the DOM code: what a slider move or ↺ writes, which shortcut a key is,
   how to read the save response. Pure — tested in Node.
   A control exposes keys ([{selector, prop}] it may write) and edits(v) ([{selector, prop, value, weak?}]).
   Plans are lists of [selector, prop, value|null, ui, weak] for Model.set. */
import { formatColor } from './color.js';

export const same = (c, a, b) => {
  if (c.kind === 'color') return formatColor(a) === formatColor(b);
  if (c.kind === 'select' || c.kind === 'text') return a === b;
  return Math.abs(a - b) < c.step / 2;
};

function planSet(c, v, orig) {
  if (same(c, v, orig)) return c.keys.map(k => [k.selector, k.prop, null, v, false]);
  return c.edits(v).map(e => [e.selector, e.prop, e.value, v, !!e.weak]);
}

/* siblings: other rows tied to this one by a lock (padding/margin sides) */
export function planApply(row, v, siblings = []) {
  return [planSet(row.c, v, row.orig), ...siblings.map(s => planSet(s.c, v, s.orig))].flat();
}

/* ↺ returns this row to the code's value and leaves locked siblings alone */
export const planReset = row => row.c.keys.map(k => [k.selector, k.prop, null, undefined, false]);

/* e.code is the physical key, so Ctrl+Z also works on a Russian layout where e.key is 'я' */
export function shortcut(e) {
  if (e.key === 'Escape') return 'close';
  if (!(e.ctrlKey || e.metaKey)) return null;
  const code = e.code || '';
  const key = (e.key || '').toLowerCase();
  if (code === 'KeyZ' || (!code && key === 'z')) return e.shiftKey ? 'redo' : 'undo';
  if (code === 'KeyY' || (!code && key === 'y')) return 'redo';
  return null;
}

/* anything but the JS-Art server's own {ok} JSON (404 page, 501 from a plain static server) means "no server" */
export function saveOutcome(status, body) {
  if (!body || typeof body.ok !== 'boolean') return 'no-server';
  return body.ok && status < 400 ? 'ok' : 'error';
}
