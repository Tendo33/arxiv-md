// R4-02：DNR 规则 4001 由 background 维护：onAdded 装、onRemoved 删、提交前缺了就补（幂等）
import { ensurePaddleOriginRule, installPaddleOriginRuleListeners, PADDLE_ORIGIN_RULE_ID, DNR_PERMISSION } from '../src/background/paddle-origin-rule';
import { createParseTaskRunner } from '../src/background/parse-task-runner';
const fs = require('fs');
const path = require('path');

function mkChrome(granted) {
  let rules = [];
  const listeners = { added: [], removed: [] };
  const c = {
    runtime: { id: 'extid' },
    permissions: {
      contains: jest.fn(async () => granted),
      onAdded: { addListener: (f) => listeners.added.push(f) },
      onRemoved: { addListener: (f) => listeners.removed.push(f) },
    },
    declarativeNetRequest: {
      getDynamicRules: jest.fn(async () => rules.slice()),
      updateDynamicRules: jest.fn(async ({ removeRuleIds = [], addRules = [] }) => {
        rules = rules.filter((r) => !removeRuleIds.includes(r.id)).concat(addRules);
      }),
    },
  };
  return { c, listeners, setGranted: (g) => { granted = g; }, rules: () => rules };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('R4-02 规则生命周期', () => {
  test('onAdded（授予 DNR 权限）→ 装上规则 4001', async () => {
    const h = mkChrome(false);
    installPaddleOriginRuleListeners(h.c);
    await flush();
    expect(h.rules()).toEqual([]);
    h.setGranted(true);
    h.listeners.added.forEach((f) => f({ permissions: [DNR_PERMISSION] }));
    await flush();
    expect(h.rules().map((r) => r.id)).toEqual([PADDLE_ORIGIN_RULE_ID]);
  });

  test('onRemoved（撤销 DNR 权限）→ 删除规则 4001', async () => {
    const h = mkChrome(true);
    installPaddleOriginRuleListeners(h.c);
    await flush();
    expect(h.rules().map((r) => r.id)).toEqual([PADDLE_ORIGIN_RULE_ID]);
    h.setGranted(false);
    h.listeners.removed.forEach((f) => f({ permissions: [DNR_PERMISSION] }));
    await flush();
    expect(h.rules()).toEqual([]);
  });

  test('与 DNR 无关的权限变化不触发重装', async () => {
    const h = mkChrome(true);
    installPaddleOriginRuleListeners(h.c);
    await flush();
    h.c.declarativeNetRequest.updateDynamicRules.mockClear();
    h.listeners.added.forEach((f) => f({ origins: ['https://x.example/*'], permissions: [] }));
    await flush();
    expect(h.c.declarativeNetRequest.updateDynamicRules).not.toHaveBeenCalled();
  });

  test('提交前：有权限但规则缺失 → 补装；已在 → 不重复写（幂等）', async () => {
    const h = mkChrome(true);
    expect(await ensurePaddleOriginRule(h.c)).toBe(true);
    expect(h.rules().map((r) => r.id)).toEqual([PADDLE_ORIGIN_RULE_ID]);
    h.c.declarativeNetRequest.updateDynamicRules.mockClear();
    expect(await ensurePaddleOriginRule(h.c)).toBe(true);
    expect(h.c.declarativeNetRequest.updateDynamicRules).not.toHaveBeenCalled();
    expect(h.rules()).toHaveLength(1);
  });

  test('提交前：没权限 → 不装规则', async () => {
    const h = mkChrome(false);
    expect(await ensurePaddleOriginRule(h.c)).toBe(false);
    expect(h.rules()).toEqual([]);
  });

  test('runner：首次 submit 之前调用 beforeSubmit（规则缺失时在提交前补上）', async () => {
    const h = mkChrome(true);
    const order = [];
    const provider = { id: 'paddleocr', mode: 'sync', submit: jest.fn(async () => { order.push(`submit rules=${h.rules().length}`); return { result: { markdown: '# T\n\nbody' } }; }) };
    const task = { id: 't1', provider: 'paddleocr', paperInfo: { arxivId: '2401.00001', title: 'T', pdfUrl: 'https://arxiv.org/pdf/2401.00001' }, oa: true, consent: true };
    const runner = createParseTaskRunner({
      registry: { get: () => provider },
      taskManager: { getTask: async () => task, updateTask: async () => {} },
      storage: { getProviderKey: async () => 'k' },
      guard: { consume: async () => false },
      downloadUrl: async () => 1,
      saveDeliverable: async () => ({ id: 1, filename: 'a.md' }),
      makeFilename: () => 'a.md',
      beforeSubmit: async () => { order.push('ensure'); await ensurePaddleOriginRule(h.c); },
    });
    await runner.process('t1');
    expect(order).toEqual(['ensure', 'submit rules=1']);
  });

  test('popup / options / content 不调用 updateDynamicRules', () => {
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
    const files = ['src/ui', 'src/content'].flatMap((d) => walk(path.join(__dirname, '..', d))).filter((f) => f.endsWith('.js'));
    for (const f of files) expect([f, /updateDynamicRules/.test(fs.readFileSync(f, 'utf8'))]).toEqual([f, false]);
    const runnerSrc = fs.readFileSync(path.join(__dirname, '../src/background/mineru-task-runner.js'), 'utf8');
    expect(runnerSrc).toMatch(/beforeSubmit:[^\n]*requirePaddleOriginRule/);
  });
});
