// GUI suite: cropping (batch-1 item 3, "crop always crops from the bottom"). Drags each of the 8
// crop handles with the real mouse and checks that exactly the matching edges move.
const P = 12;

exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "announcements"');
  // the big picture (Community Victory Garden banner)
  const pic = await h.js(`(() => { const ed = window.__bbEditor; const fs = ed.pageEntry(${P}).frames.filter((f) => f.kind === 'image');
    fs.sort((a, b) => b.w * b.h - a.w * a.h); return fs[0].id; })()`);
  const S = `.page-shell[data-page="${P}"] .frame[data-id="${pic}"]`;
  await h.js(`document.querySelector('${S}').scrollIntoView({ block: 'center' })`);
  await h.wait(300);
  const box = () => ed(`(() => { const f = ed.topFrame(${P}, '${pic}'); return { x: f.x, y: f.y, r: f.x + f.w, b: f.y + f.h, crop: f.image.crop }; })()`);

  const r = await h.rect(S);
  await h.click(r.cx, r.cy);
  h.ok('one click selects the picture', await ed(`ed.sel && ed.sel.id === '${pic}'`));
  await h.clickSel('.rb-tab[data-tab="format"]');
  h.ok('Picture Format ▸ Crop is enabled', !(await h.disabled('#crop')));
  await h.clickSel('#crop');
  h.ok('Crop button turns cropping on', await ed('!!ed.crop'));
  await h.shot('crop-on');

  const PX = 14;
  const dirs = { n: [0, PX], s: [0, -PX], e: [-PX, 0], w: [PX, 0], nw: [PX, PX], ne: [-PX, PX], sw: [PX, -PX], se: [-PX, -PX] };
  for (const [hd, [dx, dy]] of Object.entries(dirs)) {
    const b0 = await box();
    const hr = await h.rect(`.page-shell[data-page="${P}"] .sel-box.cropping .handle.h-${hd}`);
    if (!hr) { h.ok('crop handle ' + hd + ' on screen', false); continue; }
    const hit = await h.js(`(() => { const e = document.elementFromPoint(${hr.cx}, ${hr.cy}); return e.className; })()`);
    await h.drag(hr.cx, hr.cy, hr.cx + dx, hr.cy + dy, { mods: ['alt'] });
    const b1 = await box();
    const moved = { x: b1.x - b0.x, y: b1.y - b0.y, r: b1.r - b0.r, b: b1.b - b0.b };
    const want = { x: hd.includes('w'), y: hd.includes('n'), r: hd.includes('e'), b: hd.includes('s') };
    const good = Object.keys(want).every((k) => (Math.abs(moved[k]) > 3) === want[k]);
    h.ok('crop handle ' + hd + ' moves only its own edge(s)', good, { moved, hit });
    h.ok('…and stays in crop mode', await ed('!!ed.crop'));
  }
  await h.shot('after-8-crops');
  // dragging inside slides the picture within the frame (frame stays put)
  const b0 = await box();
  const rr = await h.rect(S);
  await h.drag(rr.cx, rr.cy, rr.cx + 10, rr.cy, { mods: ['alt'] });
  const b1 = await box();
  h.ok('drag inside while cropping slides the picture, frame stays', Math.abs(b1.x - b0.x) < 0.01 && b1.crop[0] !== b0.crop[0], { b0, b1 });
  await h.key('Escape');
  h.ok('Esc ends cropping', !(await ed('!!ed.crop')));
  await h.shot('crop-done');
};
