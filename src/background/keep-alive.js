// Keep the MV3 service worker alive only while MinerU tasks are running.

export const KEEP_ALIVE_ALARM = 'keepAlive';
export const KEEP_ALIVE_PERIOD_MINUTES = 0.4;

export function hasActiveTasks(stats) {
  return Boolean(stats && ((stats.pending || 0) > 0 || (stats.processing || 0) > 0));
}

/**
 * Create or clear the keep-alive alarm based on task statistics.
 * @returns {Promise<boolean>} whether the alarm is active afterwards
 */
export async function syncKeepAlive(alarmsApi, stats) {
  const existing = await alarmsApi.get(KEEP_ALIVE_ALARM);
  if (hasActiveTasks(stats)) {
    if (!existing) {
      await alarmsApi.create(KEEP_ALIVE_ALARM, { periodInMinutes: KEEP_ALIVE_PERIOD_MINUTES });
    }
    return true;
  }
  if (existing) {
    await alarmsApi.clear(KEEP_ALIVE_ALARM);
  }
  return false;
}
