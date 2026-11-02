// GUI suite: Home ▸ Paragraph ▸ Drop Cap (Publisher's gallery: 3 lines / 2 lines / Custom… / none).
const P = 12;
const BOX = `.page-shell[data-page="${P}"] .frame-text[data-id="f459"]`;

exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  const at = (w) => h.js(`(() => { const box = document.querySelector('${BOX}'); const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let t; (t = tw.nextNode());) { const i = t.data.indexOf(${JSON.stringify(w)}); if (i >= 0) { const r = document.createRange(); r.setStart(t, i + 1); r.setEnd(t, i + 2);
      const b = r.getBoundingClientRect(); return { x: b.left, y: b.top + b.height / 2 }; } } return null; })()`);
  // the paragraph the caret is in: its saved settings and what its first letter looks like on screen
  const para = () => h.js(`(() => { const s = getSelection(); const e = s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement; const p = e.closest('p');
    if (!p) return null; const fl = getComputedStyle(p, '::first-letter'); return { dropCap: JSON.parse(p.dataset.para || '{}').dropCap || null, cls: p.classList.contains('dropcap'),
    initial: fl.initialLetter, height: p.getBoundingClientRect().height, lines: p.getClientRects().length }; })()`);

  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "announcements"');
  await h.clickSel('.rb-tab[data-tab="home"]');
  h.ok('Drop Cap is greyed until you are typing', await h.disabled('#t-dropcap'));
  await h.js(`document.querySelector('.page-shell[data-page="${P}"]').scrollIntoView({ block: 'center' })`);
  await h.wait(400);
  const w = await at('Looking');
  await h.click(w.x, w.y);
  h.ok('typing in the box; Drop Cap enabled', (await ed('!!ed.textEdit')) && !(await h.disabled('#t-dropcap')));
  const before = await para();
  h.ok('the paragraph has no drop cap yet', before && !before.dropCap && !before.cls, { before });

  // gallery ▸ Drop Cap (3 lines)
  await h.clickSel('#t-dropcap');
  h.ok('Drop Cap opens its gallery', !!(await h.rect('.rb-menu[data-menu-name="dropcap"]:not([hidden]) #dc-3')));
  await h.clickSel('#dc-3');
  await h.wait(300);
  let p = await para();
  h.ok('Drop Cap (3 lines): the paragraph is marked dropCap 3', p && p.dropCap && p.dropCap.lines === 3 && p.cls, { p });
  h.ok('…the first letter is dropped three lines (initial-letter 3)', p && /^3\b/.test(p.initial || ''), { p });
  h.ok('…still typing, caret kept', (await ed('!!ed.textEdit')) && (await h.js(`document.activeElement.classList.contains('flow')`)));
  h.ok('…the Drop Cap button lights up', await h.js(`document.getElementById('t-dropcap').classList.contains('active')`));
  await h.shot('dropcap-3');

  // Custom Drop Cap… ▸ 2 lines
  await h.clickSel('#t-dropcap');
  await h.clickSel('#dc-custom');
  h.ok('Custom Drop Cap… opens a dialog', await h.until(`!!document.querySelector('dialog.pub-dialog[open] input[name="lines"]')`, 2000));
  const li = await h.rect('dialog input[name="lines"]');
  await h.click(li.cx, li.cy);
  await h.key('A', ['control']);
  await h.type('2');
  await h.clickSel('dialog .pd-ok');
  await h.wait(300);
  const p2 = await para();
  h.ok('Custom ▸ 2 lines: the cap is two lines tall', p2 && p2.dropCap && p2.dropCap.lines === 2 && /^2\b/.test(p2.initial || ''), { p2 });
  await h.shot('dropcap-2');

  // No Drop Cap
  await h.clickSel('#t-dropcap');
  await h.clickSel('#dc-none');
  await h.wait(300);
  const p3 = await para();
  h.ok('No Drop Cap takes it off', p3 && !p3.dropCap && !p3.cls && !/^[2-9]/.test(p3.initial || ''), { p3 });

  // back on, then Esc: saved in the model; Undo takes it off again
  await h.clickSel('#t-dropcap');
  await h.clickSel('#dc-3');
  await h.wait(300);
  await h.key('Escape', [], 600);
  const saved = () => ed(`(() => { const f = ed.anyFrame(${P}, 'f459'); const q = f.text.paragraphs.find((x) => x.runs.map((r) => r.text).join('').startsWith('Looking')); return q && q.dropCap ? q.dropCap.lines : null; })()`);
  h.ok('after Esc the drop cap is saved on the paragraph (3 lines)', (await saved()) === 3);
  h.ok('…and drawn on the page', await h.js(`[...document.querySelectorAll('${BOX} p.para')].some((x) => x.classList.contains('dropcap'))`));
  await h.shot('dropcap-saved');
  await h.clickSel('#undo');
  await h.wait(400);
  h.ok('Undo takes the drop cap off', (await saved()) === null);
};
