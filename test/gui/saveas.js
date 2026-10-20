// GUI suite: File ▸ Save As. The native folder dialog is replaced by a temp path (global.__bbTestSaveAs);
// the rest is real clicks: type an unsaved change, File ▸ Save As ▸ Browse…, then check both weeks on disk.
const fs = require('fs');
const path = require('path');

exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  const dest = h.tmp + '-saved-as';
  global.__bbTestSaveAs = dest;
  try {
    await h.clickSel('.rb-tab[data-tab="bulletin"]');
    await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
    await h.until('window.__bbEditor.half === "announcements"');
    await h.js(`document.querySelector('.page-shell[data-page="15"] .frame[data-id="f445"]').scrollIntoView({ block: 'center' })`);
    await h.wait(400);
    const w = await h.js(`(() => { const box = document.querySelector('.page-shell[data-page="15"] .frame[data-id="f445"]'); const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
      for (let t; (t = tw.nextNode());) { const i = t.data.indexOf('Staff'); if (i >= 0) { const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 1);
        const b = r.getBoundingClientRect(); return { x: b.left + 0.5, y: b.top + b.height / 2 }; } } })()`);
    await h.click(w.x, w.y);
    await h.type('ZZZ ');
    await h.key('Escape', [], 500);
    h.ok('an unsaved change ("ZZZ")', (await ed('ed.dirty')) && (await ed(`JSON.stringify(ed.anyFrame(15, 'f445').text).includes('ZZZ')`)));

    await h.clickSel('.rb-tab.rb-file');
    await h.wait(300);
    await h.clickSel('.bs-item[data-pane="saveas"]');
    await h.shot('saveas-pane');
    await h.clickSel('#bs-saveas');
    const ok = await h.until(`window.__bbWeek() && window.__bbWeek().manifest.title === ${JSON.stringify(path.basename(dest))}`, 15000);
    h.ok('File ▸ Save As ▸ Browse… opens the copy', ok, { title: await h.js('window.__bbWeek().manifest.title') });
    await h.until('window.__bbEditor.half === "announcements" && !window.__bbEditor.dirty', 8000);
    h.ok('…still changing the announcements pages, nothing left unsaved', (await ed('ed.half')) === 'announcements' && !(await ed('ed.dirty')));
    const copyAnn = fs.readFileSync(path.join(dest, 'announcements.json'), 'utf8');
    const origAnn = fs.readFileSync(path.join(h.tmp, 'announcements.json'), 'utf8');
    h.ok('the copy on disk has the change', copyAnn.includes('ZZZ'));
    h.ok('the original week on disk does not', !origAnn.includes('ZZZ'));
    h.ok('the copy has its own .bulletin and its pictures', fs.existsSync(path.join(dest, path.basename(dest) + '.bulletin')) &&
      fs.readdirSync(path.join(dest, 'assets')).length === fs.readdirSync(path.join(h.tmp, 'assets')).length);
    h.ok('the title bar shows the copy', (await h.js(`document.getElementById('title').textContent`)) === path.basename(dest));
    await h.shot('working-in-copy');
  } finally {
    delete global.__bbTestSaveAs;
    await h.js('window.bb.release()').catch(() => {});
    fs.rmSync(dest, { recursive: true, force: true });
  }
};
