# Feature parity with Microsoft Publisher

*Required by the original handoff (`bulletin-builder/bulletin-builder-handoff.md` §3, "Phase 2 goal").
Created 2026-10-19 — it should have existed from the start. **The goal of this program is to
duplicate Publisher; custom features come after parity** (Kevin, 2026-10-19).* Update a row whenever
a feature lands. Scope = Publisher's **File, Home, Insert, Page Design, View** tabs (Mailings and
Review out). The ribbon must use Publisher's tab names and group order.

Status: ✅ done · 🟡 partial · ⬜ not started · ➖ out of scope

**Testing rule (Kevin, 2026-10-19):** a row is ✅ only when a GUI suite drives it with real
mouse/keyboard input (`node test/gui/run-all.js`, 35 suites; see `test/gui/harness.js`).

**2026-11-02 (overnight session on the work PC):** Drop Cap · Modify / Update / Delete Style · Page Setup
(margins, size, orientation) · ruler guides + Align To · page background colour / image · Rename page ·
hyperlinks · Single Page view · Graphics Manager · shapes (oval, rounded rectangle, triangle, arrow,
diamond, arrow lines) with Shape Fill / Outline / weight · page-number fields, Header / Footer on every
page · Export pages as PNG/JPG · Pack and Go · Paste Special (clipboard picture) · Insert File (.txt/.docx) · Tables · Building Blocks.

## Ribbon / overall look

| Item | Status | Notes |
|---|---|---|
| Ribbon with Publisher's tabs (File · Home · Insert · Page Design · View) and grouped commands | ✅ | `src/renderer/ribbon.js`. Unbuilt commands greyed "Coming soon". Contextual **Picture / Shape / Text Box Format** tabs. Extra **Bulletin** tab for our own features. |
| Page navigation pane (thumbnails down the left) | ✅ | 2026-10-20: page thumbnails in spreads, click to go, current page outlined, right-click menu (Insert / Duplicate / Delete / Move). Rename ⬜ |
| Right-click menus on the page | ✅ | 2026-10-20: object, empty page, and text menus |
| Rulers | ✅ | 2026-10-20: View ▸ Rulers; tab stops + indent markers (see Paragraph) |
| Scratch area around the spread | ✅ | 2026-10-27: the Shelf (left strip) + free-form Scratch Area (off by default). 2026-10-29: either half can use the other half's parked items (a copy goes on the page) |
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
| New (blank sizes, templates) | 🟡 | Only "New Week from This One" (Page Setup can turn any week into letter / tabloid / custom, 2026-11-02) |
| Print (printer, copies, range, booklet imposition, preview) | 🟡 | 2026-10-27: Bulletin ▸ Print Legal/Ledger booklet (imposed, short-edge duplex, Ledger scaled up) + Letter; Save as PDF. 2026-10-29: "who arranges the booklet" — the printer's own booklet preset (pages in order, default) or Bulletin Builder. 2026-11-02: **Preview the sheets…** in the Print window (the imposed sides, or the pages in order), File ▸ Print ▸ Preview / Legal booklet / Ledger booklet (`preview.js`; suite `print`) |
| Export PDF | ✅ | |
| Export pages as PNG/JPG | ✅ | 2026-11-02: File ▸ Export ▸ Pages as Pictures — PNG or JPG, 150 or 300 dpi, one file per page (suite `fileextras`) |
| Pack and Go | ✅ | 2026-11-02: File ▸ Export ▸ Pack and Go — one zip: the week folder (no history/locks), its pictures, a FONTS list (missing ones flagged) and a README (`src/pack.js`, unit test `test/pack.test.js`) |
| Info (fonts used, image manager) | 🟡 | Fonts used/missing; the image manager is View ▸ Graphics Manager (2026-11-02) |
| Options | ⬜ | |

## Home

| Group | Status | Notes |
|---|---|---|
| Clipboard: cut/copy/paste objects | ✅ | Ribbon, right-click, Ctrl+X/C/V/D |
| Clipboard: Format Painter | ✅ | 2026-10-20: click = once, double-click = until Esc |
| Clipboard: Paste Special | ✅ | 2026-11-02: unformatted text (while typing) or the picture on the clipboard — a screenshot or copied image — placed on the page and saved with the week's pictures; Ctrl+V with nothing copied in the app does the same (suite `fileextras`) |
| Font: family, size, B/I/U, grow/shrink, sub/superscript, case, colour, spacing, clear | ✅ | Boxes and B/I/U follow the caret (2026-10-20). Small Caps button + Ctrl+Shift+K (2026-10-27). Strikethrough button (2026-10-29) |
| Paragraph: align, bullets, numbering, indents, line spacing, Paragraph… dialog, columns, ¶ | ✅ | |
| Paragraph: tab stops | ✅ | 2026-10-20: ruler (click/drag/drag-off), Tabs dialog (position, alignment, leader), indent markers |
| Paragraph: drop cap | ✅ | 2026-11-02: Drop Cap gallery (3 lines / 2 lines / Custom… / none), saved as `paragraph.dropCap`, drawn with CSS initial-letter (suite `dropcap`) |
| Styles: apply a named style, New Style… | ✅ | 2026-10-20: gallery of the week's styles (from Publisher). 2026-11-02: right-click a style ▸ **Modify…** (font, size, bold/italic/small caps, colour, alignment, spacing, indents), **Update to Match Selection**, **Delete** — every paragraph in the half using the style changes; one undo step with its paragraphs (suite `modstyle`). Import Styles ⬜ |
| Objects: text box, picture, line, rectangle | ✅ | |
| Objects: other shapes | ✅ | 2026-11-02: oval, rounded rectangle, triangle, right arrow, diamond, line with arrowhead(s) — SVG in the box, exact outline; **Shape Format ▸ Shape Styles**: Shape Fill, Shape Outline (colour, weight, arrows), No Fill / No Outline; a text box takes fill and outline too (suite `shapes`) |
| Objects: table | ✅ | 2026-11-02: see Insert ▸ Tables |
| Arrange: wrap text, front/back, align & distribute, group, rotate/flip, multi-select | ✅ | GUI-tested 2026-10-20 |
| Arrange: free-rotate handle | ✅ | 2026-10-20 (Shift = 15° steps); 2026-10-27 snaps to 90° with dashed guides, Alt = free |
| Arrange: forward/backward one step | ✅ | 2026-10-29: Bring Forward ▾ / Send Backward ▾ split menus (one step, or to front / back), also on right-click |
| Arrange: size & position with exact numbers | ✅ | |
| Editing: Find / Replace | ✅ | 2026-10-20: task pane, Ctrl+F / Ctrl+H, whole word, match case |
| Editing: Select ▾ (all objects, all text in box) | ✅ | 2026-10-20; Ctrl+A |

## Insert

| Item | Status | Notes |
|---|---|---|
| Pages: insert / duplicate / delete / move page | ✅ | Undo/Redo of page changes ✅ (2026-10-20). Rename ✅ 2026-11-02 (Page Design ▸ Rename, Pages pane right-click; shown under the thumbnail) |
| Tables | ✅ | 2026-11-02: Insert ▸ Table (rows × columns); each cell is typed in like a text box (click = caret; an empty cell's blank is replaced as you type); rows grow with their text; **Table Format**: Insert Above / Below / Left / Right, Delete Row / Column, Borders (all / none / colour / weight), Cell Fill; dragging the handles sizes the columns in proportion; a real `<table>` in the PDF (`table.js`, `tableedit.js`; suite `tables`). Merge / split cells, table styles ⬜ |
| Pictures from file | ✅ | Crop (with the cut-away part shown dimmed, 2026-10-20), Fit, Fill |
| Shapes with fill/outline | ✅ | 2026-11-02: see Home ▸ Objects: other shapes |
| Building blocks | ✅ | 2026-10-29: **Service Music library** (Insert ▸ Service Music): psalters (psalm + response), doxologies (tune), communion settings (setting + parts in order), Taizé, benediction responses, other; kept beside the weeks; goes in-line in the text (moves with it, like Word), or into the Order of Worship block; Replace for a new season. 2026-11-02: **Building Blocks** (Insert ▸ Page Parts / Borders & Accents / Calendars, right-click ▸ Add to Building Blocks…): select objects ▸ name them ▸ kept with their pictures in a `Building Blocks` folder beside the weeks (shared); the pane shows thumbnails; Insert places a copy (new ids) on the page you are editing; Rename / Remove (`blocks.js`, main `blocks:*`; suite `blocks`). No starter set yet (Kevin and the communications person save their own) |
| Text box, Symbol, Date & Time, Insert File | ✅ | Symbol + Date & Time 2026-10-20. Insert File 2026-11-02: the text of a .txt or Word .docx where you are typing (`src/pack.js` reads the .docx) |
| Breaks (text box / column) | ✅ | 2026-10-20 |
| Hyperlinks | ✅ | 2026-11-02: Insert ▸ Link / Ctrl+K / right-click Hyperlink…: text + address (web or e-mail; https:// and mailto: added); a real `<a>` on the page, so the PDF and the website carry it; Ctrl+click opens it in the browser; Edit / Remove Hyperlink; new links blue + underlined (suite `insertview`). Bookmarks ⬜ |
| Header & footer, page number fields | ✅ | 2026-11-02: page-number / page-count **fields** (at the caret; top or bottom of every page), **Header / Footer on Every Page…** with # and ## in the text; a week has no master page, so each page of your half gets its own small box (role header / footer / pagenum), Remove takes them all off (suite `fields`) |

## Page Design

| Item | Status | Notes |
|---|---|---|
| Page setup: margins, size, booklet preset | ✅ | 2026-11-02: Page Design ▸ Margins / Size / Orientation ▾ — Publisher's Page Setup dialog (legal booklet, tabloid booklet, letter sheet, custom; portrait/landscape; top/bottom/inside/outside, mirrored). Written to the .bulletin file by the main process (history copy first); the worship flow grid follows the margins and the Order of Worship lays itself out again (suite `design`). Not undoable |
| Guides (margin / ruler), snap to guides & objects | ✅ | 2026-11-02: Page Design ▸ Guides ▾ (add horizontal / vertical, clear all) and **drag a guide off either ruler** onto a page; drag a guide to move it, off the page to remove it; green lines, saved per page (`page.guides`), never printed; **Align To ▸ Guides / Objects** switch the snapping (suite `design`) |
| Colour & font schemes | ⬜ | (liturgical-season themes stay a v2 item) |
| Page background | ✅ | 2026-11-02: Background ▾ (colour swatches, More Colors…, None) for the current page; **Apply Image** = a picture filling the page behind everything (suite `design`) |
| Master pages | ⬜ | Header / Footer / Page Number on every page cover the common use (see Insert) |

## View

| Item | Status | Notes |
|---|---|---|
| Two-page spread / single page | ✅ | 2026-11-02: View ▸ Single Page / Two-Page Spread (remembered per PC; the Pages pane keeps its spreads; Whole Page / Page Width zoom fit the one page) (suite `insertview`) |
| Zoom in/out, whole spread, 100%, page width, selected objects | ✅ | Selected Objects 2026-10-20 |
| Rulers, boundaries, guides, page navigation | ✅ | |
| Graphics manager | ✅ | 2026-11-02: View ▸ Show ▸ Graphics Manager — every picture (page objects, in-line music, parked items): page, printed size, pixels, dpi; flags missing files and under-150-dpi pictures; click a row to select it (suite `insertview`) |
| Master page view | ⬜ | |

## Publisher behaviours that already work

Linked text frames that re-flow · text overflow warning + overflow tag · locking frames/pages ·
undo/redo (including page changes) · autosave + version history · two-person half locking ·
Publisher `.pub` import (fidelity 0.948).

## Beyond Publisher (built already; frozen until parity)

Order of Worship flow layout (Phase 3), Word `.docx` import, Cover/Styles tabs, New Week, hymn tune
names in small caps. **Item 6 built 2026-10-27:** Finish Layout makes the worship pages one linked
story you edit like Publisher (Back to Draft returns to the Order of Worship); New Week chooser.
