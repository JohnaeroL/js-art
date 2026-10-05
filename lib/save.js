/* Writes the result into the project: CSS file, panel state, backups, and the <link> in the site's HTML. */
import fs from 'node:fs/promises';
import path from 'node:path';

const MARK = '<!-- js-art -->';

export function insertLink(html, href) {
  if (html.includes(MARK)) return { html, changed: false };
  const tag = `${MARK}<link rel="stylesheet" href="${href}">`;
  const headEnd = html.search(/<\/head>/i);
  const head = headEnd < 0 ? html : html.slice(0, headEnd);
  /* after the last stylesheet so the overrides win the cascade */
  let at = -1;
  for (const m of head.matchAll(/<link\b[^>]*\brel=["']?stylesheet["']?[^>]*>/gi)) at = m.index + m[0].length;
  if (at < 0) at = headEnd < 0 ? 0 : headEnd;
  return { html: html.slice(0, at) + tag + html.slice(at), changed: true };
}

const pad = n => String(n).padStart(2, '0');
export const backupName = d =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}.css`;

const exists = p => fs.access(p).then(() => true, () => false);

export async function save({ root, out, toolDir, css, state, now = new Date() }) {
  const file = path.join(root, out);
  let backup = null;
  if (await exists(file)) {
    backup = path.join(toolDir, 'history', backupName(now));
    await fs.mkdir(path.dirname(backup), { recursive: true });
    await fs.copyFile(file, backup);
  }
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, css);
  await fs.mkdir(toolDir, { recursive: true });
  await fs.writeFile(path.join(toolDir, 'state.json'), JSON.stringify(state, null, 2) + '\n');

  const href = out.split(path.sep).join('/');
  const linked = [];
  for (const name of await fs.readdir(root)) {
    if (!name.toLowerCase().endsWith('.html')) continue;
    const p = path.join(root, name);
    const r = insertLink(await fs.readFile(p, 'utf8'), href);
    if (r.changed) { await fs.writeFile(p, r.html); linked.push(name); }
  }
  return { file, backup, linked };
}
