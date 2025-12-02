// {{RIPER-7 Action}}
// Role: LD | Task_ID: #6 | Time: 2025-12-01T21:18:25+08:00
// Logic: Content Script - 在 arXiv 页面注入功能，提取元数据，触发转换
// Principle: SOLID-S (Single Responsibility - 页面交互)

import metadataExtractor from '@core/metadata-extractor';
import logger from '@utils/logger';
import { REGEX } from '@config/constants';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

logger.info('Content script loaded on:', window.location.href);

// 检查是否在 arXiv 页面
const isArxivAbsPage = REGEX.ARXIV_ABS_PAGE.test(window.location.href);
const isArxivPdfPage = REGEX.ARXIV_PDF_PAGE.test(window.location.href);

if (!isArxivAbsPage && !isArxivPdfPage) {
  logger.warn('Not an arXiv page, exiting');
} else {
  init();
}

/**
 * 初始化
 */
function init() {
  logger.debug('Initializing content script');
  
  // 注入转换按钮
  injectConvertButton();
  
  // 监听来自 Background 的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    logger.debug('Content script received message:', message);
    
    switch (message.type) {
    case 'TRIGGER_CONVERSION':
      handleConversionTrigger();
      break;
      
    case 'CONVERSION_PROGRESS':
      updateProgressUI(message.data);
      break;
      
    case 'CONVERT_HTML_TO_MARKDOWN':
      // 在真实浏览器环境中执行 HTML → Markdown 转换
      handleHtmlToMarkdown(message.data, sendResponse);
      return true; // 保持消息通道打开以异步响应
      
    case 'DOWNLOAD_FILE':
      // 在页面环境中执行文件下载（使用 <a> download 属性）
      handleFileDownload(message.data, sendResponse);
      return true; // 保持消息通道打开以异步响应
    }
    
    sendResponse({ received: true });
  });
}

/**
 * 注入"保存为 Markdown"按钮到页面
 */
function injectConvertButton() {
  if (!isArxivAbsPage) return; // 只在 Abstract 页面注入
  
  // 查找 PDF 下载链接位置
  const pdfLink = document.querySelector('a[href^="/pdf"]');
  if (!pdfLink) {
    logger.warn('PDF link not found, cannot inject button');
    return;
  }
  
  // 创建按钮容器
  const container = document.createElement('div');
  container.className = 'arxiv-md-button-container';
  container.style.cssText = `
    display: inline-block;
    margin-left: 10px;
  `;
  
  // 创建按钮
  const button = document.createElement('button');
  button.className = 'arxiv-md-convert-btn';
  button.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="vertical-align: -2px; margin-right: 4px;">
      <path d="M8.5 1.5A1.5 1.5 0 0 0 7 0H3.5A1.5 1.5 0 0 0 2 1.5v13A1.5 1.5 0 0 0 3.5 16h9a1.5 1.5 0 0 0 1.5-1.5V7L8.5 1.5z"/>
      <path d="M8 1v5.5A1.5 1.5 0 0 0 9.5 8H15"/>
    </svg>
    保存为 Markdown
  `;
  button.style.cssText = `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  `;
  
  button.addEventListener('mouseenter', () => {
    button.style.transform = 'translateY(-2px)';
    button.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
  });
  
  button.addEventListener('mouseleave', () => {
    button.style.transform = 'translateY(0)';
    button.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
  });
  
  button.addEventListener('click', handleConversionTrigger);
  
  // 创建进度指示器（初始隐藏）
  const progressIndicator = document.createElement('div');
  progressIndicator.className = 'arxiv-md-progress';
  progressIndicator.style.cssText = `
    display: none;
    margin-left: 10px;
    padding: 8px 16px;
    background: #f0f0f0;
    border-radius: 6px;
    font-size: 13px;
    color: #555;
  `;
  progressIndicator.innerHTML = `
    <span class="progress-text">正在转换...</span>
    <span class="progress-percent" style="margin-left: 8px; font-weight: 500;">0%</span>
  `;
  
  container.appendChild(button);
  container.appendChild(progressIndicator);
  
  // 插入到 PDF 链接后面
  pdfLink.parentElement.insertBefore(container, pdfLink.nextSibling);
  
  logger.info('Convert button injected');
}

/**
 * 处理转换触发
 */
async function handleConversionTrigger() {
  console.log('[CONTENT] 🎯 转换触发!');
  logger.info('Conversion triggered');
  
  try {
    // 更新 UI
    const button = document.querySelector('.arxiv-md-convert-btn');
    const progressIndicator = document.querySelector('.arxiv-md-progress');
    
    if (button) {
      button.disabled = true;
      button.style.opacity = '0.5';
      button.style.cursor = 'not-allowed';
    }
    
    if (progressIndicator) {
      progressIndicator.style.display = 'inline-block';
    }
    
    // 提取元数据
    console.log('[CONTENT] 📖 提取元数据...');
    const metadata = isArxivAbsPage
      ? metadataExtractor.extractFromAbsPage()
      : await fetchMetadataFromAbsPage();
    
    console.log('[CONTENT] ✅ 元数据提取完成:', metadata);
    logger.debug('Extracted metadata:', metadata);
    
    // 发送转换请求到 Background
    console.log('[CONTENT] 📤 发送转换请求到 Background...');
    chrome.runtime.sendMessage(
      {
        type: 'CONVERT_PAPER',
        data: metadata
      },
      (response) => {
        console.log('[CONTENT] 📥 收到响应:', response);
        logger.debug('Conversion response:', response);
        
        // 恢复按钮状态
        if (button) {
          button.disabled = false;
          button.style.opacity = '1';
          button.style.cursor = 'pointer';
        }
        
        if (progressIndicator) {
          progressIndicator.style.display = 'none';
        }
        
        if (response && response.success) {
          // 显示成功提示
          showSuccessToast(response.data);
        } else {
          // 显示错误提示
          showErrorToast(response?.error || 'Unknown error');
        }
      }
    );
    
  } catch (error) {
    logger.error('Conversion trigger failed:', error);
    showErrorToast(error.message);
  }
}

/**
 * 从 Abstract 页面获取完整元数据（用于 PDF 页面）
 */
async function fetchMetadataFromAbsPage() {
  const arxivId = metadataExtractor._extractIdFromUrl(window.location.href);
  
  if (!arxivId) {
    throw new Error('Cannot extract arXiv ID');
  }
  
  // 使用 API 获取
  return await metadataExtractor.fetchMetadataFromApi(arxivId);
}

/**
 * 更新进度 UI
 */
function updateProgressUI(progress) {
  console.log('[CONTENT] 📊 更新进度 UI:', progress);
  const progressIndicator = document.querySelector('.arxiv-md-progress');
  if (!progressIndicator) {
    console.warn('[CONTENT] ⚠️ 未找到进度指示器元素');
    return;
  }
  
  const textEl = progressIndicator.querySelector('.progress-text');
  const percentEl = progressIndicator.querySelector('.progress-percent');
  
  if (textEl && percentEl) {
    const stageText = {
      'checking': '检查 ar5iv...',
      'downloading': '下载 PDF...',
      'uploading': '上传到 MinerU...',
      'processing': 'MinerU 解析中...',
      'completed': '完成!'
    };
    
    const text = stageText[progress.stage] || '处理中...';
    const percent = Math.round(progress.progress || 0);
    
    textEl.textContent = text;
    percentEl.textContent = `${percent}%`;
    console.log(`[CONTENT] ✅ UI 更新: ${text} ${percent}%`);
  } else {
    console.warn('[CONTENT] ⚠️ 未找到进度文本或百分比元素');
  }
}

/**
 * 显示成功提示
 */
function showSuccessToast(result) {
  const toast = createToast(
    '✅ 转换成功',
    `已保存：${result.filename}`,
    'success'
  );
  document.body.appendChild(toast);
  
  setTimeout(() => toast.remove(), 5000);
}

/**
 * 显示错误提示
 */
function showErrorToast(message) {
  const toast = createToast(
    '❌ 转换失败',
    message,
    'error'
  );
  document.body.appendChild(toast);
  
  setTimeout(() => toast.remove(), 5000);
}

/**
 * 创建 Toast 通知
 */
function createToast(title, message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `arxiv-md-toast arxiv-md-toast-${type}`;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: white;
    padding: 16px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    max-width: 400px;
    animation: slideIn 0.3s ease-out;
  `;
  
  if (type === 'success') {
    toast.style.borderLeft = '4px solid #10b981';
  } else if (type === 'error') {
    toast.style.borderLeft = '4px solid #ef4444';
  }
  
  toast.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 4px;">${title}</div>
    <div style="font-size: 13px; color: #666;">${message}</div>
  `;
  
  // 添加动画
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
  
  return toast;
}

/**
 * 判断数学公式是否为块级公式
 * @param {Element} mathEl - math 元素
 * @param {string} latex - LaTeX 内容
 * @returns {boolean}
 */
function isBlockFormula(mathEl, latex) {
  // 1. 显式 display="block" 属性
  const displayAttr = mathEl.getAttribute('display');
  if (displayAttr === 'block') return true;
  
  // 2. 在方程式容器中（ar5iv 特有的 class）
  const equationContainer = mathEl.closest('.ltx_equation, .ltx_equationgroup, .ltx_eqn_table, .ltx_eqn_row');
  if (equationContainer) return true;
  
  // 3. LaTeX 内容包含 \displaystyle 命令（说明原本是块级公式）
  if (latex.includes('\\displaystyle')) return true;
  
  // 4. LaTeX 内容是多行公式（包含 \\ 换行或 aligned/array 环境）
  if (latex.includes('\\\\') || 
      latex.includes('\\begin{aligned}') || 
      latex.includes('\\begin{array}') ||
      latex.includes('\\begin{cases}')) {
    return true;
  }
  
  // 5. 在独立段落中（父元素是 p 或 div，且只有这一个 math 子元素）
  const parent = mathEl.parentElement;
  if (parent && (parent.tagName === 'P' || parent.tagName === 'DIV')) {
    const childElements = Array.from(parent.children);
    if (childElements.length === 1 && childElements[0] === mathEl) {
      return true;
    }
  }
  
  return false;
}

/**
 * 预处理：提取并替换所有数学公式元素
 * @param {Document} doc - DOM 文档
 * @returns {Object} {doc, mathMap} - 清理后的文档和公式映射
 */
function preprocessMathElements(doc) {
  const mathMap = new Map();
  let mathCounter = 0;
  let blockCount = 0;
  let inlineCount = 0;
  
  // 使用不会被 Turndown 转义的占位符格式（纯字母数字）
  // Turndown 会转义下划线，所以使用 MATHPLACEHOLDER 格式
  const createPlaceholder = (id, isBlock) => {
    return isBlock ? `MATHBLOCKSTART${id}MATHBLOCKEND` : `MATHINLINESTART${id}MATHINLINEEND`;
  };
  
  // 1. 处理所有 <math> 标签（ar5iv 使用 alttext 属性存储 LaTeX）
  const mathElements = doc.querySelectorAll('math');
  mathElements.forEach((mathEl) => {
    // ar5iv 将 LaTeX 存储在 alttext 属性中
    const alttext = mathEl.getAttribute('alttext');
    
    if (alttext) {
      let latex = alttext.trim();
      
      // 判断是否为块级公式
      const isBlock = isBlockFormula(mathEl, latex);
      
      // 如果是块级公式，移除开头的 \displaystyle（会在块级公式中自动应用）
      if (isBlock && latex.startsWith('\\displaystyle')) {
        latex = latex.replace(/^\\displaystyle\s*/, '');
      }
      
      // 创建占位符
      const placeholder = createPlaceholder(mathCounter, isBlock);
      mathMap.set(placeholder, { latex, isBlock });
      mathCounter++;
      
      if (isBlock) blockCount++;
      else inlineCount++;
      
      // 替换整个 math 元素为占位符
      const textNode = doc.createTextNode(placeholder);
      mathEl.replaceWith(textNode);
    } else {
      // 没有 alttext 属性，尝试从 annotation 标签获取（兼容其他格式）
      const annotation = mathEl.querySelector('annotation[encoding="application/x-tex"]');
      if (annotation && annotation.textContent) {
        let latex = annotation.textContent.trim();
        const isBlock = isBlockFormula(mathEl, latex);
        
        if (isBlock && latex.startsWith('\\displaystyle')) {
          latex = latex.replace(/^\\displaystyle\s*/, '');
        }
        
        const placeholder = createPlaceholder(mathCounter, isBlock);
        mathMap.set(placeholder, { latex, isBlock });
        mathCounter++;
        
        if (isBlock) blockCount++;
        else inlineCount++;
        
        const textNode = doc.createTextNode(placeholder);
        mathEl.replaceWith(textNode);
      } else {
        // 没有 LaTeX 源码，直接移除
        mathEl.remove();
      }
    }
  });
  
  // 2. 清理残留的 MathML 标签
  const mathMLTags = ['semantics', 'mrow', 'mi', 'mo', 'mn', 'msub', 'msup', 'mfrac', 'msqrt', 'mtext', 
                      'annotation-xml', 'annotation', 'apply', 'csymbol', 'ci', 'cn'];
  mathMLTags.forEach(tag => {
    doc.querySelectorAll(tag).forEach(el => el.remove());
  });
  
  console.log(`[PREPROCESS] ✅ 提取了 ${mathCounter} 个数学公式 (块级: ${blockCount}, 行内: ${inlineCount})`);
  return { doc, mathMap };
}

/**
 * 预处理：清理作者和元数据格式问题
 * @param {Document} doc - DOM 文档
 */
function preprocessAuthorsAndMetadata(doc) {
  // 1. 移除 \AND 错误标记
  doc.querySelectorAll('.ltx_ERROR').forEach(el => {
    if (el.textContent.includes('\\AND')) {
      el.remove();
    }
  });
  
  // 2. 清理脚注标记
  doc.querySelectorAll('.ltx_note_mark, sup.ltx_note_mark').forEach(el => {
    // 保留数字，但移除"footnotemark:"文本
    const text = el.textContent.replace(/footnotemark:\s*/g, '').trim();
    if (text) {
      el.textContent = text;
    }
  });
  
  // 3. 清理脚注内容（避免重复显示）
  doc.querySelectorAll('.ltx_note_content').forEach(el => {
    el.remove();
  });
  
  // 4. 清理作者分隔符（&符号后添加换行）
  doc.querySelectorAll('.ltx_personname').forEach(el => {
    const html = el.innerHTML;
    // 将 &Name 替换为换行 + Name
    el.innerHTML = html.replace(/&amp;/g, '\n\n');
  });
  
  console.log(`[PREPROCESS] ✅ 清理作者和元数据格式`);
}

/**
 * 预处理：简化复杂表格
 * @param {Document} doc - DOM 文档
 */
function preprocessTables(doc) {
  const tables = doc.querySelectorAll('table');
  let equationTables = 0;
  let dataTables = 0;
  
  tables.forEach((table) => {
    // 检查是否为方程式表格（ar5iv 使用 table 排版多行公式）
    const isEquationTable = table.classList.contains('ltx_eqn_table') ||
                            table.classList.contains('ltx_equation') ||
                            table.closest('.ltx_equation, .ltx_equationgroup') !== null;
    
    // 检查是否包含数学公式占位符
    const hasMathPlaceholder = table.textContent.includes('MATHBLOCK') || 
                               table.textContent.includes('MATHINLINE');
    
    if (isEquationTable || hasMathPlaceholder) {
      equationTables++;
      
      // 这是方程式表格，提取所有公式占位符，每个独立成行
      const placeholders = table.textContent.match(/MATHBLOCKSTART\d+MATHBLOCKEND|MATHINLINESTART\d+MATHINLINEEND/g) || [];
      
      if (placeholders.length > 0) {
        // 用换行分隔多个公式
        const text = placeholders.join('\n\n');
        const textNode = doc.createTextNode(`\n\n${text}\n\n`);
        table.replaceWith(textNode);
        return;
      }
      
      // 如果没有占位符但是方程式表格，提取纯文本
      const text = table.textContent.replace(/\s+/g, ' ').trim();
      if (text) {
        const textNode = doc.createTextNode(`\n\n${text}\n\n`);
        table.replaceWith(textNode);
        return;
      }
      
      table.remove();
      return;
    }
    
    // 检查是否为简单的公式布局表格（小表格，主要包含公式）
    const rows = table.querySelectorAll('tr');
    const cells = table.querySelectorAll('td, th');
    if (rows.length <= 3 && cells.length <= 6) {
      const text = table.textContent.trim();
      if (text.includes('MATH') || text.includes('=')) {
        equationTables++;
        const textNode = doc.createTextNode(`\n\n${text.replace(/\s+/g, ' ')}\n\n`);
        table.replaceWith(textNode);
        return;
      }
    }
    
    // 对于数据表格，保留但简化属性
    dataTables++;
    table.removeAttribute('id');
    table.removeAttribute('style');
    // 保留 class 以便识别表格类型
    
    // 简化单元格
    cells.forEach(cell => {
      cell.removeAttribute('id');
      cell.removeAttribute('style');
      // 保留 class, rowspan, colspan
    });
  });
  
  console.log(`[PREPROCESS] ✅ 处理了 ${tables.length} 个表格 (方程式表格: ${equationTables}, 数据表格: ${dataTables})`);
}

/**
 * 预处理：修复列表格式问题
 * @param {Document} doc - DOM 文档
 */
function preprocessLists(doc) {
  // ar5iv 的列表项可能有重复的项目符号
  doc.querySelectorAll('li').forEach(li => {
    // 移除开头的孤立 • 符号
    const textNodes = Array.from(li.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
    textNodes.forEach(node => {
      if (node.textContent.trim() === '•') {
        node.remove();
      }
    });
  });
  
  console.log(`[PREPROCESS] ✅ 清理列表格式`);
}

/**
 * 移除所有 MathML 相关元素
 * @param {Document} doc - DOM 文档
 */
function removeMathMLArtifacts(doc) {
  // 移除所有可能残留的 MathML 命名空间元素
  const mathMLSelectors = [
    'math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msub', 'msup', 
    'mfrac', 'msqrt', 'mtext', 'annotation-xml', 'annotation'
  ];
  
  mathMLSelectors.forEach(selector => {
    doc.querySelectorAll(selector).forEach(el => {
      // 保留文本内容（如果有）
      if (el.textContent && !el.querySelector('annotation')) {
        const text = el.textContent.trim();
        if (text) {
          el.replaceWith(doc.createTextNode(text));
        } else {
          el.remove();
        }
      } else {
        el.remove();
      }
    });
  });
  
  console.log(`[PREPROCESS] ✅ 清理 MathML 残留`);
}

/**
 * 恢复数学公式占位符
 * @param {string} markdown - Markdown 文本
 * @param {Map} mathMap - 公式映射
 * @returns {string} 恢复公式后的 Markdown
 */
function restoreMathPlaceholders(markdown, mathMap) {
  let result = markdown;
  let restoredCount = 0;
  let blockRestoredCount = 0;
  let inlineRestoredCount = 0;
  
  mathMap.forEach((value, placeholder) => {
    const { latex, isBlock } = value;
    
    // 占位符格式: MATHBLOCKSTART{id}MATHBLOCKEND 或 MATHINLINESTART{id}MATHINLINEEND
    // 这些纯字母数字的占位符不会被 Turndown 转义
    const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedPlaceholder, 'g');
    
    const beforeLength = result.length;
    
    if (isBlock) {
      // 块级公式：使用 $$ 包裹
      // 格式：$$\nlatex\n$$ 确保正确渲染
      const formattedLatex = latex.trim();
      result = result.replace(regex, `$$${formattedLatex}$$`);
      
      if (result.length !== beforeLength) {
        blockRestoredCount++;
      }
    } else {
      // 行内公式：使用 $ 包裹
      result = result.replace(regex, `$${latex}$`);
      
      if (result.length !== beforeLength) {
        inlineRestoredCount++;
      }
    }
    
    if (result.length !== beforeLength) {
      restoredCount++;
    }
  });
  
  console.log(`[POSTPROCESS] ✅ 恢复了 ${restoredCount}/${mathMap.size} 个数学公式 (块级: ${blockRestoredCount}, 行内: ${inlineRestoredCount})`);
  return result;
}

/**
 * 后处理 Markdown - 清理转换问题
 * @param {string} markdown - 原始 Markdown
 * @returns {string} 清理后的 Markdown
 */
function postProcessMarkdown(markdown) {
  let result = markdown;
  
  // 1. 【关键】恢复被转义的引用方括号
  // Turndown 会将 [1, 2, 3] 转义为 \[1, 2, 3\]
  // 引用格式通常是 [数字] 或 [数字, 数字, ...]
  result = result.replace(/\\\[(\d+(?:\s*,\s*\d+)*)\\\]/g, '[$1]');
  
  // 2. 清理重复的数学表达式（Unicode + LaTeX）
  result = result
    .replace(/([a-zA-Z]+)([\u{1D400}-\u{1D7FF}]+)\1\{([^}]+)\}/gu, '$$1_{$3}$')
    .replace(/([a-zA-Z]+)([\u{1D400}-\u{1D7FF}]+)\1\^\{([^}]+)\}/gu, '$$1^{$3}$');
  
  // 3. 移除孤立的 Unicode 数学符号（与普通字母重复）
  result = result.replace(/([a-zA-Z])([\u{1D400}-\u{1D7FF}]+)(\d)/gu, '$1$3');
  
  // 4. 清理错误的脚标文本
  result = result
    .replace(/\bsubscript\b/gi, '')
    .replace(/\bsuperscript\b/gi, '');
  
  // 5. 清理脚注标记错误
  result = result
    .replace(/\d+footnotemark:\s*\d+/g, '')
    .replace(/footnotemark:\s*/g, '');
  
  // 6. 清理重复的项目符号
  result = result.replace(/^(\s*-\s*)•\s*/gm, '$1');
  
  // 7. 修复表格中的空单元格
  result = result.replace(/\|\s*\|\s*\|/g, '| |');
  
  // 8. 清理行首行尾空格
  result = result.replace(/[ \t]+$/gm, '');
  
  // 9. 移除 HTML 实体残留
  result = result
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');
  
  // 10. 清理错误的 LaTeX 命令残留
  result = result
    .replace(/\\\\AND/g, '')
    .replace(/\\AND/g, '');
  
  // 11. 【关键】修复连续的行内公式
  // 情况: $formula1$$formula2$ 应该变成 $formula1$ $formula2$
  // 但要避免误伤块级公式 $$...$$
  // 策略：先保护块级公式，再修复连续行内公式，最后恢复块级公式
  
  // 临时替换块级公式分隔符
  result = result.replace(/\$\$([^$]+)\$\$/g, 'DOUBLEDOLLARSTART$1DOUBLEDOLLAREND');
  
  // 修复连续的行内公式 $a$$b$ -> $a$ $b$
  result = result.replace(/\$([^$]+)\$\$([^$]+)\$/g, '$$$1$ $$$2$');
  
  // 恢复块级公式，并确保正确格式化
  result = result.replace(/DOUBLEDOLLARSTART([^]*?)DOUBLEDOLLAREND/g, (match, content) => {
    const trimmedContent = content.trim();
    return `\n\n$$\n${trimmedContent}\n$$\n\n`;
  });
  
  // 12. 清理多余空行
  result = result.replace(/\n{4,}/g, '\n\n\n');
  
  // 13. 最终清理：移除明显的 HTML/XML 标签残留
  result = result.replace(/<\/?[a-z][^>]*>/gi, '');
  
  return result;
}

/**
 * 处理文件下载（使用 <a> download 属性，类似 UserScript）
 * @param {Object} data - {content: string, filename: string, mimeType: string}
 * @param {Function} sendResponse - 响应回调
 */
function handleFileDownload(data, sendResponse) {
  console.log('[CONTENT] 📥 开始下载文件...');
  console.log('[CONTENT] 📄 文件名:', data.filename);
  console.log('[CONTENT] 📦 内容大小:', data.content.length, 'bytes');
  
  try {
    // 创建 Blob
    const blob = new Blob([data.content], { type: data.mimeType || 'text/plain' });
    console.log('[CONTENT] ✅ Blob 创建成功');
    
    // 创建 Object URL（这个在页面环境中可以使用）
    const url = window.URL.createObjectURL(blob);
    console.log('[CONTENT] ✅ Object URL 创建成功');
    
    // 创建隐藏的 <a> 标签
    const a = document.createElement('a');
    a.href = url;
    a.download = data.filename;  // 设置下载文件名
    a.style.display = 'none';
    
    // 添加到 DOM 并触发点击
    document.body.appendChild(a);
    console.log('[CONTENT] 🖱️ 触发下载点击...');
    a.click();
    
    // 清理
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      console.log('[CONTENT] 🧹 清理完成');
    }, 100);
    
    console.log('[CONTENT] ✅ 下载成功触发!');
    sendResponse({ success: true });
    
  } catch (error) {
    console.error('[CONTENT] ❌ 下载失败:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 处理 HTML → Markdown 转换（在真实浏览器环境中）
 * @param {Object} data - {html: string, title: string}
 * @param {Function} sendResponse - 响应回调
 */
function handleHtmlToMarkdown(data, sendResponse) {
  console.log('[CONTENT] 🔄 开始 HTML → Markdown 转换...');
  
  try {
    // === 第一步：解析 HTML 为 DOM ===
    console.log('[CONTENT] 📄 解析 HTML 为 DOM...');
    const parser = new DOMParser();
    const doc = parser.parseFromString(data.html, 'text/html');
    
    // === 第二步：预处理 - 清理作者和元数据 ===
    console.log('[CONTENT] 👥 预处理：清理作者和元数据...');
    preprocessAuthorsAndMetadata(doc);
    
    // === 第三步：预处理 - 提取数学公式 ===
    console.log('[CONTENT] 🔢 预处理：提取数学公式...');
    const { doc: cleanedDoc, mathMap } = preprocessMathElements(doc);
    
    // === 第四步：预处理 - 修复列表格式 ===
    console.log('[CONTENT] 📝 预处理：修复列表格式...');
    preprocessLists(cleanedDoc);
    
    // === 第五步：预处理 - 简化表格 ===
    console.log('[CONTENT] 📊 预处理：简化表格...');
    preprocessTables(cleanedDoc);
    
    // === 第六步：移除残留的 MathML 标记 ===
    console.log('[CONTENT] 🧹 清理 MathML 残留...');
    removeMathMLArtifacts(cleanedDoc);
    
    // === 第七步：初始化 Turndown 并转换 ===
    console.log('[CONTENT] 📝 Turndown 转换...');
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      emDelimiter: '*',
      strongDelimiter: '**'
    });
    
    // 启用 GFM 插件（表格、删除线等）
    turndownService.use(gfm);
    
    // 自定义规则：处理图片
    turndownService.addRule('arxivImages', {
      filter: 'img',
      replacement: (content, node) => {
        const alt = node.alt || 'image';
        let src = node.getAttribute('src') || '';
        
        // 清理错误的 chrome-extension URL
        src = src.replace(/chrome-extension:\/\/[^/]+\//, '');
        
        // 处理相对路径 - 统一使用 ar5iv.org 域名
        if (src && !src.startsWith('http')) {
          const cleanSrc = src.startsWith('/') ? src.substring(1) : src;
          src = `https://ar5iv.org/${cleanSrc}`;
        }
        
        return src ? `![${alt}](${src})` : '';
      }
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
          if (node.classList && (node.classList.contains('ltx_ref') || node.classList.contains('ltx_cite'))) {
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
      }
    });
    
    // 自定义规则：处理 ar5iv 的脚注
    turndownService.addRule('footnotes', {
      filter: (node) => {
        if (node.classList) {
          return node.classList.contains('ltx_note') ||
                 node.classList.contains('ltx_note_mark') ||
                 node.classList.contains('ltx_note_content');
        }
        return false;
      },
      replacement: (content, node) => {
        // 脚注标记：返回上标数字
        if (node.classList.contains('ltx_note_mark')) {
          const num = content.replace(/[^\d]/g, '');
          return num ? `^${num}` : '';
        }
        // 脚注内容：在后处理中会被移除
        if (node.classList.contains('ltx_note_content')) {
          return '';
        }
        return content;
      }
    });
    
    // 执行 Turndown 转换
    let markdown = turndownService.turndown(cleanedDoc.body.innerHTML);
    
    // === 第八步：恢复数学公式占位符 ===
    console.log('[CONTENT] 🔢 恢复数学公式...');
    markdown = restoreMathPlaceholders(markdown, mathMap);
    
    // === 第九步：后处理清理 ===
    console.log('[CONTENT] 🧹 后处理清理...');
    markdown = postProcessMarkdown(markdown);
    
    console.log('[CONTENT] ✅ Markdown 转换完成:', markdown.length, 'bytes');
    console.log('[CONTENT] ✅ 处理了', mathMap.size, '个数学公式');
    
    sendResponse({
      success: true,
      markdown: markdown
    });
    
  } catch (error) {
    console.error('[CONTENT] ❌ Markdown 转换失败:', error);
    console.error(error.stack);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

