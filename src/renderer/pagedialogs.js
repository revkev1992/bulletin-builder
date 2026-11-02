// Publisher's page dialogs: Insert Page, Move Page, and the Delete confirmation.
// Each returns the page operation for src/pages.js, or null when cancelled.

// setup(dialog) runs once the dialog is on the page (wire up controls, choose what to focus)
export function modal(title, bodyHtml, okLabel = 'OK', setup = null) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.className = 'pub-dialog';
    d.innerHTML = '<form method="dialog"><div class="pd-title">' + title + '</div><div class="pd-body">' + bodyHtml +
      '</div><div class="pd-buttons"><button value="ok" class="pd-ok">' + okLabel + '</button><button value="cancel" formnovalidate>Cancel</button></div></form>';
    document.body.appendChild(d);
    d.addEventListener('close', () => {
      const ok = d.returnValue === 'ok';
      const form = d.querySelector('form');
      const data = ok ? Object.fromEntries(new FormData(form)) : null;
      d.remove();
      resolve(data);
    });
    d.showModal();
    const first = d.querySelector('input:not([type=radio]), select');
    if (first) first.focus();
    if (setup) setup(d);
  });
}

const options = (pages, sel) => pages.map((n) => '<option value="' + n + '"' + (n === sel ? ' selected' : '') + '>' + n + '</option>').join('');

// Insert ▸ Page ▸ Insert Page… — Publisher's dialog
export async function insertPageDialog(current, pages, preset) {
  const booklet = /booklet/.test(preset || '');
  const r = await modal('Insert Page',
    '<label class="pd-row">Number of new pages: <input name="count" type="number" min="1" max="32" value="' + (booklet ? 4 : 1) + '" required></label>' +
    '<fieldset><legend>Position</legend>' +
    '<label><input type="radio" name="where" value="before"> Before current page</label>' +
    '<label><input type="radio" name="where" value="after" checked> After current page</label></fieldset>' +
    '<fieldset><legend>Options</legend>' +
    '<label><input type="radio" name="mode" value="blank" checked> Insert blank pages</label>' +
    '<label class="todo" title="Coming soon"><input type="radio" name="mode" value="textbox" disabled> Create one text box on each page</label>' +
    '<label><input type="radio" name="mode" value="duplicate"> Duplicate all objects on page: <select name="dup">' + options(pages, current) + '</select></label></fieldset>' +
    '<div class="pd-note">Current page: ' + current + (booklet ? ' · a folded booklet needs pages in fours' : '') + '</div>');
  if (!r) return null;
  const op = { type: 'insert', ref: current, where: r.where, count: parseInt(r.count, 10) || 1 };
  if (r.mode === 'duplicate') op.duplicate = parseInt(r.dup, 10);
  return op;
}

// Page Design ▸ Pages ▸ Move — Publisher's Move Page dialog
export async function movePageDialog(current, pages) {
  const others = pages.filter((n) => n !== current);
  const r = await modal('Move Page',
    '<div class="pd-row">Move page ' + current + '</div>' +
    '<fieldset><legend>Move selected page</legend>' +
    '<label><input type="radio" name="where" value="before" checked> Before</label>' +
    '<label><input type="radio" name="where" value="after"> After</label>' +
    '<label class="pd-row">page: <select name="ref">' + options(others, others.find((n) => n > current) ?? others[others.length - 1]) + '</select></label></fieldset>');
  if (!r) return null;
  return { type: 'move', pages: [current], ref: parseInt(r.ref, 10), where: r.where };
}

// Home ▸ Paragraph ▸ Line Spacing ▸ Paragraph… — Publisher's Paragraph dialog (indents + spacing)
export async function paragraphDialog(s = {}) {
  const inch = (v) => ((v || 0) / 72).toFixed(2);
  const ls = (s.lineSpacing && s.lineSpacing.multiple) || 1;
  const r = await modal('Paragraph',
    '<fieldset><legend>Indentation</legend>' +
    '<label class="pd-row">Left: <input name="indentLeft" type="number" step="any" value="' + inch(s.indentLeft) + '">"</label>' +
    '<label class="pd-row">First line: <input name="indentFirst" type="number" step="any" value="' + inch(s.indentFirst) + '">"</label>' +
    '<label class="pd-row">Right: <input name="indentRight" type="number" step="any" value="' + inch(s.indentRight) + '">"</label></fieldset>' +
    '<fieldset><legend>Line spacing</legend>' +
    '<label class="pd-row">Before paragraphs: <input name="spaceBefore" type="number" step="any" min="0" value="' + (s.spaceBefore || 0) + '"> pt</label>' +
    '<label class="pd-row">After paragraphs: <input name="spaceAfter" type="number" step="any" min="0" value="' + (s.spaceAfter || 0) + '"> pt</label>' +
    '<label class="pd-row">Between lines: <input name="lineSpacing" type="number" step="any" min="0.5" value="' + ls + '"> sp</label></fieldset>');
  if (!r) return null;
  const n = (k) => parseFloat(r[k]);
  return { indentLeft: n('indentLeft') * 72, indentFirst: n('indentFirst') * 72, indentRight: n('indentRight') * 72,
    spaceBefore: n('spaceBefore'), spaceAfter: n('spaceAfter'), lineSpacing: n('lineSpacing') };
}

// Home ▸ Styles ▸ right-click ▸ Modify… — Publisher's Modify Style dialog (the parts that matter:
// font, size, bold/italic, colour, alignment, spacing, indents). `st` is a normalised style
// ({ name, run, para }); returns the new normalised style, or null when cancelled.
export async function styleDialog(st, fonts) {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const run = st.run || {}, para = st.para || {};
  const list = fonts.includes(run.font) || !run.font ? fonts : [run.font, ...fonts];
  const inch = (v) => ((v || 0) / 72).toFixed(2);
  const ls = (para.lineSpacing && para.lineSpacing.multiple) || (para.lineSpacing && para.lineSpacing.exact ? 0 : 1);
  const r = await modal('Modify Style — ' + esc(st.name),
    '<fieldset><legend>Font</legend>' +
    '<label class="pd-row">Font: <select name="font">' + list.map((f) => '<option' + (f === run.font ? ' selected' : '') + '>' + esc(f) + '</option>').join('') + '</select></label>' +
    '<label class="pd-row">Size: <input name="size" type="number" step="any" min="4" max="144" value="' + (run.size || 11) + '"> pt</label>' +
    '<div class="pd-row"><label><input type="checkbox" name="bold"' + (run.bold ? ' checked' : '') + '> Bold</label> &nbsp; <label><input type="checkbox" name="italic"' + (run.italic ? ' checked' : '') + '> Italic</label>' +
    ' &nbsp; <label><input type="checkbox" name="smallCaps"' + (run.smallCaps ? ' checked' : '') + '> Small caps</label></div>' +
    '<label class="pd-row">Colour: <input name="color" type="color" value="' + esc(run.color || '#000000') + '"></label></fieldset>' +
    '<fieldset><legend>Paragraph</legend>' +
    '<label class="pd-row">Alignment: <select name="align">' + ['left', 'center', 'right', 'justify'].map((a) => '<option' + (a === (para.align || 'left') ? ' selected' : '') + '>' + a + '</option>').join('') + '</select></label>' +
    '<label class="pd-row">Before: <input name="spaceBefore" type="number" step="any" min="0" value="' + (para.spaceBefore || 0) + '"> pt &nbsp; After: <input name="spaceAfter" type="number" step="any" min="0" value="' + (para.spaceAfter || 0) + '"> pt</label>' +
    '<label class="pd-row">Line spacing: <input name="lineSpacing" type="number" step="any" min="0.5" value="' + ls + '"> sp</label>' +
    '<label class="pd-row">Indent left: <input name="indentLeft" type="number" step="any" value="' + inch(para.indentLeft) + '">" &nbsp; first line: <input name="indentFirst" type="number" step="any" value="' + inch(para.indentFirst) + '">"</label></fieldset>' +
    '<p class="pd-note">Every paragraph in this week that uses the style changes to match. Undo takes it back.</p>');
  if (!r) return null;
  const n = (k) => parseFloat(r[k]);
  const out = { name: st.name, run: { font: r.font, size: n('size') || 11 }, para: { align: r.align } };
  if (r.bold) out.run.bold = true;
  if (r.italic) out.run.italic = true;
  if (r.smallCaps) out.run.smallCaps = true;
  if (r.color && r.color.toUpperCase() !== '#000000') out.run.color = r.color.toUpperCase();
  for (const k of ['underline', 'allCaps', 'strike', 'tracking']) if (run[k] != null) out.run[k] = run[k];   // not in the dialog: kept
  if (n('spaceBefore')) out.para.spaceBefore = n('spaceBefore');
  if (n('spaceAfter')) out.para.spaceAfter = n('spaceAfter');
  if (n('lineSpacing') && Math.abs(n('lineSpacing') - 1) > 0.001) out.para.lineSpacing = { multiple: n('lineSpacing') };
  if (n('indentLeft')) out.para.indentLeft = Math.round(n('indentLeft') * 72 * 100) / 100;
  if (n('indentFirst')) out.para.indentFirst = Math.round(n('indentFirst') * 72 * 100) / 100;
  if (para.indentRight) out.para.indentRight = para.indentRight;
  if (para.keepWithNext) out.para.keepWithNext = true;
  return out;
}

// Page Design ▸ Page Setup (Margins / Size): Publisher's Page Setup dialog. `m` is the manifest;
// `focus` names the part to put the cursor in. Returns { page, preset, margins } or null.
export const PRESETS = {
  'legal-booklet': { label: 'Legal booklet — 7 × 8.5 in pages (8.5 × 14 folded)', width: 504, height: 612 },
  'tabloid-booklet': { label: 'Tabloid booklet — 8.5 × 11 in pages (11 × 17 folded)', width: 612, height: 792 },
  'letter-sheet': { label: 'Letter sheet — 8.5 × 11 in, front and back', width: 612, height: 792 },
  custom: { label: 'Custom size', width: 0, height: 0 },
};
export async function pageSetupDialog(m, focus = 'margins') {
  const inch = (v) => (Math.round(((v || 0) / 72) * 1000) / 1000).toString();
  const pg = m.page || { width: 504, height: 612 }, mg = m.margins || {};
  const known = Object.keys(PRESETS).find((k) => k !== 'custom' && k === m.preset && Math.abs(PRESETS[k].width - Math.min(pg.width, pg.height)) < 0.5 && Math.abs(PRESETS[k].height - Math.max(pg.width, pg.height)) < 0.5);
  const preset = known || 'custom';
  const landscape = pg.width > pg.height;
  const r = await modal('Page Setup',
    '<fieldset><legend>Page</legend>' +
    '<label class="pd-row">Size: <select name="preset" id="ps-preset">' + Object.entries(PRESETS).map(([k, p]) => '<option value="' + k + '"' + (k === preset ? ' selected' : '') + '>' + p.label + '</option>').join('') + '</select></label>' +
    '<label class="pd-row">Width: <input name="width" id="ps-width" type="number" step="any" min="1" max="48" value="' + inch(Math.min(pg.width, pg.height)) + '">" &nbsp; Height: <input name="height" id="ps-height" type="number" step="any" min="1" max="48" value="' + inch(Math.max(pg.width, pg.height)) + '">"</label>' +
    '<div class="pd-row"><label><input type="radio" name="orient" value="portrait"' + (landscape ? '' : ' checked') + '> Portrait</label> &nbsp; <label><input type="radio" name="orient" value="landscape"' + (landscape ? ' checked' : '') + '> Landscape</label></div></fieldset>' +
    '<fieldset><legend>Margin guides</legend>' +
    '<label class="pd-row">Top: <input name="top" type="number" step="any" min="0" value="' + inch(mg.top ?? 36) + '">" &nbsp; Bottom: <input name="bottom" type="number" step="any" min="0" value="' + inch(mg.bottom ?? 36) + '">"</label>' +
    '<label class="pd-row"><span class="ps-in">Inside</span>: <input name="inside" type="number" step="any" min="0" value="' + inch(mg.inside ?? mg.left ?? 36) + '">" &nbsp; <span class="ps-out">Outside</span>: <input name="outside" type="number" step="any" min="0" value="' + inch(mg.outside ?? mg.right ?? 36) + '">"</label>' +
    '<label><input type="checkbox" name="mirror"' + (mg.mirror !== false ? ' checked' : '') + '> Two-page master (mirrored: inside / outside margins)</label></fieldset>' +
    '<p class="pd-note">Applies to every page of the week. Objects stay where they are; the worship pages are laid out again on the new margins. This cannot be undone with Undo (a copy of the week is kept in its history folder).</p>',
    'OK', (d) => {
      const sel = d.querySelector('#ps-preset'), w = d.querySelector('#ps-width'), hgt = d.querySelector('#ps-height');
      const sync = () => { const p = PRESETS[sel.value]; const custom = sel.value === 'custom'; w.readOnly = hgt.readOnly = !custom; if (!custom) { w.value = inch(p.width); hgt.value = inch(p.height); } };
      sel.addEventListener('change', sync);
      sync();
      const f = d.querySelector(focus === 'size' ? '#ps-preset' : 'input[name="top"]');
      if (f) f.focus();
    });
  if (!r) return null;
  const n = (k) => Math.round(parseFloat(r[k]) * 72 * 100) / 100;
  let width = n('width'), height = n('height');
  if (!(width > 0) || !(height > 0)) return null;
  if (r.preset !== 'custom') { width = PRESETS[r.preset].width; height = PRESETS[r.preset].height; }
  if ((r.orient === 'landscape') !== (width > height)) [width, height] = [height, width];
  return { page: { width, height }, preset: r.preset,
    margins: { top: n('top'), bottom: n('bottom'), inside: n('inside'), outside: n('outside'), mirror: !!r.mirror } };
}

// Insert ▸ Link (Ctrl+K): Publisher's Insert Hyperlink, the useful part — text to display + address.
// `text` = the selected text (fixed) or '' (typed here); `link` = the address already there, if any.
// Returns { text, url } (url '' = remove the link) or null.
export async function linkDialog(text, link) {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const r = await modal(link ? 'Edit Hyperlink' : 'Insert Hyperlink',
    '<label class="pd-row">Text to display: <input name="text" value="' + esc(text) + '"' + (text ? ' readonly' : ' required') + ' style="width:260px"></label>' +
    '<label class="pd-row">Address: <input name="url" value="' + esc(link || '') + '" placeholder="www.highlandumc.org  or  someone@example.org" style="width:260px"></label>' +
    '<p class="pd-note">A web address or an e-mail address. ' + (link ? 'Leave the address empty to remove the link. ' : '') + 'The link works in the PDF and on the website; in Bulletin Builder, Ctrl+click opens it.</p>',
    'OK', (d) => { d.querySelector(text ? 'input[name="url"]' : 'input[name="text"]').focus(); });
  if (!r) return null;
  let url = String(r.url || '').trim();
  if (url && !/^[a-z][a-z0-9+.-]*:/i.test(url)) url = (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(url) ? 'mailto:' : 'https://') + url;
  return { text: String(r.text || '').trim(), url };
}

// Page Design ▸ Pages ▸ Rename (and the Pages pane's right-click): a name for the page
export async function renamePageDialog(n, name) {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const r = await modal('Rename Page ' + n, '<label class="pd-row">Page name: <input name="name" value="' + esc(name || '') + '" maxlength="60" style="width:240px"></label>' +
    '<p class="pd-note">Shown under the page in the Pages pane. Leave it empty for no name.</p>');
  return r ? String(r.name || '').trim() : null;
}

export async function deletePageDialog(current, frameCount) {
  const r = await modal('Delete Page',
    '<p>Delete page ' + current + (frameCount ? ' and the ' + frameCount + ' object' + (frameCount === 1 ? '' : 's') + ' on it' : '') + '?</p>' +
    '<p class="pd-note">Later pages move up one number. A copy of the week before the change is kept in its history folder.</p>', 'Delete');
  return r ? { type: 'delete', pages: [current] } : null;
}
