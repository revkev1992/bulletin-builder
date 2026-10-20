// GUI suite: typing in text boxes (batch-1 items 1, 2, 5). Real clicks and keys only — the
// page is read back from the DOM/model to check, never driven through editor functions.
const P = 12;
const BOX = `.page-shell[data-page="${P}"] .frame-text[data-id="f459"]`;

const FONT_CONTROLS = ['#t-font', '#t-size', '#t-grow', '#t-shrink', '#t-clear', '#t-bold', '#t-italic', '#t-underline', '#t-sub', '#t-sup',
  '#t-case', '#t-spacing', '#t-color', '#t-bullets', '#t-numbering', '#t-outdent', '#t-indent', '#rb-columns', '#rb-marks',
  '[data-align="left"]', '[data-align="center"]', '[data-align="right"]', '[data-align="justify"]', '#t-linespacing'];

exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  const model = () => h.js(`JSON.parse(JSON.stringify(window.__bbEditor.anyFrame(${P}, 'f459')))`);
  const allEnabled = async (sels) => { const off = []; for (const s of sels) if (await h.disabled(s)) off.push(s); return off; };

  // ---- claim the announcements half from the Bulletin tab
  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  h.ok('claim announcements (Bulletin ▸ I am changing)', await h.until('window.__bbEditor.half === "announcements"'));
  await h.clickSel('.rb-tab[data-tab="home"]');
  await h.js(`document.querySelector('.page-shell[data-page="${P}"]').scrollIntoView({ block: 'center' })`);
  await h.wait(400);

  h.ok('not typing yet: Font group is greyed', (await allEnabled(['#t-bold', '#t-grow', '#t-bullets', '#t-font'])).length === 4);

  // ---- 5. ONE click on the text: box selected + caret where clicked
  // the word "Discretionary" in the body line "The Pastor's Discretionary Fund (PDF) provides…"
  const word = await h.js(`(() => { const box = document.querySelector('${BOX}'); const w = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let t; (t = w.nextNode());) { const i = t.data.indexOf('provides'); if (i >= 0) { const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 8);
      const b = r.getBoundingClientRect(); return { x: b.left, y: b.top + b.height / 2, w: b.width }; } } })()`);
  h.ok('found the word "provides"', !!word);
  await h.click(word.x + word.w / 8 + 1.5, word.y);   // just after the "p"
  await h.shot('one-click-in-text');
  h.ok('one click starts typing (no double-click needed)', await ed('!!ed.textEdit'));
  h.ok('…and selects the text box', await ed('ed.sel && ed.sel.id === "f459"'));
  const caret = await h.js(`(() => { const s = getSelection(); return s.rangeCount ? { node: s.anchorNode.data && s.anchorNode.data.slice(s.anchorOffset, s.anchorOffset + 7), collapsed: s.isCollapsed } : null; })()`);
  h.ok('caret lands where clicked (before "rovides")', caret && caret.node === 'rovides', { caret });

  // ---- 1. every Font/Paragraph control is live while typing
  const off = await allEnabled(FONT_CONTROLS);
  h.ok('while typing: every Home ▸ Font + Paragraph control is enabled', off.length === 0, { off });
  h.ok('Home tab is showing', (await h.js(`document.querySelector('.rb-tab.active').dataset.tab`)) === 'home');

  // type where the caret is
  await h.type('XY');
  const t1 = await h.js(`document.querySelector('${BOX}').textContent`);
  h.ok('typed text appears at the caret', t1.includes('pXYrovides'));

  // ---- drag over text selects it
  const w2 = await h.js(`(() => { const box = document.querySelector('${BOX}'); const w = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let t; (t = w.nextNode());) { const i = t.data.indexOf('budget'); if (i >= 0) { const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 6);
      const b = r.getBoundingClientRect(); return { x0: b.left + 0.5, x1: b.right - 0.5, y: b.top + b.height / 2 }; } } })()`);
  await h.drag(w2.x0, w2.y, w2.x1, w2.y, { steps: 6 });
  const selText = await h.js('getSelection().toString()');
  h.ok('click-drag over text selects it ("budget")', selText === 'budget', { selText });
  h.ok('…and does not move the box', await ed(`Math.abs(ed.topFrame(${P}, 'f459').x - ${await h.js(`window.__bbEditor.topFrame(${P}, 'f459').x`)}) < 0.01`));

  // ---- ribbon buttons apply to the selection (real clicks)
  await h.clickSel('#t-bold');
  h.ok('Bold button bolds the selected word', await h.js(`(() => { const s = getSelection(); const el = s.anchorNode.parentElement; return parseInt(getComputedStyle(el).fontWeight) >= 600; })()`));
  const before = await h.js(`(() => { const s = getSelection(); return parseFloat(getComputedStyle(s.anchorNode.parentElement).fontSize); })()`);
  await h.clickSel('#t-grow');
  const after = await h.js(`(() => { const s = getSelection(); return parseFloat(getComputedStyle(s.anchorNode.parentElement).fontSize); })()`);
  h.ok('Increase Font Size grows the selected word', after > before, { before, after });
  await h.clickSel('#t-color');
  h.ok('Font Color ▾ opens its menu', await h.js(`!document.querySelector('.rb-menu[data-menu-name="color"]').hidden`));
  await h.shot('color-menu');
  await h.clickSel('.swatch[data-color="#C00000"]');
  h.ok('a colour swatch colours the selected word', await h.js(`getComputedStyle(getSelection().anchorNode.parentElement).color === 'rgb(192, 0, 0)'`));
  await h.clickSel('#t-case');
  await h.clickSel('#case-upper');
  h.ok('Change Case ▸ UPPERCASE', (await h.js('getSelection().toString()')) === 'BUDGET', { got: await h.js('getSelection().toString()') });
  await h.clickSel('#t-linespacing');
  await h.clickSel('#ls-1\\.5');
  await h.clickSel('[data-align="center"]');
  await h.shot('formatted');

  // ---- 2. Text Box Format tab: everything live
  h.ok('Text Box Format tab is shown', await h.js(`(() => { const t = document.querySelector('.rb-tab[data-tab="format"]'); return !t.hidden && t.textContent === 'Text Box Format'; })()`));
  await h.clickSel('.rb-tab[data-tab="format"]');
  await h.shot('textbox-format-tab');
  const fmtOff = [];
  for (const s of ['.rb-panel[data-tab="format"] [data-mirror="rb-columns"]', '.rb-panel[data-tab="format"] [data-mirror="rb-wrap"]',
    '.rb-panel[data-tab="format"] [data-mirror="rb-align"]', '.rb-panel[data-tab="format"] [data-mirror="front"]', '#fx', '#fy', '#fw', '#fh']) if (await h.disabled(s)) fmtOff.push(s);
  h.ok('Text Box Format: Columns, Wrap, Align, Arrange, Size all enabled', fmtOff.length === 0, { fmtOff });
  await h.clickSel('.rb-panel[data-tab="format"] [data-mirror="rb-columns"]');
  await h.clickSel('#col-2');
  h.ok('Columns ▸ Two Columns sets the box to 2 columns', (await model()).text.columns === 2, { cols: (await model()).text.columns });
  h.ok('…and you are still typing, with the word still selected', (await ed('!!ed.textEdit')) && (await h.js('getSelection().toString()')) === 'BUDGET');

  // ---- Esc leaves typing; the box stays selected; Font greys again
  await h.key('Escape');
  h.ok('Esc leaves typing', !(await ed('!!ed.textEdit')));
  h.ok('…box stays selected', await ed('ed.sel && ed.sel.id === "f459"'));
  const m = await model();
  const txt = m.text.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('\n');
  h.ok('typing saved to the model', txt.includes('pXYrovides') && txt.includes('BUDGET'));
  const run = m.text.paragraphs.flatMap((p) => p.runs).find((r) => r.text.includes('BUDGET'));
  h.ok('formatting saved (bold, bigger, red)', run && run.bold && run.color === '#C00000' && run.size > 9, { run });
  await h.clickSel('.rb-tab[data-tab="home"]');
  h.ok('not typing: Font controls greyed', (await allEnabled(['#t-bold', '#t-grow', '#t-bullets'])).length === 3);

  // ---- border drag moves the box
  const x0 = await ed(`ed.topFrame(${P}, 'f459').x`);
  const e = await h.rect(`.page-shell[data-page="${P}"] .sel-edge.edge-top`);
  h.ok('selected box shows a border grab strip', !!e);
  await h.drag(e.x + e.w * 0.25, e.cy, e.x + e.w * 0.25 + 30, e.cy, { mods: ['alt'] });
  const x1 = await ed(`ed.topFrame(${P}, 'f459').x`);
  h.ok('dragging the border moves the text box', x1 - x0 > 15, { moved: x1 - x0 });
  h.ok('…without starting to type', !(await ed('!!ed.textEdit')));
  await h.shot('moved-by-border');

  // ---- clicking text of the selected box again resumes typing; then click another box's text
  const w3 = await h.js(`(() => { const box = document.querySelector('${BOX}'); const w = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let t; (t = w.nextNode());) { const i = t.data.indexOf('depleted'); if (i >= 0) { const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 8);
      const b = r.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; } } })()`);
  await h.click(w3.x, w3.y);
  await h.shot('click-again');
  h.ok('click in a selected box types again', await ed('!!ed.textEdit'));
  // page 15 has several text boxes: type in one, then click another's text
  await h.js(`document.querySelector('.page-shell[data-page="15"] .frame[data-id="f445"]').scrollIntoView({ block: 'center' })`);
  await h.wait(400);
  const at = (id, w) => h.js(`(() => { const box = document.querySelector('.page-shell[data-page="15"] .frame[data-id="${id}"]'); const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let t; (t = tw.nextNode());) { const i = t.data.indexOf('${w}'); if (i >= 0) { const r = document.createRange(); r.setStart(t, i + 1); r.setEnd(t, i + 2);
      const b = r.getBoundingClientRect(); return { x: b.left, y: b.top + b.height / 2 }; } } return null; })()`);
  let o = await at('f437', 'peace');
  await h.click(o.x, o.y);
  h.ok('click text on page 15: typing there', await ed(`ed.textEdit && ed.textEdit.id === 'f437'`));
  o = await at('f445', 'Staff');
  await h.click(o.x, o.y);
  await h.wait(600);
  h.ok('click another box\'s text while typing: typing moves there', await ed(`ed.textEdit && ed.textEdit.id === 'f445'`));
  h.ok('…with the caret where you clicked (inside "Staff")', (await h.js(`(() => { const s = getSelection(); return (s.anchorNode.data || '').slice(s.anchorOffset - 1, s.anchorOffset + 4); })()`)) === 'Staff');
  await h.key('Escape');

  // ---- a picture: one click selects, drag moves (no typing)
  await h.js(`document.querySelector('.page-shell[data-page="${P}"]').scrollIntoView({ block: 'center' })`);
  await h.wait(400);
  const pic = await h.js(`(() => { const el = document.querySelector('.page-shell[data-page="${P}"] .frame-image'); return el && el.dataset.id; })()`);
  const pr = await h.rect(`.page-shell[data-page="${P}"] .frame-image[data-id="${pic}"]`);
  const px0 = await ed(`ed.topFrame(${P}, '${pic}').y`);
  await h.drag(pr.cx, pr.cy, pr.cx, pr.cy + 20, { mods: ['alt'] });
  const px1 = await ed(`ed.topFrame(${P}, '${pic}').y`);
  h.ok('picture: drag from inside moves it', px1 - px0 > 8, { moved: px1 - px0 });
  h.ok('Picture Format tab shown', (await h.js(`document.querySelector('.rb-tab[data-tab="format"]').textContent`)) === 'Picture Format');
  await h.shot('picture-selected');
};
