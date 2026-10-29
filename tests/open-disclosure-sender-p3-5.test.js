/** P3-5：OPEN_DISCLOSURE 核对发送方和后端 id */
import fs from 'fs';
import path from 'path';
import { handleOpenDisclosure } from '../src/background/message-guards';

const ID = 'extid';
const arxiv = { id: ID, url: 'https://arxiv.org/abs/2401.00001', tab: { id: 1, url: 'https://arxiv.org/abs/2401.00001' } };

test('arxiv.org 内容脚本 + 已知后端 → 打开', () => {
  const open = jest.fn();
  expect(handleOpenDisclosure({ provider: 'paddleocr' }, arxiv, ID, open)).toBe(true);
  expect(open).toHaveBeenCalledWith('paddleocr');
});
test('扩展页面 → 打开', () => {
  const open = jest.fn();
  expect(handleOpenDisclosure({ provider: 'mineru' }, { id: ID, url: `chrome-extension://${ID}/popup.html` }, ID, open)).toBe(true);
});
test.each([
  ['别的扩展', { ...arxiv, id: 'other' }],
  ['非 arxiv 页面', { id: ID, url: 'https://evil.example/', tab: { id: 2, url: 'https://evil.example/' } }],
  ['http arxiv', { id: ID, url: 'http://arxiv.org/abs/1', tab: { id: 3 } }],
  ['没有 sender', null],
])('%s → 拒绝', (_, sender) => {
  const open = jest.fn();
  expect(handleOpenDisclosure({ provider: 'paddleocr' }, sender, ID, open)).toBe(false);
  expect(open).not.toHaveBeenCalled();
});
test('未知后端 → 拒绝', () => {
  const open = jest.fn();
  expect(handleOpenDisclosure({ provider: 'x' }, arxiv, ID, open)).toBe(false);
  expect(open).not.toHaveBeenCalled();
});
test('background 的 OPEN_DISCLOSURE 分支走 handleOpenDisclosure', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/background/index.js'), 'utf8');
  const i = src.indexOf("case 'OPEN_DISCLOSURE'");
  expect(src.slice(i, i + 400)).toMatch(/handleOpenDisclosure\(message, sender,/);
});
