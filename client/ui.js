/* The panel: a floating button that opens a small window of sliders. Lives in Shadow DOM so the site's
   styles and the panel's styles never touch. */
import { toHex, formatColor, parseColor } from './color.js';
import { selectorFor } from './selector.js';
import { withOverridesDisabled, classStats } from './scan.js';
import { planApply, planReset, shortcut } from './actions.js';
import { pageControls, blockControls } from './controls.js';
import { startPicker } from './picker.js';

const store = {
  get(k, d) { try { const v = localStorage.getItem('js-art:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('js-art:' + k, JSON.stringify(v)); } catch { /* storage blocked */ } },
};

const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  logo: svg('<path d="M8 4h-.5C6 4 5 5 5 6.5v3C5 11 4 12 3 12c1 0 2 1 2 2.5v3C5 19 6 20 7.5 20H8M16 4h.5C18 4 19 5 19 6.5v3c0 1.5 1 2.5 2 2.5-1 0-2 1-2 2.5v3c0 1.5-1 2.5-2.5 2.5H16"/><path d="M12 8c1.8 2.3 2.8 3.8 2.8 5.3a2.8 2.8 0 0 1-5.6 0c0-1.5 1-3 2.8-5.3z" fill="currentColor" stroke="none"/>'),
  undo: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  redo: svg('<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>'),
  close: svg('<path d="M5 12h14"/>'),
  pick: svg('<circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>'),
  up: svg('<path d="m6 15 6-6 6 6"/>'),
  down: svg('<path d="m6 9 6 6 6-6"/>'),
  reset: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  move: svg('<path d="M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3"/>'),
  unlock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>'),
};

const LOGO = `<svg class="logo" viewBox="119 28 190 40" role="img" aria-label="JS-Art"><path fill="var(--fg)" d="M120.87 50.16L120.83 48.28L130.17 48.28L130.17 49.43Q130.17 53.47 131.84 55.61Q133.52 57.75 137.43 57.75L137.43 57.75Q141.25 57.75 143 55.75Q144.75 53.75 144.75 50.16L144.75 50.16L144.75 30.75L154.27 30.75L154.27 50.67Q154.27 55.45 152.15 58.90Q150.04 62.35 146.27 64.17Q142.49 65.99 137.43 65.99L137.43 65.99Q132.47 65.99 128.72 64.10Q124.97 62.21 122.92 58.65Q120.87 55.08 120.87 50.16L120.87 50.16ZM157.81 53.93L157.81 53.93L167.52 53.93Q167.75 55.36 168.85 56.42Q169.96 57.48 171.82 58.05Q173.68 58.63 176.21 58.63L176.21 58.63Q179.71 58.63 181.73 57.73Q183.76 56.83 183.76 55.08L183.76 55.08Q183.76 53.75 182.61 53.01Q181.46 52.28 178.19 51.96L178.19 51.96L171.75 51.36Q164.62 50.71 161.40 48.12Q158.18 45.52 158.18 41.10L158.18 41.10Q158.18 37.51 160.27 35.03Q162.37 32.54 166.16 31.28Q169.96 30.01 175.02 30.01L175.02 30.01Q179.98 30.01 183.85 31.42Q187.71 32.82 189.99 35.40Q192.27 37.97 192.45 41.38L192.45 41.38L182.79 41.38Q182.61 40.13 181.62 39.24Q180.63 38.34 178.93 37.86Q177.22 37.37 174.83 37.37L174.83 37.37Q171.61 37.37 169.73 38.23Q167.84 39.08 167.84 40.73L167.84 40.73Q167.84 41.93 168.97 42.66Q170.09 43.40 173.04 43.68L173.04 43.68L179.89 44.37Q184.81 44.83 187.76 45.95Q190.70 47.08 192.04 49.06Q193.37 51.04 193.37 53.98L193.37 53.98Q193.37 57.61 191.21 60.30Q189.05 63.00 185.14 64.49Q181.23 65.99 176.03 65.99L176.03 65.99Q170.69 65.99 166.62 64.49Q162.55 63.00 160.25 60.26Q157.95 57.52 157.81 53.93ZM196.50 52.88L196.50 45.47L208.60 45.47L208.60 52.88L196.50 52.88Z"/><path fill="var(--acc)" d="M243.88 58.63L220.10 58.63L220.10 50.94L243.88 50.94L243.88 58.63ZM225.89 30.75L238.45 30.75L254.14 65.25L243.97 65.25L230.81 34.80L233.57 34.80L220.37 65.25L210.21 65.25L225.89 30.75ZM256.34 47.82L254.60 38.98L264.16 38.98L265.73 48.37L265.73 65.25L256.34 65.25L256.34 47.82ZM278.06 38.57L278.06 38.57L278.06 46.57Q276.68 46.30 275.46 46.18Q274.24 46.07 273.23 46.07L273.23 46.07Q271.20 46.07 269.50 46.87Q267.80 47.68 266.76 49.52Q265.73 51.36 265.73 54.44L265.73 54.44L263.93 52.23Q264.30 49.38 265.04 46.87Q265.77 44.37 267.04 42.41Q268.30 40.46 270.19 39.33Q272.08 38.20 274.79 38.20L274.79 38.20Q275.57 38.20 276.40 38.29Q277.23 38.39 278.06 38.57ZM283.39 45.93L278.06 45.93L278.06 41.84L283.39 39.67L287.44 31.90L292.78 31.90L292.78 38.98L303.82 38.98L303.82 45.93L292.78 45.93L292.78 53.66Q292.78 56.51 293.93 57.66Q295.08 58.81 298.11 58.81L298.11 58.81Q300.04 58.81 301.54 58.47Q303.03 58.12 304.28 57.57L304.28 57.57L304.28 64.65Q302.90 65.16 300.64 65.57Q298.39 65.99 296.00 65.99L296.00 65.99Q291.63 65.99 288.84 64.65Q286.06 63.32 284.73 60.81Q283.39 58.30 283.39 54.95L283.39 54.95L283.39 45.93Z"/></svg>`;
const DARK = '--bg:#1c1c20;--bg2:#2a2a30;--fg:#f4f4f5;--mut:#a1a1aa;--line:rgba(255,255,255,.09);--acc:#8b7fff;--acc-fg:#fff;--shadow:0 16px 48px -12px rgba(0,0,0,.75),0 0 0 1px rgba(255,255,255,.08)';

const CSS = `
:host{all:initial;--bg:#fff;--bg2:#f2f2f5;--fg:#18181b;--mut:#71717a;--line:rgba(0,0,0,.09);--acc:#6d5efc;--acc-fg:#fff;--shadow:0 16px 48px -12px rgba(0,0,0,.3),0 0 0 1px rgba(0,0,0,.07)}
@media (prefers-color-scheme:dark){:host(:not([data-theme=light])){${DARK}}}
:host([data-theme=dark]){${DARK}}
*{box-sizing:border-box;margin:0;font:inherit;color:inherit}
.wrap{font:400 12.5px/1.4 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--fg);-webkit-font-smoothing:antialiased}
button{background:none;border:0;padding:0;cursor:pointer}
button:focus-visible,input:focus-visible,summary:focus-visible{outline:2px solid var(--acc);outline-offset:1px}
svg{width:16px;height:16px;display:block}
.fab{position:fixed;z-index:2147483647;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:var(--acc);color:var(--acc-fg);box-shadow:var(--shadow);touch-action:none;transition:transform .2s}
.fab:hover{transform:scale(1.06)}
.fab svg{width:20px;height:20px}
.fab.dirty::after{content:"";position:absolute;top:2px;right:2px;width:10px;height:10px;border-radius:50%;background:#ffb020;border:2px solid var(--bg)}
.panel{position:fixed;z-index:2147483647;width:320px;display:flex;flex-direction:column;max-height:calc(100vh - 100px);background:var(--bg);border-radius:14px;box-shadow:var(--shadow);overflow:hidden}
.panel[hidden]{display:none}
.wrap.open .fab{visibility:hidden}
.top{cursor:grab;touch-action:none;user-select:none;display:flex;align-items:center;gap:6px;padding:8px 8px 8px 14px;border-bottom:1px solid var(--line)}
.top.moving{cursor:grabbing}
.brand{flex:1;display:flex}
.logo{height:13px;width:auto;display:block}
.ib{width:28px;height:28px;border-radius:7px;display:grid;place-items:center;color:var(--mut)}
.ib:hover:not(:disabled){background:var(--bg2);color:var(--fg)}
.ib.on{background:var(--acc);color:var(--acc-fg)}
.ib:disabled{opacity:.35;cursor:default}
.seg{display:flex;gap:2px;padding:2px;border-radius:8px;background:var(--bg2)}
.seg button{flex:1;height:26px;padding:0 8px;border-radius:6px;font-weight:500;color:var(--mut);white-space:nowrap}
.seg button.on{background:var(--bg);color:var(--fg);box-shadow:0 1px 2px rgba(0,0,0,.12)}
.scope{margin:10px 12px 4px}
.blockbar{display:grid;gap:6px;padding:8px 12px;border-bottom:1px solid var(--line)}
.blockbar[hidden]{display:none}
.row{display:flex;align-items:center;gap:6px;min-width:0}
.pick{display:flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:7px;background:var(--acc);color:var(--acc-fg);font-weight:600;white-space:nowrap}
.pick.on{background:var(--fg);color:var(--bg)}
.selname{flex:1;min-width:0;height:28px;line-height:28px;padding:0 8px;border-radius:7px;background:var(--bg2);font:11.5px/28px ui-monospace,SFMono-Regular,Consolas,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.count{color:var(--mut);font-size:11px;white-space:nowrap}
.mode{flex:1}
.body{flex:1;overflow:auto;overscroll-behavior:contain;padding:4px 0 8px}
.hint{padding:16px 14px;color:var(--mut)}
.hint b{color:var(--fg)}
details{border-bottom:1px solid var(--line)}
details:last-child{border-bottom:0}
summary{display:flex;align-items:center;gap:8px;padding:10px 12px 10px 14px;font-weight:600;cursor:pointer;list-style:none;user-select:none}
summary::-webkit-details-marker{display:none}
summary::before{content:"";width:6px;height:6px;border-right:1.5px solid var(--mut);border-bottom:1.5px solid var(--mut);transform:rotate(-45deg);transition:transform .2s;margin-right:2px}
details[open]>summary::before{transform:rotate(45deg)}
summary .lbl{flex:1}
.badge{min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:var(--acc);color:var(--acc-fg);font-size:10.5px;line-height:18px;text-align:center}
.badge:empty{display:none}
summary .ib{width:24px;height:24px}
summary .ib.on{color:var(--acc)}
.sub{padding:8px 14px 2px;font-size:10.5px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--mut)}
.ctl{padding:5px 12px 5px 14px}
.lab{display:flex;align-items:center;gap:6px;min-height:24px}
.name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--mut)}
.ctl.mod .name{color:var(--fg);font-weight:500}
.ctl.mod .name::before{content:"";display:inline-block;width:6px;height:6px;margin:0 6px 1px 0;border-radius:50%;background:var(--acc)}
.num,.hex{height:24px;padding:0 6px;border:1px solid transparent;border-radius:6px;background:var(--bg2);font:11.5px ui-monospace,SFMono-Regular,Consolas,monospace;text-align:right}
.num{width:66px}
.hex{width:118px;text-align:left}
.txt{display:block;width:100%;min-height:64px;margin-top:4px;padding:6px 8px;border:1px solid transparent;border-radius:6px;background:var(--bg2);color:var(--fg);font-size:12.5px;line-height:1.4;resize:vertical}
.txt:focus{outline:none;border-color:var(--acc)}
.opt{flex:0 1 150px;min-width:0;height:24px;padding:0 4px;border:1px solid transparent;border-radius:6px;background:var(--bg2);color:var(--fg);font-size:11.5px;cursor:pointer}
.opt:focus{outline:none;border-color:var(--acc)}
.opt option{background:var(--bg);color:var(--fg)}
.num:focus,.hex:focus{outline:none;border-color:var(--acc)}
.num::-webkit-inner-spin-button{display:none}
.num{-moz-appearance:textfield}
.unit{width:14px;color:var(--mut);font-size:11px}
.rst{width:22px;height:22px;border-radius:6px;display:grid;place-items:center;color:var(--mut);visibility:hidden}
.rst svg{width:13px;height:13px}
.ctl.mod .rst{visibility:visible}
.rst:hover{background:var(--bg2);color:var(--fg)}
.sw{width:24px;height:24px;padding:0;border:0;border-radius:6px;background:none;cursor:pointer}
.sw::-webkit-color-swatch-wrapper{padding:0}
.sw::-webkit-color-swatch{border:1px solid var(--line);border-radius:6px}
.sw::-moz-color-swatch{border:1px solid var(--line);border-radius:6px}
.alpha{display:flex;align-items:center;gap:8px}
.pct{width:34px;text-align:right;color:var(--mut);font:11px ui-monospace,SFMono-Regular,Consolas,monospace}
input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:20px;background:transparent;cursor:pointer}
input[type=range]::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:var(--bg2)}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;margin-top:-5px;border-radius:50%;background:var(--acc);border:2px solid var(--bg);box-shadow:0 0 0 1px var(--acc)}
input[type=range]::-moz-range-track{height:4px;border-radius:2px;background:var(--bg2)}
input[type=range]::-moz-range-thumb{width:12px;height:12px;border-radius:50%;background:var(--acc);border:2px solid var(--bg)}
.alpha input[type=range]::-webkit-slider-runnable-track{background:linear-gradient(90deg,transparent,var(--swatch,#888)),repeating-conic-gradient(#ccc 0 25%,#fff 0 50%) 0 0/8px 8px}
.foot{display:flex;align-items:center;gap:8px;padding:10px 12px;border-top:1px solid var(--line)}
.status{flex:1;min-width:0;font-size:11px;color:var(--mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.status.err{color:#e5484d}.status.ok{color:#30a46c}
.ghost{height:30px;padding:0 10px;border-radius:8px;border:1px solid var(--line);color:var(--mut);white-space:nowrap}
.ghost:hover{color:var(--fg);border-color:var(--mut)}
.primary{height:30px;padding:0 14px;border-radius:8px;background:var(--acc);color:var(--acc-fg);font-weight:600;white-space:nowrap}
.primary:disabled{opacity:.6;cursor:default}
.box{position:fixed;z-index:2147483646;pointer-events:none;border:2px solid var(--acc);background:color-mix(in srgb,var(--acc) 12%,transparent);border-radius:3px}
.box.sel{border-style:dashed;background:none}
.box[hidden]{display:none}
.box span{position:absolute;left:-2px;bottom:100%;margin-bottom:4px;padding:2px 6px;border-radius:4px;background:var(--acc);color:var(--acc-fg);font:11px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:nowrap;max-width:80vw;overflow:hidden;text-overflow:ellipsis}
.box.below span{bottom:auto;top:100%;margin:4px 0 0}
@media (max-width:560px){
  .panel{left:0!important;right:0!important;bottom:0!important;top:auto!important;width:auto;max-height:72vh!important;border-radius:16px 16px 0 0}
  .wrap.open .fab{display:none}
  .ctl{padding-block:7px}
}
`;

const HTML = `
<div class="wrap">
  <div class="box" data-el="hl" hidden><span></span></div>
  <div class="box sel" data-el="selbox" hidden><span></span></div>
  <button class="fab" data-el="fab" type="button" aria-label="JS-Art: открыть панель" title="JS-Art">${ICON.logo}</button>
  <section class="panel" data-el="panel" role="dialog" aria-label="JS-Art" hidden>
    <header class="top">
      <span class="brand">${LOGO}</span>
      <button class="ib" data-act="theme" type="button"></button>
      <button class="ib" data-act="undo" type="button" title="Отменить (Ctrl+Z)" aria-label="Отменить">${ICON.undo}</button>
      <button class="ib" data-act="redo" type="button" title="Повторить (Ctrl+Shift+Z)" aria-label="Повторить">${ICON.redo}</button>
      <button class="ib" data-act="close" type="button" title="Свернуть (Esc)" aria-label="Свернуть">${ICON.close}</button>
    </header>
    <div class="seg scope" role="tablist" aria-label="Зона действия">
      <button type="button" role="tab" data-scope="page">Страница</button>
      <button type="button" role="tab" data-scope="block">Блок</button>
    </div>
    <div class="blockbar" data-el="blockbar" hidden>
      <div class="row">
        <button class="pick" data-act="pick" type="button">${ICON.pick}<span>Выбрать</span></button>
        <code class="selname" data-el="selname">—</code>
        <span class="count" data-el="count"></span>
      </div>
      <div class="row">
        <button class="ib" data-act="up" type="button" title="Родительский элемент" aria-label="Родительский элемент">${ICON.up}</button>
        <button class="ib" data-act="move" type="button" title="Двигать блок мышью на странице" aria-label="Двигать блок" aria-pressed="false">${ICON.move}</button>
        <button class="ib" data-act="down" type="button" title="Дочерний элемент" aria-label="Дочерний элемент">${ICON.down}</button>
        <div class="seg mode" role="group" aria-label="Охват">
          <button type="button" data-mode="all" title="Все элементы с таким же селектором">Все такие</button>
          <button type="button" data-mode="one" title="Только выбранный элемент">Только этот</button>
        </div>
      </div>
    </div>
    <div class="body" data-el="body"></div>
    <footer class="foot">
      <button class="ghost" data-act="resetall" type="button" title="Вернуть все исходные значения">Сбросить всё</button>
      <span class="status" data-el="status" role="status" aria-live="polite"></span>
      <button class="primary" data-act="save" type="button">Сохранить</button>
    </footer>
  </section>
</div>`;

const decimals = step => (step >= 1 ? 0 : Math.ceil(-Math.log10(step) - 1e-9));
const fmt = (v, step) => String(Number(v.toFixed(decimals(step))));
const h = (tag, cls, html = '') => Object.assign(document.createElement(tag), { className: cls, innerHTML: html });

export function mountUI({ model, onSave }) {
  const host = document.createElement('js-art-root');
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${CSS}</style>${HTML}`;
  document.body.append(host);
  const $ = name => root.querySelector(`[data-el="${name}"]`);
  const wrap = root.querySelector('.wrap'), fab = $('fab'), panel = $('panel'), body = $('body');
  const status = $('status'), hl = $('hl'), selbox = $('selbox');
  const act = name => root.querySelector(`[data-act="${name}"]`);

  const dark = matchMedia('(prefers-color-scheme: dark)');
  const state = {
    theme: store.get('theme', null),
    open: store.get('open', false),
    scope: store.get('scope', 'page'),
    pos: store.get('pos', { right: 20, bottom: 20 }),
    panelPos: store.get('panelPos', null),
    groupsOpen: store.get('groups', {}),
    mode: 'all',
    el: null,
    /* margin starts unlocked: locking would turn `margin: 0 auto` into px and un-centre the block */
    locks: { padding: true, margin: false },
    rows: [],
    saved: JSON.stringify(model.list()),
    flash: null,
    stopPick: null,
  };

  /* ───── values ───── */
  const editsOf = r => r.c.keys.map(k => model.get(k.selector, k.prop)).filter(Boolean);
  const current = r => { const e = editsOf(r).find(x => x.ui != null); return e ? e.ui : r.orig; };
  const run = plan => plan.forEach(p => model.set(...p));

  function apply(r, v) {
    const { c } = r;
    const siblings = c.lock && state.locks[c.lock]
      ? state.rows.filter(o => o !== r && o.c.lock === c.lock && o.c.keys[0].selector === c.keys[0].selector)
      : [];
    run(planApply(r, v, siblings));
  }

  /* one undo step per gesture: begin() on the first input event, the change event ends the gesture */
  function gesture(r, input, read) {
    input.addEventListener('input', () => {
      if (!r.dragging) { model.begin(); r.dragging = true; }
      apply(r, read());
    });
    input.addEventListener('change', () => { r.dragging = false; });
  }

  /* ───── rows ───── */
  function rangeRow(c, orig) {
    const row = h('div', 'ctl', `<div class="lab"><span class="name"></span><input class="num" type="number" inputmode="decimal"><span class="unit"></span><button class="rst" type="button" title="Вернуть исходное (${fmt(orig, c.step)}${c.unit === '×' ? '×' : c.unit})">${ICON.reset}</button></div><input type="range">`);
    row.querySelector('.name').textContent = c.label;
    row.querySelector('.unit').textContent = c.unit;
    const range = row.querySelector('input[type=range]'), num = row.querySelector('.num');
    Object.assign(range, { min: Math.min(c.min, orig), max: Math.max(c.max, orig), step: c.step });
    num.step = c.step;
    range.setAttribute('aria-label', (c.sub ? c.sub + ' — ' : '') + c.label);
    num.setAttribute('aria-label', range.getAttribute('aria-label'));
    const r = { c, orig, row };
    gesture(r, range, () => +range.value);
    num.addEventListener('change', () => {
      const v = parseFloat(num.value.replace(',', '.'));
      if (isNaN(v)) return r.show(current(r));
      model.begin(); apply(r, v);
    });
    r.show = v => {
      range.value = v;
      if (root.activeElement !== num) num.value = fmt(v, c.step);
    };
    return r;
  }

  function selectRow(c, orig) {
    const row = h('div', 'ctl', `<div class="lab"><span class="name"></span><select class="opt"></select><button class="rst" type="button">${ICON.reset}</button></div>`);
    const options = c.options(orig);
    row.querySelector('.name').textContent = c.label;
    row.querySelector('.rst').title = 'Вернуть исходное (' + (options[0] ? options[0].label : '') + ')';
    const sel = row.querySelector('.opt');
    for (const o of options) sel.append(Object.assign(document.createElement('option'), { value: o.value, textContent: o.label }));
    sel.setAttribute('aria-label', (c.sub ? c.sub + ' — ' : '') + c.label);
    const r = { c, orig, row };
    sel.addEventListener('change', () => { model.begin(); apply(r, sel.value); });
    r.show = v => { sel.value = v; };
    return r;
  }

  function textRow(c, orig) {
    const row = h('div', 'ctl', `<div class="lab"><span class="name"></span><button class="rst" type="button" title="Вернуть исходный текст">${ICON.reset}</button></div><textarea class="txt" rows="3" spellcheck="false"></textarea>`);
    row.querySelector('.name').textContent = c.label;
    const ta = row.querySelector('.txt');
    ta.setAttribute('aria-label', c.label);
    const r = { c, orig, row };
    gesture(r, ta, () => ta.value);
    r.show = v => { if (root.activeElement !== ta) ta.value = v; };
    return r;
  }

  function colorRow(c, orig) {
    const row = h('div', 'ctl color', `<div class="lab"><span class="name"></span><input class="sw" type="color"><input class="hex" spellcheck="false" autocomplete="off"><button class="rst" type="button" title="Вернуть исходное (${formatColor(orig)})">${ICON.reset}</button></div><div class="alpha"><input type="range" min="0" max="1" step="0.01"><span class="pct"></span></div>`);
    row.querySelector('.name').textContent = c.label;
    row.querySelector('.name').title = c.label;
    const sw = row.querySelector('.sw'), hex = row.querySelector('.hex'), alpha = row.querySelector('input[type=range]'), pct = row.querySelector('.pct');
    const label = (c.sub ? c.sub + ' — ' : '') + c.label;
    sw.setAttribute('aria-label', label + ': цвет');
    hex.setAttribute('aria-label', label + ': значение');
    alpha.setAttribute('aria-label', label + ': прозрачность');
    const r = { c, orig, row };
    gesture(r, sw, () => {
      const cur = current(r), p = parseColor(sw.value);
      return { ...p, a: cur.a === 0 ? 1 : cur.a }; /* picking a colour for a transparent background makes it visible */
    });
    gesture(r, alpha, () => ({ ...current(r), a: +alpha.value }));
    hex.addEventListener('change', () => {
      const p = parseColor(hex.value);
      if (!p) return r.show(current(r));
      model.begin(); apply(r, p);
    });
    r.show = v => {
      sw.value = toHex(v);
      if (root.activeElement !== hex) hex.value = formatColor(v);
      alpha.value = v.a;
      alpha.style.setProperty('--swatch', toHex(v));
      pct.textContent = Math.round(v.a * 100) + '%';
    };
    return r;
  }

  /* ───── render ───── */
  function render() {
    state.rows = [];
    body.textContent = '';
    if (!state.open) return;
    if (state.scope === 'block' && !state.el) {
      body.innerHTML = '<p class="hint">Нажмите <b>Выбрать</b> и кликните по элементу на сайте — правки применятся к нему и всем таким же блокам. Esc отменяет выбор.</p>';
      sync();
      return;
    }
    const sel = state.el && selectorFor(state.el, state.mode, { stats: classStats });
    const groups = withOverridesDisabled(() => {
      const gs = state.scope === 'page' ? pageControls() : blockControls(state.el, sel);
      for (const g of gs) for (const c of g.controls) c.orig = c.read();
      return gs;
    });
    const openMap = state.groupsOpen[state.scope] || {};
    groups.forEach((g, i) => {
      const det = h('details', 'grp');
      det.open = openMap[g.id] ?? i === 0;
      det.addEventListener('toggle', () => {
        (state.groupsOpen[state.scope] ||= {})[g.id] = det.open;
        store.set('groups', state.groupsOpen);
      });
      const sum = h('summary', '', `<span class="lbl"></span><span class="badge"></span>`);
      sum.querySelector('.lbl').textContent = g.label;
      if (g.lock) {
        const lock = h('button', 'ib' + (state.locks[g.lock] ? ' on' : ''), state.locks[g.lock] ? ICON.lock : ICON.unlock);
        lock.type = 'button';
        lock.title = 'Все стороны вместе';
        lock.setAttribute('aria-pressed', state.locks[g.lock]);
        lock.addEventListener('click', e => {
          e.preventDefault();
          state.locks[g.lock] = !state.locks[g.lock];
          lock.classList.toggle('on', state.locks[g.lock]);
          lock.innerHTML = state.locks[g.lock] ? ICON.lock : ICON.unlock;
          lock.setAttribute('aria-pressed', state.locks[g.lock]);
        });
        sum.append(lock);
      }
      const reset = h('button', 'ib', ICON.reset);
      reset.type = 'button';
      reset.title = 'Сбросить раздел';
      reset.setAttribute('aria-label', 'Сбросить раздел «' + g.label + '»');
      const keys = new Set(g.controls.flatMap(c => c.keys.map(k => k.selector + '|' + k.prop)));
      reset.addEventListener('click', e => { e.preventDefault(); model.reset(ed => keys.has(ed.selector + '|' + ed.prop)); });
      sum.append(reset);
      det.append(sum);
      let sub;
      for (const c of g.controls) {
        if (c.sub && c.sub !== sub) { sub = c.sub; det.append(Object.assign(h('div', 'sub'), { textContent: sub })); }
        const r = ({ color: colorRow, select: selectRow, text: textRow }[c.kind] || rangeRow)(c, c.orig);
        r.group = sum.querySelector('.badge');
        r.row.querySelector('.rst').addEventListener('click', () => { model.begin(); run(planReset(r)); });
        state.rows.push(r);
        det.append(r.row);
      }
      body.append(det);
    });
    sync();
  }

  /* refresh every control from the model (after edits, undo/redo, load) */
  function sync() {
    const counts = new Map();
    for (const r of state.rows) {
      const mod = editsOf(r).length > 0;
      r.row.classList.toggle('mod', mod);
      r.show(current(r));
      counts.set(r.group, (counts.get(r.group) || 0) + (mod ? 1 : 0));
    }
    counts.forEach((n, badge) => { badge.textContent = n || ''; });
    act('undo').disabled = !model.canUndo;
    act('redo').disabled = !model.canRedo;
    const dirty = JSON.stringify(model.list()) !== state.saved;
    fab.classList.toggle('dirty', dirty);
    if (!state.flash) {
      status.className = 'status';
      const n = model.list().length;
      status.textContent = dirty ? 'Есть несохранённые изменения' : n ? `Сохранено · правок: ${n}` : 'Исходный вид';
    }
  }

  function say(text, kind) {
    clearTimeout(state.flash);
    status.className = 'status ' + (kind || '');
    status.textContent = text;
    status.title = text;
    state.flash = setTimeout(() => { state.flash = null; sync(); }, 4000);
  }

  /* ───── block selection ───── */
  function drawBox(box, el, label) {
    if (!el || !el.isConnected) { box.hidden = true; return; }
    const r = el.getBoundingClientRect();
    Object.assign(box.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    box.classList.toggle('below', r.top < 26);
    box.querySelector('span').textContent = label;
    box.hidden = false;
  }

  function selector() { return state.el ? selectorFor(state.el, state.mode, { stats: classStats }) : ''; }

  function select(el) {
    if (!el || el === document.documentElement) return;
    state.el = el;
    const sel = selector();
    $('selname').textContent = sel;
    $('selname').title = sel;
    let n = 0;
    try { n = document.querySelectorAll(sel).length; } catch { /* exotic selector */ }
    $('count').textContent = n > 1 ? `× ${n}` : '';
    render();
    /* the element is still under the cursor right after the click: re-read originals once :hover is gone */
    if (el.matches(':hover')) el.addEventListener('pointerleave', () => { if (state.el === el) render(); }, { once: true });
    loop();
  }

  let raf = 0;
  function loop() {
    cancelAnimationFrame(raf);
    const active = state.open && state.scope === 'block' && state.el && !state.stopPick;
    if (!active) { selbox.hidden = true; return; }
    drawBox(selbox, state.el, selector());
    raf = requestAnimationFrame(loop);
  }

  /* ───── move: drag the selected block on the page, written as translate X/Y ───── */
  const inPanel = e => e.composedPath().includes(host);
  const axis = p => state.rows.find(r => r.c.keys[0].prop === p);
  let mv = null;
  function setMoving(on) {
    state.moving = on && !!state.el && state.scope === 'block';
    act('move').classList.toggle('on', state.moving);
    act('move').setAttribute('aria-pressed', state.moving);
    if (!state.moving) mv = null;
  }
  addEventListener('pointerdown', e => {
    const rx = axis('translate:x'), ry = axis('translate:y');
    if (!state.moving || e.button !== 0 || inPanel(e) || !rx || !ry || !state.el.contains(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    model.begin();
    mv = { x: e.clientX, y: e.clientY, x0: current(rx), y0: current(ry), rx, ry };
  }, true);
  addEventListener('pointermove', e => {
    if (!mv) return;
    apply(mv.rx, Math.round(mv.x0 + e.clientX - mv.x));
    apply(mv.ry, Math.round(mv.y0 + e.clientY - mv.y));
  }, true);
  const endMove = () => { mv = null; };
  addEventListener('pointerup', endMove, true);
  addEventListener('pointercancel', endMove, true);
  /* a click on the block while moving must not follow links or press buttons */
  addEventListener('click', e => {
    if (state.moving && !inPanel(e) && state.el && state.el.contains(e.target)) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  act('move').addEventListener('click', () => setMoving(!state.moving));

  function pick() {
    setMoving(false);
    if (state.stopPick) { state.stopPick(); endPick(); return; }
    act('pick').classList.add('on');
    act('pick').querySelector('span').textContent = 'Отмена';
    const narrow = matchMedia('(max-width:560px)').matches;
    if (narrow) panel.hidden = true;
    selbox.hidden = true;
    state.stopPick = startPicker({
      host,
      onHover: el => drawBox(hl, el, selectorFor(el, state.mode, { stats: classStats })),
      onPick: el => { endPick(); select(el); },
      onCancel: endPick,
    });
  }
  function endPick() {
    state.stopPick = null;
    hl.hidden = true;
    act('pick').classList.remove('on');
    act('pick').querySelector('span').textContent = 'Выбрать';
    panel.hidden = !state.open;
    loop();
  }

  /* ───── layout: draggable button, panel next to it ───── */
  function placeFab() {
    const max = (v, lim) => Math.min(Math.max(8, v), lim - 52);
    state.pos = { right: max(state.pos.right, innerWidth), bottom: max(state.pos.bottom, innerHeight) };
    fab.style.right = state.pos.right + 'px';
    fab.style.bottom = state.pos.bottom + 'px';
    placePanel();
  }
  /* the button's box from its saved position: it is only hidden (not removed) while the panel is open */
  const fabRect = () => ({ right: innerWidth - state.pos.right, left: innerWidth - state.pos.right - 44, bottom: innerHeight - state.pos.bottom, top: innerHeight - state.pos.bottom - 44 });
  const sheet = () => matchMedia('(max-width:560px)').matches;
  function placePanel() {
    const s = panel.style;
    if (sheet()) { s.left = s.right = s.top = s.bottom = s.maxHeight = ''; return; }
    if (state.panelPos) {
      /* moved by the header: keep it on screen even after the window shrinks */
      const left = Math.min(Math.max(0, state.panelPos.left), Math.max(0, innerWidth - panel.offsetWidth));
      const top = Math.min(Math.max(0, state.panelPos.top), Math.max(0, innerHeight - 80));
      Object.assign(s, { left: left + 'px', top: top + 'px', right: 'auto', bottom: 'auto', maxHeight: Math.max(200, innerHeight - top - 12) + 'px' });
      return;
    }
    const r = fabRect(), gap = 10;
    if (r.left + 22 > innerWidth / 2) { s.right = innerWidth - r.right + 'px'; s.left = 'auto'; }
    else { s.left = r.left + 'px'; s.right = 'auto'; }
    if (r.top + 22 > innerHeight / 2) {
      s.bottom = innerHeight - r.top + gap + 'px'; s.top = 'auto'; s.maxHeight = r.top - gap - 12 + 'px';
    } else {
      s.top = r.bottom + gap + 'px'; s.bottom = 'auto'; s.maxHeight = innerHeight - r.bottom - gap - 12 + 'px';
    }
  }

  /* drag the panel by its header (not on the phone-width bottom sheet, and not from the buttons) */
  const header = root.querySelector('.top');
  let pdrag = null;
  header.addEventListener('pointerdown', e => {
    if (e.button !== 0 || sheet() || e.target.closest('button')) return;
    header.setPointerCapture(e.pointerId);
    const r = panel.getBoundingClientRect();
    pdrag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    header.classList.add('moving');
  });
  header.addEventListener('pointermove', e => {
    if (!pdrag) return;
    state.panelPos = { left: e.clientX - pdrag.dx, top: e.clientY - pdrag.dy };
    placePanel();
  });
  const endPanelDrag = () => {
    if (!pdrag) return;
    pdrag = null;
    header.classList.remove('moving');
    const r = panel.getBoundingClientRect();
    state.panelPos = { left: r.left, top: r.top };
    store.set('panelPos', state.panelPos);
  };
  header.addEventListener('pointerup', endPanelDrag);
  header.addEventListener('pointercancel', endPanelDrag);

  /* collapsing: the button appears where the panel was, in the panel's corner nearest the screen edge
     (the mirror of how the panel opens next to the button) */
  function fabToPanel() {
    const r = panel.getBoundingClientRect();
    if (!r.width || sheet()) return;
    const right = r.left + r.width / 2 > innerWidth / 2 ? r.right : r.left + 44;
    const bottom = r.top + r.height / 2 > innerHeight / 2 ? r.bottom : r.top + 44;
    state.pos = { right: innerWidth - right, bottom: innerHeight - bottom };
    store.set('pos', state.pos);
    placeFab();
  }

  function setOpen(open) {
    if (!open && state.open) fabToPanel();
    state.open = open;
    store.set('open', open);
    panel.hidden = !open;
    wrap.classList.toggle('open', open);
    fab.setAttribute('aria-expanded', open);
    fab.setAttribute('aria-label', open ? 'JS-Art: свернуть панель' : 'JS-Art: открыть панель');
    if (open) { placePanel(); render(); }
    loop();
  }

  let drag = null;
  fab.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    fab.setPointerCapture(e.pointerId);
    const r = fab.getBoundingClientRect();
    drag = { x: e.clientX, y: e.clientY, dx: r.right - e.clientX, dy: r.bottom - e.clientY, moved: false };
  });
  fab.addEventListener('pointermove', e => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return;
    drag.moved = true;
    state.pos = { right: innerWidth - e.clientX - drag.dx, bottom: innerHeight - e.clientY - drag.dy };
    placeFab();
  });
  fab.addEventListener('pointerup', () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    if (moved) {
      store.set('pos', state.pos);
      /* the button was moved on purpose: the panel opens next to it again */
      state.panelPos = null;
      store.set('panelPos', null);
    } else setOpen(!state.open);
  });
  fab.addEventListener('pointercancel', () => { drag = null; });
  fab.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!state.open); } });
  addEventListener('resize', placeFab);

  /* ───── header & footer ───── */
  function setScope(scope) {
    state.scope = scope;
    store.set('scope', scope);
    root.querySelectorAll('[data-scope]').forEach(b => {
      b.classList.toggle('on', b.dataset.scope === scope);
      b.setAttribute('aria-selected', b.dataset.scope === scope);
    });
    $('blockbar').hidden = scope !== 'block';
    setMoving(false);
    render();
    loop();
  }
  root.querySelectorAll('[data-scope]').forEach(b => b.addEventListener('click', () => setScope(b.dataset.scope)));
  root.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
    state.mode = b.dataset.mode;
    root.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('on', x === b));
    if (state.el) select(state.el);
  }));
  root.querySelector('[data-mode="all"]').classList.add('on');

  /* theme: follows the system until the button is used, then the choice is remembered */
  function applyTheme() {
    if (state.theme) host.dataset.theme = state.theme; else delete host.dataset.theme;
    const isDark = (state.theme || (dark.matches ? 'dark' : 'light')) === 'dark';
    const b = act('theme'), label = isDark ? 'Светлая тема панели' : 'Тёмная тема панели';
    b.innerHTML = isDark ? ICON.sun : ICON.moon;
    b.title = label;
    b.setAttribute('aria-label', label);
  }
  act('theme').addEventListener('click', () => {
    state.theme = host.dataset.theme === 'dark' || (!host.dataset.theme && dark.matches) ? 'light' : 'dark';
    store.set('theme', state.theme);
    applyTheme();
  });
  dark.addEventListener('change', applyTheme);
  applyTheme();

  act('close').addEventListener('click', () => setOpen(false));
  act('undo').addEventListener('click', () => model.undo());
  act('redo').addEventListener('click', () => model.redo());
  act('pick').addEventListener('click', pick);
  act('up').addEventListener('click', () => {
    const p = state.el && state.el.parentElement;
    if (p && p !== document.documentElement) select(p);
  });
  act('down').addEventListener('click', () => {
    const c = state.el && [...state.el.children].find(x => x.localName !== 'js-art-root' && x.localName !== 'script' && x.localName !== 'style');
    if (c) select(c);
  });
  act('resetall').addEventListener('click', () => { if (model.list().length) { model.reset(); say('Всё сброшено к исходному — Ctrl+Z вернёт'); } });
  act('save').addEventListener('click', async () => {
    const btn = act('save');
    btn.disabled = true;
    say('Сохранение…');
    try {
      const res = await onSave();
      if (res.ok) { state.saved = JSON.stringify(model.list()); sync(); }
      if (res.rerender) render();
      say(res.text, res.kind || (res.ok ? 'ok' : 'err'));
    } finally {
      btn.disabled = false;
    }
  });

  /* ───── keyboard ───── */
  const editableOutside = t => t !== host && t instanceof Element && (t.isContentEditable || /^(input|textarea|select)$/.test(t.localName));
  addEventListener('keydown', e => {
    if (!state.open || state.stopPick) return;
    if (editableOutside(e.target)) return;
    const cmd = shortcut(e);
    if (cmd === 'undo' || cmd === 'redo') { e.preventDefault(); model[cmd](); }
    else if (cmd === 'close') setOpen(false);
  });
  addEventListener('beforeunload', e => {
    if (JSON.stringify(model.list()) !== state.saved) { e.preventDefault(); e.returnValue = ''; }
  });

  /* theme switches change the palette's originals */
  const rerenderPage = () => { if (state.open && state.scope === 'page') render(); };
  new MutationObserver(rerenderPage).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', rerenderPage);

  placeFab();
  setScope(state.scope);
  setOpen(state.open);

  return { sync };
}
