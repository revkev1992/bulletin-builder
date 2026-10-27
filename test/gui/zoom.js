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
};
