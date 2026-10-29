// R4-11/12/16：parse-task-runner 的测试装配（内存 taskManager + 假 provider）
import { createRegistry } from '@pdf-core/registry';
import { defineProvider } from '@pdf-core/provider';
import { createParseTaskRunner } from '../../src/background/parse-task-runner';

export function fakeProvider(over = {}) {
  return defineProvider({
    id: 'fake-a', label: 'Fake A', hosts: ['https://a.invalid/*'], credentialFields: [{ key: 'token', label: 'k', secret: true }],
    mode: 'async', input: 'url', cost: 'free', output: 'markdown', timeoutMs: 60000, pollIntervalMs: 1000,
    submit: jest.fn(async () => ({ jobId: 'fixture-job-1' })),
    poll: jest.fn(async () => ({ state: 'done', result: { markdownUrl: 'x' } })),
    fetchResult: jest.fn(async () => ({ markdown: '# hi\n\\(x\\)' })),
    mapError: (e) => e,
    ...over,
  });
}

export function makeHarness({ providers = [fakeProvider()], keys = { 'fake-a': 'fixture-key' }, tasks = [], clock } = {}) {
  const registry = createRegistry();
  providers.forEach((p) => registry.register(p));
  const store = new Map(tasks.map((t) => [t.id, { status: 'pending', provider: 'fake-a', paperInfo: { arxivId: '2401.00001', title: 'T' }, ...t }]));
  const taskManager = {
    getTask: jest.fn(async (id) => (store.has(id) ? { ...store.get(id) } : null)),
    updateTask: jest.fn(async (id, u) => { if (!store.has(id)) return null; store.set(id, { ...store.get(id), ...u }); return store.get(id); }),
    getTasks: jest.fn(async () => [...store.values()]),
  };
  const deleted = new Set();
  const guard = { consume: jest.fn(async (id) => deleted.has(id)) };
  let t = 0;
  const now = clock || (() => t);
  const sleep = jest.fn(async (ms) => { t += ms; });
  const deps = {
    registry, taskManager, guard, now, sleep,
    storage: { getProviderKey: jest.fn(async (id) => keys[id] || null), incrementConversion: jest.fn(async () => {}), getIncludeMetadata: async () => true },
    downloadUrl: jest.fn(async () => 11),
    saveDeliverable: jest.fn(async (r, base) => ({ id: 22, filename: `${base}.${r.deliver}` })),
    makeFilename: (m, ext) => `${m.arxivId}.${ext}`,
    notify: jest.fn(),
  };
  const runner = createParseTaskRunner(deps);
  return { runner, deps, store, deleted, registry, taskManager, advance: (ms) => { t += ms; } };
}
