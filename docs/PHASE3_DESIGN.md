# Phase 3 — flow editing for the worship half: design

*2026-10-15. Phase 3 lets Kevin build the worship pages as an ordered list of liturgical blocks
that the app lays out onto the 6" text grid of the October Word bulletins, instead of hand-placing
frames. Written before the build; the "Status" table is updated as passes land.*

| Pass | Scope | Status |
|---|---|---|
| **3a** | flow model in `worship.json` · block → paragraph compiler · paginator (keep-with-next, images never split, no mid-line splits) · generated frames saved as ordinary frames | see PHASE3 status |
| **3b** | Order-of-Worship panel: select / add / move / duplicate / delete blocks, per-kind fields, standing (†/*) checkbox, people lines bold automatically, click a page line to select its block | |
| **3c** | cover block (fields → the Publisher cover layout) · global styles editor (one change re-lays everything) · `import_docx.py` (October Word bulletin → flow week) | |

## The one big decision: layout is generated, then stored as ordinary frames

The paginator turns `flow` (the source) into ordinary text and picture frames on the worship pages
and **saves them** in `worship.json` with `"generated": true`. Consequences:

- `renderPage()`, PDF export, the fidelity check and the announcements person's view need **no
  change at all** — a flow page is just frames.
- What prints on any PC is exactly what Kevin saw when he laid it out, even if that PC is missing a
  font (pagination is not re-run by a viewer).
- `worship.json` records `layout.flowHash`. If the flow changed without a re-layout (e.g. the
  importer wrote a new flow), the app re-lays it out on open (in memory; saved on the next save).
- Generated frames can't be dragged or typed in; clicking one selects its block in the panel.
  Frames Kevin adds by hand on a flow page (Phase 2 tools) are kept and never touched by layout.

## Data model (format stays v1 — additive)

```json
worship.json
{ "format": "bulletin-builder/half", "version": 1, "half": "worship",
  "mode": "flow",                       // absent = fixed layout (Phase 2)
  "flow": {
    "grid":   { "left": 36, "top": 36, "width": 432, "height": 540,
                "tabs": [ {"pos": 36,"align":"left"}, {"pos":216,"align":"center"}, {"pos":432,"align":"right"} ] },
    "styles": { "item": {…}, "section": {…}, "leader": {…}, "people": {…}, "prayer": {…},
                "scripture": {…}, "rubric": {…}, "credit": {…}, "body": {…}, "note": {…} },
    "cover":  { "date", "day", "service", "art": {"asset","title","artist"}, "commentary": [paras] },
    "blocks": [ block, … ]
  },
  "layout": { "flowHash": "…", "pages": [2,3,…], "overflowBlocks": [] },
  "pages":  { "1": { "frames": [ … generated + hand-placed … ] }, … },
  "pasteboard": []
}
```

**Style** (one per role; one change updates every block that uses it):
`{ font, size, bold, italic, align, spaceBefore, spaceAfter, indentLeft, indentFirst, lineSpacing, color }`.

**Block** — every block has `id`, `kind`, optional `heading`, optional `note`:

| kind | body | renders as |
|---|---|---|
| `item` | none (heading only) + optional `rubric` text | `PRELUDE ⇥ "Title" ⇥ Composer` on the grid tabs; rubric centred italic under it |
| `section` | `text` | centred divider `——— WE GATHER ———` |
| `dialog` | `lines: [{who: leader\|people\|all, text}]` | leader lines regular at 18 pt; **people/all lines bold**, indented to 36 pt |
| `prayer` | `lines: [text]`, `unison: true` | unison prayer, bold; a leading tab indents a continuation line |
| `scripture` | `paragraphs: [text]` | scripture style (10 pt), first-line tab |
| `hymn` / `image` | `images: [asset…]`, `width` (default full 432) | heading line, then each picture full measure; **a picture never splits** |
| `rubric` | `text` | italic centred instruction |
| `text` | `paragraphs: [format paragraphs]` | escape hatch: rich paragraphs exactly as stored (psalter, Great Thanksgiving, credits) |
| `space` | `height` | vertical gap |

`heading = { standing: bool, label, middle, right }` → `*LABEL ⇥ middle ⇥ right` (the standing
mark is a checkbox, never typed). `note` = a boxed glossary note (Avenir 10) rendered beside the
block's first line in the outside margin area, like the Publisher "Collect (COL-lect)" boxes.

## Pagination rules

1. Text width 432 pt from x = 36; pages 2…9 (every worship page after the cover), top 36, bottom 576.
2. Paragraphs are measured with the real renderer (same fonts, tabs). A paragraph may split
   **between lines**, never mid-line; the continuation drops its space-before.
3. `keepWithNext`: a heading never ends a page — if what follows it doesn't fit, the heading moves
   to the next page with it (chains back across several keep-with-next lines).
4. Pictures never split; a picture that doesn't fit the rest of a page starts the next one.
5. A block may set `pageBreakBefore: true`.
6. If the flow needs more pages than the worship half has, the leftover blocks are listed as
   **overflow** (red warning in the panel and status bar) — page count is a manifest-level change
   shared with the announcements half, so it isn't changed automatically.

## Editing (worship half claimed, mode = flow)

A right-hand **Order of Worship** panel lists the blocks. Select one to edit its fields; Add
(kind menu, inserts after the selection), Move up/down, Duplicate, Delete. Every change goes
through the Phase 2 `commit()` (undo/redo/save/history unchanged), then the flow is re-laid out and
the worship pages re-rendered. **Styles** and **Cover** are tabs in the same panel.

## Testing

`electron . --selftest-flow <week.bulletin>` on a temp copy: layout invariants (every generated
frame inside the text area, no overflow, block text in order, no heading last on a page, pictures
whole), panel edits (field edit, add, move, delete + undo, standing checkbox, people bold), global
style change re-lays out, cover edit, save → disk. `--selftest-edit` (61) and the fidelity check on
the Publisher week must keep passing — fixed-layout weeks are untouched by Phase 3.
