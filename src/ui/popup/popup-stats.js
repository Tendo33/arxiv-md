/** Total conversions shown in the popup: global counter first, MinerU task count as fallback. */
export function resolveTotalConversions(taskStats, globalStats) {
  if (globalStats && Number.isFinite(globalStats.totalConversions)) {
    return globalStats.totalConversions;
  }
  return taskStats?.total || 0;
}

/** 没有 MinerU 任务时，“处理中/已完成”只会显示 0，与总数并列容易误解，直接隐藏 */
export function shouldShowTaskStats(taskStats) {
  return (taskStats?.total || 0) > 0;
}
