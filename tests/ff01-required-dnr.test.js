// FF-01 方案 A：Firefox 包里 DNR 是安装时必需权限 → 不申请、不撤销、不再作为“缺权限”判断；Chrome 包行为不变
import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { createPermissions } from './helpers/chrome-stubs';
import { createDefaultRegistry } from '@pdf-core/providers/index';
import { paddleocrProvider } from '@pdf-core/providers/paddleocr';
import { withRequiredPermissions, requiredPermissionsOf, requestProviderPermission, hasProviderPermission, removeProviderPermission } from '@pdf-core/permissions';
import { createPdfProviderSection } from '../src/ui/settings/pdf-provider';
import { translations } from '../src/config/locales';
const { manifestForTarget } = require('../scripts/manifest-target');
const src = require('../src/manifest.json');

const DNR = 'declarativeNetRequestWithHostAccess';
const ORIGINS = ['https://paddleocr.aistudio-app.com/*', 'https://*.bj.bcebos.com/*'];
const html = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.html'), 'utf8');
const FF_REQ = manifestForTarget(src, 'firefox').permissions;
const CH_REQ = manifestForTarget(src, 'chrome').permissions;

function section(api) {
  const { document } = parseHTML(html);
  const storage = { getPdfProvider: async () => 'paddleocr', setPdfProvider: async () => {}, getProviderKey: async () => 'k', setProviderKey: async () => {} };
  const sec = createPdfProviderSection({ doc: document, storage, permissions: api, registry: createDefaultRegistry(), t: () => translations.zh, toast: jest.fn(), local: { get: async () => ({}) }, dnr: { getDynamicRules: async () => [] } });
  return { document, sec };
}

describe('Firefox（DNR 必需）', () => {
  test('requiredPermissionsOf 读 manifest.permissions', () => {
    expect(requiredPermissionsOf({ getManifest: () => ({ permissions: FF_REQ }) })).toContain(DNR);
    expect(requiredPermissionsOf(undefined)).toEqual([]);
  });
  test('申请只带域名，不带 DNR；域名已授权时根本不调用 permissions.request', async () => {
    const raw = createPermissions({ origins: [] });
    const api = withRequiredPermissions(raw, FF_REQ);
    expect(await requestProviderPermission(api, paddleocrProvider)).toBe(true);
    expect(raw.request.mock.calls[0][0]).toEqual({ origins: ORIGINS });
    const raw2 = createPermissions({ origins: ORIGINS }); // DNR 不在 state 里（Firefox 下由 manifest 保证）
    const api2 = withRequiredPermissions(raw2, FF_REQ);
    expect(await hasProviderPermission(api2, paddleocrProvider)).toBe(true);
    expect(await api2.request({ permissions: [DNR] })).toBe(true);
    expect(raw2.request).not.toHaveBeenCalled();
  });
  test('撤销不碰 DNR', async () => {
    const raw = createPermissions({ origins: ORIGINS });
    await removeProviderPermission(withRequiredPermissions(raw, FF_REQ), paddleocrProvider);
    expect(raw.remove.mock.calls[0][0]).toEqual({ origins: ORIGINS });
  });
  test('设置页：域名已授权 → 显示「已授权」，不显示授权按钮', async () => {
    const raw = createPermissions({ origins: ORIGINS });
    const { document, sec } = section(withRequiredPermissions(raw, FF_REQ));
    await sec.init();
    expect(document.getElementById('grantPermissionBtn').hidden).toBe(true);
    expect(raw.request).not.toHaveBeenCalled();
  });
});

describe('Chrome（DNR 可选，行为不变）', () => {
  test('wrapper 对 Chrome 透明：仍一起申请 DNR；只授权了域名 → 仍显示授权按钮', async () => {
    const raw = createPermissions({ origins: [] });
    const api = withRequiredPermissions(raw, CH_REQ);
    await requestProviderPermission(api, paddleocrProvider);
    expect(raw.request.mock.calls[0][0]).toEqual({ origins: ORIGINS, permissions: [DNR] });
    const raw2 = createPermissions({ origins: ORIGINS });
    const { document, sec } = section(withRequiredPermissions(raw2, CH_REQ));
    await sec.init();
    expect(document.getElementById('grantPermissionBtn').hidden).toBe(false);
  });
});
