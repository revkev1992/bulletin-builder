// GUI suite: zooming keeps your place (Kevin's batch-2 session H finding, 2026-10-27: Ctrl+= jumped
// from page 10 to pages 8-9). The ribbon's Zoom In / Zoom Out run the same code as Ctrl+= / Ctrl+-.
exports.run = async (h) => {
  // the page (and spot on it) in the middle of the window
  const centre = () => h.js(`(() => { const s = document.getElementById('stage').getBoundingClientRect();
    const el = document.elementFromPoint(s.left + s.width / 2, s.top + s.height / 2); const sh = el && el.closest('.page-shell');
    if (!sh) return null; const r = sh.querySelector('.page').getBoundingClientRect();
    return { page: Number(sh.dataset.page), fy: Math.round(((s.top + s.height / 2) - r.top) / r.height * 100) / 100 }; })()`);
  await h.clickSel('#nav-pages .nav-page[data-page="11"]');
  await h.wait(900);
  const c0 = await centre();
  h.ok('starting on page 11', c0 && (c0.page === 11 || c0.page === 10), { c0 });
  await h.clickSel('.rb-tab[data-tab="view"]');
  for (let k = 0; k < 3; k++) { await h.clickSel('#zoom-in'); await h.wait(250); }
  const c1 = await centre();
  h.ok('Zoom In ×3 keeps the same page in the middle', c1 && c1.page === c0.page, { c0, c1, zoom: await h.js(`document.getElementById('zoom-label').textContent`) });
  h.ok('…at about the same spot on it', c1 && Math.abs(c1.fy - c0.fy) < 0.12, { c0, c1 });
  await h.shot('zoomed-in');
  for (let k = 0; k < 3; k++) { await h.clickSel('#zoom-out'); await h.wait(250); }
  const c2 = await centre();
  h.ok('Zoom Out ×3 comes back to the same place', c2 && c2.page === c0.page && Math.abs(c2.fy - c0.fy) < 0.12, { c0, c2 });
  await h.clickSel('#zoom-100');
  await h.wait(300);
  const c3 = await centre();
  h.ok('100% keeps the same page in the middle', c3 && c3.page === c0.page, { c0, c3 });

  // Ctrl + mouse wheel / touchpad pinch (Kevin 2026-10-27): zoom around the pointer
  const pct = async () => parseInt(await h.js(`document.getElementById('zoom-label').textContent`), 10);
  // a line well off the middle of the window, and where its left edge is on screen
  const word = () => h.js(`(() => { const s = document.getElementById('stage').getBoundingClientRect();
    const ps = [...document.querySelectorAll('#stage p.para')];
    let best = null;
    for (let i = 0; i < ps.length; i++) { const r = ps[i].getBoundingClientRect();
      if (ps[i].textContent.trim().length > 5 && r.height < 40 && r.top > s.top + 10 && r.bottom < s.bottom - 10 && r.left > s.left + 10 && r.left + 40 < s.right) {
        const d = Math.abs(r.top + r.height / 2 - (s.top + s.height / 2));
        if (d > 60 && (!best || d > best.d)) best = { x: r.left + 1, y: r.top + r.height / 2, i, d }; } }
    return best; })()`);
  const spot = (i) => h.js(`(() => { const r = document.querySelectorAll('#stage p.para')[${i}].getBoundingClientRect();
    return { x: r.left + 1, y: r.top + r.height / 2 }; })()`);
  const near = (a, b) => a && b && Math.hypot(a.x - b.x, a.y - b.y) < 6;
  const w0 = await word();
  h.ok('a line low in the window, off-centre, to zoom at', !!w0, { w0 });
  const z0 = await pct();
  for (let k = 0; k < 3; k++) await h.wheel(w0.x, w0.y, 100, ['control'], 80);
  await h.wait(300);
  const z1 = await pct();
  const w1 = await spot(w0.i);
  h.ok('Ctrl + wheel up zooms in (3 notches = about 3 Zoom In steps)', z1 > z0 * 1.4 && z1 < z0 * 1.6, { z0, z1 });
  h.ok('…around the pointer: that line stays under it', near(w0, w1), { w0, w1 });
  for (let k = 0; k < 3; k++) await h.wheel(w0.x, w0.y, -100, ['control'], 80);
  await h.wait(300);
  const z2 = await pct();
  const w2 = await spot(w0.i);
  h.ok('Ctrl + wheel down zooms back out, still at the pointer', Math.abs(z2 - z0) <= 1 && near(w0, w2), { z0, z2, w2 });
  // a pinch: many small ctrl+wheel steps, fast
  for (let k = 0; k < 40; k++) await h.wheel(w0.x, w0.y, 4, ['control'], 5);
  // wait for the last steps to land (the zoom stops changing)
  let z3 = await pct();
  for (let k = 0; k < 20; k++) { await h.wait(250); const z = await pct(); if (z === z3) break; z3 = z; }
  const w3 = await spot(w0.i);
  h.ok('a touchpad pinch (many small steps) zooms smoothly at the pointer', z3 > z0 * 1.2 && near(w0, w3), { z0, z3, w3 });
  await h.shot('pinched');
  // the wheel without Ctrl still just scrolls
  const top0 = await h.js(`document.getElementById('stage').scrollTop`);
  await h.wheel(w0.x, w0.y, -120, [], 400);
  h.ok('the wheel without Ctrl scrolls, no zoom', (await pct()) === z3 && (await h.js(`document.getElementById('stage').scrollTop`)) > top0);
};
