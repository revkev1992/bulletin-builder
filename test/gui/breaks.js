// GUI suite: manual breaks (batch-1 item 8). Ctrl+Enter = text box break in a linked story
// (announcements story-2: page 10 f502 → page 11 f503), Ctrl+Shift+Enter = column break,
// Insert ▸ Break menu, the ¶ marker, and removing a break with Delete.
const A = 'f502', B = 'f503';

exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  const paras = (n, id) => h.js(`window.__bbEditor.anyFrame(${n}, '${id}').text.paragraphs.map((p) => p.runs.map((r) => r.text).join(''))`);
  const hasFF = async (n, id) => (await paras(n, id)).some((t) => t.includes('\u000c'));
  const wordAt = (n, id, word, side = 'left') => h.js(`(() => { const box = document.querySelector('.page-shell[data-page="${n}"] .frame[data-id="${id}"]');
    const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let t; (t = tw.nextNode());) { const i = t.data.indexOf(${JSON.stringify(word)}); if (i >= 0) { const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + ${word.length});
      const b = r.getBoundingClientRect(); return { x: ${side === 'left' ? 'b.left + 0.5' : 'b.right + 0.5'}, y: b.top + b.height / 2 }; } } return null; })()`);

  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "announcements"');
  await h.js(`document.querySelector('.page-shell[data-page="10"]').scrollIntoView({ block: 'start' })`);
  await h.wait(500);

  // pick the 3rd paragraph's first word in f502 and put the caret before it
  const pA = await paras(10, A);
  const idx = pA.findIndex((t, i) => i >= 2 && t.trim().split(/\s+/)[0].length > 3);
  const first = pA[idx].trim().split(/\s+/)[0];
  const w = await wordAt(10, A, first);
  h.ok('found a paragraph to break before ("' + first + '")', !!w);
  await h.click(w.x, w.y);
  await h.key('Home');
  h.ok('typing in the page-10 box', await ed(`ed.textEdit && ed.textEdit.id === '${A}'`));
  await h.shot('before-break');
  await h.key('Enter', ['control'], 900);
  h.ok('Ctrl+Enter: the page-10 box now ends with a text box break', await hasFF(10, A), { last: (await paras(10, A)).slice(-1) });
  const pB = await paras(11, B);
  h.ok('…the text after the caret starts the page-11 box', pB[0].trim().startsWith(first), { b0: pB[0].slice(0, 40) });
  const lastOfA = (await paras(10, A)).slice(-1)[0];
  h.ok('…no empty line is left behind on page 10', lastOfA.replace('', '').trim().length > 0, { lastOfA });
  h.ok('…and you keep typing there (caret moved to page 11)', await ed(`ed.textEdit && ed.textEdit.id === '${B}'`));
  await h.shot('after-ctrl-enter');

  // ¶ shows the break marker
  await h.key('Escape');
  await h.clickSel('.rb-tab[data-tab="home"]');
  await h.clickSel('#rb-marks');
  h.ok('¶ shows the "Text Box Break" marker on page 10', await h.js(`(() => { const m = document.querySelector('.page-shell[data-page="10"] .brk-frame'); return !!m && m.getBoundingClientRect().height > 0; })()`));
  await h.js(`document.querySelector('.page-shell[data-page="10"]').scrollIntoView({ block: 'start' })`);
  await h.wait(300);
  await h.shot('marks-on');

  // Ctrl+Z undoes the break
  // (Ctrl+Z / Ctrl+Y come through the window menu's accelerators, which an offscreen test window
  // does not get — the quick-access Undo/Redo buttons run the same command)
  await h.clickSel('#undo'); await h.wait(600);
  h.ok('Undo takes the break out again', !(await hasFF(10, A)));
  await h.clickSel('#redo'); await h.wait(600);
  h.ok('Redo puts it back', await hasFF(10, A));

  // Delete just before the marker removes the break (as Publisher with ¶ on)
  const mk = await h.rect('.page-shell[data-page="10"] .frame[data-id="f502"] .brk-frame');
  h.ok('the break marker is on screen (¶ on)', !!mk);
  await h.click(mk.x - 2, mk.cy);
  await h.key('End');
  await h.key('Backspace', [], 300);
  await h.key('Escape', [], 900);
  h.ok('Backspace after the marker removes the break; text flows back', !(await hasFF(10, A)) && (await paras(10, A)).some((t) => t.trim().startsWith(first)));

  // Delete at the end of the line (End, then Delete) removes it too (batch-3 run 2026-10-27: it did nothing)
  await h.clickSel('#undo'); await h.wait(700);
  const mk2 = await h.rect('.page-shell[data-page="10"] .frame[data-id="f502"] .brk-frame');
  await h.click(mk2.x - 2, mk2.cy);
  await h.key('End');
  await h.key('Delete', [], 1000);
  h.ok('End, Delete removes the break; text flows back', !(await hasFF(10, A)) && (await paras(10, A)).some((t) => t.trim().startsWith(first)));
  h.ok('…and you are still typing in the page-10 box', await ed(`ed.textEdit && ed.textEdit.id === '${A}'`));
  await h.key('Escape', [], 600);

  // put it back, then remove it from the other side: Backspace at the very start of the page-11 box
  await h.clickSel('#undo'); await h.wait(700);
  h.ok('(break back via Undo)', await hasFF(10, A));
  await h.js(`document.querySelector('.page-shell[data-page="11"]').scrollIntoView({ block: 'start' })`);
  await h.wait(400);
  const s11 = await wordAt(11, B, first);
  await h.click(s11.x, s11.y);
  await h.key('Home');
  await h.key('Backspace', [], 1000);
  h.ok('Backspace at the start of the next box removes the break before it', !(await hasFF(10, A)));
  h.ok('…typing continues on page 10 where the break was', await ed(`ed.textEdit && ed.textEdit.id === '${A}'`));
  await h.key('Escape', [], 600);
  await h.js(`document.querySelector('.page-shell[data-page="10"]').scrollIntoView({ block: 'start' })`);
  await h.wait(300);

  // Insert ▸ Break ▸ Text Box Break (menu)
  const w2 = await wordAt(10, A, first);
  await h.click(w2.x, w2.y);
  await h.key('Home');
  await h.clickSel('.rb-tab[data-tab="insert"]');
  h.ok('Insert ▸ Break is enabled while typing', !(await h.disabled('#ins-break')));
  await h.clickSel('#ins-break');
  await h.clickSel('#brk-frame');
  await h.wait(900);
  h.ok('Insert ▸ Break ▸ Text Box Break does the same', await hasFF(10, A));
  await h.key('Escape');

  // column break: 2-column box on page 12
  await h.js(`document.querySelector('.page-shell[data-page="12"]').scrollIntoView({ block: 'center' })`);
  await h.wait(400);
  const c = await wordAt(12, 'f459', 'Looking');
  await h.click(c.x, c.y);
  await h.clickSel('.rb-tab[data-tab="format"]');
  await h.clickSel('.rb-panel[data-tab="format"] [data-mirror="rb-columns"]');
  await h.clickSel('#col-2');
  await h.wait(500);
  const c2 = await wordAt(12, 'f459', 'Looking');
  await h.click(c2.x, c2.y);
  await h.key('Home');
  await h.key('Enter', ['control', 'shift'], 600);
  await h.key('Escape', [], 800);
  const colInfo = await h.js(`(() => { const ed = window.__bbEditor; const f = ed.anyFrame(12, 'f459');
    const brk = f.text.paragraphs.findIndex((p) => p.columnBreak);
    const box = document.querySelector('.page-shell[data-page="12"] .frame[data-id="f459"] .text-area').getBoundingClientRect();
    const w = [...document.querySelectorAll('.page-shell[data-page="12"] .frame[data-id="f459"] p.para')].find((p) => p.textContent.startsWith('Looking'));
    return { brk, nextIsLooking: brk >= 0 && f.text.paragraphs[brk + 1].runs.map((r) => r.text).join('').startsWith('Looking'),
      inRightColumn: w && w.getBoundingClientRect().left > box.left + box.width / 2 - 5 }; })()`);
  h.ok('Ctrl+Shift+Enter in a 2-column box: column break saved', colInfo.brk >= 0 && colInfo.nextIsLooking, colInfo);
  h.ok('…the next paragraph starts the second column', colInfo.inRightColumn, colInfo);
  await h.shot('column-break');
};
