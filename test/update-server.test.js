import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from '../server.js';

async function started(updater) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'js-art-u-'));
  const server = createServer({ root, toolDir: root, updater });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { base: `http://localhost:${server.address().port}`, close: () => new Promise(r => server.close(r)) };
}

const fake = (calls, applied = { ok: true, updated: true, latest: 'bbb2222' }) => ({
  check: async () => { calls.push('check'); return { ok: true, canUpdate: true, behind: 1 }; },
  apply: async () => { calls.push('apply'); return applied; },
});

test('GET /__js-art/update reports the check and never changes anything', async () => {
  const calls = [];
  const s = await started(fake(calls));
  try {
    const r = await fetch(s.base + '/__js-art/update');
    assert.equal(r.status, 200);
    assert.equal((await r.json()).canUpdate, true);
    assert.deepEqual(calls, ['check']);
  } finally { await s.close(); }
});

test('POST /__js-art/update applies only as JSON from the page itself', async () => {
  const calls = [];
  const s = await started(fake(calls));
  try {
    const plain = await fetch(s.base + '/__js-art/update', { method: 'POST', body: '{}', headers: { 'Content-Type': 'text/plain' } });
    assert.equal(plain.status, 415);
    const ok = await fetch(s.base + '/__js-art/update', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).updated, true);
    assert.deepEqual(calls, ['apply']);
    assert.equal((await fetch(s.base + '/__js-art/update', { method: 'PUT' })).status, 405);
  } finally { await s.close(); }
});

test('a foreign origin cannot reach the update route', async () => {
  const s = await started(fake([]));
  try {
    const r = await fetch(s.base + '/__js-art/update', { headers: { Origin: 'https://evil.example' } });
    assert.equal(r.status, 403);
  } finally { await s.close(); }
});
