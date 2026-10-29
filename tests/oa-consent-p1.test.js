// 审查 P1-1：默认只解析 OA PDF；非 OA 或判断不了 → 先确认，确认后才发送
import fs from 'fs';
import path from 'path';
import { isOpenAccessPdf, uploadAllowed } from '../src/background/oa-gate';
import { isExtensionPageSender } from '../src/background/message-guards';
import { confirmSendFlow } from '../src/ui/popup/send-consent';
import { translations } from '../src/config/locales';
import { makeHarness, fakeProvider } from './helpers/runner-harness';

const task = (pdfUrl, extra = {}) => ({ paperInfo: { arxivId: '2401.00001', pdfUrl }, ...extra });
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

describe('OA 判定', () => {
  test.each([
    'https://arxiv.org/pdf/2401.00001.pdf',
    'https://arxiv.org/pdf/2401.00001v3',
    'https://export.arxiv.org/pdf/hep-th/9901001v1.pdf',
    undefined, // 没有 pdfUrl → 按 arXiv ID 拼 arXiv 地址
  ])('arXiv 托管的 PDF 是 OA：%s', (u) => expect(isOpenAccessPdf(task(u))).toBe(true));

  test.each([
    'https://example.com/paper.pdf',
    'http://arxiv.org/pdf/2401.00001.pdf',
    'https://arxiv.org.evil.com/pdf/2401.00001.pdf',
    'https://arxiv.org/abs/2401.00001',
    'not a url',
  ])('其他来源 / 判断不了 → 非 OA：%s', (u) => expect(isOpenAccessPdf(task(u))).toBe(false));

  test('缺 paperInfo 或任务为空 → 非 OA', () => {
    expect(isOpenAccessPdf({})).toBe(false);
    expect(isOpenAccessPdf(null)).toBe(false);
    expect(uploadAllowed({ paperInfo: { pdfUrl: 'https://x.invalid/a.pdf' }, uploadConsent: true })).toBe(true);
  });
});

describe('后台统一入口 parse-task-runner', () => {
  test('OA 直接发送', async () => {
    const p = fakeProvider();
    const h = makeHarness({ providers: [p], tasks: [{ id: 't1' }] });
    await h.runner.process('t1');
    expect(p.submit).toHaveBeenCalledTimes(1);
  });

  test('非 OA：不发任何请求（连 Key 都不读），状态为待确认并发通知', async () => {
    const p = fakeProvider();
    const h = makeHarness({ providers: [p], tasks: [{ id: 't1', paperInfo: { arxivId: 'x', pdfUrl: 'https://pub.invalid/a.pdf' } }] });
    const r = await h.runner.process('t1');
    expect(r).toEqual({ needsConsent: true });
    expect(p.submit).not.toHaveBeenCalled();
    expect(h.deps.storage.getProviderKey).not.toHaveBeenCalled();
    expect(h.store.get('t1').status).toBe('awaiting_consent');
    expect(h.deps.notify).toHaveBeenCalledWith(expect.anything(), 'consent', '', expect.anything());
  });

  test('待确认任务不会被 resume 续跑，重试同样会再停下', async () => {
    const p = fakeProvider();
    const h = makeHarness({ providers: [p], tasks: [{ id: 't1', status: 'awaiting_consent', paperInfo: { arxivId: 'x', pdfUrl: 'https://pub.invalid/a.pdf' } }] });
    expect(await h.runner.resumeActiveTasks()).toEqual([]);
    h.store.set('t1', { ...h.store.get('t1'), status: 'pending' }); // 模拟 RETRY_TASK
    await h.runner.process('t1');
    expect(p.submit).not.toHaveBeenCalled();
  });

  test('确认后才发送，且只放行这一个任务', async () => {
    const p = fakeProvider();
    const pi = { arxivId: 'x', pdfUrl: 'https://pub.invalid/a.pdf' };
    const h = makeHarness({ providers: [p], tasks: [{ id: 't1', paperInfo: pi }, { id: 't2', paperInfo: pi }] });
    await h.runner.process('t1');
    await h.runner.process('t2');
    const r = await h.runner.confirmSend('t1');
    await r.done;
    expect(p.submit).toHaveBeenCalledTimes(1);
    expect(h.store.get('t1')).toMatchObject({ status: 'completed', uploadConsent: true });
    expect(h.store.get('t2').status).toBe('awaiting_consent');
  });

  test('不在待确认状态的任务不能被“确认”', async () => {
    const h = makeHarness({ tasks: [{ id: 't1', status: 'completed' }] });
    expect(await h.runner.confirmSend('t1')).toEqual({ skipped: 'not-awaiting' });
  });
});

describe('各入口都绕不过', () => {
  test('只有 parse-task-runner 调 provider.submit（popup、右键菜单、悬浮按钮、快捷键都经后台消息进入它）', () => {
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
    const hits = walk(path.join(__dirname, '../src')).filter((f) => f.endsWith('.js') && /\.submit\(/.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(path.join(__dirname, '..'), f)).sort();
    // mineru-client.js 是旧兼容壳，只有 downloadZip 还被引用（下一条断言保证）
    expect(hits).toEqual(['src/background/parse-task-runner.js', 'src/core/converter/mineru-client.js']);
  });

  test('没有任何模块引用旧 MinerUClient 的 createTask/convert', () => {
    const imports = read('src/background/mineru-task-runner.js').match(/import[^;]*mineru-client'/g);
    expect(imports).toEqual(["import { downloadZip } from '@core/converter/mineru-client'"]);
  });

  test('所有建任务的消息都交给 runner.process', () => {
    const idx = read('src/background/index.js');
    for (const type of ['START_PDF_TASK', 'START_MINERU_TASK', 'START_MINERU_TASK_FORCE', 'RETRY_TASK']) expect(idx).toContain(`case '${type}'`);
    expect(idx).toMatch(/processMinerUTaskInBackground\(task\.id\)/);
    expect(read('src/background/mineru-task-runner.js')).toMatch(/return parseTaskRunner\.process\(taskId\)/);
  });

  test('确认消息只接受扩展页面（content script 带 tab，拒绝）', () => {
    const id = 'abc';
    expect(isExtensionPageSender({ id, url: `chrome-extension://${id}/popup.html` }, id)).toBe(true);
    expect(isExtensionPageSender({ id, url: 'https://arxiv.org/abs/1', tab: { id: 1 } }, id)).toBe(false);
    expect(isExtensionPageSender({ id, url: `chrome-extension://${id}/popup.html`, tab: { id: 1 } }, id)).toBe(false);
    expect(isExtensionPageSender({ id: 'other', url: 'chrome-extension://other/x' }, id)).toBe(false);
    expect(read('src/background/index.js')).toMatch(/case 'CONFIRM_PDF_SEND':\s*\n[^\n]*\n\s*if \(!isExtensionPageSender/);
  });
});

describe('弹窗确认', () => {
  const task = { id: 't1', provider: 'paddleocr', paperInfo: { title: 'Some Paper', arxivId: '2401.00001' } };
  test.each(['zh', 'en'])('%s：取消 → 不发消息；确认 → 发 CONFIRM_PDF_SEND', async (lang) => {
    const tr = translations[lang];
    const sendMessage = jest.fn(async () => ({ success: true }));
    const no = jest.fn(async () => false);
    expect(await confirmSendFlow(task, 'paddleocr', { showConfirm: no, sendMessage, tr })).toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
    const [msg, opts] = no.mock.calls[0];
    expect(msg).toContain('PaddleOCR');
    expect(msg).toContain('Some Paper');
    expect(opts).toEqual({ title: tr.popup_confirm_send_title.replace('{provider}', 'PaddleOCR'), okLabel: tr.popup_btn_send, tone: 'brand' });
    const yes = jest.fn(async () => true);
    expect(await confirmSendFlow(task, 'paddleocr', { showConfirm: yes, sendMessage, tr })).toBe(true);
    expect(sendMessage).toHaveBeenCalledWith({ type: 'CONFIRM_PDF_SEND', taskId: 't1' });
  });

  test('协调人定稿文案（复审 P3-A / 设计验收 M10）', () => {
    const { zh, en } = translations;
    expect(zh.popup_confirm_send_title).toBe('发送给 {provider} 解析？');
    expect(zh.popup_confirm_send).toBe('《{title}》的 PDF 链接会发送给 {provider}。该链接不在 arXiv 上，发送前需要你确认。');
    expect(zh.popup_btn_send).toBe('发送并解析');
    expect(zh.popup_action_consent).toBe('确认解析');
    expect(en.popup_confirm_send_title).toBe('Send to {provider} for parsing?');
    expect(en.popup_confirm_send).toMatch(/PDF link for “\{title\}” will be sent to \{provider\}/);
    expect(en.popup_btn_send).toBe('Send & parse');
    for (const k of ['popup_status_awaiting', 'popup_action_consent', 'popup_confirm_send', 'popup_confirm_send_title', 'popup_btn_send']) {
      expect(zh[k]).toBeTruthy(); expect(en[k]).toBeTruthy();
    }
    expect(zh).not.toHaveProperty('popup_confirm_upload');
    expect(zh).not.toHaveProperty('popup_btn_upload');
  });

  test('全仓（界面、通知、消息名）不再把发送链接说成上传', () => {
    const files = ['src/config/locales.js', 'src/background/mineru-task-runner.js', 'src/background/index.js', 'src/background/message-guards.js', 'src/background/parse-task-runner.js', 'src/ui/popup/popup.js', 'src/ui/popup/send-consent.js', 'src/ui/popup/confirm-dialog.js', 'src/ui/popup/popup.html'];
    for (const f of files) {
      const src = read(f);
      expect([f, /上传|CONFIRM_PDF_UPLOAD|confirmPdfUpload|confirmUpload\b|Uploading|Continue upload|Confirm upload/.test(src)]).toEqual([f, false]);
    }
    expect(read('PRIVACY.md')).toContain('"Send & parse"');
  });
});

describe('任务行', () => {
  test('待确认任务显示「待确认」和「确认解析」按钮', () => {
    const { createTaskRow, setTaskListLanguage } = require('../src/ui/popup/task-list');
    setTaskListLanguage('zh');
    const html = createTaskRow({ id: 't1', status: 'awaiting_consent', provider: 'paddleocr', paperInfo: { title: 'T' }, createdAt: Date.now() });
    expect(html).toContain('待确认');
    expect(html).toMatch(/data-action="consent" data-task-id="t1" data-provider="paddleocr">确认解析</);
  });
});
