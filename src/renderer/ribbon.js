// The Publisher-style ribbon: File (Backstage) · Home · Insert · Page Design · View, in Publisher's
// own group order (from Kevin's Publisher 365 screenshots, 2026-10-14), plus a Bulletin tab for the
// features that are ours rather than Publisher's, and contextual Picture/Shape Format tabs.
//
// Controls keep the element ids the editor has always used (save, undo, front, crop, t-bold, fx …),
// so app.js and the self-tests drive them unchanged. A command that is not built yet is shown the way
// Publisher shows it but disabled, marked `todo` ("Coming soon") — see docs/FEATURE_PARITY.md.

const S = (body, size = 32) => `<svg viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true">${body}</svg>`;
const B = '#2b579a', G = '#555', T = '#0f7b6c', R = '#c0392b', Y = '#e0a800';
const sheet = (x = 8, y = 4, w = 16, h = 24) => `<path d="M${x} ${y}h${w - 5}l5 5v${h - 5}h-${w}z" fill="#fff" stroke="${G}" stroke-width="1.4"/><path d="M${x + w - 5} ${y}v5h5" fill="none" stroke="${G}" stroke-width="1.4"/>`;
const lines = (x, y, n, w, gap = 4, c = G) => Array.from({ length: n }, (_, i) => `<path d="M${x} ${y + i * gap}h${w}" stroke="${c}" stroke-width="1.6"/>`).join('');
const ICONS = {
  save: `<rect x="5" y="5" width="22" height="22" rx="2" fill="#fff" stroke="${B}" stroke-width="2"/><rect x="10" y="5" width="12" height="8" fill="${B}"/><rect x="9" y="17" width="14" height="10" fill="#cfdcf0"/>`,
  undo: `<path d="M10 9 4 15l6 6" fill="none" stroke="${G}" stroke-width="2.4"/><path d="M5 15h13a8 8 0 0 1 0 16" fill="none" stroke="${G}" stroke-width="2.4" transform="translate(0 -6)"/>`,
  redo: `<g transform="matrix(-1 0 0 1 32 0)"><path d="M10 9 4 15l6 6" fill="none" stroke="${G}" stroke-width="2.4"/><path d="M5 15h13a8 8 0 0 1 0 16" fill="none" stroke="${G}" stroke-width="2.4" transform="translate(0 -6)"/></g>`,
  paste: `<rect x="5" y="6" width="17" height="22" rx="2" fill="#d8c3a0" stroke="${G}" stroke-width="1.2"/><rect x="9" y="3" width="9" height="6" rx="1.5" fill="#fff" stroke="${G}" stroke-width="1.2"/>${sheet(14, 12, 14, 18)}`,
  cut: `<circle cx="9" cy="23" r="4" fill="none" stroke="${G}" stroke-width="2"/><circle cx="23" cy="23" r="4" fill="none" stroke="${G}" stroke-width="2"/><path d="M11 20 23 4M21 20 9 4" stroke="${G}" stroke-width="2"/>`,
  copy: `${sheet(4, 3, 16, 20)}${sheet(12, 9, 16, 20)}`,
  painter: `<rect x="5" y="4" width="20" height="8" rx="2" fill="${Y}" stroke="${G}" stroke-width="1.2"/><path d="M15 12v6M15 18v10" stroke="${G}" stroke-width="3"/>`,
  textbox: `<rect x="4" y="5" width="24" height="22" fill="#fff" stroke="${B}" stroke-width="1.8"/><path d="M11 21 16 9l5 12M13 17h6" fill="none" stroke="${B}" stroke-width="2"/>`,
  picture: `<rect x="3" y="6" width="26" height="20" rx="1" fill="#fff" stroke="${G}" stroke-width="1.6"/><path d="M5 24l7-9 5 6 4-4 6 7z" fill="#6aa84f"/><circle cx="22" cy="11" r="2.5" fill="${Y}"/>`,
  table: `<rect x="4" y="5" width="24" height="22" fill="#fff" stroke="${G}" stroke-width="1.6"/><path d="M4 11h24M4 16.5h24M4 22h24M12 5v22M20 5v22" stroke="${G}" stroke-width="1.2"/>`,
  shapes: `<rect x="4" y="12" width="14" height="14" fill="#cfdcf0" stroke="${B}" stroke-width="1.6"/><circle cx="21" cy="11" r="8" fill="#fff" stroke="${B}" stroke-width="1.6" fill-opacity=".85"/>`,
  line: `<path d="M5 26 27 6" stroke="${G}" stroke-width="2.4"/>`,
  rect: `<rect x="5" y="8" width="22" height="16" fill="#fff" stroke="${G}" stroke-width="2"/>`,
  styles: `<path d="M5 26 13 6h2l8 20M8 19h12" fill="none" stroke="${B}" stroke-width="2.2"/><path d="M20 26c3-8 6-12 9-15" fill="none" stroke="${G}" stroke-width="1.6"/>`,
  wrap: `${lines(3, 6, 6, 26, 4)}<rect x="10" y="11" width="12" height="11" fill="#cfdcf0" stroke="${B}"/>`,
  forward: `<rect x="4" y="4" width="16" height="16" fill="#ddd" stroke="${G}"/><rect x="12" y="12" width="16" height="16" fill="#cfdcf0" stroke="${B}" stroke-width="1.6"/>`,
  backward: `<rect x="12" y="12" width="16" height="16" fill="#ddd" stroke="${G}"/><rect x="4" y="4" width="16" height="16" fill="#cfdcf0" stroke="${B}" stroke-width="1.6"/>`,
  align: `<path d="M4 4v24" stroke="${G}" stroke-width="2"/><rect x="6" y="7" width="18" height="6" fill="#cfdcf0" stroke="${B}"/><rect x="6" y="18" width="11" height="6" fill="#cfdcf0" stroke="${B}"/>`,
  group: `<rect x="3" y="3" width="26" height="26" fill="none" stroke="${G}" stroke-dasharray="3 2"/><rect x="7" y="7" width="10" height="10" fill="#cfdcf0" stroke="${B}"/><rect x="15" y="15" width="10" height="10" fill="#fff" stroke="${B}"/>`,
  rotate: `<path d="M24 10a10 10 0 1 0 2 9" fill="none" stroke="${G}" stroke-width="2.2"/><path d="M26 3v8h-8" fill="none" stroke="${G}" stroke-width="2.2"/>`,
  find: `<circle cx="13" cy="13" r="8" fill="none" stroke="${G}" stroke-width="2.4"/><path d="M19 19l9 9" stroke="${G}" stroke-width="3"/>`,
  replace: `<path d="M5 12h16l-5-5M27 20H11l5 5" fill="none" stroke="${B}" stroke-width="2.2"/>`,
  select: `<path d="M8 4v22l6-6 4 9 4-2-4-9h8z" fill="#fff" stroke="${G}" stroke-width="1.6"/>`,
  del: `<path d="M8 8l16 16M24 8 8 24" stroke="${R}" stroke-width="3"/>`,
  page: `${sheet(7, 3, 18, 26)}`,
  pageadd: `${sheet(5, 3, 18, 26)}<circle cx="23" cy="23" r="6" fill="${T}"/><path d="M23 19v8M19 23h8" stroke="#fff" stroke-width="2"/>`,
  pagedel: `${sheet(5, 3, 18, 26)}<circle cx="23" cy="23" r="6" fill="${R}"/><path d="M19 23h8" stroke="#fff" stroke-width="2"/>`,
  pagemove: `${sheet(5, 3, 18, 26)}<path d="M18 23h10l-4-4M28 23l-4 4" fill="none" stroke="${T}" stroke-width="2"/>`,
  rename: `<rect x="3" y="10" width="26" height="12" fill="#fff" stroke="${G}" stroke-width="1.6"/><path d="M8 13v6" stroke="${B}" stroke-width="2"/>`,
  placeholder: `<rect x="3" y="6" width="26" height="20" fill="#fff" stroke="${G}" stroke-width="1.6" stroke-dasharray="3 2"/><path d="M8 22l6-7 4 5 3-3 4 5z" fill="#bbb"/>`,
  parts: `${sheet(6, 3, 20, 26)}<rect x="10" y="9" width="12" height="5" fill="#cfdcf0"/>${lines(10, 18, 3, 12)}`,
  calendar: `<rect x="4" y="6" width="24" height="22" fill="#fff" stroke="${G}" stroke-width="1.6"/><rect x="4" y="6" width="24" height="5" fill="${R}"/>${lines(8, 16, 3, 16, 4)}`,
  borders: `<rect x="4" y="4" width="16" height="16" fill="${R}"/><rect x="12" y="12" width="16" height="16" fill="${B}"/>`,
  ads: `<rect x="4" y="7" width="24" height="18" fill="#cfdcf0" stroke="${B}" stroke-width="1.6"/><path d="M8 20l5-8 4 5 3-3 4 6" fill="none" stroke="${B}" stroke-width="1.4"/>`,
  business: `<rect x="4" y="8" width="24" height="16" fill="#fff" stroke="${G}" stroke-width="1.6"/>${lines(8, 13, 3, 16, 4)}`,
  wordart: `<path d="M5 26C9 12 15 6 27 4" fill="none" stroke="${B}" stroke-width="2.6"/><path d="M12 26 20 8" stroke="${B}" stroke-width="1.4"/>`,
  file: `${sheet(7, 3, 18, 26)}${lines(11, 14, 3, 10)}`,
  symbol: `<path d="M9 25h5v-3a8 8 0 1 1 4 0v3h5" fill="none" stroke="${G}" stroke-width="2"/>`,
  datetime: `<rect x="3" y="6" width="20" height="20" fill="#fff" stroke="${G}" stroke-width="1.6"/><circle cx="22" cy="22" r="7" fill="#fff" stroke="${B}" stroke-width="1.6"/><path d="M22 18v4l3 2" stroke="${B}" stroke-width="1.6" fill="none"/>`,
  link: `<path d="M13 19l6-6M11 15l-3 3a4 4 0 0 0 6 6l3-3M21 17l3-3a4 4 0 0 0-6-6l-3 3" fill="none" stroke="${G}" stroke-width="2.2"/>`,
  bookmark: `${sheet(6, 3, 18, 26)}<path d="M18 14v12l3-3 3 3V14z" fill="${B}"/>`,
  header: `${sheet(7, 3, 18, 26)}<rect x="10" y="7" width="12" height="4" fill="${Y}"/>`,
  footer: `${sheet(7, 3, 18, 26)}<rect x="10" y="22" width="12" height="4" fill="${Y}"/>`,
  pagenum: `${sheet(7, 3, 18, 26)}<text x="16" y="21" font-size="11" text-anchor="middle" fill="${B}" font-family="Segoe UI">#</text>`,
  template: `${sheet(6, 3, 20, 26)}<rect x="10" y="8" width="12" height="7" fill="#cfdcf0"/><path d="M22 20l6 6M26 20l-4 6" stroke="${T}" stroke-width="2"/>`,
  options: `<circle cx="16" cy="16" r="5" fill="none" stroke="${G}" stroke-width="2.4"/><path d="M16 3v5M16 24v5M3 16h5M24 16h5M7 7l3.5 3.5M21.5 21.5 25 25M7 25l3.5-3.5M21.5 10.5 25 7" stroke="${G}" stroke-width="2.4"/>`,
  margins: `<rect x="5" y="3" width="22" height="26" fill="#fff" stroke="${G}" stroke-width="1.6"/><rect x="9" y="7" width="14" height="18" fill="#cfdcf0" stroke="${B}" stroke-dasharray="2 1.5"/>`,
  orientation: `<rect x="3" y="9" width="20" height="14" fill="#fff" stroke="${G}" stroke-width="1.6"/><rect x="13" y="3" width="14" height="20" fill="#fff" stroke="${B}" stroke-width="1.6"/>`,
  size: `${sheet(5, 8, 15, 21)}${sheet(12, 3, 16, 22)}`,
  guides: `<rect x="5" y="3" width="22" height="26" fill="#fff" stroke="${G}" stroke-width="1.6"/><path d="M5 10h22M5 22h22M11 3v26M21 3v26" stroke="${B}" stroke-width="1" stroke-dasharray="2 1.5"/>`,
  schemes: `<rect x="3" y="9" width="6" height="14" fill="#5b9bd5"/><rect x="10" y="9" width="6" height="14" fill="#ed7d31"/><rect x="17" y="9" width="6" height="14" fill="#a5a5a5"/><rect x="24" y="9" width="5" height="14" fill="#ffc000"/>`,
  fonts: `<text x="3" y="24" font-size="20" fill="${G}" font-family="Georgia">Aa</text>`,
  applyimage: `<rect x="5" y="5" width="22" height="22" fill="#eee" stroke="${G}" stroke-width="1.4"/><path d="M8 24l6-8 4 5 3-3 4 6z" fill="#bbb"/>`,
  background: `${sheet(6, 3, 20, 26)}<rect x="7" y="18" width="19" height="10" fill="#cfdcf0"/>`,
  master: `${sheet(4, 5, 16, 24)}${sheet(10, 2, 18, 25)}`,
  normal: `${sheet(7, 3, 18, 26)}${lines(11, 12, 4, 10)}`,
  single: `${sheet(8, 3, 16, 26)}`,
  spread: `${sheet(2, 4, 14, 22)}${sheet(16, 4, 14, 22)}`,
  z100: `${sheet(7, 3, 18, 26)}<rect x="12" y="17" width="16" height="9" fill="${B}"/><text x="20" y="24.5" font-size="7" text-anchor="middle" fill="#fff" font-family="Segoe UI">100</text>`,
  wholepage: `${sheet(8, 3, 16, 26)}<path d="M5 3v26M27 3v26" stroke="${B}" stroke-width="1.2"/>`,
  pagewidth: `<path d="M3 16h26M3 16l5-5M3 16l5 5M29 16l-5-5M29 16l-5 5" fill="none" stroke="${B}" stroke-width="2"/>`,
  zoomin: `<circle cx="13" cy="13" r="8" fill="none" stroke="${G}" stroke-width="2.4"/><path d="M19 19l9 9M9 13h8M13 9v8" stroke="${G}" stroke-width="2.4"/>`,
  zoomout: `<circle cx="13" cy="13" r="8" fill="none" stroke="${G}" stroke-width="2.4"/><path d="M19 19l9 9M9 13h8" stroke="${G}" stroke-width="2.4"/>`,
  arrangeall: `<rect x="3" y="4" width="26" height="10" fill="#fff" stroke="${G}" stroke-width="1.4"/><rect x="3" y="18" width="26" height="10" fill="#fff" stroke="${G}" stroke-width="1.4"/>`,
  cascade: `<rect x="3" y="3" width="17" height="14" fill="#fff" stroke="${G}" stroke-width="1.4"/><rect x="8" y="8" width="17" height="14" fill="#fff" stroke="${G}" stroke-width="1.4"/><rect x="13" y="13" width="16" height="14" fill="#fff" stroke="${B}" stroke-width="1.4"/>`,
  switchwin: `<rect x="3" y="6" width="18" height="15" fill="#fff" stroke="${G}" stroke-width="1.4"/><rect x="11" y="12" width="18" height="15" fill="#fff" stroke="${B}" stroke-width="1.4"/>`,
  crop: `<path d="M9 3v20h20M3 9h20v20" fill="none" stroke="${G}" stroke-width="2.6"/>`,
  fit: `<rect x="3" y="3" width="26" height="26" fill="none" stroke="${G}" stroke-width="1.6"/><rect x="3" y="9" width="26" height="14" fill="#cfdcf0" stroke="${B}"/>`,
  fill: `<rect x="3" y="3" width="26" height="26" fill="#cfdcf0" stroke="${B}" stroke-width="1.6"/><path d="M6 24l6-8 4 5 3-3 6 6z" fill="${B}"/>`,
  lock: `<rect x="7" y="14" width="18" height="14" rx="2" fill="${Y}" stroke="${G}" stroke-width="1.4"/><path d="M11 14V10a5 5 0 0 1 10 0v4" fill="none" stroke="${G}" stroke-width="2.4"/>`,
  lockpage: `${sheet(4, 3, 18, 26)}<rect x="15" y="18" width="13" height="10" rx="1.5" fill="${Y}" stroke="${G}"/><path d="M18 18v-3a3.5 3.5 0 0 1 7 0v3" fill="none" stroke="${G}" stroke-width="1.8"/>`,
  park: `<rect x="3" y="15" width="26" height="13" fill="#e6e3de" stroke="${G}" stroke-dasharray="3 2"/><rect x="10" y="4" width="12" height="9" fill="#cfdcf0" stroke="${B}"/><path d="M16 13v6M13 16l3 3 3-3" fill="none" stroke="${B}" stroke-width="1.6"/>`,
  pasteboard: `<rect x="3" y="5" width="26" height="22" fill="#e6e3de" stroke="${G}" stroke-dasharray="3 2"/><rect x="7" y="9" width="8" height="6" fill="#cfdcf0" stroke="${B}"/><rect x="17" y="15" width="8" height="8" fill="#fff" stroke="${B}"/>`,
  newweek: `${sheet(4, 3, 18, 26)}<path d="M8 11h10M8 15h10" stroke="${G}"/><circle cx="23" cy="23" r="6" fill="${T}"/><path d="M23 19v8M19 23h8" stroke="#fff" stroke-width="2"/>`,
  bold: `<text x="16" y="25" font-size="26" font-weight="700" text-anchor="middle" fill="${G}" font-family="Segoe UI">B</text>`,
  italic: `<text x="16" y="25" font-size="26" font-style="italic" text-anchor="middle" fill="${G}" font-family="Georgia">I</text>`,
  underline: `<text x="16" y="21" font-size="24" text-anchor="middle" fill="${G}" font-family="Segoe UI">U</text><path d="M8 29h16" stroke="${G}" stroke-width="2"/>`,
  sub: `<text x="11" y="21" font-size="15" text-anchor="middle" fill="${G}" font-family="Segoe UI">x</text><text x="22" y="27" font-size="9" fill="${B}" font-family="Segoe UI">2</text>`,
  sup: `<text x="11" y="25" font-size="15" text-anchor="middle" fill="${G}" font-family="Segoe UI">x</text><text x="20" y="14" font-size="9" fill="${B}" font-family="Segoe UI">2</text>`,
  grow: `<text x="12" y="24" font-size="18" text-anchor="middle" fill="${G}" font-family="Segoe UI">A</text><path d="M22 10l3-4 3 4" fill="none" stroke="${G}" stroke-width="1.6"/>`,
  shrink: `<text x="12" y="24" font-size="15" text-anchor="middle" fill="${G}" font-family="Segoe UI">A</text><path d="M22 6l3 4 3-4" fill="none" stroke="${G}" stroke-width="1.6"/>`,
  case: `<text x="16" y="22" font-size="14" text-anchor="middle" fill="${G}" font-family="Segoe UI">Aa</text>`,
  clearfmt: `<text x="13" y="22" font-size="16" text-anchor="middle" fill="${G}" font-family="Segoe UI">A</text><path d="M18 20l8 8M26 20l-8 8" stroke="${R}" stroke-width="2"/>`,
  spacing: `<text x="16" y="20" font-size="13" text-anchor="middle" fill="${G}" font-family="Segoe UI">AV</text><path d="M5 25h22M5 25l3-2M27 25l-3-2" fill="none" stroke="${G}"/>`,
  color: `<text x="16" y="20" font-size="17" text-anchor="middle" fill="${G}" font-family="Segoe UI">A</text><rect x="6" y="23" width="20" height="5" fill="${R}"/>`,
  bullets: `<circle cx="6" cy="8" r="2" fill="${G}"/><circle cx="6" cy="16" r="2" fill="${G}"/><circle cx="6" cy="24" r="2" fill="${G}"/>${lines(11, 8, 3, 17, 8)}`,
  numbering: `<text x="3" y="11" font-size="8" fill="${G}" font-family="Segoe UI">1</text><text x="3" y="19" font-size="8" fill="${G}" font-family="Segoe UI">2</text><text x="3" y="27" font-size="8" fill="${G}" font-family="Segoe UI">3</text>${lines(11, 8, 3, 17, 8)}`,
  outdent: `${lines(13, 6, 5, 15, 5)}<path d="M9 12l-5 4 5 4z" fill="${B}"/>`,
  indent: `${lines(13, 6, 5, 15, 5)}<path d="M4 12l5 4-5 4z" fill="${B}"/>`,
  columns: `${lines(3, 7, 5, 11, 4.5)}${lines(18, 7, 5, 11, 4.5)}`,
  pilcrow: `<path d="M17 5v22M22 5v22M24 5H13a6 6 0 0 0 0 12h4" fill="none" stroke="${G}" stroke-width="2"/>`,
  'align-left': `<path d="M4 7h24M4 11.5h16M4 16h24M4 20.5h16M4 25h24" stroke="${G}" stroke-width="1.8"/>`,
  'align-center': `<path d="M4 7h24M8 11.5h16M4 16h24M8 20.5h16M4 25h24" stroke="${G}" stroke-width="1.8"/>`,
  'align-right': `<path d="M4 7h24M12 11.5h16M4 16h24M12 20.5h16M4 25h24" stroke="${G}" stroke-width="1.8"/>`,
  'align-justify': `<path d="M4 7h24M4 11.5h24M4 16h24M4 20.5h24M4 25h24" stroke="${G}" stroke-width="1.8"/>`,
  linespacing: `${lines(14, 8, 4, 14, 5)}<path d="M7 5v22M4 9l3-4 3 4M4 23l3 4 3-4" fill="none" stroke="${B}" stroke-width="1.6"/>`,
  dropcap: `<text x="10" y="21" font-size="20" text-anchor="middle" fill="${B}" font-family="Georgia">A</text>${lines(18, 9, 4, 10, 5)}`,
  owners: `${sheet(2, 4, 14, 22)}${sheet(16, 4, 14, 22)}<rect x="2" y="4" width="14" height="2.5" fill="#2f6db5"/><rect x="16" y="4" width="14" height="2.5" fill="#b5702f"/>`,
  print: `<rect x="8" y="3" width="16" height="9" fill="#fff" stroke="${G}" stroke-width="1.4"/><rect x="3" y="11" width="26" height="12" rx="2" fill="#ddd" stroke="${G}" stroke-width="1.4"/><rect x="8" y="19" width="16" height="10" fill="#fff" stroke="${G}" stroke-width="1.4"/>`,
  pdf: `${sheet(6, 3, 20, 26)}<rect x="4" y="15" width="24" height="9" fill="${R}"/><text x="16" y="22.5" font-size="7.5" text-anchor="middle" fill="#fff" font-family="Segoe UI" font-weight="700">PDF</text>`,
  open: `<path d="M3 8h9l3 3h14v16H3z" fill="${Y}" stroke="${G}" stroke-width="1.2"/>`,
  home: `<path d="M4 15 16 5l12 10M8 13v14h16V13" fill="none" stroke="${G}" stroke-width="2"/>`,
  info: `<circle cx="16" cy="16" r="12" fill="none" stroke="${G}" stroke-width="2"/><path d="M16 14v9M16 9v2" stroke="${G}" stroke-width="2.4"/>`,
  saveas: `<rect x="5" y="5" width="22" height="22" rx="2" fill="#fff" stroke="${B}" stroke-width="2"/><rect x="10" y="5" width="12" height="8" fill="${B}"/><path d="M16 27l10-10 3 3-10 10h-3z" fill="${Y}" stroke="${G}"/>`,
  share: `<circle cx="9" cy="16" r="3.5" fill="none" stroke="${G}" stroke-width="2"/><circle cx="23" cy="8" r="3.5" fill="none" stroke="${G}" stroke-width="2"/><circle cx="23" cy="24" r="3.5" fill="none" stroke="${G}" stroke-width="2"/><path d="M12 14.5 20 10M12 17.5 20 22" stroke="${G}" stroke-width="2"/>`,
  export: `${sheet(4, 3, 18, 26)}<path d="M16 18h13M24 13l5 5-5 5" fill="none" stroke="${T}" stroke-width="2.2"/>`,
  close: `<rect x="4" y="6" width="24" height="20" fill="#fff" stroke="${G}" stroke-width="1.8"/>`,
  back: `<circle cx="16" cy="16" r="12" fill="none" stroke="${G}" stroke-width="1.8"/><path d="M22 16H10M15 11l-5 5 5 5" fill="none" stroke="${G}" stroke-width="2"/>`,
};
export const icon = (name, size = 32) => S(ICONS[name] || '', size);

const TODO = 'Coming soon — not built yet (see the parity checklist)';

// item helpers ------------------------------------------------------------------------------
// big:   { big, id?, cmd?, label, icon, todo?, menu?: [items] }
// small: { id?, label?, icon?, todo?, tip? }      (label-less = icon-only)
// check: { check, id?, label, checked?, todo? }
// raw:   { html }
const big = (label, ic, o = {}) => ({ big: true, label, icon: ic, ...o });
const sm = (label, ic, o = {}) => ({ label, icon: ic, ...o });
const ico = (ic, tip, o = {}) => ({ icon: ic, tip, ...o });
const chk = (label, o = {}) => ({ check: true, label, ...o });
const todo = { todo: true };

const FONTS = ['Palatino Linotype', 'Book Antiqua', 'Candara', 'Candara Light', 'Archer Book', 'Archer Bold',
  'Avenir Next LT Pro', 'Calibri', 'Arial', 'Times New Roman', 'Georgia'];

export const TABS = [
  { id: 'home', label: 'Home', groups: [
    { label: 'Clipboard', cols: [
      [big('Paste', 'paste', { id: 'rb-paste', tip: 'Paste (Ctrl+V)' })],
      [sm('Cut', 'cut', { id: 'rb-cut', tip: 'Cut (Ctrl+X)' }), sm('Copy', 'copy', { id: 'rb-copy', tip: 'Copy (Ctrl+C)' }), sm('Format Painter', 'painter', todo)],
    ] },
    { label: 'Font', cls: 'rb-text', cols: [
      [{ html: '<div class="rb-row"><select id="t-font" title="Font" disabled>' + FONTS.map((f) => '<option>' + f + '</option>').join('') +
        '</select><input id="t-size" type="number" min="4" max="144" step="0.5" value="11" title="Font Size (pt)" disabled></div>' },
      { row: [ico('grow', 'Increase Font Size', todo), ico('shrink', 'Decrease Font Size', todo), ico('clearfmt', 'Clear All Formatting', todo)] },
      { row: [ico('bold', 'Bold (Ctrl+B)', { id: 't-bold' }), ico('italic', 'Italic (Ctrl+I)', { id: 't-italic' }), ico('underline', 'Underline (Ctrl+U)', { id: 't-underline' }),
        ico('sub', 'Subscript', todo), ico('sup', 'Superscript', todo), ico('case', 'Change Case', todo), ico('spacing', 'Character Spacing', todo), ico('color', 'Font Color', todo)] }],
    ] },
    { label: 'Paragraph', cls: 'rb-text', cols: [
      [{ row: [ico('bullets', 'Bullets', todo), ico('numbering', 'Numbering', todo), ico('outdent', 'Decrease Indent', todo), ico('indent', 'Increase Indent', todo), ico('columns', 'Columns', todo), ico('pilcrow', 'Show Special Characters', todo)] },
        { row: [ico('align-left', 'Align Left', { align: 'left' }), ico('align-center', 'Center', { align: 'center' }), ico('align-right', 'Align Right', { align: 'right' }),
          ico('align-justify', 'Justify', { align: 'justify' }), ico('linespacing', 'Line Spacing', todo), ico('dropcap', 'Drop Cap', todo)] }],
    ] },
    { label: 'Styles', cols: [[big('Styles', 'styles', todo)]] },
    { label: 'Objects', cols: [[big('Draw Text Box', 'textbox', { mirror: 'ins-text' })], [big('Pictures', 'picture', { mirror: 'ins-picture' })],
      [big('Table', 'table', todo)], [big('Shapes', 'shapes', { id: 'rb-shapes-home', menu: 'shapes' })]] },
    { label: 'Arrange', cols: [
      [big('Wrap Text', 'wrap', todo)],
      [sm('Bring Forward', 'forward', { id: 'front', tip: 'Bring to Front' }), sm('Send Backward', 'backward', { id: 'back', tip: 'Send to Back' }), sm('Align', 'align', todo)],
      [sm('Group', 'group', todo), sm('Ungroup', 'group', todo), sm('Rotate', 'rotate', todo)],
    ] },
    { label: 'Editing', cols: [[sm('Find', 'find', todo), sm('Replace', 'replace', todo), sm('Select', 'select', todo)], [sm('Delete', 'del', { id: 'delete', tip: 'Delete (Del)' })]] },
  ] },
  { id: 'insert', label: 'Insert', groups: [
    { label: 'Pages', cols: [[big('Page', 'pageadd', todo)]] },
    { label: 'Tables', cols: [[big('Table', 'table', todo)]] },
    { label: 'Illustrations', cols: [[big('Pictures', 'picture', { id: 'ins-picture', tip: 'Insert a picture from a file' })], [big('Shapes', 'shapes', { id: 'rb-shapes', menu: 'shapes' })],
      [big('Picture Placeholder', 'placeholder', todo)]] },
    { label: 'Building Blocks', cols: [[big('Page Parts', 'parts', todo)], [big('Calendars', 'calendar', todo)], [big('Borders & Accents', 'borders', todo)], [big('Advertisements', 'ads', todo)]] },
    { label: 'Text', cols: [[big('Draw Text Box', 'textbox', { id: 'ins-text' })], [big('WordArt', 'wordart', todo)], [big('Insert File', 'file', todo)],
      [big('Symbol', 'symbol', todo)], [big('Date & Time', 'datetime', todo)]] },
    { label: 'Links', cols: [[big('Link', 'link', todo)], [big('Bookmark', 'bookmark', todo)]] },
    { label: 'Header & Footer', cols: [[big('Header', 'header', todo)], [big('Footer', 'footer', todo)], [big('Page Number', 'pagenum', todo)]] },
  ] },
  { id: 'design', label: 'Page Design', groups: [
    { label: 'Template', cols: [[big('Change Template', 'template', todo)], [big('Options', 'options', todo)]] },
    { label: 'Page Setup', cols: [[big('Margins', 'margins', todo)], [big('Orientation', 'orientation', todo)], [big('Size', 'size', todo)]] },
    { label: 'Layout', cols: [[big('Guides', 'guides', todo)], [{ html: '<div class="rb-caption">Align To</div>' }, chk('Guides', { checked: true, todo: true }), chk('Objects', { checked: true, todo: true })]] },
    { label: 'Pages', cols: [[sm('Delete', 'pagedel', todo), sm('Move', 'pagemove', todo), sm('Rename', 'rename', todo)]] },
    { label: 'Schemes', cols: [[big('Color Schemes', 'schemes', todo)], [big('Fonts', 'fonts', todo)]] },
    { label: 'Page Background', cols: [[big('Apply Image', 'applyimage', todo)], [big('Background', 'background', todo)], [big('Master Pages', 'master', todo)]] },
  ] },
  { id: 'view', label: 'View', groups: [
    { label: 'Views', cols: [[big('Normal', 'normal', { id: 'rb-normal', active: true })], [big('Master Page', 'master', todo)]] },
    { label: 'Layout', cols: [[big('Single Page', 'single', todo)], [big('Two-Page Spread', 'spread', { id: 'rb-spread', active: true })]] },
    { label: 'Show', cols: [
      [chk('Boundaries', { id: 'show-boundaries' }), chk('Guides', { id: 'show-guides', checked: true }), chk('Fields', todo)],
      [chk('Rulers', todo), chk('Page Navigation', { id: 'show-nav', checked: true }), chk('Scratch Area', { id: 'pasteboard-btn', tip: 'Show the pasteboard: parked items, never printed' })],
      [chk('Graphics Manager', todo), chk('Baselines', todo)],
    ] },
    { label: 'Zoom', cols: [[big('100%', 'z100', { id: 'zoom-100' })], [big('Whole Page', 'wholepage', { id: 'zoom-fit', tip: 'Whole spread (Ctrl 0)' })],
      [{ html: '<div class="rb-row"><button id="zoom-out" class="rb-ico" title="Zoom Out (Ctrl -)">' + icon('zoomout', 16) + '</button><span id="zoom-label">100%</span><button id="zoom-in" class="rb-ico" title="Zoom In (Ctrl +)">' + icon('zoomin', 16) + '</button></div>' },
        sm('Page Width', 'pagewidth', { id: 'zoom-width' }), sm('Selected Objects', 'select', todo)]] },
    { label: 'Window', cols: [[big('Arrange All', 'arrangeall', todo)], [big('Cascade', 'cascade', todo)], [big('Switch Windows', 'switchwin', todo)]] },
  ] },
  { id: 'bulletin', label: 'Bulletin', groups: [
    { label: 'Editing', cols: [[{ html: '<div class="rb-caption">I am changing</div><select id="mode" title="Which half of the bulletin you are changing"><option value="">View only</option>' +
      '<option value="worship">Worship pages</option><option value="announcements">Announcements pages</option></select>' }]] },
    { label: 'Week', cols: [[big('New Week from This One', 'newweek', { id: 'rb-newweek', tip: 'Copy this week, a week later (Ctrl+N)' })]] },
    { label: 'Protect', cols: [[big('Lock', 'lock', { id: 'lock-frame', tip: 'Lock frame (Ctrl+L)' })], [big('Lock Page', 'lockpage', { id: 'lock-page' })]] },
    { label: 'Pasteboard', cols: [[big('Park', 'park', { id: 'to-pasteboard', tip: 'Park on the pasteboard (never printed)' })]] },
    { label: 'Show', cols: [[chk('Who owns each page', { id: 'show-halves', checked: true })]] },
  ] },
  // contextual (shown only while something is selected)
  { id: 'format', label: 'Shape Format', contextual: true, groups: [
    { label: 'Arrange', cols: [[sm('Bring Forward', 'forward', { mirror: 'front' }), sm('Send Backward', 'backward', { mirror: 'back' })]] },
    { label: 'Picture', id: 'rb-picture-group', cols: [[big('Crop', 'crop', { id: 'crop', tip: 'Crop (double-click the picture)' })], [sm('Fit', 'fit', { id: 'fit', tip: 'Show the whole picture inside the frame' }), sm('Fill', 'fill', { id: 'fill', tip: 'Fill the frame, cropping the picture evenly' })]] },
    { label: 'Size', cols: [[{ html: '<label class="rb-num">Height <input id="fh" type="number" step="0.01" min="0" disabled>"</label>' +
      '<label class="rb-num">Width <input id="fw" type="number" step="0.01" min="0.05" disabled>"</label>' },
    ], [{ html: '<label class="rb-num">Left <input id="fx" type="number" step="0.01" disabled>"</label><label class="rb-num">Top <input id="fy" type="number" step="0.01" disabled>"</label>' }]] },
  ] },
];

const MENUS = {
  shapes: [sm('Line', 'line', { id: 'ins-line' }), sm('Rectangle', 'rect', { id: 'ins-rect' })],
};

function button(it, size) {
  const b = document.createElement('button');
  b.type = 'button';
  if (it.id) b.id = it.id;
  if (it.mirror) b.dataset.mirror = it.mirror;
  if (it.align) b.dataset.align = it.align;
  if (it.menu) b.dataset.menu = it.menu;
  if (it.active) b.classList.add('active');
  b.title = it.todo ? (it.tip || it.label || '') + ' — ' + TODO : (it.tip || it.label || '');
  if (it.todo) { b.disabled = true; b.classList.add('todo'); }
  b.innerHTML = (it.icon ? icon(it.icon, size) : '') + (it.label ? '<span class="rb-label">' + it.label + (it.menu ? ' ▾' : '') + '</span>' : '');
  return b;
}

function item(it) {
  if (it.html != null) { const d = document.createElement('div'); d.className = 'rb-html'; d.innerHTML = it.html; return d; }
  if (it.row) { const d = document.createElement('div'); d.className = 'rb-row'; for (const x of it.row) d.appendChild(item(x)); return d; }
  if (it.check) {
    const l = document.createElement('label');
    l.className = 'rb-check' + (it.todo ? ' todo' : '');
    l.title = it.todo ? it.label + ' — ' + TODO : (it.tip || it.label);
    l.innerHTML = '<input type="checkbox"' + (it.id ? ' id="' + it.id + '"' : '') + (it.checked ? ' checked' : '') + (it.todo ? ' disabled' : '') + '> ' + it.label;
    return l;
  }
  if (it.big) { const b = button(it, 32); b.className += ' rb-big'; return b; }
  const b = button(it, 16);
  b.className += it.label ? ' rb-small' : ' rb-ico';
  return b;
}

export function buildRibbon(root, { title = '' } = {}) {
  const tabs = TABS.map((t) => '<button type="button" class="rb-tab' + (t.contextual ? ' rb-contextual' : '') + '" data-tab="' + t.id + '"' +
    (t.contextual ? ' hidden' : '') + '>' + t.label + '</button>').join('');
  root.innerHTML =
    '<div class="rb-top"><div class="rb-qat">' +
      '<button id="save" class="rb-ico" title="Save (Ctrl+S)" disabled>' + icon('save', 16) + '</button>' +
      '<button id="undo" class="rb-ico" title="Undo (Ctrl+Z)" disabled>' + icon('undo', 16) + '</button>' +
      '<button id="redo" class="rb-ico" title="Redo (Ctrl+Y)" disabled>' + icon('redo', 16) + '</button></div>' +
      '<div class="rb-doc"><span id="title">' + title + '</span><span class="rb-app"> - Bulletin Builder</span></div>' +
      '<span id="badge">No week open</span></div>' +
    '<nav class="rb-tabs"><button type="button" class="rb-tab rb-file" data-tab="file">File</button>' + tabs + '</nav>' +
    '<div class="rb-panels"></div>';
  const panels = root.querySelector('.rb-panels');
  for (const t of TABS) {
    const p = document.createElement('div');
    p.className = 'rb-panel';
    p.dataset.tab = t.id;
    p.hidden = true;
    for (const g of t.groups) {
      const gd = document.createElement('div');
      gd.className = 'rb-group' + (g.cls ? ' ' + g.cls : '');
      if (g.id) gd.id = g.id;
      const body = document.createElement('div');
      body.className = 'rb-body';
      for (const col of g.cols) {
        const c = document.createElement('div');
        c.className = 'rb-col';
        for (const it of col) c.appendChild(item(it));
        body.appendChild(c);
      }
      const lab = document.createElement('div');
      lab.className = 'rb-group-label';
      lab.textContent = g.label;
      gd.append(body, lab);
      p.appendChild(gd);
    }
    panels.appendChild(p);
  }
  // drop-down menus (Shapes): one shared popup per menu, holding the real command buttons
  for (const [name, items] of Object.entries(MENUS)) {
    const m = document.createElement('div');
    m.className = 'rb-menu';
    m.dataset.menuName = name;
    m.hidden = true;
    for (const it of items) { const b = item(it); b.classList.add('rb-menu-item'); m.appendChild(b); }
    root.appendChild(m);
  }
  root.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-menu]');
    for (const m of root.querySelectorAll('.rb-menu')) {
      if (opener && m.dataset.menuName === opener.dataset.menu && m.hidden) {
        const r = opener.getBoundingClientRect();
        Object.assign(m.style, { left: r.left + 'px', top: r.bottom + 2 + 'px' });
        m.hidden = false;
      } else m.hidden = true;
    }
    const mir = e.target.closest('[data-mirror]');
    if (mir) document.getElementById(mir.dataset.mirror).click();
  });
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.rb-menu,[data-menu]')) for (const m of root.querySelectorAll('.rb-menu')) m.hidden = true; });
  for (const b of root.querySelectorAll('.rb-tab')) b.addEventListener('click', () => selectTab(b.dataset.tab));
  selectTab('home');
}

let fileHandler = null;
export function onFileTab(fn) { fileHandler = fn; }

export function selectTab(id) {
  if (id === 'file') { if (fileHandler) fileHandler(); return; }
  for (const b of document.querySelectorAll('.rb-tab')) b.classList.toggle('active', b.dataset.tab === id);
  for (const p of document.querySelectorAll('.rb-panel')) p.hidden = p.dataset.tab !== id;
}

export function currentTab() {
  const b = document.querySelector('.rb-tab.active');
  return b ? b.dataset.tab : 'home';
}

// Contextual "Picture Format" / "Shape Format" tab, as Publisher shows it for a selected object.
export function setContextual(kind) {
  const tab = document.querySelector('.rb-tab[data-tab="format"]');
  if (!kind) {
    if (!tab.hidden && currentTab() === 'format') selectTab('home');
    tab.hidden = true;
    return;
  }
  tab.hidden = false;
  tab.textContent = kind === 'image' ? 'Picture Format' : kind === 'text' ? 'Text Box Format' : 'Shape Format';
  document.getElementById('rb-picture-group').hidden = kind !== 'image';
}

// keep a mirrored button (same command in two places) in step with its original
export function syncMirrors() {
  for (const m of document.querySelectorAll('[data-mirror]')) {
    const o = document.getElementById(m.dataset.mirror);
    if (o) { m.disabled = o.disabled; m.classList.toggle('active', o.classList.contains('active')); }
  }
}

export function setLabel(id, text) {
  const el = document.getElementById(id);
  const l = el && el.querySelector('.rb-label');
  if (l) l.textContent = text; else if (el) el.textContent = text;
}
