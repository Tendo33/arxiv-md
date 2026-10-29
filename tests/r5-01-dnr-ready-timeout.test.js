// R5-01 / R5-02：PaddleOCR 提交前 DNR 规则就绪检查：5 s 超时 + 重装；不再吞错继续提交
jest.mock('@utils/logger', () => ({ __esModule: true, default: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() } }));
jest.mock('@utils/storage', () => ({ __esModule: true, default: { getLanguage: jest.fn(async () => 'zh') } }));
import logger from '@utils/logger';
import { createPermissions } from './helpers/chrome-stubs';
import { requirePaddleOriginRule, syncPaddleOriginRule, installPaddleOriginRuleListeners, PADDLE_ORIGIN_RULE_ID, DNR_PERMISSION, DNR_READY_TIMEOUT_MS } from '../src/background/paddle-origin-rule';
import { makeHarness, fakeProvider } from './helpers/runner-harness';
import { taskErrorText } from '../src/ui/popup/task-error-text';
import { failureText } from '../src/background/task-notification-text';
import { translations } from '../src/config/locales';

const granted = () => createPermissions({ permissions: [DNR_PERMISSION] });
function dnrWith(rulesSeq) {
  let i = 0;
  return {
    getDynamicRules: jest.fn(async () => rulesSeq[Math.min(i++, rulesSeq.length - 1)]),
    updateDynamicRules: jest.fn(async () => {}),
  };
}
const RULE = [{ id: PADDLE_ORIGIN_RULE_ID }];
const noSleep = async () => {};

describe('requirePaddleOriginRule', () => {
  test('超时常量 = 5000 ms', () => expect(DNR_READY_TIMEOUT_MS).toBe(5000));

  test('规则已在 → 通过，不重装', async () => {
    const c = { permissions: granted(), runtime: { id: 'x' }, declarativeNetRequest: dnrWith([RULE]) };
    await expect(requirePaddleOriginRule(c, { sleep: noSleep })).resolves.toBe(true);
    expect(c.declarativeNetRequest.updateDynamicRules).not.toHaveBeenCalled();
  });

  test('规则不在 → 重装后再查到 → 通过', async () => {
    const c = { permissions: granted(), runtime: { id: 'x' }, declarativeNetRequest: dnrWith([[], RULE]) };
    await expect(requirePaddleOriginRule(c, { sleep: noSleep })).resolves.toBe(true);
    expect(c.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledWith(expect.objectContaining({ removeRuleIds: [PADDLE_ORIGIN_RULE_ID], addRules: [expect.objectContaining({ id: PADDLE_ORIGIN_RULE_ID })] }));
  });

  test('重装一直不生效（同会话刚授权）→ 3 轮后 PERMISSION_MISSING / dnr_not_ready', async () => {
    const c = { permissions: granted(), runtime: { id: 'x' }, declarativeNetRequest: dnrWith([[]]) };
    await expect(requirePaddleOriginRule(c, { sleep: noSleep })).rejects.toMatchObject({ code: 'PERMISSION_MISSING', reason: 'dnr_not_ready', provider: 'paddleocr' });
    expect(c.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledTimes(3);
  });

  test('DNR 调用抛 "not available in this context" → 重试后 dnr_not_ready（不当作成功）', async () => {
    const dnr = { getDynamicRules: jest.fn(async () => { throw new Error('declarativeNetRequest.getDynamicRules is not available in this context'); }), updateDynamicRules: jest.fn() };
    const c = { permissions: granted(), runtime: { id: 'x' }, declarativeNetRequest: dnr };
    await expect(requirePaddleOriginRule(c, { sleep: noSleep })).rejects.toMatchObject({ reason: 'dnr_not_ready' });
    expect(dnr.getDynamicRules).toHaveBeenCalledTimes(3);
  });

  test('DNR 调用永不 settle → 5 s 后 dnr_not_ready（fake timers）', async () => {
    jest.useFakeTimers();
    try {
      const c = { permissions: granted(), runtime: { id: 'x' }, declarativeNetRequest: { getDynamicRules: () => new Promise(() => {}), updateDynamicRules: jest.fn() } };
      const p = requirePaddleOriginRule(c);
      const settled = jest.fn(); p.catch(settled);
      await jest.advanceTimersByTimeAsync(4999);
      expect(settled).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(1);
      await expect(p).rejects.toMatchObject({ code: 'PERMISSION_MISSING', reason: 'dnr_not_ready' });
    } finally { jest.useRealTimers(); }
  });

  test('没有 DNR 权限 → dnr_not_ready，不调 DNR', async () => {
    const dnr = dnrWith([RULE]);
    const c = { permissions: createPermissions(), runtime: { id: 'x' }, declarativeNetRequest: dnr };
    await expect(requirePaddleOriginRule(c, { sleep: noSleep })).rejects.toMatchObject({ reason: 'dnr_not_ready' });
    expect(dnr.getDynamicRules).not.toHaveBeenCalled();
  });
});

describe('runner：beforeSubmit 失败 → 任务失败，0 次 submit（不再吞错）', () => {
  test('dnr_not_ready → FAILED，errorCode/Reason 落库，provider.submit 未调用', async () => {
    const p = fakeProvider();
    const h = makeHarness({ providers: [p], tasks: [{ id: 't1' }] });
    const { ParseError } = require('@pdf-core/errors');
    h.deps.beforeSubmit = jest.fn(async () => { throw new ParseError('PERMISSION_MISSING', { provider: 'fake-a', reason: 'dnr_not_ready' }); });
    const { createParseTaskRunner } = require('../src/background/parse-task-runner');
    const runner = createParseTaskRunner(h.deps);
    await runner.process('t1');
    expect(h.deps.beforeSubmit).toHaveBeenCalled();
    expect(p.submit).not.toHaveBeenCalled();
    expect(h.store.get('t1')).toMatchObject({ status: 'failed', errorCode: 'PERMISSION_MISSING', errorReason: 'dnr_not_ready' });
  });
});

describe('MinerU 不等 Paddle 的规则', () => {
  test('mineru-task-runner：只有 paddleocr 才调 requirePaddleOriginRule', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../src/background/mineru-task-runner.js'), 'utf8');
    expect(src).toMatch(/provider\.id === 'paddleocr' \? requirePaddleOriginRule\(\) : undefined/);
  });
});

describe('文案：dnr_not_ready 中英都有，任务行 / 通知不显示原始码', () => {
  test.each(['zh', 'en'])('%s', (lang) => {
    const t = translations[lang];
    expect(t.err_short_reason_dnr_not_ready).toBeTruthy();
    expect(t.err_reason_dnr_not_ready).toMatch(/\{provider\}/);
    const row = taskErrorText({ errorCode: 'PERMISSION_MISSING', errorReason: 'dnr_not_ready' }, t);
    expect(row).toBe(t.err_short_reason_dnr_not_ready);
    const note = failureText({ code: 'PERMISSION_MISSING', reason: 'dnr_not_ready' }, 'PaddleOCR', lang);
    expect(note).toBe(t.err_reason_dnr_not_ready.replace('{provider}', 'PaddleOCR'));
    expect(note).not.toMatch(/PERMISSION_MISSING|dnr_not_ready/);
  });
});

describe('R5-02：撤销后 DNR 报 not available → 不算故障，只 debug', () => {
  test('sync 返回 false，不 warn', async () => {
    const warn = logger.warn; warn.mockClear(); logger.debug.mockClear();
    const c = { permissions: createPermissions(), runtime: { id: 'x' }, declarativeNetRequest: { updateDynamicRules: jest.fn(async () => { throw new Error('declarativeNetRequest.updateDynamicRules is not available in this context'); }) } };
    expect(await syncPaddleOriginRule(c)).toBe(false);
    expect(warn).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalled();
  });

  test('onAdded：第一次装失败 → 1 s 后重试一次', async () => {
    jest.useFakeTimers();
    try {
      const listeners = {};
      const perms = granted();
      perms.onAdded = { addListener: (f) => { listeners.added = f; } };
      perms.onRemoved = { addListener: (f) => { listeners.removed = f; } };
      let n = 0;
      const dnr = { updateDynamicRules: jest.fn(async () => { n += 1; if (n === 2) throw new Error('boom'); }) };
      installPaddleOriginRuleListeners({ permissions: perms, runtime: { id: 'x' }, declarativeNetRequest: dnr });
      await jest.advanceTimersByTimeAsync(0); // 启动时的 sync（n=1）
      listeners.added({ permissions: [DNR_PERMISSION] }); // n=2 失败
      await jest.advanceTimersByTimeAsync(0);
      expect(dnr.updateDynamicRules).toHaveBeenCalledTimes(2);
      await jest.advanceTimersByTimeAsync(1000);
      expect(dnr.updateDynamicRules).toHaveBeenCalledTimes(3);
    } finally { jest.useRealTimers(); }
  });
});
