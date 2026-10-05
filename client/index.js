/* JS-Art entry point: live style layer + edit model + panel, wired to the dev server's save API. */
import { Model } from './model.js';
import { serialize } from './css-writer.js';
import { mountUI } from './ui.js';

const API = '/__js-art';

function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/css' }));
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function start() {
  if (window.__jsArt) return;
  window.__jsArt = true;

  const live = document.createElement('style');
  live.id = 'js-art-live';
  document.head.append(live);

  let ui = null;
  const model = new Model(edits => {
    live.textContent = serialize(edits);
    if (ui) ui.sync();
  });

  /* the saved state is the source of truth while editing: the saved file is switched off so
     resetting a control really returns to the site's own value */
  const state = await fetch(API + '/state').then(r => (r.ok ? r.json() : null)).catch(() => null);
  if (state && Array.isArray(state.edits)) {
    document.querySelectorAll('link[href*="js-art.css"]').forEach(l => { if (l.sheet) l.sheet.disabled = true; else l.disabled = true; });
    model.load(state.edits);
  }

  ui = mountUI({
    model,
    async onSave() {
      const edits = model.list();
      const css = serialize(edits, { header: true });
      try {
        const res = await fetch(API + '/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ css, state: { version: 1, edits } }),
        });
        if (res.status === 404 || res.status === 405) throw new Error('no server');
        const out = await res.json().catch(() => ({}));
        if (!res.ok || !out.ok) return { ok: false, text: 'Ошибка сохранения: ' + (out.error || res.status) };
        const name = out.file ? out.file.split(/[\\/]/).slice(-2).join('/') : 'js-art.css';
        return { ok: true, text: `Сохранено в ${name}` + (out.backup ? ' · бэкап в history/' : '') };
      } catch {
        /* opened without the JS-Art server: hand the CSS over instead */
        try { await navigator.clipboard.writeText(css); } catch { /* clipboard blocked */ }
        download('js-art.css', css);
        return { ok: true, text: 'Сервер не найден — CSS скопирован и скачан' };
      }
    },
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
