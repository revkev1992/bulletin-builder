# Feature parity with Microsoft Publisher

*Required by the original handoff (`bulletin-builder/bulletin-builder-handoff.md` §3, "Phase 2 goal").
Created 2026-10-19 — it should have existed from the start. **The goal of this program is to
duplicate Publisher; custom features come after parity** (Kevin, 2026-10-19).* Update a row whenever
a feature lands. Scope = Publisher's **File, Home, Insert, Page Design, View** tabs (Mailings and
Review out). The ribbon must use Publisher's tab names and group order.

Status: ✅ done · 🟡 partial · ⬜ not started · ➖ out of scope

## Ribbon / overall look

| Item | Status | Notes |
|---|---|---|
| Ribbon with Publisher's tabs (File · Home · Insert · Page Design · View) and grouped commands | ⬜ | Today: a classic menu bar + one flat toolbar. Kevin's ribbon screenshots: `bulletin-builder/Screenshot 2026-10-14 *.png`. **Top priority.** |
| Page navigation pane (thumbnails down the left) | ⬜ | |
| Scratch area around the spread | 🟡 | Pasteboard exists as a separate view, not around the page |
| "Most Used" customizable tab | ⬜ | Spec extra; after parity |

## File (Backstage)

| Item | Status | Notes |
|---|---|---|
| Open / Save / Recent | 🟡 | Open + Save; no Save As, no Recent list, no backstage screen |
| New (blank sizes, templates) | 🟡 | Only "New Week from This One" |
| Print (printer, copies, range, booklet imposition, preview) | ⬜ | PDF export only |
| Export PDF | ✅ | |
| Export pages as PNG/JPG, Pack and Go | ⬜ | |
| Info (fonts used, image manager) | ⬜ | |
| Options | ⬜ | |

## Home

| Group | Status | Notes |
|---|---|---|
| Clipboard: cut/copy/paste frames | ✅ | Ctrl+C/V/D; paste text is plain |
| Clipboard: paste special, format painter | ⬜ | |
| Font: family, size, B/I/U | ✅ | |
| Font: grow/shrink, strike, super/subscript, change case, colour, character spacing, clear formatting | ⬜ | |
| Paragraph: align L/C/R/justify | ✅ | |
| Paragraph: bullets, numbering, indents, line spacing, space before/after, tab stops, columns, drop cap | ⬜ | Imported values render; no UI to change them |
| Styles: named paragraph styles | ⬜ | Imported from Publisher, not offered in the UI |
| Objects: text box, picture, line, rectangle | ✅ | Insert Text / Picture… / Line / Box |
| Objects: table, other shapes | ⬜ | |
| Arrange: wrap text | 🟡 | Imported wraps work; no UI to set wrap |
| Arrange: bring to front / send to back | ✅ | Forward/backward one step ⬜ |
| Arrange: align & distribute, group/ungroup, multi-select, rotate/flip | ⬜ | Groups imported from Publisher move together |
| Arrange: size & position with exact numbers | ✅ | X/Y/W/H in inches |
| Editing: find / replace / select all | ⬜ | |

## Insert

| Item | Status | Notes |
|---|---|---|
| Pages: insert / duplicate / delete / move page | ⬜ | Needed so a week can grow from 9 to 10 worship pages the Publisher way |
| Tables | ⬜ | |
| Pictures from file | ✅ | Crop, Fit, Fill |
| Shapes with fill/outline | 🟡 | Line + rectangle only |
| Building blocks | ⬜ | |
| Text box, symbol, date/time, text from file | 🟡 | Text box only |
| Hyperlinks | ⬜ | |
| Header & footer, page number fields | ⬜ | |

## Page Design

| Item | Status | Notes |
|---|---|---|
| Page setup: margins, size, booklet preset | 🟡 | Legal-booklet set by import; no UI |
| Guides (margin / ruler), snap to guides & objects | ✅ | Snapping on; Alt = off. Adding ruler guides ⬜ |
| Colour & font schemes | ⬜ | |
| Page background | ⬜ | |
| Master pages | ⬜ | |

## View

| Item | Status | Notes |
|---|---|---|
| Two-page spread / single page | 🟡 | Spread view; single-page toggle ⬜ |
| Zoom in/out, whole spread | ✅ | Page width, selected object ⬜ |
| Rulers, boundaries, guides toggles | ⬜ | |
| Graphics manager | ⬜ | |
| Master page view | ⬜ | |

## Publisher behaviours that already work

Linked text frames that re-flow (create/break links in the UI ⬜) · text overflow warning ·
locking frames/pages · undo/redo · autosave + version history · two-person half locking ·
Publisher `.pub` import (fidelity 0.948).

## Beyond Publisher (built already; frozen until parity)

Order of Worship flow layout (Phase 3), Word `.docx` import, Cover/Styles tabs, New Week.
These stay working but get no new features until the rows above are done.
