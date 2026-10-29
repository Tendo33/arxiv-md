/**
 * AR-02 补丁：共用写前检查（@pdf-core/output/pre-save）覆盖 html / ar5iv / PDF 解析三条路径。
 * 空正文：不写空文件、不显示「完成」、提示改用 PDF。
 */
jest.mock('@utils/logger', () => ({ __esModule: true, default: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() } }));
jest.mock('@utils/storage', () => ({
  __esModule: true,
  default: {
    getConversionMode: jest.fn(async () => 'fast'), getPdfParseReadiness: jest.fn(async () => ({ ready: false, provider: 'paddleocr' })),
    getIncludeMetadata: jest.fn(async () => true), incrementConversion: jest.fn(async () => {}), getLanguage: jest.fn(async () => 'zh'),
  },
}));
jest.mock('@core/converter/ar5iv-converter', () => ({ __esModule: true, default: { convert: jest.fn() } }));
jest.mock('@utils/helpers', () => ({ __esModule: true, ...jest.requireActual('@utils/helpers'), showNotification: jest.fn() }));
import ar5ivConverter from '@core/converter/ar5iv-converter';
import converter from '@core/converter';
import { showNotification } from '@utils/helpers';
import { translations } from '@config/locales';
import { createParseTaskRunner } from '../src/background/parse-task-runner';
import { failureText } from '../src/background/task-notification-text';
import { hasMarkdownBody, assertSavableMarkdown } from '@pdf-core/output/pre-save';
const fs = require('fs');
const path = require('path');

const EMPTY_MD = '---\ntitle: X\n---\n\n# X\n\n> arXiv: hep-th/9711200\n\n---\n';

describe.each([
  ['html', { source: 'arxiv-html' }],
  ['ar5iv', { source: 'ar5iv' }],
])('AR-02 %s 路径空正文', (name, metadata) => {
  beforeEach(() => { showNotification.mockClear(); });
  test('不写 .md、不发「完成」，改存 PDF 并说明原因', async () => {
    ar5ivConverter.convert.mockResolvedValueOnce({ markdown: EMPTY_MD, title: 'X', metadata });
    const dl = jest.spyOn(converter, '_downloadViaContentScript').mockResolvedValue();
    const pdf = jest.spyOn(converter, '_fallbackToPdf').mockImplementation(async (p, o, tab, opts) => ({ success: true, tier: 'pdf_fallback', filename: 'x.pdf', ...(opts.emptyHtml ? { emptyContent: true } : {}) }));
    try {
      const r = await converter.convert({ arxivId: 'hep-th/9711200', title: 'X' }, null, 7);
      expect(dl).not.toHaveBeenCalled();
      expect(pdf).toHaveBeenCalledWith(expect.anything(), null, 7, { emptyHtml: true });
      expect(r.emptyContent).toBe(true);
      const titles = showNotification.mock.calls.map((c) => c[0]);
      expect(titles).not.toContain(translations.zh.notify_done_title);
    } finally { dl.mockRestore(); pdf.mockRestore(); }
  });
});

test('AR-02 回退 PDF 时通知用「HTML 没有正文」，不是普通的「已保存为 PDF」', async () => {
  const dlMod = require('@utils/helpers');
  showNotification.mockClear();
  const spy = jest.spyOn(dlMod, 'downloadFile').mockResolvedValue(1);
  try {
    const r = await converter._fallbackToPdf({ arxivId: 'hep-th/9711200', title: 'X' }, null, null, { emptyHtml: true });
    if (r.success) {
      expect(r.emptyContent).toBe(true);
      expect(showNotification.mock.calls[0][0]).toBe(translations.zh.notify_pdf_fallback_empty_title);
    }
  } finally { spy.mockRestore(); }
});

describe('AR-02 PDF 解析路径空正文', () => {
  test('任务失败为 empty_result，不调用 saveDeliverable，文案提示用 PDF', async () => {
    const save = jest.fn(async () => ({ id: 1, filename: 'a.md' }));
    const updates = [];
    const task = { id: 't1', provider: 'paddleocr', paperInfo: { arxivId: '2401.00001', title: 'T' }, oa: true, consent: true };
    const provider = { id: 'paddleocr', mode: 'sync', submit: async () => ({ result: { markdown: '# T\n\n' } }) };
    const runner = createParseTaskRunner({
      registry: { get: () => provider },
      taskManager: { getTask: async () => task, updateTask: async (id, u) => { updates.push(u); } },
      storage: { getProviderKey: async () => 'k' },
      guard: { consume: async () => false },
      downloadUrl: async () => 1, saveDeliverable: save, makeFilename: () => 'a.md',
    });
    await runner.process('t1');
    expect(save).not.toHaveBeenCalled();
    const last = updates[updates.length - 1];
    expect(last).toMatchObject({ status: 'failed', errorCode: 'PROVIDER_FAILED', errorReason: 'empty_result' });
    expect(updates.some((u) => u.status === 'completed')).toBe(false);
    expect(failureText({ code: 'PROVIDER_FAILED', reason: 'empty_result' }, 'PaddleOCR', 'zh')).toMatch(/PDF/);
    expect(failureText({ code: 'PROVIDER_FAILED', reason: 'empty_result' }, 'PaddleOCR', 'en')).toMatch(/PDF/);
  });
});

test('共用检查：判定与旧实现一致，三条路径都引用同一个模块', () => {
  expect(hasMarkdownBody(EMPTY_MD)).toBe(false);
  expect(hasMarkdownBody('# T\n\nBody.')).toBe(true);
  expect(() => assertSavableMarkdown('')).toThrow();
  const src = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
  expect(src('src/core/converter/index.js')).toMatch(/assertSavableMarkdown\(result\?\.markdown/);
  expect(src('src/background/parse-task-runner.js')).toMatch(/assertSavableMarkdown\(fetched\.markdown/);
  expect(src('src/content/progress-ui.js')).toMatch(/content_progress_empty/);
  for (const l of ['zh', 'en']) for (const k of ['content_progress_empty', 'content_result_empty', 'err_reason_empty_result', 'notify_pdf_fallback_empty_title']) expect(translations[l][k]).toBeTruthy();
});
