// 复审 P2-A：Key 不跨设备同步 → 第二台设备（sync 只有 pdfProvider，local 没 Key）在设置页、popup、发起解析时都提示重新填写
import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { installChrome } from './helpers/chrome-stubs';
import { createDefaultRegistry } from '@pdf-core/providers/index';
import { createPdfProviderSection, UI_PROVIDERS } from '../src/ui/settings/pdf-provider';
import { keyHereMessage, renderKeyHint } from '../src/ui/popup/key-hint';
import { translations } from '../src/config/locales';
import { makeHarness, fakeProvider } from './helpers/runner-harness';

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const loadStorage = () => { jest.resetModules(); return require('../src/utils/storage').default; };

describe('P2-A storage: keyMissingHere', () => {
  test('device B: sync has pdfProvider only, local has no key', async () => {
    installChrome({ sync: { pdfProvider: 'mineru' } });
    const s = loadStorage();
    expect(await s.getChosenPdfProvider()).toBe('mineru');
    expect(await s.getActivePdfProvider()).toEqual({ id: 'mineru', hasKey: false, keyMissingHere: true });
  });
  test('PaddleOCR user stays on PaddleOCR (not switched to MinerU)', async () => {
    installChrome({ sync: { pdfProvider: 'paddleocr' } });
    const s = loadStorage();
    expect(await s.getActivePdfProvider()).toEqual({ id: 'paddleocr', hasKey: false, keyMissingHere: true });
  });
  test('fresh install (nothing chosen) → plain missing-key, not the device hint', async () => {
    installChrome();
    const s = loadStorage();
    expect((await s.getActivePdfProvider()).keyMissingHere).toBe(false);
  });
  test('key present → no hint', async () => {
    installChrome({ sync: { pdfProvider: 'mineru' }, local: { providerKeys: { mineru: 'k' } } });
    const s = loadStorage();
    expect(await s.getActivePdfProvider()).toEqual({ id: 'mineru', hasKey: true, keyMissingHere: false });
  });
});

describe('P2-A popup', () => {
  test.each(['zh', 'en'])('%s: #alertKey shows re-enter-key hint', (lang) => {
    const { document } = parseHTML(read('src/ui/popup/popup.html'));
    const tr = translations[lang];
    renderKeyHint(document, { id: 'paddleocr', hasKey: false, keyMissingHere: true }, tr, 'PaddleOCR');
    expect(document.getElementById('alertKey').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('keyHereTitle').textContent).toBe(tr.popup_key_here_title.replace('{provider}', 'PaddleOCR'));
    expect(document.getElementById('keyHereHint').textContent).toBe(tr.popup_key_here_hint);
    renderKeyHint(document, { id: 'paddleocr', hasKey: true, keyMissingHere: false }, tr, 'PaddleOCR');
    expect(document.getElementById('alertKey').classList.contains('hidden')).toBe(true);
  });
  test('wording: zh says 本设备重新填写, en says re-enter on this device', () => {
    expect(translations.zh.popup_key_here_hint).toContain('请在本设备');
    expect(translations.zh.popup_key_here_hint).toContain('重新填写');
    expect(translations.en.popup_key_here_hint).toMatch(/Re-enter the key on this device/);
    expect(keyHereMessage({ keyMissingHere: false }, translations.en, 'X')).toBeNull();
  });
  test('runExport uses the device hint when starting a parse', () => {
    const js = read('src/ui/popup/popup.js');
    expect(js).toMatch(/const here = keyHereMessage\(active, tr, providerLabel\(active\.id\)\);\s*(\/\/[^\n]*\s*)?if \(here\) showNeedKey\(here\.title, here\.hint\)/);
  });
});

describe('P2-A settings', () => {
  function setup({ chosen, keys = {}, provider = 'paddleocr', lang = 'zh' }) {
    const { document } = parseHTML(read('src/ui/settings/settings.html'));
    const storage = {
      getPdfProvider: async () => provider, setPdfProvider: async () => {},
      getChosenPdfProvider: async () => chosen,
      getProviderKey: async (id) => keys[id] || null, setProviderKey: async () => {},
    };
    const sec = createPdfProviderSection({ doc: document, storage, registry: createDefaultRegistry(), t: () => translations[lang] });
    return { document, sec };
  }
  test.each(['zh', 'en'])('%s: chosen provider without local key → hint shown', async (lang) => {
    const { document, sec } = setup({ chosen: 'mineru', provider: 'mineru', lang });
    await sec.init();
    const h = document.getElementById('keyHereHint');
    expect(h.hidden).toBe(false);
    expect(h.textContent).toBe(translations[lang].pdf_key_here.replace('{provider}', 'MinerU'));
  });
  test('PaddleOCR chosen on device A → device B still shows PaddleOCR + hint', async () => {
    const { document, sec } = setup({ chosen: 'paddleocr', provider: 'paddleocr' });
    await sec.init();
    expect([...document.querySelectorAll('input[name="pdfProvider"]')].find((r) => r.checked).value).toBe('paddleocr');
    expect(document.getElementById('keyHereHint').hidden).toBe(false);
    expect(UI_PROVIDERS).toContain('paddleocr');
  });
  test('nothing chosen or key present → no hint', async () => {
    const a = setup({ chosen: null }); await a.sec.init();
    expect(a.document.getElementById('keyHereHint').hidden).toBe(true);
    const b = setup({ chosen: 'paddleocr', keys: { paddleocr: 'k' } }); await b.sec.init();
    expect(b.document.getElementById('keyHereHint').hidden).toBe(true);
  });
});

describe('P2-A parse entry (runner)', () => {
  test('chosen provider without key → AUTH_INVALID key_not_on_device with re-enter message, no request', async () => {
    const p = fakeProvider();
    const h = makeHarness({ providers: [p], keys: {}, tasks: [{ id: 't1' }] });
    h.deps.storage.getChosenPdfProvider = async () => 'fake-a';
    // runner 在创建时拿到 deps.storage 引用，上面的赋值对同一对象生效
    const r = await h.runner.process('t1');
    expect(r.error.code).toBe('AUTH_INVALID');
    expect(r.error.reason).toBe('key_not_on_device');
    expect(r.error.message).not.toMatch(/[\u4e00-\u9fff]/); // 后台不再写死中文，UI 按 reason 翻译
    expect(p.submit).not.toHaveBeenCalled();
    expect(h.store.get('t1')).toMatchObject({ status: 'failed', errorCode: 'AUTH_INVALID', errorReason: 'key_not_on_device' });
  });
  test('not chosen → plain AUTH_INVALID', async () => {
    const h = makeHarness({ providers: [fakeProvider()], keys: {}, tasks: [{ id: 't1' }] });
    const r = await h.runner.process('t1');
    expect(r.error.reason).not.toBe('key_not_on_device');
  });
});

describe('P2-A docs match code', () => {
  test('PRIVACY / README say the synced token is deleted, not kept', () => {
    for (const f of ['PRIVACY.md', 'README.md', 'README_CN.md']) {
      const d = read(f);
      expect(d).not.toMatch(/left in place|is left \(unused\)|暂时保留/);
    }
    expect(read('PRIVACY.md')).toMatch(/deleted from `chrome\.storage\.sync`/);
    expect(read('README_CN.md')).toContain('再从同步区删除');
  });
});
