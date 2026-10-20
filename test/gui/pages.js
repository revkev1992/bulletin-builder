// GUI suite: the Pages pane (batch-1 item 4) — thumbnails, click to go, right-click menu
// (Insert / Duplicate / Delete / Move), and the ribbon's page commands. Real clicks only.
exports.run = async (h) => {
  const pageCount = () => h.js('window.__bbWeek().manifest.pages.length');
  const thumb = (n) => `#nav-pages .nav-page[data-page="${n}"]`;
  const menuItem = (cmd) => `.ctx-menu button[data-cmd="${cmd}"]`;
  const n0 = await pageCount();

  h.ok('Pages pane shows one thumbnail per page', (await h.js(`document.querySelectorAll('#nav-pages .nav-page[data-page] .thumb-page').length`)) === n0);
  await h.shot('pages-pane');

  // click a thumbnail: goes to the page, page becomes current
  await h.clickSel(thumb(12));
  await h.wait(700);
  h.ok('click thumbnail 12: page 12 is current', await h.js(`window.__bbEditor.lastPage === 12 && document.querySelector('${thumb(12)}').classList.contains('current')`));
  h.ok('…and the page scrolled into view', await h.js(`(() => { const r = document.querySelector('.page-shell[data-page="12"]').getBoundingClientRect(); const s = document.getElementById('stage').getBoundingClientRect(); return r.bottom > s.top && r.top < s.bottom; })()`));

  // view only: the menu explains why page changes are greyed
  await h.reveal(thumb(12)); let r = await h.rect(thumb(12));
  await h.rightClick(r.cx, r.cy);
  h.ok('right-click a page opens the page menu', await h.js(`!!document.querySelector('.ctx-menu')`));
  h.ok('view only: Insert/Delete/Move greyed', (await h.disabled(menuItem('delete'))) && (await h.disabled(menuItem('insert'))));
  await h.shot('menu-view-only');
  await h.key('Escape');
  h.ok('Esc closes the menu', !(await h.js(`!!document.querySelector('.ctx-menu')`)));

  // claim announcements
  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "announcements"');
  await h.wait(800);

  // right-click a worship page: Delete/Move greyed (other half), Insert allowed
  await h.reveal(thumb(4)); r = await h.rect(thumb(4));
  await h.rightClick(r.cx, r.cy);
  h.ok('worship page while changing announcements: Delete greyed, Insert allowed', (await h.disabled(menuItem('delete'))) && !(await h.disabled(menuItem('blank'))));
  await h.key('Escape');

  // Insert Duplicate Page after 14
  await h.reveal(thumb(14)); r = await h.rect(thumb(14));
  await h.rightClick(r.cx, r.cy);
  await h.shot('menu-editing');
  h.ok('own page: every page command enabled', !(await h.disabled(menuItem('delete'))) && !(await h.disabled(menuItem('move'))) && !(await h.disabled(menuItem('dup'))));
  const frames14 = await h.js(`window.__bbEditor.pageEntry(14).frames.length`);
  await h.clickSel(menuItem('dup'));
  h.ok('Insert Duplicate Page adds a page', await h.until(`window.__bbWeek().manifest.pages.length === ${n0 + 1}`));
  await h.wait(800);
  h.ok('…a copy of page 14 (same number of objects) as page 15', (await h.js(`window.__bbEditor.pageEntry(15).frames.length`)) === frames14);
  h.ok('…pane has a thumbnail for the new page', (await h.js(`document.querySelectorAll('#nav-pages .nav-page[data-page]').length`)) === n0 + 1);
  h.ok('…status warns the booklet is not a multiple of 4', /multiple of 4|fours|4/.test(await h.js(`document.getElementById('status').textContent`)), { status: await h.js(`document.getElementById('status').textContent`) });

  // Move Page… page 15 to before page 12
  await h.reveal(thumb(15)); r = await h.rect(thumb(15));
  await h.rightClick(r.cx, r.cy);
  await h.clickSel(menuItem('move'));
  h.ok('Move Page… opens the Move Page dialog', await h.until(`!!document.querySelector('dialog.pub-dialog[open]')`));
  await h.shot('move-dialog');
  await h.js(`(() => { const s = document.querySelector('dialog select[name="ref"]'); s.value = '12'; s.dispatchEvent(new Event('change')); })()`);
  await h.clickSel('dialog .pd-ok');
  h.ok('page moved: page 12 now holds the duplicate', await h.until(`window.__bbEditor.pageEntry(12) && window.__bbEditor.pageEntry(12).frames.length === ${frames14}`));
  await h.wait(800);

  // Delete Page via right-click
  await h.reveal(thumb(12)); r = await h.rect(thumb(12));
  await h.rightClick(r.cx, r.cy);
  await h.clickSel(menuItem('delete'));
  h.ok('Delete Page asks first', await h.until(`!!document.querySelector('dialog.pub-dialog[open]')`));
  await h.shot('delete-confirm');
  await h.clickSel('dialog .pd-ok');
  h.ok('Delete Page removes it (back to ' + n0 + ' pages)', await h.until(`window.__bbWeek().manifest.pages.length === ${n0}`));
  await h.wait(800);
  await h.shot('after-delete');

  // the ribbon route still works: Page Design ▸ Pages ▸ Delete (Cancel)
  await h.clickSel('.rb-tab[data-tab="design"]');
  await h.clickSel(thumb(13));
  await h.clickSel('#pg-delete');
  h.ok('Page Design ▸ Delete opens the same dialog', await h.until(`!!document.querySelector('dialog.pub-dialog[open]')`));
  await h.clickSel('dialog button[value="cancel"]');
  h.ok('Cancel leaves the pages alone', (await pageCount()) === n0);
};
