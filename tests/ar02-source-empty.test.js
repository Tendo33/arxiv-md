// AR-02 补丁：ar5iv「No content available」页在来源层就标成空内容（empty_result），上层据此提示而不是普通“已保存为 PDF/已完成”
jest.mock('@utils/logger', () => ({ __esModule: true, default: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() } }));
import { loadHtmlPaper, HTML_PAPER_SOURCES } from '../src/core/html-paper';
import ar5ivConverter from '../src/core/converter/ar5iv-converter';
import { isEmptyResultError } from '@pdf-core/output/pre-save';
const fs = require('fs');
const path = require('path');
const noContent = fs.readFileSync(path.join(__dirname, 'fixtures/ar5iv-no-content-hep-th-9711200.html'), 'utf8');
const resp = (status, body, url) => ({ ok: status === 200, status, url, headers: { get: () => 'text/html; charset=utf-8' }, text: async () => body });

test('loadHtmlPaper：No content 页 → onError(empty_result) 并返回 null', async () => {
  const onError = jest.fn();
  const ar5iv = HTML_PAPER_SOURCES.find((s) => s.id === 'ar5iv');
  const r = await loadHtmlPaper(ar5iv, 'hep-th/9711200', async (u) => resp(200, noContent, u), onError);
  expect(r).toBeNull();
  expect(isEmptyResultError(onError.mock.calls[0][0])).toBe(true);
});

test('ar5iv-converter：arXiv HTML 404 + ar5iv 空 → 抛 empty_result（不是普通 404）', async () => {
  const orig = global.fetch;
  global.fetch = async (u) => (/ar5iv/.test(u) ? resp(200, noContent, 'https://ar5iv.labs.arxiv.org/html/hep-th/9711200') : resp(404, 'nf', u));
  try {
    await expect(ar5ivConverter.convert('hep-th/9711200', null, {})).rejects.toMatchObject({ reason: 'empty_result' });
  } finally { global.fetch = orig; }
});
