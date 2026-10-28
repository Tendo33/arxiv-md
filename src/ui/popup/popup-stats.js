/** Total conversions shown in the popup: global counter first, MinerU task count as fallback. */
export function resolveTotalConversions(taskStats, globalStats) {
  if (globalStats && Number.isFinite(globalStats.totalConversions)) {
    return globalStats.totalConversions;
  }
  return taskStats?.total || 0;
}
