// GUI suite: the badge at the top right switches what you are changing (Kevin batch 3: "make the 'view
// only/editing worship/etc.' in the top right corner able to change the mode"), and the shelf from the
// other half (Kevin batch 3: "I wasn't able to drag and drop from the shelf. Or even click on them").
exports.run = async (h) => {
  const half = () => h.js('window.__bbEditor.half || ""');
  const badge = () => h.js("document.getElementById('badge').textContent");
  const status = () => h.js("document.getElementById('status') ? document.getElementById('status').textContent : ''");
  const menuItems = () => h.js("[...document.querySelectorAll('.ctx-menu.mode-menu button')].map((b) => b.textContent.trim())");
  const pick = async (cmd) => {
    await h.clickSel('#badge');
    await h.wait(200);
    await h.clickSel(`.ctx-menu.mode-menu button[data-cmd="${cmd}"]`);
    await h.wait(700);
  };

  await h.clickSel('.rb-tab[data-tab="home"]');
  h.ok('a week opens View only; the badge says so', (await half()) === '' && /^View only/.test(await badge()), { badge: await badge() });
  await h.clickSel('#badge');
  await h.wait(200);
  const items = await menuItems();
  h.ok('click the badge: View only / Worship pages / Announcements pages, the current one ticked',
    items.length === 3 && /✓\s*View only/.test(items[0]) && /Worship pages/.test(items[1]) && /Announcements pages/.test(items[2]), { items });
  await h.shot('menu');
  await h.clickSel('.ctx-menu.mode-menu button[data-cmd="mode-worship"]');
  await h.wait(700);
  h.ok('…choose Worship pages: editing worship, from the Home tab', (await half()) === 'worship' && /^Editing worship/.test(await badge()) &&
    (await h.js("document.getElementById('mode').value")) === 'worship', { badge: await badge() });
  // a week finished by an older test build (music pinned to the page) says how to make it travel
  const pinned = await h.js(`(() => { const w = window.__bbWeek().halves.worship; return w.mode === 'finished' &&
    Object.values(w.pages).some((pg) => pg.frames.some((f) => f.fromDraft && f.kind === 'image')) &&
    !Object.values(w.pages).some((pg) => pg.frames.some((f) => f.kind === 'text' && f.text.paragraphs.some((p) => p.picture))); })()`);
  h.ok('…' + (pinned ? 'music pinned by an older build: the status says Back to Draft, then Finish Layout' : 'no warning about pinned music'),
    pinned === /Back to Draft, then Finish Layout/.test(await status()), { pinned, st: await status() });
  await pick('mode-announcements');
  h.ok('…then Announcements pages: switched straight over', (await half()) === 'announcements' && /^Editing announcements/.test(await badge()));
  await pick('mode-view');
  h.ok('…and View only again: nothing claimed', (await half()) === '' && /^View only/.test(await badge()));

  // View only: a shelf item says how to start, and the badge flashes
  const shelf = (sel) => `#shelf .scratch-item${sel} .frame`;
  await h.reveal(shelf('[data-half="announcements"]'));
  const a0 = await h.rect(shelf('[data-half="announcements"]'));
  await h.click(a0.cx, a0.cy);
  await h.wait(200);
  h.ok('View only: clicking a parked item points at the badge (and it flashes)', /top right/.test(await status()) &&
    (await h.js("document.getElementById('badge').classList.contains('flash')")), { st: await status() });

  // editing worship: an announcements item on the shelf can be clicked and dragged — a copy goes on the page
  await pick('mode-worship');
  const ann = () => h.js("(window.__bbWeek().halves.announcements.pasteboard || []).map((f) => f.id).join(',')");
  const ann0 = await ann();
  await h.reveal(shelf('[data-half="announcements"]'));
  const it = await h.js(`(() => { const e = document.querySelector('#shelf .scratch-item[data-half="announcements"]'); return e.dataset.id; })()`);
  const a1 = await h.rect(shelf(`[data-id="${it}"]`));
  await h.click(a1.cx, a1.cy);
  await h.wait(200);
  h.ok('editing worship: an announcements item can be selected', await h.js(`document.querySelector('#shelf .scratch-item[data-id="${it}"]').classList.contains('selected')`));
  await h.key('Delete');
  await h.wait(300);
  h.ok('…but Delete is refused (it is theirs)', (await ann()) === ann0 && /Only the announcements/.test(await status()), { st: await status() });
  const n = await h.js("window.__bbWeek().manifest.pages.filter((p) => p.half === 'worship').pop().number");
  await h.reveal(`.page-shell[data-page="${n}"] .page`);
  const pg = await h.rect(`.page-shell[data-page="${n}"] .page`);
  const a2 = await h.rect(shelf(`[data-id="${it}"]`));
  const before = await h.js(`window.__bbWeek().halves.worship.pages['${n}'].frames.length`);
  await h.drag(a2.cx, a2.cy, pg.cx, pg.cy, { steps: 14 });
  await h.wait(800);
  const after = await h.js(`window.__bbWeek().halves.worship.pages['${n}'].frames.length`);
  h.ok('…dragged onto worship page ' + n + ': a copy is on the page, theirs stays on the shelf', after === before + 1 && (await ann()) === ann0 &&
    !!(await h.js(`document.querySelector('#shelf .scratch-item[data-id="${it}"]')`)), { before, after, st: await status() });
  await h.shot('copied');
  await h.clickSel('#undo');
  await h.wait(700);
  h.ok('Undo takes the copy away', (await h.js(`window.__bbWeek().halves.worship.pages['${n}'].frames.length`)) === before);
};
