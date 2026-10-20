// GUI suite: Home ▸ Arrange + Insert ▸ Shapes (batch-1 section E, never reached by Kevin because
// of the text-box bugs). Real clicks on the ribbon and the page; Shift+click multi-select.
const P = 14;

exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  const F = (id) => ed(`JSON.parse(JSON.stringify(ed.topFrame(${P}, '${id}')))`);
  const frameRect = (id) => h.rect(`.page-shell[data-page="${P}"] .frame[data-id="${id}"]`);
  const menu = async (opener, item) => { await h.clickSel(opener); await h.clickSel(item); await h.wait(300); };

  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "announcements"');
  await h.clickSel(`#nav-pages .nav-page[data-page="${P}"]`);
  await h.wait(700);

  // three rectangles via Insert ▸ Shapes ▾ ▸ Rectangle, dragged apart
  const ids = [];
  for (let k = 0; k < 3; k++) {
    await h.clickSel('.rb-tab[data-tab="insert"]');
    await menu('#rb-shapes', '#ins-rect');
    const id = await ed('ed.sel && ed.sel.id');
    ids.push(id);
    const r = await frameRect(id);
    await h.drag(r.cx, r.cy, r.cx - 120 + k * 110, r.cy - 150 + k * 70, { mods: ['alt'] });
  }
  h.ok('Insert ▸ Shapes ▸ Rectangle made 3 shapes', ids.every(Boolean) && new Set(ids).size === 3, { ids });
  const xs = await Promise.all(ids.map(async (id) => (await F(id)).x));
  h.ok('…dragged to different places', new Set(xs.map(Math.round)).size === 3, { xs });

  // Shift+click selects several
  await h.clickSel('.rb-tab[data-tab="home"]');
  let r = await frameRect(ids[0]); await h.click(r.cx, r.cy);
  r = await frameRect(ids[1]); await h.click(r.cx, r.cy, { mods: ['shift'] });
  r = await frameRect(ids[2]); await h.click(r.cx, r.cy, { mods: ['shift'] });
  h.ok('Shift+click selects 3 objects', (await ed('ed.selection().length')) === 3);
  await h.shot('three-selected');

  // Align ▸ Align Left
  await menu('#rb-align', '#al-left');
  let fs = await Promise.all(ids.map(F));
  h.ok('Align ▸ Align Left lines up the left edges', new Set(fs.map((f) => Math.round(f.x * 10))).size === 1, { xs: fs.map((f) => f.x) });
  await h.clickSel('#undo'); await h.wait(400);
  fs = await Promise.all(ids.map(F));
  h.ok('Undo puts them back', new Set(fs.map((f) => Math.round(f.x))).size === 3);
  h.ok('…and keeps all 3 selected', (await ed('ed.selection().length')) === 3);

  // Align Top, Distribute Horizontally
  await menu('#rb-align', '#al-top');
  fs = await Promise.all(ids.map(F));
  h.ok('Align ▸ Align Top', new Set(fs.map((f) => Math.round(f.y * 10))).size === 1);
  await menu('#rb-align', '#dist-h');
  fs = (await Promise.all(ids.map(F))).sort((a, b) => a.x - b.x);
  const gaps = [fs[1].x - (fs[0].x + fs[0].w), fs[2].x - (fs[1].x + fs[1].w)];
  h.ok('Align ▸ Distribute Horizontally evens the gaps', Math.abs(gaps[0] - gaps[1]) < 0.5, { gaps });
  await h.shot('aligned-distributed');

  // arrows move all of them
  const before = await Promise.all(ids.map(F));
  await h.key('Right'); await h.key('Right');
  const after = await Promise.all(ids.map(F));
  h.ok('arrow keys move every selected object', after.every((f, i) => Math.abs(f.x - before[i].x - 2) < 0.01));

  // Group / Ungroup
  await h.clickSel('#rb-group');
  const gid = await ed('ed.sel && ed.sel.id');
  h.ok('Group makes one object', (await F(gid)).kind === 'group' && (await F(gid)).children.length === 3);
  const g = await frameRect(gid);
  await h.drag(g.cx, g.cy, g.cx + 20, g.cy + 20, { mods: ['alt'] });
  h.ok('…a group drags as one', (await F(gid)).x > before[0].x);
  await h.clickSel('#rb-ungroup');
  h.ok('Ungroup gives the 3 back', (await ed(`ed.pageEntry(${P}).frames.filter((f) => ${JSON.stringify(ids)}.includes(f.id)).length`)) === 3);

  // Rotate / Flip on one shape
  r = await frameRect(ids[0]); await h.click(r.cx, r.cy);
  await menu('#rb-rotate', '#rot-right');
  h.ok('Rotate ▸ Rotate Right 90°', (await F(ids[0])).rotation === 90);
  await menu('#rb-rotate', '#flip-h');
  h.ok('Rotate ▸ Flip Horizontal', !!(await F(ids[0])).flipH);

  // Bring to Front / Send to Back
  const zMax = async () => ed(`Math.max(...ed.pageEntry(${P}).frames.map((f) => f.z || 0))`);
  await h.clickSel('#back');
  h.ok('Send Backward puts it behind everything', (await F(ids[0])).z <= (await ed(`Math.min(...ed.pageEntry(${P}).frames.map((f) => f.z || 0))`)));
  await h.clickSel('#front');
  h.ok('Bring Forward puts it in front', (await F(ids[0])).z === await zMax());

  // Size boxes on the Shape Format tab
  await h.clickSel('.rb-tab[data-tab="format"]');
  h.ok('Shape Format tab shown', (await h.js(`document.querySelector('.rb-tab[data-tab="format"]').textContent`)) === 'Shape Format');
  const fw = await h.rect('#fw');
  await h.click(fw.cx, fw.cy);
  await h.key('A', ['control']);
  await h.type('3');
  await h.key('Enter');
  await h.wait(400);
  h.ok('Shape Format ▸ Width 3" resizes the shape', Math.abs((await F(ids[0])).w - 216) < 0.5, { w: (await F(ids[0])).w });

  // Wrap Text on a picture of page 12
  await h.clickSel('.rb-tab[data-tab="home"]');
  await h.clickSel('#nav-pages .nav-page[data-page="12"]');
  await h.wait(700);
  const pic = await h.js(`(() => { const ed = window.__bbEditor; const fs = ed.pageEntry(12).frames.filter((f) => f.kind === 'image'); fs.sort((a, b) => b.w * b.h - a.w * a.h); return fs[0].id; })()`);
  const pr = await h.rect(`.page-shell[data-page="12"] .frame[data-id="${pic}"]`);
  await h.click(pr.cx, pr.cy);
  await menu('#rb-wrap', '#wrap-none');
  h.ok('Wrap Text ▸ None', !(await ed(`ed.topFrame(12, '${pic}').wrap`)));
  await menu('#rb-wrap', '#wrap-square');
  h.ok('Wrap Text ▸ Square', (await ed(`(ed.topFrame(12, '${pic}').wrap || {}).type`)) === 'square');
  await h.shot('wrap-square');

  // Delete removes the shapes
  await h.clickSel(`#nav-pages .nav-page[data-page="${P}"]`);
  await h.wait(600);
  r = await frameRect(ids[1]); await h.click(r.cx, r.cy);
  await h.key('Delete');
  h.ok('Delete key removes the selected shape', !(await ed(`!!ed.topFrame(${P}, '${ids[1]}')`)));
};
