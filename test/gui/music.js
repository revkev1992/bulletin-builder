// GUI suite: the Service Music library (Kevin 2026-10-29) — kept once in a "Service Music" folder beside
// the weeks, each kind indexed its own way: psalters by psalm + response, doxologies by hymn tune,
// communion settings by setting + part (in order), Taizé chants / benediction responses / other by title.
// (Add music… opens a native file dialog the harness can't reach: those adds go through the same IPC
// call; everything else is real clicks.)
exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  const lib = () => h.js(`window.bb.music.list(window.__bbMusic.app.file()).then((l) => l.items)`);
  const shown = () => h.js(`[...document.querySelectorAll('#musicpane .mu-item .mu-label')].map((d) => d.textContent)`);
  const status = () => h.js("document.getElementById('status').textContent");
  const tab = async (cat) => { await h.clickSel(`#musicpane .mu-cats button[data-cat="${cat}"]`); await h.wait(150); };
  const fill = async (name, text) => {
    const r = await h.rect(`dialog.pub-dialog[open] [name="${name}"]`);
    await h.click(r.cx, r.cy);
    await h.key('A', ['control']);
    await h.type(text);
  };
  const kind = (v) => h.js(`(() => { const s = document.querySelector('dialog.pub-dialog[open] [name="category"]'); s.value = '${v}'; s.dispatchEvent(new Event('change')); })()`);
  const dialogOpen = () => h.until(`!!document.querySelector('dialog.pub-dialog[open]')`, 3000);
  const okDialog = async () => { await h.clickSel('dialog.pub-dialog[open] .pd-ok'); await h.wait(500); };

  // 1. the pane, from the Insert tab, in View only
  await h.clickSel('.rb-tab[data-tab="insert"]');
  await h.clickSel('#ins-music');
  await h.wait(500);
  h.ok('Insert ▸ Service Music: Psalters / Doxologies / Communion / Taizé / Benediction / Other, Psalters first, empty to begin with',
    await h.js(`!document.getElementById('musicpane').hidden && [...document.querySelectorAll('#musicpane .mu-cats button')].map((b) => b.textContent).join('|') === 'Psalters|Doxologies|Communion|Taizé|Benediction|Other' &&
      document.querySelector('#musicpane .mu-cats button.active').dataset.cat === 'psalter' && !!document.querySelector('#musicpane .mu-empty')`));

  // 2. right-click a picture on a page ▸ Add to Service Music…: a psalter is psalm + response
  await h.js(`window.__bbSetMode('announcements')`);
  await h.until('window.__bbEditor.half === "announcements"');
  await h.wait(600);
  // the widest, shortest picture on the announcements pages: the nearest thing there to a line of music
  const pic = await h.js(`(() => { const w = window.__bbWeek(); let best = null;
    for (const p of w.manifest.pages.filter((p) => p.half === 'announcements')) for (const f of (w.halves.announcements.pages[p.number] || { frames: [] }).frames)
      if (f.kind === 'image' && f.image && f.image.asset && f.w > 40 && (!best || f.h / f.w < best.r)) best = { n: p.number, id: f.id, r: f.h / f.w };
    return best; })()`);
  const addFromPage = async () => {
    await h.reveal(`.page-shell[data-page="${pic.n}"] .frame[data-id="${pic.id}"]`);
    const pr = await h.rect(`.page-shell[data-page="${pic.n}"] .frame[data-id="${pic.id}"]`);
    await h.rightClick(pr.cx, pr.cy);
    await h.wait(300);
    await h.clickSel('.ctx-menu button[data-cmd="to-music"]');
    await dialogOpen();
  };
  await addFromPage();
  h.ok('the dialog shows a psalter\'s fields only (psalm, response, note)', await h.js(`[...document.querySelectorAll('dialog.pub-dialog[open] .mu-f:not([hidden]) input')].map((i) => i.name).join() === 'psalter.psalm,psalter.response,psalter.note'`));
  await fill('psalter.psalm', '23');
  await fill('psalter.response', '1');
  await okDialog();
  let L = await lib();
  h.ok('right-click a picture ▸ Add to Service Music…: Psalm 23, Response 1', L.length === 1 && L[0].category === 'psalter' && L[0].psalm === 23 && L[0].response === 1, { L });
  h.ok('…shown as "Psalm 23 · Response 1", selected', JSON.stringify(await shown()) === '["Psalm 23 · Response 1"]' && (await h.js(`!!document.querySelector('#musicpane .mu-item.selected')`)));
  h.ok('…kept in a "Service Music" folder beside the week folders', await h.js(`window.__bbMusic.dir.replace(/\\\\/g, '/').endsWith('/Service Music')`));
  // a second response to the same psalm; the psalm is required
  await addFromPage();
  await fill('psalter.response', '2');
  await okDialog();
  h.ok('…a psalter without its psalm is asked again', await h.js(`!!document.querySelector('dialog.pub-dialog[open] .warn')`));
  await fill('psalter.psalm', '23');
  await okDialog();
  h.ok('Psalm 23 has two responses, in order', JSON.stringify(await shown()) === '["Psalm 23 · Response 1","Psalm 23 · Response 2"]', { s: await shown() });

  // the rest (Add music…'s file dialog is native: same IPC call, a week picture as the source)
  const asset = await h.js(`window.__bbWeek().halves.announcements.pages[${pic.n}].frames.find((f) => f.id === '${pic.id}').image.asset`);
  await h.js(`(async () => { const f = window.__bbMusic.app.file(), src = ${JSON.stringify(asset)};
    for (const it of [{ category: 'doxology', tune: 'OLD HUNDREDTH', title: 'Praise God, from whom all blessings flow' }, { category: 'doxology', tune: 'LASST UNS ERFREUEN', note: 'Easter' },
      { category: 'communion', setting: 'UMC Musical Setting A', part: 'Great Amen', order: '3' }, { category: 'communion', setting: 'UMC Musical Setting A', part: 'Holy, holy, holy', order: '1' },
      { category: 'communion', setting: 'UMC Musical Setting A', part: 'Memorial acclamation', order: '2' }, { category: 'taize', title: 'Eat This Bread' }, { category: 'benediction', title: 'Go Now in Peace' }])
      await window.bb.music.add(f, { ...it, src });
    await window.__bbMusic.load(); })()`);
  await tab('doxology');
  h.ok('Doxologies: by hymn tune, in order', JSON.stringify(await shown()) === '["LASST UNS ERFREUEN","OLD HUNDREDTH"]', { s: await shown() });
  const fr = await h.rect('#musicpane .mu-find');
  await h.click(fr.cx, fr.cy);
  await h.type('old hun');
  await h.wait(200);
  h.ok('…Find by tune', JSON.stringify(await shown()) === '["OLD HUNDREDTH"]');
  await tab('communion');
  const comm = await h.js(`[...document.querySelectorAll('#musicpane .mu-list > div')].map((d) => d.classList.contains('mu-group') ? '# ' + d.textContent : d.querySelector('.mu-label').textContent)`);
  h.ok('Communion: the setting\'s parts grouped under it, in their order', JSON.stringify(comm) === JSON.stringify(['# UMC Musical Setting A', 'Holy, holy, holy', 'Memorial acclamation', 'Great Amen']), { comm });
  await h.shot('communion');

  // Edit…: a Taizé chant becomes a benediction response (indexed its new way only)
  await tab('taize');
  await h.clickSel('#musicpane .mu-item');
  await h.clickSel('#musicpane .mu-edit');
  await dialogOpen();
  await kind('benediction');
  await fill('benediction.title', 'Shalom to You');
  await okDialog();
  L = await lib();
  const moved = L.find((i) => i.title === 'Shalom to You');
  h.ok('Edit…: change its kind and title; the pane follows it', !!moved && moved.category === 'benediction' &&
    (await h.js(`document.querySelector('#musicpane .mu-cats button.active').dataset.cat`)) === 'benediction' && JSON.stringify(await shown()) === '["Go Now in Peace","Shalom to You"]', { moved, s: await shown() });

  // 3. Insert on a page being edited (announcements): a picture the width of the text, a copy in the week
  const pg = await h.js("window.__bbWeek().manifest.pages.filter((p) => p.half === 'announcements').pop().number");
  await h.reveal(`.page-shell[data-page="${pg}"] .page`);
  const pr2 = await h.rect(`.page-shell[data-page="${pg}"] .page`);
  await h.click(pr2.x + 6, pr2.y + 6);
  const n0 = await ed(`ed.pageEntry(${pg}).frames.length`);
  await h.clickSel('#musicpane .mu-item');
  await h.clickSel('#musicpane .mu-insert');
  await h.wait(800);
  const added = await ed(`ed.pageEntry(${pg}).frames.slice(-1)[0]`);
  h.ok('Insert puts it on the page you are on, as wide as the text', (await ed(`ed.pageEntry(${pg}).frames.length`)) === n0 + 1 && added.kind === 'image' && /^assets\//.test(added.image.asset) && Math.abs(added.w - 432) < 1,
    { w: added && added.w, asset: added && added.image && added.image.asset });
  h.ok('…and says how to put it in the line instead', /Click in the text where it goes/.test(await status()));
  await h.clickSel('#undo'); await h.wait(500);
  h.ok('…Undo takes it off', (await ed(`ed.pageEntry(${pg}).frames.length`)) === n0);

  // in text: like Word, the music goes IN the line after the caret's paragraph, and moves with the text
  const tb = await h.js(`(() => { const w = window.__bbWeek(); for (const p of w.manifest.pages.filter((p) => p.half === 'announcements')) {
    const f = (w.halves.announcements.pages[p.number] || { frames: [] }).frames.find((f) => f.kind === 'text' && !f.locked && !(f.text.chain) && f.text.paragraphs.filter((q) => q.runs.some((r) => r.text.trim().length > 3)).length >= 3);
    if (f) return { n: p.number, id: f.id }; } return null; })()`);
  const paraSel = (k) => `.page-shell[data-page="${tb.n}"] .frame[data-id="${tb.id}"] p.para:nth-of-type(${k})`;
  await h.reveal(paraSel(1));
  const p1 = await h.rect(paraSel(1));
  await h.click(p1.x + Math.min(20, p1.w / 3), p1.cy);
  await h.wait(400);
  h.ok('(typing in a text box)', await ed('!!ed.textEdit'));
  const k0 = await ed(`ed.anyFrame(${tb.n}, '${tb.id}').text.paragraphs.length`);
  await h.clickSel('#musicpane .mu-item');
  await h.clickSel('#musicpane .mu-insert');
  await h.wait(900);
  const paras = await ed(`ed.anyFrame(${tb.n}, '${tb.id}').text.paragraphs.map((q) => q.picture ? 'PIC' : q.runs.map((r) => r.text).join('').slice(0, 20))`);
  h.ok('Insert while typing: an in-line picture right after the caret\'s paragraph, as wide as the box', paras.length === k0 + 1 && paras[1] === 'PIC' &&
    (await h.js(`!!document.querySelector('.page-shell[data-page="${tb.n}"] .frame[data-id="${tb.id}"] img.inline-pic')`)) && /moves with the lines/.test(await status()), { paras: paras.slice(0, 4), st: await status() });
  const picTop = () => h.js(`(() => { const fr = document.querySelector('.page-shell[data-page="${tb.n}"] .frame[data-id="${tb.id}"]');
    return fr.querySelector('p.pic-para').getBoundingClientRect().top - fr.getBoundingClientRect().top; })()`);
  const y0 = await picTop();
  const p1b = await h.rect(paraSel(1));
  await h.click(p1b.x + 2, p1b.y + 3);
  await h.wait(300);
  await h.key('Home');
  await h.key('Enter');
  await h.key('Enter');
  await h.wait(500);
  const typed = await ed('!!ed.textEdit');
  await h.key('Escape');
  await h.wait(500);
  const k2 = await ed(`ed.anyFrame(${tb.n}, '${tb.id}').text.paragraphs.length`);
  h.ok('…two new lines above it: the music moves down with the text', (await picTop()) > y0 + 8 && k2 === k0 + 3, { y0, now: await picTop(), k2, k0, typed });
  await h.shot('inline');
  await h.clickSel('#undo'); await h.wait(500);
  await h.clickSel('#undo'); await h.wait(500);
  h.ok('…Undo, Undo: the lines, then the music, come out', (await ed(`ed.anyFrame(${tb.n}, '${tb.id}').text.paragraphs.length`)) === k0,
    { now: await ed(`ed.anyFrame(${tb.n}, '${tb.id}').text.paragraphs.length`), k0 });

  // 4. the Order of Worship: the PSALTER block's "Service music…" opens on its psalm; Insert adds to the block
  await h.js(`window.__bbSetMode('worship')`);
  await h.until('window.__bbEditor.half === "worship"');
  await h.wait(800);
  const ps = await h.js(`(() => { const b = window.__bbWeek().halves.worship.flow.blocks.find((b) => b.heading && /PSALTER/i.test(b.heading.label) && ['hymn', 'image'].includes(b.kind));
    return b ? { id: b.id, words: [b.heading.label, b.heading.middle, b.heading.right].join(' ') } : null; })()`);
  if (ps) {
    await h.reveal(`#flowpanel .fp-row[data-id="${ps.id}"]`);
    await h.clickSel(`#flowpanel .fp-row[data-id="${ps.id}"]`);
    await h.wait(400);
    await h.js(`[...document.querySelectorAll('#flowpanel button')].find((b) => b.textContent === 'Service music…').setAttribute('data-test', 'svc')`);
    await h.clickSel('#flowpanel button[data-test="svc"]');
    await h.wait(500);
    const n23 = /psalm\s+23\b/i.test(ps.words);
    h.ok('a PSALTER block ▸ Service music… opens the Psalters' + (n23 ? ', on Psalm 23' : ''), (await h.js(`document.querySelector('#musicpane .mu-cats button.active').dataset.cat`)) === 'psalter' &&
      (!n23 || JSON.stringify(await shown()) === '["Psalm 23 · Response 1","Psalm 23 · Response 2"]'), { words: ps.words, s: await shown() });
    const imgs0 = await h.js(`(window.__bbWeek().halves.worship.flow.blocks.find((b) => b.id === '${ps.id}').images || []).length`);
    await h.clickSel('#musicpane .mu-item');
    await h.clickSel('#musicpane .mu-insert');
    await h.wait(1500);
    const imgs = await h.js(`window.__bbWeek().halves.worship.flow.blocks.find((b) => b.id === '${ps.id}').images || []`);
    h.ok('Insert: the response goes into the PSALTER block, laid out with it', imgs.length === imgs0 + 1 && /^assets\//.test(imgs[imgs.length - 1]), { imgs, imgs0 });
    const last = imgs[imgs.length - 1] || '';
    h.ok('…and it is on a worship page', await h.js(`[...document.querySelectorAll('.page img')].some((i) => decodeURI(i.src).endsWith(${JSON.stringify(last.split('/').pop())}))`));
    await h.shot('in-order');
    // a new season: Replace swaps the block's music for another (here Response 2), Undo swaps back
    await h.clickSel('#musicpane .mu-item:nth-child(2)');
    h.ok('Replace is offered for a block that has music', !(await h.js(`document.querySelector('#musicpane .mu-replace').hidden`)));
    await h.clickSel('#musicpane .mu-replace');
    await h.wait(1500);
    const rep = await h.js(`window.__bbWeek().halves.worship.flow.blocks.find((b) => b.id === '${ps.id}').images || []`);
    h.ok('…Replace: the block now holds just the new response', rep.length === 1 && /^assets\//.test(rep[0]), { rep });
    await h.clickSel('#undo'); await h.wait(1200);
    h.ok('…Undo puts the old music back', JSON.stringify(await h.js(`window.__bbWeek().halves.worship.flow.blocks.find((b) => b.id === '${ps.id}').images || []`)) === JSON.stringify(imgs));
    // planning in the panel itself: the block's "From the library" drop-down, psalters (Psalm 23) first
    await h.wait(600);
    const opts = await h.js(`(() => { const s = document.querySelector('#flowpanel [data-test="music-pick"]'); return s ? [...s.querySelectorAll('optgroup')].map((g) => g.label + ': ' + [...g.children].map((o) => o.textContent).join(' | ')) : null; })()`);
    h.ok('the block\'s "From the library" list: Psalters first, Psalm 23\'s responses, then the other kinds', !!opts && /^Psalters: Psalm 23 · Response 1 \| Psalm 23 · Response 2/.test(opts[0]) && opts.length >= 3, { opts });
    await h.js(`(() => { const s = document.querySelector('#flowpanel [data-test="music-pick"]'); s.value = [...s.querySelectorAll('optgroup')[0].children][1].value; s.dispatchEvent(new Event('change')); })()`);
    await h.wait(1500);
    const picked = await h.js(`window.__bbWeek().halves.worship.flow.blocks.find((b) => b.id === '${ps.id}').images || []`);
    h.ok('…choosing one there sets the block\'s music', picked.length === 1 && /^assets\//.test(picked[0]), { picked });
  } else h.ok('a PSALTER music block in this week', false);

  // 5. Remove (the week keeps its copy)
  const before = (await lib()).length;
  await tab('benediction');
  await h.clickSel('#musicpane .mu-item');
  await h.clickSel('#musicpane .mu-remove');
  await dialogOpen();
  await okDialog();
  h.ok('Remove asks first, then takes it out of the library', (await lib()).length === before - 1 && (await shown()).length === 1, { s: await shown() });

  // 6. View only: Insert points at the badge
  await h.js(`window.__bbSetMode('')`);
  await h.until('!window.__bbEditor.half');
  await tab('psalter');
  await h.clickSel('#musicpane .mu-item');
  await h.clickSel('#musicpane .mu-insert');
  await h.wait(300);
  h.ok('View only: Insert says to choose which pages first (the badge flashes)', /View only/.test(await status()) &&
    (await h.js("document.getElementById('badge').classList.contains('flash')")));
  h.ok('the library stays browsable in View only', !(await h.disabled('#ins-music')));
};
