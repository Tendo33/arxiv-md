// Chrome Storage 封装 - 提供类型安全的存储访问

import { STORAGE_KEYS, DEFAULTS } from "@config/constants";
import logger from "./logger";

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
      logger.error("Storage get error:", error);
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
      logger.error("Storage set error:", error);
      throw error;
    }
  }

  /**
   * 批量获取
   * @param {string[]} keys - 键名数组
   * @returns {Promise<Object>}
   */
  async getMultiple(keys) {
    try {
      return await this.storage.get(keys);
    } catch (error) {
      logger.error("Storage getMultiple error:", error);
      return {};
    }
  }

  /**
   * 批量设置
   * @param {Object} items - 键值对对象
   * @returns {Promise<void>}
   */
  async setMultiple(items) {
    try {
      await this.storage.set(items);
      logger.debug("Storage setMultiple:", Object.keys(items));
    } catch (error) {
      logger.error("Storage setMultiple error:", error);
      throw error;
    }
  }

  /**
   * 删除存储值
   * @param {string|string[]} keys - 键名或键名数组
   * @returns {Promise<void>}
   */
  async remove(keys) {
    try {
      await this.storage.remove(keys);
      logger.debug("Storage remove:", keys);
    } catch (error) {
      logger.error("Storage remove error:", error);
      throw error;
    }
  }

  /**
   * 清空所有存储
   * @returns {Promise<void>}
   */
  async clear() {
    try {
      await this.storage.clear();
      logger.warn("Storage cleared");
    } catch (error) {
      logger.error("Storage clear error:", error);
      throw error;
    }
  }

  // === 业务特定方法 ===

  /**
   * 获取 MinerU Token
   * @returns {Promise<string|null>}
   */
  async getMinerUToken() {
    return this.get(STORAGE_KEYS.MINERU_TOKEN);
  }

  /**
   * 设置 MinerU Token
   * @param {string} token
   */
  async setMinerUToken(token) {
    await this.set(STORAGE_KEYS.MINERU_TOKEN, token);
  }

  /**
   * 获取转换模式
   * @returns {Promise<string>}
   */
  async getConversionMode() {
    return this.get(STORAGE_KEYS.CONVERSION_MODE, DEFAULTS.CONVERSION_MODE);
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
   * 更新统计数据
   * @param {Object} update - 要更新的字段
   */
  async updateStatistics(update) {
    const stats = await this.getStatistics();
    const newStats = { ...stats, ...update, lastConversionTime: Date.now() };
    await this.set(STORAGE_KEYS.STATISTICS, newStats);
  }

  /**
   * 增加转换计数
   * @param {string} tier - 转换层级
   */
  async incrementConversion(tier) {
    const stats = await this.getStatistics();
    stats.totalConversions += 1;

    switch (tier) {
      case "ar5iv_local":
        stats.ar5ivSuccess += 1;
        break;
      case "mineru_api":
        stats.mineruSuccess += 1;
        break;
      case "pdf_fallback":
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
    return this.get("showNotifications", true); // 默认启用
  }

  /**
   * 设置是否显示桌面通知
   * @param {boolean} value
   */
  async setShowNotifications(value) {
    await this.set("showNotifications", value);
  }

  /**
   * 获取语言设置
   * @returns {Promise<string>}
   */
  async getLanguage() {
    return this.get("language", "en");
  }

  /**
   * 设置语言
   * @param {string} lang
   */
  async setLanguage(lang) {
    await this.set("language", lang);
  }
}

// 导出单例
export default new StorageManager();
