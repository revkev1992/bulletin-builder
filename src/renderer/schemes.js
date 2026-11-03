// Page Design ▸ Schemes (Publisher): a COLOUR scheme = eight named colours (Main, Accent 1–5, Hyperlink,
// Followed Hyperlink) that every colour picker offers first; a FONT scheme = a heading + body font pair
// listed first in the Font box and used for new text boxes and tables. Both are kept in the week's
// manifest (colorScheme / fontScheme) so the whole week, both halves, shares them. Choosing a scheme
// does not recolour what is already on the pages (our runs store plain hex, as Publisher's "custom"
// colours do) — it changes what the pickers offer, which is what the seasons need.
export const SLOTS = ['Main', 'Accent 1', 'Accent 2', 'Accent 3', 'Accent 4', 'Accent 5', 'Hyperlink', 'Followed hyperlink'];

export const COLOR_SCHEMES = [
  // the church year first (Kevin's seasons)
  { id: 'advent', name: 'Advent', colors: ['#000000', '#4B2C7F', '#1F3A93', '#7A5DB5', '#C9B8E8', '#D4AF37', '#1F3A93', '#4B2C7F'] },
  { id: 'christmas', name: 'Christmas', colors: ['#000000', '#B8860B', '#8B0000', '#0B6623', '#F5E6B3', '#FFFFFF', '#8B0000', '#B8860B'] },
  { id: 'epiphany', name: 'Epiphany', colors: ['#000000', '#1C6E3F', '#D4AF37', '#2E8B57', '#CFE8D5', '#F3E5AB', '#1C6E3F', '#2E8B57'] },
  { id: 'lent', name: 'Lent', colors: ['#000000', '#5B2C6F', '#7D3C98', '#4A235A', '#D7BDE2', '#A569BD', '#5B2C6F', '#7D3C98'] },
  { id: 'holyweek', name: 'Holy Week', colors: ['#000000', '#7B1E1E', '#3B3B3B', '#5B2C6F', '#E6D5D5', '#9E9E9E', '#7B1E1E', '#3B3B3B'] },
  { id: 'easter', name: 'Easter', colors: ['#000000', '#C9A227', '#FFFFFF', '#F2D16B', '#FFF4CC', '#E8B04B', '#9C7A1C', '#C9A227'] },
  { id: 'pentecost', name: 'Pentecost', colors: ['#000000', '#C0392B', '#E74C3C', '#F39C12', '#FADBD8', '#F5B7B1', '#C0392B', '#922B21'] },
  { id: 'ordinary', name: 'Ordinary Time', colors: ['#000000', '#1E7B4E', '#2E8B57', '#145A32', '#D5F5E3', '#82E0AA', '#1E7B4E', '#145A32'] },
  { id: 'allsaints', name: 'All Saints', colors: ['#000000', '#B8860B', '#FFFFFF', '#2C3E50', '#F7F1DC', '#D4AF37', '#2C3E50', '#B8860B'] },
  // Publisher's classics
  { id: 'office', name: 'Office', colors: ['#000000', '#1F497D', '#C0504D', '#4F81BD', '#EEECE1', '#9BBB59', '#0000FF', '#800080'] },
  { id: 'aqua', name: 'Aqua', colors: ['#000000', '#006699', '#3399CC', '#99CCFF', '#CCFFFF', '#66CCCC', '#0066CC', '#660066'] },
  { id: 'bluebird', name: 'Bluebird', colors: ['#000000', '#003366', '#336699', '#6699CC', '#CCCCFF', '#99CCFF', '#0000FF', '#800080'] },
  { id: 'civic', name: 'Civic', colors: ['#000000', '#D16349', '#CCB400', '#8CADAE', '#8C7B70', '#8FB08C', '#D16349', '#CCB400'] },
  { id: 'clay', name: 'Clay', colors: ['#000000', '#993300', '#CC6600', '#FF9933', '#FFCC99', '#996633', '#CC6600', '#993300'] },
  { id: 'garnet', name: 'Garnet', colors: ['#000000', '#800000', '#993366', '#CC9999', '#FFCCCC', '#996666', '#800000', '#660066'] },
  { id: 'iris', name: 'Iris', colors: ['#000000', '#333399', '#6666CC', '#9999FF', '#CCCCFF', '#666699', '#333399', '#663399'] },
  { id: 'marine', name: 'Marine', colors: ['#000000', '#003366', '#006666', '#339999', '#CCFFFF', '#669999', '#006666', '#003366'] },
  { id: 'meadow', name: 'Meadow', colors: ['#000000', '#336633', '#669933', '#99CC66', '#CCFF99', '#99CC99', '#336633', '#669933'] },
  { id: 'moss', name: 'Moss', colors: ['#000000', '#666633', '#999966', '#CCCC99', '#FFFFCC', '#999933', '#666633', '#999966'] },
  { id: 'orchid', name: 'Orchid', colors: ['#000000', '#993399', '#CC66CC', '#FF99FF', '#FFCCFF', '#CC99CC', '#993399', '#660066'] },
  { id: 'prairie', name: 'Prairie', colors: ['#000000', '#996633', '#CC9966', '#FFCC99', '#FFFFCC', '#CCCC99', '#996633', '#663300'] },
  { id: 'sapphire', name: 'Sapphire', colors: ['#000000', '#000080', '#0000CC', '#3366FF', '#CCCCFF', '#6699FF', '#0000CC', '#000080'] },
  { id: 'spice', name: 'Spice', colors: ['#000000', '#990000', '#CC3300', '#FF6600', '#FFCC66', '#CC6633', '#990000', '#660000'] },
  { id: 'trek', name: 'Trek', colors: ['#000000', '#663300', '#996633', '#CC9966', '#FFCC99', '#999966', '#663300', '#333300'] },
  { id: 'vineyard', name: 'Vineyard', colors: ['#000000', '#660033', '#993366', '#CC6699', '#FFCCCC', '#996699', '#660033', '#330033'] },
];

export const FONT_SCHEMES = [
  { id: 'highland', name: 'Highland (Archer / Palatino)', heading: 'Archer Bold', body: 'Palatino Linotype' },
  { id: 'palatino', name: 'Palatino', heading: 'Palatino Linotype', body: 'Palatino Linotype' },
  { id: 'antiqua', name: 'Book Antiqua', heading: 'Book Antiqua', body: 'Book Antiqua' },
  { id: 'avenir', name: 'Avenir Next', heading: 'Avenir Next LT Pro', body: 'Avenir Next LT Pro' },
  { id: 'candara', name: 'Candara', heading: 'Candara', body: 'Candara Light' },
  { id: 'office', name: 'Office (Calibri)', heading: 'Calibri', body: 'Calibri' },
  { id: 'traditional', name: 'Traditional (Georgia / Times)', heading: 'Georgia', body: 'Times New Roman' },
];

const ORDER = ['main', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'hyperlink', 'followed_hyperlink'];
// the week's current eight colours (the app's array form, or Publisher's imported object form)
export function schemeColors(manifest) {
  const cs = manifest && manifest.colorScheme;
  const office = COLOR_SCHEMES.find((s) => s.id === 'office').colors;
  if (!cs) return office.slice();
  if (Array.isArray(cs.colors)) return ORDER.map((_, i) => (cs.colors[i] || office[i]).toUpperCase());
  if (cs.colors && typeof cs.colors === 'object') return ORDER.map((k, i) => ((cs.colors[k] && cs.colors[k].hex) || office[i]).toUpperCase());
  return office.slice();
}
export const schemeName = (manifest) => (manifest && manifest.colorScheme && manifest.colorScheme.name) || 'Office';
export function fontScheme(manifest) {
  const fs = manifest && manifest.fontScheme;
  return fs && fs.body ? fs : { name: 'Palatino', heading: 'Palatino Linotype', body: 'Palatino Linotype' };
}
export const bodyFont = (manifest) => fontScheme(manifest).body;

// the ribbon: the scheme row at the top of every colour picker, and the Font box's first group
export function applySchemeToRibbon(manifest) {
  const colors = schemeColors(manifest);
  for (const b of document.querySelectorAll('.scheme-swatch')) {
    const i = Number(b.dataset.slot);
    b.dataset.color = colors[i];
    b.style.background = colors[i];
    b.title = SLOTS[i] + ' — ' + colors[i] + ' (' + schemeName(manifest) + ' scheme)';
  }
  const fs = fontScheme(manifest);
  const sel = document.getElementById('t-font');
  if (sel) {
    const cur = sel.value;
    let g = sel.querySelector('optgroup[data-scheme]');
    if (!g) { g = document.createElement('optgroup'); g.dataset.scheme = '1'; sel.prepend(g); }
    g.label = 'Scheme fonts';
    g.replaceChildren(...[...new Set([fs.heading, fs.body])].map((f) => new Option(f + (f === fs.heading && fs.heading !== fs.body ? ' (headings)' : ''), f)));
    if (cur) sel.value = cur;
  }
  const label = document.getElementById('pg-colorschemes');
  if (label) label.title = 'Colour scheme: ' + schemeName(manifest) + ' — the eight colours every colour picker offers first';
  const flabel = document.getElementById('pg-fonts');
  if (flabel) flabel.title = 'Font scheme: ' + fs.name + ' — ' + fs.heading + ' / ' + fs.body;
  for (const it of document.querySelectorAll('.cs-item')) it.classList.toggle('active', it.dataset.name === schemeName(manifest));
  for (const it of document.querySelectorAll('.fs-item')) it.classList.toggle('active', it.dataset.name === fs.name);
}

// menu html (ribbon.js puts it in the Color Schemes / Fonts drop-downs)
export const colorSchemeMenuHtml = () => '<div class="cs-list">' + COLOR_SCHEMES.map((s) => '<button type="button" class="cs-item" data-scheme="' + s.id + '" data-name="' + s.name + '">' +
  '<span class="cs-chips">' + s.colors.slice(1, 6).map((c) => '<i style="background:' + c + '"></i>').join('') + '</span><span>' + s.name + '</span></button>').join('') + '</div>';
export const fontSchemeMenuHtml = () => '<div class="cs-list">' + FONT_SCHEMES.map((s) => '<button type="button" class="fs-item" data-scheme="' + s.id + '" data-name="' + s.name + '">' +
  '<span class="fs-sample"><b style="font-family:\'' + s.heading + '\'">Aa</b><i style="font-family:\'' + s.body + '\'">Aa</i></span><span>' + s.name + '</span></button>').join('') + '</div>';
