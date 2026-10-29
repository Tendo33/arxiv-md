// R4-11：保留旧模块路径（兼容旧 import）；实现已迁到 parse-task-runner.js，一个版本后删除
import { scheduleReloadWhenIdle } from './dnr-reinit';
import taskManager from '@core/task-manager';
import logger from '@utils/logger';
import { generateFilename } from '@utils/helpers';
import storage from '@utils/storage';
import { createDeletedTaskGuard } from '@core/deleted-task-guard';
import { downloadZip } from '@core/converter/mineru-client';
import { createDefaultRegistry } from '@pdf-core/providers/index';
import { saveDeliverable } from '@pdf-core/output/save';
import { createParseTaskRunner } from './parse-task-runner';
import { taskNotificationText } from './task-notification-text';
import { requirePaddleOriginRule } from './paddle-origin-rule';
import { isDisclosureAcked, needsDisclosure } from '@utils/disclosure-ack';

export const deletedTaskGuard = createDeletedTaskGuard(chrome.storage.local);
export const providerRegistry = createDefaultRegistry();

function downloadViaChrome(opts) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download(opts, (id) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message)); else resolve(id);
    });
  });
}

/** 任务通知；id 前缀沿用 mineru_task_（点击处理兼容）。文案按扩展设置的语言，见 task-notification-text.js */
export async function showTaskNotification(task, status, detail = '', provider = null) {
  const label = (provider && provider.label) || 'MinerU';
  if (status === 'failed') logger.error('Parse task failed:', detail && (detail.message || detail));
  const lang = await storage.getLanguage().catch(() => null);
  const n = taskNotificationText(task, status, detail, label, lang);
  const config = { type: 'basic', iconUrl: '/assets/icon-128.png', title: n.title, message: n.message };
  if (n.button) config.buttons = [{ title: n.button }];
  chrome.notifications.create(`mineru_task_${task.id}`, config, () => {
    if (chrome.runtime.lastError) logger.error('Failed to create notification:', chrome.runtime.lastError);
  });
}

/** QA L-01：后台用的 reinit（导出给测试）：排队，等没有扩展页面、没有别的任务时才 runtime.reload */
export const backgroundReinit = (opts) => scheduleReloadWhenIdle(opts);

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
  // R4-02 / R5-01：PaddleOCR 提交前确认 DNR 规则 4001 已装（只在 background），5 s 内没就绪 → 任务失败（dnr_not_ready）
  beforeSubmit: (provider) => (provider && provider.id === 'paddleocr' ? requirePaddleOriginRule() : undefined),
  // QA L-01：首次解析 DNR 没就绪 → 等没有扩展页面开着、也没有别的任务在跑时重新载入扩展一次，启动后 resume 续跑
  reinit: backgroundReinit,
  // 审查 30a6e1b P2：所有走 runner 的路径在提交前查数据说明确认
  isDisclosureAcked: (id) => (needsDisclosure(id) ? isDisclosureAcked(id) : true),
  log: logger,
});

/** 旧名字：处理任意 provider 的任务 */
export function processMinerUTaskInBackground(taskId) {
  return parseTaskRunner.process(taskId);
}
/** 审查 P1-1：用户确认把非 OA PDF 的链接发给后端 */
export function confirmPdfSend(taskId) {
  return parseTaskRunner.confirmSend(taskId);
}

/** R4-12：续上 SW 被杀前未完成的任务 */
export function resumeParseTasks() {
  return parseTaskRunner.resumeActiveTasks();
}

/** 审查 P2-3：删除任务时中止进行中的发送 */
export function abortParseTask(taskId) {
  return parseTaskRunner.abort(taskId);
}
