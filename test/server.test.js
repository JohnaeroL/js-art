import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { createServer } from '../server.js';

const toolSrc = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PAGE = '<html><head></head><body><p>hi</p></body></html>';

async function setup() {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'js-art-srv-'));
  const root = path.join(tmp, 'site'), toolDir = path.join(tmp, 'tool');
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(path.join(root, 'index.html'), PAGE);
  await fs.writeFile(path.join(root, 'a.css'), 'p{}');
  await fs.writeFile(path.join(tmp, 'secret.txt'), 'nope');
  const server = createServer({ root, out: 'css/js-art.css', toolDir, clientDir: path.join(toolSrc, 'client') });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { tmp, root, toolDir, server, base };
}

/* raw request so the client does not normalise ../ away and any Host/Origin can be sent */
const raw = (port, { method = 'GET', path: p = '/', headers = {}, body = '' } = {}) => new Promise((resolve, reject) => {
  const h = { Host: `127.0.0.1:${port}`, Connection: 'close', 'Content-Length': Buffer.byteLength(body), ...headers };
  const head = Object.entries(h).map(([k, v]) => `${k}: ${v}`).join('@@');
  const s = net.connect(port, '127.0.0.1', () => s.write(`${method} ${p} HTTP/1.1@@${head}@@@@${body}`.split('@@').join(String.fromCharCode(13, 10))));
  let d = ''; s.on('data', c => d += c); s.on('end', () => resolve(+d.split(' ')[1])); s.on('error', reject);
});
const rawGet = (port, p) => raw(port, { path: p });

test('server: injection, static files, traversal guard, client files, save + state', async t => {
  const { tmp, root, server, base } = await setup();
  t.after(async () => { server.close(); await fs.rm(tmp, { recursive: true, force: true }); });

  const home = await fetch(base + '/');
  assert.equal(home.status, 200);
  const body = await home.text();
  assert.ok(body.includes('<script type="module" src="/__js-art/client/index.js"></script></body>'));
  assert.equal(await fs.readFile(path.join(root, 'index.html'), 'utf8'), PAGE);
  assert.equal(home.headers.get('cache-control'), 'no-store');

  const css = await fetch(base + '/a.css');
  assert.match(css.headers.get('content-type'), /^text\/css/);

  const port = server.address().port;
  for (const p of ['/../secret.txt', '/%2e%2e/secret.txt', '/..%2fsecret.txt', '/%2e%2e%5csecret.txt']) {
    const st = await rawGet(port, p);
    assert.ok(st === 403 || st === 404 || st === 400, `${p} → ${st}`);
  }
  assert.equal((await fetch(base + '/missing.png')).status, 404);

  const js = await fetch(base + '/__js-art/client/color.js');
  assert.equal(js.status, 200);
  assert.match(js.headers.get('content-type'), /^text\/javascript/);

  assert.deepEqual(await (await fetch(base + '/__js-art/state')).json(), {});
  const res = await fetch(base + '/__js-art/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ css: 'h1{}', state: { v: 1 } }) });
  const out = await res.json();
  assert.equal(out.ok, true);
  assert.equal(await fs.readFile(path.join(root, 'css/js-art.css'), 'utf8'), 'h1{}');
  assert.deepEqual(await (await fetch(base + '/__js-art/state')).json(), { v: 1 });

  const big = await fetch(base + '/__js-art/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'x'.repeat(2 * 1024 * 1024 + 10) });
  assert.equal(big.status, 413);
  const bad = await fetch(base + '/__js-art/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{nope' });
  assert.equal(bad.status, 400);
});

test('server: only same-origin JSON writes from localhost are accepted', async t => {
  const { tmp, root, server } = await setup();
  t.after(async () => { server.close(); await fs.rm(tmp, { recursive: true, force: true }); });
  const port = server.address().port;
  const out = path.join(root, 'css/js-art.css');
  const json = { 'Content-Type': 'application/json' };
  const body = JSON.stringify({ css: '@import url(https://evil.example/x.css);', state: {} });

  assert.equal(await raw(port, { method: 'POST', path: '/__js-art/save', headers: { ...json, Origin: 'https://evil.example' }, body }), 403);
  assert.equal(await raw(port, { method: 'POST', path: '/__js-art/save', headers: { 'Content-Type': 'text/plain' }, body }), 415);
  assert.equal(await raw(port, { method: 'POST', path: '/__js-art/save', headers: { ...json, Host: `evil.example:${port}` }, body }), 403);
  assert.equal(await raw(port, { path: '/__js-art/state', headers: { Host: `evil.example:${port}` } }), 403);
  assert.equal(await raw(port, { path: '/', headers: { Host: 'evil.example' } }), 403);
  await assert.rejects(fs.access(out));

  assert.equal(await raw(port, { method: 'POST', path: '/__js-art/save', headers: { ...json, Origin: `http://localhost:${port}`, Host: `localhost:${port}` }, body: JSON.stringify({ css: 'p{}', state: {} }) }), 200);
  assert.equal(await raw(port, { path: '/', headers: { Host: `[::1]:${port}` } }), 200);
});
