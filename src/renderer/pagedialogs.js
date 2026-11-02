// Publisher's page dialogs: Insert Page, Move Page, and the Delete confirmation.
// Each returns the page operation for src/pages.js, or null when cancelled.

export function modal(title, bodyHtml, okLabel = 'OK') {
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

export async function deletePageDialog(current, frameCount) {
  const r = await modal('Delete Page',
    '<p>Delete page ' + current + (frameCount ? ' and the ' + frameCount + ' object' + (frameCount === 1 ? '' : 's') + ' on it' : '') + '?</p>' +
    '<p class="pd-note">Later pages move up one number. A copy of the week before the change is kept in its history folder.</p>', 'Delete');
  return r ? { type: 'delete', pages: [current] } : null;
}
