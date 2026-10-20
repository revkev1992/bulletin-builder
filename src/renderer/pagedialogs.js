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
    '<label class="pd-row">Left: <input name="indentLeft" type="number" step="0.05" value="' + inch(s.indentLeft) + '">"</label>' +
    '<label class="pd-row">First line: <input name="indentFirst" type="number" step="0.05" value="' + inch(s.indentFirst) + '">"</label>' +
    '<label class="pd-row">Right: <input name="indentRight" type="number" step="0.05" value="' + inch(s.indentRight) + '">"</label></fieldset>' +
    '<fieldset><legend>Line spacing</legend>' +
    '<label class="pd-row">Before paragraphs: <input name="spaceBefore" type="number" step="1" min="0" value="' + (s.spaceBefore || 0) + '"> pt</label>' +
    '<label class="pd-row">After paragraphs: <input name="spaceAfter" type="number" step="1" min="0" value="' + (s.spaceAfter || 0) + '"> pt</label>' +
    '<label class="pd-row">Between lines: <input name="lineSpacing" type="number" step="0.05" min="0.5" value="' + ls + '"> sp</label></fieldset>');
  if (!r) return null;
  const n = (k) => parseFloat(r[k]);
  return { indentLeft: n('indentLeft') * 72, indentFirst: n('indentFirst') * 72, indentRight: n('indentRight') * 72,
    spaceBefore: n('spaceBefore'), spaceAfter: n('spaceAfter'), lineSpacing: n('lineSpacing') };
}

export async function deletePageDialog(current, frameCount) {
  const r = await modal('Delete Page',
    '<p>Delete page ' + current + (frameCount ? ' and the ' + frameCount + ' object' + (frameCount === 1 ? '' : 's') + ' on it' : '') + '?</p>' +
    '<p class="pd-note">Later pages move up one number. A copy of the week before the change is kept in its history folder.</p>', 'Delete');
  return r ? { type: 'delete', pages: [current] } : null;
}
