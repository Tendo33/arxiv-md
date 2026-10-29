import fs from 'fs';
import os from 'os';
import path from 'path';
import { makeHarness, fakeProvider } from './helpers/runner-harness';

const { scan } = require('../scripts/check-no-keys');

describe('R4-16 不内置 Key', () => {
  test('源码和 core 里没有字面量 Key', () => {
    const root = path.join(__dirname, '..');
    expect(scan([path.join(root, 'src'), path.join(root, 'packages/pdf-parse-core/src')])).toEqual([]);
  });

  test('检查脚本能抓到 sk- / Bearer / JWT 字面量', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nokeys-'));
    const fake = ['sk', 'FAKEFAKEFAKEFAKEFAKE'].join('-');
    fs.writeFileSync(path.join(dir, 'a.js'), `const k='${fake}'; const h='Bearer ' + x; const b='Bearer ${'A'.repeat(24)}';`);
    expect(scan([dir]).map((h) => h.name)).toEqual(['sk- key', 'Bearer literal']);
  });

  test('CI 跑 check:keys', () => {
    const ci = fs.readFileSync(path.join(__dirname, '../.github/workflows/ci.yml'), 'utf8');
    expect(ci).toMatch(/npm run check:keys/);
  });
});

describe('R4-16 失败不自动切到另一个后端', () => {
  test.each(['QUOTA', 'AUTH', 'THROW'])('provider A 失败（%s）→ provider B 的 submit 调用 0 次', async (kind) => {
    const fail = {
      QUOTA: { submit: jest.fn(async () => { const e = new Error('quota'); e.status = 429; throw e; }) },
      AUTH: { poll: jest.fn(async () => ({ state: 'failed', error: 'bad token' })) },
      THROW: { submit: jest.fn(async () => { throw new TypeError('Failed to fetch'); }) },
    }[kind];
    const a = fakeProvider({ id: 'fake-a', ...fail });
    const b = fakeProvider({ id: 'fake-b' });
    const h = makeHarness({ providers: [a, b], keys: { 'fake-a': 'k', 'fake-b': 'k' }, tasks: [{ id: 't1', provider: 'fake-a' }] });
    const r = await h.runner.process('t1');
    expect(r.error).toBeTruthy();
    expect(a.submit).toHaveBeenCalled();
    expect(b.submit).toHaveBeenCalledTimes(0);
    expect(h.store.get('t1')).toMatchObject({ status: 'failed', provider: 'fake-a' });
  });
});
