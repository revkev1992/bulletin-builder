# Bulletin Builder

A small, purpose-built layout tool for Highland UMC's weekly worship bulletin, replacing Microsoft
Publisher. Electron app; one HTML/CSS renderer draws the screen, the PDF, and (later) the website.

**Status:** Phase 3 — the worship half is built as an Order of Worship (blocks) that the app lays out on the 6" grid; global styles; cover block. Phase 2 tools (move, resize, snap, lock, type, crop, insert, pasteboard, undo) still edit the announcements half and anything placed by hand. Publisher parity (the ribbon's File / Home / Insert / Page Design / View) is tracked in [docs/FEATURE_PARITY.md](docs/FEATURE_PARITY.md). See [docs/PHASE3_DESIGN.md](docs/PHASE3_DESIGN.md) and [docs/PHASE2_DESIGN.md](docs/PHASE2_DESIGN.md).

```
npm install
npm start                                   # open the viewer (File ▸ Open Week…)
npm start -- "path\to\week.bulletin"         # open a week directly
npx electron . --export-pdf <week.bulletin> <out.pdf>
npx electron . --selftest-edit <week.bulletin>        # Phase 2 editor self-test (fixed-layout week)
npx electron . --selftest-flow <flow week.bulletin>   # Phase 3 Order of Worship self-test
node test/gui/run-all.js                    # every GUI suite (real mouse/keyboard; the parity tests)
node test/pages.test.js; node test/pack.test.js       # unit tests (no Electron)
npm run dist                                # Windows installer -> dist/
```

The tests look for the church's week folders next to this repo's data folder (`test/weeks.js`: the
OneDrive `bulletin-builder/weeks` folder on either of Kevin's PCs, or `BB_WEEKS=<folder>`), and for
Python 3.12 with PyMuPDF (`BB_PYTHON`) for the print suite.

- File format: [FORMAT.md](FORMAT.md). A week is a folder; double-clicking its `.bulletin` opens it.
- Church data (weeks, pictures) never goes in this repo.
- Fonts used by the current bulletin must be installed on each PC: Palatino Linotype, Candara,
  Calibri (ship with Windows), **Archer** (Book + Bold) and **Avenir Next LT Pro**.

## Releasing an update

Installed copies check GitHub Releases on launch and update themselves.

1. Bump `version` in `package.json`, commit, push.
2. `npx electron-builder --win nsis --publish never`
3. `gh release create v<version> dist/Bulletin-Builder-Setup-<version>.exe dist/Bulletin-Builder-Setup-<version>.exe.blockmap dist/latest.yml`

All three files are required; `latest.yml` is the update feed.
