import { parseHTML } from 'linkedom';
import { preprocessNotes, appendFootnotes } from '../src/content/ar5iv-references';

const run = (html) => {
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  const defs = preprocessNotes(document);
  return { defs, html: document.body.innerHTML };
};
const textNote = (mark, text) => `<span class="ltx_note ltx_role_footnotetext"><sup class="ltx_note_mark">${mark}</sup><span class="ltx_note_outer"><span class="ltx_note_content"><sup class="ltx_note_mark">${mark}</sup><span class="ltx_note_type">footnotetext: </span>${text}</span></span></span>`;
const markNote = (mark) => `<span class="ltx_note ltx_role_footnotemark"><sup class="ltx_note_mark">${mark}</sup><span class="ltx_note_outer"><span class="ltx_note_content"><sup class="ltx_note_mark">${mark}</sup><span class="ltx_note_type">footnotemark: </span></span></span></span>`;
const fullNote = (mark, text) => `<span class="ltx_note ltx_role_footnote"><sup class="ltx_note_mark">${mark}</sup><span class="ltx_note_outer"><span class="ltx_note_content"><sup class="ltx_note_mark">${mark}</sup>${text}</span></span></span>`;

describe('R1-02 footnotetext 不产生孤立脚注', () => {
  test('无引用点的 footnotetext（LoRA 版本说明）就地输出为引用块', () => {
    const { defs, html } = run(`<p>Abstract.${fullNote(1, 'Equal contribution.')}</p>${textNote(0, 'Compared to V1, better baselines.')}`);
    expect(defs).toEqual(['Equal contribution.']);
    expect(html).toContain('<blockquote>Compared to V1, better baselines.</blockquote>');
    const md = appendFootnotes('Abstract.ARXIVMDFNREF1END', defs);
    const definedButUnused = [...md.matchAll(/^\[\^(\d+)\]:/gm)].filter(([, n]) => !md.includes(`[^${n}]`) || md.split(`[^${n}]`).length < 3);
    expect(definedButUnused).toEqual([]);
  });
  test('footnotemark 在 footnotetext 之前：复用同一编号', () => {
    const { defs, html } = run(`<p>See table${markNote(9)}.</p>${textNote(9, 'See (10) in the FAQ.')}`);
    expect(defs).toEqual(['See (10) in the FAQ.']);
    expect(html).toMatch(/See table.*1.*\./);
    expect(html).not.toContain('blockquote');
  });
  test('footnotetext 在 footnotemark 之前：同样配对', () => {
    const { defs, html } = run(`${textNote(3, 'Later mark.')}<p>Here${markNote(3)}</p>`);
    expect(defs).toEqual(['Later mark.']);
    expect(html).not.toContain('blockquote');
    expect(html).toContain('Here');
  });
});
