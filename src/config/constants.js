// 项目全局常量 - API 端点、配置键、错误消息等

/**
 * API 端点配置
 */
export const API = {
  // 官方 HTML 与论文同步发布；ar5iv 按月批量转换，作为回退
  ARXIV_HTML_BASE: 'https://arxiv.org/html',
  // ar5iv.org 会重定向到 ar5iv.labs.arxiv.org，直接使用最终域名
  AR5IV_BASE: 'https://ar5iv.labs.arxiv.org/html',
  // MinerU API v4 端点 (官方文档: https://mineru.net/apiManage/docs)
  MINERU_BASE: 'https://mineru.net/api/v4',
  MINERU_TASK: 'https://mineru.net/api/v4/extract/task',
  // arXiv PDF 端点
  ARXIV_PDF: 'https://arxiv.org/pdf',
};

/**
 * Chrome Storage 键名
 */
export const STORAGE_KEYS = {
  MINERU_TOKEN: 'mineruToken',
  CONVERSION_MODE: 'conversionMode',
  STATISTICS: 'statistics',
  TASKS: 'mineruTasks', // 任务队列存储键
  DELETED_TASK_IDS: 'deletedMinerUTaskIds',
  AUTO_CONVERT: 'autoConvert',
  INCLUDE_METADATA: 'includeMetadata',
  SHOW_NOTIFICATIONS: 'showNotifications',
  SHOW_PDF_FAB: 'showPdfFab',
  LANGUAGE: 'language',
};

/**
 * 转换模式
 */
export const CONVERSION_MODE = {
  FAST: 'fast', // arXiv HTML，再 ar5iv，失败时下载 PDF
  ALWAYS_MINERU: 'always', // 仅 MinerU（手动模式）
};

/**
 * 转换层级
 */
export const CONVERSION_TIER = {
  AR5IV_LOCAL: 'ar5iv_local',
  MINERU_API: 'mineru_api', // 保留用于手动 MinerU 模式
  PDF_FALLBACK: 'pdf_fallback',
};

/**
 * 错误消息
 */
export const ERROR_MESSAGES = {
  AR5IV_NOT_FOUND: 'ar5iv 版本不存在',
  AR5IV_PARSE_FAILED: 'ar5iv 解析失败',
  PDF_DOWNLOAD_FAILED: 'PDF 下载失败',
  NETWORK_ERROR: '网络连接错误',
  NETWORK_OFFLINE: '网络连接失败，请检查网络后重试',
  UNKNOWN_ERROR: '未知错误',
};

/**
 * R4-03：旧的 ERROR_MESSAGES.MINERU_* 已删除，改用 pdf-parse-core 的统一错误码。
 * 兼容映射：旧键 → 新码（给仍引用旧键的外部代码/存量任务记录用）。
 */
export const LEGACY_MINERU_ERROR_CODES = Object.freeze({
  MINERU_TOKEN_MISSING: 'AUTH_INVALID',
  MINERU_API_ERROR: 'PROVIDER_FAILED',
  MINERU_QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  MINERU_DOWNLOAD_FAILED: 'PROVIDER_FAILED',
});

/** 旧版硬编码的中文提示（存量任务记录里的 error 字符串）→ 新码，用于显示时重新翻译 */
export const LEGACY_MINERU_ERROR_TEXT = Object.freeze({
  '未配置 MinerU API Token': 'AUTH_INVALID',
  '未配置 MinerU Token': 'AUTH_INVALID',
  'MinerU API 调用失败': 'PROVIDER_FAILED',
  'MinerU 配额已用完': 'QUOTA_EXCEEDED',
  'MinerU 结果下载失败': 'PROVIDER_FAILED',
  'MinerU 请求超时': 'TIMEOUT',
  'MinerU 查询超时': 'TIMEOUT',
  'Task polling timeout': 'TIMEOUT',
});

/**
 * 配置默认值
 */
export const DEFAULTS = {
  CONVERSION_MODE: CONVERSION_MODE.FAST,
  AUTO_CONVERT: false,
  INCLUDE_METADATA: true,
  SHOW_PDF_FAB: true,
  POLL_INTERVAL: 2000, // MinerU 轮询间隔（毫秒）
  MAX_POLL_ATTEMPTS: 150, // 最大轮询次数（5 分钟）
  REQUEST_TIMEOUT: 30000, // 请求超时（毫秒）
  MAX_FILE_SIZE: 200 * 1024 * 1024, // 200MB
};

/**
 * 正则表达式
 */
export const REGEX = {
  ARXIV_ID: /(?:arxiv\.(?:org|abs)\/(?:abs\/|pdf\/)?|export\.arxiv\.org\/abs\/)?((?:\d{4}\.\d{4,5}|[a-z-]+\/[0-9]{7})(?:v\d+)?)/i,
  ARXIV_ABS_PAGE: /^https?:\/\/arxiv\.org\/abs\//,
  ARXIV_PDF_PAGE: /^https?:\/\/arxiv\.org\/pdf\//,
  // AR-03：旧式编号（hep-th/9711200、math/0211159）的 HTML 页也要接住快捷键
  ARXIV_HTML_PAGE: /^https?:\/\/arxiv\.org\/html\/(?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})/,
};

/**
 * 任务状态
 */
export const TASK_STATUS = {
  PENDING: 'pending',       // 等待处理
  PROCESSING: 'processing', // 处理中
  COMPLETED: 'completed',   // 已完成
  FAILED: 'failed',         // 失败
  AWAITING_CONSENT: 'awaiting_consent', // 1.2.2 前的旧状态，现在不再产生；旧任务显示「需重试」
  AWAITING_DISCLOSURE: 'awaiting_disclosure', // 1.2.2 前的旧状态，现在不再产生；旧任务显示「需重试」
};

/**
 * 任务类型
 */
export const TASK_TYPE = {
  MINERU: 'mineru', // MinerU 转换任务
};
