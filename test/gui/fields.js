// GUI suite: Insert ▸ Header & Footer — page-number fields (at the caret; top / bottom of every page),
// Header / Footer on every page with # and ## fields, Remove; fields follow page changes.
const P = 12;
const BOX = `.page-shell[data-page="${P}"] .frame-text[data-id="f459"]`;

exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  const word = (w) => h.js(`(() => { const box = document.querySelector('${BOX}'); const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let t; (t = tw.nextNode());) { const i = t.data.indexOf(${JSON.stringify(w)}); if (i >= 0) { const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + ${w.length});
      const b = r.getBoundingClientRect(); return { x0: b.left + 0.5, x1: b.right - 0.5, y: b.top + b.height / 2 }; } } return null; })()`);
  // the text drawn in the role boxes of every announcements page: { page: text }
  const boxes = (role) => h.js(`(() => { const w = window.__bbWeek(); const out = {};
    for (const p of w.manifest.pages.filter((p) => p.half === 'announcements')) { const pg = w.halves.announcements.pages[String(p.number)];
      const f = (pg.frames || []).find((x) => x.role === '${role}'); if (!f) continue;
      const el = document.querySelector('.page-shell[data-page="' + p.number + '"] .frame[data-id="' + f.id + '"]'); out[p.number] = { text: el ? el.textContent.trim() : null, y: f.y, h: f.h }; }
    return out; })()`);
  const annPages = await h.js(`window.__bbWeek().manifest.pages.filter((p) => p.half === 'announcements').map((p) => p.number)`);
  const total = await h.js('window.__bbWeek().manifest.pages.length');

  await h.clickSel('.rb-tab[data-tab="insert"]');
  for (const id of ['#ins-header', '#ins-footer', '#ins-pagenum']) h.ok('view only: ' + id.slice(1) + ' greyed', await h.disabled(id));
  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "announcements"');
  await h.clickSel('.rb-tab[data-tab="insert"]');

  // page numbers at the bottom of every page
  await h.clickSel('#ins-pagenum');
  await h.clickSel('#pn-bottom');
  await h.wait(900);
  let b = await boxes('pagenum');
  h.ok('Page Number ▸ Bottom of Every Page: a number on every announcements page, each its own', Object.keys(b).length === annPages.length && annPages.every((n) => b[n] && b[n].text === String(n)), { b });
  const pageH = await ed('ed.pageSize().height');
  h.ok('…in the bottom margin', annPages.every((n) => b[n].y > pageH - 36 && b[n].y + b[n].h <= pageH), { b: b[annPages[0]] });
  h.ok('…never on the worship pages', !(await h.js(`Object.values(window.__bbWeek().halves.worship.pages).some((pg) => (pg.frames || []).some((f) => f.role === 'pagenum'))`)));
  await h.clickSel(`#nav-pages .nav-page[data-page="${annPages[annPages.length - 1]}"]`);
  await h.wait(500);
  await h.shot('page-numbers');

  // a header with # and ##
  await h.clickSel('.rb-tab[data-tab="insert"]');
  await h.clickSel('#ins-header');
  await h.clickSel('#hf-header');
  h.ok('Header on Every Page… asks for the text', await h.until(`!!document.querySelector('dialog.pub-dialog[open] input[name="text"]')`, 2000));
  await h.key('A', ['control']);
  await h.type('Highland UMC - page # of ##');
  await h.clickSel('dialog .pd-ok');
  await h.wait(900);
  b = await boxes('header');
  h.ok('a header on every announcements page with the page number and the page count filled in', annPages.every((n) => b[n] && b[n].text === 'Highland UMC - page ' + n + ' of ' + total), { b });
  h.ok('…in the top margin', annPages.every((n) => b[n].y >= 0 && b[n].y + b[n].h <= 36));
  await h.shot('header');

  // the fields follow page changes: delete page 13 → the old page 14 is now 13 and says so
  await h.clickSel(`#nav-pages .nav-page[data-page="13"]`);
  await h.wait(500);
  await h.clickSel('.rb-tab[data-tab="design"]');
  await h.clickSel('#pg-delete');
  await h.until(`!!document.querySelector('dialog.pub-dialog[open]')`, 2000);
  await h.clickSel('dialog .pd-ok');
  await h.until(`window.__bbWeek().manifest.pages.length === ${total - 1}`, 10000);
  await h.wait(900);
  b = await boxes('pagenum');
  const bh = await boxes('header');
  h.ok('after deleting a page the numbers and the count are right by themselves', Object.keys(b).every((n) => b[n].text === String(n)) && Object.values(bh).every((x) => x.text.endsWith(' of ' + (total - 1))), { b, bh });
  await h.clickSel('#undo');
  await h.until(`window.__bbWeek().manifest.pages.length === ${total}`, 10000);
  await h.wait(600);

  // remove
  await h.clickSel('.rb-tab[data-tab="insert"]');
  await h.clickSel('#ins-header');
  await h.clickSel('#hf-header-remove');
  await h.wait(600);
  h.ok('Remove Headers', Object.keys(await boxes('header')).length === 0);
  await h.clickSel('#ins-pagenum');
  await h.clickSel('#pn-remove');
  await h.wait(600);
  h.ok('Remove Page Numbers', Object.keys(await boxes('pagenum')).length === 0);
  await h.clickSel('#undo');
  await h.wait(600);
  h.ok('Undo brings the page numbers back', Object.keys(await boxes('pagenum')).length === annPages.length);

  // a field where you are typing
  await h.clickSel(`#nav-pages .nav-page[data-page="${P}"]`);
  await h.wait(600);
  const w = await word('budget');
  await h.click(w.x1, w.y);
  await h.type(' p. ');
  await h.clickSel('.rb-tab[data-tab="insert"]');
  await h.clickSel('#ins-pagenum');
  await h.clickSel('#pn-caret');
  await h.wait(300);
  h.ok('Current Page Number at the caret: a field showing 12', (await h.js(`(() => { const f = document.querySelector('${BOX} .field[data-field="pageNumber"]'); return f && f.textContent; })()`)) === '12');
  await h.type(' of ');
  await h.clickSel('#ins-pagenum');
  await h.clickSel('#pn-count');
  await h.wait(300);
  h.ok('Number of Pages at the caret: a field showing ' + total, (await h.js(`(() => { const f = document.querySelector('${BOX} .field[data-field="pageCount"]'); return f && f.textContent; })()`)) === String(total));
  await h.key('Escape', [], 700);
  const runs = await ed(`(() => { const f = ed.anyFrame(${P}, 'f459'); const p = f.text.paragraphs.find((q) => q.runs.some((r) => r.field)); return p ? p.runs.filter((r) => r.field || /budget| of /.test(r.text)).map((r) => ({ t: r.text, f: r.field || null })) : null; })()`);
  h.ok('saved: runs with pageNumber and pageCount fields, text kept around them', runs && runs.some((r) => r.f === 'pageNumber') && runs.some((r) => r.f === 'pageCount') && runs.some((r) => /budget p\. $/.test(r.t)), { runs });
  h.ok('…drawn as 12 and ' + total + ' on the page', (await h.js(`[...document.querySelectorAll('${BOX} .field')].map((f) => f.textContent).join(',')`)) === '12,' + total);
  await h.shot('field-in-text');
  // View ▸ Show ▸ Fields: the shading on screen
  const shade = () => h.js(`getComputedStyle(document.querySelector('${BOX} .field')).backgroundColor`);
  h.ok('fields are shaded on screen', /rgba\(43, 125, 233/.test(await shade()));
  await h.clickSel('.rb-tab[data-tab="view"]');
  await h.clickSel('#show-fields');
  h.ok('View ▸ Fields unticked: no shading', !/rgba\(43, 125, 233/.test(await shade()));
  await h.clickSel('#show-fields');
};
