// MinerU API 客户端

import { API, DEFAULTS, ERROR_MESSAGES } from "@config/constants";
import logger from "@utils/logger";
import { sleep } from "@utils/helpers";

class MinerUClient {
  constructor() {
    this.taskUrl = API.MINERU_TASK;
    this.resultUrl = API.MINERU_RESULT;
    this.pollInterval = DEFAULTS.POLL_INTERVAL;
    this.maxPollAttempts = DEFAULTS.MAX_POLL_ATTEMPTS;
  }

  async createTask(pdfBlob, token, filename = "paper.pdf") {
    logger.info("Creating MinerU task:", filename);

    try {
      const formData = new FormData();
      formData.append("file", pdfBlob, filename);

      const response = await fetch(this.taskUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error(ERROR_MESSAGES.MINERU_TOKEN_MISSING);
        } else if (response.status === 429) {
          throw new Error(ERROR_MESSAGES.MINERU_QUOTA_EXCEEDED);
        } else {
          throw new Error(errorData.message || ERROR_MESSAGES.MINERU_API_ERROR);
        }
      }

      const result = await response.json();
      const taskId = result.task_id || result.taskId || result.id;

      if (!taskId) {
        throw new Error("Invalid API response: missing task_id");
      }

      logger.info("MinerU task created:", taskId);
      return taskId;
    } catch (error) {
      logger.error("Failed to create MinerU task:", error);
      throw error;
    }
  }

  async queryTask(taskId, token) {
    try {
      const response = await fetch(`${this.resultUrl}/${taskId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        state: data.state || data.status,
        progress: data.progress || 0,
        result: data.result || data.markdown || null,
        error: data.error || null,
      };
    } catch (error) {
      logger.error("Failed to query MinerU task:", error);
      throw error;
    }
  }

  async pollTask(taskId, token, onProgress = null) {
    logger.info("Polling MinerU task:", taskId);
    let attempts = 0;

    while (attempts < this.maxPollAttempts) {
      attempts++;

      try {
        const status = await this.queryTask(taskId, token);

        if (onProgress && typeof onProgress === "function") {
          onProgress({
            progress: status.progress,
            state: status.state,
            attempt: attempts,
          });
        }

        if (status.state === "completed" || status.state === "success") {
          logger.info("MinerU task completed:", taskId);
          if (!status.result) {
            throw new Error("Completed task has no result");
          }
          return status.result;
        }

        if (status.state === "failed" || status.state === "error") {
          throw new Error(status.error || "Task failed");
        }

        await sleep(this.pollInterval);
      } catch (error) {
        if (attempts >= this.maxPollAttempts) {
          throw error;
        }
        logger.warn(`Poll attempt ${attempts} failed, retrying...`);
      }
    }

    throw new Error("Task polling timeout");
  }

  async convert(pdfUrl, token, metadata = {}, onProgress = null) {
    logger.info("Starting MinerU conversion:", pdfUrl);

    try {
      if (onProgress) onProgress({ stage: "downloading", progress: 0 });
      const pdfBlob = await this._downloadPdf(pdfUrl);

      if (onProgress) onProgress({ stage: "uploading", progress: 20 });
      const filename = `${metadata.arxivId || "paper"}.pdf`;
      const taskId = await this.createTask(pdfBlob, token, filename);

      if (onProgress) onProgress({ stage: "processing", progress: 40 });
      const markdown = await this.pollTask(taskId, token, (pollStatus) => {
        if (onProgress) {
          onProgress({
            stage: "processing",
            progress: 40 + (pollStatus.progress || 0) * 0.6,
            state: pollStatus.state,
          });
        }
      });

      const markdownWithMeta = this._addMetadata(markdown, {
        ...metadata,
        source: "mineru",
        taskId,
      });
      if (onProgress) onProgress({ stage: "completed", progress: 100 });
      logger.info("MinerU conversion successful");

      return {
        markdown: markdownWithMeta,
        metadata: {
          ...metadata,
          source: "mineru",
          taskId,
          conversionTime: new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error("MinerU conversion failed:", error);
      throw error;
    }
  }

  /**
   * 下载 PDF 文件
   * @private
   */
  async _downloadPdf(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      logger.debug(`Downloaded PDF: ${blob.size} bytes`);

      if (blob.size > DEFAULTS.MAX_FILE_SIZE) {
        throw new Error("PDF file too large (max 200MB)");
      }
      return blob;
    } catch (error) {
      logger.error("PDF download failed:", error);
      throw error;
    }
  }

  /**
   * 添加 YAML frontmatter 元数据
   * @private
   */
  _addMetadata(markdown, metadata) {
    return `---
title: ${metadata.title || "Untitled"}
arxiv_id: ${metadata.arxivId || "unknown"}
source: ${metadata.source}
mineru_task_id: ${metadata.taskId}
converted_at: ${new Date().toISOString()}
---

${markdown}`;
  }
}

// 导出单例
export default new MinerUClient();
