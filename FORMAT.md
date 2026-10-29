# Bulletin Builder file format — version 1

*Status: Phase 3 (flow mode for the worship half) — every field below is read AND written by the app.
Bump `version` on any breaking change and add a migration note at the bottom.*

All measurements are **points** (1/72 inch). Coordinates are relative to the page's top-left
corner. Colours are `#RRGGBB`.

---

## 1. A week is a folder

```
10-18-26 1100/
  10-18-26 1100.bulletin   manifest — double-click to open
  worship.json             Kevin's half
  announcements.json       communications half
  assets/                  every picture the week uses (inserted pictures are copied in here)
  history/                 <half>-YYYY-MM-DD_HHMMSS.json — the previous version, copied before every save
  locks/                   <half>.lock — { user, machine, pid, since } while someone edits that half
```

Two people can work at once because they write **different files**. Each half has its own lock.
A lock is refreshed every minute; one not refreshed for 5 minutes (or left by the same person's
crashed app on the same PC) may be taken over. `history/` is append-only; the app never deletes it.
Saves write `<file>.saving` then rename it over the real file.

**Service Music library** (2026-10-29) — a `Service Music/` folder **beside** the week folders (so
everyone who shares the weeks shares it): `library.json` = `{ format: "bulletin-builder-music", version: 1,
items: [ { id, category, file, added, …fields } ] }` + one picture per item (`<id>.<ext>`). `category` is
`psalter` (fields `psalm`, `response`), `doxology` (`tune`, `title`), `communion` (`setting`, `part`,
`order`), `taize` / `benediction` / `other` (`title`); any may carry a `note`. Using an item copies its
picture into the week's `assets/` (same bytes = same file), so a week never depends on the library.
Removing an item sends its picture to the Recycle Bin; weeks that used it keep their copy.

## 2. Manifest (`<name>.bulletin`)

```json
{
  "format": "bulletin-builder/week",
  "version": 1,
  "title": "9-20-26 1100",
  "page": { "width": 504, "height": 612 },
  "preset": "legal-booklet",
  "margins": { "top": 36, "bottom": 36, "inside": 36, "outside": 36, "mirror": true },
  "defaultTabStop": 36,
  "pages": [ { "number": 1, "half": "worship" }, … ],
  "halves": { "worship": "worship.json", "announcements": "announcements.json" },
  "colorScheme": { "name": "…", "colors": { "main": { "hex": "#000000" }, … } },
  "styles": [ { "name": "Bulletin Text", "font": { … }, "paragraph": { … } } ],
  "importedFrom": { … }
}
```

- `pages` is the reading order. `half` says which half file holds that page's content.
- Presets: `legal-booklet` (7×8.5 pages on folded legal), `tabloid-booklet` (8.5×11 on folded
  11×17), `letter-sheet` (Connection). Booklet presets need a page count that is a multiple of 4.
- `styles` are named paragraph styles. In v1 every run also carries its explicit formatting, so
  rendering does not depend on styles; styles drive editing in later phases.

## 3. Half file (`worship.json`, `announcements.json`)

```json
{
  "format": "bulletin-builder/half",
  "version": 1,
  "half": "announcements",
  "pages": { "10": { "frames": [ … ], "guides": [ … ], "background": "#FFFFFF" } },
  "pasteboard": [ … frames … ]
}
```

- `pages` is keyed by page number (string). Frames are listed in no particular order; `z` decides
  stacking. A page may carry `"locked": true` (every frame on it is then locked).
- `pasteboard` holds parked items (QR codes, flyers, photos). It is saved in the file and **never
  printed**. Coordinates are relative to the left page of the spread being viewed, so items can
  sit at negative x/y.
- `guides`: `{ "pos": 120, "axis": "horizontal" | "vertical" }`.

## 4. Frames

Common fields:

| Field | Meaning |
|---|---|
| `id` | stable id, unique in the week (`f<n>` = imported from Publisher shape n; `n…` = made in the app) |
| `kind` | `text` · `image` · `shape` · `group` |
| `x`, `y`, `w`, `h` | box in points |
| `z` | stacking order |
| `rotation` | degrees clockwise, about the box centre |
| `flipH`, `flipV` | mirror |
| `fill` | `{ "color": "#…", "opacity": 0–1 }` |
| `stroke` | `{ "color": "#…", "width": 0.5 }` |
| `locked` | cannot be moved, resized, cropped or deleted (still selectable, to unlock) |
| `source` | where it came from (`{ "name", "id" }` of the Publisher shape on import) |

**`group`** — `children: [frames]`. Children keep page coordinates (not group-relative).

**`shape`** — `shape: { "type": "line" | "rect" }`. A line is drawn along the top edge of its box
(a box with `h` ≈ 0) with the frame's `stroke`.

**`image`**

```json
"image": { "asset": "assets/Mafa027-medium.jpg", "crop": [l, t, r, b], "fit": "crop" }
```

`crop` is the fraction of the picture removed from each side (0.1 = 10%). Negative values add
blank space. The visible part is stretched to the box, so the app always keeps box and crop in
proportion (pictures never distort). `fit` records how the crop was last set: `"crop"` (by hand /
imported), `"fit"` (whole picture inside the box, blank bands), `"fill"` (box covered, centred crop). `matchConfidence: "low"` marks an imported picture the importer could not match with
certainty — check it.

**`text`**

```json
"text": {
  "inset": [top, right, bottom, left],
  "valign": "top" | "middle" | "bottom",
  "columns": 3, "columnGap": 2.88,
  "chain": { "story": "story-1", "index": 0 },
  "paragraphs": [ paragraph, … ]
}
```

- **Linked frames:** frames sharing a `chain.story` are one story flowing in `index` order. Each
  frame stores the portion it currently shows (imports keep Publisher's exact breaks). When a
  paragraph is cut by a frame edge, the head carries `"continues": true` and the rest starts the
  next frame; the app rejoins them when it re-flows the story (after typing in, resizing, or
  deleting a linked frame). Text that doesn't fit the last frame is kept and flagged as overflow.

Paragraph:

```json
{
  "style": "Bulletin Text",
  "align": "left" | "center" | "right" | "justify",
  "spaceBefore": 6, "spaceAfter": 0,
  "indentLeft": 0, "indentRight": 0, "indentFirst": 0,
  "lineSpacing": { "multiple": 1.1 } | { "exact": 13 },   // absent = single
  "keepWithNext": true,
  "tabs": [ { "pos": 216, "align": "left" | "center" | "right" | "decimal", "leader": "dot" } ],
  "mark": { "font": "Palatino Linotype", "size": 11 },     // sets the height of an empty line
  "runs": [ run, … ]
}
```

Tab positions are measured from the left edge of the frame's text area. Past the last tab stop,
default stops fall every `defaultTabStop` points.

Run:

```json
{ "text": "Praise the Lord!", "font": "Palatino Linotype", "size": 11,
  "bold": true, "italic": true, "underline": true, "smallCaps": true, "allCaps": true,
  "superscript": true, "subscript": true, "strike": true,
  "color": "#1F497D", "tracking": 112.5, "scaling": 100 }
```

Absent booleans are false; absent colour is black. `tracking` is Publisher's percentage (100 =
normal). Inside `text`: `\t` = tab, `\n` or `\u000b` = line break within the paragraph,
`\u000c` = "continue in next frame" (not printed).

---

## 5. Flow mode (worship half)

A half with `"mode": "flow"` is built from an ordered list of blocks; the app lays them out on
the worship pages. Absent `mode` = fixed layout (sections 3–4 only).

```json
{ "half": "worship", "mode": "flow",
  "flow": {
    "grid": { "left": 36, "top": 36, "width": 432, "height": 540, "tabs": [ … ] },
    "standingMark": "*",
    "styles": { "item": { "font": "Palatino Linotype", "size": 11, "spaceBefore": 11, "keepWithNext": true }, … },
    "cover": { "date", "day", "service", "logo", "art": { "asset", "title", "artist" }, "commentary": [ paragraphs ] },
    "blocks": [ block, … ]
  },
  "layout": { "flowHash": "1-…", "version": 1, "overflowBlocks": [ ids ], "blockPage": { id: page } },
  "pages": { "1": { "frames": [ … ] }, … } }
```

- **Styles** — one per role: `item` (order-of-worship line), `section`, `rubric`, `leader`,
  `people`, `prayer`, `scripture`, `body`, `credit`, `note`. Fields: `font, size, bold, italic,
  align, spaceBefore, spaceAfter, indentLeft, indentRight, indentFirst, lineSpacing, color,
  keepWithNext`. An explicit `false` overrides the built-in default (e.g. People not bold).
- **Block** — `{ id, kind, heading?, rubric?, note?, spaceBefore?, pageBreakBefore?, keepTogether? }` plus:

| kind | body |
|---|---|
| `item` | heading only (+ `rubric` text) |
| `section` / `rubric` | `text` |
| `dialog` | `lines: [{ who: "leader" | "people", text }]` — people lines use the bold People style |
| `prayer` | `lines: [text]` (a leading tab = indented line), `unison` (default true = bold) |
| `scripture` | `paragraphs: [text]` |
| `hymn` / `image` | `images: [asset]`, optional `imageWidths: [pt]` (default the full 432) |
| `text` | `paragraphs: [format paragraphs]` — rich, kept exactly |
| `space` | `height` (pt) |

  `heading = { standing, label, middle, right }` prints `*LABEL ⇥ middle ⇥ right`. `note` = paragraphs
  (or strings) shown in a column at the right of the text area beside the block.
- **Layout** — the app writes the result as ordinary frames with `"generated": true` (text frames
  whose paragraphs carry `block`; pictures/rules carry `block`; the cover's frames have
  `block: "cover"`). Frames without `generated` were placed by hand and are never touched by
  layout. `layout.flowHash` fingerprints the flow + worship pages + layout rules; when it doesn't
  match, the app lays the flow out again on open (in memory; saved with the next save).
  `justifyLast` on a paragraph = the head of a justified paragraph split across pages.

---

## Change log

- **v1 (2026-10-15)** — first version, produced by `import_pub.py` from the Publisher capture.
  Same day, still v1 (additive, older files read fine): `continues`, page/frame `locked`,
  `image.fit` = `fit`/`fill`, `history/` and `locks/` written by the app.
- **v1, Phase 3 (2026-10-15)** — still v1 (additive): half `mode`/`flow`/`layout`, frame `generated`/`block`/`note`,
  paragraph `block`/`justifyLast`. Written by `import_docx.py` and the app.
- **v1 (2026-10-29)** — still v1 (additive): the `Service Music/` library beside the weeks (§1). Paragraph
  `picture` (in-line picture: `{ asset, w, h, before?, after? }`) is now also written by Insert ▸ Service Music
  into any text box, not only by Finish Layout.
