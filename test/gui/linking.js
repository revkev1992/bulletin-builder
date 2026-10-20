// GUI suite: Text Box Format ▸ Linking. Story-2 runs page 10 (f502) → page 11 (f503) and overflows.
// Make an empty text box on page 16, link the overflow into it with the overflow tag, step
// Previous/Next, Break, Undo, and check a non-empty box is refused.
exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  const text = (n, id) => h.js(`window.__bbEditor.anyFrame(${n}, '${id}').text.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('|')`);
  const chain = (n, id) => h.js(`JSON.stringify(window.__bbEditor.anyFrame(${n}, '${id}').text.chain || null)`);

  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "announcements"');

  // an empty text box on page 16
  await h.clickSel('#nav-pages .nav-page[data-page="16"]');
  await h.wait(700);
  await h.clickSel('.rb-tab[data-tab="insert"]');
  await h.clickSel('#ins-text');
  await h.wait(300);
  const nb = await ed('ed.textEdit && ed.textEdit.id');
  h.ok('Insert ▸ Draw Text Box: a new box, typing, "Type here" selected', !!nb && (await h.js('getSelection().toString()')) === 'Type here');
  await h.key('Delete');
  await h.key('Escape', [], 500);
  h.ok('…emptied', (await text(16, nb)).trim() === '');

  // the overflowing end of story-2 on page 11
  await h.js(`document.querySelector('.page-shell[data-page="11"]').scrollIntoView({ block: 'start' })`);
  await h.wait(400);
  // add lines to page 11 until its text doesn't fit
  const r0 = await h.rect('.page-shell[data-page="11"] .frame[data-id="f503"]');
  await h.click(r0.cx, r0.y + 30);
  await h.key('End', ['control']);
  for (let k = 1; k <= 14; k++) await h.type('\nExtra announcement line ' + k);
  await h.key('Escape', [], 900);
  h.ok('page-11 box (end of story-2) overflows', await h.js(`document.querySelector('.page-shell[data-page="11"] .frame[data-id="f503"]').classList.contains('overflow')`));
  const r = await h.rect('.page-shell[data-page="11"] .frame[data-id="f503"]');
  await h.click(r.cx, r.y + 30);
  await h.key('Escape', [], 300);       // stop typing; the box stays selected
  await h.clickSel('.rb-tab[data-tab="format"]');
  h.ok('Text Box Format shows the Linking group', !(await h.js(`document.getElementById('rb-linking-group').hidden`)));
  h.ok('Create Link enabled, Break disabled (last box), Previous enabled', !(await h.disabled('#lk-create')) && (await h.disabled('#lk-break')) && !(await h.disabled('#lk-prev')));
  h.ok('the overflow tag (A…) shows on the selected box', !!(await h.rect('.page-shell[data-page="11"] .overflow-btn')));
  await h.shot('overflow-tag');
  const before11 = await text(11, 'f503');

  // click the overflow tag, then the empty box on page 16
  await h.clickSel('.page-shell[data-page="11"] .overflow-btn');
  h.ok('overflow tag starts Create Link', await h.js(`document.body.classList.contains('linking')`));
  await h.js(`document.querySelector('.page-shell[data-page="16"]').scrollIntoView({ block: 'center' })`);
  await h.wait(400);
  await h.clickSel(`.page-shell[data-page="16"] .frame[data-id="${nb}"]`);
  await h.wait(800);
  h.ok('click the empty box: it joins story-2 as box 3', JSON.parse(await chain(16, nb)).index === 2 && JSON.parse(await chain(16, nb)).story === 'story-2');
  h.ok('…the overflowing text now flows into it', (await text(16, nb)).trim().length > 10);
  h.ok('…page 11 no longer overflows', !(await h.js(`document.querySelector('.page-shell[data-page="11"] .frame[data-id="f503"]').classList.contains('overflow')`)));
  await h.shot('linked-to-16');

  // Previous / Next
  await h.clickSel('#lk-prev');
  h.ok('Previous selects the page-11 box', await ed(`ed.sel && ed.sel.id === 'f503'`));
  await h.clickSel('#lk-next');
  h.ok('Next selects the page-16 box', await ed(`ed.sel && ed.sel.id === '${nb}'`));
  await h.clickSel('#lk-prev');

  // Break on page 11: page 16 leaves the story, text returns
  await h.clickSel('#lk-break');
  await h.wait(600);
  h.ok('Break: page-16 box leaves the story and is empty', (await chain(16, nb)) === 'null' && (await text(16, nb)).trim() === '');
  h.ok('…its text is back in page 11 (overflowing again)', (await text(11, 'f503')) === before11 && await h.js(`document.querySelector('.page-shell[data-page="11"] .frame[data-id="f503"]').classList.contains('overflow')`));
  await h.clickSel('#undo'); await h.wait(700);
  h.ok('Undo links them again', JSON.parse(await chain(16, nb) || 'null') && (await text(16, nb)).trim().length > 10);

  // a box with text can't be linked into
  await h.clickSel('#redo'); await h.wait(700);
  await h.js(`document.querySelector('.page-shell[data-page="16"]').scrollIntoView({ block: 'center' })`);
  await h.wait(300);
  const r2 = await h.rect(`.page-shell[data-page="16"] .frame[data-id="${nb}"]`);
  await h.click(r2.cx, r2.cy);
  await h.type('not empty');
  await h.key('Escape', [], 400);
  await h.js(`document.querySelector('.page-shell[data-page="11"]').scrollIntoView({ block: 'start' })`);
  await h.wait(300);
  await h.click(r.cx, r.y + 30); await h.key('Escape', [], 300);
  await h.clickSel('.rb-tab[data-tab="format"]');
  await h.clickSel('#lk-create');
  await h.js(`document.querySelector('.page-shell[data-page="16"]').scrollIntoView({ block: 'center' })`);
  await h.wait(300);
  await h.clickSel(`.page-shell[data-page="16"] .frame[data-id="${nb}"]`);
  h.ok('Create Link into a box that has text is refused, with the reason', (await h.js(`document.getElementById('status').textContent`)).includes('not empty') && (await chain(16, nb)) === 'null');
};
