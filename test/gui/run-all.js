// Run every GUI suite (real mouse/keyboard input, screenshots in out/gui-<suite>/).
//   node test/gui/run-all.js ["<week.bulletin>"]
// Default week = the 9-20-26 Publisher week next to this repo's data folder.
const { spawnSync } = require('child_process');
const path = require('path');

const WEEK = process.argv[2] ||
  path.join(process.env.USERPROFILE || '', 'OneDrive/Documents/Liturgical Resources/Claude/bulletin-builder/weeks/9-20-26 1100/9-20-26 1100.bulletin');
const ELECTRON = path.join(__dirname, '../../node_modules/electron/dist/electron.exe');
const SUITES = ['text', 'format', 'crop', 'pages', 'tabs', 'breaks', 'arrange', 'find', 'painter', 'saveas', 'linking', 'styles', 'context', 'misc', 'zoom', 'print', 'newweek'];

// the Order-of-Worship guard runs on an October (flow) week
const weekNamed = (t) => path.join(path.dirname(path.dirname(WEEK)), t, t + '.bulletin');
// Order-of-Worship suites run on October weeks (10-11 is untouched by hand tests)
const FLOW_SUITES = { flow: weekNamed('10-18-26 1100'), finish: weekNamed('10-11-26 1100'), combos: weekNamed('10-11-26 1100') };

let failed = 0;
for (const s of [...SUITES, ...Object.keys(FLOW_SUITES)]) {
  const week = FLOW_SUITES[s] || WEEK;
  const r = spawnSync(ELECTRON, ['.', '--gui', 'test/gui/' + s + '.js', week, 'out/gui-' + s], { cwd: path.join(__dirname, '../..'), encoding: 'utf8' });
  const last = (r.stdout || '').trim().split('\n').filter((l) => /^(PASS|FAILED|ERROR)/.test(l)).pop() || 'no result';
  const fails = (r.stdout || '').split('\n').filter((l) => l.includes('FAIL '));
  console.log(s.padEnd(8), last);
  fails.forEach((l) => console.log('        ', l.trim()));
  if (r.status !== 0) failed++;
}
console.log(failed ? failed + ' suite(s) failed' : 'all GUI suites pass');
process.exit(failed ? 1 : 0);
