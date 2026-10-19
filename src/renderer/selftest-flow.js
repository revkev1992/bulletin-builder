// Self-test for flow mode (electron . --selftest-flow <week.bulletin>), on a TEMP COPY of a
// flow-mode week. Checks the layout invariants, then drives the Order of Worship panel the way a
// person would (field changes, clicks, add / move / delete / undo, styles, cover) and reports checks;
// main.js adds checks on the files written to disk.
import { worshipPages, flowHash, layoutFlow, compileBlock } from './flow.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function run(editor, { shells, week }) {
  const checks = [];
  const ok = (name, pass, extra = {}) => checks.push({ name, pass: !!pass, ...extra });
  const W = () => week();
  const half = () => W().halves.worship;
  const flow = () => half().flow;
  const pages = () => worshipPages(W());
  const bodyPages = () => pages().slice(1);
  const gen = (n) => (half().pages[String(n)] || { frames: [] }).frames.filter((f) => f.generated);
  const paraText = (p) => p.runs.map((r) => r.text).join('');
  const pageText = (n) => gen(n).filter((f) => f.kind === 'text').map((f) => f.text.paragraphs.map(paraText).join('\n')).join('\n');
  const allText = () => bodyPages().map(pageText).join('\n');
  const bp = () => half().layout.blockPage || {};

  // every editFlow() the panel triggers is awaited through this
  let last = Promise.resolve();
  const orig = editor.editFlow.bind(editor);
  editor.editFlow = (m) => { last = orig(m); return last; };
  const settled = async () => { await wait(30); await last; await wait(60); };
  const field = (sel) => document.querySelector('#flowpanel ' + sel);
  const change = async (el, value) => {
    if (el.type === 'checkbox') el.checked = value; else el.value = value;
    el.dispatchEvent(new Event('change'));
    await settled();
  };

  // ================= layout invariants (as opened) =================
  ok('week opens in flow mode with a saved-or-fresh layout', half().mode === 'flow' && half().layout && half().layout.flowHash === flowHash(W(), half()));
  const g = flow().grid || { left: 36, top: 36, width: 432, height: 540 };
  const bottom = (g.top || 36) + (g.height || 540);
  const outside = [];
  for (const n of bodyPages()) for (const f of gen(n)) {
    if (f.note || f.kind === 'shape') continue;
    if (f.x < g.left - 0.5 || f.x + f.w > g.left + g.width + 0.5 || f.y < g.top - 0.5 || f.y + f.h > bottom + 2.5) outside.push(n + ':' + f.id);
  }
  ok('every laid-out frame sits inside the 6" text grid', outside.length === 0, { got: outside });
  const overflowing = [...document.querySelectorAll('.page .frame[data-generated].overflow')].map((e) => e.closest('[data-page]').dataset.page + ':' + e.dataset.id);
  ok('no laid-out text frame overflows', overflowing.length === 0, { got: overflowing });

  // blocks appear in order, page by page, top to bottom
  const seen = [];
  for (const n of bodyPages()) {
    const frames = gen(n).filter((f) => !f.note && f.kind !== 'shape').sort((a, b) => a.y - b.y);
    for (const f of frames) {
      const ids = f.kind === 'text' ? f.text.paragraphs.map((p) => p.block) : [f.block];
      for (const id of ids) if (seen[seen.length - 1] !== id) seen.push(id);
    }
  }
  const order = flow().blocks.map((b) => b.id).filter((id) => seen.includes(id));
  ok('blocks are laid out in order', JSON.stringify([...new Set(seen)]) === JSON.stringify(order), { got: seen.slice(0, 12) });
  const over = half().layout.overflowBlocks || [];
  const placed = new Set(seen);
  ok('every block is either on a page or listed as overflow', flow().blocks.every((b) => placed.has(b.id) || over.includes(b.id) || b.kind === 'space' || !(b.images || b.lines || b.paragraphs || b.heading || b.text || b.rubric)),
    { got: flow().blocks.filter((b) => !placed.has(b.id) && !over.includes(b.id)).map((b) => b.id) });

  // a heading never ends a page when more follows
  const orphans = [];
  for (const n of bodyPages().slice(0, -1)) {
    const frames = gen(n).filter((f) => f.kind === 'text' && !f.note).sort((a, b) => a.y - b.y);
    const lastF = frames[frames.length - 1];
    const nextHas = gen(n + 1).length > 0;
    if (!lastF || !nextHas) continue;
    const lastP = lastF.text.paragraphs[lastF.text.paragraphs.length - 1];
    const imgAfter = gen(n).some((f) => f.kind === 'image' && f.y > lastF.y);
    // stranded = a section divider, or a heading whose OWN block continues on the next page
    // (a heading-only line such as "*HYMN ⇥ TFWS 2009" may end a page — Kevin, 2026-10-15)
    const contNext = gen(n + 1).some((f) => f.block === lastP.block || (f.kind === 'text' && f.text.paragraphs.some((p) => p.block === lastP.block)));
    if (lastP && (lastP.style === 'section' || (lastP.style === 'item' && contNext)) && !imgAfter) orphans.push(n + ': ' + paraText(lastP));
  }
  // the case Kevin flagged: a heading-only item does not keep with the block after it
  const lone = compileBlock(flow(), { id: 'x', kind: 'item', heading: { label: 'HYMN', middle: 'UMH 1', right: 'TUNE' } }, {});
  const sect = compileBlock(flow(), { id: 'y', kind: 'section', text: 'WE GATHER' }, {});
  ok('a heading-only item can end a page; a section divider cannot', lone.length === 1 && !lone[0].keepWithNext && sect[sect.length - 1].keepWithNext);
  ok('no order-of-worship line is stranded at the bottom of a page', orphans.length === 0, { got: orphans });
  // pictures whole and inside the page
  const pics = bodyPages().flatMap((n) => gen(n).filter((f) => f.kind === 'image').map((f) => ({ n, f })));
  ok('music / pictures are whole and inside the grid', pics.every(({ f }) => f.h <= g.height + 0.5 && f.y + f.h <= bottom + 0.5 && f.w <= g.width + 0.5), { got: pics.length });
  // people lines are bold, leader lines are not
  const dlg = flow().blocks.find((b) => b.kind === 'dialog' && placed.has(b.id));
  const dparas = bodyPages().flatMap((n) => gen(n).filter((f) => f.kind === 'text').flatMap((f) => f.text.paragraphs)).filter((p) => p.block === dlg.id);
  ok('people lines print bold, leader lines regular', dparas.some((p) => p.style === 'people' && p.runs.every((r) => r.bold)) && dparas.some((p) => p.style === 'leader' && p.runs.every((r) => !r.bold)));
  // the text of every dialog / prayer line made it onto a page
  const missing = [];
  const txt = allText();
  for (const b of flow().blocks.filter((x) => placed.has(x.id) && !over.includes(x.id))) {
    for (const l of b.lines || []) { const t = (typeof l === 'string' ? l : l.text).replace(/^\t+/, ''); if (!txt.includes(t.split('\n')[0].trim())) missing.push(b.id + ': ' + t.slice(0, 40)); }
  }
  ok('no line of a dialog or prayer is lost', missing.length === 0, { got: missing.slice(0, 5) });
  // the cover
  const cover = gen(pages()[0]);
  ok('cover laid out from its fields (masthead, art, caption, commentary)', ['gc-masthead', 'gc-caption', 'gc-commentary'].every((id) => cover.some((f) => f.id === id)) &&
    cover.find((f) => f.id === 'gc-masthead').text.paragraphs.some((p) => paraText(p) === flow().cover.date));

  // ================= view only =================
  const firstGen = document.querySelector('.page[data-page="' + bodyPages()[0] + '"] .frame[data-generated]');
  const r0 = firstGen.getBoundingClientRect();
  firstGen.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r0.left + 5, clientY: r0.top + 5, button: 0, buttons: 1, pointerId: 1 }));
  window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: r0.left + 5, clientY: r0.top + 5, pointerId: 1 }));
  ok('view only: the panel is hidden', document.getElementById('flowpanel').hidden === true);

  // ================= claim the worship half =================
  ok('claim worship', await editor.claim('worship'));
  await wait(100);
  const panel = editor.panel;
  ok('Order of Worship panel shows every block', !document.getElementById('flowpanel').hidden && document.querySelectorAll('#flowpanel .fp-row').length === flow().blocks.length);

  // clicking a laid-out line selects its block
  const target = flow().blocks.find((b) => b.kind === 'dialog' && placed.has(b.id));
  const posBefore = JSON.stringify(gen(bp()[target.id]).map((f) => [f.id, f.x, f.y]));
  const line = document.querySelector('.page p.para[data-block="' + target.id + '"]');
  const rl = line.getBoundingClientRect();
  line.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: rl.left + 3, clientY: rl.top + 3, button: 0, buttons: 1, pointerId: 1 }));
  window.dispatchEvent(new PointerEvent('pointermove', { clientX: rl.left + 60, clientY: rl.top + 3, pointerId: 1 }));
  window.dispatchEvent(new PointerEvent('pointerup', { clientX: rl.left + 60, clientY: rl.top + 3, pointerId: 1 }));
  await wait(150);
  ok('clicking a line on the page selects its block in the panel', panel.selId === target.id, { got: panel.selId });
  ok('a laid-out frame cannot be dragged (no frame selection, block unchanged)', editor.sel == null && JSON.stringify(gen(bp()[target.id]).map((f) => [f.id, f.x, f.y])) === posBefore);
  ok('its lines are highlighted on the page', document.querySelectorAll('.page .flow-hl').length > 0);

  // ================= edit a field =================
  await change(field('input[data-field="heading.label"]'), 'CALL TO WORSHIP (TEST)');
  ok('editing the label re-lays the page with the new text', allText().includes('CALL TO WORSHIP (TEST)') && flow().blocks.find((b) => b.id === target.id).heading.label === 'CALL TO WORSHIP (TEST)');
  ok('the change is undoable and marks the week unsaved', editor.undo.length >= 1 && editor.dirty === true);

  // standing checkbox
  const item = flow().blocks.find((b) => b.kind === 'item' && b.heading && !b.heading.standing && placed.has(b.id));
  panel.select(item.id); await wait(50);
  await change(field('input[data-field="heading.standing"]'), true);
  const mark = flow().standingMark || '*';
  ok('"Congregation stands" adds the standing mark to the printed line', allText().split('\n').some((l) => l.startsWith(mark + item.heading.label)));

  // dialog line editor: change a leader line to People -> bold
  panel.select(target.id); await wait(50);
  const whoSel = field('.fp-dline select');
  const firstLineText = flow().blocks.find((b) => b.id === target.id).lines[0].text;
  await change(whoSel, 'people');
  const p1 = bodyPages().flatMap((n) => gen(n).filter((f) => f.kind === 'text').flatMap((f) => f.text.paragraphs)).find((p) => p.block === target.id && paraText(p) === firstLineText);
  ok('switching a line to People makes it bold automatically', p1 && p1.style === 'people' && p1.runs.every((r) => r.bold), { got: p1 && p1.style });

  // ================= a text block edited in place (rich) =================
  const tb = flow().blocks.find((b) => b.kind === 'text' && placed.has(b.id) && (b.paragraphs || []).length);
  panel.select(tb.id); await wait(50);
  const rich = field('.fp-rich.rich-text');
  const firstSpan = rich.querySelector('p.para span.run');
  const oldText = firstSpan.textContent;
  rich.focus();
  const rg = document.createRange(); rg.selectNodeContents(firstSpan);
  window.getSelection().removeAllRanges(); window.getSelection().addRange(rg);
  document.execCommand('insertText', false, 'Rich edit test');
  document.execCommand('selectAll');   // keep the caret inside, then leave the editor
  rich.dispatchEvent(new FocusEvent('blur'));   // an offscreen test window gets no real focus events
  await settled();
  const tbNow = flow().blocks.find((b) => b.id === tb.id);
  ok('a text block edited in place is saved and re-laid', tbNow.paragraphs.some((p) => paraText(p).includes('Rich edit test')) && allText().includes('Rich edit test'), { got: oldText });
  // Ctrl+Z while typing in a field undoes the typing, not the last change
  panel.select(target.id); await wait(50);
  const lbl = field('input[data-field="heading.label"]');
  lbl.focus();
  const undoDepth = editor.undo.length;
  document.execCommand('insertText', false, 'XYZ');
  await editor.command('undo');
  ok('Ctrl+Z in a panel field undoes the typing only', editor.undo.length === undoDepth && !lbl.value.includes('XYZ'), { got: lbl.value });
  lbl.blur();

  // ================= add / move / duplicate / delete / undo =================
  const nBefore = flow().blocks.length;
  const idxT = flow().blocks.findIndex((b) => b.id === target.id);
  const added = await panel.add('dialog');
  await settled();
  ok('Add puts a new block right after the selected one', flow().blocks.length === nBefore + 1 && flow().blocks[idxT + 1].id === added.id && allText().includes('People line'));
  await panel.move(-1); await settled();
  ok('Move up swaps it with the block above', flow().blocks[idxT].id === added.id);
  const dup = await panel.duplicate(); await settled();
  ok('Duplicate copies it with a new id', flow().blocks.length === nBefore + 2 && dup.id !== added.id);
  panel.select(dup.id); await panel.remove(); await settled();
  panel.select(added.id); await panel.remove(); await settled();
  ok('Delete removes blocks', flow().blocks.length === nBefore && !flow().blocks.some((b) => b.id === added.id));
  await editor.command('undo');
  ok('Undo brings the deleted block back (pages re-laid too)', flow().blocks.some((b) => b.id === added.id) && allText().includes('People line'));
  await editor.command('redo');
  ok('Redo deletes it again', !flow().blocks.some((b) => b.id === added.id) && !allText().includes('People line'));

  // ================= page break, keep together =================
  const later = flow().blocks.filter((b) => placed.has(b.id) && b.kind === 'item')[3];
  panel.select(later.id); await wait(50);
  await change(field('input[data-field="pageBreakBefore"]'), true);
  const pgL = bp()[later.id];
  const firstOnPage = gen(pgL).filter((f) => !f.note && f.kind !== 'shape').sort((a, b) => a.y - b.y)[0];
  ok('"Start on a new page" puts the block at the top of a page', firstOnPage && firstOnPage.y <= g.top + 0.5 &&
    (firstOnPage.kind === 'text' ? firstOnPage.text.paragraphs[0].block === later.id : firstOnPage.block === later.id), { got: pgL });

  // ================= global style =================
  const scr = flow().blocks.find((b) => b.kind === 'scripture' && placed.has(b.id));
  panel.tab = 'styles'; panel.refresh();
  await change(field('input[data-style="scripture"][data-k="size"]'), 13);
  const sp = bodyPages().flatMap((n) => gen(n).filter((f) => f.kind === 'text').flatMap((f) => f.text.paragraphs)).filter((p) => p.block === scr.id && p.style === 'scripture');
  ok('one style change restyles every scripture paragraph', sp.length > 0 && sp.every((p) => p.runs.every((r) => r.size === 13)), { got: sp.map((p) => p.runs[0] && p.runs[0].size) });
  await change(field('input[data-style="people"][data-k="bold"]'), false);
  const anyPeople = bodyPages().flatMap((n) => gen(n).filter((f) => f.kind === 'text').flatMap((f) => f.text.paragraphs)).filter((p) => p.style === 'people');
  ok('turning off bold on the People style updates every people line', anyPeople.length > 0 && anyPeople.every((p) => p.runs.every((r) => !r.bold)));
  await editor.command('undo');

  // ================= cover =================
  panel.tab = 'cover'; panel.refresh();
  await change(field('input[data-field="cover.date"]'), 'October 25, 2026');
  const mast = gen(pages()[0]).find((f) => f.id === 'gc-masthead');
  ok('cover date field updates the masthead', mast.text.paragraphs.some((p) => paraText(p) === 'October 25, 2026'));
  await change(field('input[data-field="cover.art.title"]'), 'Test Title');
  ok('cover art title updates the caption', gen(pages()[0]).find((f) => f.id === 'gc-caption').text.paragraphs.some((p) => paraText(p) === 'Test Title'));

  // ================= pictures in a block =================
  panel.tab = 'order'; panel.refresh();
  panel.select(target.id);
  const pic = await panel.add('image'); await settled();
  const asset = flow().blocks.find((b) => b.images && b.images.length).images[0];   // a sheet-music picture (wide)
  await panel.addImage(pic.id, asset); await settled();
  const picFrame = bodyPages().flatMap((n) => gen(n)).find((f) => f.kind === 'image' && f.block === pic.id);
  ok('a picture added to a block is laid out full measure (6")', picFrame && Math.abs(picFrame.w - 432) < 0.6 && picFrame.x === 36, { got: picFrame && [picFrame.x, picFrame.w] });

  // ================= overflow is reported, never silent =================
  const nOver0 = (half().layout.overflowBlocks || []).length;
  panel.select(flow().blocks[flow().blocks.length - 1].id);
  const big = await panel.add('space'); await settled();
  await change(field('input[data-field="height"]'), 2000);
  ok('a flow too long for the worship pages lists the blocks that do not fit', (half().layout.overflowBlocks || []).length > nOver0 && !!document.querySelector('#flowpanel .fp-warn'));
  panel.select(big.id); await panel.remove(); await settled();

  // ================= hand-placed frames survive a re-layout =================
  editor.lastPage = bodyPages()[1];
  const hand = await editor.insert('rect');
  await panel.add('rubric'); await settled();
  ok('a frame placed by hand on a flow page survives re-layout', !!editor.topFrame(bodyPages()[1], hand.id));

  // ================= reopen: saved layout is used as-is =================
  const before = JSON.stringify(half().pages);
  const h1 = half().layout.flowHash;
  await layoutFlow(W(), half());
  ok('laying out the same flow again is deterministic', JSON.stringify(half().pages) === before && half().layout.flowHash === h1);

  // ================= save =================
  ok('save succeeds', await editor.save());
  ok('clean after save', editor.dirty === false);
  return {
    checks,
    flowDisk: { label: 'CALL TO WORSHIP (TEST)', target: target.id, date: 'October 25, 2026', hand: hand.id, handPage: bodyPages()[1], blocks: flow().blocks.length, hash: half().layout.flowHash },
  };
}
