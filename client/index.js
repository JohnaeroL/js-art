/* JS-Art entry point: live style layer + edit model + panel, wired to the dev server's save API. */
import { Model } from './model.js';
import { serialize } from './css-writer.js';
import { mountUI } from './ui.js';
import { saveOutcome } from './actions.js';
import { googleUrl, usedFonts } from './fonts.js';
import { applyTexts, textPayload, bake } from './texts.js';

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

/* Google Fonts stylesheets of the picked fonts, one <link> per family, added once */
const fontLinks = new Set();
function loadFonts(edits) {
  for (const name of usedFonts(edits)) {
    if (fontLinks.has(name)) continue;
    fontLinks.add(name);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = googleUrl([name]);
    link.dataset.jsArtFont = name;
    document.head.append(link);
  }
}

async function start() {
  if (window.__jsArt) return;
  window.__jsArt = true;

  const live = document.createElement('style');
  live.id = 'js-art-live';
  document.head.append(live);

  /* the page and its narrow helper window (ui.js) are two panels over one set of edits */
  const chan = typeof BroadcastChannel === 'function' ? new BroadcastChannel('js-art-sync') : null;
  let applying = false;
  let ui = null;
  const model = new Model(edits => {
    loadFonts(edits);
    applyTexts(edits);
    live.textContent = serialize(edits);
    if (ui) ui.sync();
    if (chan && !applying) chan.postMessage({ type: 'edits', edits });
  });
  if (chan) {
    chan.onmessage = ({ data: m }) => {
      if (m.type === 'edits') {
        applying = true;
        try { model.load(m.edits); } finally { applying = false; }
      } else if (m.type === 'baked') m.selectors.forEach(bake);
      else if (m.type === 'saved' && ui) ui.markSaved();
    };
  }

  /* the saved state is the source of truth while editing: the saved file is switched off so
     resetting a control really returns to the site's own value */
  const state = await fetch(API + '/state').then(r => (r.ok ? r.json() : null)).catch(() => null);
  if (state && Array.isArray(state.edits)) {
    document.querySelectorAll('link[data-js-art], link[href*="js-art.css"]').forEach(l => { if (l.sheet) l.sheet.disabled = true; else l.disabled = true; });
    model.load(state.edits);
  }

  ui = mountUI({
    model,
    initial: { popup: window.name === 'jsart-mobile' },
    async onSave() {
      const all = model.list();
      const edits = all.filter(e => e.prop !== '@text');
      const texts = textPayload(all);
      const css = serialize(edits, { header: true, imports: true });
      let res = null, out = null;
      try {
        res = await fetch(API + '/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ css, state: { version: 1, edits }, texts, page: location.pathname, fonts: usedFonts(edits) }),
        });
        out = await res.json().catch(() => null);
      } catch { /* network error: no server */ }
      const outcome = saveOutcome(res ? res.status : 0, out);
      if (outcome === 'error') return { ok: false, text: 'Ошибка сохранения: ' + (out.error || res.status) };
      if (outcome === 'ok') {
        const name = out.file ? out.file.split(/[\\/]/).slice(-2).join('/') : 'js-art.css';
        let text = `Сохранено в ${name}` + (out.backup ? ' · бэкап в history/' : ''), kind = 'ok';
        const results = out.texts || [];
        /* a text written into the HTML is part of the page now: stop treating it as a pending edit */
        if (chan) chan.postMessage({ type: 'baked', selectors: results.map((t, i) => t.ok && texts[i].selector).filter(Boolean) });
        results.forEach((t, i) => { if (t.ok) { bake(texts[i].selector); model.set(texts[i].selector, '@text', null); } });
        const done = results.filter(t => t.ok).length, failed = results.filter(t => !t.ok);
        const fonts = out.fonts || [], badFonts = fonts.filter(f => !f.ok);
        if (fonts.length && !badFonts.length) text += ` · шрифты сохранены в проект (${fonts.length})`;
        if (badFonts.length) { text += ` · шрифты остались на Google Fonts: ${badFonts[0].error}`; kind = 'err'; }
        if (done) text += ` · текстов в HTML: ${done}`;
        if (failed.length) { text += ` · текст не записан: ${failed[0].error}` + (failed.length > 1 ? ` (+${failed.length - 1})` : ''); kind = 'err'; }
        if (chan) chan.postMessage({ type: 'saved' });
        return { ok: true, text, kind, rerender: done > 0 };
      }
      /* opened without the JS-Art server (or on a plain static server): hand the CSS over instead */
      try { await navigator.clipboard.writeText(css); } catch { /* clipboard blocked */ }
      download('js-art.css', css);
      return { ok: true, text: 'Сервер не найден — CSS скопирован и скачан' + (texts.length ? '; правки текста без сервера не сохраняются' : '') };
    },
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
