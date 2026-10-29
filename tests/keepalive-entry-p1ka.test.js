// QA P1-KA + 审查 P3-1（review-paddleocr-parity-6a49976）：每个发起解析的入口都必须挂上 keepAlive alarm。
// 以前用正则扫源码、数 addTask 调用次数，挡不住「通过别名间接调用」和 CONFIRM_PDF_SEND 漏 refresh。
// 现在加载真实的 background/index.js（chrome.* mock），逐个入口真的发消息 / 调 converter，断言：
// 任务被处理 + chrome.alarms.create('keepAlive', ...) 被调用。
jest.mock('@utils/logger', () => ({ __esModule: true, default: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() } }));
import { loadBackground, flush } from './helpers/bg-harness';

const paper = { arxivId: '2401.00001', title: 'T', pdfUrl: 'https://arxiv.org/pdf/2401.00001' };
const settle = async () => { for (let i = 0; i < 5; i++) await flush(); };

function withTasks(b) {
  jest.spyOn(b.tm, 'findTaskByArxivId').mockResolvedValue(null);
  jest.spyOn(b.tm, 'addTask').mockResolvedValue({ id: 'new1' });
  jest.spyOn(b.tm, 'getTask').mockResolvedValue({ id: 't1', status: 'failed' });
  jest.spyOn(b.tm, 'updateTask').mockResolvedValue({});
  return b;
}

describe('每个入口：任务被处理且 keepAlive alarm 被创建（行为）', () => {
  test.each([
    ['START_PDF_TASK', { type: 'START_PDF_TASK', data: paper, provider: 'paddleocr' }, 'new1'],
    ['START_MINERU_TASK（别名）', { type: 'START_MINERU_TASK', data: paper }, 'new1'],
    ['START_MINERU_TASK_FORCE', { type: 'START_MINERU_TASK_FORCE', data: paper }, 'new1'],
    ['RETRY_TASK', { type: 'RETRY_TASK', taskId: 't1' }, 't1'],
    ['_INTERNAL_PROCESS_TASK', { type: '_INTERNAL_PROCESS_TASK', taskId: 't1' }, 't1'],
  ])('%s', async (_n, msg, id) => {
    const b = withTasks(loadBackground());
    await b.ready();
    await b.send(msg);
    await settle();
    expect(b.proc).toHaveBeenCalledWith(id);
    expect(b.keepAliveCreated()).toBe(true);
  });

  test('CONFIRM_PDF_SEND（非 OA 确认后发送）', async () => {
    const b = withTasks(loadBackground());
    await b.ready();
    expect(await b.send({ type: 'CONFIRM_PDF_SEND', taskId: 't1' })).toMatchObject({ success: true });
    await settle();
    expect(b.confirm).toHaveBeenCalledWith('t1');
    expect(b.keepAliveCreated()).toBe(true);
  });

  test('converter._convertWithMinerU（CONVERT_PAPER：popup / abs 按钮）——无论内部怎么调用，都要挂 alarm', async () => {
    const b = withTasks(loadBackground());
    await b.ready();
    const r = await b.converter._convertWithMinerU(paper, () => {}, null, 'paddleocr');
    expect(r).toMatchObject({ success: true, taskId: expect.any(String) });
    await new Promise((res) => setTimeout(res, 10));
    await settle();
    expect(b.proc).toHaveBeenCalledWith(r.taskId);
    expect(b.keepAliveCreated()).toBe(true);
  });

  test('对照：没有入口被调用时不创建 alarm（证明断言不是恒真）', async () => {
    const b = withTasks(loadBackground());
    await b.ready();
    await b.send({ type: 'PING' });
    await settle();
    expect(b.keepAliveCreated()).toBe(false);
  });
});

test('没人用的别名 processParseTask 已删除（审查 P3-1）', () => {
  expect(jest.requireActual('../src/background/mineru-task-runner')).not.toHaveProperty('processParseTask');
});
