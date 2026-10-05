/* What the panel can edit. A control reads its original value from the page (read — called while JS-Art's
   styles are switched off) and turns a slider value into edits:
   Group = {id, label, lock?, controls}
   Control = {label, sub?, kind:'color'|'range', min, max, step, unit, lock?, read(), keys, edits(v)}
   keys: every [{selector, prop}] the control may write; edits(v): [{selector, prop, value, weak?}]. */
import { parseColor, formatColor } from './color.js';
import { scaleValue, mediaSelector } from './css-writer.js';
import { declaredValue, winningDeclaration, rootColorVars, topBackgrounds } from './scan.js';
import { groupsFor, scaledEdits, offsetEdits, factorEdits } from './cascade.js';

const cs = el => getComputedStyle(el);
const num = s => parseFloat(s) || 0;
const round = (v, d = 3) => Math.round(v * 10 ** d) / 10 ** d;
/* keywords (auto, normal, inherit) and var() can't be put into calc() reliably */
const usable = v => !!v && !/^[a-z-]+$/i.test(v) && !v.includes('var(');

/* one selector + prop, value from write(v) */
function single(o) {
  return { kind: 'range', unit: '', step: 1, ...o, keys: [{ selector: o.selector, prop: o.prop }], edits: v => [{ selector: o.selector, prop: o.prop, value: o.write(v) }] };
}

function color({ label, sub, selector, prop, el }) {
  return single({
    label, sub, kind: 'color', selector, prop,
    read: () => parseColor(cs(el).getPropertyValue(prop).trim()) || { r: 0, g: 0, b: 0, a: 0 },
    write: c => formatColor(c),
  });
}

/* block scope: size as a multiplier of whatever the author wrote — calc(clamp(...) * k) stays fluid */
function scale({ label, sub, selector, prop, el }) {
  let base;
  return single({
    label, sub, selector, prop, min: 0.5, max: 2, step: 0.01, unit: '×',
    read: () => { const d = declaredValue(el, prop); base = usable(d) ? d : cs(el).getPropertyValue(prop); return 1; },
    write: k => scaleValue(base, k),
  });
}

const px = (o, read) => single({ unit: 'px', min: 0, max: 200, step: 1, ...o, read, write: v => `${v}px` });

const lsRatio = el => { const s = cs(el); return s.letterSpacing === 'normal' ? 0 : round(num(s.letterSpacing) / num(s.fontSize)); };
const lhRatio = el => { const s = cs(el); return s.lineHeight === 'normal' ? 1.2 : round(num(s.lineHeight) / num(s.fontSize), 2); };

const factor = (o, min = 0, max = 2) => single({ min, max, step: 0.01, unit: '×', ...o, read: () => 1, write: v => String(v) });
const zoom = (label, selector) => factor({ label, selector, prop: 'zoom' }, 0.25, 3);

/* Page scope: every element of `tag`, grouped by the rule that really sets prop, each group changed relative
   to its own value — so a small nudge keeps the site's hierarchy instead of flattening all <p> to one size. */
function grouped({ label, sub, tag, prop, mode }) {
  const c = { label, sub, kind: 'range', keys: [], edits: () => [] };
  if (mode === 'scale') Object.assign(c, { min: 0.5, max: 2, step: 0.01, unit: '×' });
  if (mode === 'offset') Object.assign(c, { min: -0.1, max: 0.2, step: 0.005, unit: 'em' });
  if (mode === 'factor') Object.assign(c, { min: 0.5, max: 2, step: 0.01, unit: '×' });
  c.read = () => {
    const els = [...document.querySelectorAll(tag)];
    const items = els.map(el => {
      const d = winningDeclaration(el, prop);
      return d && (d.inline || usable(d.value)) ? d : null;
    });
    const groups = groupsFor(tag, items);
    const plain = els.find((el, i) => !items[i]) || els[0];
    /* undeclared font-size still differs from the parent's (UA h3 = 1.17em): keep that ratio */
    const weak = groups.find(g => g.base == null);
    if (weak && plain && prop === 'font-size' && plain.parentElement) {
      weak.base = `${round(num(cs(plain).fontSize) / num(cs(plain.parentElement).fontSize))}em`;
    }
    if (mode === 'scale') c.edits = k => scaledEdits(groups, prop, k);
    if (mode === 'offset') c.edits = d => offsetEdits(groups, prop, d, 'em');
    if (mode === 'factor') { const ratio = plain ? lhRatio(plain) : 1.2; c.edits = k => factorEdits(groups, prop, k, ratio); }
    c.keys = c.edits(mode === 'offset' ? 0.01 : 1.01).map(e => ({ selector: e.selector, prop: e.prop }));
    return mode === 'offset' ? 0 : 1;
  };
  return c;
}

const TEXT_TAGS = { h1: 'Заголовок H1', h2: 'Заголовок H2', h3: 'Заголовок H3', h4: 'Заголовок H4', p: 'Абзац', a: 'Ссылка', small: 'Мелкий текст' };

export function pageControls() {
  const html = document.documentElement, groups = [];
  const first = s => document.querySelector(s);

  const vars = rootColorVars();
  if (vars.length) {
    groups.push({ id: 'palette', label: 'Палитра', controls: vars.map(v => color({
      label: v.name, el: html, prop: v.name, selector: mediaSelector(v.selector, v.media, v.inactive),
    })) });
  } else {
    groups.push({ id: 'bg', label: 'Цвета фона', controls: topBackgrounds(5).map((b, i) => color({
      label: `Фон ${i + 1}`, el: b.el, prop: 'background-color', selector: b.selectors.join(', '),
    })) });
  }

  const tags = Object.keys(TEXT_TAGS).filter(first);
  groups.push({ id: 'text', label: 'Цвета текста', controls: tags.map(t => color({ label: TEXT_TAGS[t], selector: t, prop: 'color', el: first(t) })) });

  const typo = [scale({ label: 'Базовый размер', selector: 'html', prop: 'font-size', el: html })];
  for (const t of tags.filter(t => /^(h\d|p)$/.test(t))) {
    const sub = TEXT_TAGS[t];
    typo.push(grouped({ label: 'Размер', sub, tag: t, prop: 'font-size', mode: 'scale' }),
      grouped({ label: 'Межбуквенный ±', sub, tag: t, prop: 'letter-spacing', mode: 'offset' }),
      grouped({ label: 'Межстрочный', sub, tag: t, prop: 'line-height', mode: 'factor' }));
  }
  groups.push({ id: 'type', label: 'Типографика', controls: typo });

  const space = [];
  if (first('section')) space.push(grouped({ label: 'Секции сверху', tag: 'section', prop: 'padding-top', mode: 'scale' }),
    grouped({ label: 'Секции снизу', tag: 'section', prop: 'padding-bottom', mode: 'scale' }));
  space.push(px({ label: 'Поля страницы', selector: 'body', prop: 'padding-inline' }, () => num(cs(document.body).paddingLeft)));
  groups.push({ id: 'space', label: 'Отступы', controls: space });

  const size = [];
  if (first('img')) size.push(zoom('Изображения', 'img'));
  if (first('svg')) size.push(zoom('Иконки', 'svg'));
  if (size.length) groups.push({ id: 'size', label: 'Размеры', controls: size });

  groups.push({ id: 'fx', label: 'Эффекты', controls: [
    factor({ label: 'Контраст', selector: 'html', prop: 'filter:contrast' }),
    factor({ label: 'Яркость', selector: 'html', prop: 'filter:brightness' }),
    factor({ label: 'Насыщенность', selector: 'html', prop: 'filter:saturate' }),
  ] });
  return groups.filter(g => g.controls.length);
}

const SIDES = [['top', 'сверху'], ['right', 'справа'], ['bottom', 'снизу'], ['left', 'слева']];

export function blockControls(el, selector) {
  const s = cs(el), groups = [];
  const sides = (box, label, min) => SIDES.map(([side, word]) =>
    px({ label: `${label} ${word}`, selector, prop: `${box}-${side}`, min, lock: box }, () => num(cs(el).getPropertyValue(`${box}-${side}`))));

  groups.push({ id: 'colors', label: 'Цвета', controls: [
    color({ label: 'Фон', selector, prop: 'background-color', el }),
    color({ label: 'Текст', selector, prop: 'color', el }),
  ] });
  groups.push({ id: 'type', label: 'Типографика', controls: [
    scale({ label: 'Размер текста', selector, prop: 'font-size', el }),
    single({ label: 'Межбуквенный', selector, prop: 'letter-spacing', min: -0.1, max: 0.3, step: 0.005, unit: 'em', read: () => lsRatio(el), write: v => `${v}em` }),
    single({ label: 'Межстрочный', selector, prop: 'line-height', min: 0.8, max: 3, step: 0.05, read: () => lhRatio(el), write: v => String(v) }),
  ] });
  groups.push({ id: 'padding', label: 'Внутренние отступы', lock: 'padding', controls: sides('padding', 'Padding', 0) });
  groups.push({ id: 'margin', label: 'Внешние отступы', lock: 'margin', controls: sides('margin', 'Margin', -200) });

  const size = [
    px({ label: 'Ширина', selector, prop: 'width', max: 2000 }, () => round(num(cs(el).width) || el.getBoundingClientRect().width, 0)),
    px({ label: 'Высота', selector, prop: 'height', max: 2000 }, () => round(num(cs(el).height) || el.getBoundingClientRect().height, 0)),
    px({ label: 'Скругление', selector, prop: 'border-radius' }, () => num(cs(el).borderTopLeftRadius)),
  ];
  if (/flex|grid/.test(s.display)) size.push(px({ label: 'Промежуток (gap)', selector, prop: 'gap' }, () => num(cs(el).rowGap)));
  if (el.querySelector('img') || el.localName === 'img') size.push(zoom('Картинки внутри', el.localName === 'img' ? selector : `${selector} img`));
  if (el.querySelector('svg') || el.localName === 'svg') size.push(zoom('Иконки внутри', el.localName === 'svg' ? selector : `${selector} svg`));
  groups.push({ id: 'size', label: 'Размеры', controls: size });

  groups.push({ id: 'fx', label: 'Эффекты', controls: [
    single({ label: 'Непрозрачность', selector, prop: 'opacity', min: 0, max: 1, step: 0.01, read: () => num(cs(el).opacity), write: v => String(v) }),
    factor({ label: 'Контраст', selector, prop: 'filter:contrast' }),
  ] });
  return groups;
}
