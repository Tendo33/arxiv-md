// release-polish AR-04（web-ext UNSAFE_VAR_ASSIGNMENT）：popup 任务行带远端数据，必须用 DOM API 构建
import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { createTaskRow, renderTaskRows, setTaskListLanguage } from '../src/ui/popup/task-list';

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const code = (s) => s.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

describe('AR-04 popup 不再给 innerHTML 赋值', () => {
  test.each(['src/ui/popup/task-list.js', 'src/ui/popup/popup.js'])('%s', (f) => {
    expect(code(read(f))).not.toMatch(/\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML/);
  });
  test('旧的字符串卡片接口已删除', () => {
    const src = read('src/ui/popup/task-list.js');
    for (const name of ['createTaskCard', 'renderTaskList', 'getTaskActions', 'getStatusDisplay', 'escapeHtml']) expect(src).not.toContain(`function ${name}`);
  });
});

describe('AR-04 createTaskRow 返回节点', () => {
  const { document } = parseHTML('<html><body><div id="taskList"><p>old</p></div></body></html>');
  test('失败行：标题 / 错误是文本节点，动作按钮带 data-*', () => {
    setTaskListLanguage('en');
    const row = createTaskRow({ id: 'a"b', status: 'failed', provider: 'paddleocr', error: '<i>x</i>', paperInfo: { title: '<script>1</script>' }, createdAt: Date.now() }, document);
    expect(row.nodeType).toBe(1);
    expect(row.dataset.taskId).toBe('a"b');
    expect(row.querySelector('script')).toBeNull();
    expect(row.querySelector('.n').textContent).toBe('<script>1</script>');
    expect(row.querySelector('.row-err').lastChild.textContent).toBe('<i>x</i>'); // rp2c：首个子节点是 aria-hidden 后端前缀
    expect(row.querySelector('[data-action=retry]').dataset.taskId).toBe('a"b');
  });
  test('完成行：下载按钮带 svg 图标（SVG 命名空间）和 .lbl', () => {
    const row = createTaskRow({ id: 'c', status: 'completed', zipUrl: 'https://z/a.zip?x="1"', paperInfo: { title: 'T' }, createdAt: Date.now() }, document);
    const btn = row.querySelector('.btn-dl');
    expect(btn.dataset.url).toBe('https://z/a.zip?x="1"');
    expect(btn.querySelector('svg path').getAttribute('d')).toBe('M12 3v12m0 0 4-4m-4 4-4-4M5 21h14');
    expect(btn.querySelector('.lbl').textContent).toBe(' Download');
  });
  test('renderTaskRows 用 replaceChildren 替换旧内容', () => {
    const list = document.getElementById('taskList');
    renderTaskRows(list, [{ id: 'r1', status: 'processing', progress: 7, paperInfo: {}, createdAt: Date.now() }], document);
    expect(list.querySelector('p')).toBeNull();
    expect(list.querySelectorAll('.row').length).toBe(1);
    expect(list.querySelector('.pct').textContent).toBe('7%');
  });
});
