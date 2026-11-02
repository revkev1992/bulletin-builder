// GUI suite: Insert ▸ Shapes (oval, rounded rectangle, triangle, right arrow, diamond, line with
// arrow) and Shape Format ▸ Shape Styles (fill, outline colour, weight, no fill / no outline, arrows).
const P = 14;

exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  const F = (id) => ed(`JSON.parse(JSON.stringify(ed.topFrame(${P}, '${id}')))`);
  const svgOf = (id) => h.js(`(() => { const e = document.querySelector('.page-shell[data-page="${P}"] .frame[data-id="${id}"] svg > *:last-child'); return e ? { tag: e.tagName, fill: e.getAttribute('fill'), stroke: e.getAttribute('stroke'), sw: e.getAttribute('stroke-width'), kids: e.children.length } : null; })()`);
  const menu = async (opener, item) => { await h.clickSel(opener); await h.clickSel(item); await h.wait(350); };

  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "announcements"');
  await h.clickSel(`#nav-pages .nav-page[data-page="${P}"]`);
  await h.wait(700);
  await h.clickSel('.rb-tab[data-tab="insert"]');

  const made = {};
  for (const [item, type, tag] of [['#ins-oval', 'ellipse', 'ellipse'], ['#ins-roundrect', 'roundRect', 'rect'], ['#ins-triangle', 'triangle', 'polygon'], ['#ins-arrow', 'arrow', 'polygon'], ['#ins-diamond', 'diamond', 'polygon']]) {
    await h.clickSel('.rb-tab[data-tab="insert"]');
    await menu('#rb-shapes', item);
    const id = await ed('ed.sel && ed.sel.id');
    made[type] = id;
    const f = await F(id);
    const s = await svgOf(id);
    h.ok('Shapes ▸ ' + type + ': a filled, outlined shape drawn as SVG', f && f.kind === 'shape' && f.shape.type === type && f.fill && s && s.tag === tag && s.fill === f.fill.color && s.stroke === f.stroke.color, { f: f && f.shape, s });
    const r = await h.rect(`.page-shell[data-page="${P}"] .frame[data-id="${id}"]`);
    const k = Object.keys(made).length - 1;   // a 3 × 2 grid so none of them overlaps
    await h.drag(r.cx, r.cy, r.cx - 100 + (k % 3) * 100, r.cy - 160 + Math.floor(k / 3) * 110, { mods: ['alt'] });
  }
  h.ok('five different shapes on the page', new Set(Object.values(made)).size === 5);
  await h.shot('shapes');

  // Shape Format on the oval: fill, outline colour, weight
  const oval = made.ellipse;
  let r = await h.rect(`.page-shell[data-page="${P}"] .frame[data-id="${oval}"]`);
  await h.click(r.cx, r.cy);
  h.ok('clicking a shape shows the Shape Format tab', !(await h.js(`document.querySelector('.rb-tab[data-tab="format"]').hidden`)));
  await h.clickSel('.rb-tab[data-tab="format"]');
  h.ok('Shape Styles: Shape Fill / Shape Outline enabled', !(await h.disabled('#sf-btn')) && !(await h.disabled('#so-btn')));
  await menu('#sf-btn', '.sf-swatch[data-color="#FFC000"]');
  let f = await F(oval), s = await svgOf(oval);
  h.ok('Shape Fill ▸ a swatch: the oval is filled with it', f.fill.color === '#FFC000' && s.fill === '#FFC000', { fill: f.fill, s });
  await menu('#so-btn', '.so-swatch[data-color="#C00000"]');
  f = await F(oval); s = await svgOf(oval);
  h.ok('Shape Outline ▸ a swatch: the outline takes it', f.stroke.color === '#C00000' && s.stroke === '#C00000', { stroke: f.stroke });
  await menu('#so-btn', '.so-weight[data-weight="3"]');
  f = await F(oval); s = await svgOf(oval);
  h.ok('Shape Outline ▸ Weight 3 pt', f.stroke.width === 3 && s.sw === '3', { stroke: f.stroke });
  await h.shot('oval-styled');
  await menu('#sf-btn', '#sf-none');
  f = await F(oval); s = await svgOf(oval);
  h.ok('No Fill: see-through', !f.fill && s.fill === 'none');
  await menu('#so-btn', '#so-none');
  f = await F(oval); s = await svgOf(oval);
  h.ok('No Outline: no stroke', f.stroke === null && s.stroke === 'none');
  await h.clickSel('#undo'); await h.wait(300);
  await h.clickSel('#undo'); await h.wait(300);
  f = await F(oval);
  h.ok('Undo twice: fill and outline back', f.fill && f.fill.color === '#FFC000' && f.stroke && f.stroke.color === '#C00000');

  // a text box takes a fill and an outline too (Publisher's Format Text Box)
  await h.clickSel('.rb-tab[data-tab="insert"]');
  await h.clickSel('#ins-text');
  await h.wait(400);
  await h.key('Escape', [], 400);
  const tb = await ed('ed.sel && ed.sel.id');
  await h.clickSel('.rb-tab[data-tab="format"]');
  await menu('#sf-btn', '.sf-swatch[data-color="#FFF2CC"]');
  await menu('#so-btn', '.so-swatch[data-color="#2F6DB5"]');
  f = await F(tb);
  const tbEl = await h.js(`(() => { const e = document.querySelector('.page-shell[data-page="${P}"] .frame[data-id="${tb}"]'); const cs = getComputedStyle(e); return { bg: cs.backgroundColor, border: cs.borderTopColor }; })()`);
  h.ok('a text box: Shape Fill colours its background, Shape Outline its border', f.kind === 'text' && f.fill && f.fill.color === '#FFF2CC' && f.stroke && f.stroke.color === '#2F6DB5' && /255, 242, 204/.test(tbEl.bg) && /47, 109, 181/.test(tbEl.border), { f: { fill: f.fill, stroke: f.stroke }, tbEl });

  // a line with an arrowhead, then both ends
  await h.clickSel('.rb-tab[data-tab="insert"]');
  await menu('#rb-shapes', '#ins-arrowline');
  const ln = await ed('ed.sel && ed.sel.id');
  f = await F(ln);
  const heads = () => h.js(`document.querySelectorAll('.page-shell[data-page="${P}"] .frame[data-id="${ln}"] svg polygon').length`);
  h.ok('Shapes ▸ Line with Arrow: a line with one arrowhead', f.shape.type === 'line' && f.shape.arrows === 'end' && (await heads()) === 1, { shape: f.shape, heads: await heads() });
  await h.clickSel('.rb-tab[data-tab="format"]');
  h.ok('the arrow choices show for a line only', !(await h.js(`document.getElementById('so-arrows-both').hidden`)));
  await menu('#so-btn', '#so-arrows-both');
  h.ok('Arrows at both ends', (await F(ln)).shape.arrows === 'both' && (await heads()) === 2);
  await menu('#so-btn', '#so-arrows-none');
  h.ok('Arrows: none — a plain line again', !(await F(ln)).shape.arrows && (await heads()) === 0);
  await h.shot('line-arrows');
  r = await h.rect(`.page-shell[data-page="${P}"] .frame[data-id="${made.triangle}"]`);
  await h.click(r.cx, r.cy);
  h.ok('…and are hidden for other shapes', await h.js(`document.getElementById('so-arrows-both').hidden`));
};
