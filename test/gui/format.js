// GUI suite: the rest of Home ▸ Font + Paragraph (batch-1 section D). Each control is clicked on the
// ribbon with a word or paragraph selected by real mouse/keyboard, then checked on screen and,
// after Esc, in the saved model.
const P = 12;
const BOX = `.page-shell[data-page="${P}"] .frame-text[data-id="f459"]`;

exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  const word = (w) => h.js(`(() => { const box = document.querySelector('${BOX}'); const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let t; (t = tw.nextNode());) { const i = t.data.indexOf(${JSON.stringify('X')}.replace('X', ${JSON.stringify(w)})); if (i >= 0) { const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + ${w.length});
      const b = r.getBoundingClientRect(); return { x0: b.left + 0.5, x1: b.right - 0.5, y: b.top + b.height / 2 }; } } return null; })()`);
  const selectWord = async (w) => { const r = await word(w); await h.drag(r.x0, r.y, r.x1, r.y, { steps: 5 }); return h.js('getSelection().toString()'); };
  const cs = (prop) => h.js(`getComputedStyle(getSelection().anchorNode.parentElement).${prop}`);
  const paraOfCaret = () => h.js(`(() => { const s = getSelection(); const p = (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement).closest('p'); return { text: p.textContent, para: JSON.parse(p.dataset.para || '{}'), pad: getComputedStyle(p).paddingLeft }; })()`);

  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "announcements"');
  await h.clickSel('.rb-tab[data-tab="home"]');
  await h.js(`document.querySelector('.page-shell[data-page="${P}"]').scrollIntoView({ block: 'center' })`);
  await h.wait(400);
  const first = await word('budget');
  await h.click(first.x0 + 2, first.y);
  h.ok('one click: typing', await ed('!!ed.textEdit'));

  // keyboard shortcuts inside the text
  h.ok('select "budget" by dragging', (await selectWord('budget')) === 'budget');
  await h.key('I', ['control']);
  h.ok('Ctrl+I italicises', (await cs('fontStyle')) === 'italic');
  await h.key('I', ['control']);
  const s0 = parseFloat(await cs('fontSize'));
  await h.key('.', ['control', 'shift']);
  h.ok('Ctrl+Shift+> grows the font', parseFloat(await cs('fontSize')) > s0);
  await h.key(',', ['control', 'shift']);
  h.ok('Ctrl+Shift+< shrinks it back', Math.abs(parseFloat(await cs('fontSize')) - s0) < 0.3, { s0, now: await cs('fontSize') });

  // ribbon: superscript, subscript, underline, character spacing, clear formatting
  await h.clickSel('#t-sup');
  h.ok('Superscript', (await cs('verticalAlign')) === 'super');
  await h.clickSel('#t-sup');
  await h.clickSel('#t-sub');
  h.ok('Subscript', (await cs('verticalAlign')) === 'sub');
  await h.clickSel('#t-sub');
  await h.clickSel('#t-underline');
  h.ok('Underline', /underline/.test(await h.js(`(() => { let e = getSelection().anchorNode.parentElement; while (e && !/underline/.test(getComputedStyle(e).textDecorationLine)) e = e.parentElement; return e ? 'underline' : ''; })()`)));
  await h.clickSel('#t-spacing');
  await h.clickSel('#trk-125');
  h.ok('Character Spacing ▸ Very Loose', parseFloat(await cs('letterSpacing')) > 0);
  await h.clickSel('#t-clear');
  h.ok('Clear All Formatting puts the word back to plain', (await cs('letterSpacing')) === 'normal' && (await cs('verticalAlign')) === 'baseline' &&
    !(await h.js(`(() => { let e = getSelection().anchorNode.parentElement; while (e && !e.classList.contains('flow')) { if (/underline/.test(getComputedStyle(e).textDecorationLine)) return true; e = e.parentElement; } return false; })()`)));

  // font + size boxes
  await h.js(`(() => { const s = document.getElementById('t-font'); s.value = 'Georgia'; s.dispatchEvent(new Event('mousedown')); s.dispatchEvent(new Event('change')); })()`);
  h.ok('Font box ▸ Georgia', /Georgia/.test(await cs('fontFamily')));
  const sz = await h.rect('#t-size');
  await h.click(sz.cx, sz.cy);
  await h.key('A', ['control']);
  await h.type('16');
  await h.key('Enter');
  await h.wait(200);
  h.ok('Font Size box ▸ 16', Math.abs(parseFloat(await cs('fontSize')) - 16 * 96 / 72) < 0.5, { px: await cs('fontSize') });

  // the Font / Size boxes follow the caret (Publisher)
  const other = await word('Altar');
  await h.click(other.x0 + 2, other.y);
  await h.wait(200);
  const boxes1 = await h.js(`({ f: document.getElementById('t-font').value, s: document.getElementById('t-size').value })`);
  const back2 = await word('budget');
  await h.click((back2.x0 + back2.x1) / 2, back2.y);
  await h.wait(200);
  const boxes2 = await h.js(`({ f: document.getElementById('t-font').value, s: document.getElementById('t-size').value, b: document.getElementById('t-bold').classList.contains('active') })`);
  h.ok('Font/Size boxes follow the caret (Georgia 16 in "budget", the heading font elsewhere)', boxes2.f === 'Georgia' && boxes2.s === '16' && boxes1.f !== 'Georgia', { boxes1, boxes2 });
  h.ok('Bold button lights up in bold text ("Help Prepare the Altar" heading)', await (async () => { await h.click(other.x0 + 2, other.y); await h.wait(200); return h.js(`document.getElementById('t-bold').classList.contains('active')`); })());

  // paragraph: bullets, numbering, indent
  const lk = await word('Looking');
  await h.click(lk.x0 + 3, lk.y);
  await h.clickSel('#t-bullets');
  h.ok('Bullets add a bullet', (await paraOfCaret()).text.startsWith('•'));
  await h.clickSel('#t-bullets');
  h.ok('Bullets again take it off', !(await paraOfCaret()).text.startsWith('•'));
  await h.clickSel('#t-numbering');
  h.ok('Numbering adds "1."', /^1\./.test((await paraOfCaret()).text));
  await h.clickSel('#t-numbering');
  const ind0 = parseFloat((await paraOfCaret()).pad);
  await h.clickSel('#t-indent');
  h.ok('Increase Indent', parseFloat((await paraOfCaret()).pad) > ind0);
  await h.clickSel('#t-outdent');
  h.ok('Decrease Indent', Math.abs(parseFloat((await paraOfCaret()).pad) - ind0) < 0.5);

  // Paragraph… dialog
  await h.clickSel('#t-linespacing');
  await h.clickSel('#t-paradlg');
  h.ok('Line Spacing ▸ Paragraph… opens the dialog', await h.until(`!!document.querySelector('dialog.pub-dialog[open]')`, 2000));
  const sb = await h.rect('dialog input[name="spaceBefore"]');
  await h.click(sb.cx, sb.cy);
  await h.key('A', ['control']);
  await h.type('12');
  await h.clickSel('dialog .pd-ok');
  await h.wait(300);
  h.ok('Paragraph… sets 12 pt before', (await paraOfCaret()).para.spaceBefore === 12, { para: (await paraOfCaret()).para });
  await h.shot('formatted');

  // ¶ shows marks
  await h.clickSel('#rb-marks');
  h.ok('¶ turns on special characters', await h.js(`document.body.classList.contains('show-marks')`));
  await h.shot('marks');
  await h.clickSel('#rb-marks');

  // Esc: all of it saved
  await h.key('Escape', [], 600);
  const m = await ed(`JSON.parse(JSON.stringify(ed.anyFrame(${P}, 'f459').text.paragraphs))`);
  const run = m.flatMap((p) => p.runs).find((r) => r.text.includes('budget'));
  h.ok('saved: "budget" in Georgia 16 pt, plain', run && run.font === 'Georgia' && Math.abs(run.size - 16) < 0.2 && !run.underline && !run.superscript, { run });
  const lp = m.find((p) => p.runs.map((r) => r.text).join('').startsWith('Looking'));
  h.ok('saved: "Looking…" paragraph has 12 pt before, no bullet', lp && lp.spaceBefore === 12, { lp: lp && { spaceBefore: lp.spaceBefore, start: lp.runs[0].text.slice(0, 8) } });
};
