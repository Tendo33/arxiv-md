// {{RIPER-7 Action}}
// Role: LD | Task_ID: #2 | Time: 2025-12-02T11:12:00+08:00
// Logic: ar5iv HTML → Markdown 转换器（Plan B: 在 Content Script 中执行 Turndown）
// Principle: SOLID-S (Single Responsibility - 专注 ar5iv 转换) + 环境适配

// 不再使用 Readability，因为它会丢失学术论文的复杂内容（表格、公式等）
// import { Readability } from '@mozilla/readability';
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
   * 针对 ar5iv 的 HTML 清洗（不使用 Readability，避免内容丢失）
   * @param {string} html - 原始 HTML
   * @returns {Object} {title, content, excerpt}
   */
  cleanHtml(html) {
    try {
      console.log(`[AR5IV] 🧹 使用 linkedom 解析 HTML...`);
      // 创建 DOM（使用 linkedom 以支持 Service Worker 环境）
      const { document } = parseHTML(html);
      
      // ar5iv 特有的 HTML 结构：
      // - <article class="ltx_document"> 主文档容器
      // - <h1 class="ltx_title"> 标题
      // - <div class="ltx_abstract"> 摘要
      // - <section class="ltx_section"> 各章节
      
      console.log(`[AR5IV] 📖 直接提取 ar5iv 主内容（跳过 Readability）...`);
      
      // 1. 提取标题
      let title = '';
      const titleEl = document.querySelector('.ltx_title.ltx_title_document, h1.ltx_title, .ltx_title');
      if (titleEl) {
        title = titleEl.textContent.trim();
        console.log(`[AR5IV] 📌 提取到标题:`, title);
      }
      
      // 2. 提取摘要（用于 excerpt）
      let excerpt = '';
      const abstractEl = document.querySelector('.ltx_abstract');
      if (abstractEl) {
        const abstractText = abstractEl.querySelector('.ltx_p');
        if (abstractText) {
          excerpt = abstractText.textContent.trim().substring(0, 300);
        }
      }
      
      // 3. 获取主内容容器
      let mainContent = document.querySelector('article.ltx_document');
      if (!mainContent) {
        mainContent = document.querySelector('.ltx_page_main');
      }
      if (!mainContent) {
        mainContent = document.querySelector('main');
      }
      if (!mainContent) {
        // 回退：使用整个 body
        mainContent = document.body;
      }
      
      if (!mainContent) {
        throw new Error('Cannot find main content in ar5iv page');
      }
      
      console.log(`[AR5IV] 📄 找到主内容容器:`, mainContent.tagName, mainContent.className);
      
      // 4. 移除不需要的元素（导航、页脚、侧边栏等）
      const selectorsToRemove = [
        '.ltx_page_header',     // 页头
        '.ltx_page_footer',     // 页脚
        '.ltx_page_logo',       // Logo
        '.ltx_sidebar',         // 侧边栏
        '.ltx_TOC',             // 目录（可选保留）
        'nav',                  // 导航
        '.ar5iv-footer',        // ar5iv 页脚
        'script',               // 脚本
        'style',                // 样式
        'noscript',             // noscript
        '.ltx_role_navigation', // 导航角色
        '[role="navigation"]',  // 导航角色
        '.ltx_page_navbar',     // 导航栏
      ];
      
      selectorsToRemove.forEach(selector => {
        mainContent.querySelectorAll(selector).forEach(el => {
          console.log(`[AR5IV] 🗑️ 移除:`, selector);
          el.remove();
        });
      });
      
      // 5. 获取清洗后的 HTML
      const content = mainContent.innerHTML;
      
      console.log(`[AR5IV] ✅ 内容提取完成:`, content.length, 'bytes');
      logger.debug('ar5iv content extracted:', {
        title: title,
        length: content.length
      });
      
      return {
        title: title,
        content: content,
        excerpt: excerpt
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

