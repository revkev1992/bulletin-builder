// Options (Page Design ▸ Options, File ▸ Options) and File ▸ New ▸ blank page sizes (Publisher).
// Options are per PC (localStorage `bb.options`), never in a week: baseline guides (View ▸ Show ▸
// Baselines), how often autosave runs, the view a week opens in.
import { modal, PRESETS } from './pagedialogs.js';

const KEY = 'bb.options';
export const DEFAULTS = { baselineSpacing: 12, baselineOffset: 0, autosaveMinutes: 2, openView: 'spread' };

export function getOptions() {
  let o = {};
  try { o = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) { o = {}; }
  const out = { ...DEFAULTS, ...o };
  out.baselineSpacing = Math.max(4, Math.min(72, Number(out.baselineSpacing) || DEFAULTS.baselineSpacing));
  out.baselineOffset = Math.max(-72, Math.min(72, Number(out.baselineOffset) || 0));
  out.autosaveMinutes = Math.max(0.5, Math.min(60, Number(out.autosaveMinutes) || DEFAULTS.autosaveMinutes));
  out.openView = out.openView === 'single' ? 'single' : 'spread';
  return out;
}
export function setOptions(o) {
  try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (_) { /* per-PC convenience only */ }
  applyOptions();
}
// the CSS side (baseline guides are drawn by CSS from these variables)
export function applyOptions() {
  const o = getOptions();
  document.documentElement.style.setProperty('--bl-spacing', o.baselineSpacing + 'pt');
  document.documentElement.style.setProperty('--bl-offset', o.baselineOffset + 'pt');
  window.__bbOptions = o;
  return o;
}

export async function optionsDialog() {
  const o = getOptions();
  const r = await modal('Bulletin Builder Options',
    '<fieldset><legend>Baseline guides (View ▸ Show ▸ Baselines)</legend>' +
    '<label class="pd-row">Spacing: <input name="baselineSpacing" type="number" step="any" min="4" max="72" value="' + o.baselineSpacing + '"> pt</label>' +
    '<label class="pd-row">Offset from the top margin: <input name="baselineOffset" type="number" step="any" min="-72" max="72" value="' + o.baselineOffset + '"> pt</label>' +
    '<p class="pd-note">Horizontal guides every so many points down each page, from the top margin — for lining up text across columns. Never printed.</p></fieldset>' +
    '<fieldset><legend>Saving</legend>' +
    '<label class="pd-row">Autosave every <input name="autosaveMinutes" type="number" step="any" min="0.5" max="60" value="' + o.autosaveMinutes + '"> minutes</label>' +
    '<p class="pd-note">While you are editing a half, your changes are written that often (never in the middle of typing). A copy of the previous version goes in the week\'s history folder every time.</p></fieldset>' +
    '<fieldset><legend>View</legend>' +
    '<label class="pd-row">Open a week in: <select name="openView"><option value="spread"' + (o.openView === 'spread' ? ' selected' : '') + '>Two-Page Spread</option><option value="single"' + (o.openView === 'single' ? ' selected' : '') + '>Single Page</option></select></label></fieldset>' +
    '<p class="pd-note">These settings are kept on this PC.</p>');
  if (!r) return null;
  const next = { baselineSpacing: parseFloat(r.baselineSpacing), baselineOffset: parseFloat(r.baselineOffset), autosaveMinutes: parseFloat(r.autosaveMinutes), openView: r.openView };
  setOptions(next);
  return getOptions();
}

// File ▸ New ▸ Blank 8.5 x 11" / More Blank Page Sizes — Publisher's blank-document sizes. Returns the
// setup for main's week:new-blank, or null.
export async function newBlankDialog(presetKey) {
  const inch = (v) => (Math.round((v / 72) * 1000) / 1000).toString();
  const preset = presetKey && PRESETS[presetKey] ? presetKey : 'letter-sheet';
  const r = await modal('New Blank Document',
    '<label class="pd-row">Name: <input name="name" value="New document" required></label>' +
    '<fieldset><legend>Page</legend>' +
    '<label class="pd-row">Size: <select name="preset" id="nb-preset">' + Object.entries(PRESETS).map(([k, p]) => '<option value="' + k + '"' + (k === preset ? ' selected' : '') + '>' + p.label + '</option>').join('') + '</select></label>' +
    '<label class="pd-row">Width: <input name="width" id="nb-width" type="number" step="any" min="1" max="48" value="' + inch(PRESETS[preset].width) + '">" &nbsp; Height: <input name="height" id="nb-height" type="number" step="any" min="1" max="48" value="' + inch(PRESETS[preset].height) + '">"</label>' +
    '<div class="pd-row"><label><input type="radio" name="orient" value="portrait" checked> Portrait</label> &nbsp; <label><input type="radio" name="orient" value="landscape"> Landscape</label></div>' +
    '<label class="pd-row">Pages: <input name="pages" id="nb-pages" type="number" min="1" max="64" value="' + (/booklet/.test(preset) ? 8 : 1) + '"></label></fieldset>' +
    '<fieldset><legend>The pages belong to</legend>' +
    '<label><input type="radio" name="half" value="announcements" checked> Announcements (the communications person)</label>' +
    '<label><input type="radio" name="half" value="worship"> Worship (the music director)</label></fieldset>' +
    '<p class="pd-note">A new folder with empty pages, kept beside the weeks (you choose where next). Margins 0.5". A folded booklet needs pages in fours.</p>', 'Create', (d) => {
      const sel = d.querySelector('#nb-preset'), w = d.querySelector('#nb-width'), h = d.querySelector('#nb-height'), pg = d.querySelector('#nb-pages');
      const sync = () => { const p = PRESETS[sel.value]; const custom = sel.value === 'custom'; w.readOnly = h.readOnly = !custom; if (!custom) { w.value = inch(p.width); h.value = inch(p.height); pg.value = /booklet/.test(sel.value) ? 8 : 1; } };
      sel.addEventListener('change', sync);
      sync();
    });
  if (!r) return null;
  let width = parseFloat(r.width) * 72, height = parseFloat(r.height) * 72;
  if (r.preset !== 'custom') { width = PRESETS[r.preset].width; height = PRESETS[r.preset].height; }
  if (r.orient === 'landscape') [width, height] = [Math.max(width, height), Math.min(width, height)];
  else [width, height] = [Math.min(width, height), Math.max(width, height)];
  return { name: r.name, preset: r.preset, page: { width: Math.round(width * 100) / 100, height: Math.round(height * 100) / 100 }, pages: parseInt(r.pages, 10) || 1, half: r.half };
}
