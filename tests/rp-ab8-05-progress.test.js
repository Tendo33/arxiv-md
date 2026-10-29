// release-polish AB8-05：知道 totalBytes 才显示真实百分比，否则不显示（不再 0%）
import { parseHTML } from 'linkedom';
import { downloadFile } from '../src/utils/helpers';

function fakeDownloads(items) {
  let i = 0;
  const listeners = [];
  global.chrome = { runtime: {}, downloads: {
    download: (o, cb) => setTimeout(() => cb(7), 0),
    search: async () => [items[Math.min(i++, items.length - 1)]],
    onChanged: { addListener: (f) => listeners.push(f), removeListener: (f) => listeners.splice(listeners.indexOf(f), 1) },
  } };
  return listeners;
}
beforeEach(() => jest.useFakeTimers());
afterEach(() => { jest.useRealTimers(); delete global.chrome; });

test('totalBytes 已知 → 按 bytesReceived/totalBytes 报百分比，完成后停止', async () => {
  const L = fakeDownloads([
    { id: 7, state: 'in_progress', bytesReceived: 0, totalBytes: 2000 },
    { id: 7, state: 'in_progress', bytesReceived: 1300, totalBytes: 2000 },
    { id: 7, state: 'in_progress', bytesReceived: 1300, totalBytes: 2000 },
    { id: 7, state: 'complete', bytesReceived: 2000, totalBytes: 2000 },
  ]);
  const seen = [];
  const p = downloadFile('u', 'f.pdf', { onProgress: (x) => seen.push(x), progressMs: 1000, keepaliveMs: 60000 });
  await jest.advanceTimersByTimeAsync(5000);
  await expect(p).resolves.toBe(7);
  expect(seen).toEqual([0, 65]);
  expect(L).toHaveLength(0);
  const n = seen.length;
  await jest.advanceTimersByTimeAsync(5000);
  expect(seen).toHaveLength(n);
});
test('totalBytes 未知 → 不报百分比', async () => {
  fakeDownloads([{ id: 7, state: 'in_progress', bytesReceived: 500, totalBytes: 0 }, { id: 7, state: 'complete' }]);
  const seen = [];
  const p = downloadFile('u', 'f.pdf', { onProgress: (x) => seen.push(x), progressMs: 1000 });
  await jest.advanceTimersByTimeAsync(3000);
  await p;
  expect(seen).toEqual([]);
});
test('页面：downloading 阶段 progress null 不显示百分比；有数字时显示', () => {
  const { document } = parseHTML('<div class="arxiv-md-progress"><span class="progress-text"></span><span class="progress-percent">0%</span><div class="progress-detail"></div></div>');
  global.document = document;
  const { updateProgressUI } = require('../src/content/progress-ui');
  updateProgressUI({ tier: 'pdf', stage: 'downloading', progress: null });
  expect(document.querySelector('.progress-percent').textContent).toBe('');
  updateProgressUI({ tier: 'pdf', stage: 'downloading', progress: 65, bytesKnown: true });
  expect(document.querySelector('.progress-percent').textContent).toBe('65%');
  delete global.document;
});
test('页面 PDF 按钮开始下载时不写死 0%', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../src/content/index.js'), 'utf8');
  const i = src.indexOf('async function handlePdfDownloadDirect');
  expect(src.slice(i, i + 2500)).not.toMatch(/content_progress_downloading,\s*percent: 0,/);
});
