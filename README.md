# Bulletin Builder

A small, purpose-built layout tool for Highland UMC's weekly worship bulletin, replacing Microsoft
Publisher. Electron app; one HTML/CSS renderer draws the screen, the PDF, and (later) the website.

**Status:** Phase 1 — opens a week read-only, as two-page spreads, and exports a reader-order PDF.

```
npm install
npm start                                   # open the viewer (File ▸ Open Week…)
npm start -- "path\to\week.bulletin"         # open a week directly
npx electron . --export-pdf <week.bulletin> <out.pdf>
npm run dist                                # Windows installer -> dist/
```

- File format: [FORMAT.md](FORMAT.md). A week is a folder; double-clicking its `.bulletin` opens it.
- Church data (weeks, pictures) never goes in this repo.
- Fonts used by the current bulletin must be installed on each PC: Palatino Linotype, Candara,
  Calibri (ship with Windows), **Archer** (Book + Bold) and **Avenir Next LT Pro**.
