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

  test('old user with token: copied to local, sync copy kept for other devices, provider=mineru, conversionMode kept', async () => {
    installChrome({ sync: { mineruToken: ' fixture-token ', conversionMode: 'always' } });
    await runMigrations(chrome.storage);
    expect(L().providerKeys).toEqual({ mineru: 'fixture-token' });
    expect(S().mineruToken).toBe(' fixture-token ');
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
    const realSet = chrome.storage.sync.set;
    chrome.storage.sync.set = async () => { throw new Error('boom'); };
    await expect(runMigrations(chrome.storage)).rejects.toThrow('boom');
    expect(L().schemaVersion).toBeUndefined();
    expect(L().providerKeys).toEqual({ mineru: 'fixture-token' });
    chrome.storage.sync.set = realSet;
    const r = await runMigrations(chrome.storage);
    expect(r.ran).toBe(true);
    expect(S().pdfProvider).toBe('mineru');
    expect(L().providerKeys).toEqual({ mineru: 'fixture-token' });
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

  // 审查 P2-1：两台设备共用一个 sync 账号，第一台迁移后第二台仍能迁移
  test('two devices sharing sync: second device still migrates the token', async () => {
    installChrome({ sync: { mineruToken: 'fixture-token' } });
    const sharedSync = chrome.storage.sync;
    await runMigrations(chrome.storage); // 设备 A
    installChrome({ sync: S() }); // 设备 B：同一份 sync，空 local
    expect(chrome.storage.sync).not.toBe(sharedSync);
    await runMigrations(chrome.storage);
    expect(L().providerKeys).toEqual({ mineru: 'fixture-token' });
    expect(S().pdfProvider).toBe('mineru');
  });

  // 审查 P2-2：已经选了 PaddleOCR 的老用户不会被改回 MinerU
  test('user who already picked PaddleOCR stays on PaddleOCR even with a legacy token', async () => {
    installChrome({ sync: { mineruToken: 'fixture-token', pdfProvider: 'paddleocr' } });
    const r = await runMigrations(chrome.storage);
    expect(S().pdfProvider).toBe('paddleocr');
    expect(r.steps).not.toContain('keep-mineru');
    expect(L().providerKeys).toEqual({ mineru: 'fixture-token' });
  });
});
