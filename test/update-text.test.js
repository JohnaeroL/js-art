import test from 'node:test';
import assert from 'node:assert/strict';
import { checkStatus, applyStatus } from '../client/update.js';

const ok = { ok: true, current: 'aaa1111', latest: 'bbb2222', behind: 2, ahead: 0, dirty: false };

test('a newer version is offered and asks for a second click', () => {
  const s = checkStatus(ok);
  assert.equal(s.armed, true);
  assert.match(s.text, /2 коммит\(ов\) → bbb2222/);
});

test('an up-to-date plugin says so, no button arming', () => {
  assert.deepEqual(checkStatus({ ...ok, behind: 0 }), { text: 'Установлена последняя версия (aaa1111)', kind: 'ok', armed: false });
});

test('local edits and local commits are named before anything is offered', () => {
  assert.match(checkStatus({ ...ok, dirty: true }).text, /несохранённые/);
  assert.equal(checkStatus({ ...ok, dirty: true }).armed, false);
  assert.match(checkStatus({ ...ok, ahead: 1, behind: 0 }).text, /локальные коммиты/);
});

test('every failure has a readable reason', () => {
  assert.match(checkStatus({ ok: false, reason: 'offline' }).text, /GitHub/);
  assert.match(checkStatus({ ok: false, reason: 'not-git' }).text, /git clone/);
  assert.match(checkStatus({ ok: false, reason: 'git-error', error: 'boom' }).text, /boom/);
  assert.equal(checkStatus(null).kind, 'err');
});

test('after an update the text tells whether the server restarts itself', () => {
  assert.match(applyStatus({ ok: true, updated: true, to: 'bbb2222', restart: true }).text, /перезапускается/);
  assert.match(applyStatus({ ok: true, updated: true, to: 'bbb2222', restart: false }).text, /перезапустите сервер/);
  assert.equal(applyStatus({ ok: true, updated: true, to: 'bbb2222' }).kind, 'ok');
});

test('an old server (404) asks for a restart, a network failure says there is no server', async () => {
  const { noRouteText } = await import('../client/update.js');
  assert.match(noRouteText(404), /перезапустите сервер/);
  assert.match(noRouteText(500), /ошибкой 500/);
  assert.match(noRouteText(0), /Нет связи/);
});
