// GUI suite: Volunteers & attendance (Kevin 2026-10-29: "tell you the numbers and names, have you do the
// formatting") on the 10-18 Order of Worship: turn the Word lines into the form, type names and numbers,
// totals add up, a long pair of names breaks after "&", services added / removed, a new block.
exports.run = async (h) => {
  const blocks = () => h.js('window.__bbWeek().halves.worship.flow.blocks');
  const lines = (id) => h.js(`[...document.querySelectorAll('.page p.para[data-block="${id}"]')].map((p) => p.textContent.replace(/\\s+/g, ' ').trim())`);
  const typeIn = async (test, text) => {
    await h.reveal(`#flowpanel [data-test="${test}"]`);
    const r = await h.rect(`#flowpanel [data-test="${test}"]`);
    await h.click(r.cx, r.cy);
    await h.key('A', ['control']);
    await h.type(text);
    await h.key('Tab');
    await h.wait(900);
  };

  await h.js(`window.__bbSetMode('worship')`);
  await h.until('window.__bbEditor.half === "worship"');
  await h.wait(800);
  const id = (await blocks()).find((b) => b.kind === 'text' && JSON.stringify(b.paragraphs || []).includes('Attendance for')).id;
  await h.reveal(`#flowpanel .fp-row[data-id="${id}"]`);
  await h.clickSel(`#flowpanel .fp-row[data-id="${id}"]`);
  await h.wait(400);
  const before = await lines(id);
  h.ok('the Word bulletin\'s volunteers & attendance lines offer the form', await h.js(`!!document.querySelector('#flowpanel [data-test="to-roster"]')`));
  await h.clickSel('#flowpanel [data-test="to-roster"]');
  await h.wait(1200);
  const b = (await blocks()).find((x) => x.id === id);
  h.ok('…Turn into a form: the names and numbers are read out of the lines', b.kind === 'roster' && b.volunteers.length === 3 && b.volunteers[2].names === 'Alex Cope & Sean Richards' &&
    b.attendance.date === 'October 11, 2026' && b.attendance.services.length === 2 && b.attendance.services[0].inPerson === 84 && b.attendance.services[1].streaming === 46, { b });
  const after = await lines(id);
  h.ok('…and the page reads exactly as before', JSON.stringify(after) === JSON.stringify(before), { before, after });
  // the attendance column lines up
  const xs = await h.js(`[...document.querySelectorAll('.page p.para[data-block="${id}"]')].map((p) => { const s = p.querySelectorAll(':scope > .seg'); return s.length ? Math.round(s[s.length - 1].getBoundingClientRect().left) : null; })`);
  h.ok('the attendance column lines up', xs.every((x) => x != null) && Math.max(...xs) - Math.min(...xs) <= 1, { xs });
  await h.shot('converted');

  // new numbers: the totals add themselves up
  await typeIn('inp-0', '90');
  let L = await lines(id);
  h.ok('type 90 for 9 AM in person: its total and the grand total follow', L.some((l) => l.includes('9 AM: in-person 90, streaming 19, total 109')) && L.some((l) => l.endsWith('Total: 250')), { L });
  h.ok('…the form shows them too', (await h.js(`document.querySelector('#flowpanel [data-test="grand"]').textContent`)) === 'Total: 250');

  // a new volunteer with two long names: breaks after "&", goes on indented
  await h.clickSel('#flowpanel [data-test="add-vol"]');
  await h.wait(900);
  await typeIn('role-3', 'acolytes');
  await typeIn('names-3', 'Benjamin Abernathy & Samuel Richardson');
  L = await lines(id);
  h.ok('a new volunteer: the role in capitals, two long names broken after "&"', L.some((l) => /^ACOLYTES: Benjamin Abernathy &/.test(l)) && L.some((l) => /^Samuel Richardson/.test(l)), { L });

  // a Sunday with one service: remove 11 AM — no grand total line
  await h.js(`[...document.querySelectorAll('#flowpanel .fp-rrow')].find((r) => r.querySelector('[data-test="svc-1"]')).querySelector('button').setAttribute('data-test', 'del-svc-1')`);
  await h.clickSel('#flowpanel [data-test="del-svc-1"]');
  await h.wait(900);
  L = await lines(id);
  h.ok('one service that Sunday: one attendance line, no grand total', !L.some((l) => l.includes('11 AM')) && !L.some((l) => /Total: \d+$/.test(l)) && L.some((l) => l.includes('9 AM: in-person 90')), { L });
  await h.clickSel('#undo'); await h.wait(1200);
  h.ok('…Undo brings 11 AM back', (await lines(id)).some((l) => l.includes('11 AM')));

  // a new block from Add…: two services ready, Last Sunday fills the date from the cover
  await h.js(`(() => { const s = document.querySelector('#flowpanel .fp-bar select'); s.value = 'roster'; s.dispatchEvent(new Event('change')); })()`);
  await h.wait(1200);
  const nb = await h.js(`window.__bbWeek().halves.worship.flow.blocks.find((b) => b.id === window.__bbEditor.panel.selId)`);
  h.ok('Add ▸ Volunteers & attendance: LECTOR / AUDIO / STREAMING and 9 AM / 11 AM ready to fill', nb.kind === 'roster' && nb.volunteers.map((v) => v.role).join() === 'LECTOR,AUDIO,STREAMING' &&
    nb.attendance.services.map((s) => s.label).join() === '9 AM,11 AM', { nb });
  await h.clickSel('#flowpanel [data-test="last-sunday"]');
  await h.wait(900);
  const nb2 = await h.js(`window.__bbWeek().halves.worship.flow.blocks.find((b) => b.id === window.__bbEditor.panel.selId)`);
  h.ok('…Last Sunday: the Sunday before the cover date (October 11, 2026)', nb2.attendance.date === 'October 11, 2026', { date: nb2.attendance.date });
  await h.shot('new-block');

  // New Week: attendance moves on a week and last week's numbers are cleared; the volunteers stay
  await h.clickSel('#save');
  await h.wait(1200);
  const nf = await h.js(`window.bb.createWeek(${JSON.stringify(h.weekCopy)}, '10-25-26 1100', 'as-is')`);
  const nw = await h.js(`window.bb.loadWeek(${JSON.stringify(nf)}).then((w) => w.halves.worship.flow.blocks.find((b) => b.id === '${id}'))`);
  h.ok('New Week: attendance is for October 18 now, its numbers cleared, the volunteers kept', !!nw && nw.attendance.date === 'October 18, 2026' &&
    nw.attendance.services.every((s) => s.inPerson == null && s.streaming == null) && nw.volunteers.length === 4, { nw });
};
