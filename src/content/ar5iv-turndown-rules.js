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
        return '\n\n' + tableToGfm(node, turndownService, mathMap) + '\n\n';
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

  // 自定义规则：verbatim / listing 代码块，附语言标记（R1-03）
  turndownService.addRule('arxivPre', {
    filter: (node) => node.nodeName === 'PRE' && !node.closest('.ltx_table_text, .ltx_algorithm_converted'),
    replacement: (content, node) => {
      const text = node.textContent.replace(/^\n+|\s+$/g, '');
      if (!text) return '';
      const fence = /```/.test(text) ? '~~~~' : '```';
      let lang = guessCodeLanguage(text);
      // AA3-01：启发式只对 ltx_verbatim 生效，且源 HTML 已标语言（ltx_lst_language_*）时不猜
      if (!lang && node.classList?.contains('ltx_verbatim')
        && !/\bltx_lst_language_/.test(node.className || '') && guessPythonByHints(text)) lang = 'python';
      return `\n\n${fence}${lang}\n${text}\n${fence}\n\n`;
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

// AA3-01（审查 B1 后收紧）：强特征只认 Python 才有的写法；弱特征只用来凑第二条。
const PYTHON_STRONG = [
  /\bre\.(?:compile|match|search|sub|findall|fullmatch)\(/, // 标准库 re 调用
  /\bre\.(?:IGNORECASE|MULTILINE|DOTALL|VERBOSE)\b/, // re 标志
  /\b(?:re\.)?\w+\(\s*(?:rf|fr|rb|br|[rfb])"/i, // 作为函数实参的 r"" / f"" / rf""（TOML 的 key = r"x" 不算）
  /(?:'[^'\n]*'|"[^"\n]*")\.join\(/, // '…'.join(
];
const PYTHON_WEAK = [
  /^\w+ = [[{(]\s*$/m, // 多行列表 / 字典 / 元组赋值的开头
  /,\s+#\s?\S/, // 元素后的 # 行内注释
  /\bself\.\w+/,
];
// 其他语言的排他特征：命中任一条就不标 python
const NOT_PYTHON = [
  /^\s*end\s*$/m, // Ruby / Julia / Lua 的独立 end
  /(?:^|[^\w@])@\w+/m, // Ruby 实例变量 / Julia 宏（Python 装饰器也会排除，宁可不标）
  /<-/, // R / 伪代码赋值
  /\b(?:println|puts|printf|console\.log)\b/,
  /[;{]\s*$/m, // C / JS 行尾
  /\b(?:const|let|var|function)\s+\w/, // JS
  /=>|===/,
  // batch8（batch6 复审 P3）：算法伪代码的 Step/Input/Output/Algorithm 行；伪代码里写 re.compile 也不标 python
  /^\s*(?:Algorithm\s*\d*\s*[:.]|Algorithm\s+\d+\b|Step\s*\d+\s*[:.)]|Step\s*:|Input\s*:|Output\s*:)/m,
];

/**
 * AA3-01：只给 ltx_verbatim（源 HTML 不带语言）用。至少 1 条强特征 + 另 1 条（强或弱），且不含其他语言排他特征。
 */
export function guessPythonByHints(code) {
  const text = String(code || '');
  if (isPromptTemplate(text) || NOT_PYTHON.some((re) => re.test(text))) return false;
  const strong = PYTHON_STRONG.filter((re) => re.test(text)).length;
  const weak = PYTHON_WEAK.filter((re) => re.test(text)).length;
  return strong >= 1 && strong + weak >= 2;
}


/**
 * R1-03：LaTeXML 的 verbatim/listing 不带语言，按内容保守猜测；拿不准就不写。
 */
// AB6-05：LLM 提示词模板（Llama/Code Llama 的 [INST]、[PYTHON]、<<SYS>>，ChatML 的 <|im_start|> 等）
// 里夹着 def/import 也不是 Python 源码，整块不标语言。
// batch8：标记只在「行首（可有缩进）且不在引号里」时才算，避免拼提示词的 Python
// （prompt = f"[INST] {q} [/INST]"、三引号字符串里的 [INST] 行）丢掉 python 标签。
// "### Instruction:/### Response:" 本身也是合法的 Python 注释，所以要两者都在行首出现（Alpaca 模板结构）才算。
const PROMPT_LINE_MARKER = /^[ \t]*(?:\[\/?(?:INST|PYTHON|TESTS|SYS)\]|<<\/?SYS>>|<\|im_(?:start|end)\|>)/m;
const ALPACA_INSTRUCTION = /^[ \t]*#{2,3} Instruction:/m;
const ALPACA_RESPONSE = /^[ \t]*#{2,3} Response:/m;

// 去掉 Python 字符串字面量（三引号可跨行；单/双引号到行尾为止；支持 \ 转义），换成 ""。
// 手写单遍扫描，O(n)，不用正则回溯（病态输入见 tests/batch8-prompt-pseudo.test.js）。
function stripQuoted(text) {
  let out = '';
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (ch !== '"' && ch !== '\'') {
      out += ch;
      i += 1;
      continue;
    }
    const triple = text.startsWith(ch.repeat(3), i);
    let j = i + (triple ? 3 : 1);
    while (j < n) {
      const c = text[j];
      if (c === '\\') { j += 2; continue; }
      if (!triple && c === '\n') break;
      if (c === ch && (!triple || text.startsWith(ch.repeat(3), j))) { j += triple ? 3 : 1; break; }
      j += 1;
    }
    out += '""';
    i = Math.min(j, n);
  }
  return out;
}

export function isPromptTemplate(code) {
  const text = stripQuoted(String(code || ''));
  return PROMPT_LINE_MARKER.test(text) || (ALPACA_INSTRUCTION.test(text) && ALPACA_RESPONSE.test(text));
}

export function guessCodeLanguage(code) {
  const text = String(code || '');
  if (isPromptTemplate(text)) return '';
  if (/^\s*(?:import [\w.]+(?: as \w+)?|from [\w.]+ import |def \w+\(.*\):|class \w+(?:\(.*\))?:)\s*$/m.test(text)) return 'python';
  if (/^\s*(?:\$ )?(?:pip|conda|git|python3?|bash|sh|cd|export) \S/m.test(text) && !/[;{}]\s*$/m.test(text)) return 'bash';
  if (/^\s*#include\s*[<"]/m.test(text)) return 'cpp';
  if (/^\s*(?:const|let|function) \w+/m.test(text) && /[;{}]\s*$/m.test(text)) return 'javascript';
  if (/^\s*[{[]/.test(text)) {
    try {
      JSON.parse(text);
      return 'json';
    } catch {
      /* not json */
    }
  }
  return '';
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
    if (ids.some((id) => mathMap.get(id)?.isBlock)) return false;
  }
  return true;
}

function tableToGfm(table, turndownService, mathMap) {
  // R1-03：单元格里公式含 |（如 $|\Theta|$）不再整表回退 HTML；公式在后面才还原，
  // 这里先把它的 | 转义成 \|（GFM 表格解析会先去掉这个反斜杠，渲染结果不变）
  if (mathMap) {
    const ids = table.textContent.match(/MATH(?:INLINE|BLOCK)START\d+MATH(?:INLINE|BLOCK)END/g) || [];
    ids.forEach((id) => {
      const entry = mathMap.get(id);
      if (entry && entry.latex && entry.latex.includes('|') && !entry.pipeEscaped) {
        entry.latex = entry.latex.replace(/\|/g, '\\|');
        entry.pipeEscaped = true;
      }
    });
  }
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
