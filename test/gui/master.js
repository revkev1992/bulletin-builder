// GUI suite: Master pages (Publisher: Page Design ▸ Master Pages, View ▸ Master Page / Normal) — a
// two-page master per half (left = even pages, right = odd); objects put on it in master view appear
// behind every page of that side; a page can ignore the master; Send to Master Page; Clear; Ctrl+M;
// the master is saved in the half file.
const fs = require('fs');
const path = require('path');

exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  const master = () => h.js(`JSON.parse(JSON.stringify((window.__bbWeek().halves.announcements.master) || null))`);
  const masterObjs = (n) => h.js(`[...document.querySelectorAll('.page-shell[data-page="${n}"] .page .master-obj')].map((e) => ({ id: e.dataset.id, kind: [...e.classList].find((c) => /^frame-/.test(c)), text: e.textContent.trim() }))`);
  const annPages = await h.js(`window.__bbWeek().manifest.pages.filter((p) => p.half === 'announcements').map((p) => p.number)`);
  const worPages = await h.js(`window.__bbWeek().manifest.pages.filter((p) => p.half === 'worship').map((p) => p.number)`);
  const even = annPages.filter((n) => n % 2 === 0), odd = annPages.filter((n) => n % 2 === 1);
  const L = even[0], R = odd.find((n) => n > L) || odd[0];

  // view only: nothing to switch to
  await h.clickSel('.rb-tab[data-tab="view"]');
  h.ok('view only: View ▸ Master Page greyed', await h.disabled('#rb-master'));
  await h.clickSel('.rb-tab[data-tab="design"]');
  h.ok('view only: Page Design ▸ Master Pages greyed', await h.disabled('#pg-master'));
  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "announcements"');
  await h.clickSel(`#nav-pages .nav-page[data-page="${L}"]`);
  await h.wait(600);

  // ---- Page Design ▸ Master Pages ▸ Edit Master Pages
  await h.clickSel('.rb-tab[data-tab="design"]');
  await h.clickSel('#pg-master');
  h.ok('Master Pages opens its menu', !!(await h.rect('.rb-menu[data-menu-name="master"]:not([hidden]) #mp-edit')));
  await h.clickSel('#mp-edit');
  h.ok('Edit Master Pages switches to master view', await h.until('document.body.classList.contains("master-view") && window.__bbEditor.masterMode === true', 4000));
  await h.wait(800);
  const total = await h.js('window.__bbWeek().manifest.pages.length');
  h.ok('every page is drawn as its master side', (await h.js(`document.querySelectorAll('.page.master-page').length`)) === total);
  h.ok('…even pages show the left-hand master, odd the right-hand', (await h.js(`document.querySelector('.page-shell[data-page="${L}"] .page').dataset.side`)) === 'left' && (await h.js(`document.querySelector('.page-shell[data-page="${R}"] .page').dataset.side`)) === 'right');
  h.ok('the banner says so', !(await h.js(`document.getElementById('master-banner').hidden`)));
  h.ok('page commands wait until Normal view', await h.disabled('#pg-delete') && await h.disabled('#pg-insert'));
  await h.clickSel('.rb-tab[data-tab="view"]');
  h.ok('View ▸ Master Page is lit, Normal is not', (await h.js(`document.getElementById('rb-master').classList.contains('active') && !document.getElementById('rb-normal').classList.contains('active')`)));
  await h.shot('master-view');

  // a text box on the LEFT master (page L is even), typed into
  await h.clickSel('.rb-tab[data-tab="insert"]');
  await h.clickSel('#ins-text');
  await h.wait(500);
  const tid = await ed('ed.sel && ed.sel.id');
  let m = await master();
  h.ok('Insert ▸ Text Box in master view goes on the left-hand master, not the page', !!m && m.left.frames.length === 1 && m.left.frames[0].id === tid && m.right.frames.length === 0 &&
    !(await h.js(`window.__bbWeek().halves.announcements.pages["${L}"].frames.some((f) => f.id === ${JSON.stringify(tid)})`)), { m: m && { l: m.left.frames.length, r: m.right.frames.length } });
  h.ok('…and is drawn on every even announcements page', (await Promise.all(even.map((n) => h.js(`!!document.querySelector('.page-shell[data-page="${n}"] .page .frame[data-id="${tid}"]')`)))).every(Boolean));
  let r = await h.rect(`.page-shell[data-page="${L}"] .frame[data-id="${tid}"]`);
  await h.click(r.cx, r.cy);
  h.ok('a click in it (below its text) keeps the caret in the box', await ed(`!!ed.textEdit && ed.textEdit.id === ${JSON.stringify(tid)}`) && (await h.js('document.activeElement.classList.contains("flow")')));
  await h.key('A', ['control']);
  await h.type('Highland UMC');
  await h.key('Escape', [], 500);
  m = await master();
  const text = (f) => f.text.paragraphs.map((p) => p.runs.map((x) => x.text).join('')).join('');
  h.ok('the typing is saved in the master', !!m && text(m.left.frames[0]) === 'Highland UMC', { t: m && text(m.left.frames[0]) });
  h.ok('…and shows on another even page', (await h.js(`(document.querySelector('.page-shell[data-page="${even[1] || L}"] .frame[data-id="${tid}"]') || {}).textContent || ''`)).trim() === 'Highland UMC');

  // an oval on the RIGHT master
  await h.clickSel(`#nav-pages .nav-page[data-page="${R}"]`);
  await h.wait(500);
  await h.clickSel('.rb-tab[data-tab="insert"]');
  await h.clickSel('#rb-shapes');
  await h.clickSel('#ins-oval');
  await h.wait(500);
  const oid = await ed('ed.sel && ed.sel.id');
  m = await master();
  h.ok('a shape inserted on an odd page goes on the right-hand master', !!m && m.right.frames.length === 1 && m.right.frames[0].id === oid && m.left.frames.length === 1, { m: m && { l: m.left.frames.length, r: m.right.frames.length } });
  await h.shot('master-objects');

  // ---- View ▸ Normal: the pages again, with the master underneath
  await h.clickSel('.rb-tab[data-tab="view"]');
  await h.clickSel('#rb-normal');
  h.ok('View ▸ Normal leaves master view', await h.until('!document.body.classList.contains("master-view") && window.__bbEditor.masterMode === false', 4000));
  await h.wait(800);
  const evenHave = await Promise.all(even.map(masterObjs));
  const oddHave = await Promise.all(odd.map(masterObjs));
  const worHave = await Promise.all(worPages.map(masterObjs));
  h.ok('every even announcements page draws the master text box underneath', evenHave.every((l) => l.length === 1 && l[0].id === tid && l[0].text === 'Highland UMC'), { evenHave });
  h.ok('every odd announcements page draws the master oval', oddHave.every((l) => l.length === 1 && l[0].id === oid && l[0].kind === 'frame-shape'), { oddHave });
  h.ok('the worship pages draw nothing from the announcements master', worHave.every((l) => l.length === 0));
  h.ok('a page\'s own objects are drawn above the master', await h.js(`(() => { const pg = document.querySelector('.page-shell[data-page="${L}"] .page'); const kids = [...pg.children].filter((e) => e.classList.contains('frame')); return kids.length > 1 && kids[0].classList.contains('master-obj') && !kids[kids.length - 1].classList.contains('master-obj') && kids.filter((k) => k.classList.contains('master-obj')).every((k) => Number(k.style.zIndex) < Math.min(...kids.filter((x) => !x.classList.contains('master-obj')).map((x) => Number(x.style.zIndex) || 0))); })()`));
  await h.clickSel(`#nav-pages .nav-page[data-page="${L}"]`);
  await h.wait(500);
  r = await h.rect(`.page-shell[data-page="${L}"] .master-obj[data-id="${tid}"]`);
  await h.click(r.cx, r.cy);
  h.ok('a master object cannot be selected from the page (the click goes to the page underneath)', (await ed('ed.sel && ed.sel.id')) !== tid && (await ed('!ed.textEdit || ed.textEdit.id !== ' + JSON.stringify(tid))));
  await h.key('Escape', [], 300);
  await h.shot('normal-with-master');

  // ---- "This page uses the master page" off, then Undo
  await h.clickSel('.rb-tab[data-tab="design"]');
  await h.clickSel('#pg-master');
  h.ok('the menu shows the page using the master', await h.js(`document.getElementById('mp-use').checked === true && document.getElementById('mp-use').disabled === false`));
  await h.clickSel('#mp-use');
  await h.wait(600);
  h.ok('unticked: the page ignores the master (page.master = false)', (await h.js(`window.__bbWeek().halves.announcements.pages["${L}"].master`)) === false);
  h.ok('…nothing from the master is drawn on it; the other even pages still show it', (await masterObjs(L)).length === 0 && (even[1] ? (await masterObjs(even[1])).length === 1 : true));
  await h.clickSel('#undo');
  await h.wait(600);
  h.ok('Undo: the page shows the master again', (await h.js(`window.__bbWeek().halves.announcements.pages["${L}"].master`)) !== false && (await masterObjs(L)).length === 1);

  // ---- Send to Master Page: a rectangle drawn on an odd page goes to the right-hand master
  await h.clickSel(`#nav-pages .nav-page[data-page="${R}"]`);
  await h.wait(500);
  await h.clickSel('.rb-tab[data-tab="insert"]');
  await h.clickSel('#rb-shapes');
  await h.clickSel('#ins-rect');
  await h.wait(500);
  const rid = await ed('ed.sel && ed.sel.id');
  h.ok('a rectangle on page ' + R + ' is selected (on the page, not the master)', !!rid && (await h.js(`window.__bbWeek().halves.announcements.pages["${R}"].frames.some((f) => f.id === ${JSON.stringify(rid)})`)));
  await h.clickSel('.rb-tab[data-tab="design"]');
  await h.clickSel('#pg-master');
  h.ok('Send to Master Page is enabled with an object selected', !(await h.disabled('#mp-send')));
  await h.clickSel('#mp-send');
  await h.wait(800);
  m = await master();
  h.ok('the rectangle left the page and is on the right-hand master', !(await h.js(`window.__bbWeek().halves.announcements.pages["${R}"].frames.some((f) => f.id === ${JSON.stringify(rid)})`)) && m.right.frames.some((f) => f.id === rid), { r: m.right.frames.map((f) => f.id) });
  h.ok('…so every odd announcements page now draws it too', (await Promise.all(odd.map(masterObjs))).every((l) => l.some((x) => x.id === rid)));
  h.ok('nothing is selected afterwards', !(await ed('ed.sel')));
  await h.shot('sent-to-master');

  // ---- Clear Right-Hand Master, Undo
  await h.clickSel('#pg-master');
  await h.clickSel('#mp-clear-right');
  await h.wait(600);
  m = await master();
  h.ok('Clear Right-Hand Master empties it; the left-hand master is kept', m.right.frames.length === 0 && m.left.frames.length === 1 && (await masterObjs(R)).length === 0);
  await h.clickSel('#undo');
  await h.wait(600);
  m = await master();
  h.ok('Undo brings the right-hand master back', m.right.frames.length === 2 && (await masterObjs(R)).length === 2);

  // ---- Ctrl+M toggles master view
  await h.key('M', ['control'], 400);
  h.ok('Ctrl+M opens master view', await h.until('window.__bbEditor.masterMode === true', 3000));
  await h.wait(500);
  await h.key('M', ['control'], 400);
  h.ok('Ctrl+M again closes it', await h.until('window.__bbEditor.masterMode === false', 3000));
  await h.wait(500);

  // ---- saved with the half
  await h.clickSel('#save');
  await h.until('window.__bbEditor.dirty === false', 4000);
  const halfFile = path.join(path.dirname(h.weekCopy), 'announcements.json');
  const saved = JSON.parse(fs.readFileSync(halfFile, 'utf8'));
  h.ok('the master is written to announcements.json (left 1, right 2) with the page flag', !!saved.master && saved.master.left.frames.length === 1 && saved.master.right.frames.length === 2 && text(saved.master.left.frames[0]) === 'Highland UMC');
};
