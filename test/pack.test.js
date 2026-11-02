// node test/pack.test.js — zip writer / reader, .docx text, Pack and Go contents (no Electron)
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { writeZip, readZip, docxText, packWeek, crc32 } = require('../src/pack');

let ok = 0; const t = (name, fn) => { fn(); ok++; console.log('ok', name); };

t('crc32 of "123456789" is CBF43926', () => assert.strictEqual(crc32(Buffer.from('123456789')).toString(16).toUpperCase(), 'CBF43926'));

t('a zip written here reads back, deflated and stored alike', () => {
  const big = 'The quick brown fox jumps over the lazy dog. '.repeat(200);
  const zip = writeZip([{ name: 'a/one.txt', data: 'hello' }, { name: 'two.txt', data: big }, { name: 'bin.dat', data: Buffer.from([0, 255, 1, 254]) }]);
  const entries = readZip(zip);
  assert.deepStrictEqual(entries.map((e) => e.name), ['a/one.txt', 'two.txt', 'bin.dat']);
  assert.strictEqual(entries[0].data().toString(), 'hello');
  assert.strictEqual(entries[1].data().toString(), big);
  assert.strictEqual(entries[1].method, 8);
  assert.deepStrictEqual([...entries[2].data()], [0, 255, 1, 254]);
});

t('the text of a .docx: paragraphs, tabs, breaks, entities', () => {
  const xml = '<?xml version="1.0"?><w:document xmlns:w="x"><w:body>' +
    '<w:p><w:r><w:t>Order of </w:t></w:r><w:r><w:t xml:space="preserve">Worship</w:t></w:r></w:p>' +
    '<w:p><w:pPr/><w:r><w:t>*HYMN</w:t><w:tab/><w:t>O God Beyond All Praising</w:t><w:tab/><w:t>thaxted</w:t></w:r></w:p>' +
    '<w:p/><w:p><w:r><w:t>Tom &amp; Jerry &lt;3</w:t><w:br/><w:t>second line</w:t></w:r></w:p></w:body></w:document>';
  const docx = writeZip([{ name: '[Content_Types].xml', data: '<Types/>' }, { name: 'word/document.xml', data: xml }]);
  const f = path.join(os.tmpdir(), 'bb-test-' + Date.now() + '.docx');
  fs.writeFileSync(f, docx);
  try {
    assert.strictEqual(docxText(f), 'Order of Worship\n*HYMN\tO God Beyond All Praising\tthaxted\n\nTom & Jerry <3\nsecond line');
  } finally { fs.rmSync(f); }
});

t('Pack and Go: the week folder (no history / locks), a fonts list and a note', () => {
  const W = require('./weeks').weekDir('9-20-26 1100');
  const { zip, files, title } = packWeek(path.join(W, '9-20-26 1100.bulletin'), { fonts: ['Palatino Linotype', 'Archer Bold'], missing: ['Archer Bold'] });
  const names = readZip(zip).map((e) => e.name);
  assert.strictEqual(title, '9-20-26 1100');
  assert.ok(names.includes('9-20-26 1100/9-20-26 1100.bulletin') && names.includes('9-20-26 1100/worship.json') && names.includes('9-20-26 1100/announcements.json'));
  assert.ok(names.some((n) => n.startsWith('9-20-26 1100/assets/')));
  assert.ok(!names.some((n) => /\/(history|locks)\//.test(n)));
  assert.ok(names.includes('9-20-26 1100 - FONTS.txt') && names.includes('9-20-26 1100 - README.txt'));
  const fonts = readZip(zip).find((e) => e.name.endsWith('FONTS.txt')).data().toString();
  assert.ok(/Archer Bold\s+\(NOT installed/.test(fonts));
  assert.strictEqual(files, names.length);
});

console.log('PASS ' + ok + ' pack checks');
