// Popup UI 逻辑 - 显示状态、统计数据、快捷操作

import storage from '@utils/storage';
import { CONVERSION_MODE } from '@config/constants';
import logger from '@utils/logger';

document.addEventListener('DOMContentLoaded', init);

/**
 * 初始化
 */
async function init() {
  logger.debug('Popup initialized');
  
  try {
    // 加载配置和统计
    await Promise.all([
      loadConfiguration(),
      loadStatistics()
    ]);
    
    // 绑定事件
    bindEvents();
    
  } catch (error) {
    logger.error('Failed to initialize popup:', error);
    showError('初始化失败');
  }
}

/**
 * 加载配置
 */
async function loadConfiguration() {
  try {
    const mode = await storage.getConversionMode();
    const token = await storage.getMinerUToken();
    
    // 显示模式
    const modeText = {
      [CONVERSION_MODE.FAST]: '快速模式 (仅 ar5iv)',
      [CONVERSION_MODE.QUALITY]: '质量模式 (ar5iv + MinerU)',
      [CONVERSION_MODE.ALWAYS_MINERU]: '极致模式 (仅 MinerU)'
    };
    
    document.getElementById('currentMode').textContent = modeText[mode] || mode;
    
    // 显示 Token 状态
    const tokenStatusEl = document.getElementById('tokenStatus');
    if (token) {
      tokenStatusEl.textContent = '✓ 已配置';
      tokenStatusEl.style.color = '#10b981';
    } else {
      tokenStatusEl.textContent = '✗ 未配置';
      tokenStatusEl.style.color = '#ef4444';
    }
    
  } catch (error) {
    logger.error('Failed to load configuration:', error);
  }
}

/**
 * 加载统计数据
 */
async function loadStatistics() {
  try {
    const stats = await storage.getStatistics();
    
    document.getElementById('totalConversions').textContent = stats.totalConversions || 0;
    document.getElementById('ar5ivSuccess').textContent = stats.ar5ivSuccess || 0;
    document.getElementById('mineruSuccess').textContent = stats.mineruSuccess || 0;
    document.getElementById('pdfFallback').textContent = stats.pdfFallback || 0;
    
  } catch (error) {
    logger.error('Failed to load statistics:', error);
  }
}

/**
 * 绑定事件
 */
function bindEvents() {
  // 转换当前论文
  document.getElementById('convertBtn').addEventListener('click', handleConvert);
  
  // 打开设置页面
  document.getElementById('settingsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  // 反馈链接
  document.getElementById('feedbackLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({
      url: 'https://github.com/yourusername/arxiv-md/issues'
    });
  });
}

/**
 * 处理转换请求
 */
async function handleConvert() {
  const btn = document.getElementById('convertBtn');
  btn.disabled = true;
  btn.classList.add('loading');
  btn.textContent = '转换中...';
  
  try {
    // 获取当前 Tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      throw new Error('无法获取当前标签页');
    }
    
    // 检查是否在 arXiv 页面
    if (!tab.url.includes('arxiv.org')) {
      throw new Error('请在 arXiv 论文页面使用此功能');
    }
    
    // 发送转换指令到 Content Script
    await chrome.tabs.sendMessage(tab.id, {
      type: 'TRIGGER_CONVERSION'
    });
    
    // 关闭 Popup（转换在后台进行）
    setTimeout(() => window.close(), 500);
    
  } catch (error) {
    logger.error('Conversion failed:', error);
    showError(error.message);
    
    // 恢复按钮
    btn.disabled = false;
    btn.classList.remove('loading');
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1v6h6"/>
      </svg>
      转换当前论文
    `;
  }
}

/**
 * 显示错误提示
 */
function showError(message) {
  const helpText = document.querySelector('.help-text p');
  const originalText = helpText.textContent;
  
  helpText.textContent = `❌ ${message}`;
  helpText.style.color = '#dc2626';
  
  setTimeout(() => {
    helpText.textContent = originalText;
    helpText.style.color = '#92400e';
  }, 3000);
}

