// Edit sessions: who may change which half of a week, and how a half is saved.
//
//   locks/<half>.lock       { user, machine, pid, since } — refreshed every minute while editing
//   history/<half>-<stamp>.json   the previous version, copied before every save (append-only)
//
// A lock that hasn't been refreshed for STALE_MS belongs to a crashed or disconnected app and may be
// taken over. Writes go to a temp file that is renamed over the real one, so an interrupted save
// never leaves a half-written file on the shared drive.
const fs = require('fs');
const os = require('os');
const path = require('path');

const STALE_MS = 5 * 60 * 1000;
const HEARTBEAT_MS = 60 * 1000;
const HALF_NAME = /^[a-z][a-z0-9-]*$/;

const me = () => ({ user: os.userInfo().username, machine: os.hostname(), pid: process.pid });
const held = new Map(); // lockPath -> interval

function weekDir(file) { return path.dirname(path.resolve(file)); }

function lockPath(file, half) {
  if (!HALF_NAME.test(half)) throw new Error('Bad half name: ' + half);
  return path.join(weekDir(file), 'locks', half + '.lock');
}

function readLock(p) {
  try {
    const info = JSON.parse(fs.readFileSync(p, 'utf8'));
    info.ageMs = Date.now() - fs.statSync(p).mtimeMs;
    return info;
  } catch (_) {
    return null;
  }
}

function isMine(info) {
  const m = me();
  return info && info.machine === m.machine && info.user === m.user && info.pid === m.pid;
}

// The same person on the same computer, from an app that is no longer running (it crashed or was
// killed), is an abandoned session: take it over. A lock from another person or computer only
// expires after STALE_MS without a heartbeat.
function abandonedByMe(info) {
  const m = me();
  if (!info || info.user !== m.user || info.machine !== m.machine || info.pid === m.pid) return false;
  try { process.kill(info.pid, 0); return false; } catch (_) { return true; }
}

function claim(file, half, { force = false } = {}) {
  const p = lockPath(file, half);
  const existing = readLock(p);
  if (existing && !isMine(existing) && existing.ageMs < STALE_MS && !abandonedByMe(existing) && !force) {
    return { ok: false, holder: existing };
  }
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ ...me(), since: new Date().toISOString() }, null, 1));
  if (!held.has(p)) {
    const t = setInterval(() => {
      try { const now = new Date(); fs.utimesSync(p, now, now); } catch (_) { /* drive gone; retried next tick */ }
    }, HEARTBEAT_MS);
    held.set(p, t);
  }
  return { ok: true, tookOverStale: !!(existing && !isMine(existing)) };
}

function release(file, half) {
  const p = lockPath(file, half);
  clearInterval(held.get(p));
  held.delete(p);
  const existing = readLock(p);
  if (existing && isMine(existing)) {
    try { fs.unlinkSync(p); } catch (_) { /* already gone */ }
  }
}

function releaseAll() {
  for (const [p, t] of held) {
    clearInterval(t);
    const existing = readLock(p);
    if (existing && isMine(existing)) {
      try { fs.unlinkSync(p); } catch (_) { /* ignore */ }
    }
  }
  held.clear();
}

function stamp(d = new Date()) {
  const z = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + '_' + z(d.getHours()) + z(d.getMinutes()) + z(d.getSeconds());
}

function save(file, half, data) {
  const dir = weekDir(file);
  const manifest = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const rel = (manifest.halves || {})[half];
  if (!rel) throw new Error('This week has no "' + half + '" half.');
  const lock = readLock(lockPath(file, half));
  if (!isMine(lock)) throw new Error('You are not holding the edit lock for ' + half + ' (someone else may have taken it over).');
  const target = path.join(dir, rel);
  if (fs.existsSync(target)) {
    const hist = path.join(dir, 'history');
    fs.mkdirSync(hist, { recursive: true });
    let name = path.join(hist, half + '-' + stamp() + '.json');
    for (let k = 2; fs.existsSync(name); k++) name = path.join(hist, half + '-' + stamp() + '-' + k + '.json');
    fs.copyFileSync(target, name);
  }
  const tmp = target + '.saving';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
  fs.renameSync(tmp, target);
  return { savedAt: new Date().toISOString() };
}

module.exports = { claim, release, releaseAll, save, readLock, lockPath, isMine, STALE_MS };
