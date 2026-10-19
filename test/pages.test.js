// node test/pages.test.js — unit checks for src/pages.js (no Electron)
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { applyPageOp, pageOp } = require('../src/pages');
const session = require('../src/session');

const W = 'C:/Users/kevqu/OneDrive/Documents/Liturgical Resources/Claude/bulletin-builder/weeks/9-20-26 1100';
const man = JSON.parse(fs.readFileSync(path.join(W, '9-20-26 1100.bulletin'), 'utf8'));
const halves = { worship: JSON.parse(fs.readFileSync(path.join(W, 'worship.json'), 'utf8')), announcements: JSON.parse(fs.readFileSync(path.join(W, 'announcements.json'), 'utf8')) };
const text = (h, n) => JSON.stringify(h.pages[String(n)]);
let ok = 0; const t = (name, fn) => { fn(); ok++; console.log('ok', name); };

t('insert 1 blank page after 5 (worship): later pages shift, both halves', () => {
  const r = applyPageOp(man, halves, { type: 'insert', ref: 5, where: 'after', count: 1 }, 'worship');
  assert.strictEqual(r.manifest.pages.length, 17);
  assert.deepStrictEqual(r.manifest.pages.map((p) => p.number), [...Array(17)].map((_, i) => i + 1));
  assert.strictEqual(r.manifest.pages[5].half, 'worship');
  assert.deepStrictEqual(r.halves.worship.pages['6'].frames, []);
  assert.strictEqual(text(r.halves.worship, 7), text(halves.worship, 6));
  assert.strictEqual(text(r.halves.announcements, 11), text(halves.announcements, 10));
  assert.strictEqual(text(r.halves.announcements, 17), text(halves.announcements, 16));
  assert.strictEqual(r.focus, 6);
  assert.ok(r.warnings.length === 1 && /multiple of 4/.test(r.warnings[0]));
});
t('insert 4 before page 2: booklet stays a multiple of 4, no warning', () => {
  const r = applyPageOp(man, halves, { type: 'insert', ref: 2, where: 'before', count: 4 }, 'worship');
  assert.strictEqual(r.manifest.pages.length, 20); assert.strictEqual(r.warnings.length, 0);
  assert.strictEqual(text(r.halves.worship, 6), text(halves.worship, 2)); assert.strictEqual(r.focus, 2);
});
t('duplicate page 3: same content, fresh ids, own text story', () => {
  const r = applyPageOp(man, halves, { type: 'insert', ref: 3, where: 'after', count: 1, duplicate: 3 }, 'worship');
  const a = r.halves.worship.pages['3'], b = r.halves.worship.pages['4'];
  assert.strictEqual(a.frames.length, b.frames.length);
  assert.ok(b.frames.every((f, i) => f.id !== a.frames[i].id));
  const stories = (p) => p.frames.map((f) => f.text && f.text.chain && f.text.chain.story).filter(Boolean);
  for (const s of stories(b)) assert.ok(!stories(a).includes(s));
});
t('delete page 9 (worship): announcements renumber down, own half only', () => {
  const r = applyPageOp(man, halves, { type: 'delete', pages: [9] }, 'worship');
  assert.strictEqual(r.manifest.pages.length, 15);
  assert.strictEqual(text(r.halves.announcements, 9), text(halves.announcements, 10));
  assert.strictEqual(r.map[9], null); assert.strictEqual(r.map[10], 9);
  assert.throws(() => applyPageOp(man, halves, { type: 'delete', pages: [12] }, 'worship'), /belongs to the announcements/);
});
t('move page 4 after page 7', () => {
  const r = applyPageOp(man, halves, { type: 'move', pages: [4], ref: 7, where: 'after' }, 'worship');
  assert.strictEqual(text(r.halves.worship, 7), text(halves.worship, 4));
  assert.strictEqual(text(r.halves.worship, 4), text(halves.worship, 5));
  assert.strictEqual(r.focus, 7); assert.strictEqual(r.manifest.pages.length, 16);
});
t('flow half is told to lay out again', () => {
  const fl = { worship: { ...halves.worship, mode: 'flow', layout: { flowHash: 'x' } }, announcements: halves.announcements };
  const r = applyPageOp(man, fl, { type: 'insert', ref: 2, where: 'after', count: 1 }, 'worship');
  assert.strictEqual(r.halves.worship.layout.flowHash, null);
});
t('on disk: lock rules, history, files rewritten', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bbpages-'));
  fs.cpSync(W, tmp, { recursive: true, filter: (p) => !/[\/](history|locks)$/.test(p) });
  const f = path.join(tmp, '9-20-26 1100.bulletin');
  assert.throws(() => pageOp(f, 'worship', { type: 'insert', ref: 2, where: 'after', count: 1 }, { session }), /not holding the edit lock/);
  session.claim(f, 'worship');
  // someone else holds the announcements half
  fs.writeFileSync(path.join(tmp, 'locks', 'announcements.lock'), JSON.stringify({ user: 'someone', machine: 'OFFICE-PC', pid: 1, since: new Date().toISOString() }));
  assert.throws(() => pageOp(f, 'worship', { type: 'insert', ref: 2, where: 'after', count: 4 }, { session }), /someone is editing the announcements/);
  fs.unlinkSync(path.join(tmp, 'locks', 'announcements.lock'));
  const r = pageOp(f, 'worship', { type: 'insert', ref: 2, where: 'after', count: 4 }, { session });
  assert.strictEqual(r.pages, 20);
  const m2 = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.strictEqual(m2.pages.length, 20);
  const a2 = JSON.parse(fs.readFileSync(path.join(tmp, 'announcements.json'), 'utf8'));
  assert.ok(a2.pages['14'] && !a2.pages['10']);
  assert.ok(fs.readdirSync(path.join(tmp, 'history')).some((x) => x.startsWith('manifest-')));
  assert.ok(!fs.existsSync(path.join(tmp, 'locks', 'announcements.lock')), 'borrowed lock released');
  session.releaseAll();
  fs.rmSync(tmp, { recursive: true, force: true });
});
console.log('PASS ' + ok + ' page checks');
process.exit(0);
