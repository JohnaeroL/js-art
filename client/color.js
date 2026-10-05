/* Color parsing/formatting. Everything works on {r, g, b, a}: r,g,b are 0–255 integers, a is 0–1. */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round2 = v => Math.round(v * 100) / 100;

/* "50%" → 0.5 for alpha, plain numbers stay as they are */
const alpha = s => (s == null ? 1 : clamp(s.endsWith('%') ? parseFloat(s) / 100 : parseFloat(s), 0, 1));
const channel = s => clamp(Math.round(s.endsWith('%') ? parseFloat(s) * 2.55 : parseFloat(s)), 0, 255);

/* rgb(1,2,3) / rgb(1 2 3 / .5) / rgba(1,2,3,.5) → ['1','2','3','.5'] */
const args = body => body.trim().split(/\s*[,/]\s*|\s+/).filter(Boolean);

function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const f = n => l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)].map(v => Math.round(v * 255));
}

export function parseColor(str) {
  if (typeof str !== 'string') return null;
  const s = str.trim().toLowerCase();
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };

  let m = s.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map(c => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    const n = i => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? round2(n(6) / 255) : 1 };
  }

  m = s.match(/^rgba?\((.*)\)$/);
  if (m) {
    const p = args(m[1]);
    if (p.length < 3 || p.slice(0, 3).some(v => isNaN(parseFloat(v)))) return null;
    return { r: channel(p[0]), g: channel(p[1]), b: channel(p[2]), a: alpha(p[3]) };
  }

  m = s.match(/^hsla?\((.*)\)$/);
  if (m) {
    const p = args(m[1]);
    if (p.length < 3 || p.slice(0, 3).some(v => isNaN(parseFloat(v)))) return null;
    const [r, g, b] = hslToRgb(((parseFloat(p[0]) % 360) + 360) % 360, parseFloat(p[1]), parseFloat(p[2]));
    return { r, g, b, a: alpha(p[3]) };
  }
  return null;
}

export const toHex = ({ r, g, b }) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');

export const formatColor = c => (c.a >= 1 ? toHex(c) : `rgba(${c.r}, ${c.g}, ${c.b}, ${round2(c.a)})`);
