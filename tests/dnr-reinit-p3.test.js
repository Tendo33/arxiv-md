import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { createDefaultRegistry } from '@pdf-core/providers/index';
import { createPdfProviderSection } from '../src/ui/settings/pdf-provider';
import { translations } from '../src/config/locales';

const html = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.html'), 'utf8');

function setup({ provider = 'paddleocr', lang = 'zh' } = {}) {
  const { document } = parseHTML(html);
  const storage = { getPdfProvider: async () => provider, setPdfProvider: async () => {}, getProviderKey: async () => 'k', setProviderKey: async () => {} };
  const runtime = { reload: jest.fn() };
  const sec = createPdfProviderSection({ doc: document, storage, registry: createDefaultRegistry(), t: () => translations[lang], runtime });
  return { document, sec, runtime };
}

describe('审查员 P3：dnr_not_ready 的恢复入口（1.2.2 起权限安装时授予，PaddleOCR 一律显示）', () => {
  test('PaddleOCR → 显示「重新初始化」，点击只调用 runtime.reload', async () => {
    const { document, sec, runtime } = setup();
    await sec.init(); sec.bind && sec.bind();
    const btn = document.getElementById('reinitBtn');
    expect(btn.hidden).toBe(false);
    expect(document.getElementById('reinitRow').hidden).toBe(false);
    expect(btn.textContent).toBe('重新初始化');
    btn.dispatchEvent(new document.defaultView.Event('click'));
    await new Promise((r) => setTimeout(r, 0));
    expect(runtime.reload).toHaveBeenCalledTimes(1);
  });
  test('MinerU → 不显示', async () => {
    const s = setup({ provider: 'mineru' }); await s.sec.init();
    expect(s.document.getElementById('reinitBtn').hidden).toBe(true);
    expect(s.document.getElementById('reinitRow').hidden).toBe(true);
  });
  test('错误文案指向「重新初始化」（中英）', () => {
    expect(translations.zh.err_reason_dnr_not_ready).toMatch(/重新初始化/);
    expect(translations.en.err_reason_dnr_not_ready).toMatch(/Reinitialize/);
  });
});
