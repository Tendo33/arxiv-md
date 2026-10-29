import { createPermissions } from './helpers/chrome-stubs';
import { buildPaddleOriginRule, syncPaddleOriginRule, PADDLE_ORIGIN_RULE_ID, DNR_PERMISSION } from '../src/background/paddle-origin-rule';
import { paddleocrProvider } from '@pdf-core/providers/paddleocr';
import { requestProviderPermission } from '@pdf-core/permissions';
const manifest = require('../src/manifest.json');

const mk = (perm) => ({ permissions: createPermissions(perm), runtime: { id: 'extid' }, declarativeNetRequest: { updateDynamicRules: jest.fn(async () => {}) } });

describe('DNR 可选权限：仅星河域名删除 Origin', () => {
  test('manifest：只进 optional_permissions，不是必需权限', () => {
    expect(manifest.optional_permissions).toEqual([DNR_PERMISSION]);
    expect(manifest.permissions).not.toContain(DNR_PERMISSION);
    expect(manifest.permissions).not.toContain('declarativeNetRequest');
  });
  test('规则只作用于 paddleocr.aistudio-app.com 且只删 origin', () => {
    const r = buildPaddleOriginRule('extid');
    expect(r.condition.requestDomains).toEqual(['paddleocr.aistudio-app.com']);
    expect(r.condition.initiatorDomains).toEqual(['extid']);
    expect(r.action).toEqual({ type: 'modifyHeaders', requestHeaders: [{ header: 'origin', operation: 'remove' }] });
  });
  test('未授权 → 只移除规则，不添加', async () => {
    const c = mk();
    expect(await syncPaddleOriginRule(c)).toBe(false);
    expect(c.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledWith({ removeRuleIds: [PADDLE_ORIGIN_RULE_ID] });
  });
  test('已授权 → 添加规则', async () => {
    const c = mk({ permissions: [DNR_PERMISSION] });
    expect(await syncPaddleOriginRule(c)).toBe(true);
    expect(c.declarativeNetRequest.updateDynamicRules.mock.calls[0][0].addRules[0].id).toBe(PADDLE_ORIGIN_RULE_ID);
  });
  test('选 PaddleOCR 时与域名权限一起申请（一次弹窗）', async () => {
    const api = createPermissions();
    await requestProviderPermission(api, paddleocrProvider);
    expect(api.request).toHaveBeenCalledTimes(1);
    expect(api.request.mock.calls[0][0]).toEqual({ origins: ['https://paddleocr.aistudio-app.com/*', 'https://*.bj.bcebos.com/*'], permissions: [DNR_PERMISSION] });
  });
});
