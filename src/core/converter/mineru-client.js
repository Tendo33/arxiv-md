// {{RIPER-7 Action}}
// Role: LD | Task_ID: MinerU-Refactor | Time: 2025-12-22
// Logic: 根据 MinerU 官方 API 文档 (https://mineru.net/apiManage/docs) 重构客户端
// Principle: SOLID-S (单一职责)

import { API, DEFAULTS, ERROR_MESSAGES } from "@config/constants";
// Note: Batch APIs (MINERU_FILE_URLS, MINERU_BATCH_TASK, MINERU_BATCH_RESULT) removed - not implemented
import logger from "@utils/logger";
import { sleep } from "@utils/helpers";

/**
 * MinerU API 客户端
 * 
 * 官方 API 文档: https://mineru.net/apiManage/docs
 * 
 * 工作流程：
 * 1. 提交 arXiv PDF 的公开 URL 创建解析任务
 * 2. 轮询任务状态直到完成
 * 3. 返回 ZIP 文件 URL，由调用方下载保存
 */
class MinerUClient {
  constructor() {
    this.taskUrl = API.MINERU_TASK;
    this.pollInterval = DEFAULTS.POLL_INTERVAL;
    this.maxPollAttempts = DEFAULTS.MAX_POLL_ATTEMPTS;
  }

  /**
   * 创建解析任务 (通过 PDF URL)
   * @param {string} pdfUrl - PDF 文件的公开 URL (如 arXiv PDF 链接)
   * @param {string} token - MinerU API Token
   * @param {Object} options - 可选配置
   * @returns {Promise<string>} task_id
   */
  async createTask(pdfUrl, token, options = {}) {
    logger.info("Creating MinerU task:", pdfUrl);

    try {
      const response = await fetch(this.taskUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: pdfUrl,
          model_version: options.modelVersion || "vlm",
          ...(options.dataId && { data_id: options.dataId }),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error(ERROR_MESSAGES.MINERU_TOKEN_MISSING);
        } else if (response.status === 429) {
          throw new Error(ERROR_MESSAGES.MINERU_QUOTA_EXCEEDED);
        } else {
          throw new Error(
            errorData.msg || errorData.message || ERROR_MESSAGES.MINERU_API_ERROR
          );
        }
      }

      const result = await response.json();

      if (result.code !== 0) {
        throw new Error(result.msg || "API returned error code: " + result.code);
      }

      const taskId = result.data?.task_id;
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

  /**
   * 查询任务状态
   * @param {string} taskId - 任务 ID
   * @param {string} token - MinerU API Token
   * @returns {Promise<Object>} 任务状态
   */
  async queryTask(taskId, token) {
    try {
      // 官方端点: GET /api/v4/extract/task/{task_id}
      const response = await fetch(`${this.taskUrl}/${taskId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.code !== 0) {
        throw new Error(result.msg || "Query failed");
      }

      const data = result.data || {};
      return {
        taskId: data.task_id,
        state: data.state, // "done" | "running" | "failed"
        progress: data.extract_progress || null,
        zipUrl: data.full_zip_url || null,
        error: data.err_msg || null,
      };
    } catch (error) {
      logger.error("Failed to query MinerU task:", error);
      throw error;
    }
  }

  /**
   * 轮询任务直到完成
   * @param {string} taskId - 任务 ID
   * @param {string} token - MinerU API Token
   * @param {Function} onProgress - 进度回调
   * @returns {Promise<string>} ZIP 文件 URL
   */
  async pollTask(taskId, token, onProgress = null) {
    logger.info("Polling MinerU task:", taskId);
    let attempts = 0;

    while (attempts < this.maxPollAttempts) {
      attempts++;

      try {
        const status = await this.queryTask(taskId, token);

        // 计算进度百分比
        let progressPercent = 0;
        if (status.progress) {
          const { extracted_pages, total_pages } = status.progress;
          if (total_pages > 0) {
            progressPercent = Math.round((extracted_pages / total_pages) * 100);
          }
        }

        if (onProgress && typeof onProgress === "function") {
          onProgress({
            progress: progressPercent,
            state: status.state,
            attempt: attempts,
            extractedPages: status.progress?.extracted_pages,
            totalPages: status.progress?.total_pages,
          });
        }

        // 官方状态值: "done" | "running" | "failed"
        if (status.state === "done") {
          logger.info("MinerU task completed:", taskId);
          if (!status.zipUrl) {
            throw new Error("Completed task has no result URL");
          }
          return status.zipUrl;
        }

        if (status.state === "failed") {
          throw new Error(status.error || "Task failed");
        }

        // 状态为 "running"，继续等待
        await sleep(this.pollInterval);
      } catch (error) {
        if (attempts >= this.maxPollAttempts) {
          throw error;
        }
        logger.warn(`Poll attempt ${attempts} failed, retrying...`);
        await sleep(this.pollInterval);
      }
    }

    throw new Error("Task polling timeout");
  }

  /**
   * 下载 ZIP 文件
   * @param {string} zipUrl - ZIP 文件 URL
   * @returns {Promise<Blob>} ZIP 文件 Blob
   */
  async downloadZip(zipUrl) {
    logger.info("Downloading ZIP:", zipUrl);

    try {
      const response = await fetch(zipUrl);
      if (!response.ok) {
        throw new Error(`Failed to download ZIP: ${response.status}`);
      }

      const blob = await response.blob();
      logger.info(`Downloaded ZIP: ${blob.size} bytes`);
      return blob;
    } catch (error) {
      logger.error("Failed to download ZIP:", error);
      throw error;
    }
  }

  /**
   * 完整转换流程：提交 PDF URL -> 轮询 -> 返回/下载 ZIP
   * @param {string} pdfUrl - arXiv PDF URL
   * @param {string} token - MinerU API Token
   * @param {Object} metadata - 元数据
   * @param {Function} onProgress - 进度回调
   * @returns {Promise<Object>} 转换结果 (包含 zipUrl 和 zipBlob)
   */
  async convert(pdfUrl, token, metadata = {}, onProgress = null) {
    logger.info("Starting MinerU conversion:", pdfUrl);

    try {
      if (onProgress) onProgress({ stage: "submitting", progress: 0 });

      // 创建任务
      const taskId = await this.createTask(pdfUrl, token, {
        dataId: metadata.arxivId,
        modelVersion: "vlm",
      });

      if (onProgress) onProgress({ stage: "processing", progress: 10 });

      // 轮询任务状态
      const zipUrl = await this.pollTask(taskId, token, (pollStatus) => {
        if (onProgress) {
          onProgress({
            stage: "processing",
            progress: 10 + (pollStatus.progress || 0) * 0.8,
            state: pollStatus.state,
            extractedPages: pollStatus.extractedPages,
            totalPages: pollStatus.totalPages,
          });
        }
      });

      if (onProgress) onProgress({ stage: "downloading", progress: 90 });

      // 下载 ZIP 文件
      const zipBlob = await this.downloadZip(zipUrl);

      if (onProgress) onProgress({ stage: "completed", progress: 100 });
      logger.info("MinerU conversion successful");

      return {
        zipUrl,
        zipBlob,
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
}

// 导出单例
export default new MinerUClient();
