// 主转换器

import ar5ivConverter from "./ar5iv-converter";
import mineruClient from "./mineru-client";
import storage from "@utils/storage";
import logger from "@utils/logger";
import {
  CONVERSION_TIER,
  CONVERSION_MODE,
  ERROR_MESSAGES,
  API,
} from "@config/constants";
import {
  generateFilename,
  downloadBlob,
  downloadFile,
  showNotification,
} from "@utils/helpers";

/**
 * 主转换器 - 智能三层降级架构
 */
class MainConverter {
  async convert(paperInfo, onProgress = null, tabId = null) {
    const { arxivId } = paperInfo;
    logger.info("Starting conversion:", arxivId);

    const mode = await storage.getConversionMode();
    const mineruToken = await storage.getMinerUToken();

    if (mode === CONVERSION_MODE.ALWAYS_MINERU && mineruToken) {
      return this._convertWithMinerU(paperInfo, onProgress, tabId);
    }

    return this._convertWithTieredStrategy(
      paperInfo,
      mode,
      mineruToken,
      onProgress,
      tabId,
    );
  }

  async _convertWithTieredStrategy(
    paperInfo,
    mode,
    mineruToken,
    onProgress,
    tabId,
  ) {
    const { arxivId, title } = paperInfo;

    // Tier 1: ar5iv
    try {
      if (onProgress)
        onProgress({ tier: "ar5iv", stage: "checking", progress: 0 });
      logger.info("Tier 1: Trying ar5iv conversion...");

      const result = await ar5ivConverter.convert(arxivId, tabId);
      const filename = generateFilename(
        {
          title: result.title || title,
          authors: paperInfo.authors,
          year: paperInfo.year,
          arxivId: arxivId,
        },
        "md",
      );

      await this._downloadViaContentScript(result.markdown, filename, tabId);
      await storage.incrementConversion(CONVERSION_TIER.AR5IV_LOCAL);

      if (onProgress)
        onProgress({ tier: "ar5iv", stage: "completed", progress: 100 });
      showNotification(
        "✅ 转换完成",
        `已保存：${filename}\n方式：ar5iv`,
        "basic",
      );
      logger.info("Tier 1 success:", filename);

      return { success: true, tier: CONVERSION_TIER.AR5IV_LOCAL, filename };
    } catch (ar5ivError) {
      logger.warn("Tier 1 failed:", ar5ivError.message);

      // Tier 2: PDF Fallback
      return this._fallbackToPdf(paperInfo, onProgress);
    }
  }

  async _convertWithMinerU(paperInfo, onProgress, tabId) {
    const { arxivId, title, pdfUrl } = paperInfo;
    logger.info("Tier 2: Trying MinerU conversion...");

    const mineruToken = await storage.getMinerUToken();
    if (!mineruToken) {
      throw new Error(ERROR_MESSAGES.MINERU_TOKEN_MISSING);
    }

    try {
      const result = await mineruClient.convert(
        pdfUrl || `${API.ARXIV_PDF}/${arxivId}.pdf`,
        mineruToken,
        paperInfo,
        onProgress,
      );

      const filename = generateFilename(
        {
          title: title,
          authors: paperInfo.authors,
          year: paperInfo.year,
          arxivId: arxivId,
        },
        "md",
      );

      if (tabId) {
        await this._downloadViaContentScript(result.markdown, filename, tabId);
      } else {
        await this._downloadMarkdown(result.markdown, filename);
      }

      await storage.incrementConversion(CONVERSION_TIER.MINERU_API);
      if (onProgress)
        onProgress({ tier: "mineru", stage: "completed", progress: 100 });
      showNotification(
        "✅ 高质量转换完成",
        `已保存：${filename}\n方式：MinerU (深度解析)`,
        "basic",
      );
      logger.info("Tier 2 success:", filename);

      return { success: true, tier: CONVERSION_TIER.MINERU_API, filename };
    } catch (error) {
      logger.error("MinerU conversion failed:", error);
      throw error;
    }
  }

  async _fallbackToPdf(paperInfo, onProgress) {
    const { arxivId, title } = paperInfo;
    logger.info("Tier 2: Falling back to PDF download...");

    if (onProgress)
      onProgress({ tier: "pdf", stage: "downloading", progress: 0 });

    try {
      const filename = generateFilename(
        {
          title: title,
          authors: paperInfo.authors,
          year: paperInfo.year,
          arxivId: arxivId,
        },
        "pdf",
      );

      const pdfUrl = paperInfo.pdfUrl || `${API.ARXIV_PDF}/${arxivId}.pdf`;
      await downloadFile(pdfUrl, filename);
      await storage.incrementConversion(CONVERSION_TIER.PDF_FALLBACK);

      if (onProgress)
        onProgress({ tier: "pdf", stage: "completed", progress: 100 });
      showNotification("ℹ️ 已保存为 PDF", `文件：${filename}`, "basic");
      logger.info("Tier 2 success:", filename);

      return { success: true, tier: CONVERSION_TIER.PDF_FALLBACK, filename };
    } catch (error) {
      logger.error("PDF download failed:", error);
      showNotification(
        "❌ 转换失败",
        error.message || ERROR_MESSAGES.UNKNOWN_ERROR,
        "basic",
      );
      return {
        success: false,
        tier: CONVERSION_TIER.PDF_FALLBACK,
        error: error.message,
      };
    }
  }

  async downloadPdf(paperInfo, tabId = null) {
    const { arxivId } = paperInfo;
    logger.info("Direct PDF download requested:", arxivId);
    logger.debug("Full paperInfo:", paperInfo);

    try {
      // 使用与 Markdown 相同的文件名格式: (Year) Title - FirstAuthor.pdf
      const filename = generateFilename(
        {
          title: paperInfo.title,
          authors: paperInfo.authors,
          year: paperInfo.year,
          arxivId: arxivId,
        },
        "pdf",
      );

      logger.debug("Generated filename:", filename);

      const pdfUrl = paperInfo.pdfUrl || `${API.ARXIV_PDF}/${arxivId}.pdf`;
      await downloadFile(pdfUrl, filename);

      showNotification("✅ PDF 已保存", `文件：${filename}`, "basic");
      logger.info("PDF download success:", filename);

      return { success: true, filename };
    } catch (error) {
      logger.error("PDF download failed:", error);
      showNotification(
        "❌ 下载失败",
        error.message || ERROR_MESSAGES.UNKNOWN_ERROR,
        "basic",
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 通过 Content Script 下载文件
   * @private
   */
  async _downloadViaContentScript(content, filename, tabId) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tabId,
        {
          type: "DOWNLOAD_FILE",
          data: { content, filename, mimeType: "text/markdown;charset=utf-8" },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response && response.success) {
            resolve();
          } else {
            reject(new Error(response?.error || "下载失败"));
          }
        },
      );
    });
  }

  /**
   * 下载 Markdown 文件（回退方案）
   * @private
   */
  async _downloadMarkdown(content, filename) {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    downloadBlob(blob, filename);
  }
}

// 导出单例
export default new MainConverter();
