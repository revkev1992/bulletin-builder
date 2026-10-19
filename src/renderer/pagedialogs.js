// Publisher's page dialogs: Insert Page, Move Page, and the Delete confirmation.
// Each returns the page operation for src/pages.js, or null when cancelled.

function modal(title, bodyHtml, okLabel = 'OK') {
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

export async function deletePageDialog(current, frameCount) {
  const r = await modal('Delete Page',
    '<p>Delete page ' + current + (frameCount ? ' and the ' + frameCount + ' object' + (frameCount === 1 ? '' : 's') + ' on it' : '') + '?</p>' +
    '<p class="pd-note">Later pages move up one number. A copy of the week before the change is kept in its history folder.</p>', 'Delete');
  return r ? { type: 'delete', pages: [current] } : null;
}
