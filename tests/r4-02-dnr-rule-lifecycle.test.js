// R4-02：DNR 规则 4001 由 background 维护：启动时装、提交前缺了就补（幂等）。1.2.2 起权限安装时授予，不再监听 permissions 事件
import { ensurePaddleOriginRule, installPaddleOriginRule, PADDLE_ORIGIN_RULE_ID } from '../src/background/paddle-origin-rule';
import { createParseTaskRunner } from '../src/background/parse-task-runner';
const fs = require('fs');
const path = require('path');

function mkChrome() {
  let rules = [];
  const c = {
    runtime: { id: 'extid' },
    declarativeNetRequest: {
      getDynamicRules: jest.fn(async () => rules.slice()),
      updateDynamicRules: jest.fn(async ({ removeRuleIds = [], addRules = [] }) => {
        rules = rules.filter((r) => !removeRuleIds.includes(r.id)).concat(addRules);
      }),
    },
  };
  return { c, rules: () => rules };
}

describe('R4-02 规则生命周期', () => {
  test('后台启动 → 装上规则 4001（不查 permissions）', async () => {
    const h = mkChrome();
    expect(await installPaddleOriginRule(h.c)).toBe(true);
    expect(h.rules().map((r) => r.id)).toEqual([PADDLE_ORIGIN_RULE_ID]);
  });

  test('background/index.js 启动时调用 installPaddleOriginRule，不再注册权限监听', () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/background/index.js'), 'utf8');
    expect(src).toMatch(/\ninstallPaddleOriginRule\(\);/);
    expect(src).not.toMatch(/installPaddleOriginRuleListeners|permissions\.onAdded|permissions\.onRemoved/);
  });

  test('提交前：规则缺失 → 补装；已在 → 不重复写（幂等）', async () => {
    const h = mkChrome();
    expect(await ensurePaddleOriginRule(h.c)).toBe(true);
    expect(h.rules().map((r) => r.id)).toEqual([PADDLE_ORIGIN_RULE_ID]);
    h.c.declarativeNetRequest.updateDynamicRules.mockClear();
    expect(await ensurePaddleOriginRule(h.c)).toBe(true);
    expect(h.c.declarativeNetRequest.updateDynamicRules).not.toHaveBeenCalled();
    expect(h.rules()).toHaveLength(1);
  });

  test('提交前：DNR 不可用 → 返回 false', async () => {
    expect(await ensurePaddleOriginRule({ runtime: { id: 'extid' } })).toBe(false);
  });

  test('runner：首次 submit 之前调用 beforeSubmit（规则缺失时在提交前补上）', async () => {
    const h = mkChrome();
    const order = [];
    const provider = { id: 'paddleocr', mode: 'sync', submit: jest.fn(async () => { order.push(`submit rules=${h.rules().length}`); return { result: { markdown: '# T\n\nbody' } }; }) };
    const task = { id: 't1', provider: 'paddleocr', paperInfo: { arxivId: '2401.00001', title: 'T', pdfUrl: 'https://arxiv.org/pdf/2401.00001' } };
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
