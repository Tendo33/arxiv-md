// R4-04：薄壳。实现已迁入 pdf-parse-core 的 providers/mineru.js；保留旧 import 兼容，一个版本后删除。
import { API, DEFAULTS } from '@config/constants';
import logger from '@utils/logger';
import { sleep } from '@utils/helpers';
import { mineruProvider } from '@pdf-core/providers/mineru';
import { ParseError } from '@pdf-core/errors';

/** chrome.downloads 下载结果 ZIP（绕过 CORS），文件名规则不变 */
export function downloadZip(zipUrl, filename) {
  logger.info('Downloading ZIP:', zipUrl);
  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      { url: zipUrl, filename, saveAs: false, conflictAction: 'uniquify' },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          logger.error('Download failed:', chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(downloadId);
        }
      },
    );
  });
}

class MinerUClient {
  constructor() {
    this.taskUrl = API.MINERU_TASK;
    this.pollInterval = DEFAULTS.POLL_INTERVAL;
    this.maxPollAttempts = DEFAULTS.MAX_POLL_ATTEMPTS;
    this.provider = mineruProvider;
  }

  async createTask(pdfUrl, token, options = {}) {
    const { jobId } = await mineruProvider.submit(
      { url: pdfUrl, dataId: options.dataId, options: { modelVersion: options.modelVersion } },
      { token },
    );
    return jobId;
  }

  async queryTask(taskId, token) {
    const r = await mineruProvider.poll(taskId, { token });
    return { taskId, state: r.raw.state, progress: r.raw.progress, zipUrl: r.raw.zipUrl, error: r.raw.error, unified: r };
  }

  /** 与 1.1.12 相同：每 2s 查一次，最多 150 次；单次查询失败继续重试 */
  async pollTask(taskId, token, onProgress = null) {
    let attempts = 0;
    while (attempts < this.maxPollAttempts) {
      attempts++;
      try {
        const r = await mineruProvider.poll(taskId, { token });
        const pct = r.progress && r.progress.total > 0 ? Math.round((r.progress.done / r.progress.total) * 100) : 0;
        if (typeof onProgress === 'function') {
          onProgress({ progress: pct, state: r.raw.state, attempt: attempts, extractedPages: r.progress && r.progress.done, totalPages: r.progress && r.progress.total });
        }
        if (r.state === 'done') return r.result.zipUrl;
        if (r.state === 'failed') throw new ParseError('PROVIDER_FAILED', { provider: 'mineru', reason: r.error, raw: r.raw });
        await sleep(this.pollInterval);
      } catch (error) {
        if (attempts >= this.maxPollAttempts) throw error;
        logger.warn(`Poll attempt ${attempts} failed, retrying...`);
        await sleep(this.pollInterval);
      }
    }
    throw new ParseError('TIMEOUT', { provider: 'mineru' });
  }

  downloadZip(zipUrl, filename) { return downloadZip(zipUrl, filename); }

  async convert(pdfUrl, token, metadata = {}, onProgress = null) {
    if (onProgress) onProgress({ stage: 'submitting', progress: 0 });
    const taskId = await this.createTask(pdfUrl, token, { dataId: metadata.arxivId, modelVersion: 'vlm' });
    if (onProgress) onProgress({ stage: 'processing', progress: 10 });
    const zipUrl = await this.pollTask(taskId, token, (s) => {
      if (onProgress) onProgress({ stage: 'processing', progress: 10 + (s.progress || 0) * 0.8, state: s.state, extractedPages: s.extractedPages, totalPages: s.totalPages });
    });
    if (onProgress) onProgress({ stage: 'downloading', progress: 90 });
    const filename = metadata.filename || `arxiv_${metadata.arxivId || Date.now()}.zip`;
    const downloadId = await this.downloadZip(zipUrl, filename);
    if (onProgress) onProgress({ stage: 'completed', progress: 100 });
    return { zipUrl, downloadId, metadata: { ...metadata, source: 'mineru', taskId, conversionTime: new Date().toISOString() } };
  }
}

export default new MinerUClient();
