import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { createDefaultRegistry } from '@pdf-core/providers/index';
import { createPdfProviderSection, UI_PROVIDERS } from '../src/ui/settings/pdf-provider';
import { bindInstantSave } from '../src/ui/settings/instant-save';
import { translations } from '../src/config/locales';

const html = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.html'), 'utf8');

function setup({ provider = 'paddleocr', keys = {}, lang = 'en' } = {}) {
  const { document } = parseHTML(html);
  const store = { provider, keys: { ...keys } };
  const storage = {
    getPdfProvider: jest.fn(async () => store.provider),
    setPdfProvider: jest.fn(async (id) => { store.provider = id; }),
    getProviderKey: jest.fn(async (id) => store.keys[id] || null),
    setProviderKey: jest.fn(async (id, v) => { if (v) store.keys[id] = v; else delete store.keys[id]; }),
  };
  const registry = createDefaultRegistry();
  const toast = jest.fn();
  const sec = createPdfProviderSection({ doc: document, storage, registry, t: () => translations[lang], toast });
  return { document, storage, registry, toast, sec, store };
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
      for (const id of r.getAttribute('aria-describedby').split(/\s+/)) expect(document.getElementById(id)).toBeTruthy(); // C12：可含多个 id
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

  test('init：显示当前后端的说明（数据发往的域名）、Key；没有授权状态行', async () => {
    const h = setup({ keys: { paddleocr: 'fixture-key' } });
    await h.sec.init();
    const d = h.document;
    expect([...d.querySelectorAll('input[name="pdfProvider"]')].find((r) => r.checked).value).toBe('paddleocr');
    expect(d.getElementById('getKeyText').textContent).toBe(translations.en.pdf_get_key.replace('{provider}', 'PaddleOCR'));
    expect(d.getElementById('providerKey').value).toBe('fixture-key');
    expect(d.getElementById('providerKey').dataset.provider).toBe('paddleocr');
    expect(d.getElementById('providerKeyLabel').textContent).toBe('PaddleOCR API key');
    expect(d.getElementById('grantPermissionBtn')).toBeNull();
    expect(d.getElementById('permissionStatus')).toBeNull();
    expect(d.getElementById('revokeRow')).toBeNull();
  });

  test('1.2.2：切到 PaddleOCR 直接保存，不弹数据说明、不申请权限', async () => {
    const h = setup({ provider: 'mineru' });
    await h.sec.init();
    expect(await h.sec.onSelect('paddleocr')).toBe(true);
    expect(h.storage.setPdfProvider).toHaveBeenCalledWith('paddleocr');
    expect(h.sec.current).toBe('paddleocr');
    expect([...h.document.querySelectorAll('input[name="pdfProvider"]')].find((r) => r.checked).value).toBe('paddleocr');
    expect(h.document.getElementById('pdPanel')).toBeNull();
    expect(h.toast).toHaveBeenCalledWith(translations.en.toast_saved, 'success');
  });

  test('1.2.2：单选卡片 change 事件（用户点卡片）直接切换并保存', async () => {
    const h = setup({ provider: 'paddleocr' });
    await h.sec.init();
    h.sec.bind();
    const r = h.document.querySelector('input[name="pdfProvider"][value="mineru"]');
    r.checked = true;
    r.dispatchEvent(new h.document.defaultView.Event('change', { bubbles: true }));
    for (let i = 0; i < 5; i++) await new Promise((res) => setImmediate(res));
    expect(h.storage.setPdfProvider).toHaveBeenCalledWith('mineru');
    expect(h.document.getElementById('pdPanel')).toBeNull();
  });

  test('选当前后端 / 未知后端：不保存', async () => {
    const h = setup({ provider: 'mineru' });
    await h.sec.init();
    await h.sec.onSelect('mineru');
    await h.sec.onSelect('nope');
    expect(h.storage.setPdfProvider).not.toHaveBeenCalled();
    expect(h.sec.current).toBe('mineru');
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

  test('测试连接：没填 Key 时不发请求；填了直接调用 provider.testConnection（不再查权限）', async () => {
    const h = setup();
    await h.sec.init();
    global.fetch = jest.fn();
    expect((await h.sec.onTest()).ok).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
    delete global.fetch;
    const h2 = setup({ keys: { paddleocr: 'fixture-key' } });
    await h2.sec.init();
    const orig = h2.registry.get.bind(h2.registry);
    const fake = { ...orig('paddleocr'), testConnection: jest.fn(async () => ({ ok: true })) };
    h2.registry.get = (id) => (id === 'paddleocr' ? fake : orig(id));
    expect((await h2.sec.onTest()).ok).toBe(true);
    expect(fake.testConnection).toHaveBeenCalledWith({ token: 'fixture-key' }, {});
  });

  test('测试连接：空 body 403 显示“不是 Key 或额度问题”', async () => {
    const h = setup({ keys: { paddleocr: 'fixture-key' }, lang: 'zh' });
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
    const h = setup({ keys: { paddleocr: 'abcdefghijklmnop' }, lang: 'zh' });
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
    const h = setup({ keys: { paddleocr: 'abcdefghijklmnop' }, lang: 'zh' });
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
