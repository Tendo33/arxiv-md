import logger from '@utils/logger';

/**
 * 预处理：清理作者和元数据格式问题
 */
export function preprocessAuthorsAndMetadata(doc) {
  // 移除 \AND 错误标记
  doc.querySelectorAll('.ltx_ERROR').forEach((el) => {
    if (el.textContent.includes('\\AND')) el.remove();
  });

  // 清理脚注标记
  doc.querySelectorAll('.ltx_note_mark, sup.ltx_note_mark').forEach((el) => {
    const text = el.textContent.replace(/footnotemark:\s*/g, '').trim();
    if (text) el.textContent = text;
  });

  // 脚注内容：保留但标记为特殊格式（后续由 Turndown 规则处理）
  // 不再直接删除，改为在 Turndown 中转换为 [注: ...] 格式

  // 清理作者分隔符
  doc.querySelectorAll('.ltx_personname').forEach((el) => {
    el.innerHTML = el.innerHTML.replace(/&amp;/g, '\n\n');
  });
}

/**
 * 预处理：处理 ar5iv 表格
 * 方程式表格 (.ltx_eqn_table) 用于排版多行公式
 * 数据表格 (.ltx_tabular) 是实际数据表格
 */
export function preprocessTables(doc) {
  doc.querySelectorAll('table').forEach((table) => {
    const isEquationTable =
      table.classList.contains('ltx_eqn_table') ||
      table.classList.contains('ltx_eqn_row') ||
      table.closest('.ltx_equation, .ltx_equationgroup') !== null;
    const hasMathPlaceholder =
      table.textContent.includes('MATHBLOCK') ||
      table.textContent.includes('MATHINLINE');

    if (isEquationTable) {
      const placeholders =
        table.textContent.match(
          /MATHBLOCKSTART\d+MATHBLOCKEND|MATHINLINESTART\d+MATHINLINEEND/g,
        ) || [];
      if (placeholders.length > 0) {
        table.replaceWith(
          doc.createTextNode(`\n\n${placeholders.join('\n\n')}\n\n`),
        );
        return;
      }
      const text = table.textContent.replace(/\s+/g, ' ').trim();
      if (text) {
        table.replaceWith(doc.createTextNode(`\n\n${text}\n\n`));
        return;
      }
      table.remove();
      return;
    }

    const isDataTable =
      table.classList.contains('ltx_tabular') ||
      table.closest('.ltx_table, figure.ltx_table') !== null;

    if (isDataTable || !hasMathPlaceholder) {
      table.removeAttribute('id');
      table.removeAttribute('style');

      const firstRow = table.querySelector('tr');
      const hasHeader =
        table.querySelector('thead') ||
        (firstRow && firstRow.querySelector('th'));

      if (!hasHeader && firstRow) {
        const firstRowCells = firstRow.querySelectorAll('td');
        const isLikelyHeader =
          firstRowCells.length > 0 &&
          Array.from(firstRowCells).some(
            (cell) =>
              cell.textContent.trim().length < 50 &&
              !cell.textContent.includes('.'),
          );

        if (isLikelyHeader) {
          firstRowCells.forEach((td) => {
            const th = doc.createElement('th');
            th.innerHTML = td.innerHTML;
            // 复制 rowspan 和 colspan 属性
            const rowspan = td.getAttribute('rowspan');
            const colspan = td.getAttribute('colspan');
            if (rowspan) th.setAttribute('rowspan', rowspan);
            if (colspan) th.setAttribute('colspan', colspan);
            td.replaceWith(th);
          });
        }
      }

      table.querySelectorAll('td, th').forEach((cell) => {
        // 保留 rowspan 和 colspan 属性用于多行/多列合并
        const rowspan = cell.getAttribute('rowspan');
        const colspan = cell.getAttribute('colspan');

        cell.removeAttribute('id');
        cell.removeAttribute('style');
        cell.removeAttribute('class');

        // 恢复 rowspan 和 colspan 属性
        if (rowspan && rowspan !== '1') {
          cell.setAttribute('rowspan', rowspan);
        }
        if (colspan && colspan !== '1') {
          cell.setAttribute('colspan', colspan);
        }
      });

      table.querySelectorAll('tr').forEach((row) => {
        row.removeAttribute('id');
        row.removeAttribute('style');
        row.removeAttribute('class');
      });
      return;
    }

    // 小表格（可能是布局用）
    const rows = table.querySelectorAll('tr');
    const cells = table.querySelectorAll('td, th');
    if (rows.length <= 3 && cells.length <= 6 && hasMathPlaceholder) {
      table.replaceWith(
        doc.createTextNode(
          `\n\n${table.textContent.replace(/\s+/g, ' ').trim()}\n\n`,
        ),
      );
    }
  });
}

/**
 * 预处理：修复列表格式问题
 */
export function preprocessLists(doc) {
  // 移除列表项中的标签元素
  doc
    .querySelectorAll('li .ltx_tag, li .ltx_tag_item, li .ltx_tag_itemize')
    .forEach((tag) => tag.remove());

  // 移除列表项中的孤立 • 符号
  doc.querySelectorAll('li').forEach((li) => {
    const firstChild = li.firstChild;
    if (firstChild && firstChild.nodeType === Node.TEXT_NODE) {
      firstChild.textContent = firstChild.textContent.replace(/^[\s•]+/, '');
    }
    li.querySelectorAll('span').forEach((span) => {
      if (span.textContent.trim() === '•' || span.textContent.trim() === '–') {
        span.remove();
      }
    });
  });

  // 确保列表项内容在同一行
  doc
    .querySelectorAll('li > .ltx_para, li > .ltx_p, li > p')
    .forEach((para) => {
      const parent = para.parentElement;
      if (parent && parent.tagName === 'LI') {
        while (para.firstChild) {
          parent.insertBefore(para.firstChild, para);
        }
        para.remove();
      }
    });
}
