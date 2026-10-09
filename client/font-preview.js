/* Loads the picker's font samples once: every catalog font is registered under "jsa-<name>" with the FontFace API
   (see fonts.js), so the samples render in the real fonts without touching the page's own font-family names. */
import { previewUrl, parsePreview } from './fonts.js';

let loading = null;

export function loadPreviewFonts() {
  loading ||= (async () => {
    const res = await fetch(previewUrl());
    if (!res.ok) throw new Error(String(res.status));
    const faces = parsePreview(await res.text());
    await Promise.all(faces.map(async f => {
      const face = new FontFace('jsa-' + f.family, `url(${f.url})`, { unicodeRange: f.range || 'U+0-10FFFF', weight: '400' });
      document.fonts.add(await face.load());
    }));
  })().catch(() => { loading = null; /* offline: samples stay in the fallback font, try again next time */ });
  return loading;
}
