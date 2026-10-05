#!/usr/bin/env node
/* JS-Art dev server: serves the site, injects the panel into HTML responses, saves results into the project.
   Usage: node js-art/server.js [--root site] [--port 5173] [--out css/js-art.css] */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { save } from './lib/save.js';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = '<script type="module" src="/__js-art/client/index.js"></script>';
const MAX_BODY = 2 * 1024 * 1024;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

export function injectScript(html) {
  const i = html.toLowerCase().lastIndexOf('</body>');
  return i < 0 ? html + SCRIPT : html.slice(0, i) + SCRIPT + html.slice(i);
}

/* resolves a URL path inside base; null when it escapes base or cannot be decoded */
function inside(base, urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath); } catch { return null; }
  if (p.includes('\0')) return null;
  const full = path.resolve(base, '.' + path.posix.normalize('/' + p.replace(/\\/g, '/')));
  const rel = path.relative(base, full);
  return rel.startsWith('..') || path.isAbsolute(rel) ? null : full;
}

const send = (res, status, body, type = 'text/plain; charset=utf-8') => {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
};
const json = (res, status, obj) => send(res, status, JSON.stringify(obj), TYPES['.json']);

async function serveFile(res, file, transform) {
  let stat;
  try { stat = await fs.stat(file); } catch { return send(res, 404, 'Not found'); }
  if (stat.isDirectory()) return serveFile(res, path.join(file, 'index.html'), transform);
  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const data = await fs.readFile(file);
  send(res, 200, transform && type.startsWith('text/html') ? transform(data.toString('utf8')) : data, type);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    /* an oversized body is drained, not kept, so the client still gets the 413 */
    req.on('data', c => { size += c.length; if (size <= MAX_BODY) chunks.push(c); });
    req.on('end', () => size > MAX_BODY
      ? reject(Object.assign(new Error('Payload too large'), { status: 413 }))
      : resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/* The server writes into the project, so it only talks to pages it served itself: the Host must be a loopback
   name (blocks DNS rebinding), a present Origin must be that same host, and writes must be JSON (a cross-site
   form or text/plain POST can't send that without a CORS preflight, which is never answered). */
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

function hostOk(host, port) {
  const m = /^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/.exec(host || '');
  return !!m && LOOPBACK.has(m[1].toLowerCase()) && (!m[2] || +m[2] === port);
}

function originOk(origin, port) {
  if (!origin) return true;
  try {
    const u = new URL(origin);
    return u.protocol === 'http:' && hostOk(u.host, port);
  } catch { return false; }
}

export function createServer({ root, out = 'css/js-art.css', toolDir = TOOL_DIR, clientDir = path.join(toolDir, 'client') }) {
  root = path.resolve(root);
  return http.createServer(async (req, res) => {
    try {
      const port = req.socket.localPort;
      if (!hostOk(req.headers.host, port) || !originOk(req.headers.origin, port)) return send(res, 403, 'Forbidden');
      const url = new URL(req.url, 'http://x');
      /* raw path keeps encoded ../ visible to the guard */
      const rawPath = req.url.split('?')[0];

      if (rawPath.startsWith('/__js-art/client/')) {
        const file = inside(clientDir, rawPath.slice('/__js-art/client/'.length));
        return file ? serveFile(res, file) : send(res, 403, 'Forbidden');
      }
      if (url.pathname === '/__js-art/state') {
        try { return send(res, 200, await fs.readFile(path.join(toolDir, 'state.json')), TYPES['.json']); }
        catch { return json(res, 200, {}); }
      }
      if (url.pathname === '/__js-art/save') {
        if (req.method !== 'POST') return send(res, 405, 'Method not allowed');
        if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) { req.resume(); return send(res, 415, 'Content-Type must be application/json'); }
        let data;
        try { data = JSON.parse(await readBody(req)); }
        catch (e) { return e.status ? send(res, e.status, e.message) : json(res, 400, { ok: false, error: 'Invalid JSON' }); }
        if (typeof data.css !== 'string') return json(res, 400, { ok: false, error: 'css must be a string' });
        try { return json(res, 200, { ok: true, ...(await save({ root, out, toolDir, css: data.css, state: data.state ?? {} })) }); }
        catch (e) { return json(res, 500, { ok: false, error: e.message }); }
      }

      const file = inside(root, rawPath);
      if (!file) return send(res, 403, 'Forbidden');
      return serveFile(res, file, injectScript);
    } catch (e) {
      if (!res.headersSent) send(res, 500, String(e && e.message));
    }
  });
}

function args(argv) {
  const o = { root: 'site', port: 5173, out: 'css/js-art.css' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i].replace(/^--/, '');
    if (k in o) o[k] = k === 'port' ? +argv[++i] : argv[++i];
  }
  return o;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const o = args(process.argv.slice(2));
  createServer(o).listen(o.port, '127.0.0.1', () => {
    console.log(`JS-Art: http://localhost:${o.port}  (root: ${path.resolve(o.root)}, save → ${o.out})`);
  });
}
