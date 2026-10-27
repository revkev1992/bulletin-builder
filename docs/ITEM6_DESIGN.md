# Item 6 — hand-editable worship pages (DESIGN, awaiting Kevin's OK)

*2026-10-20. From test batch 1: "the worship pages must be hand-editable, just like Publisher."
Nothing below is built. Kevin asked to see the design first.*

## The problem today

The worship pages are **generated**: the Order of Worship panel owns them. Every line on a worship
page is locked; clicking it only selects its block in the panel. You cannot click into the text,
fix a tab, add a line break, or nudge where a page breaks.

## Proposal (recommended): "Finish Layout" — turn the draft into ordinary Publisher pages

Two stages per week, one button between them.

| Stage | How you work | What the panel does |
|---|---|---|
| **1. Draft** (as now) | Build the order in the panel: add / move / delete blocks, Styles tab, Cover tab | Lays the pages out for you |
| **2. Finished** (new) | Exactly Publisher: click in the text, type, Tab, Enter, Shift+Enter, ruler tabs (item 7), Ctrl+Enter page break (item 8), drag pictures, resize boxes | Read-only outline; it no longer moves anything |

**Bulletin ▸ Finish Layout** converts the draft once:

1. Every generated text frame on worship pages 2–10 becomes an ordinary text box, and **all of
   them are linked into ONE story**, in reading order. That is how Publisher works: type a line
   on page 3 and the text after it flows on to page 4, 5…
2. Hymn pictures, QR codes, margin notes and the cover become ordinary, unlocked objects that
   stay where they were placed.
3. Tab stops, bold People lines, spacing and keep-with-next all carry over as ordinary paragraph
   formatting (nothing is lost; the PDF looks identical the moment after finishing).
4. One undo step. The draft is kept inside the week file, so **Bulletin ▸ Back to Draft** can
   restore it — with a warning that hand changes made since finishing are thrown away.

**New Week from This One** copies a finished week as finished (you edit last week's pages),
or offer a choice: start from last week's finished pages / from its draft. *(Kevin to choose.)*

### What you'd see

- Bulletin tab: a **Finish Layout** button while drafting; **Back to Draft** once finished.
- Status bar: "Worship pages: draft (laid out by the panel)" or "Worship pages: finished (edit
  on the page)".
- The Order of Worship panel collapses to a narrow outline after finishing (click an item →
  jumps to it on the page).

### The one Publisher behaviour to know about

Pictures don't move with the text. If you add three lines above the hymn on page 3, the text below
the hymn flows on, but the hymn picture stays put — the same as Publisher. You then drag the
picture, or use Ctrl+Enter (item 8) to push text to the next page.

## Alternative considered (not recommended): keep the panel in charge, allow per-line overrides

Hand edits stored as "overrides" on blocks, re-applied each re-layout. It fights Publisher's model
(edits can vanish when the layout re-runs) and is much more code. Kevin asked for "just like
Publisher", which this is not.

## Questions for Kevin (one line each)

1. **Finish Layout once per week, then edit like Publisher** — is that the workflow you want? (Y/N)
2. New Week from This One on a finished week: copy the **finished pages** (recommended), or the draft?
3. Should Finish Layout happen **automatically** the first time you click into worship-page text
   (with a one-time "This turns the draft into ordinary pages" confirmation)? Recommended: yes.

## Build estimate once approved

About 1 session: conversion + link-story (~half), Back to Draft + panel outline mode (~quarter),
GUI tests (~quarter). Items 7 (ruler/tabs) and 8 (breaks) are being built now and apply to the
finished pages automatically.

## Kevin's answers (2026-10-27) — APPROVED, build it
1. **Finish Layout: YES** — draft in the panel, finish once per week, then edit like Publisher.
2. **New Week from This One: ask each time.** Show the **three most recent weeks** to start from, plus a way to choose an **older** one; for a finished source week, ask whether to start from its finished pages or its draft.
3. **Trigger: button only** (Bulletin ▸ Finish Layout). No automatic conversion on click.
