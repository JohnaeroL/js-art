/* Self-hosting for the picked Google Fonts: the font files go into the site (<root>/fonts/js-art/), so the saved
   js-art.css works offline and without a third-party request. Only the latin and cyrillic subsets are kept.
   Each family is downloaded once; its @font-face rules are cached next to the files. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { findFont, googleUrl } from '../client/fonts.js';

const KEEP = new Set(['latin', 'cyrillic']);
/* Google serves woff2 with per-subset files only to a browser-like agent */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const GOOGLE_IMPORT = /@import url\("https:\/\/fonts\.googleapis\.com[^"]*"\);\n*/;

export const slug = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* [{subset, css}] of the @font-face blocks Google answers with; each one is preceded by a comment naming its subset */
export function parseFaces(cssText) {
  const out = [];
  for (const m of cssText.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)) out.push({ subset: m[1], css: m[2] });
  return out;
}

const urlOf = face => (/url\((https:[^)]+)\)/.exec(face) || [])[1];

/* rules of one family with bare file names (relative to the fonts directory); downloads what is missing */
export async function ensureFamily({ name, fontsDir, fetchImpl = fetch }) {
  const font = findFont(name);
  if (!font) throw new Error(`неизвестный шрифт: ${name}`);
  const cache = path.join(fontsDir, slug(font.name) + '.css');
  try { return await fs.readFile(cache, 'utf8'); } catch { /* not downloaded yet */ }

  const res = await fetchImpl(googleUrl([font.name]), { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Google Fonts ответил ${res.status}`);
  const faces = parseFaces(await res.text()).filter(f => KEEP.has(f.subset));
  if (!faces.length) throw new Error('в ответе Google Fonts нет latin/cyrillic');

  await fs.mkdir(fontsDir, { recursive: true });
  const files = new Map(); /* a variable font is one file for many weights */
  const blocks = [];
  for (const f of faces) {
    const url = urlOf(f.css);
    if (!url) continue;
    if (!files.has(url)) {
      const file = `${slug(font.name)}-${f.subset}-${crypto.createHash('sha1').update(url).digest('hex').slice(0, 8)}.woff2`;
      const r = await fetchImpl(url, { headers: { 'User-Agent': UA } });
      if (!r.ok) throw new Error(`не скачался файл шрифта (${r.status})`);
      await fs.writeFile(path.join(fontsDir, file), Buffer.from(await r.arrayBuffer()));
      files.set(url, file);
    }
    blocks.push(`/* ${f.subset} */\n` + f.css.replace(/src:[^;]*;/, `src: url("${files.get(url)}") format("woff2");`));
  }
  const css = `/* ${font.name} — Google Fonts (SIL Open Font License) */\n${blocks.join('\n')}\n`;
  await fs.writeFile(cache, css);
  return css;
}

/* Replaces the Google @import in css with local @font-face rules of the given families.
   cssDir: directory of the saved css file (urls are made relative to it). Families that could not be
   fetched are reported and the @import stays, so the page still gets them from Google. */
export async function localizeFonts({ css, names, fontsDir, cssDir, fetchImpl }) {
  const results = [], parts = [];
  const rel = path.relative(cssDir, fontsDir).split(path.sep).join('/') || '.';
  for (const name of names) {
    try {
      const text = await ensureFamily({ name, fontsDir, fetchImpl });
      parts.push(text.replace(/url\("([^"/]+)"\)/g, `url("${rel}/$1")`));
      results.push({ name, ok: true });
    } catch (e) {
      results.push({ name, ok: false, error: e.message });
    }
  }
  if (!parts.length || results.some(r => !r.ok)) return { css, results };
  return { css: css.replace(GOOGLE_IMPORT, () => parts.join('\n') + '\n'), results };
}
