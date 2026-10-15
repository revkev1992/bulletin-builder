// Self-test for the editor (electron . --selftest-edit <week.bulletin>). Runs against a TEMP COPY
// of the week. Drives the real UI code with synthetic pointer and keyboard events, then reports
// checks; main.js adds checks on the files written to disk.

const near = (a, b, tol = 0.6) => Math.abs(a - b) <= tol;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function run(editor, { shells, week }) {
  const checks = [];
  const diskChecks = [];
  const ok = (name, pass, extra = {}) => checks.push({ name, pass: !!pass, ...extra });

  const W = () => week();
  const topFrames = (n) => editor.pageEntry(n).frames;
  const center = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  const scaleOf = (n) => shells.get(n).querySelector('.page').getBoundingClientRect().width / W().manifest.page.width;
  const frameEl = (n, id) => shells.get(n).querySelector('.frame[data-id="' + id + '"]');

  async function drag(target, from, dx, dy, { alt = true } = {}) {
    const opts = (x, y) => ({ bubbles: true, clientX: x, clientY: y, button: 0, buttons: 1, altKey: alt, pointerId: 1 });
    target.dispatchEvent(new PointerEvent('pointerdown', opts(from.x, from.y)));
    for (let k = 1; k <= 4; k++) window.dispatchEvent(new PointerEvent('pointermove', opts(from.x + dx * k / 4, from.y + dy * k / 4)));
    window.dispatchEvent(new PointerEvent('pointerup', opts(from.x + dx, from.y + dy)));
    await wait(150);
  }
  const key = async (k, extra = {}) => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...extra })); await wait(120); };

  // ---- 0. view only: nothing moves
  const P = 12;                                          // an announcements page with pictures
  const img = topFrames(P).find((f) => f.kind === 'image' && !f.children);
  const x0 = img.x;
  await drag(frameEl(P, img.id), center(frameEl(P, img.id)), 40, 0);
  ok('view-only: drag does nothing', near(editor.topFrame(P, img.id).x, x0, 0.001));

  // ---- 1. claim the announcements half
  ok('claim announcements', await editor.claim('announcements'));

  // ---- 2. drag-move (snapping off with Alt)
  let f = editor.topFrame(P, img.id);
  const s = scaleOf(P);
  await drag(frameEl(P, img.id), center(frameEl(P, img.id)), 30 * s, 12 * s);
  let g = editor.topFrame(P, img.id);
  ok('drag moves frame by 30,12 pt', near(g.x, f.x + 30) && near(g.y, f.y + 12), { got: [g.x - f.x, g.y - f.y] });

  // ---- 3. nudge with arrows
  f = editor.topFrame(P, img.id);
  await key('ArrowRight'); await key('ArrowRight'); await key('ArrowDown', { shiftKey: true });
  g = editor.topFrame(P, img.id);
  ok('arrows nudge +2 pt right, Shift+Down 9 pt', near(g.x, f.x + 2, 0.01) && near(g.y, f.y + 9, 0.01), { got: [g.x - f.x, g.y - f.y] });

  // ---- 4. resize from the SE handle keeps a picture's proportions
  f = editor.topFrame(P, img.id);
  const handle = shells.get(P).querySelector('.handle.h-se');
  await drag(handle, center(handle), 36 * s, 0);
  g = editor.topFrame(P, img.id);
  ok('resize grows width ~36 pt', near(g.w, f.w + 36, 1), { got: g.w - f.w });
  ok('resize keeps picture proportions', near(g.h / g.w, f.h / f.w, 0.005), { got: [g.h / g.w, f.h / f.w] });

  // ---- 5. snapping: drag near the left margin with snapping on -> lands exactly on it
  f = editor.topFrame(P, img.id);
  const m = W().manifest.margins;
  const leftMargin = P % 2 === 1 ? m.inside : m.outside;
  const want = leftMargin + 2.5;                         // aim 2.5 pt past the margin
  await drag(frameEl(P, img.id), center(frameEl(P, img.id)), (want - f.x) * s, 0, { alt: false });
  g = editor.topFrame(P, img.id);
  ok('snaps to the left margin', near(g.x, leftMargin, 0.01), { got: g.x, expect: leftMargin });

  // ---- 6. numeric X field
  const fx = document.getElementById('fx');
  fx.value = '2.00'; fx.dispatchEvent(new Event('change')); await wait(150);
  g = editor.topFrame(P, img.id);
  ok('X field moves frame to 2.00 in', near(g.x, 144, 0.01), { got: g.x });
  const savedX = g.x, savedY = g.y;

  // ---- 7. lock: frame stops moving; undo/redo
  await key('l', { ctrlKey: true });
  ok('Ctrl+L locks frame', editor.topFrame(P, img.id).locked === true);
  await drag(frameEl(P, img.id), center(frameEl(P, img.id)), 50 * s, 0);
  await key('ArrowLeft');
  ok('locked frame ignores drag and arrows', near(editor.topFrame(P, img.id).x, savedX, 0.001));
  await editor.command('undo');
  ok('undo unlocks', !editor.topFrame(P, img.id).locked);
  await editor.command('redo');
  ok('redo locks again', editor.topFrame(P, img.id).locked === true);

  // ---- 8. group: clicking a member selects and moves the whole group (page 16)
  const G = 16;
  const grp = topFrames(G).find((x) => x.kind === 'group');
  const member = grp.children.find((c) => frameEl(G, c.id));
  const before = JSON.stringify(grp.children.map((c) => [c.x, c.y]));
  const sg = scaleOf(G);
  await drag(frameEl(G, member.id), center(frameEl(G, member.id)), 0, 18 * sg);
  const g2 = editor.topFrame(G, grp.id);
  ok('click on member selects its group', editor.sel && editor.sel.id === grp.id);
  ok('group moved 18 pt down as one', near(g2.y, grp.y + 18) && g2.children.every((c, i) => near(c.y, JSON.parse(before)[i][1] + 18)));

  // ---- 9. page lock
  editor.select(G, null); editor.lastPage = G;
  await editor.command('lock-page');
  ok('page lock set', editor.pageEntry(G).locked === true);
  const gy = editor.topFrame(G, grp.id).y;
  await drag(frameEl(G, member.id), center(frameEl(G, member.id)), 0, 30 * sg);
  ok('locked page: frames do not move', near(editor.topFrame(G, grp.id).y, gy, 0.001));

  // ---- 10. a worship page can't be touched while editing announcements
  const Wp = 3;
  const wf = editor.pageEntry(Wp).frames[0];
  const wx = wf.x;
  await drag(frameEl(Wp, wf.id), center(frameEl(Wp, wf.id)), 40, 0);
  ok('other half is untouchable', near(editor.pageEntry(Wp).frames[0].x, wx, 0.001));

  // ---- 11. delete + undo
  const del = topFrames(P).find((x) => x.id !== img.id && !x.locked);
  editor.select(P, del.id);
  await key('Delete');
  ok('Delete removes frame', !editor.topFrame(P, del.id));
  await editor.command('undo');
  ok('undo restores deleted frame', !!editor.topFrame(P, del.id));

  // ---- 12. save
  ok('dirty before save', editor.dirty === true);
  ok('save succeeds', await editor.save());
  ok('clean after save', editor.dirty === false);

  diskChecks.push({ name: 'moved picture x', page: P, id: img.id, field: 'x', expect: savedX });
  diskChecks.push({ name: 'moved picture y', page: P, id: img.id, field: 'y', expect: savedY });
  diskChecks.push({ name: 'picture locked', page: P, id: img.id, field: 'locked', expect: true });
  diskChecks.push({ name: 'page 16 locked', page: G, id: grp.id, field: '@page.locked', expect: true });
  diskChecks.push({ name: 'group y', page: G, id: grp.id, field: 'y', expect: editor.topFrame(G, grp.id).y });
  diskChecks.push({ name: 'deleted frame restored', page: P, id: del.id, field: 'id', expect: del.id });

  return { checks, diskChecks };
}
