// R4-04：mineru-client 薄壳——旧 API 不变，输出仍是 chrome.downloads 下载 ZIP
jest.mock('@utils/helpers', () => ({ sleep: () => Promise.resolve() }));
import { createFetchMock } from './helpers/fetch-mock';
import { installChrome } from './helpers/chrome-stubs';
import submitOk from './fixtures/providers/mineru/submit-ok.json';
import running from './fixtures/providers/mineru/poll-running.json';
import done from './fixtures/providers/mineru/poll-done.json';

const URL_ = 'https://mineru.net/api/v4/extract/task';

test('convert：提交 → 轮询 → downloads 下载 ZIP，文件名透传', async () => {
  const c = installChrome();
  const fm = createFetchMock().on(URL_, [{ json: submitOk }], { method: 'POST' })
    .on(`${URL_}/`, [new TypeError('blip'), { json: running }, { json: done }], { method: 'GET' });
  global.fetch = fm.fetch;
  const client = require('../src/core/converter/mineru-client').default;
  const seen = [];
  const r = await client.convert('https://arxiv.org/pdf/2401.00001.pdf', 'tok', { arxivId: '2401.00001', filename: 'Foo (2024).zip' }, (p) => seen.push(p.stage));
  expect(r.zipUrl).toBe(done.data.extract_result.full_zip_url);
  expect(r.metadata.taskId).toBe(submitOk.data.task_id);
  expect(c.downloads.download.mock.calls[0][0]).toEqual({ url: r.zipUrl, filename: 'Foo (2024).zip', saveAs: false, conflictAction: 'uniquify' });
  expect(seen[0]).toBe('submitting');
  expect(seen[seen.length - 1]).toBe('completed');
});

test('pollTask 用尽次数 → TIMEOUT', async () => {
  installChrome();
  global.fetch = createFetchMock().on(`${URL_}/`, [{ json: running }], { sticky: true }).fetch;
  const client = require('../src/core/converter/mineru-client').default;
  client.maxPollAttempts = 3;
  await expect(client.pollTask('x', 'tok')).rejects.toMatchObject({ code: 'TIMEOUT' });
});
