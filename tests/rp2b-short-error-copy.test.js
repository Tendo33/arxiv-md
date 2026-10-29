// rp2b（设计复核 46ecc9e ①②）：已单独显示后端名的地方（popup 任务行、设置页「{provider} 解析失败：」）
// 用不带后端名的 err_short_*；通知 / 页面卡片继续用带 {provider} 的 err_* / err_reason_*
import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { translations } from '@config/locales';
import { ALL_ERROR_CODES, ParseError } from '@pdf-core/errors';
import { providerLabel } from '@config/pdf-providers';
import { createPermissions } from './helpers/chrome-stubs';
import { createDefaultRegistry } from '@pdf-core/providers/index';
import { taskErrorText } from '../src/ui/popup/task-error-text';
import { createPdfProviderSection } from '../src/ui/settings/pdf-provider';

const { zh, en } = translations;
const DESIGN = {
  zh: {
    AUTH_INVALID: 'Key 无效或未填写', QUOTA_EXCEEDED: '额度已用完，请稍后再试或换一个后端', RATE_LIMITED: '请求太频繁，请稍等片刻再重试',
    FILE_UNSUPPORTED: '无法处理这个 PDF', TOO_LARGE: 'PDF 太大，超出了限制', NETWORK: '连不上服务，请检查网络',
    PERMISSION_MISSING: '需要授权访问 {host}', permission_plain: '需要网站访问授权，请到设置 › PDF 解析里授权', TIMEOUT: '处理超时，任务已停止',
    reason_forbidden_empty: '请求被拒绝（与 Key 或额度无关），可以稍后重试或换一个后端', failed_plain: '没能解析这个 PDF，可以重试，或在设置里换一个后端',
    reason_key_not_on_device: '本设备还没有 Key（Key 不会跨设备同步），请在设置 › PDF 解析里填写',
  },
  en: {
    AUTH_INVALID: 'Invalid or missing key', QUOTA_EXCEEDED: 'Quota exhausted. Try again later or switch provider', RATE_LIMITED: 'Too many requests. Wait a moment and retry',
    FILE_UNSUPPORTED: "Can't process this PDF", TOO_LARGE: 'PDF is too large for this provider', NETWORK: "Can't connect. Check your network",
    PERMISSION_MISSING: 'Needs access to {host}', permission_plain: 'Needs site access. Grant it in Settings › PDF parsing', TIMEOUT: 'Timed out. The task was stopped',
    reason_forbidden_empty: 'Request rejected (not a key or quota problem). Retry later or switch provider', failed_plain: "Couldn't parse this PDF. Retry, or switch provider in Settings",
    reason_key_not_on_device: "No key on this device (keys don't sync). Add it in Settings › PDF parsing",
  },
};
const LABELS = ['PaddleOCR', 'MinerU'];
const count = (s, label) => s.split(label).length - 1;

test('设计给的不带后端名文案逐字一致，zh/en 键集合相同', () => {
  for (const l of ['zh', 'en']) for (const [k, v] of Object.entries(DESIGN[l])) expect(translations[l][`err_short_${k}`]).toBe(v);
  const keys = (t) => Object.keys(t).filter((k) => k.startsWith('err_short_')).sort();
  expect(keys(zh)).toEqual(keys(en));
  for (const k of keys(zh)) for (const t of [zh, en]) expect(t[k]).not.toMatch(/\{provider\}|PaddleOCR|MinerU|403|HTTP/);
});

test('旧的 err_task_* 已并入 err_short_*', () => {
  for (const t of [zh, en]) expect(Object.keys(t).filter((k) => k.startsWith('err_task_'))).toEqual([]);
});

describe.each(['zh', 'en'])('任务行 %s：每个错误码 / reason 都不带后端名', (lang) => {
  const t = translations[lang];
  const cases = [
    ...ALL_ERROR_CODES.map((code) => ({ errorCode: code })),
    { errorCode: 'PERMISSION_MISSING', errorHost: 'paddleocr.aistudio-app.com' },
    { errorCode: 'PROVIDER_FAILED', errorReason: 'forbidden_empty' },
    { errorCode: 'PROVIDER_FAILED', errorReason: 'key_not_on_device' },
    { errorCode: 'PROVIDER_FAILED', errorReason: 'empty_result' },
  ];
  test.each(cases)('%o', (c) => {
    for (const provider of ['paddleocr', 'mineru']) {
      const s = taskErrorText({ status: 'failed', provider, ...c }, t, providerLabel);
      for (const L of LABELS) expect(count(s, L)).toBe(0);
      expect(s).not.toMatch(/\{\w+\}/);
    }
  });
  test('映射到设计文案', () => {
    const d = DESIGN[lang];
    expect(taskErrorText({ provider: 'mineru', errorCode: 'QUOTA_EXCEEDED' }, t)).toBe(d.QUOTA_EXCEEDED);
    expect(taskErrorText({ provider: 'mineru', errorCode: 'TIMEOUT' }, t)).toBe(d.TIMEOUT);
    expect(taskErrorText({ provider: 'mineru', errorCode: 'RATE_LIMITED' }, t)).toBe(d.RATE_LIMITED);
    expect(taskErrorText({ provider: 'mineru', errorCode: 'PERMISSION_MISSING' }, t)).toBe(d.permission_plain);
    expect(taskErrorText({ provider: 'mineru', errorCode: 'PERMISSION_MISSING', errorHost: 'mineru.net' }, t)).toBe(d.PERMISSION_MISSING.replace('{host}', 'mineru.net'));
    expect(taskErrorText({ provider: 'mineru', errorCode: 'PROVIDER_FAILED' }, t)).toBe(d.failed_plain);
    expect(taskErrorText({ provider: 'mineru', errorCode: 'PROVIDER_FAILED', errorReason: 'key_not_on_device' }, t)).toBe(d.reason_key_not_on_device);
  });
});

let failureText;
beforeAll(() => {
  global.chrome = global.chrome || { storage: { sync: {}, local: {} }, i18n: { getUILanguage: () => 'en' } };
  ({ failureText } = require('../src/background/task-notification-text'));
});

describe.each(['zh', 'en'])('通知 %s：没有单独的后端名，继续带 {provider}', (lang) => {
  test.each(['AUTH_INVALID', 'QUOTA_EXCEEDED', 'TIMEOUT'])('%s', (code) => {
    expect(failureText(new ParseError(code, { provider: 'mineru' }), 'MinerU', lang)).toContain('MinerU');
  });
  test('forbidden_empty / key_not_on_device', () => {
    for (const reason of ['forbidden_empty', 'key_not_on_device']) {
      expect(failureText(new ParseError('PROVIDER_FAILED', { provider: 'mineru', reason }), 'MinerU', lang)).toContain('MinerU');
    }
  });
});

const html = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.html'), 'utf8');
async function settingsRow(lang, error) {
  const { document } = parseHTML(html);
  const base = createDefaultRegistry();
  const p = { ...base.get('paddleocr'), testConnection: async () => ({ ok: false, error }) };
  const registry = { ...base, get: (id) => (id === 'paddleocr' ? p : base.get(id)), list: base.list ? base.list.bind(base) : undefined };
  const storage = { getPdfProvider: async () => 'paddleocr', setPdfProvider: async () => {}, getProviderKey: async () => 'fixture-key', setProviderKey: async () => {} };
  const permissions = createPermissions({ origins: ['https://paddleocr.aistudio-app.com/*'], permissions: ['declarativeNetRequestWithHostAccess'] });
  const sec = createPdfProviderSection({ doc: document, storage, permissions, registry, t: () => translations[lang] });
  await sec.init();
  await sec.onTest();
  return document.getElementById('tokenStatus').textContent;
}

describe.each(['zh', 'en'])('设置页错误行 %s：后端名最多出现一次', (lang) => {
  const errs = [
    ...ALL_ERROR_CODES.map((code) => new ParseError(code, { provider: 'paddleocr' })),
    new ParseError('PROVIDER_FAILED', { provider: 'paddleocr', reason: 'forbidden_empty', httpStatus: 403 }),
    new ParseError('PROVIDER_FAILED', { provider: 'paddleocr', reason: 'key_not_on_device' }),
  ];
  test.each(errs.map((e) => [e.code, e.reason || '-', e]))('%s / %s', async (_c, _r, e) => {
    const s = await settingsRow(lang, e);
    expect(count(s, 'PaddleOCR')).toBeLessThanOrEqual(1);
    expect(s).not.toMatch(/\{\w+\}|403|[A-Z]+_[A-Z_]+/);
  });
  test('没有 reason 的 PROVIDER_FAILED 不把原始码 "paddleocr: PROVIDER_FAILED" 给用户看', async () => {
    const s = await settingsRow(lang, new ParseError('PROVIDER_FAILED', { provider: 'paddleocr' }));
    const t = translations[lang];
    expect(s).toBe(`❌ ${t.err_PROVIDER_FAILED.replace('{provider}', 'PaddleOCR').replace('{reason}', t.err_short_failed_plain)}`);
  });
  test('forbidden_empty：「{provider} 解析失败：」+ 不带后端名的短文案', async () => {
    const s = await settingsRow(lang, new ParseError('PROVIDER_FAILED', { provider: 'paddleocr', reason: 'forbidden_empty' }));
    const t = translations[lang];
    expect(s).toBe(`❌ ${t.err_PROVIDER_FAILED.replace('{provider}', 'PaddleOCR').replace('{reason}', t.err_short_reason_forbidden_empty)}`);
  });
});
