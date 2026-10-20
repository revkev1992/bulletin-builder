// GUI suite on an Order-of-Worship (flow) week: clicking a laid-out line selects its block in the
// panel and never starts typing in a generated frame (until item 6 "Finish Layout" is approved).
exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'worship'; s.dispatchEvent(new Event('change')); })()`);
  h.ok('claim worship pages', await h.until('window.__bbEditor.half === "worship"'));
  await h.wait(800);
  h.ok('Order of Worship panel open', await h.js(`!document.getElementById('flowpanel').hidden`));
  await h.clickSel('#nav-pages .nav-page[data-page="3"]');
  await h.wait(800);
  const line = await h.js(`(() => { const p = [...document.querySelectorAll('.page-shell[data-page="3"] p.para[data-block]')].find((x) => x.textContent.trim().length > 8);
    const r = p.getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2, block: p.dataset.block }; })()`);
  await h.click(line.x, line.y);
  h.ok('click a laid-out line: its block is selected in the panel', (await h.js(`window.__bbEditor.panel.selId`)) === line.block, { want: line.block, got: await h.js(`window.__bbEditor.panel.selId`) });
  h.ok('…and no typing starts in a generated frame', !(await ed('!!ed.textEdit')));
  await h.shot('flow-line-selected');
  h.ok('Pages pane has a thumbnail for every page', (await h.js(`document.querySelectorAll('#nav-pages .nav-page[data-page] .thumb-page').length`)) === (await h.js('window.__bbWeek().manifest.pages.length')));
};
