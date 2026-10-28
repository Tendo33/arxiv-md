import { resolvePaperAssetUrl } from './paper-assets';

export function addAr5ivTurndownRules(turndownService, options = {}) {
  const assetPageUrl = options.assetPageUrl;
  const mathMap = options.mathMap;

  // 表格：简单表格（无合并单元格、无嵌套表格、单元格里没有含 | 的公式）转 GFM，
  // 其余保留去掉 class 的 HTML，以保住 colspan/rowspan。
  turndownService.addRule('arxivTables', {
    filter: 'table',
    replacement: (content, node) => {
      if (isEmptyTable(node)) return '';
      if (isSimpleTable(node, mathMap)) {
        return '\n\n' + tableToGfm(node, turndownService) + '\n\n';
      }
      const clone = node.cloneNode(true);
      [clone, ...clone.querySelectorAll('*')].forEach((el) => {
        el.removeAttribute('class');
        el.removeAttribute('id');
        el.removeAttribute('style');
      });
      const cleanHtml = clone.outerHTML
        .replace(/>\s+</g, '><')
        .replace(/\n\s*/g, ' ');
      return '\n\n' + cleanHtml + '\n\n';
    },
  });


  // 自定义规则：处理图片
  turndownService.addRule('arxivImages', {
    filter: 'img',
    replacement: (content, node) => {
      const alt = node.alt || 'image';
      let src = node.getAttribute('src') || '';

      src = resolvePaperAssetUrl(src, assetPageUrl);

      return src ? `![${alt}](${src})` : '';
    },
  });

  // 正文引用：链接到参考文献锚点并保留编号；其他站内链接只留文字
  turndownService.addRule('citations', {
    filter: (node) => {
      if (node.nodeName !== 'A') return false;
      const href = node.getAttribute('href') || '';
      return href.includes('chrome-extension://')
        || node.getAttribute('data-arxivmd-cite') === '1'
        || href.startsWith('#')
        || (node.classList && (node.classList.contains('ltx_ref') || node.classList.contains('ltx_cite')));
    },
    replacement: (content, node) => {
      const href = node.getAttribute('href') || '';
      const text = content.replace(/\s+/g, ' ').trim();
      if (node.getAttribute('data-arxivmd-cite') === '1' && text) {
        return `[${text}](${href})`;
      }
      return text;
    },
  });

  // 自定义规则：处理 ar5iv 的脚注
  turndownService.addRule('footnotes', {
    filter: (node) => {
      if (node.classList) {
        return (
          node.classList.contains('ltx_note') ||
            node.classList.contains('ltx_note_mark') ||
            node.classList.contains('ltx_note_content')
        );
      }
      return false;
    },
    replacement: (content, node) => {
      // 脚注标记：返回上标数字
      if (node.classList.contains('ltx_note_mark')) {
        const num = content.replace(/[^\d]/g, '');
        return num ? `^${num}` : '';
      }
      // 脚注内容：转换为括号注释格式保留
      if (node.classList.contains('ltx_note_content')) {
        const text = content.replace(/\s+/g, ' ').trim();
        return text ? ` [注^: ${text}]` : '';
      }
      return content;
    },
  });

  // 自定义规则：处理 ar5iv 的图片容器 (figure)
  turndownService.addRule('arxivFigures', {
    filter: (node) => {
      return (
        node.nodeName === 'FIGURE' &&
          node.classList &&
          (node.classList.contains('ltx_figure') ||
            node.classList.contains('ltx_table'))
      );
    },
    replacement: (content, node) => {
      // 保留 figure 内容，添加换行
      return `\n\n${content}\n\n`;
    },
  });

  // 自定义规则：处理图表标题 (figcaption)
  turndownService.addRule('arxivCaptions', {
    filter: (node) => {
      return (
        node.nodeName === 'FIGCAPTION' ||
          (node.classList && node.classList.contains('ltx_caption'))
      );
    },
    replacement: (content, node) => {
      // 格式化标题
      const cleanContent = content.replace(/\s+/g, ' ').trim();
      return cleanContent ? `\n\n${cleanContent}\n\n` : '';
    },
  });

  // 自定义规则：处理 ar5iv 的定理/引理/证明等
  turndownService.addRule('arxivTheorems', {
    filter: (node) => {
      if (node.classList) {
        return (
          node.classList.contains('ltx_theorem') ||
            node.classList.contains('ltx_proof') ||
            node.classList.contains('ltx_definition') ||
            node.classList.contains('ltx_lemma') ||
            node.classList.contains('ltx_corollary')
        );
      }
      return false;
    },
    replacement: (content, node) => {
      // 获取定理类型
      let type = '';
      if (node.classList.contains('ltx_theorem')) type = '**Theorem**';
      else if (node.classList.contains('ltx_proof')) type = '**Proof**';
      else if (node.classList.contains('ltx_definition'))
        type = '**Definition**';
      else if (node.classList.contains('ltx_lemma')) type = '**Lemma**';
      else if (node.classList.contains('ltx_corollary'))
        type = '**Corollary**';

      const cleanContent = content.trim();
      return type
        ? `\n\n${type}: ${cleanContent}\n\n`
        : `\n\n${cleanContent}\n\n`;
    },
  });

  // 自定义规则：处理公式编号标签
  turndownService.addRule('arxivTags', {
    filter: (node) => {
      return node.classList && node.classList.contains('ltx_tag');
    },
    replacement: (content, node) => {
      // 公式编号：保留在括号中
      const cleanContent = content.trim();
      return cleanContent ? ` (${cleanContent})` : '';
    },
  });

  // 自定义规则：处理 ar5iv 的章节标题
  turndownService.addRule('arxivSectionTitles', {
    filter: (node) => {
      // ar5iv 使用 h2-h6 来表示章节标题，但有特殊的 class
      if (node.nodeName.match(/^H[1-6]$/)) {
        return (
          node.classList &&
            (node.classList.contains('ltx_title') ||
              node.classList.contains('ltx_title_document') ||
              node.classList.contains('ltx_title_section') ||
              node.classList.contains('ltx_title_subsection') ||
              node.classList.contains('ltx_title_subsubsection') ||
              node.classList.contains('ltx_title_paragraph') ||
              node.classList.contains('ltx_title_subparagraph'))
        );
      }
      return false;
    },
    replacement: (content, node) => {
      // 提取标题文本，清理多余空白
      let text = content.replace(/\s+/g, ' ').trim();

      // 移除章节编号中的括号格式，如 "(1)" -> "1"
      text = text.replace(/^\((\d+(?:\.\d+)*)\)\s*/, '$1 ');

      // 根据标题级别生成 Markdown
      const level = parseInt(node.nodeName.charAt(1), 10);
      const prefix = '#'.repeat(Math.min(level, 6));

      return `\n\n${prefix} ${text}\n\n`;
    },
  });

  // 自定义规则：移除错误元素
  turndownService.addRule('removeErrors', {
    filter: (node) => {
      return node.classList && node.classList.contains('ltx_ERROR');
    },
    replacement: () => '',
  });

  // 自定义规则：处理遗留的 ltx_tag 元素（如果预处理未完全清理）
  turndownService.addRule('arxivTags2', {
    filter: (node) => {
      return (
        node.classList &&
          (node.classList.contains('ltx_tag_item') ||
            node.classList.contains('ltx_tag_itemize') ||
            node.classList.contains('ltx_tag_enumerate'))
      );
    },
    replacement: () => '', // 移除这些标签，Turndown 会自动处理列表符号
  });

  // 自定义规则：处理 ar5iv 的段落
  turndownService.addRule('arxivParas', {
    filter: (node) => {
      return (
        node.classList &&
          (node.classList.contains('ltx_para') ||
            node.classList.contains('ltx_p'))
      );
    },
    replacement: (content) => {
      const trimmed = content.trim();
      return trimmed ? `\n\n${trimmed}\n\n` : '';
    },
  });

  // 自定义规则：处理加粗文本 (备用规则，如果预处理未完全转换)
  turndownService.addRule('arxivBold', {
    filter: (node) => {
      return (
        node.classList &&
          (node.classList.contains('ltx_font_bold') ||
            node.classList.contains('ltx_text_bold'))
      );
    },
    replacement: (content) => {
      const trimmed = content.trim();
      return trimmed ? `**${trimmed}**` : '';
    },
  });

  // 自定义规则：处理斜体文本 (备用规则)
  turndownService.addRule('arxivItalic', {
    filter: (node) => {
      return (
        node.classList &&
          (node.classList.contains('ltx_font_italic') ||
            node.classList.contains('ltx_emph'))
      );
    },
    replacement: (content) => {
      const trimmed = content.trim();
      return trimmed ? `*${trimmed}*` : '';
    },
  });

  // 自定义规则：处理 Algorithm 代码块
  turndownService.addRule('arxivAlgorithm', {
    filter: (node) => {
      return (
        node.classList && node.classList.contains('ltx_algorithm_converted')
      );
    },
    replacement: (content, node) => {
      const code = node.querySelector('code');
      const text = code ? code.textContent : content;
      return `\n\n\`\`\`\n${text}\n\`\`\`\n\n`;
    },
  });

  // 自定义规则：处理 figure 中的表格标题
  turndownService.addRule('arxivTableCaption', {
    filter: (node) => {
      return (
        node.tagName === 'FIGCAPTION' &&
          node.closest('figure.ltx_table, .ltx_float_table')
      );
    },
    replacement: (content) => {
      const trimmed = content.trim();
      return trimmed ? `\n\n${trimmed}\n\n` : '';
    },
  });

  // 自定义规则：处理文本格式的复杂表格
  turndownService.addRule('arxivTextTable', {
    filter: (node) => {
      return node.classList && node.classList.contains('ltx_table_text');
    },
    replacement: (content, node) => {
      const code = node.querySelector('code');
      if (code) {
        return `\n\n\`\`\`\n${code.textContent}\n\`\`\`\n\n`;
      }
      return content;
    },
  });
}

function isEmptyTable(table) {
  return !table.textContent.replace(/\s+/g, '')
    && !table.querySelector('img, object, embed, math');
}

function isSimpleTable(table, mathMap) {
  if (table.querySelector('table')) return false;
  const rows = Array.from(table.querySelectorAll('tr'));
  if (rows.length < 1) return false;
  const cells = table.querySelectorAll('td, th');
  for (const cell of cells) {
    const rs = parseInt(cell.getAttribute('rowspan') || '1', 10);
    const cs = parseInt(cell.getAttribute('colspan') || '1', 10);
    if (rs > 1 || cs > 1) return false;
    if (cell.querySelector('ul, ol, figure, pre, blockquote')) return false;
  }
  const width = rows[0].querySelectorAll('td, th').length;
  if (!width || rows.some((r) => r.querySelectorAll('td, th').length !== width)) return false;
  if (mathMap) {
    const ids = table.textContent.match(/MATH(?:INLINE|BLOCK)START\d+MATH(?:INLINE|BLOCK)END/g) || [];
    if (ids.some((id) => (mathMap.get(id)?.latex || '').includes('|'))) return false;
    if (ids.some((id) => mathMap.get(id)?.isBlock)) return false;
  }
  return true;
}

function tableToGfm(table, turndownService) {
  const rows = Array.from(table.querySelectorAll('tr')).map((tr) =>
    Array.from(tr.querySelectorAll('td, th')).map((cell) =>
      turndownService
        .turndown(cell.innerHTML)
        .replace(/\s*\n+\s*/g, ' ')
        .replace(/\|/g, '\\|')
        .trim(),
    ),
  );
  const width = rows[0].length;
  const line = (cells) => `| ${cells.map((c) => c || ' ').join(' | ')} |`;
  return [line(rows[0]), line(new Array(width).fill('---')), ...rows.slice(1).map(line)].join('\n');
}
