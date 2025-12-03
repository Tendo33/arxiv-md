// Content Script

import metadataExtractor from "@core/metadata-extractor";
import logger from "@utils/logger";
import { REGEX } from "@config/constants";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

logger.info("Content script loaded on:", window.location.href);

// 检查是否在 arXiv 页面
const isArxivAbsPage = REGEX.ARXIV_ABS_PAGE.test(window.location.href);
const isArxivPdfPage = REGEX.ARXIV_PDF_PAGE.test(window.location.href);

if (!isArxivAbsPage && !isArxivPdfPage) {
  logger.warn("Not an arXiv page, exiting");
} else {
  init();
}

function init() {
  logger.debug("Initializing content script");

  // 注入转换按钮
  injectConvertButton();

  // 监听来自 Background 的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    logger.debug("Content script received message:", message);

    switch (message.type) {
      case "TRIGGER_CONVERSION":
        handleConversionTrigger();
        break;

      case "CONVERSION_PROGRESS":
        updateProgressUI(message.data);
        break;

      case "CONVERT_HTML_TO_MARKDOWN":
        // 在真实浏览器环境中执行 HTML → Markdown 转换
        handleHtmlToMarkdown(message.data, sendResponse);
        return true; // 保持消息通道打开以异步响应

      case "DOWNLOAD_FILE":
        // 在页面环境中执行文件下载（使用 <a> download 属性）
        handleFileDownload(message.data, sendResponse);
        return true; // 保持消息通道打开以异步响应
    }

    sendResponse({ received: true });
  });
}

function injectConvertButton() {
  if (!isArxivAbsPage) return; // 只在 Abstract 页面注入

  // 查找 Submission history 板块
  const submissionHistory = document.querySelector(".submission-history");
  if (!submissionHistory) {
    logger.warn("Submission history section not found, cannot inject buttons");
    return;
  }

  // 创建按钮容器
  const container = document.createElement("div");
  container.className = "arxiv-md-button-container";
  container.style.cssText = `
    display: flex;
    gap: 10px;
    margin-top: 15px;
    margin-left: 20px;
    padding-top: 10px;
    border-top: 1px solid #e0e0e0;
    align-items: center;
  `;

  // 创建 Markdown 按钮
  const mdButton = document.createElement("button");
  mdButton.className = "arxiv-md-convert-btn";
  mdButton.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="vertical-align: -2px; margin-right: 4px;">
      <path d="M8.5 1.5A1.5 1.5 0 0 0 7 0H3.5A1.5 1.5 0 0 0 2 1.5v13A1.5 1.5 0 0 0 3.5 16h9a1.5 1.5 0 0 0 1.5-1.5V7L8.5 1.5z"/>
      <path d="M8 1v5.5A1.5 1.5 0 0 0 9.5 8H15"/>
    </svg>
    Save as Markdown
  `;
  mdButton.style.cssText = `
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

  mdButton.addEventListener("mouseenter", () => {
    mdButton.style.transform = "translateY(-2px)";
    mdButton.style.boxShadow = "0 4px 12px rgba(102, 126, 234, 0.4)";
  });

  mdButton.addEventListener("mouseleave", () => {
    mdButton.style.transform = "translateY(0)";
    mdButton.style.boxShadow = "0 2px 8px rgba(102, 126, 234, 0.3)";
  });

  mdButton.addEventListener("click", () => handleConversionTrigger("markdown"));

  // 创建 PDF 按钮
  const pdfButton = document.createElement("button");
  pdfButton.className = "arxiv-pdf-download-btn";
  pdfButton.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="vertical-align: -2px; margin-right: 4px;">
      <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z"/>
      <path d="M8.5 6.5a.5.5 0 0 0-1 0v3.793L6.354 9.146a.5.5 0 1 0-.708.708l2 2a.5.5 0 0 0 .708 0l2-2a.5.5 0 0 0-.708-.708L8.5 10.293V6.5z"/>
    </svg>
    Save PDF (Renamed)
  `;
  pdfButton.style.cssText = `
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
  `;

  pdfButton.addEventListener("mouseenter", () => {
    pdfButton.style.transform = "translateY(-2px)";
    pdfButton.style.boxShadow = "0 4px 12px rgba(245, 158, 11, 0.4)";
  });

  pdfButton.addEventListener("mouseleave", () => {
    pdfButton.style.transform = "translateY(0)";
    pdfButton.style.boxShadow = "0 2px 8px rgba(245, 158, 11, 0.3)";
  });

  pdfButton.addEventListener("click", () => handleConversionTrigger("pdf"));

  // 创建进度指示器（初始隐藏）
  const progressIndicator = document.createElement("div");
  progressIndicator.className = "arxiv-md-progress";
  progressIndicator.style.cssText = `
    display: none;
    padding: 8px 16px;
    background: #f0f0f0;
    border-radius: 6px;
    font-size: 13px;
    color: #555;
  `;
  progressIndicator.innerHTML = `
    <span class="progress-text">Processing...</span>
    <span class="progress-percent" style="margin-left: 8px; font-weight: 500;">0%</span>
  `;

  container.appendChild(mdButton);
  container.appendChild(pdfButton);
  container.appendChild(progressIndicator);

  // 插入到 Submission history 后面
  submissionHistory.parentNode.insertBefore(container, submissionHistory.nextSibling);

  logger.info("Convert buttons injected below Submission history");
}

async function handleConversionTrigger(type = "markdown") {
  logger.info(`${type} conversion triggered`);

  try {
    const mdButton = document.querySelector(".arxiv-md-convert-btn");
    const pdfButton = document.querySelector(".arxiv-pdf-download-btn");
    const progressIndicator = document.querySelector(".arxiv-md-progress");

    const activeButton = type === "markdown" ? mdButton : pdfButton;

    if (activeButton) {
      activeButton.disabled = true;
      activeButton.style.opacity = "0.5";
      activeButton.style.cursor = "not-allowed";
    }

    if (progressIndicator) {
      progressIndicator.style.display = "flex";
    }

    // PDF 下载：直接在 content script 中处理（参考脚本方式）
    if (type === "pdf") {
      await handlePdfDownloadDirect(activeButton, progressIndicator);
      return;
    }

    // Markdown 转换：通过 background script 处理
    const metadata = isArxivAbsPage
      ? metadataExtractor.extractFromAbsPage()
      : await fetchMetadataFromAbsPage();

    logger.debug("Extracted metadata:", metadata);

    chrome.runtime.sendMessage(
      { type: "CONVERT_PAPER", data: metadata },
      (response) => {
        logger.debug("Markdown conversion response:", response);

        if (activeButton) {
          activeButton.disabled = false;
          activeButton.style.opacity = "1";
          activeButton.style.cursor = "pointer";
        }

        if (progressIndicator) {
          progressIndicator.style.display = "none";
        }

        // 通知已由 background script 处理，不需要在这里显示 Toast
      },
    );
  } catch (error) {
    logger.error("Conversion trigger failed:", error);
    
    // 恢复按钮状态
    const activeButton = type === "markdown" 
      ? document.querySelector(".arxiv-md-convert-btn")
      : document.querySelector(".arxiv-pdf-download-btn");
    if (activeButton) {
      activeButton.disabled = false;
      activeButton.style.opacity = "1";
      activeButton.style.cursor = "pointer";
    }
    
    const progressIndicator = document.querySelector(".arxiv-md-progress");
    if (progressIndicator) {
      progressIndicator.style.display = "none";
    }
  }
}

async function handlePdfDownloadDirect(button, progressIndicator) {
  try {
    // 使用页面标题作为文件名（参考脚本方式）
    const pageTitle = document.title;
    const illegalChars = /[\/\\:*?"<>|\[\]]/g;
    const cleanTitle = pageTitle.replace(illegalChars, ' ').replace(/\s+/g, ' ').trim();
    const filename = `${cleanTitle}.pdf`;
    
    // 构造 PDF URL
    const pdfUrl = window.location.href.replace('/abs/', '/pdf/');
    
    logger.info("Downloading PDF:", filename);
    
    // 更新按钮文本
    if (button) {
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="vertical-align: -2px; margin-right: 4px;">
          <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z"/>
          <path d="M8.5 6.5a.5.5 0 0 0-1 0v3.793L6.354 9.146a.5.5 0 1 0-.708.708l2 2a.5.5 0 0 0 .708 0l2-2a.5.5 0 0 0-.708-.708L8.5 10.293V6.5z"/>
        </svg>
        Downloading...
      `;
    }
    
    // Fetch PDF
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status}`);
    }
    
    const blob = await response.blob();
    
    // 创建下载链接
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    
    // 清理
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
    
    // 恢复按钮状态
    if (button) {
      button.disabled = false;
      button.style.opacity = "1";
      button.style.cursor = "pointer";
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="vertical-align: -2px; margin-right: 4px;">
          <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z"/>
          <path d="M8.5 6.5a.5.5 0 0 0-1 0v3.793L6.354 9.146a.5.5 0 1 0-.708.708l2 2a.5.5 0 0 0 .708 0l2-2a.5.5 0 0 0-.708-.708L8.5 10.293V6.5z"/>
        </svg>
        Save PDF (Renamed)
      `;
    }
    
    if (progressIndicator) {
      progressIndicator.style.display = "none";
    }
    
    logger.info("PDF download complete:", filename);
    
  } catch (error) {
    logger.error("PDF download failed:", error);
    
    // 恢复按钮状态
    if (button) {
      button.disabled = false;
      button.style.opacity = "1";
      button.style.cursor = "pointer";
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="vertical-align: -2px; margin-right: 4px;">
          <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z"/>
          <path d="M8.5 6.5a.5.5 0 0 0-1 0v3.793L6.354 9.146a.5.5 0 1 0-.708.708l2 2a.5.5 0 0 0 .708 0l2-2a.5.5 0 0 0-.708-.708L8.5 10.293V6.5z"/>
        </svg>
        Save PDF (Renamed)
      `;
    }
    
    if (progressIndicator) {
      progressIndicator.style.display = "none";
    }
    
    throw error;
  }
}

async function fetchMetadataFromAbsPage() {
  const arxivId = metadataExtractor._extractIdFromUrl(window.location.href);

  if (!arxivId) {
    throw new Error("Cannot extract arXiv ID");
  }

  // 使用 API 获取
  return await metadataExtractor.fetchMetadataFromApi(arxivId);
}

function updateProgressUI(progress) {
  const progressIndicator = document.querySelector(".arxiv-md-progress");
  if (!progressIndicator) return;

  const textEl = progressIndicator.querySelector(".progress-text");
  const percentEl = progressIndicator.querySelector(".progress-percent");

  if (textEl && percentEl) {
    const stageText = {
      checking: "Checking ar5iv...",
      downloading: "Downloading PDF...",
      uploading: "Uploading to MinerU...",
      processing: "MinerU processing...",
      completed: "Done!",
    };

    textEl.textContent = stageText[progress.stage] || "Processing...";
    percentEl.textContent = `${Math.round(progress.progress || 0)}%`;
  }
}

// Toast 通知已被移除，通知由 background script 的系统通知处理

/**
 * 判断数学公式是否为块级公式
 * @param {Element} mathEl - math 元素
 * @param {string} latex - LaTeX 内容
 * @returns {boolean}
 */
function isBlockFormula(mathEl, latex) {
  // 1. 显式 display="block" 属性
  const displayAttr = mathEl.getAttribute("display");
  if (displayAttr === "block") return true;

  // 2. 在方程式容器中（ar5iv 特有的 class）
  const equationContainer = mathEl.closest(
    ".ltx_equation, .ltx_equationgroup, .ltx_eqn_table, .ltx_eqn_row",
  );
  if (equationContainer) return true;

  // 3. LaTeX 内容包含 \displaystyle 命令（说明原本是块级公式）
  if (latex.includes("\\displaystyle")) return true;

  // 4. LaTeX 内容是多行公式（包含 \\ 换行或 aligned/array 环境）
  if (
    latex.includes("\\\\") ||
    latex.includes("\\begin{aligned}") ||
    latex.includes("\\begin{array}") ||
    latex.includes("\\begin{cases}")
  ) {
    return true;
  }

  // 5. 在独立段落中（父元素是 p 或 div，且只有这一个 math 子元素）
  const parent = mathEl.parentElement;
  if (parent && (parent.tagName === "P" || parent.tagName === "DIV")) {
    const childElements = Array.from(parent.children);
    if (childElements.length === 1 && childElements[0] === mathEl) {
      return true;
    }
  }

  return false;
}

/**
 * 预处理：提取并替换所有数学公式元素
 */
function preprocessMathElements(doc) {
  const mathMap = new Map();
  let mathCounter = 0;

  const createPlaceholder = (id, isBlock) => {
    return isBlock
      ? `MATHBLOCKSTART${id}MATHBLOCKEND`
      : `MATHINLINESTART${id}MATHINLINEEND`;
  };

  // 处理所有 <math> 标签
  doc.querySelectorAll("math").forEach((mathEl) => {
    const alttext = mathEl.getAttribute("alttext");

    if (alttext) {
      let latex = alttext.trim();
      const isBlock = isBlockFormula(mathEl, latex);

      if (isBlock && latex.startsWith("\\displaystyle")) {
        latex = latex.replace(/^\\displaystyle\s*/, "");
      }

      const placeholder = createPlaceholder(mathCounter, isBlock);
      mathMap.set(placeholder, { latex, isBlock });
      mathCounter++;
      mathEl.replaceWith(doc.createTextNode(placeholder));
    } else {
      const annotation = mathEl.querySelector(
        'annotation[encoding="application/x-tex"]',
      );
      if (annotation && annotation.textContent) {
        let latex = annotation.textContent.trim();
        const isBlock = isBlockFormula(mathEl, latex);

        if (isBlock && latex.startsWith("\\displaystyle")) {
          latex = latex.replace(/^\\displaystyle\s*/, "");
        }

        const placeholder = createPlaceholder(mathCounter, isBlock);
        mathMap.set(placeholder, { latex, isBlock });
        mathCounter++;
        mathEl.replaceWith(doc.createTextNode(placeholder));
      } else {
        mathEl.remove();
      }
    }
  });

  // 清理残留的 MathML 标签
  const mathMLTags = [
    "semantics",
    "mrow",
    "mi",
    "mo",
    "mn",
    "msub",
    "msup",
    "mfrac",
    "msqrt",
    "mtext",
    "annotation-xml",
    "annotation",
    "apply",
    "csymbol",
    "ci",
    "cn",
  ];
  mathMLTags.forEach((tag) =>
    doc.querySelectorAll(tag).forEach((el) => el.remove()),
  );

  logger.debug(`Extracted ${mathCounter} math formulas`);
  return { doc, mathMap };
}

/**
 * 预处理：清理作者和元数据格式问题
 */
function preprocessAuthorsAndMetadata(doc) {
  // 移除 \AND 错误标记
  doc.querySelectorAll(".ltx_ERROR").forEach((el) => {
    if (el.textContent.includes("\\AND")) el.remove();
  });

  // 清理脚注标记
  doc.querySelectorAll(".ltx_note_mark, sup.ltx_note_mark").forEach((el) => {
    const text = el.textContent.replace(/footnotemark:\s*/g, "").trim();
    if (text) el.textContent = text;
  });

  // 清理脚注内容
  doc.querySelectorAll(".ltx_note_content").forEach((el) => el.remove());

  // 清理作者分隔符
  doc.querySelectorAll(".ltx_personname").forEach((el) => {
    el.innerHTML = el.innerHTML.replace(/&amp;/g, "\n\n");
  });
}

/**
 * 预处理：处理 ar5iv 表格
 * 方程式表格 (.ltx_eqn_table) 用于排版多行公式
 * 数据表格 (.ltx_tabular) 是实际数据表格
 */
function preprocessTables(doc) {
  doc.querySelectorAll("table").forEach((table) => {
    const isEquationTable =
      table.classList.contains("ltx_eqn_table") ||
      table.classList.contains("ltx_eqn_row") ||
      table.closest(".ltx_equation, .ltx_equationgroup") !== null;
    const hasMathPlaceholder =
      table.textContent.includes("MATHBLOCK") ||
      table.textContent.includes("MATHINLINE");

    if (isEquationTable) {
      const placeholders =
        table.textContent.match(
          /MATHBLOCKSTART\d+MATHBLOCKEND|MATHINLINESTART\d+MATHINLINEEND/g,
        ) || [];
      if (placeholders.length > 0) {
        table.replaceWith(
          doc.createTextNode(`\n\n${placeholders.join("\n\n")}\n\n`),
        );
        return;
      }
      const text = table.textContent.replace(/\s+/g, " ").trim();
      if (text) {
        table.replaceWith(doc.createTextNode(`\n\n${text}\n\n`));
        return;
      }
      table.remove();
      return;
    }

    const isDataTable =
      table.classList.contains("ltx_tabular") ||
      table.closest(".ltx_table, figure.ltx_table") !== null;

    if (isDataTable || !hasMathPlaceholder) {
      table.removeAttribute("id");
      table.removeAttribute("style");

      const firstRow = table.querySelector("tr");
      const hasHeader =
        table.querySelector("thead") ||
        (firstRow && firstRow.querySelector("th"));

      if (!hasHeader && firstRow) {
        const firstRowCells = firstRow.querySelectorAll("td");
        const isLikelyHeader =
          firstRowCells.length > 0 &&
          Array.from(firstRowCells).some(
            (cell) =>
              cell.textContent.trim().length < 50 &&
              !cell.textContent.includes("."),
          );

        if (isLikelyHeader) {
          firstRowCells.forEach((td) => {
            const th = doc.createElement("th");
            th.innerHTML = td.innerHTML;
            td.replaceWith(th);
          });
        }
      }

      table.querySelectorAll("td, th").forEach((cell) => {
        cell.removeAttribute("id");
        cell.removeAttribute("style");
        cell.removeAttribute("class");
      });

      table.querySelectorAll("tr").forEach((row) => {
        row.removeAttribute("id");
        row.removeAttribute("style");
        row.removeAttribute("class");
      });
      return;
    }

    // 小表格（可能是布局用）
    const rows = table.querySelectorAll("tr");
    const cells = table.querySelectorAll("td, th");
    if (rows.length <= 3 && cells.length <= 6 && hasMathPlaceholder) {
      table.replaceWith(
        doc.createTextNode(
          `\n\n${table.textContent.replace(/\s+/g, " ").trim()}\n\n`,
        ),
      );
    }
  });
}

/**
 * 预处理：修复列表格式问题
 */
function preprocessLists(doc) {
  // 移除列表项中的标签元素
  doc
    .querySelectorAll("li .ltx_tag, li .ltx_tag_item, li .ltx_tag_itemize")
    .forEach((tag) => tag.remove());

  // 移除列表项中的孤立 • 符号
  doc.querySelectorAll("li").forEach((li) => {
    const firstChild = li.firstChild;
    if (firstChild && firstChild.nodeType === Node.TEXT_NODE) {
      firstChild.textContent = firstChild.textContent.replace(/^[\s•]+/, "");
    }
    li.querySelectorAll("span").forEach((span) => {
      if (span.textContent.trim() === "•" || span.textContent.trim() === "–") {
        span.remove();
      }
    });
  });

  // 确保列表项内容在同一行
  doc
    .querySelectorAll("li > .ltx_para, li > .ltx_p, li > p")
    .forEach((para) => {
      const parent = para.parentElement;
      if (parent && parent.tagName === "LI") {
        while (para.firstChild) {
          parent.insertBefore(para.firstChild, para);
        }
        para.remove();
      }
    });
}

/**
 * 预处理：清理 ar5iv 特有元素
 */
function preprocessAr5ivElements(doc) {
  // 处理章节标题中的编号标签
  doc
    .querySelectorAll(
      ".ltx_title_section, .ltx_title_subsection, .ltx_title_subsubsection, .ltx_title_paragraph",
    )
    .forEach((title) => {
      const tagEl = title.querySelector(".ltx_tag");
      if (tagEl) {
        const tagText = tagEl.textContent.trim();
        tagEl.remove();
        if (tagText && title.firstChild) {
          title.insertBefore(
            doc.createTextNode(tagText + " "),
            title.firstChild,
          );
        }
      }
    });

  // 移除不需要转换的元素
  [
    ".ltx_pagination",
    ".ltx_break",
    ".ltx_rule",
    ".ltx_dates",
    ".ar5iv-feedback",
  ].forEach((selector) =>
    doc.querySelectorAll(selector).forEach((el) => el.remove()),
  );

  // 清理图片的相对路径
  doc.querySelectorAll("img").forEach((img) => {
    let src = img.getAttribute("src");
    if (src && !src.startsWith("http") && !src.startsWith("data:")) {
      img.setAttribute(
        "src",
        src.startsWith("/")
          ? `https://ar5iv.org${src}`
          : `https://ar5iv.org/${src}`,
      );
    }
  });

  // 处理参考文献列表
  doc.querySelectorAll(".ltx_bibitem").forEach((bibitem) => {
    const tag = bibitem.querySelector(".ltx_tag");
    const tagText = tag ? tag.textContent.trim() : "";
    const bibblocEl = bibitem.querySelector(".ltx_bibblock");
    if (tagText && bibblocEl) {
      bibitem.innerHTML = `<span class="ltx_bib_tag">${tagText}</span> ${bibblocEl.innerHTML}`;
    }
  });

  // 处理代码块
  doc
    .querySelectorAll(".ltx_listing, .ltx_verbatim, pre.ltx_code")
    .forEach((code) => {
      if (!code.querySelector("code")) {
        code.innerHTML = `<code>${code.textContent}</code>`;
      }
    });

  // 处理引用块
  doc.querySelectorAll(".ltx_quote").forEach((quote) => {
    if (quote.tagName !== "BLOCKQUOTE") {
      const blockquote = doc.createElement("blockquote");
      blockquote.innerHTML = quote.innerHTML;
      quote.replaceWith(blockquote);
    }
  });

  // 【关键】处理 span.ltx_tabular 伪表格
  // 检测是否有复杂的 colspan/rowspan，如果有则转为纯文本表格
  doc
    .querySelectorAll("span.ltx_tabular, div.ltx_tabular")
    .forEach((tabular) => {
      try {
        const rows = Array.from(tabular.querySelectorAll(":scope > .ltx_tr"));
        if (rows.length === 0) return;

        // 检测是否有复杂结构（colspan/rowspan）
        const hasComplexStructure =
          tabular.innerHTML.includes("ltx_colspan") ||
          tabular.innerHTML.includes("ltx_rowspan");

        if (hasComplexStructure) {
          // 复杂表格：转换为纯文本对齐格式
          const textRows = [];
          const colWidths = [];

          // 第一遍：收集所有单元格内容，计算列宽
          const allRowsData = rows.map((row) => {
            const cells = Array.from(
              row.querySelectorAll(":scope > .ltx_td, :scope > .ltx_th"),
            );
            return cells.map((cell) => {
              // 获取纯文本，处理数学公式占位符
              let text = cell.textContent.trim().replace(/\s+/g, " ");
              // 获取 colspan
              const colspanMatch = cell.className.match(/ltx_colspan_(\d+)/);
              const colspan = colspanMatch ? parseInt(colspanMatch[1]) : 1;
              return { text, colspan };
            });
          });

          // 计算每列最大宽度
          allRowsData.forEach((rowData) => {
            let colIdx = 0;
            rowData.forEach((cell) => {
              const cellWidth = Math.ceil(cell.text.length / cell.colspan);
              for (let i = 0; i < cell.colspan; i++) {
                colWidths[colIdx + i] = Math.max(
                  colWidths[colIdx + i] || 0,
                  cellWidth,
                );
              }
              colIdx += cell.colspan;
            });
          });

          // 第二遍：生成对齐的文本行
          allRowsData.forEach((rowData, rowIdx) => {
            const parts = [];
            let colIdx = 0;
            rowData.forEach((cell) => {
              // 计算这个单元格应该占用的总宽度
              let totalWidth = 0;
              for (let i = 0; i < cell.colspan; i++) {
                totalWidth += (colWidths[colIdx + i] || 8) + 3; // +3 for padding and separator
              }
              totalWidth -= 3; // 减去最后一个的分隔符空间
              totalWidth = Math.max(totalWidth, cell.text.length);

              parts.push(cell.text.padEnd(totalWidth));
              colIdx += cell.colspan;
            });
            textRows.push("| " + parts.join(" | ") + " |");

            // 在表头后添加分隔行
            if (
              rowIdx === 0 ||
              (rowIdx === 1 && allRowsData[0].some((c) => c.colspan > 1))
            ) {
              const separators = [];
              colIdx = 0;
              rowData.forEach((cell) => {
                let totalWidth = 0;
                for (let i = 0; i < cell.colspan; i++) {
                  totalWidth += (colWidths[colIdx + i] || 8) + 3;
                }
                totalWidth -= 3;
                totalWidth = Math.max(totalWidth, cell.text.length);
                separators.push("-".repeat(totalWidth));
                colIdx += cell.colspan;
              });
              textRows.push("| " + separators.join(" | ") + " |");
            }
          });

          // 创建文本节点替换
          const textTable = doc.createElement("div");
          textTable.className = "ltx_table_text";
          textTable.innerHTML = `<pre><code>${textRows.join("\n")}</code></pre>`;
          tabular.replaceWith(textTable);
          console.log(
            `[PREPROCESS] ✅ 复杂表格转为文本格式 (${rows.length} 行)`,
          );
        } else {
          // 简单表格：转换为标准 HTML table
          const table = doc.createElement("table");
          const tbody = doc.createElement("tbody");

          rows.forEach((row, rowIdx) => {
            const tr = doc.createElement("tr");
            const cells = row.querySelectorAll(
              ":scope > .ltx_td, :scope > .ltx_th",
            );
            cells.forEach((cell) => {
              const isHeader =
                cell.classList.contains("ltx_th") || rowIdx === 0;
              const cellEl = doc.createElement(isHeader ? "th" : "td");
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
            console.log(
              `[PREPROCESS] ✅ 简单表格转为 HTML table (${rows.length} 行)`,
            );
          }
        }
      } catch (e) {
        console.error("[PREPROCESS] ❌ 转换伪表格失败:", e);
      }
    });

  // 【关键】处理 Algorithm 伪代码块
  doc.querySelectorAll("figure.ltx_float_algorithm").forEach((alg) => {
    try {
      const caption = alg.querySelector("figcaption");
      const captionText = caption ? caption.textContent.trim() : "Algorithm";

      // 提取算法内容
      const contentDiv = alg.querySelector(".ltx_flex_figure, .ltx_flex_cell");
      if (contentDiv) {
        // 收集所有算法步骤
        const steps = [];
        contentDiv.querySelectorAll("p, .ltx_p, .ltx_text").forEach((el) => {
          const text = el.textContent.trim();
          if (text && !el.closest("figcaption")) {
            steps.push(text);
          }
        });

        if (steps.length > 0) {
          // 创建代码块
          const pre = doc.createElement("pre");
          const code = doc.createElement("code");
          code.textContent = `${captionText}\n${"─".repeat(40)}\n${steps.join("\n")}`;
          pre.appendChild(code);
          pre.className = "ltx_algorithm_converted";
          alg.replaceWith(pre);
          console.log(
            `[PREPROCESS] ✅ 转换 Algorithm 为代码块: ${captionText}`,
          );
        }
      }
    } catch (e) {
      console.error("[PREPROCESS] ❌ 转换 Algorithm 失败:", e);
    }
  });

  // 【关键】处理加粗文本 (ltx_font_bold)
  doc.querySelectorAll(".ltx_font_bold, .ltx_text_bold").forEach((bold) => {
    // 不处理已经在 strong/b 标签中的
    if (bold.closest("strong") || bold.closest("b")) return;
    // 不处理标题中的
    if (bold.closest("h1, h2, h3, h4, h5, h6, figcaption")) return;

    const strong = doc.createElement("strong");
    strong.innerHTML = bold.innerHTML;
    bold.replaceWith(strong);
  });

  // 处理斜体文本 (ltx_font_italic, ltx_emph)
  doc.querySelectorAll(".ltx_font_italic, .ltx_emph").forEach((italic) => {
    if (italic.closest("em") || italic.closest("i")) return;
    if (italic.closest("h1, h2, h3, h4, h5, h6")) return;

    const em = doc.createElement("em");
    em.innerHTML = italic.innerHTML;
    italic.replaceWith(em);
  });

  console.log(`[PREPROCESS] ✅ ar5iv 元素清理完成`);
}

/**
 * 移除所有 MathML 相关元素
 */
function removeMathMLArtifacts(doc) {
  const mathMLSelectors = [
    "math",
    "semantics",
    "mrow",
    "mi",
    "mo",
    "mn",
    "msub",
    "msup",
    "mfrac",
    "msqrt",
    "mtext",
    "annotation-xml",
    "annotation",
  ];

  mathMLSelectors.forEach((selector) => {
    doc.querySelectorAll(selector).forEach((el) => {
      if (el.textContent && !el.querySelector("annotation")) {
        const text = el.textContent.trim();
        text ? el.replaceWith(doc.createTextNode(text)) : el.remove();
      } else {
        el.remove();
      }
    });
  });
}

/**
 * 清理 LaTeX 公式中不支持的命令（颜色、字体大小等）
 */
function cleanLatexFormula(latex) {
  let result = latex;

  // 1. 移除颜色定义命令 \definecolor[named]{...}{...}{...} 或 \definecolor{...}{...}{...}
  result = result.replace(
    /\\definecolor\s*(?:\[[^\]]*\])?\s*\{[^}]*\}\s*\{[^}]*\}(?:\s*\{[^}]*\})?/g,
    "",
  );

  // 2. 移除 \color[rgb]{...} 或 \color{...} 命令（保留后续内容）
  result = result.replace(/\\color\s*(?:\[[^\]]*\])?\s*\{[^}]*\}/g, "");

  // 3. 移除 \textcolor{...}{content} - 保留 content（处理嵌套大括号）
  result = result.replace(
    /\\textcolor\s*\{[^}]*\}\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g,
    "$1",
  );

  // 4. 移除 pgf 相关颜色命令
  result = result.replace(/\\pgfstrokecolor/g, "");
  result = result.replace(/\\pgfsetcolor\s*\{[^}]*\}/g, "");
  result = result.replace(/\\pgfsetfillcolor\s*\{[^}]*\}/g, "");

  // 5. 移除字体大小命令
  const fontSizeCommands = [
    "\\footnotesize",
    "\\scriptsize",
    "\\tiny",
    "\\small",
    "\\normalsize",
    "\\large",
    "\\Large",
    "\\LARGE",
    "\\huge",
    "\\Huge",
    "\\bigskip",
    "\\medskip",
    "\\smallskip",
  ];
  fontSizeCommands.forEach((cmd) => {
    result = result.replace(
      new RegExp(
        cmd.replace(/\\/g, "\\\\") + "(?:\\s+|(?=\\\\)|(?=[^a-zA-Z]))",
        "g",
      ),
      "",
    );
  });

  // 6. 移除其他不常见的格式命令
  result = result.replace(/\\mbox\s*\{([^}]*)\}/g, "$1"); // \mbox{text} -> text
  result = result.replace(/\\text\s*\{([^}]*)\}/g, "\\text{$1}"); // 保留 \text

  // 7. 清理多余空格和空大括号
  result = result.replace(/\{\s*\}/g, ""); // 移除空大括号 {}
  result = result.replace(/\s{2,}/g, " ").trim();

  return result;
}

/**
 * 恢复数学公式占位符
 */
function restoreMathPlaceholders(markdown, mathMap) {
  let result = markdown;

  mathMap.forEach((value, placeholder) => {
    let { latex, isBlock } = value;

    // 清理 LaTeX 中不支持的命令
    latex = cleanLatexFormula(latex);

    const escapedPlaceholder = placeholder.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );
    const regex = new RegExp(escapedPlaceholder, "g");

    if (isBlock) {
      result = result.replace(regex, `$$${latex.trim()}$$`);
    } else {
      result = result.replace(regex, `$${latex}$`);
    }
  });

  return result;
}

/**
 * 后处理 Markdown - 清理转换问题
 */
function postProcessMarkdown(markdown) {
  let result = markdown;

  // 恢复被转义的引用方括号
  result = result.replace(/\\\[(\d+(?:\s*,\s*\d+)*)\\\]/g, "[$1]");

  // 修复章节标题格式
  result = result.replace(
    /^\s*\((\d+(?:\.\d+)*)\)\s+(.+)$/gm,
    (match, num, title) => {
      const level = num.split(".").length + 1;
      return `${"#".repeat(Math.min(level, 6))} ${num} ${title}`;
    },
  );

  // 修复列表项格式
  result = result.replace(/-\s+\(•\)\s*\n\n\s+/g, "- ");
  result = result.replace(/-\s+\(•\)\s*/g, "- ");
  result = result.replace(/-\s+•\s*/g, "- ");

  // 清理重复的数学表达式
  result = result
    .replace(/([a-zA-Z]+)([\u{1D400}-\u{1D7FF}]+)\1\{([^}]+)\}/gu, "$$1_{$3}$")
    .replace(
      /([a-zA-Z]+)([\u{1D400}-\u{1D7FF}]+)\1\^\{([^}]+)\}/gu,
      "$$1^{$3}$",
    );

  // 移除孤立的 Unicode 数学符号
  result = result.replace(/([a-zA-Z])([\u{1D400}-\u{1D7FF}]+)(\d)/gu, "$1$3");

  // 清理脚标文本和脚注标记
  result = result
    .replace(/\bsubscript\b/gi, "")
    .replace(/\bsuperscript\b/gi, "");
  result = result
    .replace(/\d+footnotemark:\s*\d+/g, "")
    .replace(/footnotemark:\s*/g, "");

  // 清理重复的项目符号
  result = result.replace(/^(\s*-\s*)•\s*/gm, "$1");

  // 修复表格和空格
  result = result.replace(/\|\s*\|\s*\|/g, "| |");
  result = result.replace(/[ \t]+$/gm, "");

  // 移除 HTML 实体残留
  result = result
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"');

  // 清理 LaTeX 命令残留
  result = result.replace(/\\\\AND/g, "").replace(/\\AND/g, "");

  // 修复连续的行内公式
  result = result.replace(
    /\$\$([^$]+)\$\$/g,
    "DOUBLEDOLLARSTART$1DOUBLEDOLLAREND",
  );
  result = result.replace(/\$([^$]+)\$\$([^$]+)\$/g, "$$$1$ $$$2$");
  result = result.replace(
    /DOUBLEDOLLARSTART([^]*?)DOUBLEDOLLAREND/g,
    (_, content) => `\n\n$$\n${content.trim()}\n$$\n\n`,
  );

  // 清理多余空行和 HTML 标签残留
  result = result.replace(/\n{4,}/g, "\n\n\n");
  result = result.replace(/<\/?[a-z][^>]*>/gi, "");

  return result;
}

/**
 * 处理文件下载（使用 <a> download 属性）
 */
function handleFileDownload(data, sendResponse) {
  try {
    const blob = new Blob([data.content], {
      type: data.mimeType || "text/plain",
    });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = data.filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);

    sendResponse({ success: true });
  } catch (error) {
    logger.error("Download failed:", error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 处理 HTML → Markdown 转换（在真实浏览器环境中）
 */
function handleHtmlToMarkdown(data, sendResponse) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(data.html, "text/html");

    // 预处理流程
    preprocessAuthorsAndMetadata(doc);
    const { doc: cleanedDoc, mathMap } = preprocessMathElements(doc);
    preprocessLists(cleanedDoc);
    preprocessAr5ivElements(cleanedDoc);
    preprocessTables(cleanedDoc);
    removeMathMLArtifacts(cleanedDoc);

    // Turndown 转换
    const turndownService = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      bulletListMarker: "-",
      emDelimiter: "*",
      strongDelimiter: "**",
    });

    // 启用 GFM 插件（表格、删除线等）
    turndownService.use(gfm);

    // 自定义规则：处理图片
    turndownService.addRule("arxivImages", {
      filter: "img",
      replacement: (content, node) => {
        const alt = node.alt || "image";
        let src = node.getAttribute("src") || "";

        // 清理错误的 chrome-extension URL
        src = src.replace(/chrome-extension:\/\/[^/]+\//, "");

        // 处理相对路径 - 统一使用 ar5iv.org 域名
        if (src && !src.startsWith("http")) {
          const cleanSrc = src.startsWith("/") ? src.substring(1) : src;
          src = `https://ar5iv.org/${cleanSrc}`;
        }

        return src ? `![${alt}](${src})` : "";
      },
    });

    // 自定义规则：处理 ar5iv 的引用链接
    turndownService.addRule("citations", {
      filter: (node) => {
        if (node.nodeName === "A") {
          const href = node.getAttribute("href") || "";
          // 过滤 chrome-extension URL
          if (href.includes("chrome-extension://")) return true;
          // 过滤 ar5iv 引用链接（指向参考文献的内部链接）
          if (href.startsWith("#bib.")) return true;
          // 过滤带有 ltx_ref 类的链接（ar5iv 的内部引用）
          if (
            node.classList &&
            (node.classList.contains("ltx_ref") ||
              node.classList.contains("ltx_cite"))
          ) {
            return true;
          }
        }
        return false;
      },
      replacement: (content, node) => {
        const href = node.getAttribute("href") || "";

        // chrome-extension URL：只保留内容
        if (href.includes("chrome-extension://")) {
          return content;
        }

        // ar5iv 的内部引用链接：转换为 [内容] 格式
        if (href.startsWith("#bib.") || href.startsWith("#")) {
          // 清理内容中的多余空白
          const cleanContent = content.replace(/\s+/g, " ").trim();
          return `[${cleanContent}]`;
        }

        // ltx_ref 类：保留内容
        if (node.classList && node.classList.contains("ltx_ref")) {
          return content;
        }

        return `[${content}](${href})`;
      },
    });

    // 自定义规则：处理 ar5iv 的脚注
    turndownService.addRule("footnotes", {
      filter: (node) => {
        if (node.classList) {
          return (
            node.classList.contains("ltx_note") ||
            node.classList.contains("ltx_note_mark") ||
            node.classList.contains("ltx_note_content")
          );
        }
        return false;
      },
      replacement: (content, node) => {
        // 脚注标记：返回上标数字
        if (node.classList.contains("ltx_note_mark")) {
          const num = content.replace(/[^\d]/g, "");
          return num ? `^${num}` : "";
        }
        // 脚注内容：在后处理中会被移除
        if (node.classList.contains("ltx_note_content")) {
          return "";
        }
        return content;
      },
    });

    // 自定义规则：处理 ar5iv 的图片容器 (figure)
    turndownService.addRule("arxivFigures", {
      filter: (node) => {
        return (
          node.nodeName === "FIGURE" &&
          node.classList &&
          (node.classList.contains("ltx_figure") ||
            node.classList.contains("ltx_table"))
        );
      },
      replacement: (content, node) => {
        // 保留 figure 内容，添加换行
        return `\n\n${content}\n\n`;
      },
    });

    // 自定义规则：处理图表标题 (figcaption)
    turndownService.addRule("arxivCaptions", {
      filter: (node) => {
        return (
          node.nodeName === "FIGCAPTION" ||
          (node.classList && node.classList.contains("ltx_caption"))
        );
      },
      replacement: (content, node) => {
        // 格式化标题
        const cleanContent = content.replace(/\s+/g, " ").trim();
        return cleanContent ? `\n\n${cleanContent}\n\n` : "";
      },
    });

    // 自定义规则：处理 ar5iv 的定理/引理/证明等
    turndownService.addRule("arxivTheorems", {
      filter: (node) => {
        if (node.classList) {
          return (
            node.classList.contains("ltx_theorem") ||
            node.classList.contains("ltx_proof") ||
            node.classList.contains("ltx_definition") ||
            node.classList.contains("ltx_lemma") ||
            node.classList.contains("ltx_corollary")
          );
        }
        return false;
      },
      replacement: (content, node) => {
        // 获取定理类型
        let type = "";
        if (node.classList.contains("ltx_theorem")) type = "**Theorem**";
        else if (node.classList.contains("ltx_proof")) type = "**Proof**";
        else if (node.classList.contains("ltx_definition"))
          type = "**Definition**";
        else if (node.classList.contains("ltx_lemma")) type = "**Lemma**";
        else if (node.classList.contains("ltx_corollary"))
          type = "**Corollary**";

        const cleanContent = content.trim();
        return type
          ? `\n\n${type}: ${cleanContent}\n\n`
          : `\n\n${cleanContent}\n\n`;
      },
    });

    // 自定义规则：处理公式编号标签
    turndownService.addRule("arxivTags", {
      filter: (node) => {
        return node.classList && node.classList.contains("ltx_tag");
      },
      replacement: (content, node) => {
        // 公式编号：保留在括号中
        const cleanContent = content.trim();
        return cleanContent ? ` (${cleanContent})` : "";
      },
    });

    // 自定义规则：处理 ar5iv 的章节标题
    turndownService.addRule("arxivSectionTitles", {
      filter: (node) => {
        // ar5iv 使用 h2-h6 来表示章节标题，但有特殊的 class
        if (node.nodeName.match(/^H[1-6]$/)) {
          return (
            node.classList &&
            (node.classList.contains("ltx_title_section") ||
              node.classList.contains("ltx_title_subsection") ||
              node.classList.contains("ltx_title_subsubsection") ||
              node.classList.contains("ltx_title_paragraph") ||
              node.classList.contains("ltx_title_subparagraph"))
          );
        }
        return false;
      },
      replacement: (content, node) => {
        // 提取标题文本，清理多余空白
        let text = content.replace(/\s+/g, " ").trim();

        // 移除章节编号中的括号格式，如 "(1)" -> "1"
        text = text.replace(/^\((\d+(?:\.\d+)*)\)\s*/, "$1 ");

        // 根据标题级别生成 Markdown
        const level = parseInt(node.nodeName.charAt(1), 10);
        const prefix = "#".repeat(Math.min(level, 6));

        return `\n\n${prefix} ${text}\n\n`;
      },
    });

    // 自定义规则：移除错误元素
    turndownService.addRule("removeErrors", {
      filter: (node) => {
        return node.classList && node.classList.contains("ltx_ERROR");
      },
      replacement: () => "",
    });

    // 自定义规则：处理遗留的 ltx_tag 元素（如果预处理未完全清理）
    turndownService.addRule("arxivTags2", {
      filter: (node) => {
        return (
          node.classList &&
          (node.classList.contains("ltx_tag_item") ||
            node.classList.contains("ltx_tag_itemize") ||
            node.classList.contains("ltx_tag_enumerate"))
        );
      },
      replacement: () => "", // 移除这些标签，Turndown 会自动处理列表符号
    });

    // 自定义规则：处理 ar5iv 的段落
    turndownService.addRule("arxivParas", {
      filter: (node) => {
        return (
          node.classList &&
          (node.classList.contains("ltx_para") ||
            node.classList.contains("ltx_p"))
        );
      },
      replacement: (content) => {
        const trimmed = content.trim();
        return trimmed ? `\n\n${trimmed}\n\n` : "";
      },
    });

    // 自定义规则：处理加粗文本 (备用规则，如果预处理未完全转换)
    turndownService.addRule("arxivBold", {
      filter: (node) => {
        return (
          node.classList &&
          (node.classList.contains("ltx_font_bold") ||
            node.classList.contains("ltx_text_bold"))
        );
      },
      replacement: (content) => {
        const trimmed = content.trim();
        return trimmed ? `**${trimmed}**` : "";
      },
    });

    // 自定义规则：处理斜体文本 (备用规则)
    turndownService.addRule("arxivItalic", {
      filter: (node) => {
        return (
          node.classList &&
          (node.classList.contains("ltx_font_italic") ||
            node.classList.contains("ltx_emph"))
        );
      },
      replacement: (content) => {
        const trimmed = content.trim();
        return trimmed ? `*${trimmed}*` : "";
      },
    });

    // 自定义规则：处理 Algorithm 代码块
    turndownService.addRule("arxivAlgorithm", {
      filter: (node) => {
        return (
          node.classList && node.classList.contains("ltx_algorithm_converted")
        );
      },
      replacement: (content, node) => {
        const code = node.querySelector("code");
        const text = code ? code.textContent : content;
        return `\n\n\`\`\`\n${text}\n\`\`\`\n\n`;
      },
    });

    // 自定义规则：处理 figure 中的表格标题
    turndownService.addRule("arxivTableCaption", {
      filter: (node) => {
        return (
          node.tagName === "FIGCAPTION" &&
          node.closest("figure.ltx_table, .ltx_float_table")
        );
      },
      replacement: (content) => {
        const trimmed = content.trim();
        return trimmed ? `\n\n**${trimmed}**\n\n` : "";
      },
    });

    // 自定义规则：处理文本格式的复杂表格
    turndownService.addRule("arxivTextTable", {
      filter: (node) => {
        return node.classList && node.classList.contains("ltx_table_text");
      },
      replacement: (content, node) => {
        const code = node.querySelector("code");
        if (code) {
          return `\n\n\`\`\`\n${code.textContent}\n\`\`\`\n\n`;
        }
        return content;
      },
    });

    // 执行 Turndown 转换
    let markdown = turndownService.turndown(cleanedDoc.body.innerHTML);

    // 后处理
    markdown = restoreMathPlaceholders(markdown, mathMap);
    markdown = postProcessMarkdown(markdown);

    logger.debug(
      `Markdown conversion complete: ${markdown.length} bytes, ${mathMap.size} formulas`,
    );
    sendResponse({ success: true, markdown });
  } catch (error) {
    logger.error("Markdown conversion failed:", error);
    sendResponse({ success: false, error: error.message });
  }
}
