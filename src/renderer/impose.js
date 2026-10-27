// Bulletin ▸ Print: put the bulletin's pages on real paper.
//   legal  — 8.5 × 14 in, folded booklet: two pages side by side on each side of the sheet, in
//            saddle-stitch order (fold the stack, staple the spine); pages at actual size.
//   ledger — 11 × 17 in, the same booklet enlarged to fill the sheet (large print).
//   letter — 8.5 × 11 in, one page per sheet at actual size, centred.
// Pure layout math is exported for tests; buildSheets() makes the DOM for print mode.

export const PAPER = {
  legal: { label: 'Legal', w: 14 * 72, h: 8.5 * 72, inches: '8.5 × 14 in', booklet: true },
  ledger: { label: 'Ledger', w: 17 * 72, h: 11 * 72, inches: '11 × 17 in', booklet: true },
  letter: { label: 'Letter', w: 8.5 * 72, h: 11 * 72, inches: '8.5 × 11 in', booklet: false },
};

// saddle-stitch order for n pages (padded with blanks to a multiple of 4). Each sheet SIDE is
// [left page, right page]; null = blank. Sides alternate front, back, front, back …
export function bookletSides(n) {
  const total = Math.ceil(n / 4) * 4;
  const pg = (k) => (k <= n ? k : null);
  const sides = [];
  for (let i = 0; i < total / 4; i++) {
    sides.push([pg(total - 2 * i), pg(2 * i + 1)]);          // front
    sides.push([pg(2 * i + 2), pg(total - 2 * i - 1)]);      // back
  }
  return { total, blanks: total - n, sides };
}

// where each page goes on a sheet side and at what scale
export function placement(paper, page) {
  const P = PAPER[paper];
  if (!P.booklet) {
    const s = Math.min(1, P.w / page.width, P.h / page.height);
    return { scale: s, slots: [{ x: (P.w - page.width * s) / 2, y: (P.h - page.height * s) / 2 }] };
  }
  const half = P.w / 2;
  const s = Math.min(half / page.width, P.h / page.height);
  const y = (P.h - page.height * s) / 2;
  // the two pages meet at the fold
  return { scale: s, slots: [{ x: half - page.width * s, y }, { x: half, y }] };
}

// a plain-language summary for the print window
export function describe(paper, page, nPages) {
  const P = PAPER[paper];
  const { scale } = placement(paper, page);
  const pct = Math.round(scale * 100);
  if (!P.booklet) return P.label + ' ' + P.inches + ': ' + nPages + ' sheets, one page each, ' + (pct === 100 ? 'actual size' : pct + '%') + '.';
  const b = bookletSides(nPages);
  return P.label + ' ' + P.inches + ' booklet: ' + b.sides.length / 2 + ' sheets printed on both sides (flip on the short edge), ' +
    (pct === 100 ? 'actual size' : 'enlarged to ' + pct + '%') + '. Fold the stack and staple the spine.' +
    (b.blanks ? ' ' + b.blanks + ' blank page' + (b.blanks === 1 ? '' : 's') + ' added at the end to make whole sheets.' : '');
}

// print mode: one DOM "sheet side" per printed page. renderPage(n) makes a page element.
export function buildSheets(stage, paper, page, numbers, renderPage) {
  const P = PAPER[paper];
  const { scale, slots } = placement(paper, page);
  const sides = P.booklet ? bookletSides(numbers.length).sides.map((s) => s.map((k) => (k == null ? null : numbers[k - 1])))
    : numbers.map((n) => [n]);
  for (const side of sides) {
    const sheet = document.createElement('div');
    sheet.className = 'sheet';
    Object.assign(sheet.style, { position: 'relative', width: P.w + 'pt', height: P.h + 'pt', overflow: 'hidden', breakAfter: 'page', background: '#fff' });
    side.forEach((n, i) => {
      if (n == null) return;
      const holder = document.createElement('div');
      Object.assign(holder.style, { position: 'absolute', left: slots[i].x + 'pt', top: slots[i].y + 'pt',
        width: page.width + 'pt', height: page.height + 'pt', transform: 'scale(' + scale + ')', transformOrigin: 'top left' });
      holder.appendChild(renderPage(n));
      sheet.appendChild(holder);
    });
    stage.appendChild(sheet);
  }
  return sides.length;
}
