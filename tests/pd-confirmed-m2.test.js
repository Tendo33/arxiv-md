// 设计复验 6a49976 M2：✓ 行带服务名，放进 fieldset 网格紧跟被确认的卡片，CSS 按 data-col 对齐列
import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { createPermissions } from './helpers/chrome-stubs';
import { createDefaultRegistry } from '@pdf-core/providers/index';
import { createPdfProviderSection } from '../src/ui/settings/pdf-provider';
import { translations } from '../src/config/locales';

const html = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.css'), 'utf8');
function setup(lang, hash) {
  const { document } = parseHTML(html);
  const store = { provider: 'paddleocr' };
  const mem = {};
  const local = { get: jest.fn(async (k) => (k in mem ? { [k]: mem[k] } : {})), set: jest.fn(async (o) => Object.assign(mem, o)) };
  const storage = { getPdfProvider: jest.fn(async () => store.provider), setPdfProvider: jest.fn(async (id) => { store.provider = id; }), getProviderKey: jest.fn(async () => null), setProviderKey: jest.fn(async () => {}) };
  const sec = createPdfProviderSection({ doc: document, storage, permissions: createPermissions({ origins: [], permissions: [], answer: true }), registry: createDefaultRegistry(), t: () => translations[lang], toast: jest.fn(), local, location: { hash } });
  return { document, sec };
}

test('文案定稿：zh / en 带服务名', () => {
  expect(translations.zh.pdf_disc_confirmed.replace('{name}', 'MinerU')).toBe('已确认 MinerU。回到 arXiv 页面再点一次即可开始。');
  expect(translations.en.pdf_disc_confirmed.replace('{name}', 'PaddleOCR')).toBe('PaddleOCR confirmed. Go back to the arXiv page and click again to start.');
});

test.each([
  ['zh', 'mineru', 'MinerU', '2'],
  ['zh', 'paddleocr', 'PaddleOCR', '1'],
  ['en', 'mineru', 'MinerU', '2'],
  ['en', 'paddleocr', 'PaddleOCR', '1'],
])('%s 确认 %s：✓ 带名称、紧跟该卡片、data-col=%s', async (lang, id, name, col) => {
  const h = setup(lang, `#disclose=${id}`);
  await h.sec.init();
  await h.sec.onAgree(id);
  const el = h.document.getElementById('pdConfirmed');
  expect(el.hidden).toBe(false);
  expect(el.textContent).toBe(`✓ ${translations[lang].pdf_disc_confirmed.replace('{name}', name)}`);
  expect(el.previousElementSibling.getAttribute('data-provider')).toBe(id);
  expect(el.parentElement.id).toBe('pdfProviderGroup');
  expect(el.dataset.col).toBe(col);
  expect(el.getAttribute('role')).toBe('status');
});

test('CSS：data-col 对应列、grid-row:2；单列断点下回到自动流；样式 8px / 13/20 / --success 不变', () => {
  expect(css).toMatch(/\.provider-group > \.pd-confirmed\[data-col="1"\] \{ grid-column: 1; grid-row: 2; \}/);
  expect(css).toMatch(/\.provider-group > \.pd-confirmed\[data-col="2"\] \{ grid-column: 2; grid-row: 2; \}/);
  expect(css).toMatch(/@media \(max-width: 539px\) \{ \.provider-group > \.pd-confirmed\[data-col\] \{ grid-column: auto; grid-row: auto; \} \}/);
  expect(css).toMatch(/\.pd-confirmed \{ margin: 8px 0 0; font-size: 13px; line-height: 20px; color: var\(--success\); \}/);
});
test('e2e-settings-confirmed 在 test:e2e 链里', () => { expect(require('../package.json').scripts['test:e2e']).toMatch(/node scripts\/e2e-settings-confirmed\.js/); });
