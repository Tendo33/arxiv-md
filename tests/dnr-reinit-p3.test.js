import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { createPermissions } from './helpers/chrome-stubs';
import { createDefaultRegistry } from '@pdf-core/providers/index';
import { createPdfProviderSection } from '../src/ui/settings/pdf-provider';
import { translations } from '../src/config/locales';

const html = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.html'), 'utf8');
const ORIGINS = ['https://paddleocr.aistudio-app.com/*', 'https://*.bj.bcebos.com/*'];

function setup({ provider = 'paddleocr', granted = true, lang = 'zh' } = {}) {
  const { document } = parseHTML(html);
  const storage = { getPdfProvider: async () => provider, setPdfProvider: async () => {}, getProviderKey: async () => 'k', setProviderKey: async () => {} };
  const permissions = createPermissions({ origins: granted ? ORIGINS : [], permissions: granted ? ['declarativeNetRequestWithHostAccess'] : [], answer: true });
  const runtime = { reload: jest.fn() };
  const sec = createPdfProviderSection({ doc: document, storage, permissions, registry: createDefaultRegistry(), t: () => translations[lang], runtime });
  return { document, sec, runtime, permissions };
}

describe('审查员 P3：dnr_not_ready 在权限已授予时也有恢复入口', () => {
  test('PaddleOCR + 权限已授予 → 显示「重新初始化」，点击只调用 runtime.reload，不申请权限', async () => {
    const { document, sec, runtime, permissions } = setup();
    await sec.init(); sec.bind && sec.bind();
    const btn = document.getElementById('reinitBtn');
    expect(btn.hidden).toBe(false);
    expect(btn.textContent).toBe('重新初始化');
    const req = jest.spyOn(permissions, 'request');
    btn.dispatchEvent(new document.defaultView.Event('click'));
    expect(runtime.reload).toHaveBeenCalledTimes(1);
    expect(req).not.toHaveBeenCalled();
  });
  test('未授权或 MinerU → 不显示', async () => {
    let s = setup({ granted: false }); await s.sec.init();
    expect(s.document.getElementById('reinitBtn').hidden).toBe(true);
    s = setup({ provider: 'mineru' }); await s.sec.init();
    expect(s.document.getElementById('reinitBtn').hidden).toBe(true);
  });
  test('错误文案指向「重新初始化」（中英）', () => {
    expect(translations.zh.err_reason_dnr_not_ready).toMatch(/重新初始化/);
    expect(translations.en.err_reason_dnr_not_ready).toMatch(/Reinitialize/);
  });
});
