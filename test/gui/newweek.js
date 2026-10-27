// GUI suite: File/Bulletin ▸ New Week chooser (Kevin 2026-10-27): the three most recent weeks + an older
// one, a suggested name, and — for a finished week — finished pages or draft. Runs in a sandbox
// "weeks" folder made from copies of the real October weeks; native dialogs are not used.
const fs = require('fs');
const path = require('path');

exports.run = async (h) => {
  const real = 'C:/Users/kevqu/OneDrive/Documents/Liturgical Resources/Claude/bulletin-builder/weeks';
  const box = path.join(h.tmp, 'weeks');
  fs.mkdirSync(box, { recursive: true });
  const copyWeek = (from, to) => {
    const dst = path.join(box, to);
    fs.cpSync(path.join(real, from), dst, { recursive: true, filter: (p) => !/[\\/](history|locks)$/.test(p) });
    fs.renameSync(path.join(dst, from + '.bulletin'), path.join(dst, to + '.bulletin'));
    const m = JSON.parse(fs.readFileSync(path.join(dst, to + '.bulletin'), 'utf8')); m.title = to;
    fs.writeFileSync(path.join(dst, to + '.bulletin'), JSON.stringify(m));
    return path.join(dst, to + '.bulletin');
  };
  copyWeek('9-20-26 1100', '9-20-26 1100');
  copyWeek('10-11-26 1100', '10-4-26 1100');
  const w11 = copyWeek('10-11-26 1100', '10-11-26 1100');
  copyWeek('10-11-26 1100', '10-18-26 1100');
  // open 10-11 in the window, finish its layout, save → a finished week
  h.wc.send('week:open', w11);
  await h.until(`window.__bbWeek() && window.__bbWeek().manifest.title === '10-11-26 1100'`, 15000);
  await h.wait(1000);
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'worship'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "worship"');
  await h.wait(600);
  await h.js('window.__bbEditor.finishLayout()');
  await h.wait(800);
  await h.js('window.__bbEditor.save()');
  await h.wait(500);

  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.clickSel('#rb-newweek');
  h.ok('New Week opens the chooser', await h.until(`!!document.querySelector('dialog.newweek-dialog[open]')`, 3000));
  const listed = await h.js(`[...document.querySelectorAll('dialog.newweek-dialog input[name="src"]')].map((r) => r.parentElement.textContent.trim())`);
  h.ok('it lists the three most recent weeks, newest first', JSON.stringify(listed.map((t) => t.split(' ')[0])) === JSON.stringify(['10-18-26', '10-11-26', '10-4-26']), { listed });
  h.ok('…a finished week is marked', listed[1].includes('(finished)'), { listed });
  h.ok('…and suggests the next week\'s name', (await h.js(`document.querySelector('dialog.newweek-dialog input[name="name"]').value`)) === '10-25-26 1100');
  await h.shot('chooser');

  // choose the finished 10-11 → the finished/draft question appears
  await h.clickSel('dialog.newweek-dialog input[name="src"][value*="10-11-26"]');
  h.ok('picking a finished week asks: finished pages or draft', !!(await h.rect('dialog.newweek-dialog input[name="from"][value="draft"]')));
  h.ok('…the name you typed is kept', (await h.js(`document.querySelector('dialog.newweek-dialog input[name="name"]').value`)) === '10-25-26 1100');
  await h.shot('chooser-finished');
  await h.clickSel('dialog.newweek-dialog .pd-ok');      // finished pages (default)
  const nf = path.join(box, '10-25-26 1100', '10-25-26 1100.bulletin');
  h.ok('Create Week makes it next to the others and opens it', await h.until(`window.__bbWeek() && window.__bbWeek().manifest.title === '10-25-26 1100'`, 15000) && fs.existsSync(nf));
  const w = JSON.parse(fs.readFileSync(path.join(box, '10-25-26 1100', 'worship.json'), 'utf8'));
  const cover = JSON.stringify(w.pages['1']);
  h.ok('from finished pages: still finished, cover date moved on a week (October 18)', w.mode === 'finished' && cover.includes('October 18, 2026') && !cover.includes('October 11, 2026'), { mode: w.mode });

  // and from the draft
  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.clickSel('#rb-newweek');
  await h.until(`!!document.querySelector('dialog.newweek-dialog[open]')`, 3000);
  await h.clickSel('dialog.newweek-dialog input[name="src"][value*="10-11-26"]');
  await h.clickSel('dialog.newweek-dialog input[name="from"][value="draft"]');
  const nameBox = await h.rect('dialog.newweek-dialog input[name="name"]');
  await h.click(nameBox.cx, nameBox.cy);
  await h.key('A', ['control']);
  await h.type('11-1-26 1100');
  await h.clickSel('dialog.newweek-dialog .pd-ok');
  h.ok('from its draft: created and opened', await h.until(`window.__bbWeek() && window.__bbWeek().manifest.title === '11-1-26 1100'`, 20000));
  const w2 = JSON.parse(fs.readFileSync(path.join(box, '11-1-26 1100', 'worship.json'), 'utf8'));
  h.ok('…its worship pages are a draft again, the Order of Worship lays them out', w2.mode === 'flow' && !!w2.flow && !w2.draft && w2.flow.cover.date === 'October 18, 2026', { mode: w2.mode, date: w2.flow && w2.flow.cover.date });
  await h.wait(1500);
  h.ok('…and the opened week shows laid-out pages', (await h.js(`document.querySelectorAll('#stage .page-shell').length`)) > 8);
};
