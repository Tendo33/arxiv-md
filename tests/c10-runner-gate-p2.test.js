// 审查 30a6e1b P2：C10 拦截不能被 重试 / SW 续跑 / 内部 process 消息 / 确认发送 绕过。
// 用真实的 paddleocr / mineru provider + fetch mock：没确认数据说明时 fetch 必须 0 次，任务停在中性的 awaiting_disclosure。
import fs from 'fs';
import path from 'path';
import { createDefaultRegistry } from '@pdf-core/providers/index';
import { createParseTaskRunner } from '../src/background/parse-task-runner';
import { isDisclosureAcked, ackKey } from '../src/utils/disclosure-ack';
import { TASK_STATUS } from '../src/config/constants';
import { translations } from '../src/config/locales';
const __area = { get: async () => ({}), set: async () => {} };
global.chrome = global.chrome || { storage: { sync: __area, local: __area, onChanged: { addListener() {} } }, runtime: {} };
const { taskNotificationText } = require('../src/background/task-notification-text');

function setup({ provider, acked = false, status = 'pending', extra = {} }) {
  const mem = acked ? { [ackKey(provider)]: 1 } : {};
  const local = { get: jest.fn(async (k) => (k in mem ? { [k]: mem[k] } : {})) };
  const store = new Map([['t1', { id: 't1', status, provider, paperInfo: { arxivId: '2401.00001', pdfUrl: 'https://arxiv.org/pdf/2401.00001' }, ...extra }]]);
  const taskManager = {
    getTask: jest.fn(async (id) => (store.has(id) ? { ...store.get(id) } : null)),
    updateTask: jest.fn(async (id, u) => { store.set(id, { ...store.get(id), ...u }); return store.get(id); }),
    getTasks: jest.fn(async () => [...store.values()]),
  };
  const permissions = { contains: jest.fn(async () => true) };
  const notify = jest.fn();
  const beforeSubmit = jest.fn(async () => {});
  const runner = createParseTaskRunner({
    registry: createDefaultRegistry(), taskManager, permissions, beforeSubmit, notify,
    storage: { getProviderKey: jest.fn(async () => 'fixture-not-a-real-key') },
    guard: { consume: jest.fn(async () => false) },
    downloadUrl: jest.fn(), saveDeliverable: jest.fn(), makeFilename: () => 'x',
    isDisclosureAcked: (id) => isDisclosureAcked(id, local),
    sleep: async () => {},
  });
  return { runner, store, notify, beforeSubmit };
}

let fetchMock;
beforeEach(() => { fetchMock = jest.fn(async () => { throw new Error('network must not be touched'); }); global.fetch = fetchMock; });
afterEach(() => { delete global.fetch; });

describe.each(['paddleocr', 'mineru'])('%s without disclosureAck', (provider) => {
  const expectBlocked = (h, r) => {
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(h.beforeSubmit).not.toHaveBeenCalled();
    expect(h.store.get('t1').status).toBe(TASK_STATUS.AWAITING_DISCLOSURE);
    expect(h.store.get('t1').status).not.toBe(TASK_STATUS.FAILED);
    if (r) expect(r).toEqual({ disclosureNeeded: true, provider });
  };
  test('retry (failed task reset to pending, then process)', async () => {
    const h = setup({ provider, status: TASK_STATUS.FAILED, extra: { error: 'x' } });
    h.store.set('t1', { ...h.store.get('t1'), status: TASK_STATUS.PENDING, error: null }); // = handleRetryTask
    expectBlocked(h, await h.runner.process('t1'));
  });
  test('resume after SW restart', async () => {
    const h = setup({ provider, status: TASK_STATUS.PROCESSING });
    const ids = await h.runner.resumeActiveTasks();
    expect(ids).toEqual(['t1']);
    await new Promise((r) => setTimeout(r, 20));
    expectBlocked(h);
  });
  test('internal _INTERNAL_PROCESS_TASK → process', async () => {
    const h = setup({ provider });
    expectBlocked(h, await h.runner.process('t1'));
  });
  test('CONFIRM_PDF_SEND → confirmSend', async () => {
    const h = setup({ provider, status: TASK_STATUS.AWAITING_CONSENT });
    const r = await h.runner.confirmSend('t1');
    await r.done;
    expectBlocked(h);
  });
  test('notification is neutral, shared title', () => {
    const h = setup({ provider });
    return h.runner.process('t1').then(() => {
      expect(h.notify).toHaveBeenCalledWith(expect.anything(), 'disclosure', '', expect.anything());
      for (const l of ['zh', 'en']) expect(taskNotificationText({ paperInfo: { title: 'T' } }, 'disclosure', '', 'X', l).title).toBe(translations[l].pdf_disc_needed_title);
    });
  });
});

test('acked provider still proceeds to submit (gate is not a blanket block)', async () => {
  const h = setup({ provider: 'mineru', acked: true });
  await h.runner.process('t1');
  expect(h.beforeSubmit).toHaveBeenCalled();
  expect(h.store.get('t1').status).not.toBe(TASK_STATUS.AWAITING_DISCLOSURE);
});

test('background runner wires the gate; entry-point gates kept', () => {
  const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
  expect(read('src/background/mineru-task-runner.js')).toMatch(/isDisclosureAcked: \(id\) => \(needsDisclosure\(id\) \? isDisclosureAcked\(id\) : true\)/);
  expect(read('src/background/index.js')).toMatch(/if \(!\(await isDisclosureAcked\(provider\)\)\)/);
  expect(read('src/core/converter/index.js')).toMatch(/if \(!\(await isDisclosureAcked\(provider\)\)\)/);
});

test('popup row: neutral badge, shared title note, Review + Retry, no error line', () => {
  const { parseHTML } = require('linkedom');
  const doc = parseHTML('<!doctype html><html><body></body></html>').document;
  const row = require('../src/ui/popup/task-list').createTaskRow({ id: 't1', status: TASK_STATUS.AWAITING_DISCLOSURE, provider: 'mineru', paperInfo: { title: 'T' } }, doc);
  expect(row.querySelector('.badge').className).toContain('wait');
  expect(row.querySelector('.row-err')).toBeNull();
  expect(row.querySelector('.row-note')).not.toBeNull();
  expect(row.querySelector('[data-action="disclose"]').getAttribute('data-provider')).toBe('mineru');
  expect(row.querySelector('[data-action="retry"]')).not.toBeNull();
});

test('row-note takes a full flex line (rows are flex, not grid) and uses --text-2', () => {
  const css = require('fs').readFileSync(require('path').join(__dirname, '../src/ui/popup/popup.css'), 'utf8');
  const rule = css.match(/\.row \.row-note\{[^}]*\}/)[0];
  expect(rule).toMatch(/flex-basis:(100%|calc\(100% - var\(--note-indent,0px\)\))/); // R-2：从标题文字左缘起占满剩余整行
  expect(rule).not.toContain('grid-column');
  expect(rule).toContain('var(--text-2)');
});
