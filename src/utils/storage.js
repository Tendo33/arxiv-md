// Chrome Storage 封装 - 提供类型安全的存储访问

import { STORAGE_KEYS, DEFAULTS } from '@config/constants';
import logger from './logger';
import { PROVIDER_KEYS_KEY, PDF_PROVIDER_KEY, pickPdfProvider } from './migrations';

import { browserDefaultLanguage } from './browser-language';

/**
 * Storage Manager - 封装 Chrome Storage API
 */
class StorageManager {
  constructor() {
    this.storage = chrome.storage.sync;
  }

  /**
   * 获取存储值
   * @param {string} key - 键名
   * @param {*} defaultValue - 默认值
   * @returns {Promise<*>}
   */
  async get(key, defaultValue = null) {
    try {
      const result = await this.storage.get(key);
      return result[key] !== undefined ? result[key] : defaultValue;
    } catch (error) {
      logger.error('Storage get error:', error);
      return defaultValue;
    }
  }

  /**
   * 设置存储值
   * @param {string} key - 键名
   * @param {*} value - 值
   * @returns {Promise<void>}
   */
  async set(key, value) {
    try {
      await this.storage.set({ [key]: value });
      logger.debug(`Storage set: ${key}`, value);
    } catch (error) {
      logger.error('Storage set error:', error);
      throw error;
    }
  }

  // === 业务特定方法 ===

  /**
   * R4-06：所有 provider 的 Key 只存 storage.local.providerKeys，绝不进 sync
   * @param {string} providerId
   * @returns {Promise<string|null>}
   */
  async getProviderKey(providerId) {
    try {
      const { [PROVIDER_KEYS_KEY]: keys = {} } = await chrome.storage.local.get(PROVIDER_KEYS_KEY);
      return keys[providerId] || null;
    } catch (error) {
      logger.error('Storage get error:', error);
      return null;
    }
  }

  /** @param {string} providerId @param {string} key 空值即删除 */
  async setProviderKey(providerId, key) {
    const { [PROVIDER_KEYS_KEY]: keys = {} } = await chrome.storage.local.get(PROVIDER_KEYS_KEY);
    const next = { ...keys };
    const v = typeof key === 'string' ? key.trim() : '';
    if (v) next[providerId] = v; else delete next[providerId];
    await chrome.storage.local.set({ [PROVIDER_KEYS_KEY]: next });
  }

  /** 清除全部 Key（local），同时兜底删掉 sync 里可能残留的旧 mineruToken */
  async clearProviderKeys() {
    await chrome.storage.local.remove(PROVIDER_KEYS_KEY);
    await chrome.storage.sync.remove(STORAGE_KEYS.MINERU_TOKEN).catch(() => {});
  }

  /**
   * R4-13：当前 PDF 解析后端（规则见 pickPdfProvider）
   * @param {(id:string)=>boolean} [isKnown] 传入注册表校验，未知值按未设置处理
   */
  async getPdfProvider(isKnown) {
    const { [PDF_PROVIDER_KEY]: pdfProvider } = await chrome.storage.sync.get(PDF_PROVIDER_KEY);
    const hasMinerUToken = !!(await this.getProviderKey('mineru'));
    return pickPdfProvider({ pdfProvider, hasMinerUToken, isKnown });
  }

  /** @param {string} providerId */
  async setPdfProvider(providerId) {
    await chrome.storage.sync.set({ [PDF_PROVIDER_KEY]: providerId });
  }

  /** 用户（可能在另一台设备上）明确选过的后端；没选过返回 null。sync 里只有选择，没有 Key */
  async getChosenPdfProvider() {
    const { [PDF_PROVIDER_KEY]: v } = await chrome.storage.sync.get(PDF_PROVIDER_KEY);
    return typeof v === 'string' && v ? v : null;
  }

  /**
   * R4-15：当前后端 + 是否已配 Key（popup、右键菜单用）
   * keyMissingHere：后端是选过的（随 sync 过来），但本设备 local 里没有 Key → 提示在本设备重新填写
   */
  async getActivePdfProvider(isKnown) {
    const id = await this.getPdfProvider(isKnown);
    const hasKey = !!(await this.getProviderKey(id));
    const keyMissingHere = !hasKey && (await this.getChosenPdfProvider()) === id;
    return { id, hasKey, keyMissingHere };
  }

  /** 兼容旧调用：等价于 getProviderKey('mineru') */
  async getMinerUToken() {
    return this.getProviderKey('mineru');
  }

  /** 兼容旧调用：等价于 setProviderKey('mineru', token) */
  async setMinerUToken(token) {
    await this.setProviderKey('mineru', token);
  }

  /**
   * 获取转换模式
   * @returns {Promise<string>}
   */
  async getConversionMode() {
    return this.get(STORAGE_KEYS.CONVERSION_MODE, DEFAULTS.CONVERSION_MODE);
  }

  /**
   * 获取自动转换开关
   * @returns {Promise<boolean>}
   */
  async getAutoConvert() {
    return this.get(STORAGE_KEYS.AUTO_CONVERT, DEFAULTS.AUTO_CONVERT);
  }

  /**
   * 设置自动转换开关
   * @param {boolean} value
   */
  async setAutoConvert(value) {
    await this.set(STORAGE_KEYS.AUTO_CONVERT, value);
  }

  /** A3-1：PDF 页悬浮按钮开关（默认开） */
  async getShowPdfFab() {
    return this.get(STORAGE_KEYS.SHOW_PDF_FAB, DEFAULTS.SHOW_PDF_FAB);
  }

  async setShowPdfFab(value) {
    await this.set(STORAGE_KEYS.SHOW_PDF_FAB, value);
  }

  /**
   * 获取是否包含 Markdown 元数据
   * @returns {Promise<boolean>}
   */
  async getIncludeMetadata() {
    return this.get(STORAGE_KEYS.INCLUDE_METADATA, DEFAULTS.INCLUDE_METADATA);
  }

  /**
   * 设置是否包含 Markdown 元数据
   * @param {boolean} value
   */
  async setIncludeMetadata(value) {
    await this.set(STORAGE_KEYS.INCLUDE_METADATA, value);
  }

  /**
   * 设置转换模式
   * @param {string} mode
   */
  async setConversionMode(mode) {
    await this.set(STORAGE_KEYS.CONVERSION_MODE, mode);
  }

  /**
   * 获取统计数据
   * @returns {Promise<Object>}
   */
  async getStatistics() {
    return this.get(STORAGE_KEYS.STATISTICS, {
      totalConversions: 0,
      ar5ivSuccess: 0,
      mineruSuccess: 0,
      pdfFallback: 0,
      lastConversionTime: null,
    });
  }

  /**
   * 增加转换计数
   * @param {string} tier - 转换层级
   */
  async incrementConversion(tier) {
    const stats = await this.getStatistics();
    stats.totalConversions += 1;

    switch (tier) {
    case 'ar5iv_local':
      stats.ar5ivSuccess += 1;
      break;
    case 'mineru_api':
      stats.mineruSuccess += 1;
      break;
    case 'pdf_fallback':
      stats.pdfFallback += 1;
      break;
    }

    await this.set(STORAGE_KEYS.STATISTICS, {
      ...stats,
      lastConversionTime: Date.now(),
    });
  }

  /**
   * 获取是否显示桌面通知
   * @returns {Promise<boolean>}
   */
  async getShowNotifications() {
    return this.get(STORAGE_KEYS.SHOW_NOTIFICATIONS, true);
  }

  async setShowNotifications(value) {
    await this.set(STORAGE_KEYS.SHOW_NOTIFICATIONS, value);
  }

  /**
   * 未保存过语言时跟随浏览器界面语言（zh* → 中文，其余英文）。
   * release-polish AB8-04：唯一的语言入口——存的值不是 zh/en、或读取失败时都回落到 browserDefaultLanguage，
   * 调用方不再各自写 'en' / null 兜底。
   */
  async getLanguage() {
    try {
      const v = await this.get(STORAGE_KEYS.LANGUAGE, null);
      return v === 'zh' || v === 'en' ? v : browserDefaultLanguage();
    } catch {
      return browserDefaultLanguage();
    }
  }

  async setLanguage(lang) {
    await this.set(STORAGE_KEYS.LANGUAGE, lang);
  }
}

// AB8-04：纯函数放在 browser-language.js，背景页/右键菜单可以不实例化 StorageManager 直接用
export { browserDefaultLanguage };

// 导出单例
export default new StorageManager();
