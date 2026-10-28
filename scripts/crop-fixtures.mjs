// 把整页 arXiv HTML 裁成只含测试用正文片段的小 fixture。
// 用法：node scripts/crop-fixtures.mjs <整页目录> [输出目录=tests/fixtures/papers]
// 整页文件名为 <arXiv ID>.html；许可信息来自 FIXTURES 列表（arXiv 摘要页的 license 链接）。
// 裁剪规则（每篇约 20 KB）：
//   - 只保留 article.ltx_document：标题（含 pubnotes）、作者块（thanks 脚注、邮箱）、摘要首段；
//   - 正文按需挑代表段落：行间公式 ≤2、含行内公式段落 ≤3、表格 1（<8 KB）、SVG <object> 图 1、
//     含引用段落 ≤2（每段引用 ≤4 条）、含脚注段落 ≤2，保留所在小节标题；
//   - 参考文献只留被保留段落引用到的条目；
//   - <math> 只留 alttext/display 和 TeX annotation，去掉展开的 MathML 树；去掉 style 属性。
import fs from 'node:fs';
import path from 'node:path';
import { parseHTML } from 'linkedom';

export const FIXTURES = {
  '2305.18290': 'CC BY 4.0',
  '2312.16475': 'CC0 1.0',
  '2401.11627': 'CC BY 4.0',
  '2402.18614': 'CC BY 4.0',
  '2402.18734': 'CC BY 4.0',
  '2402.18762': 'CC BY 4.0',
  '2402.18994': 'CC BY 4.0',
  '2402.19155': 'CC BY 4.0',
  '2402.19308': 'CC BY 4.0',
  '2402.19464': 'CC BY 4.0',
  '2402.19469': 'CC BY 4.0',
};

const LICENSE_URL = {
  'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/',
  'CC0 1.0': 'https://creativecommons.org/publicdomain/zero/1.0/',
};

const BLOCKS = '.ltx_para, .ltx_equation, .ltx_equationgroup, figure.ltx_table, figure.ltx_figure';

function slimMath(doc, root) {
  root.querySelectorAll('math').forEach((m) => {
    const tex = m.getAttribute('alttext') || '';
    const slim = doc.createElement('math');
    for (const a of ['alttext', 'display', 'class', 'id']) {
      if (m.hasAttribute(a)) slim.setAttribute(a, m.getAttribute(a));
    }
    slim.innerHTML = `<semantics><mi>x</mi><annotation encoding="application/x-tex"></annotation></semantics>`;
    slim.querySelector('annotation').textContent = tex;
    m.replaceWith(slim);
  });
  root.querySelectorAll('[style]').forEach((el) => el.removeAttribute('style'));
}

function crop(html, id) {
  const { document: doc } = parseHTML(html);
  const article = doc.querySelector('article.ltx_document');
  if (!article) throw new Error(`${id}: 没有 article.ltx_document`);
  const quota = { display: 2, inline: 3, table: 1, svg: 1, cite: 2, note: 2 };
  const want = (el) => {
    const size = el.outerHTML.length;
    const hits = [];
    if (el.matches('.ltx_equation, .ltx_equationgroup') && size < 4000) hits.push('display');
    if (el.matches('figure.ltx_table') && size < 8000) hits.push('table');
    if (el.matches('figure.ltx_figure') && el.querySelector('object[type="image/svg+xml"]') && size < 6000) hits.push('svg');
    if (el.matches('.ltx_para') && size < 5000) {
      if (el.querySelector('math')) hits.push('inline');
      if (el.querySelector('.ltx_cite') && el.querySelectorAll('a[href*="#bib."]').length <= 4) hits.push('cite');
      if (el.querySelector('.ltx_note')) hits.push('note');
    }
    const useful = hits.filter((h) => quota[h] > 0);
    if (!useful.length) return false;
    useful.forEach((h) => { quota[h] -= 1; });
    return true;
  };

  const out = doc.createElement('article');
  out.setAttribute('class', 'ltx_document');
  for (const sel of ['.ltx_title_document', '.ltx_authors']) {
    const el = article.querySelector(sel);
    if (el) out.appendChild(el.cloneNode(true));
  }
  const abs = article.querySelector('.ltx_abstract');
  if (abs) {
    const a = abs.cloneNode(true);
    [...a.querySelectorAll('.ltx_p')].slice(1).forEach((p) => p.closest('.ltx_para')?.remove() || p.remove());
    out.appendChild(a);
  }

  const sections = [...article.querySelectorAll('section.ltx_section, section.ltx_appendix')];
  for (const sec of sections) {
    const kept = [...sec.querySelectorAll(BLOCKS)]
      .filter((b) => !b.parentElement.closest(BLOCKS))
      .filter(want);
    if (!kept.length) continue;
    const s = doc.createElement('section');
    s.setAttribute('class', sec.getAttribute('class'));
    if (sec.id) s.id = sec.id;
    const h = sec.querySelector(':scope > .ltx_title');
    if (h) s.appendChild(h.cloneNode(true));
    kept.forEach((b) => s.appendChild(b.cloneNode(true)));
    out.appendChild(s);
  }

  const bib = article.querySelector('section.ltx_bibliography');
  if (bib) {
    const refs = new Set([...out.querySelectorAll('a[href*="#bib."]')].map((a) => a.getAttribute('href').split('#')[1]));
    const b = bib.cloneNode(true);
    b.querySelectorAll('li.ltx_bibitem').forEach((li) => { if (!refs.has(li.id)) li.remove(); });
    out.appendChild(b);
  }

  slimMath(doc, out);
  return out.outerHTML;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (isMain) {
  const src = process.argv[2];
  const dest = process.argv[3] || 'tests/fixtures/papers';
  if (!src) { console.error('用法：node scripts/crop-fixtures.mjs <整页目录> [输出目录]'); process.exit(1); }
  fs.mkdirSync(dest, { recursive: true });
  for (const [id, license] of Object.entries(FIXTURES)) {
    const body = crop(fs.readFileSync(path.join(src, `${id}.html`), 'utf8'), id);
    const header = `<!doctype html>\n<!-- source: https://arxiv.org/html/${id} (abs: https://arxiv.org/abs/${id}) ; license: ${license} ${LICENSE_URL[license]} ; cropped by scripts/crop-fixtures.mjs, test use only -->\n`;
    const html = `${header}<html><head><meta charset="utf-8"></head><body>\n${body}\n</body></html>\n`;
    fs.writeFileSync(path.join(dest, `${id}.html`), html);
    console.log(id, license, html.length);
  }
}
