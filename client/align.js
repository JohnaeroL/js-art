/* Where a block sits inside its parent: left / centre / right (axis 'x') and top / middle / bottom (axis 'y').
   How that is written depends on the parent's layout:
     grid       → justify-self / align-self
     flex       → the cross axis is align-self, the main axis is auto margins (the only way to push a flex item)
     block flow → horizontal: auto margins; a block that fills the row first needs to shrink to its content
                  (max-width: fit-content), an inline element needs display: block. No vertical placement.
   Values are 'start' | 'center' | 'end'. Pure — tested in Node. */

const MARGINS = { x: ['margin-inline-start', 'margin-inline-end'], y: ['margin-block-start', 'margin-block-end'] };

/* [[prop, value]] for a position; a null value removes the edit again */
export function selfEdits(layout, axis, v, { inlineLevel = false, fills = false, replaced = false } = {}) {
  if (layout === 'grid') return [[axis === 'x' ? 'justify-self' : 'align-self', v]];
  const byMargin = layout === 'block' ? axis === 'x' : (layout === 'flex-row') === (axis === 'x');
  if (!byMargin) return [['align-self', v]];
  const [a, b] = MARGINS[axis];
  const out = v === 'start' ? [[a, '0px'], [b, 'auto']] : v === 'center' ? [[a, 'auto'], [b, 'auto']] : [[a, 'auto'], [b, '0px']];
  if (layout === 'block') {
    out.push(['display', inlineLevel && v !== 'start' ? 'block' : null]);
    out.push(['max-width', fills && !replaced && v !== 'start' ? 'fit-content' : null]);
  }
  return out;
}

/* every property selfEdits may write for this layout and axis */
export function selfKeys(layout, axis) {
  const all = ['start', 'center', 'end'].flatMap(v => selfEdits(layout, axis, v));
  return [...new Set(all.map(e => e[0]))];
}

/* 'start' | 'center' | 'end' from the child's gaps to the parent's content box (before, after) */
export function spot(before, after, tolerance = 2) {
  if (Math.abs(before - after) <= tolerance) return before > tolerance ? 'center' : 'start';
  return after < before ? 'end' : 'start';
}
