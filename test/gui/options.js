// GUI suite: Page Design ▸ Options (baseline spacing, autosave, opening view) + View ▸ Show ▸ Baselines,
// Table Design ▸ Table Styles, and File ▸ New ▸ Blank 8.5 x 11" (a new empty document that opens and
// can be edited).
const fs = require('fs');
const path = require('path');
const P = 14;

exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  const blStyle = () => h.js(`getComputedStyle(document.querySelector('.page-shell[data-page="${P}"] .page .baseline-guide')).display`);

  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "announcements"');
  await h.clickSel(`#nav-pages .nav-page[data-page="${P}"]`);
  await h.wait(600);

  // ---- View ▸ Show ▸ Baselines
  await h.clickSel('.rb-tab[data-tab="view"]');
  h.ok('Baselines is off to begin with, and drawn on no page', !(await h.js(`document.getElementById('show-baselines').checked`)) && (await blStyle()) === 'none');
  await h.clickSel('#show-baselines');
  await h.wait(300);
  h.ok('ticked: baseline guides show on the pages', (await blStyle()) === 'block' && (await h.js(`document.body.classList.contains('show-baselines')`)));
  h.ok('…starting at the top margin, every 12 pt by default', (await h.js(`document.querySelector('.page-shell[data-page="${P}"] .page .baseline-guide').style.top`)) === '36pt' && (await h.js(`getComputedStyle(document.documentElement).getPropertyValue('--bl-spacing').trim()`)) === '12pt');
  await h.shot('baselines');

  // ---- Page Design ▸ Options: spacing 24 pt, autosave 5 min
  await h.clickSel('.rb-tab[data-tab="design"]');
  h.ok('Page Design ▸ Options is enabled', !(await h.disabled('#pg-options')));
  await h.clickSel('#pg-options');
  h.ok('Options opens', await h.until(`!!document.querySelector('dialog.pub-dialog[open] input[name="baselineSpacing"]')`, 2000));
  await h.js(`(() => { const d = document.querySelector('dialog.pub-dialog[open]'); d.querySelector('input[name="baselineSpacing"]').value = '24'; d.querySelector('input[name="autosaveMinutes"]').value = '5'; })()`);
  await h.clickSel('dialog .pd-ok');
  await h.wait(400);
  h.ok('the baseline spacing changes at once', (await h.js(`getComputedStyle(document.documentElement).getPropertyValue('--bl-spacing').trim()`)) === '24pt');
  h.ok('…autosave follows the option', (await ed('ed.autosaveMinutes')) === 5);
  h.ok('…and it is kept on this PC', JSON.parse(await h.js(`localStorage.getItem('bb.options')`)).baselineSpacing === 24);
  await h.clickSel('.rb-tab[data-tab="view"]');
  await h.clickSel('#show-baselines');
  await h.wait(300);
  h.ok('unticked: the guides go away', (await blStyle()) === 'none');
  await h.js(`localStorage.removeItem('bb.options'); localStorage.removeItem('bb.baselines');`);

  // ---- Table Styles
  await h.clickSel('.rb-tab[data-tab="insert"]');
  await h.clickSel('#ins-table');
  await h.until(`!!document.querySelector('dialog.pub-dialog[open] input[name="rows"]')`, 2000);
  await h.clickSel('dialog .pd-ok');
  await h.wait(600);
  const tbl = await ed('ed.sel && ed.sel.id');
  const T = () => ed(`JSON.parse(JSON.stringify(ed.topFrame(${P}, ${JSON.stringify(tbl)})))`);
  const r = await h.rect(`.page-shell[data-page="${P}"] .frame[data-id="${tbl}"] td[data-row="0"][data-col="0"]`);
  await h.click(r.x + 8, r.y + 8);
  await h.type('Day');
  await h.clickSel('.rb-tab[data-tab="format"]');
  h.ok('Table Styles is enabled in a table', !(await h.disabled('#tb-styles')));
  await h.clickSel('#tb-styles');
  await h.clickSel('#ts-header');
  await h.wait(500);
  let t = await T();
  h.ok('Header Row: first row shaded + bold, grid lines on', t.cells[0].every((c) => c.fill === '#D9E2F3') && t.cells[1].every((c) => !c.fill) && t.border && t.cells[0][0].paragraphs[0].runs[0].bold === true && t.tableStyle === 'header', { f: t.cells[0].map((c) => c.fill), b: t.border });
  h.ok('…drawn shaded', /217, 226, 243/.test(await h.js(`getComputedStyle(document.querySelector('.page-shell[data-page="${P}"] .frame[data-id="${tbl}"] td[data-row="0"][data-col="1"]')).backgroundColor`)));
  await h.shot('table-header-style');
  await h.clickSel('.rb-tab[data-tab="format"]');
  await h.clickSel('#tb-styles');
  await h.clickSel('#ts-banded');
  await h.wait(500);
  t = await T();
  h.ok('Banded Rows: the second row shaded, the first and third not', t.cells[1].every((c) => c.fill === '#F2F2F2') && t.cells[0].every((c) => !c.fill) && t.cells[2].every((c) => !c.fill));
  await h.clickSel('.rb-tab[data-tab="format"]');
  await h.clickSel('#tb-styles');
  await h.clickSel('#ts-plain');
  await h.wait(500);
  t = await T();
  h.ok('No Lines, No Shading: borders off, no fills, header bold off', t.border === null && t.cells.every((row) => row.every((c) => !c.fill)) && !t.cells[0][0].paragraphs[0].runs[0].bold);
  await h.clickSel('#undo');
  await h.wait(400);
  h.ok('Undo brings the banding back', (await T()).cells[1][0].fill === '#F2F2F2');
  await h.key('Escape', [], 300);

  // ---- File ▸ New ▸ Blank 8.5 x 11"
  const root = path.dirname(path.dirname(h.weekCopy));
  global.__bbTestNewBlank = path.join(root, 'Blank flyer');
  await h.clickSel('.rb-tab[data-tab="file"]');
  await h.until(`!!document.querySelector('.bs-item[data-pane="new"]')`, 2000);
  await h.clickSel('.bs-item[data-pane="new"]');
  h.ok('File ▸ New has the blank tiles enabled', await h.until(`(() => { const b = document.getElementById('bs-blank-letter'); return !!b && !b.disabled; })()`, 2000));
  await h.clickSel('#bs-blank-letter');
  h.ok('a New Blank Document dialog asks for name, size and pages', await h.until(`!!document.querySelector('dialog.pub-dialog[open] #nb-preset')`, 2000));
  h.ok('…preset letter sheet, 1 page', (await h.js(`document.querySelector('#nb-preset').value`)) === 'letter-sheet' && (await h.js(`document.querySelector('#nb-pages').value`)) === '1');
  await h.clickSel('dialog .pd-ok');
  h.ok('the new document opens', await h.until(`window.__bbWeek() && window.__bbWeek().manifest.title === 'Blank flyer'`, 8000));
  await h.wait(800);
  const m = await h.js(`JSON.parse(JSON.stringify(window.__bbWeek().manifest))`);
  h.ok('…one letter page, belonging to announcements, 0.5" margins', m.pages.length === 1 && m.pages[0].half === 'announcements' && m.page.width === 612 && m.page.height === 792 && m.margins.top === 36 && m.preset === 'letter-sheet', { m: { pages: m.pages, page: m.page } });
  h.ok('…its folder has the manifest, both halves and an assets folder', ['Blank flyer.bulletin', 'announcements.json', 'worship.json', 'assets'].every((f) => fs.existsSync(path.join(global.__bbTestNewBlank, f))));
  h.ok('…drawn at letter size', Math.abs((await h.rect('.page-shell[data-page="1"] .page')).w / (await h.rect('.page-shell[data-page="1"] .page')).h - 612 / 792) < 0.01);
  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "announcements"');
  await h.clickSel('.rb-tab[data-tab="insert"]');
  await h.clickSel('#ins-text');
  await h.wait(500);
  await h.type('Hello');
  await h.key('Escape', [], 400);
  h.ok('a text box can be put on the blank page and typed in', (await h.js(`(window.__bbWeek().halves.announcements.pages['1'].frames || []).some((f) => f.kind === 'text' && f.text.paragraphs[0].runs.some((r) => r.text === 'Hello'))`)));
  await h.clickSel('#save');
  await h.until('window.__bbEditor.dirty === false', 4000);
  h.ok('…and saved to the new folder', JSON.parse(fs.readFileSync(path.join(global.__bbTestNewBlank, 'announcements.json'), 'utf8')).pages['1'].frames.length === 1);
  await h.shot('blank-letter');
  delete global.__bbTestNewBlank;
};
