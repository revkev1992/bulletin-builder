# Phase 2 — fixed-layout editing: design

*2026-10-15. Phase 2 makes frames editable. Built in three passes; this file says what each pass
covers and the decisions that hold across them.*

| Pass | Scope | Status |
|---|---|---|
| **2a** | edit sessions (claim a half, lock file, save, history, close prompt) · select · move · resize · snap · nudge · numeric X/Y/W/H · frame + page lock · delete · undo/redo | this pass |
| 2b | text editing inside frames · live linked-frame reflow · overflow badge while typing | next |
| 2c | image crop / fit / fill · insert text, picture, shape · pasteboard drag on/off pages · frames across the gutter | after |

## Decisions

1. **You edit one half at a time.** After opening a week, *Edit ▸ Worship pages* or *Edit ▸
   Announcements pages* claims that half. Everything else stays view-only, so Kevin can never move
   the communications frames and vice versa (the "section locking by role" item, pulled forward).
2. **Lock file per half:** `locks/<half>.lock` = `{ user, machine, pid, since }`, refreshed every
   60 s while open. Someone else's lock blocks the claim ("Stephanie is editing announcements on
   HUMC-OFFICE since 9:05"); a lock not refreshed for **5 minutes** is stale and can be taken over
   (crashed app, unplugged laptop).
3. **Saving** (Ctrl+S, and automatically every 2 minutes when there are changes): the current file
   is first copied to `history/<half>-<YYYY-MM-DD_HHMMSS>.json` (append-only; never deleted by the
   app), then the new file is written to a temp name and renamed over the old one, so a crash or a
   dropped network drive never leaves a half-written file. Closing with unsaved changes asks.
4. **Undo** keeps whole-half snapshots (a half is ~100–200 KB), last 100 steps. Simple and can't
   get out of step with the model.
5. **Groups move and resize as one.** Clicking any member selects the group (Publisher's default).
   Resizing a group scales its members' boxes; font sizes don't change.
6. **Pictures never distort:** resizing a picture keeps its proportions from every handle. (Cropping
   is 2c.)
7. **Snapping** (hold Alt to switch off), within 6 screen pixels: page edges and centre, margin guides
   (mirrored inside/outside), ruler guides, and the edges/centres of other frames on the page.
8. **Locks:** a locked frame can be selected (to see it or unlock it) but not moved, resized,
   nudged or deleted. A locked page makes all its frames locked. Both saved in the half file
   (`frame.locked`, `pages[n].locked`).
9. **Nudge:** arrow keys move 1 pt; Shift+arrow 9 pt (1/8"). Numeric fields are in inches, like
   Publisher's Size & Position.
10. The renderer stays the single source of drawing: an edit mutates the model, then the affected
    page is re-rendered with the same `renderPage()` the PDF uses.

## Testing

`electron . --selftest-edit <week.bulletin>` copies the week to a temp folder, drives the real editor
through synthetic pointer drags and keyboard commands, saves, and checks the files on disk (moved
coordinates, lock file, history entry, undo). Exit code 0 = pass.
