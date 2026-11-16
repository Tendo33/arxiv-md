import { copyChildren, replaceInTextNodes } from '@utils/dom';
import logger from '@utils/logger';

// 只承载机构名的作者条目（"Stanford University  CZ Biohub" 之类）：
// 删掉脚注角标后，文字里出现机构词且没有个人姓名的痕迹
const AFFILIATION_ONLY_RE = /^[\d\s]*(?:.*\b(?:University|Universität|Institute|Institution|Laborator(?:y|ies)|Department|Dept\.?|School|College|Academy|Research|Center|Centre|Biohub|Inc\.?|Corp\.?|Ltd\.?|GmbH|LLC)\b)/i;

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

  // 作者行：ar5iv 把 affiliation 和 "Equal contribution / Corresponding author"
  // 也塞进作者流里，直接转出来会变成
  // "Xuan Ouyang   Zefan Cai   Chenlong Zhang Affiliation: UW-Madison   …   \*Equal contribution"。
  // 这三类节点对阅读没价值（单位信息另有元数据），在转 Markdown 前去掉。
  doc.querySelectorAll('.ltx_authors .ltx_author_notes, .ltx_authors .ltx_role_affiliation').forEach((el) => el.remove());
  doc.querySelectorAll('.ltx_creator').forEach((el) => {
    const person = el.querySelector('.ltx_personname');
    if (!person) return;
    // 没有人物名的 creator 条目只承载单位/邮箱（如 DPO 的 "Stanford University  CZ Biohub"）。
    // 判据要收窄：只有当 personname 以脚注角标开头、且去掉角标后只剩机构名时才删，
    // 否则会把 <span> 包着的真实姓名（<span class="ltx_text">Ada Lovelace</span>）一起删掉。
    const firstMeaningful = Array.from(person.childNodes)
      .find((n) => n.nodeType !== 3 || n.textContent.trim());
    const startsWithNote = firstMeaningful
      && firstMeaningful.nodeType === 1
      && firstMeaningful.classList.contains('ltx_note');
    if (startsWithNote) {
      const text = person.textContent.replace(/\s+/g, ' ').trim();
      if (AFFILIATION_ONLY_RE.test(text)) {
        el.remove();
        return;
      }
    }
    const label = person.textContent.replace(/^[\s*†‡]+|[\s*†‡]+$/g, '');
    if (/^(Equal contribution|Corresponding author|These authors)/i.test(label)) {
      el.remove();
    }
  });
  // 作者名字前后常有换行/多空格，留着会变成 "Name ,"；统一压成单个空格
  doc.querySelectorAll('.ltx_personname').forEach((el) => {
    replaceInTextNodes(el, /^\s+|\s+$/g, '');
  });
  // 作者容器里 span 之间的换行文本节点会被 Turndown 折成一个空格，
  // 于是 "Name" + ", " 变成 "Name , "。这些节点本身没有语义，直接删。
  doc.querySelectorAll('.ltx_authors').forEach((authors) => {
    Array.from(authors.childNodes).forEach((node) => {
      if (node.nodeType === 3 && !node.textContent.trim()) node.remove();
    });
  });
  // 分隔符改成 ", "；紧跟被删掉的 "Equal contribution" 的那个是尾随逗号，直接去掉
  doc.querySelectorAll('.ltx_author_before').forEach((el) => {
    let next = el.nextElementSibling;
    while (next && !next.classList.contains('ltx_creator')) next = next.nextElementSibling;
    if (next) el.textContent = ', ';
    else el.remove();
  });

  // 清理作者分隔符：作者流里的 "Stefan Schoepf & Alexandra Brintrup" 是同一条作者行里的
  // 两个人，换成 ", "；独立出现的 personname（AR-04 场景）仍换成空行。
  doc.querySelectorAll('.ltx_personname').forEach((el) => {
    const inAuthors = el.closest('.ltx_authors') !== null;
    replaceInTextNodes(el, /&/g, inAuthors ? ', ' : '\n\n');
  });
}

/**
 * 预处理：处理 ar5iv 表格
 * 方程式表格 (.ltx_eqn_table) 用于排版多行公式
 * 数据表格 (.ltx_tabular) 是实际数据表格
 *
 * 方程表在 arXiv HTML 里是「每行一个 <tr>，左右两半各在一个 <td> 的 <math> 里」，
 * 直接按占位符摊平会把一条多行公式切成 4 个独立的 $$…$$（见 2611.07226 Eq. 6）。
 * 这里按 tr 分组还原成一条 display 公式：多行包 \begin{aligned}，编号写成 \qquad(6)。
 */
export function preprocessTables(doc, mathMap) {
  // 表格单元格里的块级公式：单元格内不可能放 display 公式，降级成行内，
  // 否则整张表被迫回退成 HTML，而 GitHub / Obsidian 不在 HTML 块里解析 $…$。
  if (mathMap) demoteBlockMathInTableCells(doc, mathMap);

  doc.querySelectorAll('table').forEach((table) => {
    const isEquationTable =
      table.classList.contains('ltx_eqn_table') ||
      table.classList.contains('ltx_eqn_row') ||
      table.closest('.ltx_equation, .ltx_equationgroup') !== null;
    const hasMathPlaceholder =
      table.textContent.includes('MATHBLOCK') ||
      table.textContent.includes('MATHINLINE');

    if (isEquationTable) {
      if (mathMap) {
        const merged = mergeEquationRows(table, mathMap);
        if (merged) {
          table.replaceWith(doc.createTextNode(`\n\n${merged}\n\n`));
          return;
        }
      }
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
            copyChildren(td, th);
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

const MATH_PLACEHOLDER_RE = /MATHBLOCKSTART(\d+)MATHBLOCKEND|MATHINLINESTART(\d+)MATHINLINEEND/g;

function nextMathId(mathMap) {
  let max = -1;
  mathMap.forEach((_, key) => {
    const m = /MATH(?:BLOCK|INLINE)START(\d+)MATH/.exec(key);
    if (m) max = Math.max(max, Number(m[1]));
  });
  return max + 1;
}

/**
 * 表格单元格里的公式降级为行内。display 公式塞进 <td> 是非法的，而且会让整张表
 * 回退成 HTML（GitHub / Obsidian 都不在 HTML 块里解析 $…$）。
 */
function demoteBlockMathInTableCells(doc, mathMap) {
  doc.querySelectorAll('table').forEach((table) => {
    const isEquationTable =
      table.classList.contains('ltx_eqn_table') ||
      table.classList.contains('ltx_eqn_row') ||
      table.closest('.ltx_equation, .ltx_equationgroup') !== null;
    if (isEquationTable) return;

    table.querySelectorAll('td, th').forEach((cell) => {
      const ids = (cell.textContent.match(MATH_PLACEHOLDER_RE) || []);
      ids.forEach((key) => {
        const entry = mathMap.get(key);
        if (!entry || !entry.isBlock) return;
        entry.isBlock = false;
        // 单元格里的分式用 \dfrac 才不会被压成小号。
        // 一次匹配可选的 d 前缀：\dfrac 原样保留，\frac 升级成 \dfrac
        // （不能用 (?<!d) 排除，它看的是反斜杠前一个字符，会误伤 "2d\frac"）。
        entry.latex = entry.latex.replace(/\\d?frac(?![a-zA-Z])/g, '\\dfrac');
      });
    });
  });
}

/**
 * 把一条方程表（可能多行、左右分列、带编号）还原成一条 display 公式。
 * 返回占位符文本；不能合并时返回 null，交回旧的摊平逻辑。
 */
function mergeEquationRows(table, mathMap) {
  const rows = [];
  table.querySelectorAll('tr').forEach((tr) => {
    const parts = [];
    let number = null;
    let span = 1;

    tr.querySelectorAll('td, th').forEach((cell) => {
      if (cell.classList.contains('ltx_eqn_eqno') || cell.querySelector('.ltx_tag_equation, .ltx_tag_equationgroup')) {
        const tag = cell.querySelector('.ltx_tag_equation, .ltx_tag_equationgroup') || cell;
        const m = /\(([^)]+)\)/.exec(tag.textContent);
        if (m) number = m[1];
        span = parseInt(cell.getAttribute('rowspan') || '1', 10) || 1;
        return;
      }
      const ids = cell.textContent.match(MATH_PLACEHOLDER_RE) || [];
      ids.forEach((key) => {
        const entry = mathMap.get(key);
        if (entry && entry.latex.trim()) parts.push(entry.latex.trim());
      });
    });

    if (parts.length) rows.push({ parts, number, span });
  });

  if (!rows.length) return null;

  const formulas = [];
  for (let i = 0; i < rows.length;) {
    const head = rows[i];
    const group = [head];
    const want = Math.max(1, head.span);
    for (let j = 1; j < want && i + j < rows.length; j += 1) {
      if (rows[i + j].number) break;
      group.push(rows[i + j]);
    }
    formulas.push(buildEquationLatex(group, head.number));
    i += group.length;
  }

  let nextId = nextMathId(mathMap);
  const placeholders = formulas.map((latex) => {
    const key = `MATHBLOCKSTART${nextId}MATHBLOCKEND`;
    mathMap.set(key, { latex, isBlock: true });
    nextId += 1;
    return key;
  });
  return placeholders.join('\n\n');
}

function buildEquationLatex(group, number) {
  const tag = number ? `\\tag{${number}}` : '';
  if (group.length === 1) {
    return `${group[0].parts.join(' ')}${tag}`;
  }

  const lines = group.map((row) => {
    if (row.parts.length === 1) return row.parts[0];
    const [lhs, ...rest] = row.parts;
    const rhs = rest.join('\\quad ');
    return rhs.startsWith('=')
      ? `${lhs} &= ${rhs.replace(/^=\s*/, '')}`
      : `${lhs} & ${rhs}`;
  });
  return `\\begin{aligned}${lines.join(' \\\\ ')}\\end{aligned}${tag}`;
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
