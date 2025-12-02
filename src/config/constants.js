// 项目全局常量 - API 端点、配置键、错误消息等

/**
 * API 端点配置
 */
export const API = {
  // ar5iv.org 会重定向到 ar5iv.labs.arxiv.org，直接使用最终域名
  AR5IV_BASE: "https://ar5iv.labs.arxiv.org/html",
  MINERU_BASE: "https://mineru.net/api/v4",
  MINERU_TASK: "https://mineru.net/api/v4/extract/task",
  MINERU_RESULT: "https://mineru.net/api/v4/extract/result",
  ARXIV_PDF: "https://arxiv.org/pdf",
  ARXIV_EXPORT: "https://export.arxiv.org/pdf",
};

/**
 * Chrome Storage 键名
 */
export const STORAGE_KEYS = {
  MINERU_TOKEN: "mineruToken",
  CONVERSION_MODE: "conversionMode",
  DOWNLOAD_FOLDER: "downloadFolder",
  STATISTICS: "statistics",
};

/**
 * 转换模式（已简化，保留用于向后兼容）
 */
export const CONVERSION_MODE = {
  FAST: "fast", // ar5iv + 本地转换，失败时下载 PDF
  QUALITY: "quality", // 与 FAST 相同（已废弃 MinerU 自动调用）
  ALWAYS_MINERU: "always", // 仅 MinerU（手动模式）
};

/**
 * 任务状态
 */
export const TASK_STATUS = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
};

/**
 * 转换层级
 */
export const CONVERSION_TIER = {
  AR5IV_LOCAL: "ar5iv_local",
  MINERU_API: "mineru_api", // 保留用于手动 MinerU 模式
  PDF_FALLBACK: "pdf_fallback",
};

/**
 * 错误消息
 */
export const ERROR_MESSAGES = {
  AR5IV_NOT_FOUND: "ar5iv 版本不存在",
  AR5IV_PARSE_FAILED: "ar5iv 解析失败",
  MINERU_TOKEN_MISSING: "未配置 MinerU API Token",
  MINERU_API_ERROR: "MinerU API 调用失败",
  MINERU_QUOTA_EXCEEDED: "MinerU 配额已用完",
  PDF_DOWNLOAD_FAILED: "PDF 下载失败",
  NETWORK_ERROR: "网络连接错误",
  UNKNOWN_ERROR: "未知错误",
};

/**
 * 成功消息
 */
export const SUCCESS_MESSAGES = {
  CONVERSION_COMPLETE: "转换完成",
  SAVED_AS_MARKDOWN: "已保存为 Markdown",
  SAVED_AS_PDF: "已保存为 PDF",
};

/**
 * 配置默认值
 */
export const DEFAULTS = {
  CONVERSION_MODE: CONVERSION_MODE.FAST,
  POLL_INTERVAL: 2000, // MinerU 轮询间隔（毫秒）
  MAX_POLL_ATTEMPTS: 150, // 最大轮询次数（5 分钟）
  REQUEST_TIMEOUT: 30000, // 请求超时（毫秒）
  MAX_FILE_SIZE: 200 * 1024 * 1024, // 200MB
};

/**
 * 正则表达式
 */
export const REGEX = {
  ARXIV_ID: /(?:arxiv\.org\/(?:abs|pdf)\/)?(\d{4}\.\d{4,5}(?:v\d+)?)/i,
  ARXIV_ABS_PAGE: /^https?:\/\/arxiv\.org\/abs\//,
  ARXIV_PDF_PAGE: /^https?:\/\/arxiv\.org\/pdf\//,
};
