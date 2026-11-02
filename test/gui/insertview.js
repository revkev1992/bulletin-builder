// GUI suite: View ▸ Single Page / Two-Page Spread, Page Design ▸ Rename, View ▸ Graphics Manager,
// Insert ▸ Link (hyperlinks: dialog, Ctrl+K, right-click Edit / Remove, kept in the model).
const fs = require('fs');
const P = 12;
const BOX = `.page-shell[data-page="${P}"] .frame-text[data-id="f459"]`;

exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  const word = (w) => h.js(`(() => { const box = document.querySelector('${BOX}'); const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let t; (t = tw.nextNode());) { const i = t.data.indexOf(${JSON.stringify(w)}); if (i >= 0) { const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + ${w.length});
      const b = r.getBoundingClientRect(); return { x0: b.left + 0.5, x1: b.right - 0.5, y: b.top + b.height / 2 }; } } return null; })()`);
  const manifest = () => JSON.parse(fs.readFileSync(h.weekCopy, 'utf8'));

  // ---- View ▸ Single Page
  await h.js(`localStorage.removeItem('bb.view.layout')`);
  await h.clickSel('.rb-tab[data-tab="view"]');
  h.ok('Two-Page Spread is the default (pressed)', await h.js(`document.getElementById('rb-spread').classList.contains('active') && !document.getElementById('rb-single').classList.contains('active')`));
  const n = await h.js('window.__bbWeek().manifest.pages.length');
  await h.clickSel('#rb-single');
  await h.until(`document.querySelectorAll('#stage .spread').length === ${n}`, 10000);
  await h.wait(500);
  h.ok('Single Page: one page per row, every page', (await h.js(`[...document.querySelectorAll('#stage .spread')].every((s) => s.querySelectorAll('.page-shell').length === 1)`)) && (await h.js(`document.querySelectorAll('#stage .page-shell').length`)) === n);
  h.ok('…the button shows it; remembered on this PC', (await h.js(`document.getElementById('rb-single').classList.contains('active')`)) && (await h.js(`localStorage.getItem('bb.view.layout')`)) === 'single');
  h.ok('…the Pages pane still pairs the thumbnails as spreads', (await h.js(`document.querySelectorAll('#nav-pages .nav-spread').length`)) < n);
  await h.shot('single-page');
  await h.clickSel('#rb-spread');
  await h.until(`document.querySelectorAll('#stage .spread').length < ${n}`, 10000);
  await h.wait(400);
  h.ok('Two-Page Spread again', (await h.js(`document.querySelectorAll('#stage .spread').length`)) === Math.ceil((n + 1) / 2) + (n % 2 === 0 ? 0 : 0));

  // ---- Page Design ▸ Rename (needs a half)
  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "announcements"');
  await h.clickSel('#nav-pages .nav-page[data-page="16"]');
  await h.wait(600);
  await h.clickSel('.rb-tab[data-tab="design"]');
  await h.clickSel('#pg-rename');
  h.ok('Rename opens a dialog for the current page', await h.until(`!!document.querySelector('dialog.pub-dialog[open] input[name="name"]')`, 2000) && /Page 16/.test(await h.js(`document.querySelector('dialog .pd-title').textContent`)));
  await h.type('Back cover');
  await h.clickSel('dialog .pd-ok');
  await h.wait(500);
  h.ok('the name is saved in the week file', (manifest().pages.find((p) => p.number === 16) || {}).name === 'Back cover');
  h.ok('…and shown under the thumbnail', (await h.js(`(document.querySelector('#nav-pages .nav-page[data-page="16"] .nav-name') || {}).textContent`)) === 'Back cover');
  await h.shot('renamed');

  // ---- View ▸ Graphics Manager
  await h.clickSel('.rb-tab[data-tab="view"]');
  await h.clickSel('#gm-btn');
  h.ok('Graphics Manager opens its pane', await h.until(`!document.getElementById('gmpane').hidden && document.querySelectorAll('#gmpane .gm-row').length > 10`, 8000));
  const rows = await h.js(`[...document.querySelectorAll('#gmpane .gm-row')].map((r) => r.textContent)`);
  h.ok('…listing every picture with its page, printed size and dpi', rows.length > 10 && rows.every((t) => /Page \d+|Scratch area/.test(t) && /\d+ × \d+ px · \d+ dpi|missing/.test(t)), { n: rows.length, first: rows[0] });
  h.ok('…and a summary line', /\d+ pictures/.test(await h.js(`document.querySelector('#gmpane .gm-sum').textContent`)));
  await h.shot('graphics-manager');
  const target = await h.js(`(() => { const r = [...document.querySelectorAll('#gmpane .gm-row')].find((x) => /Page 1[2-6]\\b/.test(x.textContent)); return r ? r.dataset.i : null; })()`);
  await h.clickSel(`#gmpane .gm-row[data-i="${target}"]`);
  await h.wait(700);
  h.ok('click a row: that picture is selected on its page', await ed(`ed.sel && ed.sel.page >= 12 && ed.frame() && ed.frame().kind === 'image'`), { sel: await ed('JSON.stringify(ed.sel)') });
  await h.clickSel('#gm-btn');
  h.ok('unticking hides the pane', await h.js(`document.getElementById('gmpane').hidden`));

  // ---- Insert ▸ Link on a selected word
  await h.clickSel('#nav-pages .nav-page[data-page="' + P + '"]');
  await h.wait(600);
  const w = await word('budget');
  await h.click(w.x0 + 2, w.y);
  await h.drag(w.x0, w.y, w.x1, w.y, { steps: 5 });
  h.ok('"budget" selected', (await h.js('getSelection().toString()')) === 'budget');
  await h.clickSel('.rb-tab[data-tab="insert"]');
  h.ok('Insert ▸ Link enabled while typing', !(await h.disabled('#ins-link')));
  await h.clickSel('#ins-link');
  h.ok('Link opens the hyperlink dialog with the text filled in', await h.until(`!!document.querySelector('dialog.pub-dialog[open] input[name="url"]')`, 2000) && (await h.js(`document.querySelector('dialog input[name="text"]').value`)) === 'budget');
  await h.type('www.highlandumc.org/give');
  await h.shot('link-dialog');
  await h.clickSel('dialog .pd-ok');
  await h.wait(400);
  const a = await h.js(`(() => { const a = document.querySelector('${BOX} a[href]'); return a ? { href: a.getAttribute('href'), text: a.textContent, color: getComputedStyle(a.querySelector('span') || a).color } : null; })()`);
  h.ok('the word is a link to https://www.highlandumc.org/give, shown blue', a && a.href === 'https://www.highlandumc.org/give' && a.text === 'budget' && /rgb\(5, 99, 193\)/.test(a.color), { a });
  // Ctrl+K inside the link: edit it
  await h.click((w.x0 + w.x1) / 2, w.y);
  await h.key('K', ['control']);
  h.ok('Ctrl+K in a link opens Edit Hyperlink with the address', await h.until(`!!document.querySelector('dialog.pub-dialog[open]')`, 2000) && (await h.js(`document.querySelector('dialog input[name="url"]').value`)) === 'https://www.highlandumc.org/give');
  const url = await h.rect('dialog input[name="url"]');
  await h.click(url.cx, url.cy);
  await h.key('A', ['control']);
  await h.type('giving@highlandumc.org');
  await h.clickSel('dialog .pd-ok');
  await h.wait(400);
  h.ok('an e-mail address becomes a mailto: link', (await h.js(`(document.querySelector('${BOX} a[href]') || {}).getAttribute?.('href')`)) === 'mailto:giving@highlandumc.org');
  await h.key('Escape', [], 600);
  const run = await ed(`(() => { const f = ed.anyFrame(${P}, 'f459'); for (const p of f.text.paragraphs) for (const r of p.runs) if (r.link) return r; return null; })()`);
  h.ok('saved: the run carries the link', run && run.link === 'mailto:giving@highlandumc.org' && run.text === 'budget', { run });
  h.ok('…and the page draws it as a real link', !!(await h.js(`document.querySelector('${BOX} a[href="mailto:giving@highlandumc.org"]')`)));
  // right-click ▸ Remove Hyperlink
  const w2 = await word('budget');
  await h.click((w2.x0 + w2.x1) / 2, w2.y);
  await h.rightClick((w2.x0 + w2.x1) / 2, w2.y);
  h.ok('right-click in the link offers Edit / Remove Hyperlink', !!(await h.js(`document.querySelector('.ctx-menu button[data-cmd="unlink"]:not(:disabled)')`)));
  await h.clickSel('.ctx-menu button[data-cmd="unlink"]');
  await h.wait(300);
  await h.key('Escape', [], 600);
  h.ok('Remove Hyperlink: no link left, the word still there', !(await h.js(`!!document.querySelector('${BOX} a[href]')`)) && (await h.js(`document.querySelector('${BOX}').textContent.includes('budget')`)));
  // a link typed from nothing (caret only): text + address
  const end = await word('donate).');
  await h.click(end.x1, end.y);
  await h.key('End');
  await h.type(' ');
  await h.key('K', ['control']);
  await h.until(`!!document.querySelector('dialog.pub-dialog[open]')`, 2000);
  await h.type('Give online');
  const url2 = await h.rect('dialog input[name="url"]');
  await h.click(url2.cx, url2.cy);
  await h.type('highlandumc.org');
  await h.clickSel('dialog .pd-ok');
  await h.wait(400);
  await h.key('Escape', [], 600);
  const typed = await ed(`(() => { const f = ed.anyFrame(${P}, 'f459'); for (const p of f.text.paragraphs) for (const r of p.runs) if (r.link === 'https://highlandumc.org') return r.text; return null; })()`);
  h.ok('with nothing selected the dialog\'s text is typed in as the link', typed === 'Give online', { typed });
};
