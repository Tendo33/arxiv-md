// FF-01 A 实测（Firefox 159）：initiatorDomains 用 runtime.id（arxiv-md@tendo33）会被拒，改用扩展页面 host
import { extensionHost, syncPaddleOriginRule, PADDLE_ORIGIN_RULE_ID } from '../src/background/paddle-origin-rule';

const mk = (url, id) => {
  const rules = [];
  return {
    rules,
    runtime: { id, getURL: (p) => `${url}${p.replace(/^\//, '')}` },
    permissions: { contains: async () => true },
    declarativeNetRequest: { updateDynamicRules: jest.fn(async ({ addRules = [] }) => { rules.splice(0, rules.length, ...addRules); }) },
  };
};

test('Firefox：用 moz-extension 的 uuid，不用 gecko id', async () => {
  const c = mk('moz-extension://0f0f-uuid/', 'arxiv-md@tendo33');
  expect(extensionHost(c)).toBe('0f0f-uuid');
  await syncPaddleOriginRule(c);
  expect(c.rules[0].id).toBe(PADDLE_ORIGIN_RULE_ID);
  expect(c.rules[0].condition.initiatorDomains).toEqual(['0f0f-uuid']);
});
test('Chrome：host 就是扩展 id，规则不变', async () => {
  const c = mk('chrome-extension://abcdefghijklmnop/', 'abcdefghijklmnop');
  await syncPaddleOriginRule(c);
  expect(c.rules[0].condition.initiatorDomains).toEqual(['abcdefghijklmnop']);
});
test('没有 getURL 时回退到 runtime.id', () => {
  expect(extensionHost({ runtime: { id: 'x' } })).toBe('x');
});
