// GUI suite: Insert ▸ Bookmark — a named place in the text; a hyperlink to it (Insert ▸ Link ▸ a place
// in this document); Ctrl+click follows it; the Bookmark dialog lists, goes to and deletes; saved in
// the half file; the PDF/website get a real <a href="#bm-…"> and an id to land on.
const fs = require('fs');
const path = require('path');
const P = 12;
const BOX = `.page-shell[data-page="${P}"] .frame-text[data-id="f459"]`;

exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  const word = (w) => h.js(`(() => { const box = document.querySelector('${BOX}'); const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let t; (t = tw.nextNode());) { const i = t.data.indexOf(${JSON.stringify(w)}); if (i >= 0) { const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + ${w.length});
      const b = r.getBoundingClientRect(); return { x0: b.left + 0.5, x1: b.right - 0.5, y: b.top + b.height / 2 }; } } return null; })()`);
  const bmRuns = () => h.js(`(() => { const pg = window.__bbWeek().halves.announcements.pages['${P}']; const f = pg.frames.find((x) => x.id === 'f459');
    return f.text.paragraphs.flatMap((p) => p.runs.filter((r) => r.bookmark).map((r) => r.bookmark)); })()`);

  await h.clickSel('.rb-tab[data-tab="insert"]');
  h.ok('view only: Insert ▸ Bookmark is enabled (it lists bookmarks) but adding needs typing', !(await h.disabled('#ins-bookmark')));
  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "announcements"');
  await h.clickSel(`#nav-pages .nav-page[data-page="${P}"]`);
  await h.wait(600);

  await h.js(`document.querySelector('.page-shell[data-page="${P}"]').scrollIntoView({ block: 'center' })`);
  await h.wait(600);
  // a bookmark before "Fund" (the caret put at the start of the word)
  let w = await word('Fund');
  await h.click(w.x0 + 1, w.y);
  h.ok('typing in the box', await ed('!!ed.textEdit && ed.textEdit.id === "f459"'));
  await h.clickSel('.rb-tab[data-tab="insert"]');
  await h.clickSel('#ins-bookmark');
  h.ok('Bookmark opens its dialog, ready to add', await h.until(`!!document.querySelector('dialog.pub-dialog[open] #bm-name:not([disabled])')`, 2000));
  h.ok('…no bookmarks listed yet', (await h.js(`document.querySelectorAll('dialog .bm-row').length`)) === 0);
  await h.type('Prayer list');
  await h.clickSel('dialog .pd-ok');
  await h.wait(400);
  h.ok('a bookmark marker is in the text', (await h.js(`!!document.querySelector('${BOX} .run.bookmark[data-bookmark="Prayer list"]#bm-prayer-list')`)));
  h.ok('…zero width: the text did not move', !!(await word('Fund')) && Math.abs((await word('Fund')).x0 - w.x0) < 1.5, { before: w.x0, after: (await word('Fund')).x0 });
  await h.key('Escape', [], 500);
  h.ok('…saved into the paragraph as an empty run with bookmark', (await bmRuns()).join() === 'Prayer list');
  h.ok('…still drawn after the save (with an id a link can land on)', !!(await h.js(`document.querySelector('${BOX} #bm-prayer-list')`)));
  await h.shot('bookmark');

  // a link to it on the word "budget" (Insert ▸ Link ▸ a place in this document)
  w = await word('budget');
  await h.click(w.x0 + 2, w.y);
  await h.drag(w.x0, w.y, w.x1, w.y, { steps: 5 });
  h.ok('"budget" selected', (await h.js('getSelection().toString()')) === 'budget');
  await h.clickSel('.rb-tab[data-tab="insert"]');
  await h.clickSel('#ins-link');
  h.ok('the link dialog lists the bookmark', await h.until(`!!document.querySelector('dialog.pub-dialog[open] #lk-bookmark option[value="prayer-list"]')`, 2000));
  await h.js(`(() => { const s = document.querySelector('dialog #lk-bookmark'); s.value = 'prayer-list'; s.dispatchEvent(new Event('change')); })()`);
  await h.clickSel('dialog .pd-ok');
  await h.wait(400);
  const a = await h.js(`(() => { const a = document.querySelector('${BOX} a[href]'); return a ? { href: a.getAttribute('href'), text: a.textContent } : null; })()`);
  h.ok('the word is a link to #bm-prayer-list', a && a.href === '#bm-prayer-list' && a.text === 'budget', { a });
  await h.key('Escape', [], 500);
  h.ok('…kept in the model as run.link', (await h.js(`(() => { const f = window.__bbWeek().halves.announcements.pages['${P}'].frames.find((x) => x.id === 'f459'); return f.text.paragraphs.some((p) => p.runs.some((r) => r.link === '#bm-prayer-list' && r.text === 'budget')); })()`)));
  // Ctrl+click follows it
  w = await word('budget');
  await h.click((w.x0 + w.x1) / 2, w.y, { mods: ['control'] });
  await h.wait(500);
  h.ok('Ctrl+click on the link goes to the bookmark (status says the page)', /Bookmark on page 12/.test(await h.js(`document.getElementById('status').textContent`)));
  await h.key('Escape', [], 300);

  // the dialog lists it; Go To; Delete; Undo
  await h.clickSel('.rb-tab[data-tab="insert"]');
  await h.clickSel('#ins-bookmark');
  await h.until(`!!document.querySelector('dialog.pub-dialog[open]')`, 2000);
  h.ok('the Bookmark dialog lists "Prayer list" on page 12', (await h.js(`[...document.querySelectorAll('dialog .bm-row > span:first-child')].map((e) => e.textContent)`)).join() .startsWith('Prayer list (page 12'));
  h.ok('…adding is off without a caret (view-only use of the dialog)', await h.js(`document.querySelector('dialog #bm-name').disabled`));
  await h.clickSel('dialog .bm-del');
  await h.wait(600);
  h.ok('Delete removes the bookmark from the text', (await bmRuns()).length === 0 && !(await h.js(`document.querySelector('${BOX} #bm-prayer-list')`)));
  await h.clickSel('#undo');
  await h.wait(500);
  h.ok('Undo brings it back', (await bmRuns()).join() === 'Prayer list' && !!(await h.js(`document.querySelector('${BOX} #bm-prayer-list')`)));
  await h.clickSel('.rb-tab[data-tab="insert"]');
  await h.clickSel('#ins-bookmark');
  await h.until(`!!document.querySelector('dialog.pub-dialog[open]')`, 2000);
  await h.clickSel('dialog .bm-goto');
  await h.wait(500);
  h.ok('Go To selects the box the bookmark is in', (await ed('ed.sel && ed.sel.id')) === 'f459');

  // saved with the half
  await h.clickSel('#save');
  await h.until('window.__bbEditor.dirty === false', 4000);
  const saved = JSON.parse(fs.readFileSync(path.join(path.dirname(h.weekCopy), 'announcements.json'), 'utf8'));
  const f = saved.pages[String(P)].frames.find((x) => x.id === 'f459');
  h.ok('announcements.json carries the bookmark run and the link run', f.text.paragraphs.some((p) => p.runs.some((r) => r.bookmark === 'Prayer list' && r.text === '')) && f.text.paragraphs.some((p) => p.runs.some((r) => r.link === '#bm-prayer-list')));
};
