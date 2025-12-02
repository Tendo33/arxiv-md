// Settings 页面逻辑 - 配置管理、Token 验证、统计展示

import storage from '@utils/storage';
import { CONVERSION_MODE } from '@config/constants';
import logger from '@utils/logger';

document.addEventListener('DOMContentLoaded', init);

/**
 * 初始化
 */
async function init() {
  logger.debug('Settings page initialized');
  
  // 检查是否是首次安装
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('welcome') === 'true') {
    document.getElementById('welcomeBanner').style.display = 'block';
  }
  
  // 加载设置
  await loadSettings();
  
  // 加载统计
  await loadStatistics();
  
  // 绑定事件
  bindEvents();
}

/**
 * 加载设置
 */
async function loadSettings() {
  try {
    const mode = await storage.getConversionMode();
    document.querySelector(`input[name="conversionMode"][value="${mode}"]`).checked = true;
    
    const token = await storage.getMinerUToken();
    if (token) {
      document.getElementById('mineruToken').value = token;
    }
    
    logger.info('Settings loaded');
  } catch (error) {
    logger.error('Failed to load settings:', error);
    showToast('加载设置失败', 'error');
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
  // 保存设置
  document.getElementById('saveBtn').addEventListener('click', saveSettings);
  
  // 恢复默认
  document.getElementById('resetBtn').addEventListener('click', resetSettings);
  
  // Toggle Token 可见性
  document.getElementById('toggleTokenBtn').addEventListener('click', toggleTokenVisibility);
  
  // 重置统计
  document.getElementById('resetStatsBtn').addEventListener('click', resetStatistics);
  
  // Token 输入验证
  document.getElementById('mineruToken').addEventListener('blur', validateToken);
}

/**
 * 保存设置
 */
async function saveSettings() {
  const btn = document.getElementById('saveBtn');
  try {
    btn.disabled = true;
    btn.textContent = '保存中...';
    
    const mode = document.querySelector('input[name="conversionMode"]:checked').value;
    await storage.setConversionMode(mode);
    
    const token = document.getElementById('mineruToken').value.trim();
    if (token) {
      await storage.setMinerUToken(token);
    }
    
    logger.info('Settings saved');
    showToast('✅ 设置已保存', 'success');
  } catch (error) {
    logger.error('Failed to save settings:', error);
    showToast('保存失败：' + error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '保存设置';
  }
}

/**
 * 恢复默认设置
 */
async function resetSettings() {
  if (!confirm('确定要恢复默认设置吗？')) return;
  
  try {
    // 恢复默认模式
    await storage.setConversionMode(CONVERSION_MODE.QUALITY);
    document.querySelector(`input[name="conversionMode"][value="${CONVERSION_MODE.QUALITY}"]`).checked = true;
    
    // 清空 Token
    document.getElementById('mineruToken').value = '';
    document.getElementById('tokenStatus').style.display = 'none';
    
    showToast('✅ 已恢复默认设置', 'success');
  } catch (error) {
    logger.error('Failed to reset settings:', error);
    showToast('恢复失败：' + error.message, 'error');
  }
}

/**
 * Toggle Token 可见性
 */
function toggleTokenVisibility() {
  const input = document.getElementById('mineruToken');
  const btn = document.getElementById('toggleTokenBtn');
  
  if (input.type === 'password') {
    input.type = 'text';
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>
    `;
  } else {
    input.type = 'password';
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    `;
  }
}

/**
 * 验证 Token
 */
async function validateToken() {
  const token = document.getElementById('mineruToken').value.trim();
  const statusEl = document.getElementById('tokenStatus');
  
  if (!token) {
    statusEl.style.display = 'none';
    return;
  }
  
  // 简单的格式验证（实际应该调用 API 验证）
  if (token.length < 10) {
    statusEl.className = 'token-status error';
    statusEl.textContent = '❌ Token 格式无效（长度过短）';
    return;
  }
  
  // 这里应该调用 MinerU API 验证 Token
  // 暂时只做格式检查
  statusEl.className = 'token-status success';
  statusEl.textContent = '✅ Token 格式正确（建议保存后测试）';
}

/**
 * 重置统计数据
 */
async function resetStatistics() {
  if (!confirm('确定要重置所有统计数据吗？')) return;
  
  try {
    await storage.set('statistics', {
      totalConversions: 0,
      ar5ivSuccess: 0,
      mineruSuccess: 0,
      pdfFallback: 0,
      lastConversionTime: null
    });
    
    await loadStatistics();
    showToast('✅ 统计数据已重置', 'success');
  } catch (error) {
    logger.error('Failed to reset statistics:', error);
    showToast('重置失败：' + error.message, 'error');
  }
}

/**
 * 显示 Toast 提示
 */
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  const messageEl = toast.querySelector('.toast-message');
  
  messageEl.textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

