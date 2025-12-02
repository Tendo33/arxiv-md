// ar5iv HTML → Markdown 转换器
// 在 Content Script 中执行 Turndown 转换（Service Worker 不支持 DOM API）

import { parseHTML } from 'linkedom';
import { API } from '@config/constants';
import logger from '@utils/logger';

class Ar5ivConverter {
  constructor() {}

  /**
   * 发送 HTML 到 Content Script 进行 Markdown 转换
   * @private
   */
  async _convertToMarkdownInContentScript(html, tabId) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { type: 'CONVERT_HTML_TO_MARKDOWN', data: { html } }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(`Content script communication failed: ${chrome.runtime.lastError.message}`));
          return;
        }
        if (response && response.success) {
          resolve(response.markdown);
        } else {
          reject(new Error(response?.error || 'Markdown conversion failed'));
        }
      });
    });
  }

  /**
   * 检查 ar5iv 版本是否存在
   */
  async checkAvailability(arxivId) {
    const url = `${API.AR5IV_BASE}/${arxivId}`;
    try {
      const response = await fetch(url, { method: 'HEAD' });
      logger.debug(`ar5iv availability: ${arxivId} -> ${response.ok}`);
      return response.ok;
    } catch (error) {
      logger.error('ar5iv availability check failed:', error);
      return false;
    }
  }

  /**
   * 获取 ar5iv HTML 内容
   */
  async fetchHtml(arxivId) {
    const url = `${API.AR5IV_BASE}/${arxivId}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const html = await response.text();
      logger.debug(`Fetched ar5iv HTML: ${html.length} bytes`);
      return html;
    } catch (error) {
      logger.error('Failed to fetch ar5iv HTML:', error);
      throw error;
    }
  }

  /**
   * 清洗 ar5iv HTML，提取主要内容
   */
  cleanHtml(html) {
    try {
      const { document } = parseHTML(html);
      
      // 提取标题
      let title = '';
      const titleEl = document.querySelector('.ltx_title.ltx_title_document, h1.ltx_title, .ltx_title');
      if (titleEl) {
        title = titleEl.textContent.trim();
      }
      
      // 提取摘要
      let excerpt = '';
      const abstractEl = document.querySelector('.ltx_abstract');
      if (abstractEl) {
        const abstractText = abstractEl.querySelector('.ltx_p');
        if (abstractText) {
          excerpt = abstractText.textContent.trim().substring(0, 300);
        }
      }
      
      // 获取主内容容器
      let mainContent = document.querySelector('article.ltx_document') 
        || document.querySelector('.ltx_page_main')
        || document.querySelector('main')
        || document.body;
      
      if (!mainContent) {
        throw new Error('Cannot find main content in ar5iv page');
      }
      
      // 移除不需要的元素
      const selectorsToRemove = [
        '.ltx_page_header', '.ltx_page_footer', '.ltx_page_logo', '.ltx_sidebar',
        '.ltx_TOC', 'nav', '.ar5iv-footer', 'script', 'style', 'noscript',
        '.ltx_role_navigation', '[role="navigation"]', '.ltx_page_navbar'
      ];
      selectorsToRemove.forEach(selector => {
        mainContent.querySelectorAll(selector).forEach(el => el.remove());
      });
      
      const content = mainContent.innerHTML;
      logger.debug('ar5iv content extracted:', { title, length: content.length });
      
      return { title, content, excerpt };
    } catch (error) {
      logger.error('HTML cleaning failed:', error);
      throw error;
    }
  }

  /**
   * 将 HTML 转换为 Markdown（委托给 Content Script）
   */
  async toMarkdown(html, tabId) {
    try {
      const markdown = await this._convertToMarkdownInContentScript(html, tabId);
      logger.debug(`Converted to Markdown: ${markdown.length} bytes`);
      return markdown;
    } catch (error) {
      logger.error('Markdown conversion failed:', error);
      throw error;
    }
  }

  /**
   * 完整转换流程：ar5iv → Markdown
   */
  async convert(arxivId, tabId) {
    logger.info(`Starting ar5iv conversion for ${arxivId}`);
    
    try {
      const available = await this.checkAvailability(arxivId);
      if (!available) {
        throw new Error('ar5iv version not available');
      }
      
      const html = await this.fetchHtml(arxivId);
      const cleaned = this.cleanHtml(html);
      const markdown = await this.toMarkdown(cleaned.content, tabId);
      
      const markdownWithMeta = this._addMetadata(markdown, {
        title: cleaned.title,
        arxivId: arxivId,
        source: 'ar5iv'
      });
      
      logger.info(`ar5iv conversion successful for ${arxivId}`);
      
      const finalTitle = cleaned.title || `arXiv ${arxivId}`;
      return {
        markdown: markdownWithMeta,
        title: finalTitle,
        excerpt: cleaned.excerpt,
        metadata: {
          arxivId: arxivId,
          source: 'ar5iv',
          conversionTime: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error(`ar5iv conversion failed for ${arxivId}:`, error);
      throw error;
    }
  }

  /**
   * 添加 YAML frontmatter 元数据
   * @private
   */
  _addMetadata(markdown, metadata) {
    return `---
title: ${metadata.title}
arxiv_id: ${metadata.arxivId}
source: ${metadata.source}
---

${markdown}`;
  }
}

// 导出单例
export default new Ar5ivConverter();

