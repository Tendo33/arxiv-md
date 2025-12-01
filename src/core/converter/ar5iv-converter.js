// {{RIPER-7 Action}}
// Role: LD | Task_ID: #2 | Time: 2025-12-01T21:18:25+08:00
// Logic: ar5iv HTML → Markdown 转换器，使用 Readability + Turndown
// Principle: SOLID-S (Single Responsibility - 专注 ar5iv 转换)

import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { Readability } from '@mozilla/readability';
import { API } from '@config/constants';
import logger from '@utils/logger';

class Ar5ivConverter {
  constructor() {
    this.turndownService = this._initTurndown();
  }

  /**
   * 初始化 Turndown 服务
   * @private
   */
  _initTurndown() {
    const service = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      emDelimiter: '*',
      strongDelimiter: '**'
    });

    // 启用 GitHub Flavored Markdown 支持（表格、删除线等）
    service.use(gfm);

    // 自定义规则：处理 LaTeX 数学公式
    service.addRule('mathFormula', {
      filter: (node) => {
        return node.classList && (
          node.classList.contains('ltx_Math') ||
          node.classList.contains('ltx_equation')
        );
      },
      replacement: (content, node) => {
        // ar5iv 的公式在 <annotation encoding="application/x-tex"> 中
        const latexAnnotation = node.querySelector('annotation[encoding="application/x-tex"]');
        
        if (latexAnnotation) {
          const latex = latexAnnotation.textContent.trim();
          
          // 判断是行内公式还是块级公式
          const isBlock = node.classList.contains('ltx_equation') ||
                         node.classList.contains('ltx_equationgroup');
          
          if (isBlock) {
            return `\n\n$$\n${latex}\n$$\n\n`;
          } else {
            return `$${latex}$`;
          }
        }
        
        // 如果没有 LaTeX 注释，保留原始内容
        return content;
      }
    });

    // 自定义规则：处理图片
    service.addRule('arxivImages', {
      filter: 'img',
      replacement: (content, node) => {
        const alt = node.alt || 'image';
        let src = node.getAttribute('src') || '';
        
        // 处理相对路径（ar5iv 的图片通常是完整 URL）
        if (src && !src.startsWith('http')) {
          src = `https://ar5iv.org${src}`;
        }
        
        return src ? `![${alt}](${src})` : '';
      }
    });

    // 自定义规则：处理引用
    service.addRule('citations', {
      filter: (node) => {
        return node.classList && node.classList.contains('ltx_cite');
      },
      replacement: (content) => {
        return `[${content}]`;
      }
    });

    return service;
  }

  /**
   * 检查 ar5iv 版本是否存在
   * @param {string} arxivId - arXiv ID
   * @returns {Promise<boolean>}
   */
  async checkAvailability(arxivId) {
    const url = `${API.AR5IV_BASE}/${arxivId}`;
    
    try {
      const response = await fetch(url, { method: 'HEAD' });
      logger.debug(`ar5iv availability check: ${arxivId} -> ${response.ok}`);
      return response.ok;
    } catch (error) {
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
   * 使用 Readability 清洗 HTML
   * @param {string} html - 原始 HTML
   * @returns {Object} {title, content, excerpt}
   */
  cleanHtml(html) {
    try {
      // 创建 DOM
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // 使用 Readability 提取主要内容
      const reader = new Readability(doc);
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
   * 将 HTML 转换为 Markdown
   * @param {string} html - HTML 内容
   * @returns {string} Markdown 内容
   */
  toMarkdown(html) {
    try {
      const markdown = this.turndownService.turndown(html);
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
   * @returns {Promise<Object>} {markdown, title, metadata}
   */
  async convert(arxivId) {
    logger.info(`Starting ar5iv conversion for ${arxivId}`);
    
    try {
      // 1. 检查可用性
      const available = await this.checkAvailability(arxivId);
      if (!available) {
        throw new Error('ar5iv version not available');
      }
      
      // 2. 获取 HTML
      const html = await this.fetchHtml(arxivId);
      
      // 3. 清洗 HTML
      const cleaned = this.cleanHtml(html);
      
      // 4. 转换为 Markdown
      const markdown = this.toMarkdown(cleaned.content);
      
      // 5. 添加元数据头部
      const markdownWithMeta = this._addMetadata(markdown, {
        title: cleaned.title,
        arxivId: arxivId,
        source: 'ar5iv'
      });
      
      logger.info(`ar5iv conversion successful for ${arxivId}`);
      
      return {
        markdown: markdownWithMeta,
        title: cleaned.title,
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
converted_at: ${new Date().toISOString()}
---

`;
    return header + markdown;
  }
}

// 导出单例
export default new Ar5ivConverter();

