/* Font catalog: popular free Google Fonts, all with Cyrillic. Nothing is bundled — a font is loaded from the
   Google Fonts CSS API when it is picked, and the saved CSS starts with the matching @import.
   Entry: [name, category, weights, hasItalic]. Pure — tested in Node. */

const R = (a, b) => Array.from({ length: (b - a) / 100 + 1 }, (_, i) => a + i * 100);

const LIST = [
  ['Roboto', 'sans-serif', [100, 300, 400, 500, 700, 900], true],
  ['Open Sans', 'sans-serif', R(300, 800), true],
  ['Montserrat', 'sans-serif', R(100, 900), true],
  ['Inter', 'sans-serif', R(100, 900), false],
  ['Noto Sans', 'sans-serif', R(100, 900), true],
  ['Raleway', 'sans-serif', R(100, 900), true],
  ['Nunito', 'sans-serif', R(200, 900), true],
  ['Ubuntu', 'sans-serif', [300, 400, 500, 700], true],
  ['PT Sans', 'sans-serif', [400, 700], true],
  ['Rubik', 'sans-serif', R(300, 900), true],
  ['Manrope', 'sans-serif', R(200, 800), false],
  ['Oswald', 'sans-serif', R(200, 700), false],
  ['Source Sans 3', 'sans-serif', R(200, 900), true],
  ['IBM Plex Sans', 'sans-serif', R(100, 700), true],
  ['Fira Sans', 'sans-serif', R(100, 900), true],
  ['Exo 2', 'sans-serif', R(100, 900), true],
  ['Golos Text', 'sans-serif', R(400, 900), false],
  ['Onest', 'sans-serif', R(100, 900), false],
  ['Playfair Display', 'serif', R(400, 900), true],
  ['Merriweather', 'serif', [300, 400, 700, 900], true],
  ['Lora', 'serif', R(400, 700), true],
  ['PT Serif', 'serif', [400, 700], true],
  ['Noto Serif', 'serif', R(100, 900), true],
  ['Unbounded', 'sans-serif', R(200, 900), false],
  ['Caveat', 'cursive', R(400, 700), false],
  ['Comfortaa', 'sans-serif', R(300, 700), false],
  ['Pacifico', 'cursive', [400], false],
  ['Roboto Mono', 'monospace', R(100, 700), true],
  ['JetBrains Mono', 'monospace', R(100, 800), true],
  ['Fira Code', 'monospace', R(300, 700), false],
];

export const FONTS = LIST.map(([name, category, weights, italic]) => ({ name, category, weights, italic }));
const byName = new Map(FONTS.map(f => [f.name.toLowerCase(), f]));

export const findFont = name => byName.get(String(name).trim().toLowerCase()) || null;

/* the first family of a font-family value, without quotes: '"Open Sans", sans-serif' → 'Open Sans' */
export function firstFamily(value) {
  const m = /^\s*(?:"([^"]+)"|'([^']+)'|([^,]+))/.exec(value || '');
  return m ? (m[1] || m[2] || m[3]).trim() : '';
}

/* what goes into font-family: the fallback keeps text readable while the font loads */
export function fontStack(name) {
  const f = findFont(name);
  return f ? `"${f.name}", ${f.category}` : name;
}

/* catalog font behind a written font-family value, or null */
export const fontOf = value => findFont(firstFamily(value));

/* Google Fonts CSS2 URL for the given family names (unknown names are skipped; null when none is left) */
export function googleUrl(names) {
  const fams = [...new Set(names)].map(findFont).filter(Boolean).map(f => {
    const q = encodeURIComponent(f.name).replace(/%20/g, '+');
    if (!f.italic) return `family=${q}:wght@${f.weights.join(';')}`;
    const tuples = [0, 1].flatMap(i => f.weights.map(w => `${i},${w}`));
    return `family=${q}:ital,wght@${tuples.join(';')}`;
  });
  return fams.length ? `https://fonts.googleapis.com/css2?${fams.join('&')}&display=swap` : null;
}

/* the families used by an edit list, in order of appearance */
export const usedFonts = edits => [...new Set(edits
  .filter(e => e.prop === 'font-family')
  .map(e => fontOf(e.value))
  .filter(Boolean)
  .map(f => f.name))];

/* ───── preview in the picker ───── */

export const SAMPLE = 'Съешь ещё этих мягких булок 123';
const ALPHABET = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюяABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?-—';

/* One Google Fonts request for the whole catalog, regular weight, only the glyphs the picker shows:
   a few KB per family instead of full font files. */
export function previewUrl() {
  const fams = FONTS.map(f => `family=${encodeURIComponent(f.name).replace(/%20/g, '+')}:wght@${f.weights.includes(400) ? 400 : f.weights[0]}`);
  const glyphs = [...new Set(ALPHABET + SAMPLE)].join('');
  return `https://fonts.googleapis.com/css2?${fams.join('&')}&text=${encodeURIComponent(glyphs)}&display=swap`;
}

/* The picker draws samples with its own family names, so they never touch the site's fonts of the same name */
export const previewFamily = name => `"jsa-${name}", ${(findFont(name) || { category: 'sans-serif' }).category}`;

/* [{family, url, range}] from the preview css */
export function parsePreview(css) {
  const out = [];
  for (const block of css.split('@font-face').slice(1)) {
    const family = /font-family:\s*'([^']+)'/.exec(block);
    const url = /url\(([^)]+)\)/.exec(block);
    const range = /unicode-range:\s*([^;}]+)/.exec(block);
    if (family && url) out.push({ family: family[1], url: url[1].replace(/['"]/g, ''), range: range ? range[1].trim() : '' });
  }
  return out;
}
