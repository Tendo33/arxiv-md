import { createPermissions } from '../helpers/chrome-stubs';
import { permissionsFor, hasProviderPermission, requestProviderPermission, removeProviderPermission, canRevoke, ensureProviderPermission } from '@pdf-core/permissions';
import { paddleocrProvider } from '@pdf-core/providers/paddleocr';
import { mineruProvider } from '@pdf-core/providers/mineru';
import { makeHarness, fakeProvider } from '../helpers/runner-harness';
const manifest = require('../../src/manifest.json');

const PADDLE = 'https://paddleocr.aistudio-app.com/*';
const BCEBOS = 'https://*.bj.bcebos.com/*';

describe('R4-08 按需权限', () => {
  test('manifest：星河域名 + bcebos 结果域名进 optional_host_permissions；permissions/host_permissions 不含 bcebos；MinerU 留在 host_permissions（方案 A）', () => {
    expect(manifest.optional_host_permissions).toEqual([PADDLE, BCEBOS]);
    expect(JSON.stringify(manifest.permissions)).not.toMatch(/bcebos/);
    expect(JSON.stringify(manifest.host_permissions)).not.toMatch(/bcebos/);
    expect(manifest.permissions).toEqual(['storage', 'downloads', 'activeTab', 'notifications', 'alarms', 'contextMenus']);
    expect(manifest.optional_permissions).toEqual(['declarativeNetRequestWithHostAccess']);
    expect(manifest.host_permissions).toEqual(expect.arrayContaining(['https://mineru.net/*', 'https://cdn-mineru.openxlab.org.cn/*']));
  });

  test('MinerU 是 install 模式：无需申请、不可撤销', async () => {
    const api = createPermissions();
    expect(permissionsFor(mineruProvider)).toEqual({ origins: [], permissions: [] });
    expect(await hasProviderPermission(api, mineruProvider)).toBe(true);
    expect(await requestProviderPermission(api, mineruProvider)).toBe(true);
    expect(api.request).not.toHaveBeenCalled();
    expect(canRevoke(mineruProvider)).toBe(false);
  });

  test('PaddleOCR：同意 → 授予；撤销 → 移除', async () => {
    const api = createPermissions({ answer: true });
    expect(await hasProviderPermission(api, paddleocrProvider)).toBe(false);
    expect(await requestProviderPermission(api, paddleocrProvider)).toBe(true);
    expect(api.request.mock.calls[0][0].origins).toEqual([PADDLE, BCEBOS]);
    expect(await hasProviderPermission(api, paddleocrProvider)).toBe(true);
    expect(canRevoke(paddleocrProvider)).toBe(true);
    await removeProviderPermission(api, paddleocrProvider);
    expect(await hasProviderPermission(api, paddleocrProvider)).toBe(false);
  });

  test('用户拒绝 → false；ensure 抛 PERMISSION_MISSING 带 host', async () => {
    const api = createPermissions({ answer: false });
    expect(await requestProviderPermission(api, paddleocrProvider)).toBe(false);
    await expect(ensureProviderPermission(api, paddleocrProvider)).rejects.toMatchObject({ code: 'PERMISSION_MISSING', host: 'paddleocr.aistudio-app.com' });
  });

  test('转换时缺权限 → 不发任何请求，任务失败为 PERMISSION_MISSING', async () => {
    const p = fakeProvider({ permissionMode: 'optional' });
    const h = makeHarness({ providers: [p], tasks: [{ id: 't1' }] });
    h.deps.permissions = createPermissions();
    const { createParseTaskRunner } = require('../../src/background/parse-task-runner');
    const runner = createParseTaskRunner(h.deps);
    await runner.process('t1');
    expect(p.submit).not.toHaveBeenCalled();
    expect(h.store.get('t1')).toMatchObject({ status: 'failed', errorCode: 'PERMISSION_MISSING' });
  });
});

describe('bcebos 结果域名（新可选权限）', () => {
  test('只授权过星河域名的老用户：PERMISSION_MISSING 指向 bj.bcebos.com，不误报星河', async () => {
    const api = createPermissions({ origins: [PADDLE], permissions: ['declarativeNetRequestWithHostAccess'] });
    await expect(ensureProviderPermission(api, paddleocrProvider)).rejects.toMatchObject({ code: 'PERMISSION_MISSING', host: '*.bj.bcebos.com' });
  });
  test('两项都授权 → 通过；申请是一次弹窗（域名 + DNR）', async () => {
    const api = createPermissions({ answer: true });
    expect(await requestProviderPermission(api, paddleocrProvider)).toBe(true);
    expect(api.request).toHaveBeenCalledTimes(1);
    expect(api.request.mock.calls[0][0]).toEqual({ origins: [PADDLE, BCEBOS], permissions: ['declarativeNetRequestWithHostAccess'] });
    await expect(ensureProviderPermission(api, paddleocrProvider)).resolves.toBeUndefined();
  });
});

test('Simon 17:32 批准：manifest 只有一个 bcebos pattern https://*.bj.bcebos.com/*，且不在 permissions/host_permissions', () => {
  const m = require('../../src/manifest.json');
  const all = [...(m.permissions || []), ...(m.host_permissions || []), ...(m.optional_host_permissions || []), ...(m.optional_permissions || [])];
  expect(all.filter((p) => /bcebos/.test(p))).toEqual(['https://*.bj.bcebos.com/*']);
  expect(m.optional_host_permissions).toContain('https://*.bj.bcebos.com/*');
});
