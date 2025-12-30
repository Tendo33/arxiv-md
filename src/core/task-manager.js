// 任务管理器 - 负责 MinerU 后台任务的生命周期管理
// Role: Task Manager | Feature: Background Task Queue

import logger from '@utils/logger';
import { STORAGE_KEYS, TASK_STATUS, TASK_TYPE } from '@config/constants';

/**
 * 任务管理器
 * 
 * 职责：
 * - 任务的增删改查
 * - 任务状态持久化
 * - 任务队列管理
 */
class TaskManager {
  constructor() {
    this.storageKey = STORAGE_KEYS.TASKS;
  }

  /**
   * 生成唯一任务 ID
   * @private
   */
  _generateTaskId() {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 从 Chrome Storage 获取所有任务
   * @returns {Promise<Array>} 任务列表
   */
  async getTasks() {
    try {
      const result = await chrome.storage.local.get(this.storageKey);
      return result[this.storageKey] || [];
    } catch (error) {
      logger.error('Failed to get tasks:', error);
      return [];
    }
  }

  /**
   * 保存任务列表到 Chrome Storage
   * @private
   */
  async _saveTasks(tasks) {
    try {
      await chrome.storage.local.set({ [this.storageKey]: tasks });
      logger.debug(`Saved ${tasks.length} tasks to storage`);
    } catch (error) {
      logger.error('Failed to save tasks:', error);
      throw error;
    }
  }

  /**
   * 添加新任务
   * @param {Object} paperInfo - 论文信息
   * @param {string} type - 任务类型 (默认: 'mineru')
   * @returns {Promise<Object>} 创建的任务对象
   */
  async addTask(paperInfo, type = TASK_TYPE.MINERU) {
    const task = {
      id: this._generateTaskId(),
      type,
      status: TASK_STATUS.PENDING,
      progress: 0,
      paperInfo: {
        arxivId: paperInfo.arxivId,
        title: paperInfo.title,
        authors: paperInfo.authors,
        year: paperInfo.year,
        pdfUrl: paperInfo.pdfUrl,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      completedAt: null,
      zipUrl: null,
      downloadId: null,
      taskId: null, // MinerU API 返回的 task_id
      error: null,
    };

    const tasks = await this.getTasks();
    tasks.push(task);
    await this._saveTasks(tasks);

    logger.info('Task added:', task.id, task.paperInfo.title);
    return task;
  }

  /**
   * 获取单个任务
   * @param {string} taskId - 任务 ID
   * @returns {Promise<Object|null>} 任务对象或 null
   */
  async getTask(taskId) {
    const tasks = await this.getTasks();
    return tasks.find((t) => t.id === taskId) || null;
  }

  /**
   * 更新任务
   * @param {string} taskId - 任务 ID
   * @param {Object} updates - 要更新的字段
   * @returns {Promise<Object|null>} 更新后的任务对象
   */
  async updateTask(taskId, updates) {
    const tasks = await this.getTasks();
    const index = tasks.findIndex((t) => t.id === taskId);

    if (index === -1) {
      logger.warn('Task not found for update:', taskId);
      return null;
    }

    tasks[index] = {
      ...tasks[index],
      ...updates,
      updatedAt: Date.now(),
    };

    await this._saveTasks(tasks);
    logger.debug('Task updated:', taskId, updates);
    return tasks[index];
  }

  /**
   * 删除任务
   * @param {string} taskId - 任务 ID
   * @returns {Promise<boolean>} 是否删除成功
   */
  async deleteTask(taskId) {
    const tasks = await this.getTasks();
    const filteredTasks = tasks.filter((t) => t.id !== taskId);

    if (filteredTasks.length === tasks.length) {
      logger.warn('Task not found for deletion:', taskId);
      return false;
    }

    await this._saveTasks(filteredTasks);
    logger.info('Task deleted:', taskId);
    return true;
  }

  /**
   * 清空已完成的任务
   * @returns {Promise<number>} 清空的任务数量
   */
  async clearCompletedTasks() {
    const tasks = await this.getTasks();
    const activeTasks = tasks.filter(
      (t) => t.status !== TASK_STATUS.COMPLETED && t.status !== TASK_STATUS.FAILED
    );

    const clearedCount = tasks.length - activeTasks.length;
    await this._saveTasks(activeTasks);

    logger.info(`Cleared ${clearedCount} completed tasks`);
    return clearedCount;
  }

  /**
   * 获取待处理的任务
   * @returns {Promise<Array>} 待处理任务列表
   */
  async getPendingTasks() {
    const tasks = await this.getTasks();
    return tasks.filter((t) => t.status === TASK_STATUS.PENDING);
  }

  /**
   * 获取正在处理的任务
   * @returns {Promise<Array>} 正在处理的任务列表
   */
  async getProcessingTasks() {
    const tasks = await this.getTasks();
    return tasks.filter((t) => t.status === TASK_STATUS.PROCESSING);
  }

  /**
   * 获取任务统计
   * @returns {Promise<Object>} 任务统计信息
   */
  async getStatistics() {
    const tasks = await this.getTasks();
    return {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === TASK_STATUS.PENDING).length,
      processing: tasks.filter((t) => t.status === TASK_STATUS.PROCESSING).length,
      completed: tasks.filter((t) => t.status === TASK_STATUS.COMPLETED).length,
      failed: tasks.filter((t) => t.status === TASK_STATUS.FAILED).length,
    };
  }
}

// 导出单例
export default new TaskManager();
