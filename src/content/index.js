// {{RIPER-7 Action}}
// Role: LD | Task_ID: #6 | Time: 2025-12-01T21:18:25+08:00
// Logic: Content Script - 在 arXiv 页面注入功能，提取元数据，触发转换
// Principle: SOLID-S (Single Responsibility - 页面交互)

import metadataExtractor from '@core/metadata-extractor';
import logger from '@utils/logger';
import { REGEX } from '@config/constants';

logger.info('Content script loaded on:', window.location.href);

// 检查是否在 arXiv 页面
const isArxivAbsPage = REGEX.ARXIV_ABS_PAGE.test(window.location.href);
const isArxivPdfPage = REGEX.ARXIV_PDF_PAGE.test(window.location.href);

if (!isArxivAbsPage && !isArxivPdfPage) {
  logger.warn('Not an arXiv page, exiting');
} else {
  init();
}

/**
 * 初始化
 */
function init() {
  logger.debug('Initializing content script');
  
  // 注入转换按钮
  injectConvertButton();
  
  // 监听来自 Background 的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    logger.debug('Content script received message:', message);
    
    switch (message.type) {
    case 'TRIGGER_CONVERSION':
      handleConversionTrigger();
      break;
      
    case 'CONVERSION_PROGRESS':
      updateProgressUI(message.data);
      break;
    }
    
    sendResponse({ received: true });
  });
}

/**
 * 注入"保存为 Markdown"按钮到页面
 */
function injectConvertButton() {
  if (!isArxivAbsPage) return; // 只在 Abstract 页面注入
  
  // 查找 PDF 下载链接位置
  const pdfLink = document.querySelector('a[href^="/pdf"]');
  if (!pdfLink) {
    logger.warn('PDF link not found, cannot inject button');
    return;
  }
  
  // 创建按钮容器
  const container = document.createElement('div');
  container.className = 'arxiv-md-button-container';
  container.style.cssText = `
    display: inline-block;
    margin-left: 10px;
  `;
  
  // 创建按钮
  const button = document.createElement('button');
  button.className = 'arxiv-md-convert-btn';
  button.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="vertical-align: -2px; margin-right: 4px;">
      <path d="M8.5 1.5A1.5 1.5 0 0 0 7 0H3.5A1.5 1.5 0 0 0 2 1.5v13A1.5 1.5 0 0 0 3.5 16h9a1.5 1.5 0 0 0 1.5-1.5V7L8.5 1.5z"/>
      <path d="M8 1v5.5A1.5 1.5 0 0 0 9.5 8H15"/>
    </svg>
    保存为 Markdown
  `;
  button.style.cssText = `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  `;
  
  button.addEventListener('mouseenter', () => {
    button.style.transform = 'translateY(-2px)';
    button.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
  });
  
  button.addEventListener('mouseleave', () => {
    button.style.transform = 'translateY(0)';
    button.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
  });
  
  button.addEventListener('click', handleConversionTrigger);
  
  // 创建进度指示器（初始隐藏）
  const progressIndicator = document.createElement('div');
  progressIndicator.className = 'arxiv-md-progress';
  progressIndicator.style.cssText = `
    display: none;
    margin-left: 10px;
    padding: 8px 16px;
    background: #f0f0f0;
    border-radius: 6px;
    font-size: 13px;
    color: #555;
  `;
  progressIndicator.innerHTML = `
    <span class="progress-text">正在转换...</span>
    <span class="progress-percent" style="margin-left: 8px; font-weight: 500;">0%</span>
  `;
  
  container.appendChild(button);
  container.appendChild(progressIndicator);
  
  // 插入到 PDF 链接后面
  pdfLink.parentElement.insertBefore(container, pdfLink.nextSibling);
  
  logger.info('Convert button injected');
}

/**
 * 处理转换触发
 */
async function handleConversionTrigger() {
  logger.info('Conversion triggered');
  
  try {
    // 更新 UI
    const button = document.querySelector('.arxiv-md-convert-btn');
    const progressIndicator = document.querySelector('.arxiv-md-progress');
    
    if (button) {
      button.disabled = true;
      button.style.opacity = '0.5';
      button.style.cursor = 'not-allowed';
    }
    
    if (progressIndicator) {
      progressIndicator.style.display = 'inline-block';
    }
    
    // 提取元数据
    const metadata = isArxivAbsPage
      ? metadataExtractor.extractFromAbsPage()
      : await fetchMetadataFromAbsPage();
    
    logger.debug('Extracted metadata:', metadata);
    
    // 发送转换请求到 Background
    chrome.runtime.sendMessage(
      {
        type: 'CONVERT_PAPER',
        data: metadata
      },
      (response) => {
        logger.debug('Conversion response:', response);
        
        // 恢复按钮状态
        if (button) {
          button.disabled = false;
          button.style.opacity = '1';
          button.style.cursor = 'pointer';
        }
        
        if (progressIndicator) {
          progressIndicator.style.display = 'none';
        }
        
        if (response && response.success) {
          // 显示成功提示
          showSuccessToast(response.data);
        } else {
          // 显示错误提示
          showErrorToast(response?.error || 'Unknown error');
        }
      }
    );
    
  } catch (error) {
    logger.error('Conversion trigger failed:', error);
    showErrorToast(error.message);
  }
}

/**
 * 从 Abstract 页面获取完整元数据（用于 PDF 页面）
 */
async function fetchMetadataFromAbsPage() {
  const arxivId = metadataExtractor._extractIdFromUrl(window.location.href);
  
  if (!arxivId) {
    throw new Error('Cannot extract arXiv ID');
  }
  
  // 使用 API 获取
  return await metadataExtractor.fetchMetadataFromApi(arxivId);
}

/**
 * 更新进度 UI
 */
function updateProgressUI(progress) {
  const progressIndicator = document.querySelector('.arxiv-md-progress');
  if (!progressIndicator) return;
  
  const textEl = progressIndicator.querySelector('.progress-text');
  const percentEl = progressIndicator.querySelector('.progress-percent');
  
  if (textEl && percentEl) {
    const stageText = {
      'checking': '检查 ar5iv...',
      'downloading': '下载 PDF...',
      'uploading': '上传到 MinerU...',
      'processing': 'MinerU 解析中...',
      'completed': '完成!'
    };
    
    textEl.textContent = stageText[progress.stage] || '处理中...';
    percentEl.textContent = `${Math.round(progress.progress || 0)}%`;
  }
}

/**
 * 显示成功提示
 */
function showSuccessToast(result) {
  const toast = createToast(
    '✅ 转换成功',
    `已保存：${result.filename}`,
    'success'
  );
  document.body.appendChild(toast);
  
  setTimeout(() => toast.remove(), 5000);
}

/**
 * 显示错误提示
 */
function showErrorToast(message) {
  const toast = createToast(
    '❌ 转换失败',
    message,
    'error'
  );
  document.body.appendChild(toast);
  
  setTimeout(() => toast.remove(), 5000);
}

/**
 * 创建 Toast 通知
 */
function createToast(title, message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `arxiv-md-toast arxiv-md-toast-${type}`;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: white;
    padding: 16px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    max-width: 400px;
    animation: slideIn 0.3s ease-out;
  `;
  
  if (type === 'success') {
    toast.style.borderLeft = '4px solid #10b981';
  } else if (type === 'error') {
    toast.style.borderLeft = '4px solid #ef4444';
  }
  
  toast.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 4px;">${title}</div>
    <div style="font-size: 13px; color: #666;">${message}</div>
  `;
  
  // 添加动画
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
  
  return toast;
}

