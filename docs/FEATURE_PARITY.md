# Feature parity with Microsoft Publisher

*Required by the original handoff (`bulletin-builder/bulletin-builder-handoff.md` §3, "Phase 2 goal").
Created 2026-10-19 — it should have existed from the start. **The goal of this program is to
duplicate Publisher; custom features come after parity** (Kevin, 2026-10-19).* Update a row whenever
a feature lands. Scope = Publisher's **File, Home, Insert, Page Design, View** tabs (Mailings and
Review out). The ribbon must use Publisher's tab names and group order.

Status: ✅ done · 🟡 partial · ⬜ not started · ➖ out of scope

**Testing rule (Kevin, 2026-10-19):** a row is ✅ only when a GUI suite drives it with real
mouse/keyboard input (`node test/gui/run-all.js`, 15 suites; see `test/gui/harness.js`).

## Ribbon / overall look

| Item | Status | Notes |
|---|---|---|
| Ribbon with Publisher's tabs (File · Home · Insert · Page Design · View) and grouped commands | ✅ | `src/renderer/ribbon.js`. Unbuilt commands greyed "Coming soon". Contextual **Picture / Shape / Text Box Format** tabs. Extra **Bulletin** tab for our own features. |
| Page navigation pane (thumbnails down the left) | ✅ | 2026-10-20: page thumbnails in spreads, click to go, current page outlined, right-click menu (Insert / Duplicate / Delete / Move). Rename ⬜ |
| Right-click menus on the page | ✅ | 2026-10-20: object, empty page, and text menus |
| Rulers | ✅ | 2026-10-20: View ▸ Rulers; tab stops + indent markers (see Paragraph) |
| Scratch area around the spread | 🟡 | Pasteboard exists as a separate view, not around the page |
| "Most Used" customizable tab | ⬜ | Spec extra; after parity |

## Typing in a text box

| Item | Status | Notes |
|---|---|---|
| One click in text puts the caret there (and selects the box); drag over text selects it; double-click selects a word | ✅ | 2026-10-20 (batch-1 item 5) |
| Drag the box border to move it; handles size it; Esc leaves the text with the box still selected | ✅ | |
| Click from one box's text into another's | ✅ | |
| Manual breaks: Ctrl+Enter text box break, Ctrl+Shift+Enter column break, Insert ▸ Break | ✅ | 2026-10-20 (item 8). Backspace removes a break (after its marker, or at the start of the next box) |
| Text box linking: Create Link (or the overflow tag), Break, Previous, Next | ✅ | 2026-10-20 |

## File (Backstage)

| Item | Status | Notes |
|---|---|---|
| Open / Save / Recent | ✅ | |
| Save As | ✅ | 2026-10-20: copies the week folder; unsaved changes go into the copy (F12) |
| New (blank sizes, templates) | 🟡 | Only "New Week from This One" |
| Print (printer, copies, range, booklet imposition, preview) | 🟡 | Windows print dialog; booklet imposition + preview ⬜ |
| Export PDF | ✅ | |
| Export pages as PNG/JPG, Pack and Go | ⬜ | |
| Info (fonts used, image manager) | 🟡 | Fonts used/missing; image manager ⬜ |
| Options | ⬜ | |

## Home

| Group | Status | Notes |
|---|---|---|
| Clipboard: cut/copy/paste objects | ✅ | Ribbon, right-click, Ctrl+X/C/V/D |
| Clipboard: Format Painter | ✅ | 2026-10-20: click = once, double-click = until Esc |
| Clipboard: Paste Special | ⬜ | |
| Font: family, size, B/I/U, grow/shrink, sub/superscript, case, colour, spacing, clear | ✅ | Boxes and B/I/U follow the caret (2026-10-20). Strikethrough ⬜ |
| Paragraph: align, bullets, numbering, indents, line spacing, Paragraph… dialog, columns, ¶ | ✅ | |
| Paragraph: tab stops | ✅ | 2026-10-20: ruler (click/drag/drag-off), Tabs dialog (position, alignment, leader), indent markers |
| Paragraph: drop cap | ⬜ | |
| Styles: apply a named style, New Style… | ✅ | 2026-10-20: gallery of the week's styles (from Publisher). Modify Style / Import Styles ⬜ |
| Objects: text box, picture, line, rectangle | ✅ | |
| Objects: table, other shapes | ⬜ | |
| Arrange: wrap text, front/back, align & distribute, group, rotate/flip, multi-select | ✅ | GUI-tested 2026-10-20 |
| Arrange: free-rotate handle | ✅ | 2026-10-20 (Shift = 15° steps) |
| Arrange: forward/backward one step | ⬜ | Front/back only |
| Arrange: size & position with exact numbers | ✅ | |
| Editing: Find / Replace | ✅ | 2026-10-20: task pane, Ctrl+F / Ctrl+H, whole word, match case |
| Editing: Select ▾ (all objects, all text in box) | ✅ | 2026-10-20; Ctrl+A |

## Insert

| Item | Status | Notes |
|---|---|---|
| Pages: insert / duplicate / delete / move page | ✅ | Undo/Redo of page changes ✅ (2026-10-20). Rename ⬜ |
| Tables | ⬜ | |
| Pictures from file | ✅ | Crop (with the cut-away part shown dimmed, 2026-10-20), Fit, Fill |
| Shapes with fill/outline | 🟡 | Line + rectangle only |
| Building blocks | ⬜ | Kevin's "service-music library" request lives here (design first) |
| Text box, Symbol, Date & Time | ✅ | Symbol + Date & Time 2026-10-20. Insert File ⬜ |
| Breaks (text box / column) | ✅ | 2026-10-20 |
| Hyperlinks | ⬜ | |
| Header & footer, page number fields | ⬜ | |

## Page Design

| Item | Status | Notes |
|---|---|---|
| Page setup: margins, size, booklet preset | 🟡 | Legal-booklet set by import; no UI |
| Guides (margin / ruler), snap to guides & objects | 🟡 | Snapping on; Alt = off. Dragging new guides from the ruler ⬜ |
| Colour & font schemes | ⬜ | |
| Page background | ⬜ | |
| Master pages | ⬜ | |

## View

| Item | Status | Notes |
|---|---|---|
| Two-page spread / single page | 🟡 | Spread view; single-page toggle ⬜ |
| Zoom in/out, whole spread, 100%, page width, selected objects | ✅ | Selected Objects 2026-10-20 |
| Rulers, boundaries, guides, page navigation | ✅ | |
| Graphics manager | ⬜ | |
| Master page view | ⬜ | |

## Publisher behaviours that already work

Linked text frames that re-flow · text overflow warning + overflow tag · locking frames/pages ·
undo/redo (including page changes) · autosave + version history · two-person half locking ·
Publisher `.pub` import (fidelity 0.948).

## Beyond Publisher (built already; frozen until parity)

Order of Worship flow layout (Phase 3), Word `.docx` import, Cover/Styles tabs, New Week, hymn tune
names in small caps. Worship pages become hand-editable once **item 6** is approved
(`docs/ITEM6_DESIGN.md`).
