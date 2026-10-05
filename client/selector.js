/* CSS selector for a picked element.
   'all' — a reusable selector that matches every element of the same kind (.srow h3)
   'one' — an exact nth-of-type path to this element only */

/* toggled by scripts, so a selector built on them would stop matching */
export const STATE_CLASSES = ['in', 'on', 'active', 'scrolled', 'play', 'held', 'sent', 'menu-open', 'open', 'is-active'];

const esc = s => s.replace(/([^\w-])/g, '\$1');
const tag = el => el.tagName.toLowerCase();
const classes = el => [...el.classList].filter(c => !STATE_CLASSES.includes(c) && !c.startsWith('js-art'));

function nthOfType(el) {
  const sibs = el.parentElement ? [...el.parentElement.children].filter(s => s.tagName === el.tagName) : [el];
  return `${tag(el)}:nth-of-type(${sibs.indexOf(el) + 1})`;
}

export function selectorFor(el, mode = 'all') {
  if (mode === 'one') {
    if (el.id) return '#' + esc(el.id);
    const path = [];
    let cur = el;
    while (cur && !cur.id && tag(cur) !== 'body' && tag(cur) !== 'html') {
      path.unshift(nthOfType(cur));
      cur = cur.parentElement;
    }
    const start = cur && cur.id ? '#' + esc(cur.id) : 'body';
    return [start, ...path].join(' > ');
  }

  const own = classes(el);
  if (own.length) return '.' + esc(own[0]);
  if (el.id) return '#' + esc(el.id);
  for (let p = el.parentElement; p; p = p.parentElement) {
    const pc = classes(p);
    if (pc.length) return `.${esc(pc[0])} ${tag(el)}`;
  }
  return tag(el);
}
