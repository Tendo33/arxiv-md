export function addAr5ivTurndownRules(turndownService) {
  // 【重要】自定义规则：保持 HTML 表格格式（不转换为 Markdown 表格）
  // 这样可以保留 colspan/rowspan 合并单元格
  turndownService.addRule('keepHtmlTables', {
    filter: 'table',
    replacement: (content, node) => {
      // 清理 table 标签内的多余空白和换行
      const cleanHtml = node.outerHTML
        .replace(/>\s+</g, '><')
        .replace(/\n\s*/g, '');
      return '\n\n' + cleanHtml + '\n\n';
    },
  });

  // 自定义规则：处理图片
  turndownService.addRule('arxivImages', {
    filter: 'img',
    replacement: (content, node) => {
      const alt = node.alt || 'image';
      let src = node.getAttribute('src') || '';

      // 清理错误的 chrome-extension URL
      src = src.replace(/chrome-extension:\/\/[^/]+\//, '');

      // 处理相对路径 - 使用正确的 ar5iv 域名
      if (src && !src.startsWith('http')) {
        src = src.startsWith('/')
          ? `https://ar5iv.labs.arxiv.org${src}`
          : `https://ar5iv.labs.arxiv.org/${src}`;
      }

      return src ? `![${alt}](${src})` : '';
    },
  });

  // 自定义规则：处理 ar5iv 的引用链接
  turndownService.addRule('citations', {
    filter: (node) => {
      if (node.nodeName === 'A') {
        const href = node.getAttribute('href') || '';
        // 过滤 chrome-extension URL
        if (href.includes('chrome-extension://')) return true;
        // 过滤 ar5iv 引用链接（指向参考文献的内部链接）
        if (href.startsWith('#bib.')) return true;
        // 过滤带有 ltx_ref 类的链接（ar5iv 的内部引用）
        if (
          node.classList &&
            (node.classList.contains('ltx_ref') ||
              node.classList.contains('ltx_cite'))
        ) {
          return true;
        }
      }
      return false;
    },
    replacement: (content, node) => {
      const href = node.getAttribute('href') || '';

      // chrome-extension URL：只保留内容
      if (href.includes('chrome-extension://')) {
        return content;
      }

      // ar5iv 的内部引用链接：转换为 [内容] 格式
      if (href.startsWith('#bib.') || href.startsWith('#')) {
        // 清理内容中的多余空白
        const cleanContent = content.replace(/\s+/g, ' ').trim();
        return `[${cleanContent}]`;
      }

      // ltx_ref 类：保留内容
      if (node.classList && node.classList.contains('ltx_ref')) {
        return content;
      }

      return `[${content}](${href})`;
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
            (node.classList.contains('ltx_title_section') ||
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
