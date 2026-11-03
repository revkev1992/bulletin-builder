// GUI suite: Insert ▸ WordArt — the dialog, a stretched SVG text in a shape box, Shape Format fill/outline on
// it, double-click to change the words and style (arched), resize stretches the words, saved in the half.
const fs = require('fs');
const path = require('path');
const P = 14;

exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  const F = () => ed('ed.frame() && JSON.parse(JSON.stringify(ed.frame()))');
  const svgText = (id) => h.js(`(() => { const t = [...document.querySelectorAll('.page-shell[data-page="${P}"] .frame[data-id="${id}"] svg text')].pop(); /* the last one: the shadow copy comes first */ return t ? { text: t.textContent, fill: t.getAttribute('fill'), stroke: t.getAttribute('stroke'), tl: t.getAttribute('textLength'), path: !!t.querySelector('textPath') } : null; })()`);

  await h.clickSel('.rb-tab[data-tab="insert"]');
  h.ok('view only: WordArt greyed', await h.disabled('#ins-wordart'));
  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "announcements"');
  await h.clickSel(`#nav-pages .nav-page[data-page="${P}"]`);
  await h.wait(600);

  await h.clickSel('.rb-tab[data-tab="insert"]');
  await h.clickSel('#ins-wordart');
  h.ok('WordArt opens its dialog with the text selected', await h.until(`!!document.querySelector('dialog.pub-dialog[open] input[name="text"]')`, 2000));
  await h.type('Fall Festival');
  await h.clickSel('dialog input[name="style"][value="slant"]');
  await h.clickSel('dialog input[name="shadow"]');
  await h.clickSel('dialog .pd-ok');
  await h.wait(600);
  let f = await F();
  h.ok('a WordArt shape is placed and selected: slanted, bold, with a shadow', f && f.kind === 'shape' && f.shape.type === 'wordart' && f.shape.text === 'Fall Festival' && f.shape.style === 'slant' && f.shape.bold === true && !!f.shape.shadow && f.fill && f.stroke, { shape: f && f.shape });
  const id = f.id;
  let t = await svgText(id);
  h.ok('…drawn as SVG text stretched to the box, filled and outlined', t && t.text === 'Fall Festival' && t.fill === f.fill.color && t.stroke === f.stroke.color && Number(t.tl) > 200, { t });
  h.ok('Shape Format tab shows for it', (await h.js(`document.querySelector('.rb-tab[data-tab="format"]').textContent`)) === 'Shape Format');
  await h.shot('wordart');

  // Shape Format ▸ Shape Fill: a scheme colour; Shape Outline ▸ No Outline
  await h.clickSel('.rb-tab[data-tab="format"]');
  await h.clickSel('#sf-btn');
  await h.clickSel('.rb-menu[data-menu-name="shapefill"] .sf-swatch[data-color="#C00000"]');
  await h.wait(400);
  await h.clickSel('#so-btn');
  await h.clickSel('#so-none');
  await h.wait(400);
  f = await F(); t = await svgText(id);
  h.ok('Shape Fill / No Outline apply to the WordArt', f.fill.color === '#C00000' && f.stroke === null && t.fill === '#C00000' && !t.stroke, { fill: f.fill, stroke: f.stroke, t });

  // resize from the right handle: the words follow the box
  const hd = await h.rect(`.page-shell[data-page="${P}"] .sel-box .handle.h-e`);
  await h.drag(hd.cx, hd.cy, hd.cx + 80, hd.cy, { mods: ['alt'] });
  await h.wait(400);
  const t2 = await svgText(id);
  h.ok('widening the box stretches the words', Number(t2.tl) > Number(t.tl) + 40, { before: t.tl, after: t2.tl });

  // double-click: Edit WordArt (prefilled) → arched + new words
  const r = await h.rect(`.page-shell[data-page="${P}"] .frame[data-id="${id}"]`);
  await h.dblclick(r.cx, r.cy);
  h.ok('double-click opens Edit WordArt with the words filled in', await h.until(`!!document.querySelector('dialog.pub-dialog[open] input[name="text"]')`, 2000) && (await h.js(`document.querySelector('dialog input[name="text"]').value`)) === 'Fall Festival');
  await h.js(`document.querySelector('dialog input[name="text"]').value = 'Trunk or Treat'`);
  await h.clickSel('dialog input[name="style"][value="arch"]');
  await h.clickSel('dialog .pd-ok');
  await h.wait(600);
  f = await F(); t = await svgText(id);
  h.ok('the words and the style changed in place (arched = text on a path)', f.shape.text === 'Trunk or Treat' && f.shape.style === 'arch' && t && t.path && /Trunk or Treat/.test(t.text), { shape: f.shape, t });
  await h.shot('wordart-arched');
  await h.clickSel('#undo');
  await h.wait(400);
  h.ok('Undo takes the edit back', (await F()).shape.text === 'Fall Festival');

  await h.clickSel('#save');
  await h.until('window.__bbEditor.dirty === false', 4000);
  const saved = JSON.parse(fs.readFileSync(path.join(path.dirname(h.weekCopy), 'announcements.json'), 'utf8'));
  h.ok('saved in announcements.json as a shape of type wordart', saved.pages[String(P)].frames.some((x) => x.kind === 'shape' && x.shape && x.shape.type === 'wordart' && x.shape.text === 'Fall Festival'));
};
