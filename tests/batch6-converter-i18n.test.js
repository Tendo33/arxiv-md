// batch6：converter 系统通知走 locales（zh/en）；不再出现 MinerU 旧名；失败通知不透出原始 error.message
jest.mock('@utils/storage', () => ({
  __esModule: true,
  default: {
    getConversionMode: jest.fn(async () => 'fast'), getPdfParseReadiness: jest.fn(async function () { return { ready: !!(await this.getMinerUToken()), provider: 'mineru' }; }), getMinerUToken: jest.fn(async () => 'tok'),
    getIncludeMetadata: jest.fn(async () => true), incrementConversion: jest.fn(async () => {}),
    getLanguage: jest.fn(async () => 'zh'),
  },
}));
jest.mock('@core/converter/ar5iv-converter', () => ({ __esModule: true, default: { convert: jest.fn() } }));
jest.mock('@utils/helpers', () => ({
  __esModule: true, generateFilename: jest.fn(() => 'p.pdf'), downloadFile: jest.fn(async () => {}), showNotification: jest.fn(),
  downloadFailureKind: jest.requireActual('@utils/helpers').downloadFailureKind,
}));
import storage from '@utils/storage';
import ar5iv from '@core/converter/ar5iv-converter';
import { downloadFile, showNotification } from '@utils/helpers';
import converter from '@core/converter';
import { translations } from '@config/locales';

const paper = { arxivId: '2401.00001', title: 'T' };
const last = () => showNotification.mock.calls[showNotification.mock.calls.length - 1];
const RAW = 'net::ERR_SECRET_DETAIL https://x/y?token=abc';

beforeEach(() => { jest.clearAllMocks(); converter._downloadViaContentScript = jest.fn(async () => {}); });

describe.each([['zh'], ['en']])('语言 %s', (lang) => {
  const t = translations[lang];
  beforeEach(() => storage.getLanguage.mockResolvedValue(lang));

  test('转换完成', async () => {
    ar5iv.convert.mockResolvedValue({ markdown: '# x\n\nbody', metadata: { source: 'ar5iv' } });
    await converter.convert(paper);
    expect(last()[0]).toBe(t.notify_done_title);
    expect(last()[1]).toContain('ar5iv');
  });
  test('PDF 降级成功 / 失败（失败不透出原始错误）', async () => {
    await converter._fallbackToPdf(paper);
    expect(last()[0]).toBe(t.notify_pdf_fallback_title);
    downloadFile.mockRejectedValueOnce(new Error(RAW));
    const r = await converter._fallbackToPdf(paper);
    // batch8 AB7-02：降级的 PDF 也下载失败时，通知和状态卡一样说「下载失败」
    expect(last()).toEqual([t.notify_download_failed_title, t.notify_download_failed_body, 'basic']);
    expect(r.downloadFailure).toBe('other');
  });
  test('直接下载 PDF 成功 / 失败', async () => {
    await converter.downloadPdf(paper);
    expect(last()[0]).toBe(t.notify_pdf_saved_title);
    downloadFile.mockRejectedValueOnce(new Error(RAW));
    const r = await converter.downloadPdf(paper);
    expect(last()).toEqual([t.notify_download_failed_title, t.notify_download_failed_body, 'basic']);
    expect(r.error).toBe(RAW); // 返回值保留细节供调用方日志
  });
  test('PDF 解析任务已提交（不再用 MinerU 旧名）', async () => {
    // content script 分支（background 分支动态 import @background，jest 下不可解析；由下方源码检查兜底）
    global.chrome = { runtime: { sendMessage: (msg, cb) => cb({ success: true, taskId: 't1' }) } };
    await converter._convertWithMinerU(paper);
    await new Promise((r) => setTimeout(r, 0));
    expect(last()[0]).toBe(t.notify_task_submitted_title);
    expect(last()[1]).toContain('T');
    delete global.chrome;
  });
});

test('converter 源码不再硬编码通知文案', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../src/core/converter/index.js'), 'utf8');
  expect(src).not.toMatch(/MinerU 任务已提交|转换完成|已保存为 PDF|PDF 已保存/);
  expect(src).not.toMatch(/showNotification\([^)]*error\.message/s);
});

test('所有通知不含原始错误和 MinerU 字样；zh/en key 对齐', () => {
  for (const lang of ['zh', 'en']) {
    const keys = Object.keys(translations[lang]).filter((k) => /^notify_(done|task_submitted|pdf_fallback|convert_failed|pdf_saved|download_failed)_/.test(k));
    expect(keys).toHaveLength(24); // AR-02 新增 pdf_fallback_empty_*； release-polish AB8-02 新增 download_failed_notfound_* / download_failed_forbidden_*; // AB6-06 新增 download_failed_network_*；batch8 AB7-01 新增 download_failed_server_* / download_failed_file_*
    keys.forEach((k) => expect(translations[lang][k]).not.toMatch(/MinerU/));
  }
  for (const c of showNotification.mock.calls) expect(c.join(' ')).not.toContain('ERR_SECRET');
});
