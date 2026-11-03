// GUI suite: the compact ribbon — in a narrow window (two windows side by side) the big buttons drop
// their words at 1280 px and the small ones at 1000 px, so the View tab's last group stays reachable;
// narrower still, the ribbon scrolls. Back to full width, the words return.
exports.run = async (h) => {
  const labelShown = (sel) => h.js(`(() => { const l = document.querySelector('${sel} .rb-label'); return l ? getComputedStyle(l).display !== 'none' : null; })()`);
  const rightEdge = (sel) => h.js(`(() => { const e = document.querySelector('${sel}'); return e ? Math.round(e.getBoundingClientRect().right) : null; })()`);
  const width = () => h.js('innerWidth');
  await h.clickSel('.rb-tab[data-tab="view"]');
  h.ok('full width: big buttons show their words', (await labelShown('#rb-switchwin')) === true);

  h.win.setBounds({ x: 40, y: 40, width: 1100, height: 900 });
  await h.wait(600);
  h.ok('at 1100 px the big buttons are icon-only', (await width()) <= 1280 && (await labelShown('#rb-switchwin')) === false && (await labelShown('#rb-single')) === false);
  h.ok('…and the View tab\'s Switch Windows still sits inside the window', (await rightEdge('#rb-switchwin')) <= (await width()));
  h.ok('…small buttons keep their words at this width', (await labelShown('#zoom-width')) === true);
  await h.shot('compact-1100');

  h.win.setBounds({ x: 40, y: 40, width: 900, height: 800 });
  await h.wait(600);
  h.ok('at 900 px the small buttons are icon-only too', (await labelShown('#zoom-width')) === false);
  // whatever is still past the edge is reachable by scrolling the ribbon (the harness scrolls like a person would)
  await h.clickSel('.rb-tab[data-tab="insert"]');
  const r = await h.clickSel('#ins-bookmark');
  h.ok('a button at the far end of a wide tab can still be reached (ribbon scrolls)', !!r && r.x >= 0 && r.x < (await width()));
  await h.key('Escape', [], 300);
  await h.shot('compact-900');

  h.win.setBounds({ x: 40, y: 40, width: 1500, height: 900 });
  await h.wait(600);
  await h.clickSel('.rb-tab[data-tab="view"]');
  h.ok('back at full width the words return', (await labelShown('#rb-switchwin')) === true && (await labelShown('#zoom-width')) === true);
};
