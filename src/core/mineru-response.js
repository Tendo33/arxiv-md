/**
 * MinerU success codes arrive as either the number 0 or the string "0".
 */
export function isMinerUSuccessCode(code) {
  return Number(code) === 0;
}

/**
 * MinerU v4 nests the task under data.extract_result.
 * Older responses keep the same fields on data itself.
 */
export function readMinerUTaskStatus(data) {
  const source = data || {};
  const extractResult = source.extract_result || source;
  return {
    taskId: source.task_id || extractResult.task_id,
    state: extractResult.state,
    progress: extractResult.extract_progress || null,
    zipUrl: extractResult.full_zip_url || null,
    error: extractResult.err_msg || null,
  };
}
