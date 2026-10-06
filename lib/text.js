/* Writes edited text into HTML source. A text edit is {from, to, index, total}: `from` is the element's text,
   `total` how many leaf elements of the page carry exactly that text, `index` which of them (in document order)
   was edited. The text is only replaced when the source has exactly `total` places of `<tag>from</` — otherwise the
   edit is reported as failed and the file is left alone. */

const WS = '[ \t\r\n]';
const trim = s => s.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');

const char = c => ({
  '&': '(?:&amp;|&)', '<': '&lt;', '>': '(?:&gt;|>)', '"': '(?:&quot;|")', "'": "(?:&#39;|&#x27;|&apos;|')", ' ': '(?:&nbsp;| )',
}[c] || ('.*+?^${}()|[]\\/-'.includes(c) ? '\\' + c : c));

/* regex source for a text: whitespace runs match any run of whitespace, special characters match their entity */
export const textPattern = text => trim(text).split(/[ \t\r\n]+/).map(w => [...w].map(char).join('')).join(WS + '+');

export const escapeText = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* [start, end] of every `<tag>text</` in html, text being the trimmed `from` */
export function findText(html, from) {
  if (!trim(from)) return [];
  const re = new RegExp(`<[a-zA-Z][^<>]*>${WS}*(${textPattern(from)})${WS}*(?=</)`, 'dg');
  return [...html.matchAll(re)].map(m => m.indices[1]);
}

export function applyTextEdits(html, edits) {
  const jobs = [];
  const results = edits.map(e => {
    const at = findText(html, e.from);
    if (!at.length) return { ok: false, error: 'текст не найден в HTML' };
    if (at.length !== e.total) return { ok: false, error: `в HTML ${at.length} совпадений, на странице ${e.total} — неоднозначно` };
    const pos = at[e.index];
    if (!pos) return { ok: false, error: 'не найден элемент' };
    if (jobs.some(j => j.pos[0] === pos[0])) return { ok: false, error: 'тот же текст уже правится другой правкой' };
    jobs.push({ pos, to: escapeText(trim(e.to)) });
    return { ok: true };
  });
  let out = html;
  for (const j of jobs.sort((a, b) => b.pos[0] - a.pos[0])) out = out.slice(0, j.pos[0]) + j.to + out.slice(j.pos[1]);
  return { html: out, results };
}
