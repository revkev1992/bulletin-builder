// GUI suite: View ▸ Window — New Window (this week again), Arrange All (tiled), Cascade (stepped), Switch
// Windows (a list; picking one focuses it). Runs in the main process, so the windows' bounds are read directly.
const { BrowserWindow } = require('electron');

exports.run = async (h) => {
  const viewers = () => BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed() && w.isVisible() && !w.webContents.getURL().includes('mode=print'));
  h.win.show();                 // the harness window is hidden; a person's window is not
  await h.wait(400);
  const n0 = viewers().length;
  await h.clickSel('.rb-tab[data-tab="view"]');
  for (const id of ['#rb-newwin', '#rb-arrangeall', '#rb-cascade', '#rb-switchwin']) h.ok('View ▸ Window has ' + id.slice(4), !(await h.disabled(id)));

  // New Window: a second window on the same week
  await h.clickSel('#rb-newwin');
  const t0 = Date.now();
  while (viewers().length < n0 + 1 && Date.now() - t0 < 8000) await h.wait(100);
  h.ok('New Window opens a second Bulletin Builder window', viewers().length === n0 + 1, { before: n0, after: viewers().length });
  const second = viewers().find((w) => w !== h.win);
  if (second) {
    await new Promise((r) => { if (!second.webContents.isLoading()) r(); else second.webContents.once('did-finish-load', r); });
    await h.wait(1500);
    const title = await second.webContents.executeJavaScript('document.title');
    h.ok('…on the same week', /9-20-26 1100/.test(title), { title });
  }
  // the first window keeps the input (it is the one the harness drives)
  h.win.focus();
  await h.wait(300);

  // Arrange All: the two windows share the work area side by side, no overlap
  await h.clickSel('.rb-tab[data-tab="view"]');
  await h.clickSel('#rb-arrangeall');
  await h.wait(800);
  const b = viewers().map((w) => w.getBounds()).sort((p, q) => p.x - q.x);
  h.ok('Arrange All tiles the windows side by side', b.length >= 2 && b[0].x + b[0].width <= b[1].x + 2 && Math.abs(b[0].width - b[1].width) <= 2, { b });
  await h.shot('arranged');

  // Cascade: stepped down and to the right (at half the screen the ribbon's Window group is off the right
  // edge — the ribbon does not collapse yet — so the driven window is widened again first)
  h.win.setBounds({ x: 40, y: 40, width: 1500, height: 900 });
  h.win.focus();
  await h.wait(400);
  await h.clickSel('.rb-tab[data-tab="view"]');
  await h.clickSel('#rb-cascade');
  await h.wait(800);
  const c = viewers().map((w) => w.getBounds()).sort((p, q) => p.x - q.x);
  h.ok('Cascade steps the windows', c.length >= 2 && c[1].x - c[0].x === 36 && c[1].y - c[0].y === 36, { c });

  // Switch Windows lists both; picking the other focuses it
  h.win.focus();
  await h.wait(300);
  await h.clickSel('.rb-tab[data-tab="view"]');
  await h.clickSel('#rb-switchwin');
  await h.until(`document.querySelectorAll('.ctx-menu.win-menu button').length >= 2`, 3000);   // the list is fetched from the main process
  const items = await h.js(`[...document.querySelectorAll('.ctx-menu.win-menu button')].map((b) => b.textContent.trim())`);
  h.ok('Switch Windows lists the open windows, this one ticked', items.length === viewers().length && items.some((t) => t.startsWith('✓')), { items });
  const other = await h.rect('.ctx-menu.win-menu button:not([data-cmd*="' + h.win.id + '"])');
  if (other) {
    await h.click(other.cx, other.cy);
    await h.wait(600);
    h.ok('…picking the other window brings it to the front', second && second.isFocused(), { focused: viewers().map((w) => w.isFocused()) });
  } else h.ok('…picking the other window brings it to the front', false, { items });

  // tidy up: close the second window, give the first its size back
  if (second && !second.isDestroyed()) second.destroy();
  await h.wait(300);
  h.win.setBounds({ x: 40, y: 40, width: 1500, height: 900 });
  h.win.focus();
  await h.wait(300);
  h.ok('the second window is closed again', viewers().length === n0);
};
