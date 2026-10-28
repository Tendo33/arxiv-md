// R4-05：老配置迁移（幂等，可中途失败后重跑）
// v1 = 1.1.12 及以前：mineruToken 存在 storage.sync
// v2 = Round 4：Key 只存 storage.local 的 providerKeys；新增 pdfProvider；任务记录带 provider
import { STORAGE_KEYS } from '@config/constants';

export const SCHEMA_VERSION = 2;
export const SCHEMA_VERSION_KEY = 'schemaVersion';
export const PROVIDER_KEYS_KEY = 'providerKeys';
export const PDF_PROVIDER_KEY = 'pdfProvider';

/**
 * 步骤顺序保证中途失败可重跑：
 *  ① 先把 sync.mineruToken 写进 local.providerKeys.mineru（local 已有值时不覆盖）
 *  ② 再确定 pdfProvider（有 MinerU token 的老用户 → 'mineru'）
 *  ③ 写入成功后才从 sync 删除 mineruToken
 *  ④ 最后写 schemaVersion；任何一步抛错都不写版本号，下次启动重跑
 * conversionMode='always' 原样保留（含义变为“总是走 PDF 解析（当前后端）”）。
 * 任务记录的 provider 字段由 task-manager 读取时补齐，不在这里批量改写。
 * @returns {Promise<{ran:boolean, from:number, to:number, steps:string[]}>}
 */
export async function runMigrations({ sync, local } = chrome.storage) {
  const { [SCHEMA_VERSION_KEY]: current = 1 } = await local.get(SCHEMA_VERSION_KEY);
  if (current >= SCHEMA_VERSION) return { ran: false, from: current, to: current, steps: [] };
  const steps = [];

  const syncData = await sync.get([STORAGE_KEYS.MINERU_TOKEN, PDF_PROVIDER_KEY]);
  const legacyToken = typeof syncData[STORAGE_KEYS.MINERU_TOKEN] === 'string' ? syncData[STORAGE_KEYS.MINERU_TOKEN].trim() : '';
  const { [PROVIDER_KEYS_KEY]: keys = {} } = await local.get(PROVIDER_KEYS_KEY);

  if (legacyToken && !keys.mineru) {
    await local.set({ [PROVIDER_KEYS_KEY]: { ...keys, mineru: legacyToken } });
    steps.push('token-to-local');
  }
  const hasMinerUToken = !!(legacyToken || keys.mineru);

  if (hasMinerUToken && !syncData[PDF_PROVIDER_KEY]) {
    await sync.set({ [PDF_PROVIDER_KEY]: 'mineru' });
    steps.push('keep-mineru');
  }

  if (STORAGE_KEYS.MINERU_TOKEN in syncData) {
    await sync.remove(STORAGE_KEYS.MINERU_TOKEN);
    steps.push('remove-sync-token');
  }

  await local.set({ [SCHEMA_VERSION_KEY]: SCHEMA_VERSION });
  return { ran: true, from: current, to: SCHEMA_VERSION, steps };
}

/** 任务记录兼容：旧记录没有 provider 字段的视为 MinerU */
export function normalizeTask(task) {
  if (!task || task.provider) return task;
  return { ...task, provider: 'mineru' };
}
