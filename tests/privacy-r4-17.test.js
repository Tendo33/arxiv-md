import fs from 'fs';
import path from 'path';

const doc = fs.readFileSync(path.join(__dirname, '../PRIVACY.md'), 'utf8');
const section = (h) => doc.split(h)[1].split(/\n### |\n## /)[0];

describe('R4-17 PRIVACY.md', () => {
  test('Key 在 local，不在 sync；已定稿（无待审横幅）', () => {
    expect(section('### `chrome.storage.sync`')).not.toMatch(/token|API key/i);
    expect(section('### `chrome.storage.local`')).toMatch(/API keys for the PDF parsing provider/);
    expect(doc).not.toMatch(/Pending review/);
  });
  test('列出 Paddle 可选权限、DNR、alarms、contextMenus，并写明不自动换后端', () => {
    for (const s of ['paddleocr.aistudio-app.com', 'declarativeNetRequestWithHostAccess', '`alarms`', '`contextMenus`', 'never switches providers automatically']) expect(doc).toContain(s);
  });
});
