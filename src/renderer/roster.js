// Volunteers & attendance (Kevin 2026-10-29: "tell you the numbers and names, have you do the
// formatting"): the block after the postlude — worship volunteers down the left, last Sunday's
// attendance down the right. Kevin fills in a form; the lines are laid out the way his Word bulletins
// had them (a long list of names breaks after "&" and goes on indented; totals are added up).
//   block = { kind: 'roster', volunteers: [{ role, names }],
//             attendance: { date, services: [{ label, inPerson, streaming }] } }

export const ROSTER_TABS = [{ pos: 36, align: 'left' }, { pos: 198, align: 'left' }];
const LEFT_CHARS = 30;      // about what fits before the attendance column at 11 pt Palatino

const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));
export const serviceTotal = (s) => (num(s.inPerson) ?? 0) + (num(s.streaming) ?? 0);
export const grandTotal = (b) => ((b.attendance || {}).services || []).reduce((t, s) => t + serviceTotal(s), 0);

// "STREAMING: Alex Cope & Sean Richards" -> ["STREAMING: Alex Cope &", "\tSean Richards"]
function volunteerLines(v) {
  const role = String(v.role || '').trim();
  const names = String(v.names || '').trim();
  const whole = role ? role + ': ' + names : names;
  if (whole.length <= LEFT_CHARS) return whole ? [whole] : [];
  // break after an "&" or a comma, filling each line as far as it goes
  const pieces = names.split(/(?<=&|,)\s+/);
  const out = [];
  let cur = role ? role + ':' : '';
  for (const p of pieces) {
    const next = cur ? cur + ' ' + p : p;
    if (cur && next.length > LEFT_CHARS) { out.push(cur); cur = p; } else cur = next;
  }
  if (cur) out.push(cur);
  return out.map((l, i) => (i ? '\t' + l : l));
}

export function attendanceLines(b) {
  const a = b.attendance || {};
  const services = (a.services || []).filter((s) => num(s.inPerson) != null || num(s.streaming) != null);
  if (!a.date && !services.length) return [];
  const out = [];
  if (a.date) out.push('Attendance for ' + a.date);
  for (const s of services) {
    const parts = [];
    if (num(s.inPerson) != null) parts.push('in-person ' + num(s.inPerson));
    if (num(s.streaming) != null) parts.push('streaming ' + num(s.streaming));
    parts.push('total ' + serviceTotal(s));
    out.push((s.label ? s.label + ': ' : '') + parts.join(', '));
  }
  if (services.length > 1) out.push('Total: ' + grandTotal(b));
  return out;
}

// one line per row: the volunteer (or its continuation) on the left, attendance at the 198 pt stop
export function rosterRows(b) {
  const left = (b.volunteers || []).flatMap(volunteerLines);
  const right = attendanceLines(b);
  const rows = [];
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const l = left[i] || '', r = right[i] || '';
    if (!r) { rows.push(l); continue; }
    // reach the attendance stop: from nothing, past the 36 pt stop first
    rows.push((l ? l : '\t') + '\t' + r);
  }
  return rows;
}

// the same section imported from a Word bulletin (a text block) -> the form's data, or null
export function parseRoster(paragraphs) {
  const volunteers = [];
  const attendance = { date: '', services: [] };
  let seen = false;
  for (const p of paragraphs || []) {
    const text = (p.runs || []).map((r) => r.text).join('');
    for (const raw of text.split('\t')) {
      const part = raw.trim();
      if (!part) continue;
      let m;
      if ((m = /^attendance for\s+(.+)$/i.exec(part))) { attendance.date = m[1].trim(); seen = true; }
      else if ((m = /^(.+?):\s*in-person\s*(\d+)(?:\s*,\s*streaming\s*(\d+))?/i.exec(part))) {
        attendance.services.push({ label: m[1].trim(), inPerson: Number(m[2]), ...(m[3] != null ? { streaming: Number(m[3]) } : {}) });
        seen = true;
      } else if (/^total:/i.test(part)) { seen = true; }
      else if ((m = /^([A-Z][A-Z .&/'-]*?):\s*(.*)$/.exec(part))) volunteers.push({ role: m[1].trim(), names: m[2].trim() });
      else if (volunteers.length) { const v = volunteers[volunteers.length - 1]; v.names = (v.names + ' ' + part).trim(); }
    }
  }
  return seen ? { volunteers, attendance } : null;
}

// "October 18, 2026" -> "October 11, 2026" (attendance is for the Sunday before)
export function sundayBefore(date) {
  const d = new Date(date);
  if (isNaN(d)) return '';
  d.setDate(d.getDate() - 7);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function newRoster(b, coverDate) {
  b.volunteers = [{ role: 'LECTOR', names: '' }, { role: 'AUDIO', names: '' }, { role: 'STREAMING', names: '' }];
  b.attendance = { date: sundayBefore(coverDate || ''), services: [{ label: '9 AM' }, { label: '11 AM' }] };
  return b;
}
