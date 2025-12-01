// {{RIPER-7 Action}}
// Role: LD | Task_ID: #4 | Time: 2025-12-01T21:18:25+08:00
// Logic: 从 arXiv 页面提取论文元数据（标题、作者、年份、ID 等）
// Principle: SOLID-S (Single Responsibility - 元数据提取)

import { extractArxivId } from '@utils/helpers';
import logger from '@utils/logger';

/**
 * 元数据提取器 - 从 arXiv 页面提取论文信息
 */
class MetadataExtractor {
  /**
   * 从 arXiv Abstract 页面提取元数据
   * @param {Document} doc - DOM Document
   * @returns {Object} 论文元数据
   */
  extractFromAbsPage(doc = document) {
    logger.debug('Extracting metadata from abstract page');
    
    try {
      // 提取标题
      const titleElement = doc.querySelector('h1.title.mathjax');
      const title = titleElement 
        ? titleElement.textContent.replace('Title:', '').trim()
        : null;
      
      // 提取作者
      const authorsElement = doc.querySelector('.authors');
      const authors = authorsElement
        ? Array.from(authorsElement.querySelectorAll('a'))
          .map(a => a.textContent.trim())
        : [];
      
      // 提取摘要
      const abstractElement = doc.querySelector('.abstract.mathjax');
      const abstract = abstractElement
        ? abstractElement.textContent.replace('Abstract:', '').trim()
        : null;
      
      // 提取 arXiv ID
      const arxivId = this._extractIdFromUrl(window.location.href);
      
      // 提取日期和版本
      const submissionElement = doc.querySelector('.dateline');
      const { year, version } = this._parseSubmissionDate(submissionElement?.textContent);
      
      // 提取分类
      const subjects = Array.from(doc.querySelectorAll('.subjects span.primary-subject, .subjects a'))
        .map(el => el.textContent.trim());
      
      // 构造 PDF URL
      const pdfUrl = arxivId ? `https://arxiv.org/pdf/${arxivId}.pdf` : null;
      
      const metadata = {
        arxivId,
        title,
        authors,
        abstract,
        year,
        version,
        subjects,
        pdfUrl,
        pageType: 'abstract'
      };
      
      logger.info('Extracted metadata:', metadata);
      return metadata;
      
    } catch (error) {
      logger.error('Failed to extract metadata:', error);
      return this._getMinimalMetadata();
    }
  }

  /**
   * 从 arXiv PDF 页面提取元数据（信息有限）
   * @param {Document} doc - DOM Document
   * @returns {Object} 论文元数据
   */
  extractFromPdfPage(doc = document) {
    logger.debug('Extracting metadata from PDF page');
    
    const arxivId = this._extractIdFromUrl(window.location.href);
    const pdfUrl = window.location.href;
    
    // PDF 页面信息有限，需要跳转到 Abstract 页获取完整信息
    return {
      arxivId,
      pdfUrl,
      pageType: 'pdf',
      needsFullMetadata: true,
      abstractUrl: `https://arxiv.org/abs/${arxivId}`
    };
  }

  /**
   * 通过 API 获取完整元数据（备用方案）
   * @param {string} arxivId - arXiv ID
   * @returns {Promise<Object>}
   */
  async fetchMetadataFromApi(arxivId) {
    logger.info('Fetching metadata from arXiv API:', arxivId);
    
    try {
      // arXiv 提供 export API
      const apiUrl = `https://export.arxiv.org/api/query?id_list=${arxivId}`;
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      const xmlText = await response.text();
      return this._parseArxivApiXml(xmlText);
      
    } catch (error) {
      logger.error('Failed to fetch metadata from API:', error);
      return this._getMinimalMetadata(arxivId);
    }
  }

  /**
   * 解析 arXiv API 返回的 XML
   * @private
   */
  _parseArxivApiXml(xmlText) {
    try {
      const parser = new DOMParser();
      const xml = parser.parseFromString(xmlText, 'text/xml');
      
      const entry = xml.querySelector('entry');
      if (!entry) {
        throw new Error('No entry found in API response');
      }
      
      // 提取各字段
      const title = entry.querySelector('title')?.textContent.trim();
      const summary = entry.querySelector('summary')?.textContent.trim();
      
      const authors = Array.from(entry.querySelectorAll('author name'))
        .map(name => name.textContent.trim());
      
      const published = entry.querySelector('published')?.textContent;
      const year = published ? new Date(published).getFullYear() : null;
      
      const idElement = entry.querySelector('id')?.textContent;
      const arxivId = idElement ? extractArxivId(idElement) : null;
      
      const categories = Array.from(entry.querySelectorAll('category'))
        .map(cat => cat.getAttribute('term'));
      
      return {
        arxivId,
        title,
        authors,
        abstract: summary,
        year,
        subjects: categories,
        pdfUrl: `https://arxiv.org/pdf/${arxivId}.pdf`,
        source: 'api'
      };
      
    } catch (error) {
      logger.error('Failed to parse API XML:', error);
      throw error;
    }
  }

  /**
   * 从 URL 提取 arXiv ID
   * @private
   */
  _extractIdFromUrl(url) {
    return extractArxivId(url);
  }

  /**
   * 解析提交日期文本
   * @private
   */
  _parseSubmissionDate(dateText) {
    if (!dateText) return { year: null, version: null };
    
    // 格式: "[Submitted on 12 Dec 2017 (v1), last revised 6 Jun 2018 (this version, v2)]"
    const yearMatch = dateText.match(/\b(\d{4})\b/);
    const versionMatch = dateText.match(/\(v(\d+)\)/);
    
    return {
      year: yearMatch ? parseInt(yearMatch[1]) : null,
      version: versionMatch ? parseInt(versionMatch[1]) : 1
    };
  }

  /**
   * 获取最小元数据（兜底）
   * @private
   */
  _getMinimalMetadata(arxivId = null) {
    arxivId = arxivId || this._extractIdFromUrl(window.location.href);
    
    return {
      arxivId,
      title: `arXiv Paper ${arxivId}`,
      authors: [],
      abstract: null,
      year: null,
      subjects: [],
      pdfUrl: `https://arxiv.org/pdf/${arxivId}.pdf`,
      isMinimal: true
    };
  }
}

// 导出单例
export default new MetadataExtractor();

