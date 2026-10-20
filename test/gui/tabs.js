// GUI suite: View ▸ Rulers + tab stops (batch-1 item 7). Real clicks/drags on the ruler, the
// corner tab-kind button, the Tabs dialog, and the indent markers.
const P = 12;
const BOX = `.page-shell[data-page="${P}"] .frame-text[data-id="f459"]`;

exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  // settings of the paragraph the caret is in (what the ruler shows)
  const para = () => h.js(`(() => { const s = getSelection(); const p = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement).closest('p');
    return p ? JSON.parse(p.dataset.para || '{}') : null; })()`);
  const area = () => h.js(`(() => { const a = document.querySelector('${BOX} .text-area'); const r = a.getBoundingClientRect(); return { left: r.left, ppt: r.width / Number(a.dataset.wpt) }; })()`);
  const rulerY = async () => { const r = await h.rect('#ruler-h'); return r.y + r.h / 2; };

  h.ok('rulers shown (View ▸ Rulers checked)', (await h.js(`document.getElementById('show-rulers').checked`)) && !!(await h.rect('#ruler-h canvas')));
  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "announcements"');
  await h.js(`document.querySelector('.page-shell[data-page="${P}"]').scrollIntoView({ block: 'center' })`);
  await h.wait(400);

  // click into the body paragraph ("…depleted…")
  const w = await h.js(`(() => { const box = document.querySelector('${BOX}'); const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let t; (t = tw.nextNode());) { const i = t.data.indexOf('depleted'); if (i >= 0) { const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 8);
      const b = r.getBoundingClientRect(); return { x: b.right, y: b.top + b.height / 2 }; } } })()`);
  await h.click(w.x, w.y);
  h.ok('typing in the box', await ed('!!ed.textEdit'));
  await h.wait(300);
  h.ok('ruler shows the indent markers while typing', (await h.js(`document.querySelectorAll('#ruler-h .rmark.ind-first, #ruler-h .rmark.ind-left, #ruler-h .rmark.ind-right').length`)) === 3);
  await h.shot('ruler-typing');
  const t0 = ((await para()).tabs || []).length;

  // corner button: Left → Center
  await h.clickSel('#ruler-kind');
  h.ok('corner button cycles the tab kind to Center', await h.js(`document.getElementById('ruler-kind').className === 'tabkind-center'`));
  // click the ruler 2" into the text area → a center tab at 144 pt
  let a = await area();
  const y = await rulerY();
  await h.click(a.left + 144 * a.ppt, y);
  let p = await para();
  h.ok('click on the ruler adds a Center tab at 2"', (p.tabs || []).some((s) => Math.abs(s.pos - 144) < 2.5 && s.align === 'center'), { tabs: p.tabs });
  h.ok('…still typing, caret kept', (await ed('!!ed.textEdit')) && (await h.js(`document.activeElement.classList.contains('flow')`)));
  await h.shot('tab-added');

  // drag it to 3"
  let m = await h.rect('#ruler-h .tabmark.tab-center');
  await h.drag(m.cx, m.cy, a.left + 216 * a.ppt, m.cy);
  p = await para();
  h.ok('drag the tab marker moves it to 3"', (p.tabs || []).some((s) => Math.abs(s.pos - 216) < 2.5 && s.align === 'center') && !(p.tabs || []).some((s) => Math.abs(s.pos - 144) < 2.5), { tabs: p.tabs });

  // drag it down off the ruler → removed
  m = await h.rect('#ruler-h .tabmark.tab-center');
  await h.drag(m.cx, m.cy, m.cx, m.cy + 60);
  p = await para();
  h.ok('drag a tab off the ruler removes it', (p.tabs || []).length === t0, { tabs: p.tabs });

  // Tabs dialog via double-click on the ruler: Right tab at 1.5" with dot leader
  a = await area();
  await h.dblclick(a.left + 300 * a.ppt, y);
  const dlg = await h.until(`!!document.querySelector('dialog.tabs-dialog[open]')`, 2000);
  h.ok('double-click the ruler opens the Tabs dialog', dlg);
  if (dlg) {
    // the double-click's first click also added a tab at ~300pt (Publisher does the same); clear all first
    await h.clickSel('dialog.tabs-dialog [data-act="all"]');
    const pos = await h.rect('dialog.tabs-dialog input[name="pos"]');
    await h.click(pos.cx, pos.cy);
    await h.key('A', ['control']);
    await h.type('1.5');
    await h.clickSel('dialog.tabs-dialog input[name="align"][value="right"]');
    await h.clickSel('dialog.tabs-dialog input[name="leader"][value="dot"]');
    await h.clickSel('dialog.tabs-dialog [data-act="set"]');
    await h.shot('tabs-dialog');
    await h.clickSel('dialog.tabs-dialog .pd-ok');
    p = await para();
    h.ok('Tabs dialog: Set a Right tab at 1.5" with dot leader', (p.tabs || []).length === 1 && Math.abs(p.tabs[0].pos - 108) < 0.5 && p.tabs[0].align === 'right' && p.tabs[0].leader === 'dot', { tabs: p.tabs });
  }

  // the tab works in text: Home, Tab, type "99"
  const endOf = await h.js(`(() => { const box = document.querySelector('${BOX}'); const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let t; (t = tw.nextNode());) { const i = t.data.indexOf('donate).'); if (i >= 0) { const r = document.createRange(); r.setStart(t, i + 7); r.setEnd(t, i + 8);
      const b = r.getBoundingClientRect(); return { x: b.right + 1, y: b.top + b.height / 2 }; } } })()`);
  await h.click(endOf.x, endOf.y);
  await h.key('End');
  await h.key('Enter');
  await h.type('Item');
  await h.key('Tab');
  await h.type('99');
  await h.wait(500);
  const tabInfo = await h.js(`(() => { const s = getSelection(); const p = (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement).closest('p');
    const t = p.querySelector('.tab'); const a = p.closest('.text-area'); const ar = a.getBoundingClientRect(); const ppt = ar.width / Number(a.dataset.wpt);
    const seg = t && t.nextElementSibling; const sr = seg && seg.getClientRects()[0];
    return { leader: t && t.className, segRight: sr ? (sr.left - ar.left) / ppt + (sr.width / ppt) : null, segText: seg && seg.textContent.replace(/[\u200b]/g, '').slice(0, 2) }; })()`);
  h.ok('a Tab in the text lines up on the right tab (text ends at 1.5")', tabInfo.segText === '99' && Math.abs(tabInfo.segRight - 108) < 3 && /leader-dot/.test(tabInfo.leader), tabInfo);
  await h.shot('tab-in-text');

  // drag the first-line indent marker 0.5" right
  a = await area();
  const before = await para();
  m = await h.rect('#ruler-h .rmark.ind-first');
  await h.drag(m.cx, m.cy, m.cx + 36 * a.ppt, m.cy);
  p = await para();
  h.ok('drag the first-line indent marker sets a 0.5" first-line indent', Math.abs((p.indentFirst || 0) - ((before.indentFirst || 0) + 36)) < 5, { before: before.indentFirst, after: p.indentFirst });

  // Esc → saved in the model
  await h.key('Escape');
  const saved = await ed(`(() => { const f = ed.anyFrame(${P}, 'f459'); return f.text.paragraphs.find((q) => q.runs.map((r) => r.text).join('').includes('99')); })()`);
  h.ok('after Esc the tab stop and indent are saved', saved && saved.tabs && saved.tabs[0].align === 'right' && saved.tabs[0].leader === 'dot' && saved.indentFirst > 0, { saved: saved && { tabs: saved.tabs, indentFirst: saved.indentFirst } });

  // View ▸ Rulers off
  await h.clickSel('.rb-tab[data-tab="view"]');
  await h.clickSel('#show-rulers');
  h.ok('View ▸ Rulers unchecked hides the rulers', await h.js(`document.body.classList.contains('no-rulers')`));
  await h.shot('rulers-off');
  await h.clickSel('#show-rulers');
};
