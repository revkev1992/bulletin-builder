// Where the test weeks live (church data, never in this repo). Set BB_WEEKS=<folder of week folders>,
// else the bulletin-builder data folder is looked for in the usual places on Kevin's PCs.
const fs = require('fs');
const path = require('path');

const CANDIDATES = [
  process.env.BB_WEEKS,
  path.join(process.env.USERPROFILE || '', 'OneDrive/Documents/Liturgical Resources/Claude/bulletin-builder/weeks'),
  'E:/OneDrive/Documents/Liturgical Resources/Claude/bulletin-builder/weeks',
  'C:/Users/kevqu/OneDrive/Documents/Liturgical Resources/Claude/bulletin-builder/weeks',
].filter(Boolean);

function weeksDir() {
  const d = CANDIDATES.find((p) => fs.existsSync(p));
  if (!d) throw new Error('No weeks folder found. Set BB_WEEKS to the folder that holds the week folders (9-20-26 1100, …).');
  return d;
}
const weekDir = (title) => path.join(weeksDir(), title);
const weekFile = (title) => path.join(weeksDir(), title, title + '.bulletin');

// Python 3.12 with PyMuPDF (the print suite measures PDFs with it): BB_PYTHON, or the usual install
function python() {
  const c = [process.env.BB_PYTHON, path.join(process.env.LOCALAPPDATA || '', 'Programs/Python/Python312/python.exe'),
    'C:/Users/kevqu/AppData/Local/Programs/Python/Python312/python.exe', 'C:/Users/kevin.HUMC/AppData/Local/Programs/Python/Python312/python.exe'].filter(Boolean);
  return c.find((p) => fs.existsSync(p)) || 'python';
}

module.exports = { weeksDir, weekDir, weekFile, python };
