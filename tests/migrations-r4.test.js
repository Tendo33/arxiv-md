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

  test('old user with token: moved to local, removed from sync, provider=mineru, conversionMode kept', async () => {
    installChrome({ sync: { mineruToken: ' fixture-token ', conversionMode: 'always' } });
    await runMigrations(chrome.storage);
    expect(L().providerKeys).toEqual({ mineru: 'fixture-token' });
    expect('mineruToken' in S()).toBe(false);
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
    chrome.storage.sync.remove = realRemove;
    const r = await runMigrations(chrome.storage);
    expect(r.ran).toBe(true);
    expect('mineruToken' in S()).toBe(false);
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
});
