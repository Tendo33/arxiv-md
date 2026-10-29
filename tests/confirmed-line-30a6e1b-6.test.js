// 设计验收 30a6e1b #6：确认提示在卡片组下方单独一行，前缀 ✓，不用 toast
import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { createPermissions } from './helpers/chrome-stubs';
import { createDefaultRegistry } from '@pdf-core/providers/index';
import { createPdfProviderSection } from '../src/ui/settings/pdf-provider';
import { translations } from '../src/config/locales';

const html = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.html'), 'utf8');
function setup(provider, hash) {
  const { document } = parseHTML(html);
  const store = { provider };
  const mem = {};
  const local = { get: jest.fn(async (k) => (k in mem ? { [k]: mem[k] } : {})), set: jest.fn(async (o) => Object.assign(mem, o)) };
  const storage = { getPdfProvider: jest.fn(async () => store.provider), setPdfProvider: jest.fn(async (id) => { store.provider = id; }), getProviderKey: jest.fn(async () => null), setProviderKey: jest.fn(async () => {}) };
  const toast = jest.fn();
  const sec = createPdfProviderSection({ doc: document, storage, permissions: createPermissions({ origins: [], permissions: [], answer: true }), registry: createDefaultRegistry(), t: () => translations.en, toast, local, location: { hash } });
  return { document, sec, toast };
}
test('markup: <p id=pdConfirmed role=status> right after the provider fieldset', () => {
  const { document } = parseHTML(html);
  const el = document.getElementById('pdConfirmed');
  expect(el.getAttribute('role')).toBe('status');
  expect(el.previousElementSibling.id).toBe('pdfProviderGroup');
});
test.each([['paddleocr', '#disclose=paddleocr'], ['paddleocr', '#disclose=mineru']])('current=%s hash=%s → inline ✓ line, no toast', async (cur, hash) => {
  const h = setup(cur, hash);
  await h.sec.init();
  const id = hash.split('=')[1];
  await h.sec.onAgree(id);
  const el = h.document.getElementById('pdConfirmed');
  expect(el.hidden).toBe(false);
  expect(el.textContent).toBe(`✓ ${translations.en.pdf_disc_confirmed}`);
  expect(h.toast).not.toHaveBeenCalledWith(expect.anything(), 'success');
  h.sec.openDisclosure('mineru');
  expect(el.hidden).toBe(true);
});
