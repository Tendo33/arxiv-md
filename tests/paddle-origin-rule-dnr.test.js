import { buildPaddleOriginRule, syncPaddleOriginRule, PADDLE_ORIGIN_RULE_ID, DNR_PERMISSION } from '../src/background/paddle-origin-rule';
const manifest = require('../src/manifest.json');

const mk = () => ({ runtime: { id: 'extid' }, declarativeNetRequest: { updateDynamicRules: jest.fn(async () => {}) } });

describe('DNR 权限：安装时授予，仅星河域名删除 Origin', () => {
  test('manifest：DNR 在必需权限里，没有任何 optional_* 字段', () => {
    expect(manifest.permissions).toContain(DNR_PERMISSION);
    expect(manifest.permissions).not.toContain('declarativeNetRequest');
    expect(manifest).not.toHaveProperty('optional_permissions');
    expect(manifest).not.toHaveProperty('optional_host_permissions');
  });
  test('规则只作用于 paddleocr.aistudio-app.com 且只删 origin', () => {
    const r = buildPaddleOriginRule('extid');
    expect(r.condition.requestDomains).toEqual(['paddleocr.aistudio-app.com']);
    expect(r.condition.initiatorDomains).toEqual(['extid']);
    expect(r.action).toEqual({ type: 'modifyHeaders', requestHeaders: [{ header: 'origin', operation: 'remove' }] });
  });
  test('直接装规则，不查 permissions（没有 permissions API 也照装）', async () => {
    const c = mk();
    expect(await syncPaddleOriginRule(c)).toBe(true);
    expect(c.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledTimes(1);
    const arg = c.declarativeNetRequest.updateDynamicRules.mock.calls[0][0];
    expect(arg.removeRuleIds).toEqual([PADDLE_ORIGIN_RULE_ID]);
    expect(arg.addRules[0].id).toBe(PADDLE_ORIGIN_RULE_ID);
  });
  test('DNR 命名空间不存在 → 返回 false，不抛错', async () => {
    expect(await syncPaddleOriginRule({ runtime: { id: 'extid' } })).toBe(false);
  });
});
