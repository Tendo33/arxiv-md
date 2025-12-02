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
   * @param {number} tabId - 当前 Tab ID（用于 Content Script 通信）
   * @returns {Promise<Object>} {success, tier, filename, error}
   */
  async convert(paperInfo, onProgress = null, tabId = null) {
    const { arxivId, title, authors, year } = paperInfo;
    
    console.log('[CONVERTER] 🎯 开始转换流程:', { arxivId, title });
    logger.info('Starting conversion:', arxivId);
    
    // 获取配置
    console.log('[CONVERTER] 📖 读取配置...');
    const mode = await storage.getConversionMode();
    const mineruToken = await storage.getMinerUToken();
    console.log('[CONVERTER] ⚙️ 配置信息:', { mode, hasToken: !!mineruToken });
    
    // 根据模式选择策略
    if (mode === CONVERSION_MODE.ALWAYS_MINERU && mineruToken) {
      console.log('[CONVERTER] 🔄 使用 MinerU 模式');
      return this._convertWithMinerU(paperInfo, onProgress, tabId);
    }
    
    // 默认：三层降级策略
    console.log('[CONVERTER] 🎚️ 使用三层降级策略');
    return this._convertWithTieredStrategy(paperInfo, mode, mineruToken, onProgress, tabId);
  }

  /**
   * 三层降级转换策略
   * @private
   */
  async _convertWithTieredStrategy(paperInfo, mode, mineruToken, onProgress, tabId) {
    const { arxivId, title } = paperInfo;
    console.log('[CONVERTER] 🎚️ 开始三层降级策略');
    
    // === Tier 1: ar5iv + 本地 Turndown ===
    try {
      console.log('[CONVERTER] 📝 Tier 1: 尝试 ar5iv 转换');
      if (onProgress) {
        console.log('[CONVERTER] ➡️ 发送进度: ar5iv checking 0%');
        onProgress({ tier: 'ar5iv', stage: 'checking', progress: 0 });
      }
      
      logger.info('Tier 1: Trying ar5iv conversion...');
      const result = await ar5ivConverter.convert(arxivId, tabId);
      console.log('[CONVERTER] ✅ ar5iv 转换成功, 结果:', {
        title: result.title,
        hasMarkdown: !!result.markdown,
        markdownLength: result.markdown?.length
      });
      
      // 转换成功，生成文件名并下载
      console.log('[CONVERTER] 📋 准备生成文件名, 元数据:', {
        title: result.title || title,
        authors: paperInfo.authors,
        year: paperInfo.year,
        arxivId: arxivId
      });
      
      const filename = generateFilename({
        title: result.title || title,
        authors: paperInfo.authors,
        year: paperInfo.year,
        arxivId: arxivId
      }, 'md');
      
      console.log('[CONVERTER] ✅ 文件名生成完成:', filename);
      
      // 发送到 Content Script 执行下载（使用 <a> download 属性）
      await this._downloadViaContentScript(result.markdown, filename, tabId);
      
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
  async _convertWithMinerU(paperInfo, onProgress, tabId) {
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
      
      // 优先使用 Content Script 下载，回退到 downloads API
      if (tabId) {
        await this._downloadViaContentScript(result.markdown, filename, tabId);
      } else {
        await this._downloadMarkdown(result.markdown, filename);
      }
      
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
   * 通过 Content Script 下载文件（使用 <a> download 属性）
   * @private
   */
  async _downloadViaContentScript(content, filename, tabId) {
    console.log('[CONVERTER] 📥 准备通过 Content Script 下载');
    console.log('[CONVERTER] 📄 文件名:', filename);
    console.log('[CONVERTER] 📦 内容长度:', content.length, 'bytes');
    
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tabId,
        {
          type: 'DOWNLOAD_FILE',
          data: {
            content: content,
            filename: filename,
            mimeType: 'text/markdown;charset=utf-8'
          }
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('[CONVERTER] ❌ Content Script 下载失败:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response && response.success) {
            console.log('[CONVERTER] ✅ 下载成功!');
            resolve();
          } else {
            reject(new Error(response?.error || '下载失败'));
          }
        }
      );
    });
  }
  
  /**
   * 下载 Markdown 文件（回退方案：使用 downloads API）
   * @private
   */
  async _downloadMarkdown(content, filename) {
    console.log('[CONVERTER] 📥 准备下载 Markdown (downloads API)');
    console.log('[CONVERTER] 📄 文件名:', filename);
    console.log('[CONVERTER] 📦 内容长度:', content.length, 'bytes');
    
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    downloadBlob(blob, filename);
  }
}

// 导出单例
export default new MainConverter();

