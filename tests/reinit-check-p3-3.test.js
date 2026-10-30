/**
 * P3-3：「重新初始化」先只读核对 DNR 规则 4001：已装 → 提示就绪、不重载；有 pending/processing 任务 → 不重载；
 * 规则读不到（挂起超过 1.5 s / 报错 / 没有）→ 才 runtime.reload。设置页不写规则。
 */
import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { createDefaultRegistry } from '@pdf-core/providers/index';
import { createPdfProviderSection, UI_PADDLE_RULE_ID, REINIT_CHECK_TIMEOUT_MS } from '../src/ui/settings/pdf-provider';
import { PADDLE_ORIGIN_RULE_ID } from '../src/background/paddle-origin-rule';
import { translations } from '../src/config/locales';

const html = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.html'), 'utf8');

function setup({ rules = [], tasks = [], dnr } = {}) {
  const { document } = parseHTML(html);
  const storage = { getPdfProvider: async () => 'paddleocr', setPdfProvider: async () => {}, getProviderKey: async () => 'k', setProviderKey: async () => {} };
  const runtime = { reload: jest.fn() };
  const toast = jest.fn();
  const local = { get: async () => ({ mineruTasks: tasks }) };
  const d = dnr || { getDynamicRules: jest.fn(async () => rules), updateDynamicRules: jest.fn() };
  const sec = createPdfProviderSection({ doc: document, storage, registry: createDefaultRegistry(), t: () => translations.zh, runtime, toast, local, dnr: d });
  return { sec, runtime, toast, dnr: d };
}

test('规则 id 与 background 一致', () => {
  expect(UI_PADDLE_RULE_ID).toBe(PADDLE_ORIGIN_RULE_ID);
});
test('规则已装 → ready，不重载，不写规则', async () => {
  const s = setup({ rules: [{ id: 4001 }] });
  expect(await s.sec.onReinit()).toBe('ready');
  expect(s.runtime.reload).not.toHaveBeenCalled();
  expect(s.dnr.updateDynamicRules).not.toHaveBeenCalled();
  expect(s.toast).toHaveBeenCalledWith(translations.zh.pdf_reinit_ready, 'success');
});
test('有任务在跑 → busy，不重载', async () => {
  const s = setup({ tasks: [{ status: 'processing' }, { status: 'pending' }, { status: 'completed' }] });
  expect(await s.sec.onReinit()).toBe('busy');
  expect(s.runtime.reload).not.toHaveBeenCalled();
  expect(s.toast.mock.calls[0][0]).toMatch(/2/);
});
test('规则没有 → reloaded', async () => {
  const s = setup({ rules: [] });
  expect(await s.sec.onReinit()).toBe('reloaded');
  expect(s.runtime.reload).toHaveBeenCalledTimes(1);
});
test('getDynamicRules 挂起 → 超时后 reloaded', async () => {
  jest.useFakeTimers();
  const s = setup({ dnr: { getDynamicRules: () => new Promise(() => {}) } });
  const p = s.sec.onReinit();
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  jest.advanceTimersByTime(REINIT_CHECK_TIMEOUT_MS + 1);
  jest.useRealTimers();
  expect(await p).toBe('reloaded');
});
test('文案中英都在', () => {
  for (const l of ['zh', 'en']) { expect(translations[l].pdf_reinit_ready).toBeTruthy(); expect(translations[l].pdf_reinit_busy).toMatch(/\{n\}/); }
});

// 审查 P3-a：等待 reinit 的 PENDING 任务不算「在跑」，按钮可以继续核对 / 重载；英文单复数
test('只有等待 reinit 的 PENDING 任务 → 不算忙，规则没有时直接 reloaded', async () => {
  const s = setup({ rules: [], tasks: [{ status: 'pending', dnrReinitWaitSince: 1 }] });
  expect(await s.sec.onReinit()).toBe('reloaded');
  expect(s.runtime.reload).toHaveBeenCalledTimes(1);
});
test('等待 reinit 的任务 + 普通 PENDING → 仍然 busy，计数只算普通任务', async () => {
  const s = setup({ tasks: [{ status: 'pending', dnrReinitWaitSince: 1 }, { status: 'pending' }] });
  expect(await s.sec.onReinit()).toBe('busy');
  expect(s.toast.mock.calls[0][0]).toBe(translations.zh.pdf_reinit_busy_one);
});
test('dnrReinitWaitSince 为 0 也算在等 reinit（不是 falsy 判断）', async () => {
  const s = setup({ rules: [{ id: 4001 }], tasks: [{ status: 'pending', dnrReinitWaitSince: 0 }] });
  expect(await s.sec.onReinit()).toBe('ready');
});
test('PROCESSING 任务即使带 dnrReinitWaitSince 也算忙', async () => {
  const s = setup({ tasks: [{ status: 'processing', dnrReinitWaitSince: 1 }] });
  expect(await s.sec.onReinit()).toBe('busy');
});
test('英文单复数：1 PDF task / N PDF tasks', () => {
  expect(translations.en.pdf_reinit_busy_one).toMatch(/^1 PDF task still running/);
  expect(translations.en.pdf_reinit_busy).toMatch(/^\{n\} PDF tasks still running/);
  expect(translations.en.pdf_reinit_busy).not.toMatch(/\(s\)/);
});
test('英文 toast：1 个用单数，2 个用复数', async () => {
  const mk = (tasks) => {
    const { document } = parseHTML(html);
    const toast = jest.fn();
    const sec = createPdfProviderSection({ doc: document, storage: { getPdfProvider: async () => 'paddleocr', setPdfProvider: async () => {}, getProviderKey: async () => 'k', setProviderKey: async () => {} }, registry: createDefaultRegistry(), t: () => translations.en, runtime: { reload: jest.fn() }, toast, local: { get: async () => ({ mineruTasks: tasks }) }, dnr: { getDynamicRules: async () => [] } });
    return { sec, toast };
  };
  const a = mk([{ status: 'pending' }]); await a.sec.onReinit();
  expect(a.toast.mock.calls[0][0]).toBe('1 PDF task still running. Reinitialize after it finishes so it isn\'t interrupted.');
  const b = mk([{ status: 'pending' }, { status: 'processing' }]); await b.sec.onReinit();
  expect(b.toast.mock.calls[0][0]).toBe('2 PDF tasks still running. Reinitialize after they finish so they aren\'t interrupted.');
});

// 审查 P3-b：ready 只认规则 4001（「任意规则都算 ready」的变异要被杀死）
test('只有别的动态规则（不是 4001）→ 不算 ready，照常 reloaded', async () => {
  const s = setup({ rules: [{ id: 9999 }, { id: 4002 }] });
  expect(await s.sec.onReinit()).toBe('reloaded');
  expect(s.runtime.reload).toHaveBeenCalledTimes(1);
  expect(s.toast).not.toHaveBeenCalledWith(translations.zh.pdf_reinit_ready, 'success');
});
