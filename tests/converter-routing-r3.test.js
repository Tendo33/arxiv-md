// C-2 补测：forceMineru 路由不改变「无 Token」时的 ar5iv / PDF 原路径
jest.mock('@utils/storage', () => ({
  __esModule: true,
  default: {
    getConversionMode: jest.fn(), getMinerUToken: jest.fn(), getIncludeMetadata: jest.fn(async () => true),
    incrementConversion: jest.fn(async () => {}),
  },
}));
jest.mock('@core/converter/ar5iv-converter', () => ({ __esModule: true, default: { convert: jest.fn() } }));
jest.mock('@utils/helpers', () => ({
  __esModule: true, generateFilename: jest.fn(() => 'p.md'), downloadFile: jest.fn(async () => {}), showNotification: jest.fn(),
}));
import storage from '@utils/storage';
import ar5iv from '@core/converter/ar5iv-converter';
import converter from '@core/converter';

const paper = (extra = {}) => ({ arxivId: '2401.00001', title: 'T', ...extra });

beforeEach(() => {
  jest.clearAllMocks();
  converter._downloadViaContentScript = jest.fn(async () => {});
  converter._convertWithMinerU = jest.fn(async () => ({ success: true, tier: 'mineru' }));
  converter._fallbackToPdf = jest.fn(async () => ({ success: true, tier: 'pdf' }));
});

describe.each([[false], [true]])('无 Token（forceMineru=%s）', (force) => {
  beforeEach(() => { storage.getConversionMode.mockResolvedValue('fast'); storage.getMinerUToken.mockResolvedValue(null); });
  test('ar5iv 成功 → 仍走 Tier 1，不碰 MinerU', async () => {
    ar5iv.convert.mockResolvedValue({ markdown: '# x\n\nbody', title: 'T', metadata: { source: 'ar5iv' } });
    const r = await converter.convert(paper(force ? { forceMineru: true } : {}));
    expect(r.success).toBe(true);
    expect(r.markdown).toBe('# x\n\nbody');
    expect(converter._convertWithMinerU).not.toHaveBeenCalled();
    expect(converter._fallbackToPdf).not.toHaveBeenCalled();
  });
  test('ar5iv 失败（非断网）→ 仍降级 PDF', async () => {
    ar5iv.convert.mockRejectedValue(new Error('404'));
    const r = await converter.convert(paper(force ? { forceMineru: true } : {}));
    expect(r.tier).toBe('pdf');
    expect(converter._convertWithMinerU).not.toHaveBeenCalled();
  });
});

test('ALWAYS_MINERU 但无 Token → 仍走分层策略（原行为）', async () => {
  storage.getConversionMode.mockResolvedValue('always');
  storage.getMinerUToken.mockResolvedValue('');
  ar5iv.convert.mockResolvedValue({ markdown: 'm', metadata: {} });
  await converter.convert(paper());
  expect(converter._convertWithMinerU).not.toHaveBeenCalled();
  expect(ar5iv.convert).toHaveBeenCalled();
});

test('有 Token：fast 模式默认不走 MinerU，forceMineru 才走', async () => {
  storage.getConversionMode.mockResolvedValue('fast');
  storage.getMinerUToken.mockResolvedValue('tok');
  ar5iv.convert.mockResolvedValue({ markdown: 'm', metadata: {} });
  await converter.convert(paper());
  expect(converter._convertWithMinerU).not.toHaveBeenCalled();
  await converter.convert(paper({ forceMineru: true }));
  expect(converter._convertWithMinerU).toHaveBeenCalledTimes(1);
});
