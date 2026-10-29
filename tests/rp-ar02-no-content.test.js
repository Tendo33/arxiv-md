/**
 * release-polish AR-02：ar5iv「No content available」页（hep-th/9711200）不算可用 HTML，退回 PDF；
 * 空正文的转换结果绝不显示「转换完成」。
 */
jest.mock('@utils/logger', () => ({ __esModule: true, default: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() } }));
jest.mock('@utils/storage', () => ({
  __esModule: true,
  default: {
    getConversionMode: jest.fn(async () => 'fast'), getPdfParseReadiness: jest.fn(async function () { return { ready: !!(await this.getMinerUToken()), provider: 'mineru' }; }), getMinerUToken: jest.fn(async () => null),
    getIncludeMetadata: jest.fn(async () => true), incrementConversion: jest.fn(async () => {}),
    getLanguage: jest.fn(async () => 'zh'),
  },
}));
jest.mock('@core/converter/ar5iv-converter', () => ({ __esModule: true, default: { convert: jest.fn() } }));
jest.mock('@utils/helpers', () => ({
  __esModule: true,
  ...jest.requireActual('@utils/helpers'),
  showNotification: jest.fn(),
}));
const fs = require('fs');
const path = require('path');
import { isUsableHtmlPaper, isNoContentPage, hasMarkdownBody, selectConversionSource } from '../src/core/html-paper';
import ar5ivConverter from '@core/converter/ar5iv-converter';
import converter from '@core/converter';
import { showNotification } from '@utils/helpers';
import { translations } from '@config/locales';

const noContent = fs.readFileSync(path.join(__dirname, 'fixtures/ar5iv-no-content-hep-th-9711200.html'), 'utf8');
const ok = { ok: true, finalUrl: 'https://ar5iv.labs.arxiv.org/html/hep-th/9711200', contentType: 'text/html; charset=utf-8' };

describe('AR-02 ar5iv No content available', () => {
  test('fixture 本身有 ltx_document，旧判断会当成可用', () => {
    expect(noContent).toMatch(/<article class="ltx_document">/);
    expect(isNoContentPage(noContent)).toBe(true);
    expect(isUsableHtmlPaper({ ...ok, html: noContent })).toBe(false);
  });

  test('标题不同但 article 为空 / 只有 Fatal error 也不可用', () => {
    const html = noContent.replace(/No content available/, 'Some paper');
    expect(isUsableHtmlPaper({ ...ok, html })).toBe(false);
  });

  test('正常论文 fixture 仍然可用', () => {
    const dir = path.join(__dirname, 'fixtures/papers');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.html')).slice(0, 5);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const html = fs.readFileSync(path.join(dir, f), 'utf8');
      expect([f, isUsableHtmlPaper({ ...ok, html })]).toEqual([f, true]);
    }
  });

  test('两个来源都是空页 → tier pdf', async () => {
    const fetchImpl = jest.fn(async (url) => ({ ok: true, status: 200, url, headers: { get: () => 'text/html' }, text: async () => noContent }));
    const r = await selectConversionSource('hep-th/9711200', fetchImpl);
    expect(r).toEqual({ tier: 'pdf', paper: null });
  });

  test('hasMarkdownBody', () => {
    expect(hasMarkdownBody('')).toBe(false);
    expect(hasMarkdownBody(null)).toBe(false);
    expect(hasMarkdownBody('---\ntitle: X\n---\n\n# X\n\n> arXiv: hep-th/9711200\n\n---\n')).toBe(false);
    expect(hasMarkdownBody('# X\n\nConversion to HTML had a Fatal error and exited abruptly. This document may be truncated or damaged.\n')).toBe(false);
    expect(hasMarkdownBody('# X\n\nReal body text.')).toBe(true);
  });

  test('转换结果正文为空 → 退回 PDF，不发「转换完成」', async () => {
    ar5ivConverter.convert.mockResolvedValueOnce({ markdown: '---\ntitle: X\n---\n\n# X\n', title: 'X', metadata: { source: 'ar5iv' } });
    const spy = jest.spyOn(converter, '_fallbackToPdf').mockResolvedValue({ success: true, tier: 'pdf_fallback' });
    const dl = jest.spyOn(converter, '_downloadViaContentScript').mockResolvedValue();
    try {
      const r = await converter.convert({ arxivId: 'hep-th/9711200', title: 'X' }, null, 42);
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ arxivId: 'hep-th/9711200' }), null, 42);
      expect(dl).not.toHaveBeenCalled();
      expect(r.tier).toBe('pdf_fallback');
      const done = translations.zh.notify_done_title;
      expect(showNotification.mock.calls.some(([title]) => title === done)).toBe(false);
    } finally { spy.mockRestore(); dl.mockRestore(); }
  });
});
