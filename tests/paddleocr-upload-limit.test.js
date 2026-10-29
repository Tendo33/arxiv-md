// 主管 17:17 第 3 条：超 50 MB 的 arXiv PDF 上传前拦下，提示改用 MinerU；没有 Content-Length 时边读边数，超了就中止
jest.mock('@utils/storage', () => ({ __esModule: true, default: { getLanguage: jest.fn(async () => 'zh') } }));
import { downloadPdf, PADDLEOCR_MAX_UPLOAD_BYTES } from '@pdf-core/providers/paddleocr';
import { failureText } from '../src/background/task-notification-text';
import { shortErrorText } from '../src/ui/popup/task-error-text';
import { translations } from '@config/locales';

const URL_ = 'https://arxiv.org/pdf/2401.00001';
const CHUNK = 4 * 1024 * 1024;

function streamResponse(totalBytes, headers = {}) {
  let sent = 0; let pulls = 0; let canceled = false;
  const body = {
    getReader: () => ({
      read: async () => {
        if (sent >= totalBytes) return { done: true };
        pulls += 1; const n = Math.min(CHUNK, totalBytes - sent); sent += n;
        const v = new Uint8Array(n); if (pulls === 1) v.set([0x25, 0x50, 0x44, 0x46]);
        return { done: false, value: v };
      },
      cancel: async () => { canceled = true; },
    }),
  };
  const res = { ok: true, status: 200, body, headers: { get: (k) => headers[k.toLowerCase()] ?? null },
    arrayBuffer: async () => { throw new Error('must not buffer whole body'); } };
  return { res, stats: () => ({ sent, canceled }) };
}

describe('PaddleOCR 50 MB upload limit', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  test('Content-Length > 50 MB → TOO_LARGE/upload_limit without reading the body', async () => {
    const { res, stats } = streamResponse(PADDLEOCR_MAX_UPLOAD_BYTES + 1, { 'content-length': String(PADDLEOCR_MAX_UPLOAD_BYTES + 1) });
    global.fetch = jest.fn(async () => res);
    await expect(downloadPdf(URL_)).rejects.toMatchObject({ code: 'TOO_LARGE', reason: 'upload_limit' });
    expect(stats().sent).toBe(0);
  });

  test('no Content-Length: stops reading just past 50 MB and cancels the stream', async () => {
    const { res, stats } = streamResponse(200 * 1024 * 1024);
    global.fetch = jest.fn(async () => res);
    await expect(downloadPdf(URL_)).rejects.toMatchObject({ code: 'TOO_LARGE', reason: 'upload_limit' });
    expect(stats().canceled).toBe(true);
    expect(stats().sent).toBeLessThanOrEqual(PADDLEOCR_MAX_UPLOAD_BYTES + CHUNK);
  });

  test('exactly 50 MB streamed is accepted', async () => {
    const { res } = streamResponse(PADDLEOCR_MAX_UPLOAD_BYTES);
    global.fetch = jest.fn(async () => res);
    const blob = await downloadPdf(URL_);
    expect(blob.size).toBe(PADDLEOCR_MAX_UPLOAD_BYTES);
  });

  test.each(['en', 'zh'])('%s copy: says 50 MB, nothing sent, suggests MinerU', (lang) => {
    const err = { code: 'TOO_LARGE', reason: 'upload_limit' };
    const long = failureText(err, 'PaddleOCR', lang);
    const short = shortErrorText(err, translations[lang]);
    for (const s of [long, short]) { expect(s).toMatch(/50 MB/); expect(s).not.toMatch(/\{\w+\}/); }
    expect(long).toMatch(/MinerU/); expect(short).not.toMatch(/MinerU|PaddleOCR/);
    expect(long).toMatch(/PaddleOCR/);
  });
});
