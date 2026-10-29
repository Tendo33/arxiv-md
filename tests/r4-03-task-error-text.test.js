// R4-03：任务列表不再显示 "paddleocr: NETWORK" 这类原始码
import { taskErrorText } from '../src/ui/popup/task-error-text';
import { translations } from '@config/locales';
import { ALL_ERROR_CODES } from '@pdf-core/errors';
import { providerLabel } from '@config/pdf-providers';
import { parseHTML } from 'linkedom';

const RAW = /\b[a-z]+:\s*[A-Z_]{4,}\b|\b(AUTH_INVALID|QUOTA_EXCEEDED|RATE_LIMITED|FILE_UNSUPPORTED|TOO_LARGE|NETWORK|PERMISSION_MISSING|TIMEOUT|PROVIDER_FAILED)\b|\{\w+\}/;

describe.each(['zh', 'en'])('R4-03 %s', (lang) => {
  const t = translations[lang];
  test.each(ALL_ERROR_CODES)('errorCode %s → 白话，无原始码 / 占位符', (code) => {
    for (const provider of ['paddleocr', 'mineru']) {
      const s = taskErrorText({ status: 'failed', provider, errorCode: code, error: `${provider}: ${code}` }, t, providerLabel);
      expect(s).toBeTruthy();
      expect(s).not.toMatch(RAW);
      expect(s).toContain(providerLabel(provider));
    }
  });
  test('旧任务只有 "paddleocr: NETWORK" 原文 → 也能翻译', () => {
    expect(taskErrorText({ error: 'paddleocr: NETWORK' }, t, providerLabel)).toBe(t.err_NETWORK.replace('{provider}', 'PaddleOCR'));
  });
  test('reason 优先，PERMISSION_MISSING 有 host 时带上 host', () => {
    expect(taskErrorText({ provider: 'paddleocr', errorCode: 'PROVIDER_FAILED', errorReason: 'empty_result' }, t, providerLabel)).toBe(t.err_reason_empty_result);
    expect(taskErrorText({ provider: 'paddleocr', errorCode: 'PERMISSION_MISSING', errorHost: 'paddleocr.aistudio-app.com' }, t, providerLabel)).toContain('paddleocr.aistudio-app.com');
  });
  test('认不出的原文（非 code 格式）保持原样，不吞信息', () => {
    expect(taskErrorText({ error: 'Some message' }, t, providerLabel)).toBe('Some message');
  });
});

test('task-list 行：可见文本是白话，title 是完整白话', async () => {
  const { createTaskRow } = await import('../src/ui/popup/task-list');
  const row = createTaskRow({ id: 1, status: 'failed', provider: 'paddleocr', errorCode: 'NETWORK', error: 'paddleocr: NETWORK', paperInfo: { title: 'T' }, createdAt: Date.now() }, parseHTML('<html><body></body></html>').document);
  const err = row.querySelector('.row-err');
  expect(err.textContent).not.toMatch(/NETWORK/);
  expect(err.getAttribute('title')).toBe(err.textContent);
});
