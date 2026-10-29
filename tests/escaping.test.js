import { parseHTML, Node } from 'linkedom';
import { createTaskRow } from '../src/ui/popup/task-list';
import { preprocessAr5ivElements } from '../src/content/ar5iv-elements';

describe('escaping', () => {
  beforeAll(() => { global.Node = Node; });

  test('task row keeps remote title and error as text (DOM API, no HTML parsing)', () => {
    const { document } = parseHTML('<html><body></body></html>');
    const row = createTaskRow({
      id: 't1', status: 'failed', progress: 0, createdAt: Date.now(),
      paperInfo: { title: '<img src=x onerror=alert(1)>', arxivId: '1234.5678' },
      error: '<b>boom</b>',
    }, document);
    expect(row.querySelector('img')).toBeNull();
    expect(row.querySelector('.row-err b')).toBeNull();
    expect(row.querySelector('.n').textContent).toBe('<img src=x onerror=alert(1)>');
    expect(row.querySelector('.row-err').textContent).toBe('<b>boom</b>');
    // 标题原文也放进 title 属性（属性值里的 < 不会被当成标签）；文本节点序列化时被转义
    const html = row.outerHTML;
    expect(html).not.toContain('<b>boom');
    expect(html).toContain('>&lt;img src=x onerror=alert(1)&gt;</span>');
  });

  test('code listings keep angle-bracket text', () => {
    const { document } = parseHTML('<html><body><pre class="ltx_code">#include &lt;stdio.h&gt;</pre></body></html>');
    preprocessAr5ivElements(document);
    expect(document.querySelector('pre code').textContent).toBe('#include <stdio.h>');
  });
});
