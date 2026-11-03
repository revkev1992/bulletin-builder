// GUI suite: Page Design ▸ Color Schemes / Fonts (Publisher's schemes) — the eight scheme colours sit first
// in every colour picker, a chosen scheme is written to the manifest (whole week) and survives reopening,
// a font scheme leads the Font box and is used for new text boxes and tables.
const fs = require('fs');
const P = 12;

exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  const manifest = () => JSON.parse(fs.readFileSync(h.weekCopy, 'utf8'));
  const slot0 = (sel) => h.js(`(() => { const b = document.querySelector('${sel}'); return b && b.dataset.color; })()`);

  await h.clickSel('.rb-tab[data-tab="design"]');
  for (const id of ['#pg-colorschemes', '#pg-fonts']) h.ok('view only: ' + id.slice(1) + ' greyed', await h.disabled(id));
  // the imported Publisher scheme (Office 2007-2010) already feeds the pickers
  h.ok('the colour pickers start with the week\'s scheme row (Publisher\'s imported Office: accent 1 = #1F497D)', (await slot0('.rb-menu[data-menu-name="color"] .scheme-swatch[data-slot="1"]')) === '#1F497D');
  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "announcements"');
  await h.clickSel(`#nav-pages .nav-page[data-page="${P}"]`);
  await h.wait(600);

  // ---- Color Schemes ▸ Advent
  await h.clickSel('.rb-tab[data-tab="design"]');
  await h.clickSel('#pg-colorschemes');
  h.ok('Color Schemes opens a gallery with the seasons and Publisher\'s classics', !!(await h.rect('.rb-menu[data-menu-name="colorschemes"]:not([hidden]) .cs-item[data-scheme="advent"]')) && (await h.js(`document.querySelectorAll('.cs-item').length`)) >= 20);
  await h.shot('color-schemes');
  await h.clickSel('.cs-item[data-scheme="advent"]');
  await h.wait(500);
  h.ok('Advent is written to the manifest (name + 8 colours)', manifest().colorScheme.name === 'Advent' && manifest().colorScheme.colors.length === 8 && manifest().colorScheme.colors[1] === '#4B2C7F', { cs: manifest().colorScheme });
  h.ok('…and every picker\'s scheme row now shows it (font colour, shape fill, shape outline, table fill, background)',
    (await Promise.all(['color', 'shapefill', 'shapeoutline', 'tablefill', 'background'].map((m) => slot0('.rb-menu[data-menu-name="' + m + '"] .scheme-swatch[data-slot="1"]')))).every((c) => c === '#4B2C7F' || c === null) &&
    (await slot0('.rb-menu[data-menu-name="color"] .scheme-swatch[data-slot="1"]')) === '#4B2C7F' && (await slot0('.rb-menu[data-menu-name="background"] .scheme-swatch[data-slot="1"]')) === '#4B2C7F');
  // a scheme colour applied to text
  const w = await h.js(`(() => { const box = document.querySelector('.page-shell[data-page="${P}"] .frame-text[data-id="f459"]'); const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let t; (t = tw.nextNode());) { const i = t.data.indexOf('budget'); if (i >= 0) { const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 6); const b = r.getBoundingClientRect(); return { x0: b.left + 0.5, x1: b.right - 0.5, y: b.top + b.height / 2 }; } } return null; })()`);
  await h.click(w.x0 + 2, w.y);
  await h.drag(w.x0, w.y, w.x1, w.y, { steps: 5 });
  await h.clickSel('.rb-tab[data-tab="home"]');
  await h.clickSel('#t-color');
  await h.clickSel('.rb-menu[data-menu-name="color"] .scheme-swatch[data-slot="1"]');
  await h.wait(300);
  await h.key('Escape', [], 500);
  h.ok('a scheme colour from the picker lands on the text as plain hex', await h.js(`(() => { const f = window.__bbWeek().halves.announcements.pages['${P}'].frames.find((x) => x.id === 'f459'); return f.text.paragraphs.some((p) => p.runs.some((r) => r.text === 'budget' && r.color === '#4B2C7F')); })()`));
  await h.shot('advent-colour-on-text');

  // ---- Fonts ▸ Candara: the Font box lists it first; a new text box and a new table use the body font
  await h.clickSel('.rb-tab[data-tab="design"]');
  await h.clickSel('#pg-fonts');
  h.ok('Fonts opens a gallery of font pairs', !!(await h.rect('.rb-menu[data-menu-name="fontschemes"]:not([hidden]) .fs-item[data-scheme="candara"]')));
  await h.clickSel('.fs-item[data-scheme="candara"]');
  await h.wait(500);
  h.ok('the font scheme is in the manifest', manifest().fontScheme && manifest().fontScheme.body === 'Candara Light' && manifest().fontScheme.heading === 'Candara', { fs: manifest().fontScheme });
  h.ok('the Font box leads with the scheme fonts', (await h.js(`(() => { const g = document.querySelector('#t-font optgroup[data-scheme]'); return g && g.label === 'Scheme fonts' && [...g.querySelectorAll('option')].map((o) => o.value).join('|'); })()`)) === 'Candara|Candara Light');
  await h.clickSel('.rb-tab[data-tab="insert"]');
  await h.clickSel('#ins-text');
  await h.wait(400);
  await h.key('Escape', [], 400);
  const tid = await ed('ed.sel && ed.sel.id');
  h.ok('a new text box uses the scheme\'s body font', (await h.js(`(() => { const f = window.__bbEditor.frame(); return f && f.text.paragraphs[0].runs[0].font; })()`)) === 'Candara Light', { tid });
  await h.clickSel('.rb-tab[data-tab="insert"]');     // typing in the new box had switched the ribbon to Home
  await h.clickSel('#ins-table');
  await h.until(`!!document.querySelector('dialog.pub-dialog[open] input[name="rows"]')`, 2000);
  await h.clickSel('dialog .pd-ok');
  await h.wait(500);
  h.ok('a new table uses it too', (await h.js(`(() => { const f = window.__bbEditor.frame(); return f && f.kind === 'table' && f.cells[0][0].paragraphs[0].mark.font; })()`)) === 'Candara Light');

  // ---- survives reopening (it is in the manifest, not in memory)
  await h.clickSel('#save');
  await h.until('window.__bbEditor.dirty === false', 4000);
  await h.js(`window.__bbSetMode('')`);
  await h.wait(500);
  h.wc.send('week:open', h.weekCopy);          // reopen from disk, as a fresh start would
  await h.wait(2500);
  await h.until(`!!window.__bbWeek() && !!document.querySelector('.scheme-swatch')`, 8000);
  h.ok('after reopening, the pickers still show Advent and the Font box Candara', (await slot0('.rb-menu[data-menu-name="color"] .scheme-swatch[data-slot="1"]')) === '#4B2C7F' && (await h.js(`(() => { const g = document.querySelector('#t-font optgroup[data-scheme]'); return g && g.querySelector('option').value; })()`)) === 'Candara');
};
