/* Eyedropper: hover highlights, click picks. Clicks never reach the site while picking; the panel is ignored. */
export function startPicker({ host, onHover, onPick, onCancel }) {
  const own = e => e.composedPath().includes(host);
  const swallow = e => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); };
  const opts = { capture: true, passive: false };

  const cursor = document.createElement('style');
  cursor.textContent = '*{cursor:crosshair!important}';
  document.head.append(cursor);

  const move = e => {
    if (own(e)) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && el !== host) onHover(el);
  };
  const block = e => { if (!own(e)) swallow(e); };
  const click = e => {
    if (own(e)) return;
    swallow(e);
    const el = document.elementFromPoint(e.clientX, e.clientY) || e.target;
    stop();
    if (el instanceof Element && el !== host) onPick(el); else onCancel();
  };
  const key = e => {
    if (e.key !== 'Escape') return;
    swallow(e); stop(); onCancel();
  };

  const DOWN = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'auxclick', 'contextmenu'];
  addEventListener('pointermove', move, opts);
  DOWN.forEach(t => addEventListener(t, block, opts));
  addEventListener('click', click, opts);
  addEventListener('keydown', key, opts);

  function stop() {
    removeEventListener('pointermove', move, opts);
    DOWN.forEach(t => removeEventListener(t, block, opts));
    removeEventListener('click', click, opts);
    removeEventListener('keydown', key, opts);
    cursor.remove();
  }
  return stop;
}
