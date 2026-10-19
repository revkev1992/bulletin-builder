// Page operations — Insert ▸ Page, Page Design ▸ Pages ▸ Delete / Move (Publisher's commands).
//
// Pages are keyed by NUMBER in both half files and listed in the manifest, so inserting, deleting or
// moving a page renumbers every later page in BOTH halves. That is why a page operation is done here,
// in the main process, on disk, all at once: it needs the edit lock of your own half AND the other
// half to be free (nobody else editing it), and it writes the manifest + both halves together, with
// the previous versions copied to history/ first.
//
// applyPageOp() is pure (no disk) so it can be unit-tested; pageOp() does the locking and the files.
const fs = require('fs');
const path = require('path');

const clone = (x) => JSON.parse(JSON.stringify(x));

function eachFrame(f, fn) { fn(f); for (const c of f.children || []) eachFrame(c, fn); }

// a duplicated page gets fresh frame ids, and its linked text becomes its own story (a copy of a
// linked frame must not join the original's chain)
function duplicateContent(page, tag) {
  const copy = clone(page || { frames: [] });
  delete copy.locked;
  copy.frames = (copy.frames || []).filter((f) => !f.generated);
  for (const f of copy.frames) {
    eachFrame(f, (g) => {
      if (g.id) g.id = g.id + '-' + tag;
      if (g.text && g.text.chain && g.text.chain.story) g.text.chain.story = g.text.chain.story + '-' + tag;
      if (g.chain && g.chain.story) g.chain.story = g.chain.story + '-' + tag;
    });
  }
  return copy;
}

/**
 * @param manifest  the week manifest ({ pages: [{ number, half, … }], preset })
 * @param halves    { worship: halfJson, announcements: halfJson }
 * @param op        { type: 'insert', ref, where: 'before'|'after', count, duplicate?: n }
 *                | { type: 'delete', pages: [n] }
 *                | { type: 'move', pages: [n], ref, where: 'before'|'after' }
 * @param myHalf    the half the user is editing (new pages belong to it; only its pages may be
 *                  deleted or moved)
 * @returns { manifest, halves, map: {old: new|null}, focus: new page number, warnings: [] }
 */
function applyPageOp(manifest, halves, op, myHalf) {
  const m = clone(manifest);
  const hs = clone(halves);
  const order = [...m.pages].sort((a, b) => a.number - b.number)
    .map((p) => ({ entry: p, old: p.number, content: (hs[p.half] && hs[p.half].pages[String(p.number)]) || null }));
  const halfOf = (n) => { const e = order.find((x) => x.old === n); return e && e.entry.half; };
  const need = (n) => { if (!order.some((x) => x.old === n)) throw new Error('There is no page ' + n + '.'); };
  const mine = (n) => { need(n); if (halfOf(n) !== myHalf) throw new Error('Page ' + n + ' belongs to the ' + halfOf(n) + ' pages — you are changing the ' + myHalf + ' pages.'); };
  let focusEntry = null;

  if (op.type === 'insert') {
    const count = Math.max(1, Math.min(32, parseInt(op.count, 10) || 1));
    need(op.ref);
    if (op.duplicate != null) need(op.duplicate);
    const at = order.findIndex((x) => x.old === op.ref) + (op.where === 'before' ? 0 : 1);
    const src = op.duplicate != null ? order.find((x) => x.old === op.duplicate).content : null;
    const added = [];
    for (let i = 0; i < count; i++) {
      const tag = 'p' + Date.now().toString(36) + i;
      added.push({ entry: { number: null, half: myHalf }, old: null,
        content: op.duplicate != null ? duplicateContent(src, tag) : { frames: [] } });
    }
    order.splice(at, 0, ...added);
    focusEntry = added[0];
  } else if (op.type === 'delete') {
    const del = [...new Set(op.pages)];
    del.forEach(mine);
    if (del.length >= order.length) throw new Error('A publication needs at least one page.');
    const left = order.filter((x) => !del.includes(x.old));
    const firstIdx = order.findIndex((x) => del.includes(x.old));
    focusEntry = left[Math.min(firstIdx, left.length - 1)];
    order.length = 0;
    order.push(...left);
  } else if (op.type === 'move') {
    const mv = [...new Set(op.pages)];
    mv.forEach(mine);
    need(op.ref);
    if (mv.includes(op.ref)) throw new Error('Choose a page other than the one you are moving.');
    const moving = order.filter((x) => mv.includes(x.old));
    const rest = order.filter((x) => !mv.includes(x.old));
    const at = rest.findIndex((x) => x.old === op.ref) + (op.where === 'before' ? 0 : 1);
    rest.splice(at, 0, ...moving);
    order.length = 0;
    order.push(...rest);
    focusEntry = moving[0];
  } else {
    throw new Error('Unknown page operation: ' + op.type);
  }

  // renumber 1..N in reading order and rebuild each half's pages
  const map = {};
  for (const p of manifest.pages) map[p.number] = null;
  for (const h of Object.keys(hs)) hs[h].pages = {};
  m.pages = order.map((x, i) => {
    const n = i + 1;
    if (x.old != null) map[x.old] = n;
    if (x.content && hs[x.entry.half]) hs[x.entry.half].pages[String(n)] = x.content;
    else if (hs[x.entry.half]) hs[x.entry.half].pages[String(n)] = { frames: [] };
    return { ...x.entry, number: n };
  });
  // a flow-mode half lays itself out again on open (its page list changed)
  for (const h of Object.values(hs)) if (h.mode === 'flow' && h.layout) h.layout.flowHash = null;

  const warnings = [];
  const total = m.pages.length;
  if (/booklet/.test(m.preset || '') && total % 4) {
    warnings.push('A folded booklet needs a multiple of 4 pages — this one now has ' + total + '.');
  }
  return { manifest: m, halves: hs, map, focus: m.pages[order.indexOf(focusEntry)]?.number ?? 1, warnings };
}

function stamp(d = new Date()) {
  const z = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + '_' + z(d.getHours()) + z(d.getMinutes()) + z(d.getSeconds());
}

function writeAtomic(target, data) {
  const tmp = target + '.saving';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
  fs.renameSync(tmp, target);
}

/**
 * Do a page operation on disk. `session` is ./session (claim/release/readLock); `busyElsewhere(half)`
 * reports another window of this app editing that half.
 */
function pageOp(file, myHalf, op, { session, busyElsewhere = () => null }) {
  const abs = path.resolve(file);
  const dir = path.dirname(abs);
  const manifest = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const names = Object.keys(manifest.halves || {});
  if (!names.includes(myHalf)) throw new Error('This week has no "' + myHalf + '" half.');
  if (!session.isMine(session.readLock(session.lockPath(abs, myHalf)))) {
    throw new Error('You are not holding the edit lock for the ' + myHalf + ' pages (someone else may have taken it over).');
  }
  // the other half's page numbers change too: it must not be open for editing anywhere else
  const borrowed = [];
  try {
    for (const h of names) {
      if (h === myHalf) continue;
      const other = busyElsewhere(h);
      if (other) throw new Error('The ' + h + ' pages are open for editing in ' + other + '. Adding, deleting or moving a page renumbers both halves, so close that first.');
      const r = session.claim(abs, h);
      if (!r.ok) {
        const who = r.holder || {};
        throw new Error(who.user + ' is editing the ' + h + ' pages on ' + who.machine + '. Adding, deleting or moving a page renumbers both halves, so wait until they close it.');
      }
      borrowed.push(h);
    }
    const halves = {};
    for (const h of names) {
      const p = path.join(dir, manifest.halves[h]);
      halves[h] = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : { pages: {}, pasteboard: [] };
    }
    const res = applyPageOp(manifest, halves, op, myHalf);
    // history first (append-only), then the new files
    const hist = path.join(dir, 'history');
    fs.mkdirSync(hist, { recursive: true });
    const st = stamp();
    fs.copyFileSync(abs, path.join(hist, 'manifest-' + st + '.bulletin'));
    for (const h of names) {
      const p = path.join(dir, manifest.halves[h]);
      if (fs.existsSync(p)) fs.copyFileSync(p, path.join(hist, h + '-' + st + '-pages.json'));
    }
    for (const h of names) writeAtomic(path.join(dir, manifest.halves[h]), res.halves[h]);
    writeAtomic(abs, res.manifest);
    return { focus: res.focus, map: res.map, warnings: res.warnings, pages: res.manifest.pages.length };
  } finally {
    for (const h of borrowed) session.release(abs, h);
  }
}

module.exports = { applyPageOp, pageOp };
