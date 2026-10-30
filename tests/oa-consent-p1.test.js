// 1.2.2（Simon 决定）：使用时零确认。非 OA / 非 arXiv 的 PDF 也不再停下等确认，有 Key 就直接解析；
// 旧版本留下的 awaiting_consent / awaiting_disclosure 任务在弹窗里显示「重试」。
import fs from 'fs';
import path from 'path';
import { translations } from '../src/config/locales';
import { makeHarness, fakeProvider } from './helpers/runner-harness';
import { parseHTML as __parseHTML } from 'linkedom';
// release-polish AR-04：createTaskRow 返回 DOM 节点，这里在 linkedom 文档里构建后取 outerHTML 再断言
const __doc = __parseHTML('<!doctype html><html><body></body></html>').document;
const rowHtml = (task) => require('../src/ui/popup/task-list').createTaskRow(task, __doc).outerHTML;

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const exists = (p) => fs.existsSync(path.join(__dirname, '..', p));

describe('后台统一入口 parse-task-runner：不再有确认关卡', () => {
  test('arXiv PDF 直接发送', async () => {
    const p = fakeProvider();
    const h = makeHarness({ providers: [p], tasks: [{ id: 't1' }] });
    await h.runner.process('t1');
    expect(p.submit).toHaveBeenCalledTimes(1);
  });

  test('非 arXiv PDF 同样直接发送，不进 awaiting_consent、不发确认通知', async () => {
    const p = fakeProvider();
    const h = makeHarness({ providers: [p], tasks: [{ id: 't1', paperInfo: { arxivId: 'x', pdfUrl: 'https://pub.invalid/a.pdf' } }] });
    const r = await h.runner.process('t1');
    expect(r).toEqual({ completed: true });
    expect(p.submit).toHaveBeenCalledTimes(1);
    expect(p.submit.mock.calls[0][0].url).toBe('https://pub.invalid/a.pdf');
    expect(h.store.get('t1').status).toBe('completed');
    const kinds = h.deps.notify.mock.calls.map((c) => c[1]);
    expect(kinds).not.toContain('consent');
    expect(kinds).not.toContain('disclosure');
  });

  test('没有 Key → 不发请求，任务失败为 AUTH_INVALID（仍是唯一的前置条件）', async () => {
    const p = fakeProvider();
    const h = makeHarness({ providers: [p], keys: {}, tasks: [{ id: 't1', paperInfo: { arxivId: 'x', pdfUrl: 'https://pub.invalid/a.pdf' } }] });
    await h.runner.process('t1');
    expect(p.submit).not.toHaveBeenCalled();
    expect(h.store.get('t1')).toMatchObject({ status: 'failed', errorCode: 'AUTH_INVALID' });
  });

  test('旧的待确认任务点重试（RETRY_TASK 置为 pending）后直接解析', async () => {
    const p = fakeProvider();
    const h = makeHarness({ providers: [p], tasks: [{ id: 't1', status: 'awaiting_consent', paperInfo: { arxivId: 'x', pdfUrl: 'https://pub.invalid/a.pdf' } }] });
    h.store.set('t1', { ...h.store.get('t1'), status: 'pending' });
    await h.runner.process('t1');
    expect(p.submit).toHaveBeenCalledTimes(1);
  });

  test('runner 不再暴露 confirmSend', () => {
    const h = makeHarness();
    expect(h.runner.confirmSend).toBeUndefined();
  });
});

describe('确认流程已整体移除', () => {
  test('模块、消息、依赖都不在了', () => {
    for (const f of ['src/background/oa-gate.js', 'src/ui/popup/send-consent.js', 'src/utils/disclosure-ack.js', 'src/ui/settings/disclosure.js']) expect([f, exists(f)]).toEqual([f, false]);
    const idx = read('src/background/index.js');
    expect(idx).not.toMatch(/CONFIRM_PDF_SEND|OPEN_DISCLOSURE|isDisclosureAcked|openDisclosureSettings/);
    const runner = read('src/background/parse-task-runner.js');
    expect(runner).not.toMatch(/uploadAllowed|isDisclosureAcked|AWAITING_CONSENT|AWAITING_DISCLOSURE|ensureProviderPermission/);
    expect(read('src/background/mineru-task-runner.js')).not.toMatch(/isDisclosureAcked|confirmPdfSend|permissions/);
    expect(read('src/core/converter/index.js')).not.toMatch(/isDisclosureAcked|disclosureNeeded|OPEN_DISCLOSURE/);
    expect(read('src/ui/popup/popup.js')).not.toMatch(/handleConsent|confirmSendFlow|'consent'|'disclose'|OPEN_DISCLOSURE/);
    expect(read('src/content/index.js')).not.toMatch(/isDisclosureNeeded|showNotice/);
  });

  test('确认相关文案 zh/en 同时删除', () => {
    for (const k of ['popup_action_consent', 'popup_confirm_send', 'popup_confirm_send_title', 'popup_btn_send', 'notify_task_consent_title', 'notify_task_consent_body',
      'pdf_disc_title', 'pdf_disc_ok', 'pdf_disc_cancel', 'pdf_disc_needed_title', 'pdf_disc_needed_body', 'task_disc_needed_body', 'popup_action_disclose']) {
      expect([k, k in translations.zh, k in translations.en]).toEqual([k, false, false]);
    }
    // 旧任务仍要显示「待确认」徽标
    expect(translations.zh.popup_status_awaiting).toBeTruthy();
    expect(translations.en.popup_status_awaiting).toBeTruthy();
  });
});

describe('各入口都经过同一个 runner', () => {
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
    expect(idx).toMatch(/startParseTask\(task\.id\)/); // P1-KA：入口经 startParseTask
    expect(idx).toMatch(/startParseTask\(taskId\)\s*\{\s*processMinerUTaskInBackground\(taskId\)/);
    expect(read('src/background/mineru-task-runner.js')).toMatch(/return parseTaskRunner\.process\(taskId\)/);
  });
});

describe('任务行', () => {
  test.each(['awaiting_consent', 'awaiting_disclosure'])('旧的 %s 任务：显示「待确认」和「重试」，没有确认 / 查看说明按钮', (status) => {
    const { setTaskListLanguage } = require('../src/ui/popup/task-list');
    setTaskListLanguage('zh');
    const html = rowHtml({ id: 't1', status, provider: 'paddleocr', paperInfo: { title: 'T' }, createdAt: Date.now() });
    expect(html).toContain('待确认');
    const buttons = html.match(/<button[^>]*>/g) || [];
    expect(buttons.some((b) => b.includes('data-action="retry"') && b.includes('data-task-id="t1"'))).toBe(true);
    expect(html).not.toContain('data-action="consent"');
    expect(html).not.toContain('data-action="disclose"');
    expect(html).not.toContain('row-note');
  });
});
