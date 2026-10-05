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

/* raw request so the client does not normalise ../ away */
const rawGet = (port, p) => new Promise((resolve, reject) => {
  const s = net.connect(port, '127.0.0.1', () => s.write(`GET ${p} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n`));
  let d = ''; s.on('data', c => d += c); s.on('end', () => resolve(+d.split(' ')[1])); s.on('error', reject);
});

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

  const big = await fetch(base + '/__js-art/save', { method: 'POST', body: 'x'.repeat(2 * 1024 * 1024 + 10) });
  assert.equal(big.status, 413);
  const bad = await fetch(base + '/__js-art/save', { method: 'POST', body: '{nope' });
  assert.equal(bad.status, 400);
});
