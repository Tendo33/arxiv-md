import logger from '@utils/logger';

/**
 * 预处理：清理 ar5iv 特有元素
 */
export function preprocessAr5ivElements(doc) {
  // 处理章节标题中的编号标签
  doc
    .querySelectorAll(
      '.ltx_title_section, .ltx_title_subsection, .ltx_title_subsubsection, .ltx_title_paragraph',
    )
    .forEach((title) => {
      const tagEl = title.querySelector('.ltx_tag');
      if (tagEl) {
        const tagText = tagEl.textContent.trim();
        tagEl.remove();
        if (tagText && title.firstChild) {
          title.insertBefore(
            doc.createTextNode(tagText + ' '),
            title.firstChild,
          );
        }
      }
    });

  // 移除不需要转换的元素
  [
    '.ltx_pagination',
    '.ltx_break',
    '.ltx_rule',
    '.ltx_dates',
    '.ar5iv-feedback',
  ].forEach((selector) =>
    doc.querySelectorAll(selector).forEach((el) => el.remove()),
  );

  // 清理图片的相对路径 - 使用正确的 ar5iv 域名
  doc.querySelectorAll('img').forEach((img) => {
    let src = img.getAttribute('src');
    if (src && !src.startsWith('http') && !src.startsWith('data:')) {
      img.setAttribute(
        'src',
        src.startsWith('/')
          ? `https://ar5iv.labs.arxiv.org${src}`
          : `https://ar5iv.labs.arxiv.org/${src}`,
      );
    }
  });

  // 处理参考文献列表
  doc.querySelectorAll('.ltx_bibitem').forEach((bibitem) => {
    const tag = bibitem.querySelector('.ltx_tag');
    const tagText = tag ? tag.textContent.trim() : '';
    const bibblocEl = bibitem.querySelector('.ltx_bibblock');
    if (tagText && bibblocEl) {
      bibitem.innerHTML = `<span class="ltx_bib_tag">${tagText}</span> ${bibblocEl.innerHTML}`;
    }
  });

  // 处理代码块（但排除算法块内的 listing，它们需要特殊处理）
  doc
    .querySelectorAll('.ltx_listing, .ltx_verbatim, pre.ltx_code')
    .forEach((code) => {
      // 跳过算法块内的 listing，稍后会单独处理
      if (code.closest('figure.ltx_float_algorithm')) {
        return;
      }
      if (!code.querySelector('code')) {
        code.innerHTML = `<code>${code.textContent}</code>`;
      }
    });

  // 处理引用块
  doc.querySelectorAll('.ltx_quote').forEach((quote) => {
    if (quote.tagName !== 'BLOCKQUOTE') {
      const blockquote = doc.createElement('blockquote');
      blockquote.innerHTML = quote.innerHTML;
      quote.replaceWith(blockquote);
    }
  });

  // 【关键】处理 span.ltx_tabular 伪表格
  // 统一转换为标准 HTML table，保留 colspan/rowspan 属性
  doc
    .querySelectorAll('span.ltx_tabular, div.ltx_tabular')
    .forEach((tabular) => {
      try {
        const rows = Array.from(tabular.querySelectorAll(':scope > .ltx_tr'));
        if (rows.length === 0) return;

        // 创建标准 HTML table
        const table = doc.createElement('table');
        const tbody = doc.createElement('tbody');

        rows.forEach((row, rowIdx) => {
          const tr = doc.createElement('tr');
          const cells = row.querySelectorAll(
            ':scope > .ltx_td, :scope > .ltx_th',
          );

          cells.forEach((cell) => {
            // 判断是否是表头单元格
            const isHeader =
              cell.classList.contains('ltx_th') || rowIdx === 0;
            const cellEl = doc.createElement(isHeader ? 'th' : 'td');

            // 提取 colspan 属性 (优先从 HTML 属性，其次从 class ltx_colspan_N)
            const colspanAttr = cell.getAttribute('colspan');
            const colspanMatch = cell.className.match(/ltx_colspan_(\d+)/);
            if (colspanAttr && colspanAttr !== '1') {
              cellEl.setAttribute('colspan', colspanAttr);
            } else if (colspanMatch) {
              cellEl.setAttribute('colspan', colspanMatch[1]);
            }

            // 提取 rowspan 属性 (优先从 HTML 属性，其次从 class ltx_rowspan_N)
            const rowspanAttr = cell.getAttribute('rowspan');
            const rowspanMatch = cell.className.match(/ltx_rowspan_(\d+)/);
            if (rowspanAttr && rowspanAttr !== '1') {
              cellEl.setAttribute('rowspan', rowspanAttr);
            } else if (rowspanMatch) {
              cellEl.setAttribute('rowspan', rowspanMatch[1]);
            }

            // 复制内容
            cellEl.innerHTML = cell.innerHTML;
            tr.appendChild(cellEl);
          });

          if (tr.children.length > 0) {
            tbody.appendChild(tr);
          }
        });

        if (tbody.children.length > 0) {
          table.appendChild(tbody);
          tabular.replaceWith(table);
          logger.debug(`ltx_tabular 转为 HTML table (${rows.length} 行)`);
        }
      } catch (e) {
        logger.error('转换伪表格失败:', e);
      }
    });

  // 【关键】处理 Algorithm 伪代码块
  doc.querySelectorAll('figure.ltx_float_algorithm').forEach((alg) => {
    try {
      const caption = alg.querySelector('figcaption');
      const captionText = caption ? caption.textContent.trim() : 'Algorithm';

      // 收集所有算法内容（按 DOM 顺序）
      const steps = [];

      // 1. 首先提取 Input 段落（通常在第一个 ltx_flex_cell 中）
      const inputParagraphs = alg.querySelectorAll('.ltx_flex_cell > p.ltx_p, .ltx_flex_cell > .ltx_p');
      inputParagraphs.forEach((p, idx) => {
        // 只取第一个作为 Input
        if (idx === 0) {
          const text = p.textContent.trim();
          if (text) steps.push(text);
        }
      });

      // 2. 提取算法步骤（直接查找所有 ltx_listingline）
      const listingLines = alg.querySelectorAll('.ltx_listingline');
      logger.debug(`找到 ${listingLines.length} 个 ltx_listingline`);

      listingLines.forEach((line) => {
        // 提取行号（在 .ltx_tag 或 .ltx_tag_listingline 中）
        const tagEl = line.querySelector('.ltx_tag_listingline, .ltx_tag');
        const lineNum = tagEl ? tagEl.textContent.trim() : '';

        // 提取行内容（排除行号标签）
        let lineContent = '';
        line.childNodes.forEach((child) => {
          if (child.nodeType === Node.TEXT_NODE) {
            lineContent += child.textContent;
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            // 跳过行号标签
            if (child.classList &&
              (child.classList.contains('ltx_tag') ||
                child.classList.contains('ltx_tag_listingline'))) {
              return;
            }
            lineContent += child.textContent;
          }
        });

        lineContent = lineContent.trim();
        if (lineContent || lineNum) {
          steps.push(lineNum ? `${lineNum} ${lineContent}` : lineContent);
        }
      });

      // 3. 提取 Output 段落（通常在最后一个 ltx_flex_cell 中）
      if (inputParagraphs.length > 1) {
        const lastP = inputParagraphs[inputParagraphs.length - 1];
        const text = lastP.textContent.trim();
        if (text) steps.push(text);
      }

      if (steps.length > 0) {
        // 创建代码块
        const pre = doc.createElement('pre');
        const code = doc.createElement('code');
        code.textContent = `${captionText}\n${'─'.repeat(40)}\n${steps.join('\n')}`;
        pre.appendChild(code);
        pre.className = 'ltx_algorithm_converted';
        alg.replaceWith(pre);
        logger.debug(`转换 Algorithm 为代码块 (${steps.length} 行): ${captionText}`);
      } else {
        // 兜底处理：直接提取所有文本内容
        const fallbackText = alg.textContent.replace(/\s+/g, ' ').trim();
        if (fallbackText) {
          const pre = doc.createElement('pre');
          const code = doc.createElement('code');
          code.textContent = `${captionText}\n${'─'.repeat(40)}\n${fallbackText}`;
          pre.appendChild(code);
          pre.className = 'ltx_algorithm_converted';
          alg.replaceWith(pre);
          logger.warn('Algorithm 使用兜底文本提取:', captionText);
        } else {
          logger.warn('Algorithm 未找到内容:', captionText);
        }
      }
    } catch (e) {
      logger.error('转换 Algorithm 失败:', e);
    }
  });

  // 【关键】处理加粗文本 (ltx_font_bold)
  doc.querySelectorAll('.ltx_font_bold, .ltx_text_bold').forEach((bold) => {
    // 不处理已经在 strong/b 标签中的
    if (bold.closest('strong') || bold.closest('b')) return;
    // 不处理标题中的
    if (bold.closest('h1, h2, h3, h4, h5, h6, figcaption')) return;

    const strong = doc.createElement('strong');
    strong.innerHTML = bold.innerHTML;
    bold.replaceWith(strong);
  });

  // 处理斜体文本 (ltx_font_italic, ltx_emph)
  doc.querySelectorAll('.ltx_font_italic, .ltx_emph').forEach((italic) => {
    if (italic.closest('em') || italic.closest('i')) return;
    if (italic.closest('h1, h2, h3, h4, h5, h6')) return;

    const em = doc.createElement('em');
    em.innerHTML = italic.innerHTML;
    italic.replaceWith(em);
  });

  logger.debug('ar5iv 元素清理完成');
}
