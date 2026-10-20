// GUI suite: Home ▸ Editing ▸ Find / Replace (task pane), Ctrl+F / Ctrl+H. Real typing in the pane.
exports.run = async (h) => {
  const ed = (expr) => h.js(`(() => { const ed = window.__bbEditor; return ${expr}; })()`);
  const msg = () => h.js(`document.getElementById('fr-msg').textContent`);
  const setWhat = async (t) => { const r = await h.rect('#fr-what'); await h.click(r.cx, r.cy); await h.key('A', ['control']); await h.type(t); };
  const setWith = async (t) => { const r = await h.rect('#fr-with'); await h.click(r.cx, r.cy); await h.key('A', ['control']); await h.type(t); };
  const count = (needle) => h.js(`(() => { const ed = window.__bbEditor; let c = 0; for (const n of ed.app.pageNumbers()) { if (ed.halfOf(n) !== 'announcements') continue;
    const walk = (f) => { if (f.text) for (const p of f.text.paragraphs) c += (p.runs.map((r) => r.text).join('').split(${JSON.stringify(needle)}).length - 1); (f.children || []).forEach(walk); };
    ed.pageEntry(n).frames.forEach(walk); } return c; })()`);

  // Ctrl+F (view only)
  await h.key('F', ['control']);
  h.ok('Ctrl+F opens the Find pane', await h.js(`!document.getElementById('findpane').hidden`));
  h.ok('…with the cursor in "Find what"', await h.js(`document.activeElement.id === 'fr-what'`));
  await h.type('Highland');
  await h.key('Enter', [], 600);
  h.ok('Enter finds the first match and says how many', /\d+ match/.test(await msg()), { msg: await msg() });
  await h.shot('find-view-only');

  // claim announcements; Home ▸ Replace
  await h.clickSel('.rb-tab[data-tab="bulletin"]');
  await h.js(`(() => { const s = document.getElementById('mode'); s.value = 'announcements'; s.dispatchEvent(new Event('change')); })()`);
  await h.until('window.__bbEditor.half === "announcements"');
  await h.clickSel('.rb-tab[data-tab="home"]');
  await h.clickSel('#rb-replace');
  h.ok('Home ▸ Replace opens the pane in Replace mode', await h.js(`document.getElementById('findpane').classList.contains('replacing')`));
  const before = await count('Bradley Hall');
  h.ok('test text: "Bradley Hall" appears several times in the announcements', before >= 3, { before });
  await setWhat('Bradley Hall');
  await setWith('Fellowship Hall');
  await h.clickSel('#fr-next');
  await h.wait(500);
  h.ok('Find Next selects the words in the text, ready to type', (await ed('!!ed.textEdit')) && (await h.js('getSelection().toString()')) === 'Bradley Hall', { sel: await h.js('getSelection().toString()') });
  await h.shot('found-in-text');
  await h.clickSel('#fr-replace');
  await h.wait(600);
  h.ok('Replace changes that one and moves to the next', (await count('Bradley Hall')) === before - 1 && (await h.js('getSelection().toString()')) === 'Bradley Hall',
    { now: await count('Bradley Hall'), sel: await h.js('getSelection().toString()') });
  await h.clickSel('#fr-all');
  await h.wait(800);
  h.ok('Replace All changes the rest', (await count('Bradley Hall')) === 0 && (await count('Fellowship Hall')) >= before, { msg: await msg() });
  h.ok('…and says how many', /Replaced \d+/.test(await msg()), { msg: await msg() });
  await h.shot('replaced-all');
  await h.clickSel('#undo'); await h.wait(600);
  h.ok('Undo brings back the ones Replace All changed', (await count('Bradley Hall')) === before - 1);

  // options
  await h.clickSel('input[name="fr-mode"][value="find"]');
  await setWhat('Hal');
  await h.clickSel('#fr-word');
  await h.clickSel('#fr-next');
  await h.wait(500);
  const s1 = await h.js('getSelection().toString()');
  const ctx = await h.js(`(() => { const s = getSelection(); const t = s.anchorNode.data || ''; return t.slice(s.anchorOffset, s.anchorOffset + 6); })()`);
  h.ok('Match whole word only: "Hal" finds Hal (Barnes), not Hall', s1 === 'Hal' && !ctx.startsWith('Hall'), { s1, ctx });
  await h.clickSel('#fr-word');
  await setWhat('hIGHLAND');
  await h.clickSel('#fr-next');
  await h.wait(400);
  h.ok('without Match case, "hIGHLAND" finds Highland', /\d+ match/.test(await msg()), { msg: await msg() });
  await h.clickSel('#fr-case');
  await h.clickSel('#fr-next');
  await h.wait(400);
  h.ok('with Match case, "hIGHLAND" finds nothing', /No matches/.test(await msg()), { msg: await msg() });
  await h.clickSel('.fr-close');
  h.ok('✕ closes the pane', await h.js(`document.getElementById('findpane').hidden`));
};
