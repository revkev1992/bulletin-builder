// Publisher's text box linking (Text Box Format ▸ Linking): Create Link, Break, Previous, Next.
// A linked story is one text poured through several boxes (frame.text.chain = { story, index }).
// Create Link: click the button (or the overflow tag on a box whose text doesn't fit), then click an
// EMPTY text box — the text carries on there. Break: the boxes after this one leave the story and
// their text comes back into it (it overflows until you link again). Installed on Editor.prototype.

import { joinStory } from './textedit.js';

const textOf = (f) => f.text.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('').replace(/[\s \u000c]/g, '');

export function installLinking(Editor) {
  const P = Editor.prototype;

  // the text box being worked with: the one you are typing in, else the selected one
  P.linkSource = function () {
    const t = this.textEdit;
    if (t) return { n: t.n, f: this.anyFrame(t.n, t.id) };
    if (!this.sel || this.multi.length) return null;
    const f = this.topFrame(this.sel.page, this.sel.id);
    return f && f.kind === 'text' ? { n: this.sel.page, f } : null;
  };

  P.chainOf = function (f) { return f && f.text && f.text.chain ? this.storyFrames(f.text.chain.story) : []; };

  P.startLink = async function () {
    const s = this.linkSource();
    if (!s || !this.editable(s.n) || this.locked(s.n, this.topFrame(s.n, s.f.id))) return false;
    const list = this.chainOf(s.f);
    const me = list.findIndex((x) => x.frame.id === s.f.id);
    if (me >= 0 && me < list.length - 1) {
      this.app.setStatus('This text box already flows on to another one. Break the link first (Text Box Format ▸ Break).');
      return false;
    }
    if (this.textEdit) await this.endTextEdit();
    this.linking = { n: s.n, id: s.f.id };
    document.body.classList.add('linking');
    this.app.setStatus('Click an empty text box to carry the text on into it (Esc to cancel).');
    this.app.onState();
    return true;
  };

  P.cancelLink = function (msg) {
    if (!this.linking) return;
    this.linking = null;
    document.body.classList.remove('linking');
    this.app.setStatus(msg || '');
    this.app.onState();
  };

  // the click that finishes Create Link (called from onDown)
  P.finishLink = async function (n, id) {
    const from = this.linking;
    const src = this.anyFrame(from.n, from.id);
    const dst = this.anyFrame(n, id);
    const top = this.topFrame(n, id);
    if (!dst || dst.kind !== 'text' || !this.editable(n) || this.locked(n, top)) { this.cancelLink('Linking cancelled — that is not a text box you can change.'); return; }
    if (dst.id === src.id || (dst.text.chain && src.text.chain && dst.text.chain.story === src.text.chain.story)) { this.cancelLink('Linking cancelled — that box is already part of this story.'); return; }
    if (textOf(dst)) { this.cancelLink('That text box is not empty. As in Publisher, text can only flow into an empty text box.'); return; }
    if (dst.text.chain) { this.cancelLink('That text box is already linked to other boxes.'); return; }
    this.linking = null;
    document.body.classList.remove('linking');
    const pages = new Set([from.n, n]);
    let story;
    await this.commit([...pages], () => {
      const s = this.anyFrame(from.n, from.id), d = this.anyFrame(n, id);
      if (!s.text.chain) s.text.chain = { story: 'story-' + Date.now().toString(36), index: 0 };
      story = s.text.chain.story;
      d.text.chain = { story, index: s.text.chain.index + 1 };
      d.text.paragraphs = [];
    });
    await this.app.rerender(this.reflow(story));
    this.select(n, top.id);
    this.app.setStatus('Linked: the text now flows on into this box.');
  };

  // Break: this box keeps the story's remaining text (overflowing); the boxes after it leave the story
  P.breakLink = async function () {
    const s = this.linkSource();
    if (!s || !this.editable(s.n)) return false;
    const list = this.chainOf(s.f);
    const me = list.findIndex((x) => x.frame.id === s.f.id);
    if (me < 0 || me === list.length - 1) { this.app.setStatus('This text box does not flow on to another one.'); return false; }
    if (this.textEdit) await this.endTextEdit();
    const after = list.slice(me + 1);
    const pages = new Set(list.map((x) => x.n));
    await this.commit([...pages], () => {
      const live = list.map((x) => this.anyFrame(x.n, x.frame.id));
      const mine = live[me];
      mine.text.paragraphs = joinStory(live.slice(me));
      for (const f of live.slice(me + 1)) { f.text.paragraphs = []; delete f.text.chain; }
      if (me === 0) delete mine.text.chain;      // a story of one box is just a box
    });
    if (me > 0) await this.app.rerender(this.reflow(s.f.text.chain.story));
    this.select(s.n, this.topFrame(s.n, s.f.id).id);
    this.app.setStatus('Link broken: ' + after.length + ' box' + (after.length === 1 ? '' : 'es') + ' no longer part of this story; the text stays in this one.');
    return true;
  };

  // Previous / Next: select the box before / after this one in its story
  P.stepLink = async function (dir) {
    const s = this.linkSource();
    if (!s) return;
    const list = this.chainOf(s.f);
    const me = list.findIndex((x) => x.frame.id === s.f.id);
    const go = list[me + dir];
    if (!go) return;
    if (this.textEdit) await this.endTextEdit();
    this.select(go.n, this.topFrame(go.n, go.frame.id).id);
    const sh = this.app.shellOf(go.n);
    if (sh) sh.scrollIntoView({ block: 'center' });
  };

  // what the Linking buttons can do right now
  P.linkState = function () {
    const s = this.linkSource();
    if (!s || !this.half || !this.editable(s.n)) return { create: false, brk: false, prev: false, next: false };
    const list = this.chainOf(s.f);
    const me = list.findIndex((x) => x.frame.id === s.f.id);
    const locked = this.locked(s.n, this.topFrame(s.n, s.f.id));
    return { create: !locked && (me < 0 || me === list.length - 1), brk: !locked && me >= 0 && me < list.length - 1, prev: me > 0, next: me >= 0 && me < list.length - 1 };
  };
}

