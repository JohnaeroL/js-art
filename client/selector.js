/* CSS selector for a picked element.
   'all' — a reusable selector that matches every element of the same kind (.srow h3)
   'one' — an exact nth-of-type path to this element only */

/* toggled by scripts (a selector built on them would stop matching) or animation hooks shared by unrelated
   elements (a selector built on them would hit half the page) */
export const STATE_CLASSES = ['in', 'on', 'active', 'scrolled', 'play', 'held', 'sent', 'menu-open', 'open', 'is-active', 'reveal'];

const esc = s => s.replace(/([^\w-])/g, '\\$1');
const tag = el => el.tagName.toLowerCase();
const classes = el => [...el.classList].filter(c => !STATE_CLASSES.includes(c) && !c.startsWith('js-art'));

function nthOfType(el) {
  const sibs = el.parentElement ? [...el.parentElement.children].filter(s => s.tagName === el.tagName) : [el];
  return `${tag(el)}:nth-of-type(${sibs.indexOf(el) + 1})`;
}

/* stats(cls) → {count, sameTag}: how many elements carry the class and whether all of them share el's tag.
   With stats, a class specific to this kind of element wins over a site-wide utility class (.mono, .btn). */
function bestClass(own, stats) {
  if (!stats) return own[0];
  const specific = own.map(c => ({ c, s: stats(c) })).filter(x => x.s && x.s.sameTag);
  return specific.length ? specific.reduce((a, b) => (b.s.count < a.s.count ? b : a)).c : own[0];
}

export function selectorFor(el, mode = 'all', { stats } = {}) {
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
  if (own.length) return '.' + esc(bestClass(own, stats));
  if (el.id) return '#' + esc(el.id);
  for (let p = el.parentElement; p; p = p.parentElement) {
    const pc = classes(p);
    if (pc.length) return `.${esc(pc[0])} ${tag(el)}`;
  }
  return tag(el);
}
