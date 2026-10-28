/**
 * AF3-01 完整性保护：导出明显少于页面时标记「可能不完整」，徽标不显示 ✓。
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { parseHTML, Node } from 'linkedom';
import ar5ivConverter from '../src/core/converter/ar5iv-converter';
import { convertAr5ivDocument } from '../src/content/markdown-convert';
import { measureSource, measureMarkdown, assessIntegrity } from '../src/core/converter/integrity';
import { createActionBadge, conversionBadgeState, BADGE } from '../src/background/action-badge';
import { listPaperFixtures, FIXTURE_DIR } from './helpers/paper-fixtures';
import { translations } from '../src/config/locales';

function exportAndAssess(html) {
  global.Node = Node;
  const cleaned = ar5ivConverter.cleanHtml(html);
  const { document } = parseHTML(`<!doctype html><html><body>${cleaned.content}</body></html>`);
  const md = convertAr5ivDocument(document, { assetPageUrl: 'https://arxiv.org/html/x' });
  return assessIntegrity(cleaned.integritySource, measureMarkdown(md));
}

const article = () => zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'fixtures', 'af3', '2402.19173-article.html.gz'))).toString('utf8');

describe('assessIntegrity', () => {
  test('截断：章节或正文明显少于页面 → 不完整', () => {
    expect(assessIntegrity({ headings: 58, chars: 100000 }, { headings: 17, chars: 47000 }).complete).toBe(false);
    expect(assessIntegrity({ headings: 10, chars: 50000 }, { headings: 10, chars: 20000 }).complete).toBe(false);
    expect(assessIntegrity({ headings: 10, chars: 50000 }, { headings: 7, chars: 60000 }).complete).toBe(false);
  });
  test('短页面或缺统计时不判断（不误报）', () => {
    expect(assessIntegrity({ headings: 2, chars: 500 }, { headings: 0, chars: 10 }).complete).toBe(true);
    expect(assessIntegrity(null, { headings: 0, chars: 0 }).complete).toBe(true);
  });
  test('measureMarkdown 不把代码块里的 # 和 front matter 算进去', () => {
    const m = measureMarkdown('---\ntitle: a\n---\n\n## 1 A\n\n```python\n## not heading\n```\n\n### 1.1 B\n\ntext $x$');
    expect(m.headings).toBe(2);
  });
});

describe('真实页面', () => {
  test('2402.19173 整篇：修复后完整', () => {
    const r = exportAndAssess(article());
    expect(r.complete).toBe(true);
    expect(r.exported.headings).toBeGreaterThanOrEqual(r.source.headings);
  });

  test('2402.19173 模拟旧行为（article 被截断）：判定不完整', () => {
    const html = article();
    global.Node = Node;
    const { document } = parseHTML(html);
    const source = measureSource(document);
    // 旧行为：只导出到 §4 的列表为止
    const cut = html.slice(0, html.indexOf('id="S4.I1.i2.I1.2"'));
    const { document: cutDoc } = parseHTML(`${cut}</article>`);
    const truncated = cutDoc.querySelector('article');
    const { document: d2 } = parseHTML(`<!doctype html><html><body>${truncated.innerHTML}</body></html>`);
    const md = convertAr5ivDocument(d2, { assetPageUrl: 'https://arxiv.org/html/2402.19173' });
    expect(assessIntegrity(source, measureMarkdown(md)).complete).toBe(false);
  });

  test.each(listPaperFixtures())('现有夹具 %s 不误报', (file) => {
    expect(exportAndAssess(fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf8')).complete).toBe(true);
  });
});

describe('徽标与文案', () => {
  test('不完整 → warning 徽标（不是 ✓），失败仍是 error', () => {
    expect(conversionBadgeState({ success: true, incomplete: true })).toBe('warning');
    expect(conversionBadgeState({ success: true })).toBe('success');
    expect(conversionBadgeState({ success: false })).toBe('error');
    expect(BADGE.warning.text).not.toBe(BADGE.success.text);
    const calls = [];
    const api = { setBadgeText: (o) => calls.push(o.text), setBadgeBackgroundColor: () => {} };
    const badge = createActionBadge(api, { setTimeout: () => 1, clearTimeout: () => {} });
    badge.shortcutStarted(1);
    badge.finish(1, 'warning');
    expect(calls[calls.length - 1]).toBe(BADGE.warning.text);
  });
  test('中英文案都有占位符', () => {
    Object.values(translations).forEach((l) => {
      expect(l.content_progress_incomplete).toBeTruthy();
      expect(l.content_result_incomplete).toMatch(/\{expected\}[\s\S]*\{actual\}/);
    });
  });
});
