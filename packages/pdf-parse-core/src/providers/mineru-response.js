/** MinerU 成功码可能是数字 0 或字符串 "0" */
export function isMinerUSuccessCode(code) {
  return Number(code) === 0;
}

/** MinerU v4 把任务放在 data.extract_result 下；旧响应字段直接在 data 上 */
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
