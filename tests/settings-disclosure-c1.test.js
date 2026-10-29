import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { createPermissions } from './helpers/chrome-stubs';
import { createDefaultRegistry } from '@pdf-core/providers/index';
import { createPdfProviderSection } from '../src/ui/settings/pdf-provider';
import { translations } from '../src/config/locales';
import { ackKey, parseDisclosureHash } from '../src/utils/disclosure-ack';

const html = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.html'), 'utf8');
function setup({ provider = 'paddleocr', acked = {}, answer = true, lang = 'zh', hash = '' } = {}) {
  const { document } = parseHTML(html);
  const store = { provider };
  const mem = Object.fromEntries(Object.entries(acked).filter(([, v]) => v).map(([k]) => [ackKey(k), 1]));
  const local = { get: jest.fn(async (k) => (k in mem ? { [k]: mem[k] } : {})), set: jest.fn(async (o) => Object.assign(mem, o)) };
  const storage = {
    getPdfProvider: jest.fn(async () => store.provider), setPdfProvider: jest.fn(async (id) => { store.provider = id; }),
    getProviderKey: jest.fn(async () => null), setProviderKey: jest.fn(async () => {}),
  };
  const permissions = createPermissions({ origins: [], permissions: [], answer });
  const toast = jest.fn();
  const sec = createPdfProviderSection({ doc: document, storage, permissions, registry: createDefaultRegistry(), t: () => translations[lang], toast, local, location: { hash } });
  const checked = () => [...document.querySelectorAll('input[name="pdfProvider"]')].find((r) => r.checked).value;
  return { document, sec, storage, permissions, local, mem, toast, checked };
}

describe('附录 C1：首次选择后端先显示数据说明', () => {
  test('未确认的后端：面板出现在卡片后，不申请权限、不保存；卡片保持选中', async () => {
    const h = setup({ acked: { paddleocr: true } });
    await h.sec.init();
    h.sec.onPick('mineru');
    const panel = h.document.getElementById('pdPanel');
    expect(panel).toBeTruthy();
    expect(panel.previousElementSibling.getAttribute('data-provider')).toBe('mineru');
    expect(panel.getAttribute('role')).toBe('group');
    expect(h.document.getElementById(panel.getAttribute('aria-labelledby')).textContent).toBe('使用 MinerU 前请确认');
    expect(panel.querySelector('.pd-body').textContent).toBe(translations.zh.pdf_disc_body_mineru);
    expect(panel.querySelector('.pd-ok').textContent).toBe('确认并继续');
    expect(panel.querySelector('a.pd-link').getAttribute('target')).toBe('_blank');
    expect(h.permissions.request).not.toHaveBeenCalled();
    expect(h.storage.setPdfProvider).not.toHaveBeenCalled();
    expect(h.checked()).toBe('mineru');
    expect(h.document.getElementById('pdLive').textContent).toContain('MinerU');
  });
  test('取消 / Esc：回到原后端，面板移除，什么都不保存', async () => {
    const h = setup({ acked: { paddleocr: true } });
    await h.sec.init();
    h.sec.onPick('mineru');
    const ev = new h.document.defaultView.Event('keydown'); ev.key = 'Escape';
    h.document.getElementById('pdPanel').dispatchEvent(ev);
    expect(h.document.getElementById('pdPanel')).toBeNull();
    expect(h.checked()).toBe('paddleocr');
    expect(h.local.set).not.toHaveBeenCalled();
  });
  test('同意：写确认记录 + 保存后端 + 申请权限；拒绝授权时后端仍保存', async () => {
    const h = setup({ provider: 'mineru', acked: { mineru: true }, answer: false });
    await h.sec.init();
    h.sec.onPick('paddleocr');
    await h.sec.onAgree('paddleocr');
    expect(h.mem[ackKey('paddleocr')]).toBeTruthy();
    expect(h.storage.setPdfProvider).toHaveBeenCalledWith('paddleocr');
    expect(h.permissions.request).toHaveBeenCalledTimes(1);
    expect(h.checked()).toBe('paddleocr');
    expect(h.document.getElementById('pdPanel')).toBeNull();
    expect(h.document.getElementById('grantPermissionBtn').hidden).toBe(false);
  });
  test('已确认的后端直接走授权流程，不再显示面板', async () => {
    const h = setup({ acked: { paddleocr: true, mineru: true } });
    await h.sec.init();
    await h.sec.onPick('mineru');
    expect(h.document.getElementById('pdPanel')).toBeNull();
    expect(h.storage.setPdfProvider).toHaveBeenCalledWith('mineru');
  });
  test('#disclose=<p>：打开即显示面板；同意后提示回到 arXiv 页面', async () => {
    expect(parseDisclosureHash('#disclose=paddleocr')).toBe('paddleocr');
    expect(parseDisclosureHash('#disclose=evil')).toBeNull();
    const h = setup({ hash: '#disclose=paddleocr' });
    await h.sec.init();
    expect(h.document.getElementById('pdPanel').getAttribute('data-provider')).toBe('paddleocr');
    await h.sec.onAgree('paddleocr');
    // 设计验收 30a6e1b #6：#disclose 指向当前已选后端，确认提示也在卡片下方内联显示（✓ 前缀），不进 toast
    const line = h.document.getElementById('pdConfirmed');
    expect(line.hidden).toBe(false);
    expect(line.textContent).toBe(`✓ ${translations.zh.pdf_disc_confirmed.replace('{name}', 'PaddleOCR')}`);
    expect(h.toast).not.toHaveBeenCalledWith(translations.zh.pdf_disc_confirmed, 'success');
  });
  test('MinerU 文案不说「上传」；中英文 key 齐全', () => {
    for (const k of ['pdf_card_mineru', 'pdf_disc_body_mineru']) expect(translations.zh[k].replace('PDF 文件本身不会上传', '')).not.toMatch(/上传/); // C11：只允许否定句「不会上传」
    expect(translations.en.pdf_disc_body_mineru).not.toMatch(/upload(?!ed\.)/i);
    for (const k of Object.keys(translations.en).filter((x) => /^pdf_(disc|card|badge)_|^link_new_tab$/.test(x))) expect(translations.zh[k]).toBeTruthy();
  });
});
