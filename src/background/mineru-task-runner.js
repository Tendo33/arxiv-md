// R4-11：保留旧模块路径（兼容旧 import）；实现已迁到 parse-task-runner.js，一个版本后删除
import taskManager from '@core/task-manager';
import logger from '@utils/logger';
import { generateFilename } from '@utils/helpers';
import storage from '@utils/storage';
import { createDeletedTaskGuard } from '@core/deleted-task-guard';
import { downloadZip } from '@core/converter/mineru-client';
import { createDefaultRegistry } from '@pdf-core/providers/index';
import { saveDeliverable } from '@pdf-core/output/save';
import { createParseTaskRunner } from './parse-task-runner';

export const deletedTaskGuard = createDeletedTaskGuard(chrome.storage.local);
export const providerRegistry = createDefaultRegistry();

function downloadViaChrome(opts) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download(opts, (id) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message)); else resolve(id);
    });
  });
}

/** 任务通知；id 前缀沿用 mineru_task_（点击处理兼容） */
export function showTaskNotification(task, status, detail = '', provider = null) {
  const title = task.paperInfo.title || task.paperInfo.arxivId;
  const truncatedTitle = title.length > 40 ? title.substring(0, 40) + '…' : title;
  const label = (provider && provider.label) || 'MinerU';
  const config = { type: 'basic', iconUrl: '/assets/icon-128.png' };
  if (status === 'consent') {
    // 审查 P1-1：右键菜单、快捷键、悬浮按钮发起的非 OA 任务，靠通知把用户带到弹窗里确认
    config.title = `⚠️ 需要确认才能上传（${label}）`;
    config.message = `${truncatedTitle}\n\n这篇 PDF 不是开放获取文章，打开扩展弹窗确认后才会发送`;
  } else if (status === 'completed') {
    config.title = `✅ PDF 解析完成（${label}）`;
    config.message = `${truncatedTitle}\n\n点击查看任务`;
    config.buttons = [{ title: '查看任务' }];
  } else {
    config.title = `❌ PDF 解析失败（${label}）`;
    config.message = `${truncatedTitle}\n\n${detail || '未知错误'}`;
  }
  chrome.notifications.create(`mineru_task_${task.id}`, config, () => {
    if (chrome.runtime.lastError) logger.error('Failed to create notification:', chrome.runtime.lastError);
  });
}

export const parseTaskRunner = createParseTaskRunner({
  permissions: typeof chrome !== 'undefined' && chrome.permissions ? chrome.permissions : null,
  registry: providerRegistry,
  taskManager,
  storage,
  guard: deletedTaskGuard,
  downloadUrl: downloadZip,
  saveDeliverable: (result, base) => saveDeliverable(result, base, { download: downloadViaChrome }),
  makeFilename: (meta, ext) => generateFilename(meta, ext),
  notify: showTaskNotification,
  log: logger,
});

/** 旧名字：处理任意 provider 的任务 */
export function processMinerUTaskInBackground(taskId) {
  return parseTaskRunner.process(taskId);
}
/** 审查 P1-1：用户确认上传非 OA PDF */
export function confirmPdfUpload(taskId) {
  return parseTaskRunner.confirmUpload(taskId);
}
export const processParseTask = processMinerUTaskInBackground;

/** R4-12：续上 SW 被杀前未完成的任务 */
export function resumeParseTasks() {
  return parseTaskRunner.resumeActiveTasks();
}
