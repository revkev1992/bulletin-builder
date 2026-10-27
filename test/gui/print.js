// GUI suite: Bulletin ▸ Print ▸ Legal / Ledger / Letter (Kevin, 2026-10-27). Real clicks on the ribbon and
// the dialog; the native "save PDF" window is replaced by a temp path; the PDF is then measured.
const fs = require('fs');
const path = require('path');

exports.run = async (h) => {
  const fitz = (pdf) => {   // sheet count + size in inches, read with PyMuPDF
    const { execFileSync } = require('child_process');
    const py = 'C:/Users/kevqu/AppData/Local/Programs/Python/Python312/python.exe';
    const out = execFileSync(py, ['-c', 'import fitz,sys,json; d=fitz.open(sys.argv[1]); r=d[0].rect; print(json.dumps([len(d), round(r.width/72,2), round(r.height/72,2)]))', pdf], { encoding: 'utf8' });
    return JSON.parse(out);
  };
  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  for (const id of ['#pr-legal', '#pr-ledger', '#pr-letter']) h.ok('Bulletin ▸ Print has ' + id.slice(4), !(await h.disabled(id)));
  const expect = { legal: [4, 14, 8.5], ledger: [4, 17, 11], letter: [16, 8.5, 11] };
  for (const paper of ['legal', 'ledger', 'letter']) {
    const out = path.join(h.tmp, 'print-' + paper + '.pdf');
    global.__bbTestExportPdf = out;
    await h.clickSel('#pr-' + paper);
    const ok = await h.until(`!!document.querySelector('dialog.pub-dialog[open]')`, 3000);
    const text = await h.js(`(document.querySelector('dialog.pub-dialog[open] .pd-body p') || {}).textContent || ''`);
    h.ok(paper + ': the dialog says what will print', ok && text.includes(paper === 'letter' ? 'one page each' : 'booklet'), { text });
    if (paper === 'legal') await h.shot('print-dialog-legal');
    await h.clickSel('dialog.pub-dialog input[name="how"][value="pdf"]');
    await h.clickSel('dialog.pub-dialog .pd-ok');
    const done = await h.until(`/PDF saved/.test(document.getElementById('status').textContent)`, 30000);
    h.ok(paper + ': Save as a PDF writes the file', done && fs.existsSync(out));
    if (fs.existsSync(out)) {
      const [n, w, ht] = fitz(out);
      // booklets: 16 pages → 4 sheets = 8 printed sides; letter: 16 sheets
      const sides = paper === 'letter' ? 16 : 8;
      h.ok(paper + ': ' + sides + ' printed sides of ' + expect[paper][1] + ' × ' + expect[paper][2] + ' in', n === sides && w === expect[paper][1] && ht === expect[paper][2], { n, w, ht });
    }
  }
  delete global.__bbTestExportPdf;
};
