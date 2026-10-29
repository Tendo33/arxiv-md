/**
 * P3-3：「重新初始化」先只读核对 DNR 规则 4001：已装 → 提示就绪、不重载；有 pending/processing 任务 → 不重载；
 * 规则读不到（挂起超过 1.5 s / 报错 / 没有）→ 才 runtime.reload。设置页不写规则。
 */
import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { createPermissions } from './helpers/chrome-stubs';
import { createDefaultRegistry } from '@pdf-core/providers/index';
import { createPdfProviderSection, UI_PADDLE_RULE_ID, REINIT_CHECK_TIMEOUT_MS } from '../src/ui/settings/pdf-provider';
import { PADDLE_ORIGIN_RULE_ID } from '../src/background/paddle-origin-rule';
import { translations } from '../src/config/locales';

const html = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.html'), 'utf8');
const ORIGINS = ['https://paddleocr.aistudio-app.com/*', 'https://*.bj.bcebos.com/*'];

function setup({ rules = [], tasks = [], dnr } = {}) {
  const { document } = parseHTML(html);
  const storage = { getPdfProvider: async () => 'paddleocr', setPdfProvider: async () => {}, getProviderKey: async () => 'k', setProviderKey: async () => {} };
  const permissions = createPermissions({ origins: ORIGINS, permissions: ['declarativeNetRequestWithHostAccess'], answer: true });
  const runtime = { reload: jest.fn() };
  const toast = jest.fn();
  const local = { get: async () => ({ mineruTasks: tasks }) };
  const d = dnr || { getDynamicRules: jest.fn(async () => rules), updateDynamicRules: jest.fn() };
  const sec = createPdfProviderSection({ doc: document, storage, permissions, registry: createDefaultRegistry(), t: () => translations.zh, runtime, toast, local, dnr: d });
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
