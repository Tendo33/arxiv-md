// {{RIPER-7 Action}}
// Role: LD | Task_ID: #3 | Time: 2025-12-01T21:18:25+08:00
// Logic: MinerU API 客户端，处理 PDF 上传、任务轮询、结果获取
// Principle: SOLID-S (Single Responsibility - MinerU API 交互)

import { API, DEFAULTS, ERROR_MESSAGES } from '@config/constants';
import logger from '@utils/logger';
import { sleep } from '@utils/helpers';

class MinerUClient {
  constructor() {
    this.baseUrl = API.MINERU_BASE;
    this.taskUrl = API.MINERU_TASK;
    this.resultUrl = API.MINERU_RESULT;
    this.pollInterval = DEFAULTS.POLL_INTERVAL;
    this.maxPollAttempts = DEFAULTS.MAX_POLL_ATTEMPTS;
  }

  /**
   * 创建解析任务
   * @param {Blob} pdfBlob - PDF 文件
   * @param {string} token - API Token
   * @param {string} filename - 文件名
   * @returns {Promise<string>} Task ID
   */
  async createTask(pdfBlob, token, filename = 'paper.pdf') {
    console.log('[MINERU] 📤 创建任务:', filename, `(${pdfBlob.size} bytes)`);
    logger.info('Creating MinerU task:', filename);
    
    try {
      const formData = new FormData();
      formData.append('file', pdfBlob, filename);
      
      console.log('[MINERU] 🌐 发送请求到:', this.taskUrl);
      const response = await fetch(this.taskUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      console.log('[MINERU] 📡 响应状态:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[MINERU] ❌ API 错误响应:', errorData);
        
        if (response.status === 401) {
          throw new Error(ERROR_MESSAGES.MINERU_TOKEN_MISSING);
        } else if (response.status === 429) {
          throw new Error(ERROR_MESSAGES.MINERU_QUOTA_EXCEEDED);
        } else {
          throw new Error(errorData.message || ERROR_MESSAGES.MINERU_API_ERROR);
        }
      }
      
      const result = await response.json();
      console.log('[MINERU] 📦 API 响应:', result);
      const taskId = result.task_id || result.taskId || result.id;
      
      if (!taskId) {
        console.error('[MINERU] ❌ 响应中缺少 task_id');
        throw new Error('Invalid API response: missing task_id');
      }
      
      console.log('[MINERU] ✅ 任务创建成功:', taskId);
      logger.info('MinerU task created:', taskId);
      return taskId;
    } catch (error) {
      console.error('[MINERU] ❌ 创建任务失败:', error);
      logger.error('Failed to create MinerU task:', error);
      throw error;
    }
  }

  /**
   * 查询任务状态
   * @param {string} taskId - Task ID
   * @param {string} token - API Token
   * @returns {Promise<Object>} {state, progress, result}
   */
  async queryTask(taskId, token) {
    try {
      const response = await fetch(`${this.resultUrl}/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return {
        state: data.state || data.status,
        progress: data.progress || 0,
        result: data.result || data.markdown || null,
        error: data.error || null
      };
    } catch (error) {
      logger.error('Failed to query MinerU task:', error);
      throw error;
    }
  }

  /**
   * 轮询任务直到完成
   * @param {string} taskId - Task ID
   * @param {string} token - API Token
   * @param {Function} onProgress - 进度回调
   * @returns {Promise<string>} Markdown 内容
   */
  async pollTask(taskId, token, onProgress = null) {
    console.log('[MINERU] 🔄 开始轮询任务:', taskId);
    logger.info('Polling MinerU task:', taskId);
    
    let attempts = 0;
    
    while (attempts < this.maxPollAttempts) {
      attempts++;
      console.log(`[MINERU] 🔍 轮询尝试 ${attempts}/${this.maxPollAttempts}`);
      
      try {
        const status = await this.queryTask(taskId, token);
        console.log('[MINERU] 📊 任务状态:', status);
        
        // 回调进度
        if (onProgress && typeof onProgress === 'function') {
          console.log('[MINERU] ➡️ 发送进度更新:', status.progress, '%');
          onProgress({
            progress: status.progress,
            state: status.state,
            attempt: attempts
          });
        }
        
        // 检查状态
        if (status.state === 'completed' || status.state === 'success') {
          console.log('[MINERU] ✅ 任务完成!');
          logger.info('MinerU task completed:', taskId);
          
          if (!status.result) {
            throw new Error('Completed task has no result');
          }
          
          return status.result;
        }
        
        if (status.state === 'failed' || status.state === 'error') {
          console.error('[MINERU] ❌ 任务失败:', status.error);
          throw new Error(status.error || 'Task failed');
        }
        
        // 等待后继续轮询
        console.log(`[MINERU] ⏳ 等待 ${this.pollInterval}ms 后继续...`);
        await sleep(this.pollInterval);
        
      } catch (error) {
        if (attempts >= this.maxPollAttempts) {
          throw error;
        }
        logger.warn(`Poll attempt ${attempts} failed, retrying...`);
      }
    }
    
    throw new Error('Task polling timeout');
  }

  /**
   * 完整转换流程：PDF → Markdown
   * @param {string} pdfUrl - PDF 文件 URL
   * @param {string} token - API Token
   * @param {Object} metadata - 论文元数据
   * @param {Function} onProgress - 进度回调
   * @returns {Promise<Object>} {markdown, metadata}
   */
  async convert(pdfUrl, token, metadata = {}, onProgress = null) {
    console.log('[MINERU] 🎯 开始 MinerU 转换:', pdfUrl);
    logger.info('Starting MinerU conversion:', pdfUrl);
    
    try {
      // 1. 下载 PDF
      console.log('[MINERU] ⬇️ 下载 PDF...');
      if (onProgress) onProgress({ stage: 'downloading', progress: 0 });
      const pdfBlob = await this._downloadPdf(pdfUrl);
      console.log('[MINERU] ✅ PDF 下载完成:', pdfBlob.size, 'bytes');
      
      // 2. 创建任务
      console.log('[MINERU] 📤 创建任务...');
      if (onProgress) onProgress({ stage: 'uploading', progress: 20 });
      const filename = `${metadata.arxivId || 'paper'}.pdf`;
      const taskId = await this.createTask(pdfBlob, token, filename);
      console.log('[MINERU] ✅ 任务创建成功:', taskId);
      
      // 3. 轮询结果
      console.log('[MINERU] 🔄 开始轮询任务状态...');
      if (onProgress) onProgress({ stage: 'processing', progress: 40 });
      
      const markdown = await this.pollTask(taskId, token, (pollStatus) => {
        if (onProgress) {
          onProgress({
            stage: 'processing',
            progress: 40 + (pollStatus.progress || 0) * 0.6,
            state: pollStatus.state
          });
        }
      });
      
      // 4. 添加元数据
      const markdownWithMeta = this._addMetadata(markdown, {
        ...metadata,
        source: 'mineru',
        taskId: taskId
      });
      
      if (onProgress) onProgress({ stage: 'completed', progress: 100 });
      
      logger.info('MinerU conversion successful');
      
      return {
        markdown: markdownWithMeta,
        metadata: {
          ...metadata,
          source: 'mineru',
          taskId: taskId,
          conversionTime: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('MinerU conversion failed:', error);
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
      
      // 检查文件大小
      if (blob.size > DEFAULTS.MAX_FILE_SIZE) {
        throw new Error('PDF file too large (max 200MB)');
      }
      
      return blob;
    } catch (error) {
      logger.error('PDF download failed:', error);
      throw error;
    }
  }

  /**
   * 添加元数据头部
   * @private
   */
  _addMetadata(markdown, metadata) {
    const header = `---
title: ${metadata.title || 'Untitled'}
arxiv_id: ${metadata.arxivId || 'unknown'}
source: ${metadata.source}
mineru_task_id: ${metadata.taskId}
converted_at: ${new Date().toISOString()}
---

`;
    return header + markdown;
  }
}

// 导出单例
export default new MinerUClient();

