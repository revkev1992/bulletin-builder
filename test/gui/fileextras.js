// GUI suite: File ▸ Export ▸ Pages as Pictures and Pack and Go; Home ▸ Paste Special (picture from the
// clipboard); Insert ▸ Insert File (.txt). Native dialogs are replaced by paths (global hooks).
const fs = require('fs');
const path = require('path');
const { readZip } = require('../../src/pack');
const P = 12;
const BOX = `.page-shell[data-page="${P}"] .frame-text[data-id="f459"]`;

exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  const status = () => h.js(`document.getElementById('status').textContent`);

  // ---- File ▸ Export ▸ Pages as Pictures (PNG, 150 dpi)
  const outDir = path.join(h.tmp, 'pictures');
  global.__bbTestExportDir = outDir;
  await h.clickSel('.rb-tab[data-tab="file"]');
  await h.clickSel('.bs-item[data-pane="export"]');
  h.ok('File ▸ Export offers Create PDF, Pages as Pictures, Pack and Go', !!(await h.rect('#bs-pages')) && !!(await h.rect('#bs-pack')));
  await h.shot('export-pane');
  await h.clickSel('#bs-pages');
  h.ok('Pages as Pictures asks for type and resolution', await h.until(`!!document.querySelector('dialog.pub-dialog[open] input[name="format"]')`, 2000));
  await h.clickSel('dialog .pd-ok');
  h.ok('…and writes one picture per page', await h.until(`/pictures saved/.test(document.getElementById('status').textContent)`, 90000), { status: await status() });
  const n = await h.js('window.__bbWeek().manifest.pages.length');
  const files = fs.existsSync(outDir) ? fs.readdirSync(outDir).filter((f) => f.endsWith('.png')) : [];
  h.ok('one PNG per page, named after the week', files.length === n && files.every((f) => /^9-20-26 1100 - page-\d\d\.png$/.test(f)), { files: files.slice(0, 3), n });
  if (files.length) {
    const png = fs.readFileSync(path.join(outDir, files[0]));
    const w = png.readUInt32BE(16), ht = png.readUInt32BE(20);
    // 7 × 8.5 in at 150 dpi = 1050 × 1275
    h.ok('…each 1050 × 1275 px (7 × 8.5 in at 150 dpi)', Math.abs(w - 1050) <= 2 && Math.abs(ht - 1275) <= 2, { w, ht });
  }
  delete global.__bbTestExportDir;

  // ---- File ▸ Export ▸ Pack and Go
  const zipFile = path.join(h.tmp, 'pack.zip');
  global.__bbTestExportZip = zipFile;
  await h.clickSel('.rb-tab[data-tab="file"]');
  await h.clickSel('.bs-item[data-pane="export"]');
  await h.clickSel('#bs-pack');
  h.ok('Pack and Go writes a zip', await h.until(`/Packed \\d+ files/.test(document.getElementById('status').textContent)`, 60000) && fs.existsSync(zipFile), { status: await status() });
  const names = fs.existsSync(zipFile) ? readZip(fs.readFileSync(zipFile)).map((e) => e.name) : [];
  h.ok('…with the week folder, its pictures, a fonts list and a note', names.includes('9-20-26 1100/9-20-26 1100.bulletin') && names.some((x) => x.startsWith('9-20-26 1100/assets/')) && names.some((x) => x.endsWith('FONTS.txt')) && names.some((x) => x.endsWith('README.txt')), { n: names.length });
  delete global.__bbTestExportZip;

  // ---- Home ▸ Paste Special ▸ Picture (a picture put on the clipboard, as a screenshot would be)
  const { clipboard, ClipboardItem, nativeImage } = require('electron');
  const assets = path.join(path.dirname(h.weekCopy), 'assets');
  const pic = fs.readdirSync(assets).find((f) => /\.png$/i.test(f) && fs.statSync(path.join(assets, f)).size < 2000000);
  await clipboard.write([new ClipboardItem({ 'image/png': nativeImage.createFromPath(path.join(assets, pic)).toPNG() })]);
  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "announcements"');
  await h.clickSel(`#nav-pages .nav-page[data-page="${P}"]`);
  await h.wait(600);
  const n0 = await ed(`ed.pageEntry(${P}).frames.length`);
  await h.clickSel('.rb-tab[data-tab="home"]');
  await h.clickSel('#rb-paste-special');
  h.ok('Paste Special opens, with Picture available (a picture is on the clipboard)', await h.until(`!!document.querySelector('dialog.pub-dialog[open] input[name="as"][value="picture"]:not(:disabled)')`, 3000));
  await h.clickSel('dialog input[name="as"][value="picture"]');
  await h.clickSel('dialog .pd-ok');
  await h.until(`window.__bbEditor.pageEntry(${P}).frames.length === ${n0 + 1}`, 8000);
  const pasted = await ed(`(() => { const fs = ed.pageEntry(${P}).frames; const f = fs[fs.length - 1]; return { kind: f.kind, asset: f.image && f.image.asset }; })()`);
  h.ok('the clipboard picture is on the page, saved with the week\'s pictures', pasted.kind === 'image' && /^assets\/Pasted picture/.test(pasted.asset || ''), { pasted });
  await h.shot('pasted-picture');
  // Ctrl+V with nothing copied inside the app does the same
  await h.key('Escape', [], 300);
  await h.js('window.__bbEditor.clipboard = null');
  await h.key('V', ['control'], 1500);
  h.ok('Ctrl+V (nothing copied in the app) pastes the clipboard picture too', (await ed(`ed.pageEntry(${P}).frames.length`)) === n0 + 2);

  // ---- Insert ▸ Insert File (.txt) where you are typing
  const txt = path.join(h.tmp, 'notes.txt');
  fs.writeFileSync(txt, 'First line from the file.\r\nSecond line from the file.\r\n');
  global.__bbTestInsertFile = txt;
  const w = await h.js(`(() => { const box = document.querySelector('${BOX}'); const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let t; (t = tw.nextNode());) { const i = t.data.indexOf('donate).'); if (i >= 0) { const r = document.createRange(); r.setStart(t, i + 7); r.setEnd(t, i + 8);
      const b = r.getBoundingClientRect(); return { x: b.right + 1, y: b.top + b.height / 2 }; } } })()`);
  await h.click(w.x, w.y);
  await h.key('End');
  await h.key('Enter');
  await h.clickSel('.rb-tab[data-tab="insert"]');
  h.ok('Insert File enabled while typing', !(await h.disabled('#ins-file')));
  await h.clickSel('#ins-file');
  await h.wait(800);
  h.ok('the file\'s lines are typed in as paragraphs', (await h.js(`document.querySelector('${BOX}').textContent`)).includes('First line from the file.') && (await h.js(`[...document.querySelectorAll('${BOX} p.para')].some((p) => p.textContent.trim() === 'Second line from the file.')`)));
  await h.key('Escape', [], 600);
  h.ok('…and saved', await ed(`JSON.stringify(ed.anyFrame(${P}, 'f459').text.paragraphs).includes('Second line from the file.')`));
  delete global.__bbTestInsertFile;
};
