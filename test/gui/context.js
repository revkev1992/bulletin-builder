// GUI suite: right-click menus on the page (object / empty page / text), Ctrl+X, Ctrl+A, Select ▾.
const P = 12;
const BOX = `.page-shell[data-page="${P}"] .frame-text[data-id="f459"]`;

exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  const count = (n) => ed(`ed.pageEntry(${n}).frames.length`);
  const menu = () => h.js(`(() => { const m = document.querySelector('.ctx-menu'); return m ? { cls: m.className, items: [...m.querySelectorAll('button')].map((b) => b.dataset.cmd + (b.disabled ? '-' : '+')) } : null; })()`);
  const pick = (cmd) => h.clickSel(`.ctx-menu button[data-cmd="${cmd}"]`);

  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "announcements"');
  await h.clickSel('.rb-tab[data-tab="home"]');
  await h.js(`document.querySelector('.page-shell[data-page="${P}"]').scrollIntoView({ block: 'center' })`);
  await h.wait(400);

  // right-click a picture
  const pic = await h.js(`(() => { const fs = window.__bbEditor.pageEntry(${P}).frames.filter((f) => f.kind === 'image'); fs.sort((a, b) => b.w * b.h - a.w * a.h); return fs[0].id; })()`);
  let r = await h.rect(`.page-shell[data-page="${P}"] .frame[data-id="${pic}"]`);
  await h.rightClick(r.cx, r.cy);
  let m = await menu();
  h.ok('right-click a picture: object menu (Cut, Copy, Delete, Crop, Fit, Fill…)', m && /ctx-object/.test(m.cls) && ['cut+', 'copy+', 'delete+', 'crop+', 'fit+', 'fill+', 'format+'].every((x) => m.items.includes(x)), { m });
  h.ok('…and selects the picture', await ed(`ed.sel && ed.sel.id === '${pic}'`));
  await h.shot('menu-object');
  await pick('copy');

  // right-click the empty page: Paste
  const n0 = await count(P);
  const pg = await h.rect(`.page-shell[data-page="${P}"] .page`);
  await h.rightClick(pg.x + 12, pg.y + pg.h - 12);
  m = await menu();
  h.ok('right-click the empty page: page menu with Paste, Select All, page commands', m && /ctx-page/.test(m.cls) && ['paste+', 'select-all+', 'insert+', 'delete-page+', 'move+'].every((x) => m.items.includes(x)), { m });
  await h.shot('menu-page');
  await pick('paste');
  h.ok('Paste puts a copy of the picture on the page', (await count(P)) === n0 + 1);
  const pasted = await ed('ed.sel && ed.sel.id');
  r = await h.rect(`.page-shell[data-page="${P}"] .frame[data-id="${pasted}"]`);
  await h.rightClick(r.cx, r.cy);
  await pick('delete');
  h.ok('right-click ▸ Delete Object removes it', (await count(P)) === n0);

  // Ctrl+X / Ctrl+V on the selected picture
  r = await h.rect(`.page-shell[data-page="${P}"] .frame[data-id="${pic}"]`);
  await h.click(r.cx, r.cy);
  await h.key('X', ['control'], 400);
  h.ok('Ctrl+X cuts the selected picture', (await count(P)) === n0 - 1);
  await h.key('V', ['control'], 400);
  h.ok('Ctrl+V pastes it back', (await count(P)) === n0);

  // Ctrl+A selects every object on the page
  await h.key('A', ['control'], 300);
  h.ok('Ctrl+A selects every object on the page', (await ed('ed.selection().length')) === n0, { got: await ed('ed.selection().length'), n0 });
  await h.shot('select-all');
  await h.key('Escape');

  // right-click in text: Copy / Paste
  const w = await h.js(`(() => { const box = document.querySelector('${BOX}'); const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let t; (t = tw.nextNode());) { const i = t.data.indexOf('budget'); if (i >= 0) { const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 6);
      const b = r.getBoundingClientRect(); return { x0: b.left + 0.5, x1: b.right - 0.5, y: b.top + b.height / 2 }; } } })()`);
  await h.click(w.x0 + 2, w.y);
  await h.drag(w.x0, w.y, w.x1, w.y, { steps: 5 });
  await h.rightClick((w.x0 + w.x1) / 2, w.y);
  m = await menu();
  h.ok('right-click selected text: text menu (Cut, Copy, Paste, Paragraph…, Tabs…, Styles…)', m && /ctx-text/.test(m.cls) && ['text-cut+', 'text-copy+', 'text-paste+', 'paragraph+', 'tabs+', 'styles+'].every((x) => m.items.includes(x)), { m });
  h.ok('…the text stays selected', (await h.js('getSelection().toString()')) === 'budget');
  await h.shot('menu-text');
  await pick('text-copy');
  await h.wait(300);
  const { clipboard } = require('electron');
  const clip = await clipboard.readText();
  h.ok('right-click ▸ Copy puts the word on the clipboard', clip === 'budget', { clip });
  // caret just after "funds", then right-click ▸ Paste
  const f = await h.js(`(() => { const box = document.querySelector('${BOX}'); const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let t; (t = tw.nextNode());) { const i = t.data.indexOf('funds'); if (i >= 0) { const r = document.createRange(); r.setStart(t, i + 4); r.setEnd(t, i + 5);
      const b = r.getBoundingClientRect(); return { x: b.right - 0.5, y: b.top + b.height / 2 }; } } })()`);
  await h.click(f.x, f.y);
  await h.rightClick(f.x, f.y);
  await pick('text-paste');
  await h.wait(400);
  const n = await h.js(`(document.querySelector('${BOX}').textContent.match(/budget/g) || []).length`);
  h.ok('right-click ▸ Paste puts it at the caret: the word appears twice', n === 2, { n, around: await h.js(`document.querySelector('${BOX}').textContent.match(/fund.{0,12}/)[0]`) });

  // Select ▾ ▸ Select All Text in Text Box
  await h.clickSel('#rb-select');
  await h.clickSel('#sel-text');
  const all = await h.js(`getSelection().toString().replace(/\\s/g, '').length`);
  const boxLen = await h.js(`document.querySelector('${BOX} .flow').textContent.replace(/\\s/g, '').replace(/\\u200b/g, '').length`);
  h.ok('Select ▸ Select All Text in Text Box', all > 100 && Math.abs(all - boxLen) < 5, { all, boxLen });
};
