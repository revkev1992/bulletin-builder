// GUI suite: the Most Used tab (Kevin's spec extra) — the commands pressed most gather there as working
// copies (clicks go to the original; a menu opens under the copy); right-click any ribbon button to pin /
// unpin; kept per PC (localStorage bb.mostused).
exports.run = async (h) => {
  await h.js(`localStorage.removeItem('bb.mostused')`);
  await h.clickSel('.rb-tab[data-tab="mostused"]');
  h.ok('a Most Used tab exists after Bulletin, empty to begin with', await h.js(`(() => { const t = [...document.querySelectorAll('.rb-tab')].map((b) => b.dataset.tab); return t.indexOf('mostused') > t.indexOf('bulletin') && !!document.querySelector('.rb-panel[data-tab="mostused"] .mu-empty'); })()`), { tabs: await h.js(`[...document.querySelectorAll('.rb-tab')].map((b) => b.dataset.tab).join()`), empty: await h.js(`!!document.querySelector('.rb-panel[data-tab="mostused"] .mu-empty')`) });

  // use some commands: 100% ×3, Whole Page ×2, Single Page ×1 (view commands — harmless)
  await h.clickSel('.rb-tab[data-tab="view"]');
  for (let i = 0; i < 3; i++) await h.clickSel('#zoom-100');
  for (let i = 0; i < 2; i++) await h.clickSel('#zoom-fit');
  await h.clickSel('#rb-single');
  await h.wait(600);
  await h.clickSel('.rb-tab[data-tab="mostused"]');
  const order = await h.js(`[...document.querySelectorAll('.rb-panel[data-tab="mostused"] [data-mirror]')].map((b) => b.dataset.mirror)`);
  h.ok('the tab lists the commands in order of use (100% first, then Whole Page, then Single Page)', order.join() === 'zoom-100,zoom-fit,rb-single', { order });
  h.ok('…each a working copy with the original\'s icon and label', (await h.js(`(() => { const b = document.querySelector('.rb-panel[data-tab="mostused"] [data-mirror="zoom-100"]'); return b && !!b.querySelector('svg') && /100%/.test(b.textContent); })()`)));
  h.ok('…kept on this PC', JSON.parse(await h.js(`localStorage.getItem('bb.mostused')`)).counts['zoom-100'] === 3);
  await h.shot('most-used');

  // a copy works: Two-Page Spread from the tab's copy of Single Page's neighbour — use the copy of Single Page, then the real Spread
  await h.js(`window.__bbSetViewLayout('spread')`);
  await h.wait(400);
  await h.clickSel('.rb-tab[data-tab="mostused"]');
  await h.clickSel('.rb-panel[data-tab="mostused"] [data-mirror="rb-single"]');
  await h.wait(800);
  h.ok('clicking a copy runs the real command (Single Page)', await h.js(`!!document.querySelector('.spreads.single')`));
  h.ok('…and the copy shows the original\'s state (lit)', await h.js(`document.querySelector('.rb-panel[data-tab="mostused"] [data-mirror="rb-single"]').classList.contains('active')`));
  await h.js(`window.__bbSetViewLayout('spread')`);
  await h.wait(400);

  // pin a command by right-click (Page Design ▸ Margins), even though it was never used
  await h.clickSel('.rb-tab[data-tab="design"]');
  const r = await h.rect('#pg-margins');
  await h.rightClick(r.cx, r.cy);
  h.ok('right-click a ribbon button offers Pin to Most Used', await h.until(`!!document.querySelector('.rb-pinmenu #pin-toggle')`, 2000) && /Pin to Most Used/.test(await h.js(`document.querySelector('.rb-pinmenu #pin-toggle').textContent`)));
  await h.clickSel('.rb-pinmenu #pin-toggle');
  await h.wait(300);
  await h.clickSel('.rb-tab[data-tab="mostused"]');
  const groups = await h.js(`[...document.querySelectorAll('.rb-panel[data-tab="mostused"] .rb-group')].map((g) => g.querySelector('.rb-group-label').textContent + ':' + [...g.querySelectorAll('[data-mirror]')].map((b) => b.dataset.mirror).join('+'))`);
  h.ok('a Pinned group comes first with Margins, the used commands after it', groups.join('|') === 'Pinned:pg-margins|Most used:zoom-100+zoom-fit+rb-single', { groups });
  h.ok('a pinned command that needs a half is greyed in view only, like the original', await h.disabled('.rb-panel[data-tab="mostused"] [data-mirror="pg-margins"]'));
  await h.shot('pinned');

  // a menu opener copied there opens its menu under the copy
  await h.clickSel('.rb-tab[data-tab="insert"]');
  const sr = await h.rect('#rb-shapes');
  await h.rightClick(sr.cx, sr.cy);
  await h.until(`!!document.querySelector('.rb-pinmenu #pin-toggle')`, 2000);
  await h.clickSel('.rb-pinmenu #pin-toggle');
  await h.clickSel('.rb-tab[data-tab="mostused"]');
  await h.clickSel('.rb-panel[data-tab="mostused"] [data-mirror="rb-shapes"]');
  h.ok('a copied menu button opens its menu (Shapes) from the Most Used tab', await h.until(`!!document.querySelector('.rb-menu[data-menu-name="shapes"]:not([hidden])')`, 2000));
  await h.key('Escape', [], 300);
  await h.js(`document.querySelectorAll('.rb-menu').forEach((m) => { m.hidden = true; })`);

  // unpin from the tab itself
  const pr = await h.rect('.rb-panel[data-tab="mostused"] [data-mirror="pg-margins"]');
  await h.rightClick(pr.cx, pr.cy);
  await h.until(`!!document.querySelector('.rb-pinmenu #pin-toggle')`, 2000);
  h.ok('right-click on the copy offers Unpin', /Unpin/.test(await h.js(`document.querySelector('.rb-pinmenu #pin-toggle').textContent`)));
  await h.clickSel('.rb-pinmenu #pin-toggle');
  await h.wait(300);
  h.ok('…and it is gone from Pinned', !(await h.js(`!!document.querySelector('.rb-panel[data-tab="mostused"] [data-mirror="pg-margins"]')`)) && JSON.parse(await h.js(`localStorage.getItem('bb.mostused')`)).pins.join() === 'rb-shapes');
  await h.js(`localStorage.removeItem('bb.mostused')`);
};
