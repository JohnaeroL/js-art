/* Plugin updates from its git remote. The plugin folder is a clone (README: git clone), so an update is a fetch and a
   fast-forward merge of the upstream branch. Nothing is forced: a dirty tree, local commits or a diverged branch
   stop the update and say why. check() only fetches; apply() changes files and only ever runs on the user's click.
   run(args) is injected for tests: it resolves with the trimmed stdout of `git <args>` or rejects. */
import { execFile } from 'node:child_process';

export const gitRun = (dir, args) => new Promise((resolve, reject) => {
  execFile('git', args, { cwd: dir, timeout: 60000, windowsHide: true, maxBuffer: 1 << 20 }, (err, stdout, stderr) => {
    if (err) reject(Object.assign(new Error(String(stderr || err.message).trim()), { code: err.code }));
    else resolve(String(stdout).trim());
  });
});

const count = s => parseInt(s, 10) || 0;

/* the reason a git call failed, in words the panel can show */
function failure(e) {
  if (e.code === 'ENOENT') return { ok: false, reason: 'no-git' };
  if (/not a git repository/i.test(e.message)) return { ok: false, reason: 'not-git' };
  if (/no upstream|@\{u\}|no such branch/i.test(e.message)) return { ok: false, reason: 'no-upstream' };
  return { ok: false, reason: 'git-error', error: e.message };
}

/* fetches the upstream and reports what an update would do; never changes the working tree */
export async function check(run) {
  let branch, upstream, current, dirty;
  try {
    branch = await run(['rev-parse', '--abbrev-ref', 'HEAD']);
    if (branch === 'HEAD') return { ok: false, reason: 'detached' };
    upstream = await run(['rev-parse', '--abbrev-ref', '@{u}']);
    current = await run(['rev-parse', '--short', 'HEAD']);
    dirty = (await run(['status', '--porcelain'])).length > 0;
  } catch (e) {
    return failure(e);
  }
  try {
    await run(['fetch', '--quiet']);
  } catch (e) {
    return { ...failure(e), offline: true };
  }
  try {
    const behind = count(await run(['rev-list', '--count', `HEAD..${upstream}`]));
    const ahead = count(await run(['rev-list', '--count', `${upstream}..HEAD`]));
    const latest = await run(['rev-parse', '--short', upstream]);
    const commits = behind ? (await run(['log', '--format=%s', `HEAD..${upstream}`])).split('\n').slice(0, 20) : [];
    return {
      ok: true, branch, upstream, current, latest, behind, ahead, dirty, commits,
      canUpdate: behind > 0 && ahead === 0 && !dirty,
    };
  } catch (e) {
    return failure(e);
  }
}

/* the fast-forward itself; the state is checked again so a change made since the check is not overwritten */
export async function apply(run) {
  const c = await check(run);
  if (!c.ok) return c;
  if (c.dirty) return { ...c, updated: false, reason: 'dirty' };
  if (c.ahead) return { ...c, updated: false, reason: 'diverged' };
  if (!c.behind) return { ...c, updated: false };
  try {
    await run(['merge', '--ff-only', c.upstream]);
  } catch (e) {
    return { ...failure(e), updated: false };
  }
  return { ...c, updated: true, canUpdate: false, behind: 0 };
}

export function createUpdater({ dir, run = (args) => gitRun(dir, args) }) {
  return {
    check: () => check(run),
    apply: () => apply(run),
  };
}
