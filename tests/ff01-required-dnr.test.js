// 1.2.2（Simon 决定）：Chrome / Firefox 包里 DNR 和 PaddleOCR 域名都是安装时必需权限 →
// 设置页不再有授权 / 撤销入口，也不调用 permissions API；core 不再提供 permissions 模块
import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { createDefaultRegistry } from '@pdf-core/providers/index';
import { paddleocrProvider } from '@pdf-core/providers/paddleocr';
import { createPdfProviderSection } from '../src/ui/settings/pdf-provider';
import { translations } from '../src/config/locales';

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src/ui/settings/settings.html'), 'utf8');

test('core 没有 permissions 模块，provider 不再声明 optionalPermissions / permissionMode', () => {
  expect(fs.existsSync(path.join(root, 'packages/pdf-parse-core/src/permissions.js'))).toBe(false);
  expect(fs.readFileSync(path.join(root, 'packages/pdf-parse-core/src/index.js'), 'utf8')).not.toMatch(/permissions/);
  expect(paddleocrProvider).not.toHaveProperty('optionalPermissions');
  expect(paddleocrProvider.permissionMode).toBeUndefined();
});

test('设置页：init / 切换后端都不碰 chrome.permissions', async () => {
  const { document } = parseHTML(html);
  const prev = global.chrome;
  const permissions = { contains: jest.fn(), request: jest.fn(), remove: jest.fn() };
  global.chrome = { permissions };
  try {
    const storage = { getPdfProvider: async () => 'mineru', setPdfProvider: jest.fn(async () => {}), getProviderKey: async () => 'k', setProviderKey: async () => {} };
    const sec = createPdfProviderSection({ doc: document, storage, registry: createDefaultRegistry(), t: () => translations.zh, toast: jest.fn(), local: { get: async () => ({}) }, runtime: {}, dnr: { getDynamicRules: async () => [] } });
    await sec.init();
    await sec.onSelect('paddleocr');
    expect(storage.setPdfProvider).toHaveBeenCalledWith('paddleocr');
    expect(permissions.contains).not.toHaveBeenCalled();
    expect(permissions.request).not.toHaveBeenCalled();
    expect(permissions.remove).not.toHaveBeenCalled();
  } finally {
    global.chrome = prev;
  }
});

test('settings.js / settings.html 不再有授权、撤销入口', () => {
  const js = fs.readFileSync(path.join(root, 'src/ui/settings/settings.js'), 'utf8');
  expect(js).not.toMatch(/withRequiredPermissions|requiredPermissionsOf|chrome\.permissions/);
  for (const id of ['grantPermissionBtn', 'permissionStatus', 'revokeRow', 'revokePermissionBtn', 'pdConfirmed', 'pdLive']) expect([id, html.includes(`id="${id}"`)]).toEqual([id, false]);
});
