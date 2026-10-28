// ar5iv HTML → Markdown 转换器

import { parseHTML } from 'linkedom';
import logger from '@utils/logger';
import { isNetworkError, offlineError } from '@utils/network-error';
import { HTML_PAPER_SOURCES, loadHtmlPaper, selectConversionSource } from '../html-paper';

class Ar5ivConverter {
  constructor() {}

  /**
   * 发送 HTML 到 Content Script 进行 Markdown 转换
   * @private
   */
  async _convertToMarkdownInContentScript(html, tabId, assetPageUrl) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tabId,
        { type: 'CONVERT_HTML_TO_MARKDOWN', data: { html, assetPageUrl } },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(
              new Error(
                `Content script communication failed: ${chrome.runtime.lastError.message}`,
              ),
            );
            return;
          }
          if (response && response.success) {
            resolve(response.markdown);
          } else {
            reject(new Error(response?.error || 'Markdown conversion failed'));
          }
        },
      );
    });
  }

  async checkAvailability(arxivId) {
    try {
      const selected = await selectConversionSource(arxivId);
      const available = selected.tier !== 'pdf';
      logger.debug(`HTML availability: ${arxivId} -> ${available} (${selected.tier})`);
      return available;
    } catch (error) {
      logger.error('HTML availability check failed:', error);
      return false;
    }
  }

  cleanHtml(html) {
    try {
      const { document } = parseHTML(html);

      // 提取标题
      let title = '';
      const titleSource = document.querySelector(
        '.ltx_title.ltx_title_document, h1.ltx_title, .ltx_title',
      );
      // 在副本上去掉 pubnotes 取纯标题；原节点保留，内容脚本会把 pubnotes 转成脚注
      const titleEl = titleSource ? titleSource.cloneNode(true) : null;
      if (titleEl) {
        titleEl.querySelectorAll('.ltx_pubnotes, .ltx_note').forEach((note) => note.remove());
        titleEl.querySelectorAll('br, .ltx_break').forEach((br) => {
          br.replaceWith(document.createTextNode(' '));
        });
        title = titleEl.textContent.replace(/\s+/g, ' ').trim();
      }

      // 提取摘要（完整提取所有段落）
      let excerpt = '';
      const abstractEl = document.querySelector('.ltx_abstract');
      if (abstractEl) {
        // 提取所有段落，而非仅第一个
        const abstractParagraphs = abstractEl.querySelectorAll('.ltx_p, p');
        if (abstractParagraphs.length > 0) {
          const fullAbstract = Array.from(abstractParagraphs)
            .map((p) => p.textContent.replace(/\s+/g, ' ').trim())
            .filter(text => text.length > 0)
            .join(' ');
          // 限制在合理长度用于预览（但不会丢失主内容中的完整摘要）
          excerpt = fullAbstract.substring(0, 500);
        }
      }

      // 获取主内容容器
      let mainContent =
        document.querySelector('article.ltx_document') ||
        document.querySelector('.ltx_page_main') ||
        document.querySelector('main') ||
        document.body;

      if (!mainContent) {
        throw new Error('Cannot find main content in HTML paper');
      }

      // 移除不需要的元素
      const selectorsToRemove = [
        '.ltx_page_header',
        '.ltx_page_footer',
        '.ltx_page_logo',
        '.ltx_sidebar',
        '.ltx_TOC',
        'nav',
        '.ar5iv-footer',
        'script',
        'style',
        'noscript',
        '.ltx_role_navigation',
        '[role="navigation"]',
        '.ltx_page_navbar',
      ];
      selectorsToRemove.forEach((selector) => {
        mainContent.querySelectorAll(selector).forEach((el) => el.remove());
      });

      const content = mainContent.innerHTML;
      logger.debug('ar5iv content extracted:', {
        title,
        length: content.length,
      });

      return { title, content, excerpt };
    } catch (error) {
      logger.error('HTML cleaning failed:', error);
      throw error;
    }
  }

  async toMarkdown(html, tabId, assetPageUrl) {
    try {
      const markdown = await this._convertToMarkdownInContentScript(
        html,
        tabId,
        assetPageUrl,
      );
      logger.debug(`Converted to Markdown: ${markdown.length} bytes`);
      return markdown;
    } catch (error) {
      logger.error('Markdown conversion failed:', error);
      throw error;
    }
  }

  async convert(arxivId, tabId, options = {}) {
    logger.info(`Starting HTML conversion for ${arxivId}`);

    const includeMetadata = options.includeMetadata !== false;
    const paperInfo = options.paperInfo || {};
    let lastError = new Error('HTML version not available');

    let networkFailures = 0;
    let networkError = null;
    for (const source of HTML_PAPER_SOURCES) {
      const paper = await loadHtmlPaper(source, arxivId, undefined, (error) => {
        if (isNetworkError(error)) {
          networkFailures += 1;
          networkError = error;
        } else {
          lastError = error;
        }
      });
      if (!paper) continue;

      try {
        const cleaned = this.cleanHtml(paper.html);
        const markdown = await this.toMarkdown(cleaned.content, tabId, paper.finalUrl);
        const markdownWithMeta = includeMetadata
          ? this._addMetadata(markdown, {
            title: cleaned.title,
            arxivId: arxivId,
            source: paper.source,
            authors: paperInfo.authors,
            year: paperInfo.year,
          })
          : markdown;

        logger.info(`HTML conversion successful for ${arxivId} via ${paper.source}`);

        return {
          markdown: markdownWithMeta,
          title: cleaned.title || `arXiv ${arxivId}`,
          excerpt: cleaned.excerpt,
          metadata: {
            arxivId: arxivId,
            source: paper.source,
            sourceLabel: paper.label,
            conversionTime: new Date().toISOString(),
          },
        };
      } catch (error) {
        lastError = error;
        logger.warn(`HTML source ${paper.source} conversion failed for ${arxivId}:`, error);
      }
    }

    // 所有来源都是网络层失败：交给上层显示"网络连接失败"，而不是退回 PDF
    if (networkFailures === HTML_PAPER_SOURCES.length) {
      logger.warn(`HTML conversion failed for ${arxivId}: network unavailable`);
      throw offlineError(networkError);
    }
    // 部分来源可达（如 arXiv HTML 404、ar5iv 连接失败）：不是断网，抛普通错误让上层退回 PDF
    logger.error(`HTML conversion failed for ${arxivId}:`, lastError);
    throw lastError;
  }

  /**
   * 对 YAML 字符串值做安全转义
   * 如果值包含 YAML 特殊字符，用双引号包裹并转义内部双引号和反斜杠
   * @private
   */
  _escapeYamlString(str) {
    if (!str) return str;
    const value = String(str);
    if (/[:#[\]{}&*!|>'"%@`]/.test(value) || /[\n\r\t]/.test(value) || value.trim() !== value) {
      const escaped = value
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\r\n|\r|\n/g, '\\n')
        .replace(/\t/g, '\\t');
      return `"${escaped}"`;
    }
    return value;
  }

  /**
   * 添加 YAML frontmatter 元数据
   * @private
   */
  _addMetadata(markdown, metadata) {
    const authorsRaw =
      Array.isArray(metadata.authors) && metadata.authors.length > 0
        ? metadata.authors.join(', ')
        : '';
    const authors = authorsRaw ? this._escapeYamlString(authorsRaw) : '';
    const title = this._escapeYamlString(metadata.title);
    const year = metadata.year ? metadata.year : '';

    return `---
title: ${title}
arxiv_id: ${metadata.arxivId}
source: ${metadata.source}
${authors ? `authors: ${authors}` : ''}
${year ? `year: ${year}` : ''}
---

${markdown}`;
  }
}

// 导出单例
export default new Ar5ivConverter();
