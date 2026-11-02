// GUI suite: Insert ▸ Building Blocks (Page Parts): keep selected objects as a named block in the shared
// library beside the weeks, see it in the pane, insert a copy on another page, rename, remove.
const fs = require('fs');
const path = require('path');
const P = 14;

exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  const lib = () => { const f = path.join(path.dirname(path.dirname(h.weekCopy)), 'Building Blocks', 'library.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
  const menu = async (opener, item) => { await h.clickSel(opener); await h.clickSel(item); await h.wait(350); };

  await h.clickSel('.rb-tab[data-tab="insert"]');
  h.ok('Page Parts can be browsed in view-only', !(await h.disabled('#ins-parts')));
  await h.clickSel('#ins-parts');
  h.ok('Insert ▸ Page Parts opens the Building Blocks pane, empty', await h.until(`!document.getElementById('blockspane').hidden`, 3000) && /Nothing saved/.test(await h.js(`document.querySelector('#blockspane .bk-list').textContent`)));
  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "announcements"');
  await h.clickSel(`#nav-pages .nav-page[data-page="${P}"]`);
  await h.wait(700);

  // a shape + a text box, moved together, selected together
  await h.clickSel('.rb-tab[data-tab="insert"]');
  await menu('#rb-shapes', '#ins-roundrect');
  const shape = await ed('ed.sel && ed.sel.id');
  let r = await h.rect(`.page-shell[data-page="${P}"] .frame[data-id="${shape}"]`);
  await h.drag(r.cx, r.cy, r.cx - 60, r.cy - 150, { mods: ['alt'] });
  await h.clickSel('.rb-tab[data-tab="insert"]');
  await h.clickSel('#ins-text');
  await h.wait(300);
  await h.type('Fall Festival');
  await h.key('Escape', [], 500);
  const tb = await ed('ed.sel && ed.sel.id');
  r = await h.rect(`.page-shell[data-page="${P}"] .frame[data-id="${tb}"]`);
  await h.drag(r.cx, r.cy, r.cx - 60, r.cy - 240, { mods: ['alt'] });   // above the shape, not on it
  r = await h.rect(`.page-shell[data-page="${P}"] .frame[data-id="${shape}"]`);
  await h.click(r.cx, r.cy, { mods: ['shift'] });
  h.ok('two objects selected', (await ed('ed.selection().length')) === 2);

  // Add selection to Building Blocks…
  await h.clickSel('#blockspane .bk-add');
  h.ok('Add selection… asks for a name and a category', await h.until(`!!document.querySelector('dialog.pub-dialog[open] input[name="name"]')`, 2000));
  await h.key('A', ['control']);
  await h.type('Boxed announcement');
  await h.clickSel('dialog .pd-ok');
  await h.wait(800);
  const L = lib();
  h.ok('the block is in the library beside the weeks: 2 objects, at 0,0', L && L.items.length === 1 && L.items[0].name === 'Boxed announcement' && L.items[0].frames.length === 2 && Math.min(...L.items[0].frames.map((f) => f.x)) === 0 && Math.min(...L.items[0].frames.map((f) => f.y)) === 0, { L: L && L.items[0] && { n: L.items[0].frames.length, w: L.items[0].w } });
  h.ok('…and shown in the pane with a thumbnail', (await h.js(`document.querySelectorAll('#blockspane .bk-item .bk-thumb .frame').length`)) === 2);
  await h.shot('blocks-pane');

  // insert it on page 15
  await h.clickSel(`#nav-pages .nav-page[data-page="15"]`);
  await h.wait(600);
  const n0 = await ed('ed.pageEntry(15).frames.length');
  await h.clickSel('#blockspane .bk-item');
  await h.clickSel('#blockspane .bk-insert');
  await h.until(`window.__bbEditor.pageEntry(15).frames.length === ${n0 + 2}`, 5000);
  const placed = await ed(`(() => { const fs = ed.pageEntry(15).frames.slice(-2); return { kinds: fs.map((f) => f.kind).sort().join(','), ids: fs.map((f) => f.id), text: JSON.stringify(fs).includes('Fall Festival'), sel: ed.selection().length }; })()`);
  h.ok('Insert puts a copy of both objects on page 15, selected, with new ids', placed.kinds === 'shape,text' && placed.text && placed.sel === 2 && !placed.ids.includes(shape) && !placed.ids.includes(tb), { placed });
  await h.shot('block-inserted');
  await h.clickSel('#undo');
  await h.wait(400);
  h.ok('Undo takes the copy off again', (await ed('ed.pageEntry(15).frames.length')) === n0);

  // rename, then remove
  await h.clickSel('#blockspane .bk-item');
  await h.clickSel('#blockspane .bk-rename');
  await h.until(`!!document.querySelector('dialog.pub-dialog[open] input[name="name"]')`, 2000);
  await h.key('A', ['control']);
  await h.type('Boxed notice');
  await h.js(`(() => { const s = document.querySelector('dialog select[name="category"]'); s.value = 'borders'; })()`);
  await h.clickSel('dialog .pd-ok');
  await h.wait(600);
  h.ok('Rename… changes the name and the category', lib().items[0].name === 'Boxed notice' && lib().items[0].category === 'borders' && (await h.js(`document.querySelector('#blockspane .bk-cats button.active').dataset.cat`)) === 'borders');
  await h.clickSel('#blockspane .bk-item');
  await h.clickSel('#blockspane .bk-remove');
  await h.until(`!!document.querySelector('dialog.pub-dialog[open]')`, 2000);
  await h.clickSel('dialog .pd-ok');
  await h.wait(600);
  h.ok('Remove takes it out of the library', lib().items.length === 0);
  // the ribbon's other entries open the pane on their category
  await h.clickSel('.rb-tab[data-tab="insert"]');
  await h.clickSel('#ins-calendars');
  await h.wait(300);
  h.ok('Calendars opens the pane on Calendars', (await h.js(`document.querySelector('#blockspane .bk-cats button.active').dataset.cat`)) === 'calendars');
};
