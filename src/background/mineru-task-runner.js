import mineruClient from '@core/converter/mineru-client';
import taskManager from '@core/task-manager';
import logger from '@utils/logger';
import { generateFilename } from '@utils/helpers';
import storage from '@utils/storage';
import { TASK_STATUS } from '@config/constants';
import { createDeletedTaskGuard } from '@core/deleted-task-guard';

export const deletedTaskGuard = createDeletedTaskGuard(chrome.storage.local);

/**
 * 后台处理 MinerU 任务
 */
export async function processMinerUTaskInBackground(taskId) {
  logger.info('Processing MinerU task in background:', taskId);

  // 检查任务是否已被删除
  if (await deletedTaskGuard.consume(taskId)) {
    logger.info('Task was deleted before processing, skipping:', taskId);
    return;
  }

  const task = await taskManager.getTask(taskId);
  if (!task) {
    logger.error('Task not found:', taskId);
    return;
  }

  const token = await storage.getMinerUToken();
  if (!token) {
    logger.error('MinerU Token not configured');
    await taskManager.updateTask(taskId, {
      status: TASK_STATUS.FAILED,
      error: '未配置 MinerU API Token',
    });
    showTaskNotification(task, 'failed', '未配置 MinerU Token');
    return;
  }

  try {
    logger.info('Starting MinerU API call for task:', taskId);

    // 更新为处理中
    await taskManager.updateTask(taskId, {
      status: TASK_STATUS.PROCESSING,
      progress: 0,
    });

    // 调用 MinerU API
    const pdfUrl = task.paperInfo.pdfUrl || `https://arxiv.org/pdf/${task.paperInfo.arxivId}.pdf`;
    logger.info('PDF URL:', pdfUrl);

    // 生成统一格式的文件名（与其他功能保持一致）
    const paperInfo = task.paperInfo;
    const filename = generateFilename(
      {
        title: paperInfo.title,
        authors: paperInfo.authors,
        year: paperInfo.year,
        arxivId: paperInfo.arxivId,
      },
      'zip'
    );

    const result = await mineruClient.convert(
      pdfUrl,
      token,
      { ...paperInfo, filename },
      async (progress) => {
        // 实时更新进度
        logger.debug(`Task ${taskId} progress:`, progress.progress);
        await taskManager.updateTask(taskId, {
          progress: Math.round(progress.progress || 0),
        });
      }
    );

    logger.info('MinerU API call completed for task:', taskId);

    // 在任务完成前检查是否被删除
    if (await deletedTaskGuard.consume(taskId)) {
      logger.info('Task was deleted during processing, skipping download notification:', taskId);
      return;
    }

    // 标记为完成
    await taskManager.updateTask(taskId, {
      status: TASK_STATUS.COMPLETED,
      progress: 100,
      zipUrl: result.zipUrl,
      downloadId: result.downloadId,
      taskId: result.metadata.taskId,
      completedAt: Date.now(),
    });

    // 增加统计
    await storage.incrementConversion('mineru_api');

    // 发送成功通知
    showTaskNotification(task, 'completed', result.zipUrl);
    logger.info('MinerU task completed:', taskId);
  } catch (error) {
    logger.error('MinerU task failed:', taskId, error);
    logger.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    // 标记为失败
    await taskManager.updateTask(taskId, {
      status: TASK_STATUS.FAILED,
      error: error.message || '未知错误',
    });

    // 发送失败通知
    showTaskNotification(task, 'failed', error.message);
  }
}

/**
 * 显示任务通知
 */
function showTaskNotification(task, status, detail = '') {
  const title = task.paperInfo.title || task.paperInfo.arxivId;
  const truncatedTitle = title.length > 40 ? title.substring(0, 40) + '...' : title;

  let notificationConfig = {
    type: 'basic',
    iconUrl: '/assets/icon-128.png',
  };

  if (status === 'completed') {
    notificationConfig.title = '✅ MinerU 转换完成';
    notificationConfig.message = `${truncatedTitle}\n\n点击查看下载链接`;
    notificationConfig.buttons = [{ title: '查看任务' }];
  } else if (status === 'failed') {
    notificationConfig.title = '❌ MinerU 转换失败';
    notificationConfig.message = `${truncatedTitle}\n\n${detail || '未知错误'}`;
  }

  chrome.notifications.create(
    `mineru_task_${task.id}`,
    notificationConfig,
    (notificationId) => {
      if (chrome.runtime.lastError) {
        logger.error('Failed to create notification:', chrome.runtime.lastError);
      } else {
        logger.debug('Notification created:', notificationId);
      }
    }
  );
}

