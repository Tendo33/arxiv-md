import fs from 'fs';
import path from 'path';
import { isOpenAccessPdf, uploadAllowed } from '../src/background/oa-gate';

const task = (pdfUrl, extra = {}) => ({ paperInfo: { arxivId: '2401.00001', pdfUrl }, ...extra });

describe('R4 合入 P1-A 方案 2：arXiv 上的论文一律视为 OA', () => {
  test.each([
    'https://arxiv.org/pdf/2401.00001',
    'https://arxiv.org/pdf/2401.00001v3',
    'https://export.arxiv.org/pdf/2401.00001.pdf',
    'https://arxiv.org/pdf/hep-th/9901001',
  ])('%s → 不看 license，直接放行', (u) => {
    // 默认 arXiv 许可或任意 license 字段都不影响判定
    for (const license of [undefined, 'http://arxiv.org/licenses/nonexclusive-distrib/1.0/', 'all-rights-reserved']) {
      const tk = task(u);
      if (license) tk.paperInfo.license = license;
      expect(isOpenAccessPdf(tk)).toBe(true);
      expect(uploadAllowed(tk)).toBe(true);
    }
  });

  test('非 arXiv 链接仍需确认', () => {
    expect(uploadAllowed(task('https://example.com/paper.pdf'))).toBe(false);
    expect(uploadAllowed(task('https://example.com/paper.pdf', { uploadConsent: true }))).toBe(true);
  });

  test('PRIVACY.md 用「arXiv 论文一律视为 OA、不弹确认」的措辞', () => {
    const doc = fs.readFileSync(path.join(__dirname, '../PRIVACY.md'), 'utf8');
    expect(doc).toContain('All papers on arXiv are treated as open access; the extension does not check each paper\'s individual license.');
    expect(doc).toContain('with no confirmation prompt');
    expect(doc).not.toContain('**Open-access check.**');
  });
});

describe('PRIVACY「Open access」段的每条说法都对得上代码（保留 awaiting 兜底）', () => {
  const root = path.join(__dirname, '..');
  const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
  const doc = read('PRIVACY.md');

  test('文案：arXiv 直接解析；其他来源先确认；只对这个任务有效；所有入口同一道检查', () => {
    expect(doc).toContain('nothing is sent until you confirm: the task waits as "Awaiting"');
    expect(doc).toContain('after you choose "Send & parse" in the popup');
    expect(doc).toContain('Your confirmation applies to that task only (retrying the same task does not ask again) and is not remembered for other PDFs.');
    expect(doc).toContain('Every way of starting a parse (popup, right-click menu, floating button and keyboard shortcut) goes through this same check before anything is sent');
  });

  test('「所有入口同一道检查」属实：src 里只有 parse-task-runner 调 provider.submit，且在 uploadAllowed 之后', () => {
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
    const callers = walk(path.join(root, 'src')).filter((f) => f.endsWith('.js') && /provider\.submit\(/.test(fs.readFileSync(f, 'utf8')));
    expect(callers.map((f) => path.relative(root, f))).toEqual(['src/background/parse-task-runner.js']);
    const runner = read('src/background/parse-task-runner.js');
    const proc = runner.slice(runner.indexOf('async function process('));
    expect(proc.indexOf('if (!uploadAllowed(task))')).toBeGreaterThan(-1);
    expect(proc.indexOf('if (!uploadAllowed(task))')).toBeLessThan(proc.indexOf('runAsync(task') === -1 ? Infinity : proc.indexOf('runAsync(task'));
  });

  test('确认弹窗按钮就是 "Send & parse"；确认只对单个任务生效，重试不清掉', () => {
    expect(read('src/config/locales.js')).toContain("popup_btn_send: 'Send & parse'");
    const runner = read('src/background/parse-task-runner.js');
    expect(runner).toMatch(/updateTask\(taskId, \{ uploadConsent: true, status: TASK_STATUS\.PENDING \}\)/);
    const idx = read('src/background/index.js');
    const retry = idx.slice(idx.indexOf('async function handleRetryTask'), idx.indexOf('async function handleRetryTask') + 1200);
    expect(retry).not.toMatch(/uploadConsent/);
  });

  test('popup 之外触发、需要确认时会发通知', () => {
    expect(read('src/background/parse-task-runner.js')).toMatch(/AWAITING_CONSENT \}\);\s*notify\(task, 'consent'/);
  });
});

