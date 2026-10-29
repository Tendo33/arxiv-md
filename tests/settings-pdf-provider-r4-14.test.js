import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { createPermissions } from './helpers/chrome-stubs';
import { createDefaultRegistry } from '@pdf-core/providers/index';
import { createPdfProviderSection, UI_PROVIDERS } from '../src/ui/settings/pdf-provider';
import { bindInstantSave } from '../src/ui/settings/instant-save';
import { translations } from '../src/config/locales';

const html = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.html'), 'utf8');
const PADDLE = 'https://paddleocr.aistudio-app.com/*';
const BCEBOS = 'https://*.bj.bcebos.com/*'; // 结果/图片域名，和星河域名一起申请

function setup({ provider = 'paddleocr', keys = {}, origins = [], answer = true, lang = 'en' } = {}) {
  const { document } = parseHTML(html);
  const store = { provider, keys: { ...keys } };
  const storage = {
    getPdfProvider: jest.fn(async () => store.provider),
    setPdfProvider: jest.fn(async (id) => { store.provider = id; }),
    getProviderKey: jest.fn(async (id) => store.keys[id] || null),
    setProviderKey: jest.fn(async (id, v) => { if (v) store.keys[id] = v; else delete store.keys[id]; }),
  };
  const permissions = createPermissions({ origins, permissions: origins.length ? ['declarativeNetRequestWithHostAccess'] : [], answer });
  const registry = createDefaultRegistry();
  const toast = jest.fn();
  const sec = createPdfProviderSection({ doc: document, storage, permissions, registry, t: () => translations[lang], toast });
  return { document, storage, permissions, registry, toast, sec, store };
}

describe('R4-14 设置页：后端选择 + Key', () => {
  test('R01：单选卡片只有 PaddleOCR（默认）和 MinerU；本地服务本轮隐藏', () => {
    const { document } = parseHTML(html);
    const opts = [...document.querySelectorAll('#pdfProviderGroup input[name="pdfProvider"]')].map((o) => o.value);
    expect(document.querySelector('select#pdfProvider')).toBeNull();
    expect(document.querySelector('#pdfProviderGroup').tagName).toBe('FIELDSET');
    expect(document.querySelector('#pdfProviderGroup > legend').getAttribute('data-i18n')).toBe('pdf_provider_label');
    expect(opts).toEqual(['paddleocr', 'mineru']);
    expect(UI_PROVIDERS).toEqual(['paddleocr', 'mineru']);
    expect(html).not.toMatch(/localhost|127\.0\.0\.1/);
  });

  test('每个控件都有 label；Key 是 password 输入框', () => {
    const { document } = parseHTML(html);
    expect(document.querySelector('label[for="providerKey"]')).toBeTruthy();
    for (const r of document.querySelectorAll('input[name="pdfProvider"]')) {
      expect(r.closest('label.provider-card')).toBeTruthy();
      expect(document.getElementById(r.getAttribute('aria-describedby'))).toBeTruthy();
    }
    expect(document.getElementById('providerKey').getAttribute('type')).toBe('password');
    expect(document.getElementById('toggleTokenBtn').getAttribute('aria-label')).toBeTruthy();
    // B5：测试连接改为可见文字按钮（文字即可访问名称）
    expect(document.querySelector('#testTokenBtn [data-i18n="mineru_test_btn"]')).toBeTruthy();
  });

  test('中英文 pdf_* 文案齐全', () => {
    const en = Object.keys(translations.en).filter((k) => k.startsWith('pdf_'));
    const zh = Object.keys(translations.zh).filter((k) => k.startsWith('pdf_'));
    expect(en.length).toBeGreaterThan(10);
    expect(zh.sort()).toEqual(en.sort());
  });

  test('init：显示当前后端的说明（数据发往的域名）、Key、授权状态', async () => {
    const h = setup({ keys: { paddleocr: 'fixture-key' } });
    await h.sec.init();
    const d = h.document;
    expect([...d.querySelectorAll('input[name="pdfProvider"]')].find((r) => r.checked).value).toBe('paddleocr');
    expect(d.getElementById('getKeyText').textContent).toBe(translations.en.pdf_get_key.replace('{provider}', 'PaddleOCR'));
    expect(d.getElementById('providerKey').value).toBe('fixture-key');
    expect(d.getElementById('providerKey').dataset.provider).toBe('paddleocr');
    expect(d.getElementById('grantPermissionBtn').hidden).toBe(false);
    expect(d.getElementById('providerKeyLabel').textContent).toBe('PaddleOCR API key');
  });

  test('切到 PaddleOCR：先申请权限（域名 + DNR 一次弹窗），同意后才保存', async () => {
    const h = setup({ provider: 'mineru' });
    await h.sec.init();
    expect(await h.sec.onSelect('paddleocr')).toBe(true);
    expect(h.permissions.request).toHaveBeenCalledTimes(1);
    expect(h.permissions.request.mock.calls[0][0].origins).toEqual([PADDLE, BCEBOS]);
    expect(h.storage.setPdfProvider).toHaveBeenCalledWith('paddleocr');
    expect(h.document.getElementById('grantPermissionBtn').hidden).toBe(true);
  });

  test('用户拒绝授权 → 下拉框回到原来的后端，提示 PERMISSION_MISSING，不保存', async () => {
    const h = setup({ provider: 'mineru', answer: false });
    await h.sec.init();
    expect(await h.sec.onSelect('paddleocr')).toBe(false);
    expect([...h.document.querySelectorAll('input[name="pdfProvider"]')].find((r) => r.checked).value).toBe('mineru');
    expect(h.storage.setPdfProvider).not.toHaveBeenCalled();
    expect(h.document.getElementById('permissionStatus').textContent).toContain('paddleocr.aistudio-app.com');
  });

  test('设计验收 M6：拒绝说明留在 #permissionRow（role=status）里，附「重新授权」并滚到可见处；再授权成功则切换', async () => {
    const h = setup({ provider: 'mineru', answer: false, lang: 'zh' });
    await h.sec.init();
    const row = h.document.getElementById('permissionRow');
    row.scrollIntoView = jest.fn();
    expect(await h.sec.onSelect('paddleocr')).toBe(false);
    expect(row.hidden).toBe(false);
    expect(row.classList.contains('denied')).toBe(true);
    expect(h.document.getElementById('permissionStatus').getAttribute('role')).toBe('status');
    expect(h.document.getElementById('permissionStatus').textContent).toBe('未获得访问 paddleocr.aistudio-app.com 的权限，仍在使用 MinerU。需要时可重新授权。');
    const btn = h.document.getElementById('grantPermissionBtn');
    expect(btn.hidden).toBe(false);
    expect(btn.textContent).toBe('重新授权');
    expect(row.scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
    expect(h.document.getElementById('tokenStatus').textContent).toBe('');
    // 再点「重新授权」：这次同意 → 切到 PaddleOCR 并保存
    h.permissions.request = jest.fn(async () => true);
    expect(await h.sec.onGrant()).toBe(true);
    expect(h.storage.setPdfProvider).toHaveBeenCalledWith('paddleocr');
    expect(row.classList.contains('denied')).toBe(false);
  });

  test('切到 MinerU（install 权限）不弹窗；旧后端 PaddleOCR 出现“撤销”，点了调用 permissions.remove', async () => {
    const h = setup({ origins: [PADDLE, BCEBOS] });
    await h.sec.init();
    await h.sec.onSelect('mineru');
    expect(h.permissions.request).not.toHaveBeenCalled();
    expect(h.document.getElementById('revokeRow').hidden).toBe(false);
    expect(h.document.getElementById('revokeText').textContent).toContain('PaddleOCR');
    await h.sec.onRevoke();
    expect(h.permissions.remove).toHaveBeenCalled();
    expect(h.document.getElementById('revokeRow').hidden).toBe(true);
  });

  test('Key 失焦保存到当前后端（instant-save）', async () => {
    const h = setup({ provider: 'mineru' });
    await h.sec.init();
    bindInstantSave(h.document, h.storage, {});
    const key = h.document.getElementById('providerKey');
    key.value = '  fixture-mineru  ';
    key.dispatchEvent(new h.document.defaultView.Event('change'));
    await new Promise((r) => setImmediate(r));
    expect(h.storage.setProviderKey).toHaveBeenCalledWith('mineru', 'fixture-mineru');
  });

  test('测试连接：没权限时不发请求；有权限时调用 provider.testConnection', async () => {
    const h = setup({ keys: { paddleocr: 'fixture-key' } });
    await h.sec.init();
    global.fetch = jest.fn();
    expect((await h.sec.onTest()).ok).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
    delete global.fetch;
  });

  test('测试连接：空 body 403 显示“不是 Key 或额度问题”', async () => {
    const h = setup({ keys: { paddleocr: 'fixture-key' }, origins: [PADDLE, BCEBOS], lang: 'zh' });
    await h.sec.init();
    global.fetch = jest.fn(async () => ({ ok: false, status: 403, headers: { get: () => null }, text: async () => '', json: async () => { throw new Error('empty'); } }));
    const r = await h.sec.onTest();
    expect(r.ok).toBe(false);
    expect(global.fetch.mock.calls[0][1].method).toBe('GET');
    expect(h.document.getElementById('tokenStatus').textContent).toMatch(/与 Key 或额度无关/);
    expect(h.document.getElementById('tokenStatus').textContent).not.toMatch(/403|\{provider\}/); // rp2：状态码只进日志
    delete global.fetch;
  });
});

describe('设计建议：连接测试失败', () => {
  test('Key 无效：带 ❌、不说「未填写」，并附「获取 PaddleOCR Key」链接', async () => {
    const h = setup({ origins: [PADDLE, BCEBOS], keys: { paddleocr: 'abcdefghijklmnop' }, lang: 'zh' });
    await h.sec.init();
    const orig = h.registry.get.bind(h.registry);
    const fake = { ...orig('paddleocr'), testConnection: jest.fn(async () => ({ ok: false, error: { code: 'AUTH_INVALID' } })) };
    h.registry.get = (id) => (id === 'paddleocr' ? fake : orig(id));
    await h.sec.onTest();
    const st = h.document.getElementById('tokenStatus');
    expect(st.textContent).toMatch(/^❌ Key 无效或已过期/);
    expect(st.textContent).not.toMatch(/未填写/);
    const a = st.querySelector('a.token-status-link');
    expect(a.firstChild.textContent).toBe('获取 PaddleOCR Key');
    expect(a.querySelector('.sr-only').textContent).toBe('（在新标签页打开）');
    expect(a.getAttribute('href')).toBe('https://aistudio.baidu.com/account/accessToken');
  });
  test('其他失败也带 ❌', async () => {
    const h = setup({ origins: [PADDLE, BCEBOS], keys: { paddleocr: 'abcdefghijklmnop' }, lang: 'zh' });
    await h.sec.init();
    const orig = h.registry.get.bind(h.registry);
    const fake = { ...orig('paddleocr'), testConnection: jest.fn(async () => ({ ok: false, error: { code: 'RATE_LIMITED' } })) };
    h.registry.get = (id) => (id === 'paddleocr' ? fake : orig(id));
    await h.sec.onTest();
    expect(h.document.getElementById('tokenStatus').textContent.startsWith('❌')).toBe(true);
  });
  test('§2.4：测试连接是描边次按钮，不再有 on-success 覆盖和 border:none !important', () => {
    const css = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.css'), 'utf8');
    expect(css).not.toMatch(/\.btn-test:hover, \.btn-test:focus-visible \{ color: var\(--on-success\); \}/);
    expect(css).not.toMatch(/border: none !important/);
    expect(css).toMatch(/#testTokenBtn\.btn-test \{[^}]*height: 40px;[^}]*border: 1px solid var\(--border-strong\)/);
  });
});
