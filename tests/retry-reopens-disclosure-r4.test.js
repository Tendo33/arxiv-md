// QA 6a49976 R-4：没确认披露时点重试，要重新弹出披露（设置页 #disclosure）；已确认则不弹
jest.mock('@utils/logger', () => ({ __esModule: true, default: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() } }));
import { loadBackground, flush } from './helpers/bg-harness';

function setup(acked) {
  const b = loadBackground();
  chrome.storage.local.get = async (k) => (acked && typeof k === 'string' && k.startsWith('disclosureAck.') ? { [k]: Date.now() } : {});
  const sent = jest.spyOn(chrome.runtime, 'sendMessage');
  const task = { id: 't1', status: 'failed', provider: 'paddleocr' };
  jest.spyOn(b.tm, 'getTask').mockResolvedValue(task);
  jest.spyOn(b.tm, 'updateTask').mockResolvedValue(task);
  return { b, sent };
}
const opened = (sent) => sent.mock.calls.filter(([m]) => m && m.type === 'OPEN_DISCLOSURE');

test('未确认：RETRY_TASK 重新打开该后端的披露', async () => {
  const { b, sent } = setup(false);
  expect(await b.send({ type: 'RETRY_TASK', taskId: 't1' })).toEqual({ success: true });
  await flush();
  expect(opened(sent)).toEqual([[{ type: 'OPEN_DISCLOSURE', provider: 'paddleocr' }]]);
  expect(b.proc).toHaveBeenCalledWith('t1'); // runner 仍会把任务停在 awaiting_disclosure
});

test('已确认：RETRY_TASK 不弹披露', async () => {
  const { b, sent } = setup(true);
  await b.send({ type: 'RETRY_TASK', taskId: 't1' });
  await flush();
  expect(opened(sent)).toHaveLength(0);
});
