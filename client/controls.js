/* What the panel can edit. A control knows where it writes (selector + prop), how to read the original value
   from the page (read — called while JS-Art's styles are switched off) and how to turn a slider value into CSS (write).
   Group = {id, label, lock?, controls}; Control = {key, label, sub?, kind:'color'|'range', selector, prop,
   min, max, step, unit, read(), write(v), lock?} */
import { parseColor, formatColor } from './color.js';
import { scaleValue } from './css-writer.js';
import { declaredValue, rootColorVars, topBackgrounds } from './scan.js';

const cs = el => getComputedStyle(el);
const num = s => parseFloat(s) || 0;
const round = (v, d = 3) => Math.round(v * 10 ** d) / 10 ** d;

function color({ label, sub, selector, prop, el }) {
  return {
    key: selector + '|' + prop, label, sub, kind: 'color', selector, prop,
    read: () => parseColor(cs(el).getPropertyValue(prop).trim()) || { r: 0, g: 0, b: 0, a: 0 },
    write: c => formatColor(c),
  };
}

function range(o) {
  return { key: o.selector + '|' + o.prop, kind: 'range', unit: '', step: 1, ...o };
}

/* size as a multiplier of whatever the author wrote: calc(clamp(...) * k) keeps fluid values fluid */
function scale({ label, sub, selector, prop, el }) {
  const c = range({ label, sub, selector, prop, min: 0.5, max: 2, step: 0.01, unit: '×' });
  c.read = () => {
    const d = declaredValue(el, prop);
    /* keywords (auto, inherit) and var() can't be multiplied reliably — fall back to the computed px */
    c.base = d && !/^[a-z-]+$/i.test(d) && !d.includes('var(') ? d : cs(el).getPropertyValue(prop);
    return 1;
  };
  c.write = k => scaleValue(c.base, k);
  return c;
}

const px = (o, read) => range({ unit: 'px', min: 0, max: 200, step: 1, ...o, read, write: v => `${v}px` });

function letterSpacing(o, el) {
  return range({ ...o, prop: 'letter-spacing', min: -0.1, max: 0.3, step: 0.005, unit: 'em',
    read: () => { const s = cs(el); return s.letterSpacing === 'normal' ? 0 : round(num(s.letterSpacing) / num(s.fontSize)); },
    write: v => `${v}em` });
}

function lineHeight(o, el) {
  return range({ ...o, prop: 'line-height', min: 0.8, max: 3, step: 0.05,
    read: () => { const s = cs(el); return s.lineHeight === 'normal' ? 1.2 : round(num(s.lineHeight) / num(s.fontSize), 2); },
    write: v => String(v) });
}

const factor = (o, min = 0, max = 2) => range({ min, max, step: 0.01, unit: '×', ...o, read: () => 1, write: v => String(v) });

const zoom = (label, selector) => factor({ label, selector, prop: 'zoom' }, 0.25, 3);

const TEXT_TAGS = { h1: 'Заголовок H1', h2: 'Заголовок H2', h3: 'Заголовок H3', h4: 'Заголовок H4', p: 'Абзац', a: 'Ссылка', small: 'Мелкий текст' };

export function pageControls() {
  const html = document.documentElement, groups = [];
  const first = s => document.querySelector(s);

  const vars = rootColorVars();
  if (vars.length) {
    groups.push({ id: 'palette', label: 'Палитра', controls: vars.map(v => color({
      label: v.name, el: html, prop: v.name,
      selector: v.media ? `@media ${v.media}{${v.selector}}` : v.selector,
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
    const el = first(t), sub = TEXT_TAGS[t];
    typo.push(scale({ label: 'Размер', sub, selector: t, prop: 'font-size', el }),
      letterSpacing({ label: 'Межбуквенный', sub, selector: t }, el),
      lineHeight({ label: 'Межстрочный', sub, selector: t }, el));
  }
  groups.push({ id: 'type', label: 'Типографика', controls: typo });

  const space = [];
  const section = first('section');
  if (section) space.push(scale({ label: 'Секции сверху', selector: 'section', prop: 'padding-top', el: section }),
    scale({ label: 'Секции снизу', selector: 'section', prop: 'padding-bottom', el: section }));
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
    px({ label: `${label} ${word}`, selector, prop: `${box}-${side}`, min, lock: box }, () => num(cs(el)[`${box}-${side}`] ?? cs(el).getPropertyValue(`${box}-${side}`))));

  groups.push({ id: 'colors', label: 'Цвета', controls: [
    color({ label: 'Фон', selector, prop: 'background-color', el }),
    color({ label: 'Текст', selector, prop: 'color', el }),
  ] });
  groups.push({ id: 'type', label: 'Типографика', controls: [
    scale({ label: 'Размер текста', selector, prop: 'font-size', el }),
    letterSpacing({ label: 'Межбуквенный', selector }, el),
    lineHeight({ label: 'Межстрочный', selector }, el),
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
    range({ label: 'Непрозрачность', selector, prop: 'opacity', min: 0, max: 1, step: 0.01, read: () => num(cs(el).opacity), write: v => String(v) }),
    factor({ label: 'Контраст', selector, prop: 'filter:contrast' }),
  ] });
  return groups;
}
