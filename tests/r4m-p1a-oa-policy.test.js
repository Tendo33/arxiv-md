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
    expect(doc).toContain('All papers on arXiv are treated as open access.');
    expect(doc).toContain('with no confirmation prompt');
    expect(doc).not.toContain('**Open-access check.**');
  });
});
