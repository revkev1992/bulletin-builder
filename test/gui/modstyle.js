// GUI suite: Home ▸ Styles ▸ right-click a style ▸ Modify… / Update to Match Selection / Delete
// (Publisher). A style change restyles every paragraph in the half that uses it; one undo step.
const fs = require('fs');
const P = 12;
const BOX = `.page-shell[data-page="${P}"] .frame-text[data-id="f459"]`;

exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  const at = (w) => h.js(`(() => { const box = document.querySelector('${BOX}'); const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let t; (t = tw.nextNode());) { const i = t.data.indexOf(${JSON.stringify(w)}); if (i >= 0) { const r = document.createRange(); r.setStart(t, i + 1); r.setEnd(t, i + 2);
      const b = r.getBoundingClientRect(); return { x: b.left, y: b.top + b.height / 2 }; } } return null; })()`);
  // the saved model of box f459: a paragraph's runs by its first words
  const paraOf = (start) => ed(`(() => { const f = ed.anyFrame(${P}, 'f459'); const q = f.text.paragraphs.find((x) => x.runs.map((r) => r.text).join('').startsWith(${JSON.stringify(start)}));
    return q ? { style: q.style, runs: q.runs.map((r) => ({ font: r.font, size: r.size, bold: !!r.bold, italic: !!r.italic })) } : null; })()`);
  // how many Normal paragraphs in the whole announcements half are italic 12 pt (the restyle reaches every page)
  const countNormal = () => ed(`(() => { let all = 0, hit = 0; const walk = (f) => { if (f.text) for (const p of f.text.paragraphs) if (p.style === 'Normal' && p.runs.length) { all++; if (p.runs.every((r) => r.italic && r.size === 12)) hit++; } (f.children || []).forEach(walk); };
    for (const pg of Object.values(ed.week().halves.announcements.pages)) pg.frames.forEach(walk); return { all, hit }; })()`);
  const stylesOnDisk = () => JSON.parse(fs.readFileSync(h.weekCopy, 'utf8')).styles;

  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "announcements"');
  await h.clickSel('.rb-tab[data-tab="home"]');
  await h.js(`document.querySelector('.page-shell[data-page="${P}"]').scrollIntoView({ block: 'center' })`);
  await h.wait(400);
  const w = await at('Looking');
  await h.click(w.x, w.y);
  const before = await countNormal();
  h.ok('the announcements half has many Normal paragraphs, none italic 12 pt yet', before.all > 50 && before.hit === 0, { before });

  // right-click Normal in the gallery ▸ Modify…: italic, 12 pt
  await h.clickSel('#rb-styles');
  h.ok('the gallery has a Modify button for the paragraph\'s own style', /Modify "Normal"/.test(await h.js(`document.getElementById('sg-modify').textContent`)));
  const item = await h.rect('.sg-menu .sg-item[data-style="Normal"]');
  await h.rightClick(item.cx, item.cy);
  const menu = await h.js(`(() => { const m = document.querySelector('.ctx-menu.ctx-style'); return m ? [...m.querySelectorAll('button')].map((b) => b.dataset.cmd) : null; })()`);
  h.ok('right-click a style: Update to Match Selection / Modify… / Delete…', menu && menu.join() === 'style-update,style-modify,style-delete', { menu });
  await h.shot('style-menu');
  await h.clickSel('.ctx-menu button[data-cmd="style-modify"]');
  h.ok('Modify… opens the Modify Style dialog', await h.until(`!!document.querySelector('dialog.pub-dialog[open] input[name="size"]')`, 2000));
  await h.shot('modify-dialog');
  const sz = await h.rect('dialog input[name="size"]');
  await h.click(sz.cx, sz.cy);
  await h.key('A', ['control']);
  await h.type('12');
  await h.clickSel('dialog input[name="italic"]');
  await h.clickSel('dialog .pd-ok');
  await h.wait(800);
  const after = await countNormal();
  // (the click into the box may add one empty-but-marked paragraph; the count is "all of them", not a fixed number)
  h.ok('every Normal paragraph in the half is now italic 12 pt', after.all >= before.all && after.hit === after.all, { after });
  const heading = await paraOf('Pastors');
  h.ok('a bold heading in a Normal paragraph stays bold (only what changed in the style is applied)', heading && heading.runs[0].bold && heading.runs[0].italic && heading.runs[0].size === 12, { heading });
  const disk = stylesOnDisk().find((s) => s.name === 'Normal');
  h.ok('the style definition is saved in the week file (italic 12)', disk && disk.run && disk.run.size === 12 && disk.run.italic === true, { disk });
  h.ok('…in the same place in the list (first)', stylesOnDisk()[0].name === 'Normal');
  await h.shot('modified');

  // Undo: paragraphs AND the style definition go back
  await h.clickSel('#undo');
  await h.wait(800);
  const undone = await countNormal();
  const diskU = stylesOnDisk().find((s) => s.name === 'Normal');
  h.ok('Undo puts every paragraph back', undone.hit === 0 && undone.all >= before.all, { undone });
  h.ok('…and the style definition (Calibri 10, Publisher\'s)', diskU && diskU.font && diskU.font.Size === 10, { diskU });
  await h.clickSel('#redo');
  await h.wait(800);
  const redone = await countNormal();
  h.ok('Redo does it again', redone.hit === redone.all && redone.all >= before.all, { redone });
  await h.clickSel('#undo');
  await h.wait(800);

  // Update to Match Selection: make "Looking…" 13 pt, then update Normal from it
  const w2 = await at('Looking');
  await h.click(w2.x, w2.y);
  await h.key('Home');
  await h.key('End', ['shift']);
  const szb = await h.rect('#t-size');
  await h.click(szb.cx, szb.cy);
  await h.key('A', ['control']);
  await h.type('13');
  await h.key('Enter');
  await h.wait(200);
  await h.clickSel('#rb-styles');
  const item2 = await h.rect('.sg-menu .sg-item[data-style="Normal"]');
  await h.rightClick(item2.cx, item2.cy);
  await h.clickSel('.ctx-menu button[data-cmd="style-update"]');
  await h.wait(800);
  const disk2 = stylesOnDisk().find((s) => s.name === 'Normal');
  h.ok('Update to Match Selection: Normal is now 13 pt Palatino in the week file', disk2 && disk2.run && disk2.run.size === 13 && /Palatino/.test(disk2.run.font), { disk2 });
  const other = await paraOf('All are invited');
  h.ok('…and another Normal paragraph took the 13 pt', other && other.runs.every((r) => r.size === 13), { other });

  // Delete: the paragraphs keep their look, lose the style name; the gallery no longer lists it
  const w3 = await at('Looking');
  await h.click(w3.x, w3.y);
  await h.clickSel('#rb-styles');
  const item3 = await h.rect('.sg-menu .sg-item[data-style="Normal"]');
  await h.rightClick(item3.cx, item3.cy);
  await h.clickSel('.ctx-menu button[data-cmd="style-delete"]');
  h.ok('Delete… asks first', await h.until(`!!document.querySelector('dialog.pub-dialog[open]')`, 2000));
  await h.clickSel('dialog .pd-ok');
  await h.wait(800);
  h.ok('the style is gone from the week file', !stylesOnDisk().some((s) => s.name === 'Normal'));
  const gone = await paraOf('All are invited');
  h.ok('paragraphs keep their look (13 pt) but have no style name', gone && !gone.style && gone.runs.every((r) => r.size === 13), { gone });
  await h.click(w3.x, w3.y);
  await h.clickSel('#rb-styles');
  h.ok('the gallery no longer lists Normal', !(await h.js(`!!document.querySelector('.sg-menu .sg-item[data-style="Normal"]')`)));
  await h.key('Escape', [], 300);
  await h.clickSel('#undo');
  await h.wait(800);
  h.ok('Undo brings the style back', stylesOnDisk().some((s) => s.name === 'Normal') && (await paraOf('All are invited')).style === 'Normal');

  // Import Styles… from another week (a copy of this one with an extra style and a changed Normal)
  const path = require('path');
  const otherWeek = path.join(h.tmp, 'other.bulletin');
  const m = JSON.parse(fs.readFileSync(h.weekCopy, 'utf8'));
  m.title = 'Other week';
  m.styles = [{ name: 'Normal', run: { font: 'Georgia', size: 10.5 }, para: { align: 'left' } }, { name: 'Imported Heading', run: { font: 'Georgia', size: 15, bold: true }, para: { align: 'center' } }];
  fs.writeFileSync(otherWeek, JSON.stringify(m));
  global.__bbTestImportFrom = otherWeek;
  await h.click(w3.x, w3.y);
  await h.clickSel('#rb-styles');
  await h.clickSel('#sg-import');
  h.ok('Import Styles… says what the other week has (1 new style)', await h.until(`!!document.querySelector('dialog.pub-dialog[open]')`, 3000) && /1 new style: Imported Heading/.test(await h.js(`document.querySelector('dialog .pd-body').textContent`)));
  await h.clickSel('dialog input[name="replace"]');
  await h.clickSel('dialog .pd-ok');
  await h.wait(900);
  h.ok('the new style is in this week, and Normal was replaced (Georgia 10.5)', stylesOnDisk().some((s) => s.name === 'Imported Heading') && /Georgia/.test((stylesOnDisk().find((s) => s.name === 'Normal') || { run: {} }).run.font || ''));
  const imp = await paraOf('All are invited');
  h.ok('…paragraphs using Normal took the replaced style', imp && imp.runs.every((r) => r.font === 'Georgia' && r.size === 10.5), { imp });
  delete global.__bbTestImportFrom;
};
