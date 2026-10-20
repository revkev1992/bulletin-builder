// GUI suite: Home ▸ Styles — the gallery of the week's styles (imported from Publisher), apply one to
// a paragraph, and New Style… from the paragraph you are in (saved in the week file).
const fs = require('fs');
const P = 12;
const BOX = `.page-shell[data-page="${P}"] .frame-text[data-id="f459"]`;

exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  const at = (w) => h.js(`(() => { const box = document.querySelector('${BOX}'); const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let t; (t = tw.nextNode());) { const i = t.data.indexOf(${JSON.stringify(w)}); if (i >= 0) { const r = document.createRange(); r.setStart(t, i + 1); r.setEnd(t, i + 2);
      const b = r.getBoundingClientRect(); return { x: b.left, y: b.top + b.height / 2 }; } } return null; })()`);
  const caretStyle = () => h.js(`(() => { const s = getSelection(); const e = s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement; const cs = getComputedStyle(e);
    const p = e.closest('p'); return { font: cs.fontFamily.split(',')[0].replace(/"/g, ''), pt: Math.round(parseFloat(cs.fontSize) * 0.75 * 10) / 10, style: JSON.parse(p.dataset.para || '{}').style }; })()`);

  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "announcements"');
  await h.clickSel('.rb-tab[data-tab="home"]');
  h.ok('Styles is greyed until you are typing', await h.disabled('#rb-styles'));
  await h.js(`document.querySelector('.page-shell[data-page="${P}"]').scrollIntoView({ block: 'center' })`);
  await h.wait(400);
  let w = await at('Looking');
  await h.click(w.x, w.y);
  const before = await caretStyle();
  await h.clickSel('#rb-styles');
  const names = await h.js(`[...document.querySelectorAll('.sg-menu .sg-item')].map((b) => b.dataset.style)`);
  h.ok('Styles opens the gallery of this week\'s styles (from Publisher)', names.length >= 4 && names.includes('Normal') && names.includes('Heading 2'), { names });
  h.ok('…the paragraph\'s own style is highlighted', (await h.js(`(document.querySelector('.sg-menu .sg-item.current') || {}).dataset?.style`)) === before.style, { before });
  await h.shot('styles-gallery');
  await h.clickSel('.sg-menu .sg-item[data-style="Heading 2"]');
  await h.wait(300);
  const after = await caretStyle();
  h.ok('click Heading 2: the paragraph takes its font and size (Cambria 16)', after.style === 'Heading 2' && /Cambria/.test(after.font) && after.pt === 16, { after });
  h.ok('…still typing, caret kept', (await ed('!!ed.textEdit')) && (await h.js(`document.activeElement.classList.contains('flow')`)));

  // New Style… from this paragraph, after making it bold
  await h.key('Home');
  await h.key('End', ['shift']);
  await h.clickSel('#t-bold');
  await h.clickSel('#rb-styles');
  await h.clickSel('#sg-new');
  h.ok('New Style… asks for a name', await h.until(`!!document.querySelector('dialog.pub-dialog[open] input[name="name"]')`, 2000));
  await h.type('Announcement Heading');
  await h.clickSel('dialog .pd-ok');
  await h.wait(500);
  const onDisk = JSON.parse(fs.readFileSync(h.weekCopy, 'utf8')).styles.find((s) => s.name === 'Announcement Heading');
  h.ok('the new style is saved in the week file (Cambria 16 bold)', onDisk && onDisk.run.font === 'Cambria' && onDisk.run.size === 16 && onDisk.run.bold, { onDisk });
  const lookingStyle = () => h.js(`(() => { const p = [...document.querySelectorAll('${BOX} p.para')].find((x) => x.textContent.startsWith('Looking')); return JSON.parse(p.dataset.para || '{}').style; })()`);
  const prevStyle = () => h.js(`(() => { const p = [...document.querySelectorAll('${BOX} p.para')].find((x) => x.textContent.startsWith('Looking')); return JSON.parse((p.previousElementSibling && p.previousElementSibling.dataset.para) || '{}').style; })()`);
  h.ok('…and the paragraph uses it', (await lookingStyle()) === 'Announcement Heading', { now: await lookingStyle() });
  h.ok('…the paragraph before is left alone', (await prevStyle()) !== 'Announcement Heading', { prev: await prevStyle() });

  // apply the new style to another paragraph
  w = await at('Weekly Garden');
  await h.click(w.x, w.y);
  await h.clickSel('#rb-styles');
  h.ok('the gallery lists the new style', !!(await h.rect('.sg-menu .sg-item[data-style="Announcement Heading"]')));
  await h.clickSel('.sg-menu .sg-item[data-style="Announcement Heading"]');
  await h.key('Escape', [], 600);
  const m = await ed(`JSON.parse(JSON.stringify(ed.anyFrame(${P}, 'f459').text.paragraphs.find((p) => p.runs.map((r) => r.text).join('').includes('Weekly Garden'))))`);
  h.ok('saved: that paragraph has style "Announcement Heading", Cambria 16 bold', m.style === 'Announcement Heading' && m.runs.every((r) => r.font === 'Cambria' && r.size === 16 && r.bold), { style: m.style, run: m.runs[0] });
  await h.shot('styled');
};
