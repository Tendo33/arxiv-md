/**
 * 参考文献、正文引用、脚注和作者邮箱的预处理。
 * 在数学公式占位之后、Turndown 之前调用；产生的占位符在 finalizeReferences 中还原。
 */

const BIB_ANCHOR = (id) => `ARXIVMDBIBANCHOR${id}END`;
const FOOTNOTE_REF = (n) => `ARXIVMDFNREF${n}END`;

function safeId(id) {
  return String(id || '').replace(/[^A-Za-z0-9._-]/g, '');
}

function collapse(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

/**
 * 参考文献列表改成带编号、带锚点的段落；正文引用链接到对应条目；
 * 文内交叉引用（Section/Figure/Equation）去掉没有目标的链接，只保留文字。
 */
export function preprocessReferences(doc) {
  doc.querySelectorAll('.ltx_biblist').forEach((list) => {
    const container = doc.createElement('div');
    list.querySelectorAll('li.ltx_bibitem, .ltx_bibitem').forEach((item) => {
      const id = safeId(item.getAttribute('id'));
      const tagEl = item.querySelector('.ltx_tag_bibitem, .ltx_tag');
      const tag = tagEl ? collapse(tagEl.textContent) : '';
      if (tagEl) tagEl.remove();
      const blocks = Array.from(item.querySelectorAll('.ltx_bibblock'));
      const p = doc.createElement('p');
      const prefix = `${id ? BIB_ANCHOR(id) : ''}${tag ? `${tag} ` : ''}`;
      p.appendChild(doc.createTextNode(prefix));
      if (blocks.length) {
        blocks.forEach((block, index) => {
          if (index > 0) p.appendChild(doc.createTextNode(' '));
          while (block.firstChild) p.appendChild(block.firstChild);
        });
      } else {
        while (item.firstChild) p.appendChild(item.firstChild);
      }
      container.appendChild(p);
    });
    list.replaceWith(container);
  });

  doc.querySelectorAll('a.ltx_ref, a[href^="#"]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (/^#bib\.bib[\w.-]+$/.test(href)) {
      a.setAttribute('href', `#${safeId(href.slice(1))}`);
      a.setAttribute('data-arxivmd-cite', '1');
      return;
    }
    if (href.startsWith('#') || a.classList.contains('ltx_ref')) {
      a.replaceWith(doc.createTextNode(a.textContent));
    }
  });
}

/**
 * 脚注（含作者 thanks）转成标准 Markdown 脚注 [^n]。
 * 只有 footnotemark 的重复标记复用同一个脚注。
 */
export function preprocessNotes(doc) {
  const definitions = [];
  const byMark = new Map();

  const notes = Array.from(doc.querySelectorAll('.ltx_note'))
    .filter((note) => !note.parentElement?.closest('.ltx_note'));

  notes.forEach((note) => {
    const markEl = note.querySelector('.ltx_note_mark');
    const mark = markEl ? collapse(markEl.textContent) : '';
    const contentEl = note.querySelector('.ltx_note_content');
    let text = '';
    if (contentEl) {
      const clone = contentEl.cloneNode(true);
      clone.querySelectorAll('.ltx_note_mark, .ltx_note_type, .ltx_tag_note').forEach((el) => el.remove());
      text = collapse(clone.textContent);
    }

    const isMarkOnly = note.classList.contains('ltx_role_footnotemark') || !text;
    let number;
    if (isMarkOnly) {
      number = byMark.get(mark);
      if (!number) {
        note.remove();
        return;
      }
    } else {
      definitions.push(text);
      number = definitions.length;
      if (mark && !byMark.has(mark)) byMark.set(mark, number);
    }
    note.replaceWith(doc.createTextNode(FOOTNOTE_REF(number)));
  });

  // 标题里的 pubnotes（如 "Thanks: ..."）同样转成脚注，避免混进标题
  doc.querySelectorAll('.ltx_pubnotes').forEach((pubnotes) => {
    const refs = [];
    pubnotes.querySelectorAll('.ltx_pubnote').forEach((pubnote) => {
      const clone = pubnote.cloneNode(true);
      clone.querySelectorAll('.ltx_note_name').forEach((el) => el.remove());
      const text = collapse(clone.textContent);
      if (!text) return;
      definitions.push(text);
      refs.push(FOOTNOTE_REF(definitions.length));
    });
    pubnotes.replaceWith(doc.createTextNode(refs.join('')));
  });

  return definitions;
}

/** LaTeXML 常输出 href="mailto:" 的空链接，把邮箱文本补进去 */
export function fixEmptyMailto(doc) {
  doc.querySelectorAll('a[href]').forEach((a) => {
    const href = (a.getAttribute('href') || '').trim();
    if (!/^mailto:\s*$/i.test(href)) return;
    const text = collapse(a.textContent);
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
      a.setAttribute('href', `mailto:${text}`);
    } else {
      a.replaceWith(doc.createTextNode(a.textContent));
    }
  });
}

/** 还原脚注引用并在文末追加脚注定义（在公式还原之前调用，定义里可能有公式占位） */
export function appendFootnotes(markdown, definitions = []) {
  let result = markdown.replace(/[ \t]*ARXIVMDFNREF(\d+)END/g, (_, n) => `[^${n}]`);
  if (definitions.length) {
    const defs = definitions.map((text, i) => `[^${i + 1}]: ${text}`).join('\n');
    result = `${result.replace(/\s+$/, '')}\n\n${defs}\n`;
  }
  return result;
}

/** 还原参考文献锚点并去掉引用两侧多余的转义（在 postProcessMarkdown 之后调用） */
export function finalizeReferences(markdown) {
  return markdown
    .replace(/ARXIVMDBIBANCHOR([A-Za-z0-9._-]+?)END/g, (_, id) => `<a id="${id}"></a>`)
    .replace(/\\\[(?=\[)/g, '[')
    .replace(/(\]\(#bib[\w.-]*\))\\\]/g, '$1]');
}

/**
 * 新版 arXiv HTML 用 <object type="image/svg+xml" data="..."> 嵌入 SVG 图。
 * Turndown 会把没有文字的 object 当空节点丢掉，这里先换成 <img>，交给图片规则处理。
 */
export function convertImageObjects(doc) {
  doc.querySelectorAll('object, embed').forEach((node) => {
    const type = (node.getAttribute('type') || '').toLowerCase();
    const data = node.getAttribute('data') || node.getAttribute('src') || '';
    if (!data) return;
    if (!type.startsWith('image/') && !/\.(svg|png|jpe?g|gif|webp)(\?|#|$)/i.test(data)) return;
    const img = doc.createElement('img');
    img.setAttribute('src', data);
    img.setAttribute('alt', node.getAttribute('aria-label') || node.getAttribute('title') || 'figure');
    node.replaceWith(img);
  });
}
