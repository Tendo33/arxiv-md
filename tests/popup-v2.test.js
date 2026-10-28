import fs from 'fs';
import path from 'path';
import { pageContext, recentTasks, taskForPaper } from '../src/ui/popup/page-context';
import { createTaskRow, setTaskListLanguage } from '../src/ui/popup/task-list';
import { translations } from '../src/config/locales';
import { onNextOutcome, notifyOutcome } from '../src/content/progress-ui';

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

describe('C-2 page-context', () => {
  test('abs / pdf / html 页解析出 id 与标题', () => {
    expect(pageContext({ url: 'https://arxiv.org/abs/1706.03762v7', title: '[1706.03762v7] Attention Is All You Need' }))
      .toMatchObject({ supported: true, kind: 'abs', arxivId: '1706.03762v7', title: 'Attention Is All You Need', loading: false });
    expect(pageContext({ url: 'https://arxiv.org/pdf/2401.00001.pdf', title: '2401.00001.pdf' }))
      .toMatchObject({ kind: 'pdf', arxivId: '2401.00001', title: 'arXiv:2401.00001' });
    expect(pageContext({ url: 'https://arxiv.org/html/2401.00001v2/', title: 'X', status: 'loading' }))
      .toMatchObject({ kind: 'html', arxivId: '2401.00001v2', loading: true });
    expect(pageContext({ url: 'https://arxiv.org/abs/hep-th/9901001?context=x', title: '' }).arxivId).toBe('hep-th/9901001');
  });
  test('非 arXiv 论文页 → 不支持', () => {
    for (const url of ['https://arxiv.org/list/cs.AI/recent', 'https://example.com/abs/1', '', undefined]) {
      expect(pageContext({ url }).supported).toBe(false);
    }
    expect(pageContext(null).supported).toBe(false);
  });
  test('最近任务倒序取 3 条；按论文找任务忽略版本号', () => {
    const ts = [1, 5, 3, 4].map((c) => ({ id: `t${c}`, createdAt: c, paperInfo: { arxivId: c === 3 ? '2401.1v2' : 'x' } }));
    expect(recentTasks(ts).map((x) => x.id)).toEqual(['t5', 't4', 't3']);
    expect(taskForPaper(ts, '2401.1').id).toBe('t3');
    expect(taskForPaper(ts, null)).toBeNull();
  });
});

describe('C-2 紧凑任务行', () => {
  test.each(['zh', 'en'])('%s：完成/失败/进行中各自的徽标与动作，标题转义', (lang) => {
    setTaskListLanguage(lang);
    const tr = translations[lang];
    const done = createTaskRow({ id: 'a', status: 'completed', zipUrl: 'https://z/a.zip', createdAt: Date.now(), paperInfo: { title: '<b>T</b>' } });
    expect(done).toContain('badge ok');
    expect(done).toContain('data-action="download"');
    expect(done).toContain('&lt;b&gt;T');
    expect(done).toContain(tr.popup_status_completed);
    const fail = createTaskRow({ id: 'b', status: 'failed', createdAt: Date.now(), paperInfo: { arxivId: '1' }, error: 'boom' });
    expect(fail).toContain('badge err');
    expect(fail).toContain('data-action="retry"');
    const run = createTaskRow({ id: 'c', status: 'processing', progress: 42, createdAt: Date.now(), paperInfo: {} });
    expect(run).toContain('badge run');
    expect(run).toContain('42%');
  });
});

describe('C-2 文案与结构', () => {
  test('新 key 中英齐全，英文无中文', () => {
    const keys = Object.keys(translations.zh).filter((k) => /^popup_(badge|btn_(export|mineru|pdf)|err_|recent|dis_|saved|unsupported|shortcut|ctx)/.test(k));
    expect(keys.length).toBeGreaterThan(20);
    for (const k of keys) {
      expect(translations.en[k]).toBeTruthy();
      expect(translations.en[k]).not.toMatch(/[\u4e00-\u9fff]/);
    }
  });
  test('popup.html 先引 ui-v2.css 再引 popup.css，三个动作与最近区存在，统计区已移出', () => {
    const html = read('src/ui/popup/popup.html');
    expect(html.indexOf('ui-v2.css')).toBeGreaterThan(-1);
    expect(html.indexOf('ui-v2.css')).toBeLessThan(html.indexOf('popup.css'));
    for (const id of ['exportBtn', 'mineruBtn', 'pdfBtn', 'ctxCard', 'unsupported', 'alertErr', 'alertOk', 'recent', 'taskList', 'confirmOverlay']) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).not.toContain('statsTotal');
  });
});

describe('C-2 内容脚本回执', () => {
  test('onNextOutcome 只收到一次结果', () => {
    const cb = jest.fn();
    onNextOutcome(cb);
    notifyOutcome({ ok: true, filename: 'a.md' });
    notifyOutcome({ ok: false, error: 'x' });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({ ok: true, filename: 'a.md' });
  });
  test('转换器：forceMineru 且有 token 时走 MinerU', () => {
    expect(read('src/core/converter/index.js')).toMatch(/paperInfo\.forceMineru\)\s*&&\s*mineruToken/);
    const idx = read('src/content/index.js');
    expect(idx).toMatch(/onNextOutcome\(sendResponse\)/);
    expect(idx).toMatch(/forceMineru\s*=\s*true/);
  });
});
