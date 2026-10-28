// R4-18：provider 契约测试——每个 provider 跑同一套：提交 → 轮询 → 取回 → 9 种错误映射
import { ALL_ERROR_CODES, isParseError } from '@pdf-core/errors';
import { createFetchMock } from './fetch-mock';

/**
 * spec = {
 *   provider, creds, input,
 *   happy: (fm) => void            // 为一次成功流程入队响应
 *   expectJobId, expectResultKeys: [...],
 *   errors: { CODE: (fm) => void | { mapError: rawErr } }  // 9 个码各自的触发方式
 * }
 */
export function runProviderContract(name, spec) {
  describe(`provider 契约：${name}`, () => {
    let fm;
    beforeEach(() => { fm = createFetchMock(); global.fetch = fm.fetch; });

    test('形状：id/label/hosts/mode/cost', () => {
      const p = spec.provider;
      expect(p.id).toBe(name);
      expect(p.hosts.length).toBeGreaterThan(0);
      expect(['sync', 'async']).toContain(p.mode);
      if (p.mode === 'async') expect(typeof p.poll).toBe('function');
    });

    test('提交 → 轮询到 done → 取回', async () => {
      spec.happy(fm);
      const p = spec.provider; const ctx = { fetch: fm.fetch };
      const sub = await p.submit(spec.input, spec.creds, ctx);
      let result = sub.result;
      if (p.mode === 'async') {
        expect(sub.jobId).toBe(spec.expectJobId);
        const seen = [];
        for (let i = 0; i < 10; i++) {
          const r = await p.poll(sub.jobId, spec.creds, ctx);
          seen.push(r.state);
          if (r.state === 'done') { result = r.result; break; }
        }
        expect(seen[seen.length - 1]).toBe('done');
        expect(seen.every((s) => ['pending', 'running', 'done'].includes(s))).toBe(true);
      }
      if (p.fetchResult) result = await p.fetchResult(result, spec.creds, ctx);
      for (const k of spec.expectResultKeys) expect(result).toHaveProperty(k);
    });

    test('9 种错误码都有映射路径', () => {
      expect(Object.keys(spec.errors).sort()).toEqual([...ALL_ERROR_CODES].sort());
    });

    test.each(ALL_ERROR_CODES)('错误映射：%s', async (code) => {
      const how = spec.errors[code];
      const p = spec.provider;
      const out = how(fm);
      let err;
      if (out && 'mapError' in out) err = p.mapError(out.mapError);
      else {
        try {
          const ctx = { fetch: fm.fetch, ...(out && out.ctx) };
          if (out && out.stage === 'poll') await p.poll(out.jobId || 'fixture-job', spec.creds, ctx);
          else await p.submit(spec.input, (out && out.creds) || spec.creds, ctx);
        } catch (e) { err = e; }
      }
      expect(isParseError(err)).toBe(true);
      expect(err.code).toBe(code);
      expect(err.provider).toBe(name);
    });
  });
}
