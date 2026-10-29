// QA L-03：全新安装、在本设备刚选 PaddleOCR（还没填 Key）→ 不能提示「你在另一台设备上选了…」
import { installChrome } from './helpers/chrome-stubs';

const loadStorage = () => { jest.resetModules(); return require('../src/utils/storage').default; };

test('本设备刚选（setPdfProvider）→ getChosenPdfProvider = null，keyMissingHere = false', async () => {
  installChrome({});
  const s = loadStorage();
  await s.setPdfProvider('paddleocr');
  expect(await s.getChosenPdfProvider()).toBeNull();
  expect(await s.getActivePdfProvider()).toEqual({ id: 'paddleocr', hasKey: false, keyMissingHere: false });
});
test('另一台设备选的（只有 sync）→ 仍提示在本设备填 Key', async () => {
  installChrome({ sync: { pdfProvider: 'paddleocr' } });
  const s = loadStorage();
  expect(await s.getChosenPdfProvider()).toBe('paddleocr');
});
test('本设备选过 MinerU、另一台设备改成 PaddleOCR → 仍算另一台设备', async () => {
  installChrome({ sync: { pdfProvider: 'paddleocr' }, local: { pdfProviderSetHere: 'mineru' } });
  const s = loadStorage();
  expect(await s.getChosenPdfProvider()).toBe('paddleocr');
});
