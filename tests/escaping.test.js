import { parseHTML, Node } from 'linkedom';
import { createTaskCard } from '../src/ui/popup/task-list';
import { preprocessAr5ivElements } from '../src/content/ar5iv-elements';

describe('escaping', () => {
  beforeAll(() => { global.Node = Node; });

  test('task card escapes remote title and error text', () => {
    const html = createTaskCard({
      id: 't1', status: 'failed', progress: 0, createdAt: Date.now(),
      paperInfo: { title: '<img src=x onerror=alert(1)>', arxivId: '1234.5678' },
      error: '<b>boom</b>',
    });
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>boom');
    expect(html).toContain('&lt;img');
  });

  test('code listings keep angle-bracket text', () => {
    const { document } = parseHTML('<html><body><pre class="ltx_code">#include &lt;stdio.h&gt;</pre></body></html>');
    preprocessAr5ivElements(document);
    expect(document.querySelector('pre code').textContent).toBe('#include <stdio.h>');
  });
});
