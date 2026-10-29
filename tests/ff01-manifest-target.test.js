// FF-01 方案 A：Chrome / Firefox 两套权限期望分别锁定
const { manifestForTarget } = require('../scripts/manifest-target');
const src = require('../src/manifest.json');
const BASE = ['storage', 'downloads', 'activeTab', 'notifications', 'alarms', 'contextMenus'];
const HOST = ['https://arxiv.org/*', 'https://ar5iv.org/*', 'https://ar5iv.labs.arxiv.org/*', 'https://export.arxiv.org/*', 'https://mineru.net/*', 'https://cdn-mineru.openxlab.org.cn/*'];
const OPT_HOST = ['https://paddleocr.aistudio-app.com/*', 'https://*.bj.bcebos.com/*'];

test('Chrome 产物：DNR 仍是可选权限，其它不变', () => {
  const m = manifestForTarget(src, 'chrome');
  expect(m.permissions).toEqual(BASE);
  expect(m.optional_permissions).toEqual(['declarativeNetRequestWithHostAccess']);
  expect(m.host_permissions).toEqual(HOST);
  expect(m.optional_host_permissions).toEqual(OPT_HOST);
});
test('Firefox 产物：DNR 安装时必需，无 optional_permissions；其它权限、data_collection、min version 不变', () => {
  const m = manifestForTarget(src, 'firefox');
  expect(m.permissions).toEqual([...BASE, 'declarativeNetRequestWithHostAccess']);
  expect(m.optional_permissions).toBeUndefined();
  expect(m.host_permissions).toEqual(HOST);
  expect(m.optional_host_permissions).toEqual(OPT_HOST);
  expect(m.browser_specific_settings.gecko.data_collection_permissions).toEqual({ required: ['websiteContent'] });
  expect(m.browser_specific_settings.gecko.strict_min_version).toBe('140.0');
});
test('源 manifest 不被修改', () => {
  manifestForTarget(src, 'firefox');
  expect(src.optional_permissions).toEqual(['declarativeNetRequestWithHostAccess']);
});
