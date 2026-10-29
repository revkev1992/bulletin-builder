// GUI suite: a right-tabbed line beside a wrapped margin note ("SERMON ⇥ Rev. …") stays beside it, its
// right stop moved to the note's edge — it used to drop below the note (its stop lies under the note).
// Built in the live window with the real renderer's tab solver.
exports.run = async (h) => {
  const r = await h.js(`(async () => {
    const { layoutTabs } = await import('./render.js');
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:40px;top:40px;width:400pt;background:#fff;z-index:999999;font:11pt Palatino Linotype';
    host.innerHTML = '<div class="frame"><div class="text-area" data-wpt="400" style="width:400pt"><div class="flow">' +
      '<div class="wrap-float" style="float:right;width:120pt;height:40pt"></div>' +
      '<p class="para" data-block="b1" data-tabs=\\'[{"pos":396,"align":"right"}]\\' style="margin:0">SERMON<span class="tab" style="display:inline-block"></span><span class="seg">Rev. Kevin Quick</span></p>' +
      '<p class="para" data-block="b2" data-tabs=\\'[{"pos":396,"align":"right"}]\\' style="margin:0">HYMN<span class="tab" style="display:inline-block"></span><span class="seg">Far Past the Note</span></p>' +
      '</div></div></div>';
    document.body.appendChild(host);
    const fl = host.querySelector('.wrap-float').getBoundingClientRect();
    // the second line starts below the note: its stop is the frame's own
    host.querySelectorAll('p')[1].style.marginTop = '40pt';
    layoutTabs(host);
    const [p1, p2] = [...host.querySelectorAll('p')];
    const seg1 = p1.querySelector('.seg').getBoundingClientRect(), seg2 = p2.querySelector('.seg').getBoundingClientRect();
    const out = { p1Top: p1.getBoundingClientRect().top, flTop: fl.top, flBottom: fl.bottom, flLeft: fl.left, seg1Right: seg1.right, seg2Right: seg2.right,
      areaRight: host.querySelector('.text-area').getBoundingClientRect().right, lines1: p1.getClientRects().length };
    host.remove();
    return out; })()`);
  h.ok('a right-tabbed line beside a note stays on its own line, beside the note', Math.abs(r.p1Top - r.flTop) < 2, r);
  h.ok('…its right-aligned text ends at the note\'s edge', r.seg1Right <= r.flLeft + 1 && r.seg1Right > r.flLeft - 6, r);
  h.ok('…a right-tabbed line clear of the note still ends at the frame\'s right stop', Math.abs(r.seg2Right - (r.areaRight - 4 * 96 / 72)) < 3, r);
};
