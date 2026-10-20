// Self-test for the editor (electron . --selftest-edit <week.bulletin>). Runs against a TEMP COPY
// of the week. Drives the real UI code with synthetic pointer and keyboard events, then reports
// checks; main.js adds checks on the files written to disk.
import { joinStory, canon } from './textedit.js';

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

  // ================= 2b: typing and linked stories =================
  const norm = canon;
  const storyText = (st) => joinStory(editor.storyFrames(st).map((x) => x.frame)).map((p) => p.runs.map((r) => r.text).join('')).join(' ');

  // ---- 13. round trip: opening and closing every text frame without typing changes nothing
  let mismatches = [];
  for (const p of W().manifest.pages.filter((q) => q.half === 'announcements')) {
    const n = p.number;
    if (editor.pageEntry(n).locked) continue;
    const texts = [];
    editor.pageEntry(n).frames.forEach((f) => (function walk(g) { if (g.kind === 'text' && !g.locked) texts.push(g.id); (g.children || []).forEach(walk); })(f));
    for (const id of texts) {
      const before = norm(editor.anyFrame(n, id).text.paragraphs);
      if (!editor.beginTextEdit(n, id)) continue;
      await editor.endTextEdit();
      const after = norm(editor.anyFrame(n, id).text.paragraphs);
      if (before !== after) {
        const b = JSON.parse(before), a = JSON.parse(after); // canonical forms
        let k = 0; while (k < Math.max(a.length, b.length) && JSON.stringify(a[k]) === JSON.stringify(b[k])) k++;
        mismatches.push({ at: n + ':' + id, nb: b.length, na: a.length, para: k, before: b[k], after: a[k] });
      }
    }
  }
  ok('round trip (edit, no typing) leaves every frame unchanged', mismatches.length === 0, { got: mismatches });

  // ---- 14. typing at the start of a linked story pushes text into the next frame
  const head = editor.pageEntry(10).frames.find((f) => f.text && f.text.chain && f.text.chain.index === 0);
  const story = head.text.chain.story;
  const origStory = storyText(story);
  const origTail = norm(editor.storyFrames(story)[1].frame.text.paragraphs);
  const ins = 'NEW '.repeat(60);
  editor.beginTextEdit(10, head.id);
  const flow = editor.editingFlow();
  const firstText = (function find(n) { for (const c of n.childNodes) { if (c.nodeType === 3 && c.data.trim() && parseInt(getComputedStyle(c.parentElement).fontWeight, 10) < 600) return c; if (c.nodeType === 1 && !c.classList.contains('wrap-float')) { const r = find(c); if (r) return r; } } return null; })(flow);
  const rg = document.createRange(); rg.setStart(firstText, 0); rg.collapse(true);
  window.getSelection().removeAllRanges(); window.getSelection().addRange(rg);
  document.execCommand('insertText', false, ins);
  await editor.endTextEdit();
  const typedStory = storyText(story);
  ok('typed text saved in the frame', editor.anyFrame(10, head.id).text.paragraphs.some((p) => p.runs.some((r) => r.text.includes('NEW NEW'))));
  ok('no text lost or duplicated across the linked frames', typedStory.replace(ins, '') === origStory, { got: typedStory.length - origStory.length, expect: ins.length });
  ok('reflow moved text into the next frame', norm(editor.storyFrames(story)[1].frame.text.paragraphs) !== origTail);

  // ---- 15. undo / redo a typing session
  await editor.command('undo');
  ok('undo restores the story', storyText(story) === origStory);
  await editor.command('redo');
  ok('redo re-applies the typing', storyText(story) === typedStory);

  // ---- 16. bold on a selection
  editor.beginTextEdit(10, head.id);
  const fl2 = editor.editingFlow();
  const t2 = (function find(n) { for (const c of n.childNodes) { if (c.nodeType === 3 && c.data.startsWith('NEW')) return c; if (c.nodeType === 1) { const r = find(c); if (r) return r; } } return null; })(fl2);
  const rb = document.createRange(); rb.setStart(t2, 0); rb.setEnd(t2, 3);
  window.getSelection().removeAllRanges(); window.getSelection().addRange(rb);
  editor.format('bold');
  await editor.endTextEdit();
  const r0 = editor.anyFrame(10, head.id).text.paragraphs.flatMap((p) => p.runs).find((r) => r.text.startsWith('NEW'));
  ok('bold applies to the selected word only', r0 && r0.bold === true && r0.text === 'NEW', { got: r0 });
  const diffAt = (a, b) => { let k = 0; while (k < a.length && a[k] === b[k]) k++; return { at: k, was: JSON.stringify(b.slice(Math.max(0, k - 20), k + 30)), now: JSON.stringify(a.slice(Math.max(0, k - 20), k + 30)), lenWas: b.length, lenNow: a.length }; };
  ok('bold keeps the story text', storyText(story) === typedStory, { got: diffAt(storyText(story), typedStory) });

  // ---- 17. shrinking a linked frame re-flows, losing nothing
  editor.select(10, head.id);
  const hf = editor.topFrame(10, head.id);
  await editor.setBox({ x: hf.x, y: hf.y, w: hf.w, h: hf.h - 72 });
  ok('shrinking a linked frame keeps every character', storyText(story) === typedStory);

  // ---- 18. deleting a linked frame hands its text to the rest of the chain
  const tailFrame = editor.storyFrames(story)[1];
  editor.select(tailFrame.n, tailFrame.frame.id);
  await editor.command('delete');
  ok('delete linked frame keeps the story text', storyText(story) === typedStory);
  await editor.command('undo');
  ok('undo brings the linked frame back', editor.storyFrames(story).length === 2);

  // ================= 2c: pictures, insert, copy/paste, stacking, pasteboard =================
  const P2 = 12;
  editor.select(P2, null); editor.lastPage = P2;
  const countP2 = () => editor.pageEntry(P2).frames.length;

  // ---- 19. insert a text box and type in it
  let n0 = countP2();
  const tb = await editor.command('insert-text');
  ok('insert text box adds a frame and opens it for typing', countP2() === n0 + 1 && !!editor.textEdit);
  document.execCommand('selectAll');
  document.execCommand('insertText', false, 'Hello from the self-test');
  await editor.endTextEdit();
  const tbText = editor.anyFrame(P2, tb.id).text.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('|');
  ok('typed into the new text box', tbText === 'Hello from the self-test', { got: tbText });

  // ---- 20. insert line + rectangle
  n0 = countP2();
  await editor.command('insert-line');
  const rect = await editor.command('insert-rect');
  ok('insert line and rectangle', countP2() === n0 + 2 && rect.shape.type === 'rect');

  // ---- 21. copy / paste / duplicate
  editor.select(P2, rect.id);
  await key('c', { ctrlKey: true });
  n0 = countP2();
  await key('v', { ctrlKey: true });
  const pasted = editor.frame();
  ok('Ctrl+V pastes a copy 9 pt down-right with a new id', countP2() === n0 + 1 && pasted.id !== rect.id && near(pasted.x, rect.x + 9, 0.01) && near(pasted.y, rect.y + 9, 0.01));
  await key('d', { ctrlKey: true });
  ok('Ctrl+D duplicates', countP2() === n0 + 2);

  // ---- 22. stacking order
  const zAll = () => editor.pageEntry(P2).frames.map((f) => f.z || 0);
  editor.select(P2, rect.id);
  await editor.command('back');
  ok('Send to back puts it lowest', editor.topFrame(P2, rect.id).z === Math.min(...zAll()));
  await editor.command('front');
  ok('Bring to front puts it highest', editor.topFrame(P2, rect.id).z === Math.max(...zAll()));

  // ---- 23. crop mode: an edge handle crops, the picture itself doesn't move or scale
  const pic = editor.pageEntry(P2).frames.find((f) => f.kind === 'image' && !f.locked && f.id !== img.id && f.w > 100);
  editor.select(P2, pic.id);
  await editor.command('crop');
  ok('crop mode on', !!editor.crop);
  const geom = (f) => { const [l, t, r, b] = f.image.crop; const FW = f.w / (1 - l - r), FH = f.h / (1 - t - b); return { FW, FH, ix: f.x - l * FW, iy: f.y - t * FH }; };
  const g0 = geom(editor.topFrame(P2, pic.id));
  const sp = scaleOf(P2);
  const eh = shells.get(P2).querySelector('.handle.h-e');
  await drag(eh, center(eh), -20 * sp, 0);
  const pc = editor.topFrame(P2, pic.id);
  const g1 = geom(pc);
  ok('crop handle trims the frame by 20 pt', near(pc.w, pic.w - 20, 0.5), { got: pc.w - pic.w });
  ok('crop keeps the picture in place and at its size', near(g1.FW, g0.FW, 0.1) && near(g1.ix, g0.ix, 0.1) && near(g1.FH, g0.FH, 0.1), { got: [g0, g1] });
  await drag(frameEl(P2, pic.id), center(frameEl(P2, pic.id)), 8 * sp, 0);
  const pp = editor.topFrame(P2, pic.id);
  ok('dragging inside slides the picture, frame stays', near(pp.x, pc.x, 0.01) && near(pp.w, pc.w, 0.01) && near(geom(pp).ix, g1.ix + 8, 0.5), { got: geom(pp).ix - g1.ix });
  await key('Escape');
  ok('Esc leaves crop mode', !editor.crop);

  // ---- 24. fit and fill
  editor.select(P2, pic.id);
  await editor.command('fill');
  let pf = editor.topFrame(P2, pic.id);
  const nat = editor.naturalSize(P2, pic.id);
  const visAspect = (f) => { const [l, t, r, b] = f.image.crop; return (nat.w * (1 - l - r)) / (nat.h * (1 - t - b)); };
  ok('Fill: picture covers the frame without distortion', near(visAspect(pf), pf.w / pf.h, 0.01) && pf.image.crop.every((v) => v >= -1e-6), { got: pf.image.crop });
  await editor.command('fit');
  pf = editor.topFrame(P2, pic.id);
  ok('Fit: whole picture visible, no distortion', near(visAspect(pf), pf.w / pf.h, 0.01) && pf.image.crop.every((v) => v <= 1e-6), { got: pf.image.crop });

  // ---- 25. pasteboard round trip
  editor.select(P2, rect.id);
  const pbBefore = (W().halves.announcements.pasteboard || []).length;
  await editor.command('to-pasteboard');
  ok('To pasteboard removes it from the page', !editor.topFrame(P2, rect.id) && W().halves.announcements.pasteboard.length === pbBefore + 1);
  await editor.placeFromPasteboard(rect.id, P2);
  const placed = editor.topFrame(P2, rect.id);
  ok('Place puts it back, centred on the page', !!placed && near(placed.x + placed.w / 2, W().manifest.page.width / 2, 0.05) && W().halves.announcements.pasteboard.length === pbBefore);

  // ---- 26. insert a picture from a file (re-uses identical bytes already in assets/)
  const someAsset = W().halves.announcements.pages['12'].frames.find((f) => f.kind === 'image').image.asset;
  const abs = decodeURIComponent(new URL(someAsset, W().baseUrl).pathname).replace(/^\/([A-Za-z]:)/, '$1');
  const insPic = await editor.insertPicture(abs);
  ok('insert picture from file (same bytes reuse the existing asset)', !!insPic && insPic.image.asset === someAsset, { got: insPic && insPic.image.asset });

  // ---- 12. save
  ok('dirty before save', editor.dirty === true);
  ok('save succeeds', await editor.save());
  ok('clean after save', editor.dirty === false);

  // ---- 27. pages (Insert ▸ Page, Page Design ▸ Delete / Move) — net zero, so the disk checks below hold
  const nPages0 = W().manifest.pages.length;
  const pg = (n) => JSON.stringify(editor.pageEntry(n));
  const p13 = pg(13), p14 = pg(14);
  let pr = await window.__bbPageOp({ type: 'insert', ref: 12, where: 'after', count: 4 });
  ok('insert 4 pages after 12: count +4, later pages renumbered, new pages blank and shown',
    !!pr && W().manifest.pages.length === nPages0 + 4 && pg(17) === p13 && editor.pageEntry(13).frames.length === 0 && shells.has(nPages0 + 4) && editor.half === 'announcements');
  for (let k = 0; k < 4; k++) pr = await window.__bbPageOp({ type: 'delete', pages: [13] });
  ok('delete them again: back to the original pages', W().manifest.pages.length === nPages0 && pg(13) === p13);
  await window.__bbPageOp({ type: 'move', pages: [13], ref: 15, where: 'after' });
  ok('move page 13 after 15', pg(15) === p13 && pg(13) === p14);
  await window.__bbPageOp({ type: 'move', pages: [15], ref: 13, where: 'before' });
  ok('move it back', pg(13) === p13 && pg(14) === p14);
  pr = await window.__bbPageOp({ type: 'delete', pages: [3] });
  ok('a page of the other half cannot be deleted', pr === null && W().manifest.pages.length === nPages0);

  // ---- 28. Home ▸ Font / Paragraph on the self-test text box (after the save: disk checks unaffected)
  const tbParas = () => editor.anyFrame(P2, tb.id).text.paragraphs;
  const runsOf = () => tbParas().flatMap((q) => q.runs).filter((r) => r.text.trim());
  async function withText(fn, { part } = {}) {
    editor.select(P2, tb.id);
    editor.beginTextEdit(P2, tb.id);
    await wait(80);
    const flow = editor.editingFlow();
    const r = document.createRange();
    const p0 = flow.querySelector('p');
    if (part) {
      // the first word only
      const tn = document.createTreeWalker(p0, NodeFilter.SHOW_TEXT).nextNode();
      r.setStart(tn, 0); r.setEnd(tn, Math.min(5, tn.data.length));
    } else {
      r.selectNodeContents(p0);
    }
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    await fn(flow);
    await editor.endTextEdit();
    await wait(80);
  }
  const size0 = runsOf()[0].size;
  await withText(() => editor.format('grow'));
  ok('Grow Font steps the size up (Publisher size list)', runsOf()[0].size > size0, { got: [size0, runsOf()[0].size] });
  await withText(() => editor.format('shrink'));
  ok('Shrink Font steps it back down', Math.abs(runsOf()[0].size - size0) < 0.05, { got: runsOf()[0].size });
  await withText(() => editor.format('color', '#C00000'));
  ok('Font Color', runsOf().every((r) => r.color === '#C00000'), { got: runsOf().map((r) => r.color) });
  await withText(() => editor.format('case', 'upper'));
  ok('Change Case ▸ UPPERCASE keeps the formatting', runsOf().every((r) => r.text === r.text.toUpperCase() && r.color === '#C00000'));
  await withText(() => editor.format('tracking', 125));
  ok('Character Spacing ▸ Very Loose', runsOf().every((r) => Math.abs((r.tracking || 100) - 125) < 2), { got: runsOf().map((r) => r.tracking) });
  await withText(() => editor.format('superscript'), { part: true });
  const supRun = runsOf().find((r) => r.superscript);
  ok('Superscript on part of a line keeps its point size', !!supRun && Math.abs(supRun.size - size0) < 0.3, { got: supRun });
  await withText(() => editor.format('clear'));
  ok('Clear All Formatting', runsOf().every((r) => !r.color && !r.superscript && !r.tracking), { got: runsOf()[0] });
  await withText(() => editor.format('bullets'));
  ok('Bullets: marker + hanging indent', tbParas()[0].runs[0].text.startsWith('\u2022\t') && tbParas()[0].indentFirst === -18 && tbParas()[0].indentLeft === 18);
  await withText(() => editor.format('bullets'));
  ok('Bullets again turns them off', !tbParas()[0].runs.map((r) => r.text).join('').startsWith('\u2022') && !tbParas()[0].indentLeft);
  await withText(() => editor.format('numbering'));
  ok('Numbering', /^1\.\t/.test(tbParas()[0].runs.map((r) => r.text).join('')));
  await withText(() => editor.format('numbering'));
  await withText(() => editor.format('indent'));
  ok('Increase Indent', tbParas()[0].indentLeft === 18);
  await withText(() => editor.format('outdent'));
  ok('Decrease Indent', !tbParas()[0].indentLeft);
  await withText(() => editor.format('lineSpacing', 1.5));
  ok('Line Spacing 1.5', (tbParas()[0].lineSpacing || {}).multiple === 1.5);
  await withText(() => editor.format('paragraph', { indentLeft: 9, indentFirst: 0, indentRight: 0, spaceBefore: 6, spaceAfter: 3, lineSpacing: 1 }));
  ok('Paragraph dialog values', tbParas()[0].indentLeft === 9 && tbParas()[0].spaceBefore === 6 && tbParas()[0].spaceAfter === 3 && tbParas()[0].lineSpacing.multiple === 1);

  // ---- 29. Arrange: several objects, align, distribute, group, rotate, flip, wrap, columns
  const free = editor.pageEntry(P2).frames.filter((g) => !g.locked && g.kind !== 'group').slice(0, 3);
  editor.select(P2, free[0].id);
  editor.toggleMulti(P2, free[1].id);
  editor.toggleMulti(P2, free[2].id);
  ok('Shift+click selects several objects', editor.selection().length === 3 && document.querySelectorAll('.sel-box.multi').length === 2);
  const xs0 = editor.selection().map((g) => g.x);
  await editor.moveBy(9, 0);
  ok('nudging moves every selected object', editor.selection().every((g, i) => Math.abs(g.x - xs0[i] - 9) < 0.01));
  await editor.alignSelection('left', false);
  const left = Math.min(...editor.selection().map((g) => g.x));
  ok('Align Left lines them up on the leftmost', editor.selection().every((g) => Math.abs(g.x - left) < 0.01));
  const vOrder = editor.selection().slice().sort((a, b) => a.y - b.y).map((g) => g.id);
  await editor.distributeSelection('v', false);
  const ys = vOrder.map((id) => editor.topFrame(P2, id)).map((g) => [g.y, g.h]);
  const gaps = [ys[1][0] - ys[0][0] - ys[0][1], ys[2][0] - ys[1][0] - ys[1][1]];
  ok('Distribute Vertically: equal gaps', Math.abs(gaps[0] - gaps[1]) < 0.05, { got: gaps });
  const nFrames = editor.pageEntry(P2).frames.length;
  await editor.groupSelection();
  const grpNew = editor.frame();
  ok('Group: one group of 3, selected', grpNew && grpNew.kind === 'group' && grpNew.children.length === 3 && editor.pageEntry(P2).frames.length === nFrames - 2);
  await editor.rotateSelection(90);
  ok('Rotate Right 90', editor.frame().rotation === 90 && !!frameEl(P2, grpNew.id));
  await editor.flipSelection('h');
  ok('Flip Horizontal', editor.frame().flipH === true);
  await editor.rotateSelection(-90); await editor.flipSelection('h');
  await editor.ungroupSelection();
  ok('Ungroup: the 3 objects come back, all selected', editor.pageEntry(P2).frames.length === nFrames && editor.selection().length === 3);
  editor.select(P2, pic.id);
  await editor.setWrap('square');
  ok('Wrap Text ▸ Square', (editor.topFrame(P2, pic.id).wrap || {}).type === 'square');
  await editor.setWrap('none');
  ok('Wrap Text ▸ None', !editor.topFrame(P2, pic.id).wrap);
  editor.select(P2, tb.id);
  await editor.setColumns(2);
  ok('Text box Columns ▸ Two', editor.anyFrame(P2, tb.id).text.columns === 2);
  await editor.command('undo');
  ok('undo puts one column back', !editor.anyFrame(P2, tb.id).text.columns);

  diskChecks.push({ name: 'moved picture x', page: P, id: img.id, field: 'x', expect: savedX });
  diskChecks.push({ name: 'moved picture y', page: P, id: img.id, field: 'y', expect: savedY });
  diskChecks.push({ name: 'picture locked', page: P, id: img.id, field: 'locked', expect: true });
  diskChecks.push({ name: 'page 16 locked', page: G, id: grp.id, field: '@page.locked', expect: true });
  diskChecks.push({ name: 'group y', page: G, id: grp.id, field: 'y', expect: editor.topFrame(G, grp.id).y });
  diskChecks.push({ name: 'bold word saved', page: 10, id: head.id, field: 'text.paragraphs.0.runs.0.bold', expect: true });
  diskChecks.push({ name: 'new text box saved', page: P2, id: tb.id, field: 'text.paragraphs.0.runs.0.text', expect: 'Hello from the self-test' });
  diskChecks.push({ name: 'fit saved on picture', page: P2, id: pic.id, field: 'image.fit', expect: 'fit' });
  diskChecks.push({ name: 'deleted frame restored', page: P, id: del.id, field: 'id', expect: del.id });

  return { checks, diskChecks };
}
