// release-polish AR-07：快捷键命令描述走 __MSG_，中英各有文案
import manifest from '../src/manifest.json';
import en from '../src/_locales/en/messages.json';
import zh from '../src/_locales/zh_CN/messages.json';

test('commands 的 description 全部是 __MSG_ 占位', () => {
  const cmds = Object.values(manifest.commands);
  expect(cmds.length).toBeGreaterThan(0);
  cmds.forEach((c) => expect(c.description).toMatch(/^__MSG_\w+__$/));
});

test('convert-current-paper 中英文案', () => {
  expect(manifest.commands['convert-current-paper'].description).toBe('__MSG_cmdConvertDescription__');
  expect(en.cmdConvertDescription.message).toBe('Convert the current arXiv paper to Markdown');
  expect(zh.cmdConvertDescription.message).toBe('把当前 arXiv 论文转换为 Markdown');
});
