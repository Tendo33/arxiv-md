// batch6：converter 系统通知走 locales（zh/en）；不再出现 MinerU 旧名；失败通知不透出原始 error.message
jest.mock('@utils/storage', () => ({
  __esModule: true,
  default: {
    getConversionMode: jest.fn(async () => 'fast'), getMinerUToken: jest.fn(async () => 'tok'),
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

// AB6-06：PDF 下载失败通知按原因区分：网络 → 「请检查网络」；其他（如 Invalid filename）→ 不再提网络
beforeEach(() => jest.clearAllMocks());
const last = () => showNotification.mock.calls[showNotification.mock.calls.length - 1];
const paper = { arxivId: '2401.00001', title: 'T' };

describe.each([['zh'], ['en']])('语言 %s', (lang) => {
  const t = translations[lang];
  beforeEach(() => storage.getLanguage.mockResolvedValue(lang));

  test.each(['Failed to fetch', 'net::ERR_INTERNET_DISCONNECTED'])('网络失败 %s → 网络文案 + errorCode', async (msg) => {
    downloadFile.mockRejectedValueOnce(new Error(msg));
    const r = await converter.downloadPdf(paper);
    expect(last()).toEqual([t.notify_download_failed_network_title, t.notify_download_failed_network_body, 'basic']);
    expect(r.errorCode).toBe('NETWORK_OFFLINE');
  });

  test('非网络失败（Invalid filename）→ 通用文案，不提网络', async () => {
    downloadFile.mockRejectedValueOnce(new Error('Invalid filename'));
    const r = await converter.downloadPdf(paper);
    expect(last()).toEqual([t.notify_download_failed_title, t.notify_download_failed_body, 'basic']);
    expect(t.notify_download_failed_body).not.toMatch(/网络|network/i);
    expect(r.errorCode).toBeUndefined();
  });
});
