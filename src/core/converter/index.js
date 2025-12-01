// {{RIPER-7 Action}}
// Role: LD | Task_ID: #2 | Time: 2025-12-01T21:18:25+08:00
// Logic: 主转换器 - 协调三层转换策略
// Principle: SOLID-O (Open/Closed - 可扩展的转换策略)

import ar5ivConverter from './ar5iv-converter';
import mineruClient from './mineru-client';
import storage from '@utils/storage';
import logger from '@utils/logger';
import { 
  CONVERSION_TIER, 
  CONVERSION_MODE, 
  ERROR_MESSAGES,
  API 
} from '@config/constants';
import { 
  generateFilename, 
  downloadBlob,
  downloadFile,
  showNotification 
} from '@utils/helpers';

/**
 * 主转换器 - 智能三层降级架构
 */
class MainConverter {
  /**
   * 转换论文为 Markdown
   * @param {Object} paperInfo - 论文信息 {arxivId, title, authors, year, pdfUrl}
   * @param {Function} onProgress - 进度回调
   * @returns {Promise<Object>} {success, tier, filename, error}
   */
  async convert(paperInfo, onProgress = null) {
    const { arxivId, title, authors, year } = paperInfo;
    
    logger.info('Starting conversion:', arxivId);
    
    // 获取配置
    const mode = await storage.getConversionMode();
    const mineruToken = await storage.getMinerUToken();
    
    // 根据模式选择策略
    if (mode === CONVERSION_MODE.ALWAYS_MINERU && mineruToken) {
      return this._convertWithMinerU(paperInfo, onProgress);
    }
    
    // 默认：三层降级策略
    return this._convertWithTieredStrategy(paperInfo, mode, mineruToken, onProgress);
  }

  /**
   * 三层降级转换策略
   * @private
   */
  async _convertWithTieredStrategy(paperInfo, mode, mineruToken, onProgress) {
    const { arxivId, title } = paperInfo;
    
    // === Tier 1: ar5iv + 本地 Turndown ===
    try {
      if (onProgress) onProgress({ tier: 'ar5iv', stage: 'checking', progress: 0 });
      
      logger.info('Tier 1: Trying ar5iv conversion...');
      const result = await ar5ivConverter.convert(arxivId);
      
      // 转换成功，生成文件名并下载
      const filename = generateFilename({
        title: result.title || title,
        authors: paperInfo.authors,
        year: paperInfo.year,
        arxivId: arxivId
      }, 'md');
      
      await this._downloadMarkdown(result.markdown, filename);
      
      // 更新统计
      await storage.incrementConversion(CONVERSION_TIER.AR5IV_LOCAL);
      
      if (onProgress) onProgress({ tier: 'ar5iv', stage: 'completed', progress: 100 });
      
      showNotification(
        '✅ 转换完成',
        `已保存：${filename}\n方式：ar5iv (快速模式)`,
        'basic'
      );
      
      logger.info('Tier 1 success:', filename);
      
      return {
        success: true,
        tier: CONVERSION_TIER.AR5IV_LOCAL,
        filename: filename,
        duration: 0 // 实际时长可以计时
      };
      
    } catch (ar5ivError) {
      logger.warn('Tier 1 failed:', ar5ivError.message);
      
      // === Tier 2: MinerU API ===
      if (mode === CONVERSION_MODE.QUALITY && mineruToken) {
        try {
          if (onProgress) onProgress({ tier: 'mineru', stage: 'starting', progress: 0 });
          
          showNotification(
            '⚠️ ar5iv 转换失败',
            '正在使用 MinerU 深度解析...',
            'basic'
          );
          
          return await this._convertWithMinerU(paperInfo, onProgress);
          
        } catch (mineruError) {
          logger.warn('Tier 2 failed:', mineruError.message);
        }
      }
      
      // === Tier 3: PDF Fallback ===
      return this._fallbackToPdf(paperInfo, onProgress);
    }
  }

  /**
   * 使用 MinerU 转换
   * @private
   */
  async _convertWithMinerU(paperInfo, onProgress) {
    const { arxivId, title, pdfUrl } = paperInfo;
    
    logger.info('Tier 2: Trying MinerU conversion...');
    
    const mineruToken = await storage.getMinerUToken();
    
    if (!mineruToken) {
      throw new Error(ERROR_MESSAGES.MINERU_TOKEN_MISSING);
    }
    
    try {
      const result = await mineruClient.convert(
        pdfUrl || `${API.ARXIV_PDF}/${arxivId}.pdf`,
        mineruToken,
        paperInfo,
        onProgress
      );
      
      // 生成文件名并下载
      const filename = generateFilename({
        title: title,
        authors: paperInfo.authors,
        year: paperInfo.year,
        arxivId: arxivId
      }, 'md');
      
      await this._downloadMarkdown(result.markdown, filename);
      
      // 更新统计
      await storage.incrementConversion(CONVERSION_TIER.MINERU_API);
      
      if (onProgress) onProgress({ tier: 'mineru', stage: 'completed', progress: 100 });
      
      showNotification(
        '✅ 高质量转换完成',
        `已保存：${filename}\n方式：MinerU (深度解析)`,
        'basic'
      );
      
      logger.info('Tier 2 success:', filename);
      
      return {
        success: true,
        tier: CONVERSION_TIER.MINERU_API,
        filename: filename
      };
      
    } catch (error) {
      logger.error('MinerU conversion failed:', error);
      throw error;
    }
  }

  /**
   * 兜底：下载 PDF
   * @private
   */
  async _fallbackToPdf(paperInfo, onProgress) {
    const { arxivId, title } = paperInfo;
    
    logger.info('Tier 3: Falling back to PDF download...');
    
    if (onProgress) onProgress({ tier: 'pdf', stage: 'downloading', progress: 0 });
    
    try {
      const filename = generateFilename({
        title: title,
        authors: paperInfo.authors,
        year: paperInfo.year,
        arxivId: arxivId
      }, 'pdf');
      
      const pdfUrl = paperInfo.pdfUrl || `${API.ARXIV_PDF}/${arxivId}.pdf`;
      
      await downloadFile(pdfUrl, filename);
      
      // 更新统计
      await storage.incrementConversion(CONVERSION_TIER.PDF_FALLBACK);
      
      if (onProgress) onProgress({ tier: 'pdf', stage: 'completed', progress: 100 });
      
      showNotification(
        'ℹ️ 已保存为 PDF',
        `文件：${filename}\n建议配置 MinerU Token 以获得 Markdown 转换`,
        'basic'
      );
      
      logger.info('Tier 3 success:', filename);
      
      return {
        success: true,
        tier: CONVERSION_TIER.PDF_FALLBACK,
        filename: filename
      };
      
    } catch (error) {
      logger.error('PDF download failed:', error);
      
      showNotification(
        '❌ 转换失败',
        error.message || ERROR_MESSAGES.UNKNOWN_ERROR,
        'basic'
      );
      
      return {
        success: false,
        tier: CONVERSION_TIER.PDF_FALLBACK,
        error: error.message
      };
    }
  }

  /**
   * 下载 Markdown 文件
   * @private
   */
  async _downloadMarkdown(content, filename) {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    downloadBlob(blob, filename);
  }
}

// 导出单例
export default new MainConverter();

