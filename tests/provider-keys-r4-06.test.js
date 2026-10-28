import fs from 'fs';
import path from 'path';
import { installChrome, createEvent } from './helpers/chrome-stubs';

installChrome();
const storage = require('../src/utils/storage').default;

const L = () => chrome.storage.local.dump();
const S = () => chrome.storage.sync.dump();

describe('R4-06 keys only in storage.local', () => {
  beforeEach(() => installChrome());

  test('set/get/clear provider keys never touch sync', async () => {
    await storage.setProviderKey('mineru', ' fixture-a ');
    await storage.setProviderKey('paddleocr', 'fixture-b');
    expect(L().providerKeys).toEqual({ mineru: 'fixture-a', paddleocr: 'fixture-b' });
    expect(await storage.getProviderKey('paddleocr')).toBe('fixture-b');
    expect(await storage.getMinerUToken()).toBe('fixture-a');
    await storage.setMinerUToken('');
    expect(L().providerKeys).toEqual({ paddleocr: 'fixture-b' });
    expect(S()).toEqual({});
    await storage.clearProviderKeys();
    expect(L().providerKeys).toBeUndefined();
    expect(await storage.getProviderKey('paddleocr')).toBeNull();
  });

  test('clearProviderKeys also removes stale legacy sync token', async () => {
    installChrome({ sync: { mineruToken: 'old' } });
    await storage.clearProviderKeys();
    expect(S().mineruToken).toBeUndefined();
  });

  test('source: no key written via storage.sync; menu refresh listens local.providerKeys', () => {
    const root = path.join(__dirname, '..', 'src');
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []));
    for (const f of walk(root)) {
      const src = fs.readFileSync(f, 'utf8');
      expect([f, /storage\.sync\.set\([^)]*(mineruToken|providerKeys|apiKey|token)/i.test(src)]).toEqual([f, false]);
    }
    const bg = fs.readFileSync(path.join(root, 'background/index.js'), 'utf8');
    expect(bg).toMatch(/area === 'local' && changes\.providerKeys/);
    expect(bg).not.toMatch(/changes\.mineruToken/);
  });

  test('menu refreshes when local.providerKeys changes', async () => {
    const c = installChrome();
    const refresh = jest.fn();
    const ev = createEvent();
    c.storage.onChanged = ev;
    // 复现 index.js 的监听条件
    ev.addListener((changes, area) => {
      if ((area === 'sync' && (changes.language || changes.pdfProvider)) || (area === 'local' && changes.providerKeys)) refresh();
    });
    await ev.fire({ providerKeys: { newValue: { mineru: 'x' } } }, 'local');
    await ev.fire({ mineruToken: { newValue: 'x' } }, 'sync');
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
