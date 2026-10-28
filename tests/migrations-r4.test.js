import { installChrome } from './helpers/chrome-stubs';
import { runMigrations, normalizeTask, SCHEMA_VERSION } from '../src/utils/migrations';

const L = () => chrome.storage.local.dump();
const S = () => chrome.storage.sync.dump();

describe('R4-05 storage migration', () => {
  test('fresh install: no token, no provider pinned, version written', async () => {
    installChrome();
    const r = await runMigrations(chrome.storage);
    expect(r.ran).toBe(true);
    expect(L().schemaVersion).toBe(SCHEMA_VERSION);
    expect(S().pdfProvider).toBeUndefined();
    expect(L().providerKeys).toBeUndefined();
  });

  test('old user with token: copied to local, removed from sync, provider=mineru, conversionMode kept', async () => {
    installChrome({ sync: { mineruToken: ' fixture-token ', conversionMode: 'always' } });
    const r = await runMigrations(chrome.storage);
    expect(L().providerKeys).toEqual({ mineru: 'fixture-token' });
    expect('mineruToken' in S()).toBe(false);
    expect(r.steps).toContain('remove-sync-token');
    expect(S().pdfProvider).toBe('mineru');
    expect(S().conversionMode).toBe('always');
  });

  test('old user without token: empty key removed, provider left for default rule', async () => {
    installChrome({ sync: { mineruToken: '' } });
    await runMigrations(chrome.storage);
    expect('mineruToken' in S()).toBe(false);
    expect(S().pdfProvider).toBeUndefined();
    expect(L().providerKeys).toBeUndefined();
  });

  test('idempotent: second run is a no-op', async () => {
    installChrome({ sync: { mineruToken: 'fixture-token' } });
    await runMigrations(chrome.storage);
    const r2 = await runMigrations(chrome.storage);
    expect(r2.ran).toBe(false);
    expect(L().providerKeys).toEqual({ mineru: 'fixture-token' });
  });

  test('failure mid-way does not write version; re-run completes without losing token', async () => {
    installChrome({ sync: { mineruToken: 'fixture-token' } });
    const realRemove = chrome.storage.sync.remove;
    chrome.storage.sync.remove = async () => { throw new Error('boom'); };
    await expect(runMigrations(chrome.storage)).rejects.toThrow('boom');
    expect(L().schemaVersion).toBeUndefined();
    expect(L().providerKeys).toEqual({ mineru: 'fixture-token' });
    expect(S().mineruToken).toBe('fixture-token'); // 删除失败时 sync 里仍在，下次重跑
    chrome.storage.sync.remove = realRemove;
    const r = await runMigrations(chrome.storage);
    expect(r.ran).toBe(true);
    expect(S().pdfProvider).toBe('mineru');
    expect(L().providerKeys).toEqual({ mineru: 'fixture-token' });
    expect('mineruToken' in S()).toBe(false);
    expect(L().schemaVersion).toBe(SCHEMA_VERSION);
  });

  test('local key wins over stale sync token', async () => {
    installChrome({ sync: { mineruToken: 'old' }, local: { providerKeys: { mineru: 'new' } } });
    await runMigrations(chrome.storage);
    expect(L().providerKeys.mineru).toBe('new');
  });

  test('normalizeTask fills provider for legacy records only', () => {
    expect(normalizeTask({ id: 1 }).provider).toBe('mineru');
    expect(normalizeTask({ id: 1, provider: 'paddleocr' }).provider).toBe('paddleocr');
  });

  // 复审 P2-A：Key 不跨设备同步。设备 A 迁移后 sync 只剩 pdfProvider，设备 B 拿不到 Key，要提示重新填写
  test('two devices sharing sync: token is gone from sync, device B has no key but keeps the chosen provider', async () => {
    installChrome({ sync: { mineruToken: 'fixture-token' } });
    await runMigrations(chrome.storage); // 设备 A
    expect(S()).not.toHaveProperty('mineruToken');
    installChrome({ sync: S() }); // 设备 B：同一份 sync，空 local
    await runMigrations(chrome.storage);
    expect(L().providerKeys).toBeUndefined();
    expect(S().pdfProvider).toBe('mineru');
    const { default: storage } = await import('../src/utils/storage');
    expect(await storage.getActivePdfProvider()).toEqual({ id: 'mineru', hasKey: false, keyMissingHere: true });
  });

  // 审查 P2-2：已经选了 PaddleOCR 的老用户不会被改回 MinerU
  test('user who already picked PaddleOCR stays on PaddleOCR even with a legacy token', async () => {
    installChrome({ sync: { mineruToken: 'fixture-token', pdfProvider: 'paddleocr' } });
    const r = await runMigrations(chrome.storage);
    expect(S().pdfProvider).toBe('paddleocr');
    expect(r.steps).not.toContain('keep-mineru');
    expect(L().providerKeys).toEqual({ mineru: 'fixture-token' });
    expect('mineruToken' in S()).toBe(false);
  });
});
