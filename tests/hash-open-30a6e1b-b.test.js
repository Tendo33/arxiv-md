// 设计验收 30a6e1b 建议 b：从拦截打开的设置页自动展开面板、焦点在面板标题；设置页已开着时 hashchange 也展开
// （真实浏览器 600ms 断言见 scripts/e2e-abs-buttons.js 的 c10）
import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { createPermissions } from './helpers/chrome-stubs';
import { createDefaultRegistry } from '@pdf-core/providers/index';
import { createPdfProviderSection } from '../src/ui/settings/pdf-provider';
import { translations } from '../src/config/locales';
import { ackKey } from '../src/utils/disclosure-ack';

const html = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.html'), 'utf8');
function setup({ hash = '', acked = {} } = {}) {
  const { document } = parseHTML(html);
  const listeners = {};
  const win = { addEventListener: (n, f) => { (listeners[n] = listeners[n] || []).push(f); } };
  const focus = { el: null }; // linkedom 不维护 activeElement → 记录最后一次 focus()
  const mk = (...a) => { const el = document.createElement(...a); el.focus = () => { focus.el = el; }; return el; };
  const doc = new Proxy(document, { get: (o, k) => (k === 'defaultView' ? win : k === 'createElement' ? mk : (typeof o[k] === 'function' ? o[k].bind(o) : o[k])) });
  const mem = Object.fromEntries(Object.entries(acked).map(([k]) => [ackKey(k), 1]));
  const local = { get: jest.fn(async (k) => (k in mem ? { [k]: mem[k] } : {})), set: jest.fn(async (o) => Object.assign(mem, o)) };
  const storage = { getPdfProvider: jest.fn(async () => 'paddleocr'), setPdfProvider: jest.fn(async () => {}), getProviderKey: jest.fn(async () => null), setProviderKey: jest.fn(async () => {}) };
  const loc = { hash };
  const sec = createPdfProviderSection({ doc, storage, permissions: createPermissions({ origins: [], permissions: [], answer: true }), registry: createDefaultRegistry(), t: () => translations.zh, local, location: loc });
  const fire = async () => { for (const f of listeners.hashchange || []) await f(); await new Promise((r) => setTimeout(r, 0)); };
  return { document, sec, loc, fire, listeners, focus };
}

test('#disclose on load: panel open, focus on panel title', async () => {
  const h = setup({ hash: '#disclose=mineru', acked: { paddleocr: true } });
  await h.sec.init();
  const panel = h.document.getElementById('pdPanel');
  expect(panel && panel.dataset.provider).toBe('mineru');
  expect(!!h.focus.el && h.focus.el.classList.contains('pd-title')).toBe(true);
});

test('already-open settings: hashchange to #disclose=<p> opens the panel and focuses its title', async () => {
  const h = setup({ acked: { paddleocr: true } });
  await h.sec.init();
  expect(h.document.getElementById('pdPanel')).toBeNull();
  expect((h.listeners.hashchange || []).length).toBe(1);
  h.loc.hash = '#disclose=mineru';
  await h.fire();
  const panel = h.document.getElementById('pdPanel');
  expect(panel && panel.dataset.provider).toBe('mineru');
  expect(!!h.focus.el && h.focus.el.classList.contains('pd-title')).toBe(true);
});

test('hashchange to an already-acked provider does not open a panel', async () => {
  const h = setup({ acked: { paddleocr: true } });
  await h.sec.init();
  h.loc.hash = '#disclose=paddleocr';
  await h.fire();
  expect(h.document.getElementById('pdPanel')).toBeNull();
});
