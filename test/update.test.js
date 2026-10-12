import test from 'node:test';
import assert from 'node:assert/strict';
import { check, apply } from '../lib/update.js';

/* a fake git: answers keyed by the joined args; a missing key rejects like git would */
function fakeGit(answers, log = []) {
  return async args => {
    const key = args.join(' ');
    log.push(key);
    for (const [k, v] of Object.entries(answers)) {
      if (key === k) {
        if (v instanceof Error) throw v;
        return v;
      }
    }
    throw Object.assign(new Error(`unexpected: ${key}`), { code: 1 });
  };
}

const base = {
  'rev-parse --abbrev-ref HEAD': 'main',
  'rev-parse --abbrev-ref @{u}': 'origin/main',
  'rev-parse --short HEAD': 'aaa1111',
  'status --porcelain': '',
  'fetch --quiet': '',
  'rev-list --count HEAD..origin/main': '2',
  'rev-list --count origin/main..HEAD': '0',
  'rev-parse --short origin/main': 'bbb2222',
  'log --format=%s HEAD..origin/main': 'second change\nfirst change',
};

test('check: a newer upstream can be applied when the tree is clean', async () => {
  const r = await check(fakeGit(base));
  assert.equal(r.ok, true);
  assert.deepEqual([r.current, r.latest, r.behind, r.ahead, r.dirty, r.canUpdate], ['aaa1111', 'bbb2222', 2, 0, false, true]);
  assert.deepEqual(r.commits, ['second change', 'first change']);
});

test('check: local edits or local commits block the update, the reason is kept', async () => {
  assert.equal((await check(fakeGit({ ...base, 'status --porcelain': ' M client/ui.js' }))).canUpdate, false);
  assert.equal((await check(fakeGit({ ...base, 'rev-list --count origin/main..HEAD': '1' }))).canUpdate, false);
  assert.equal((await check(fakeGit({ ...base, 'rev-list --count HEAD..origin/main': '0' }))).canUpdate, false);
});

test('check: an unreachable remote reports offline, not a crash', async () => {
  const r = await check(fakeGit({ ...base, 'fetch --quiet': Object.assign(new Error('Could not resolve host'), { code: 128 }) }));
  assert.equal(r.ok, false);
  assert.equal(r.offline, true);
});

test('check: no git, not a clone, detached HEAD and no upstream are named', async () => {
  assert.equal((await check(async () => { throw Object.assign(new Error('spawn git ENOENT'), { code: 'ENOENT' }); })).reason, 'no-git');
  const notRepo = fakeGit({ 'rev-parse --abbrev-ref HEAD': Object.assign(new Error('fatal: not a git repository'), { code: 128 }) });
  assert.equal((await check(notRepo)).reason, 'not-git');
  assert.equal((await check(fakeGit({ ...base, 'rev-parse --abbrev-ref HEAD': 'HEAD' }))).reason, 'detached');
  const noUp = fakeGit({ 'rev-parse --abbrev-ref HEAD': 'main', 'rev-parse --abbrev-ref @{u}': Object.assign(new Error('fatal: no upstream configured'), { code: 128 }) });
  assert.equal((await check(noUp)).reason, 'no-upstream');
});

test('apply: fast-forwards only, and only when the check allows it', async () => {
  const log = [];
  const r = await apply(fakeGit({ ...base, 'merge --ff-only origin/main': '' }, log));
  assert.equal(r.updated, true);
  assert.ok(log.includes('merge --ff-only origin/main'));
  assert.ok(!log.some(k => k.includes('--force') || k.startsWith('reset')));
});

test('apply: refuses on a dirty tree or diverged history and changes nothing', async () => {
  const log = [];
  const dirty = await apply(fakeGit({ ...base, 'status --porcelain': '?? x' }, log));
  assert.deepEqual([dirty.updated, dirty.reason], [false, 'dirty']);
  const diverged = await apply(fakeGit({ ...base, 'rev-list --count origin/main..HEAD': '3' }, log));
  assert.deepEqual([diverged.updated, diverged.reason], [false, 'diverged']);
  assert.ok(!log.some(k => k.startsWith('merge')));
});

test('apply: an up-to-date plugin is not touched', async () => {
  const log = [];
  const r = await apply(fakeGit({ ...base, 'rev-list --count HEAD..origin/main': '0' }, log));
  assert.equal(r.updated, false);
  assert.ok(!log.some(k => k.startsWith('merge')));
});
