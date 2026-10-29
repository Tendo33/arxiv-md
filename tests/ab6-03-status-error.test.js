jest.mock('@utils/logger', () => ({ __esModule: true, default: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() } }));
import logger from '@utils/logger';
import { translations } from '../src/config/locales';
import { statusCardErrorText } from '../src/content/status-error';

describe('AB6-03 状态卡不显示原始英文报错', () => {
  beforeEach(() => logger.error.mockClear());
  test.each(['zh', 'en'])('%s：Invalid filename → 通用文案，原文进日志', (lang) => {
    const t = translations[lang];
    expect(statusCardErrorText({ success: false, error: 'Invalid filename' }, t)).toBe(t.content_error_generic);
    expect(statusCardErrorText({ success: false, data: { error: 'Invalid filename' } }, t)).toBe(t.content_error_generic);
    expect(statusCardErrorText(new Error('Failed to fetch xyz'), t)).toBe(t.content_error_generic);
    expect(logger.error).toHaveBeenCalledWith('Conversion failed:', 'Invalid filename');
    expect(logger.error).toHaveBeenCalledTimes(3);
  });
  test('离线仍显示离线文案', () => {
    const t = translations.zh;
    expect(statusCardErrorText({ errorCode: 'NETWORK_OFFLINE', error: 'x' }, t)).toBe(t.content_error_offline);
  });
  test('content/index.js 不再把 error / error.message 直接交给 showError', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../src/content/index.js'), 'utf8');
    expect(src).not.toMatch(/showError\([^)]*(?:\.error\b|error\.message)/);
    expect(src.match(/statusCardErrorText\(/g)).toHaveLength(5);
  });
});
