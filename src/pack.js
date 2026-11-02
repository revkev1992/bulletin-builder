// Zip files, both ways, with nothing but Node: File ▸ Export ▸ Pack and Go writes one (the week folder,
// a fonts list and a note), and Insert ▸ Insert File reads a .docx (a zip of XML) for its text.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---- CRC-32 (the zip checksum)
const TABLE = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n & 0xFFFF); return b; };
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };
function dosTime(d = new Date()) {
  const t = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF;
  const dt = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
  return { t, dt };
}

// entries: [{ name: 'folder/file.ext', data: Buffer }] → the zip as a Buffer (deflated)
function writeZip(entries) {
  const parts = [], central = [];
  let offset = 0;
  const { t, dt } = dosTime();
  for (const e of entries) {
    const name = Buffer.from(e.name.replace(/\\/g, '/'), 'utf8');
    const raw = Buffer.isBuffer(e.data) ? e.data : Buffer.from(String(e.data), 'utf8');
    const packed = zlib.deflateRawSync(raw, { level: 6 });
    const useDeflate = packed.length < raw.length;
    const data = useDeflate ? packed : raw;
    const crc = crc32(raw);
    const method = useDeflate ? 8 : 0;
    const local = Buffer.concat([u32(0x04034b50), u16(20), u16(0x0800), u16(method), u16(t), u16(dt), u32(crc), u32(data.length), u32(raw.length), u16(name.length), u16(0), name, data]);
    central.push(Buffer.concat([u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(method), u16(t), u16(dt), u32(crc), u32(data.length), u32(raw.length),
      u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]));
    parts.push(local);
    offset += local.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(cd.length), u32(offset), u16(0)]);
  return Buffer.concat([...parts, cd, end]);
}

// the entries of a zip Buffer: [{ name, data: Buffer }] (deflate and stored only — what Office and we write)
function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Not a zip file.');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let k = 0; k < count; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    const lnlen = buf.readUInt16LE(lho + 26), lxlen = buf.readUInt16LE(lho + 28);
    const start = lho + 30 + lnlen + lxlen;
    const data = buf.subarray(start, start + csize);
    out.push({ name, size: usize, method, data: () => (method === 8 ? zlib.inflateRawSync(data) : method === 0 ? Buffer.from(data) : null) });
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

// the text of a Word document: one line per paragraph, tabs and line breaks kept
function docxText(file) {
  const entries = readZip(fs.readFileSync(file));
  const doc = entries.find((e) => e.name === 'word/document.xml');
  if (!doc) throw new Error('Not a Word document (no word/document.xml inside).');
  const xml = doc.data();
  if (!xml) throw new Error('This Word document is compressed in a way Bulletin Builder cannot read.');
  const s = xml.toString('utf8');
  const unesc = (t) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&');
  const paras = [];
  const body = s.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, (t) => t);     // tables: their paragraphs come through in order
  for (const m of body.matchAll(/<w:p\/>|<w:p[ >][\s\S]*?<\/w:p>/g)) {   // an empty paragraph is self-closing
    let line = '';
    for (const x of m[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>|<w:t\/>/g)) {
      if (x[0] === '<w:tab/>') line += '\t';
      else if (x[0] === '<w:br/>') line += '\n';
      else if (x[1] != null) line += unesc(x[1]);
    }
    paras.push(line);
  }
  return paras.join('\n');
}

// every file under a folder (relative names), skipping what a packed week never needs
function walk(dir, base = dir, out = []) {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) { if (!['history', 'locks'].includes(d.name)) walk(p, base, out); }
    else if (!d.name.endsWith('.saving') && !d.name.endsWith('.lock')) out.push({ name: path.relative(base, p), file: p });
  }
  return out;
}

// File ▸ Export ▸ Pack and Go: <week folder> + FONTS.txt + README.txt → zip Buffer
function packWeek(weekFile, { fonts = [], missing = [] } = {}) {
  const dir = path.dirname(path.resolve(weekFile));
  const title = path.basename(dir);
  const entries = walk(dir).map((f) => ({ name: title + '/' + f.name, data: fs.readFileSync(f.file) }));
  const fontsTxt = 'Fonts used by this bulletin — install any that are missing on the PC that opens it:\n\n' +
    fonts.map((f) => '  ' + f + (missing.includes(f) ? '   (NOT installed on the PC that packed this)' : '')).join('\n') +
    '\n\nPalatino Linotype, Candara, Calibri and Arial come with Windows. Archer and Avenir Next LT Pro must be installed separately.\n';
  entries.push({ name: title + ' - FONTS.txt', data: fontsTxt });
  entries.push({ name: title + ' - README.txt', data: 'Bulletin Builder — Pack and Go\n\nUnzip this anywhere. Open "' + title + '/' + title + '.bulletin" with Bulletin Builder (https://github.com/revkev1992/bulletin-builder/releases).\n' +
    'The folder holds the whole week: both halves and every picture it uses. Install the fonts listed in the FONTS file first.\n' });
  return { zip: writeZip(entries), files: entries.length, title };
}

module.exports = { writeZip, readZip, docxText, packWeek, crc32 };
