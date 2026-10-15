# Bulletin Builder file format — version 1

*Status: Phase 1 (read-only viewer). Fields marked **(P2)** are reserved for editing features and
may be absent. Bump `version` on any breaking change and add a migration note at the bottom.*

All measurements are **points** (1/72 inch). Coordinates are relative to the page's top-left
corner. Colours are `#RRGGBB`.

---

## 1. A week is a folder

```
10-18-26 1100/
  10-18-26 1100.bulletin   manifest — double-click to open
  worship.json             Kevin's half
  announcements.json       communications half
  assets/                  every picture the week uses
  history/                 (P2) a snapshot of each half on every save
  locks/                   (P2) "<half>.lock" while someone is editing that half
```

Two people can work at once because they write **different files**. Each half has its own lock.

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

- `pages` is keyed by page number (string). Frames are listed back-to-front (`z` ascending).
- `pasteboard` holds parked items (QR codes, flyers, photos). It is saved in the file and **never
  printed**. Coordinates are relative to the left page of the spread being viewed, so items can
  sit at negative x/y.
- `guides`: `{ "pos": 120, "axis": "horizontal" | "vertical" }`.

## 4. Frames

Common fields:

| Field | Meaning |
|---|---|
| `id` | stable id, unique in the week |
| `kind` | `text` · `image` · `shape` · `group` |
| `x`, `y`, `w`, `h` | box in points |
| `z` | stacking order |
| `rotation` | degrees clockwise, about the box centre |
| `flipH`, `flipV` | mirror |
| `fill` | `{ "color": "#…", "opacity": 0–1 }` |
| `stroke` | `{ "color": "#…", "width": 0.5 }` |
| `locked` | (P2) cannot be moved or resized |
| `source` | where it came from (`{ "name", "id" }` of the Publisher shape on import) |

**`group`** — `children: [frames]`. Children keep page coordinates (not group-relative).

**`shape`** — `shape: { "type": "line" | "rect" }`. A line is drawn along the top edge of its box
(a box with `h` ≈ 0) with the frame's `stroke`.

**`image`**

```json
"image": { "asset": "assets/Mafa027-medium.jpg", "crop": [l, t, r, b], "fit": "crop" }
```

`crop` is the fraction of the picture removed from each side (0.1 = 10%). Negative values add
blank space. The visible part is stretched to the box, so the importer keeps the box and crop in
proportion. `matchConfidence: "low"` marks an imported picture the importer could not match with
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

- **Linked frames:** frames sharing a `chain.story` are one story flowing in `index` order. In v1
  each frame holds the portion of the story it showed in Publisher (so imports keep Publisher's
  exact breaks). (P2) the editor re-flows the story across the chain and flags overflow.

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

## Change log

- **v1 (2026-10-15)** — first version, produced by `import_pub.py` from the Publisher capture.
