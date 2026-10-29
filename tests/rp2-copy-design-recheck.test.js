// rp2：设计复核 1dd3a2a 的文案修改；HTTP 状态码不进界面，只进日志
import { translations } from '../src/config/locales';
import { taskErrorText } from '../src/ui/popup/task-error-text';
import { createParseTaskRunner } from '../src/background/parse-task-runner';
import { classifyHttpError } from '@pdf-core/errors';

const { zh, en } = translations;
test('QUOTA：不说「明天」', () => {
  expect(zh.err_QUOTA_EXCEEDED).toBe('{provider} 的额度已用完，请稍后再试或换一个后端');
  expect(en.err_QUOTA_EXCEEDED).toBe('{provider} quota exhausted. Try again later or switch provider');
});
test('en empty_result 用 provider，不用 backend', () => {
  expect(en.err_reason_empty_result).toMatch(/another provider$/);
  expect(en.err_reason_empty_result).not.toMatch(/backend/);
});
test('forbidden_empty 非技术化，不含 HTTP 403', () => {
  expect(zh.err_reason_forbidden_empty).toBe('{provider} 拒绝了这次请求（与 Key 或额度无关），可以稍后重试或换一个后端');
  expect(en.err_reason_forbidden_empty).toBe('{provider} rejected this request (not a key or quota problem). Retry later or switch provider');
  for (const l of [zh, en]) expect(l.err_reason_forbidden_empty).not.toMatch(/403|HTTP/);
});
test('en TIMEOUT 与 zh 同义', () => {
  expect(en.err_TIMEOUT).toBe('{provider} timed out. The task was stopped');
});
test('popup 任务行：forbidden_empty 不重复后端名（S-2 每行一次），也不含 403', () => {
  const task = { provider: 'paddleocr', errorCode: 'PROVIDER_FAILED', errorReason: 'forbidden_empty', errorHttpStatus: 403 };
  expect(taskErrorText(task, zh, () => 'PaddleOCR')).toBe('请求被拒绝（与 Key 或额度无关），可以稍后重试或换一个后端');
  expect(taskErrorText(task, en, () => 'PaddleOCR')).not.toMatch(/403|\{provider\}|PaddleOCR/);
  // 设置页 / 通知仍用带后端名的通用文案
  expect(zh.err_reason_forbidden_empty).toContain('{provider}');
});
test('任务失败时日志里有 HTTP 状态码', async () => {
  const lines = [];
  const task = { id: 't1', provider: 'paddleocr', paperInfo: { arxivId: '2401.00001', title: 'T' }, oa: true, consent: true };
  const updates = [];
  const provider = { id: 'paddleocr', mode: 'sync', submit: async () => { throw classifyHttpError({ status: 403, bodyText: '' }, 'paddleocr'); } };
  const runner = createParseTaskRunner({
    registry: { get: () => provider },
    taskManager: { getTask: async () => task, updateTask: async (id, u) => { updates.push(u); Object.assign(task, u); } },
    storage: { getProviderKey: async () => 'k' },
    guard: { consume: async () => false },
    downloadUrl: async () => 1, saveDeliverable: async () => ({}), makeFilename: () => 'a.md',
    log: { info() {}, error: (m) => lines.push(String(m)) },
  });
  await runner.process('t1');
  const failed = updates.find((u) => u.status === 'failed');
  expect(failed && failed.errorHttpStatus).toBe(403);
  expect(lines.join('\n')).toMatch(/PROVIDER_FAILED \(forbidden_empty\) HTTP 403/);
});
