// {{RIPER-7 Action}}
// Role: LD | Task_ID: #2 | Time: 2025-12-02T11:12:00+08:00
// Logic: ar5iv HTML → Markdown 转换器（Plan B: 在 Content Script 中执行 Turndown）
// Principle: SOLID-S (Single Responsibility - 专注 ar5iv 转换) + 环境适配

import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import { API } from '@config/constants';
import logger from '@utils/logger';

class Ar5ivConverter {
  constructor() {
    // Plan B: 不再在 Service Worker 中初始化 Turndown
    // 转换将在 Content Script (真实浏览器环境) 中执行
  }

  /**
   * 发送 HTML 到 Content Script 进行 Markdown 转换
   * @private
   * @param {string} html - HTML 内容
   * @param {number} tabId - 当前 Tab ID
   * @returns {Promise<string>} Markdown 内容
   */
  async _convertToMarkdownInContentScript(html, tabId) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tabId,
        {
          type: 'CONVERT_HTML_TO_MARKDOWN',
          data: { html }
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(`Content script communication failed: ${chrome.runtime.lastError.message}`));
            return;
          }
          
          if (response && response.success) {
            resolve(response.markdown);
          } else {
            reject(new Error(response?.error || 'Markdown conversion failed'));
          }
        }
      );
    });
  }

  /**
   * 检查 ar5iv 版本是否存在
   * @param {string} arxivId - arXiv ID
   * @returns {Promise<boolean>}
   */
  async checkAvailability(arxivId) {
    const url = `${API.AR5IV_BASE}/${arxivId}`;
    console.log(`[AR5IV] 🌐 检查 URL:`, url);
    
    try {
      const response = await fetch(url, { method: 'HEAD' });
      console.log(`[AR5IV] 📡 响应状态:`, response.status, response.statusText);
      console.log(`[AR5IV] ${response.ok ? '✅' : '❌'} ar5iv 可用性:`, response.ok);
      logger.debug(`ar5iv availability check: ${arxivId} -> ${response.ok}`);
      return response.ok;
    } catch (error) {
      console.error(`[AR5IV] ❌ 可用性检查失败:`, error);
      logger.error('ar5iv availability check failed:', error);
      return false;
    }
  }

  /**
   * 获取 ar5iv HTML 内容
   * @param {string} arxivId - arXiv ID
   * @returns {Promise<string>} HTML 内容
   */
  async fetchHtml(arxivId) {
    const url = `${API.AR5IV_BASE}/${arxivId}`;
    console.log(`[AR5IV] 🌐 获取 HTML:`, url);
    
    try {
      const response = await fetch(url);
      console.log(`[AR5IV] 📡 响应状态:`, response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      console.log(`[AR5IV] ✅ HTML 获取成功:`, html.length, 'bytes');
      logger.debug(`Fetched ar5iv HTML: ${html.length} bytes`);
      return html;
    } catch (error) {
      console.error(`[AR5IV] ❌ HTML 获取失败:`, error);
      logger.error('Failed to fetch ar5iv HTML:', error);
      throw error;
    }
  }

  /**
   * 使用 Readability 清洗 HTML
   * @param {string} html - 原始 HTML
   * @returns {Object} {title, content, excerpt}
   */
  cleanHtml(html) {
    try {
      console.log(`[AR5IV] 🧹 使用 linkedom 解析 HTML...`);
      // 创建 DOM（使用 linkedom 以支持 Service Worker 环境）
      const { document } = parseHTML(html);
      
      console.log(`[AR5IV] 📖 使用 Readability 提取内容...`);
      // 使用 Readability 提取主要内容
      const reader = new Readability(document);
      const article = reader.parse();
      
      if (!article) {
        throw new Error('Readability failed to parse document');
      }
      
      logger.debug('Readability extracted:', {
        title: article.title,
        length: article.content.length
      });
      
      return {
        title: article.title,
        content: article.content,
        excerpt: article.excerpt
      };
    } catch (error) {
      logger.error('HTML cleaning failed:', error);
      throw error;
    }
  }

  /**
   * 将 HTML 转换为 Markdown（委托给 Content Script）
   * @param {string} html - HTML 内容
   * @param {number} tabId - 当前 Tab ID
   * @returns {Promise<string>} Markdown 内容
   */
  async toMarkdown(html, tabId) {
    try {
      // Plan B: 在 Content Script (真实浏览器环境) 中执行转换
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
   * @param {string} arxivId - arXiv ID
   * @param {number} tabId - 当前 Tab ID（用于 Content Script 通信）
   * @returns {Promise<Object>} {markdown, title, metadata}
   */
  async convert(arxivId, tabId) {
    console.log(`[AR5IV] 🎯 开始 ar5iv 转换:`, arxivId);
    logger.info(`Starting ar5iv conversion for ${arxivId}`);
    
    try {
      // 1. 检查可用性
      console.log(`[AR5IV] 🔍 检查 ar5iv 可用性...`);
      const available = await this.checkAvailability(arxivId);
      console.log(`[AR5IV] 📊 可用性检查结果:`, available);
      if (!available) {
        throw new Error('ar5iv version not available');
      }
      
      // 2. 获取 HTML
      console.log(`[AR5IV] ⬇️ 获取 HTML 内容...`);
      const html = await this.fetchHtml(arxivId);
      console.log(`[AR5IV] ✅ HTML 获取成功:`, html.length, 'bytes');
      
      // 3. 清洗 HTML
      console.log(`[AR5IV] 🧹 清洗 HTML...`);
      const cleaned = this.cleanHtml(html);
      console.log(`[AR5IV] ✅ HTML 清洗完成, 标题:`, cleaned.title);
      
      // 4. 转换为 Markdown (在 Content Script 中执行)
      console.log(`[AR5IV] 📝 转换为 Markdown (委托给 Content Script)...`);
      const markdown = await this.toMarkdown(cleaned.content, tabId);
      console.log(`[AR5IV] ✅ Markdown 转换完成:`, markdown.length, 'bytes');
      
      // 5. 添加元数据头部
      console.log(`[AR5IV] 📋 添加元数据...`);
      const markdownWithMeta = this._addMetadata(markdown, {
        title: cleaned.title,
        arxivId: arxivId,
        source: 'ar5iv'
      });
      
      logger.info(`ar5iv conversion successful for ${arxivId}`);
      
      // 确保标题存在
      const finalTitle = cleaned.title || `arXiv ${arxivId}`;
      console.log('[AR5IV] 📋 最终标题:', finalTitle);
      
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
   * 添加元数据头部
   * @private
   */
  _addMetadata(markdown, metadata) {
    const header = `---
title: ${metadata.title}
arxiv_id: ${metadata.arxivId}
source: ${metadata.source}
---

`;
    return header + markdown;
  }
}

// 导出单例
export default new Ar5ivConverter();

