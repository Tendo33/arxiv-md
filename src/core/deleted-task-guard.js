import { STORAGE_KEYS } from '@config/constants';

const MAX_DELETED_IDS = 100;

/**
 * Remember MinerU task ids that the user deleted.
 * The set has to live in chrome.storage.local: a service worker restart
 * drops in-memory state while a conversion started earlier can still finish.
 */
export function createDeletedTaskGuard(storageArea) {
  const memory = new Set();
  const storageKey = STORAGE_KEYS.DELETED_TASK_IDS;

  async function readIds() {
    const stored = await storageArea.get(storageKey);
    const ids = stored?.[storageKey];
    return Array.isArray(ids) ? ids.slice() : [];
  }

  async function writeIds(ids) {
    const trimmed = ids.slice(-MAX_DELETED_IDS);
    await storageArea.set({ [storageKey]: trimmed });
    memory.clear();
    trimmed.forEach((id) => memory.add(id));
  }

  return {
    async mark(taskId) {
      const ids = await readIds();
      if (!ids.includes(taskId)) ids.push(taskId);
      await writeIds(ids);
    },

    async has(taskId) {
      if (memory.has(taskId)) return true;
      const ids = await readIds();
      ids.forEach((id) => memory.add(id));
      return memory.has(taskId);
    },

    async consume(taskId) {
      const present = await this.has(taskId);
      if (!present) return false;
      const ids = (await readIds()).filter((id) => id !== taskId);
      await writeIds(ids);
      return true;
    },
  };
}
