import { parseHTML } from 'linkedom';
import { formatTimeAgo } from '../src/utils/time-ago';
import { renderTaskList } from '../src/ui/popup/task-list';

describe('A2-02：无效时间不抛错', () => {
  test.each([undefined, null, NaN, 'abc', Infinity, {}])('createdAt=%p 返回「—」', (v) => {
    expect(() => formatTimeAgo(v, 'zh', '刚刚')).not.toThrow();
    expect(formatTimeAgo(v, 'zh', '刚刚')).toBe('—');
    expect(formatTimeAgo(v, 'en', 'Just now')).toBe('—');
  });

  test('单条任务缺 createdAt / 数据损坏时，其余任务照常渲染', () => {
    const { document } = parseHTML('<html><body><div id="taskList"></div><div id="emptyState"></div></body></html>');
    global.document = document;
    const ok = (id, t) => ({ id, status: 'completed', progress: 100, paperInfo: { arxivId: '1706.03762', title: `T${id}` }, createdAt: t });
    renderTaskList([
      ok('a', Date.now() - 120000),
      { id: 'b', status: 'completed', progress: 100, paperInfo: { arxivId: '1312.6114', title: 'NoTime' } },
      { id: 'c', status: 'completed', createdAt: Date.now() }, // 缺 paperInfo
      ok('d', Date.now() - 3600000),
    ]);
    const cards = document.querySelectorAll('.task-card');
    expect([...cards].map((c) => c.dataset.taskId)).toEqual(['a', 'd', 'b']);
    expect(document.querySelector('[data-task-id="b"] .meta-time').textContent).toBe('—');
    delete global.document;
  });
});
