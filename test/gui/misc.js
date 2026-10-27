// GUI suite: free-rotate handle, Insert ▸ Symbol, Insert ▸ Date & Time, View ▸ Selected Objects.
const P = 12;
const BOX = `.page-shell[data-page="${P}"] .frame-text[data-id="f459"]`;

exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "announcements"');
  await h.js(`document.querySelector('.page-shell[data-page="${P}"]').scrollIntoView({ block: 'center' })`);
  await h.wait(400);

  // free rotate
  const pic = await h.js(`(() => { const fs = window.__bbEditor.pageEntry(${P}).frames.filter((f) => f.kind === 'image'); fs.sort((a, b) => b.w * b.h - a.w * a.h); return fs[0].id; })()`);
  const S = `.page-shell[data-page="${P}"] .frame[data-id="${pic}"]`;
  let r = await h.rect(S);
  await h.click(r.cx, r.cy);
  const rh = await h.rect(`.page-shell[data-page="${P}"] .rot-handle`);
  h.ok('a selected picture shows the rotate handle above it', !!rh && rh.cy < r.y);
  // drag the handle a quarter turn clockwise round the centre: from straight above to straight right
  const R = r.cy - rh.cy;
  await h.drag(rh.cx, rh.cy, r.cx + R, r.cy, { steps: 12 });
  const rot = await ed(`ed.topFrame(${P}, '${pic}').rotation || 0`);
  h.ok('dragging the handle a quarter turn rotates it ~90°', Math.abs(rot - 90) < 3, { rot });
  await h.shot('rotated');
  const rh2 = await h.rect(`.page-shell[data-page="${P}"] .rot-handle`);
  // with Shift, turn on to about 122° (from the handle, now on the right side of the centre)
  const a2 = 122 * Math.PI / 180;
  await h.drag(rh2.cx, rh2.cy, r.cx + R * Math.sin(a2), r.cy - R * Math.cos(a2), { mods: ['shift'], steps: 10 });
  const rot2 = await ed(`ed.topFrame(${P}, '${pic}').rotation || 0`);
  h.ok('with Shift it turns in steps of 15°', rot2 % 15 === 0 && rot2 !== rot, { rot2 });
  await h.clickSel('#undo'); await h.wait(300);
  await h.clickSel('#undo'); await h.wait(300);
  h.ok('Undo twice: back upright', !(await ed(`ed.topFrame(${P}, '${pic}').rotation`)));

  // near-straight snaps to straight, with dashed guides through the centre (Kevin, batch 2)
  r = await h.rect(S);
  await h.click(r.cx, r.cy);
  const rh3 = await h.rect(`.page-shell[data-page="${P}"] .rot-handle`);
  const R3 = r.cy - rh3.cy;
  // aim at ~92°: straight right of the centre, a little below
  const a = 92 * Math.PI / 180, tx = r.cx + R3 * Math.sin(a), ty = r.cy - R3 * Math.cos(a);
  await h.move(rh3.cx, rh3.cy); await h.down(rh3.cx, rh3.cy);
  for (let k = 1; k <= 10; k++) await h.move(rh3.cx + (tx - rh3.cx) * k / 10, rh3.cy + (ty - rh3.cy) * k / 10);
  await h.wait(100);
  const mid = await h.js(`({ guides: document.querySelectorAll('.page-shell[data-page="${P}"] .rot-guide').length, label: (document.querySelector('.page-shell[data-page="${P}"] .rot-angle') || {}).textContent })`);
  await h.shot('rotate-straight');
  await h.up(tx, ty);
  await h.wait(300);
  h.ok('rotating to ~92° shows "90° — straight" with two dashed guides', mid.guides === 2 && /^90° — straight/.test(mid.label || ''), mid);
  h.ok('…and lets go exactly straight (90°)', (await ed(`ed.topFrame(${P}, '${pic}').rotation`)) === 90);
  h.ok('…the guides go away afterwards', (await h.js(`document.querySelectorAll('.rot-guide, .rot-angle').length`)) === 0);
  await h.clickSel('#undo'); await h.wait(300);

  // View ▸ Zoom ▸ Selected Objects
  r = await h.rect(S);
  await h.click(r.cx, r.cy);
  const z0 = await h.js(`document.getElementById('zoom-label').textContent`);
  await h.clickSel('.rb-tab[data-tab="view"]');
  await h.clickSel('#zoom-sel');
  await h.wait(500);
  const z1 = await h.js(`document.getElementById('zoom-label').textContent`);
  h.ok('View ▸ Selected Objects zooms in on the picture', parseInt(z1) > parseInt(z0), { z0, z1 });
  const vis = await h.js(`(() => { const r = document.querySelector('${S}').getBoundingClientRect(); const s = document.getElementById('stage').getBoundingClientRect(); return r.left >= s.left - 2 && r.right <= s.right + 2 && r.top >= s.top - 2 && r.bottom <= s.bottom + 2; })()`);
  h.ok('…and the whole picture is on screen', vis);
  await h.shot('zoom-selected');
  await h.clickSel('#zoom-fit');
  await h.wait(400);
  await h.js(`document.querySelector('.page-shell[data-page="${P}"]').scrollIntoView({ block: 'center' })`);
  await h.wait(300);

  // Insert ▸ Symbol and Date & Time while typing
  const w = await h.js(`(() => { const box = document.querySelector('${BOX}'); const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let t; (t = tw.nextNode());) { const i = t.data.indexOf('budget'); if (i >= 0) { const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 1);
      const b = r.getBoundingClientRect(); return { x: b.left + 0.3, y: b.top + b.height / 2 }; } } })()`);
  await h.clickSel('.rb-tab[data-tab="insert"]');
  h.ok('Symbol greyed until typing', await h.disabled('#ins-symbol'));
  await h.click(w.x, w.y);
  await h.clickSel('.rb-tab[data-tab="insert"]');
  h.ok('Symbol + Date & Time enabled while typing', !(await h.disabled('#ins-symbol')) && !(await h.disabled('#ins-date')));
  await h.clickSel('#ins-symbol');
  await h.shot('symbols');
  await h.clickSel('.sym[data-sym="✝"]');
  h.ok('Symbol ▸ ✝ is typed at the caret', (await h.js(`document.querySelector('${BOX}').textContent`)).includes('✝budget'));
  await h.clickSel('#ins-date');
  const label = await h.js(`document.getElementById('dt-0').textContent`);
  h.ok('Date & Time lists today\'s date', /\d{4}/.test(label) && /day,/.test(label), { label });
  await h.clickSel('#dt-0');
  h.ok('…and types it at the caret', (await h.js(`document.querySelector('${BOX}').textContent`)).includes(label.trim()));
  await h.key('Escape', [], 500);
  h.ok('saved', (await ed(`JSON.stringify(ed.anyFrame(${P}, 'f459').text.paragraphs)`)).includes('✝'));
};
