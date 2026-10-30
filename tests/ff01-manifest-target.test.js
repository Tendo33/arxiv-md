// 1.2.2（Simon 决定）：所有权限安装时一次授予。Chrome / Firefox 两套产物权限完全相同，不再有 optional_*
const { manifestForTarget } = require('../scripts/manifest-target');
const src = require('../src/manifest.json');
const BASE = ['storage', 'downloads', 'activeTab', 'notifications', 'alarms', 'contextMenus', 'declarativeNetRequestWithHostAccess'];
const HOST = ['https://arxiv.org/*', 'https://ar5iv.org/*', 'https://ar5iv.labs.arxiv.org/*', 'https://export.arxiv.org/*', 'https://mineru.net/*', 'https://cdn-mineru.openxlab.org.cn/*', 'https://paddleocr.aistudio-app.com/*', 'https://*.bj.bcebos.com/*'];

test.each(['chrome', 'firefox'])('%s 产物：DNR 和 PaddleOCR 域名都是安装时必需，没有 optional_*', (target) => {
  const m = manifestForTarget(src, target);
  expect(m.permissions).toEqual(BASE);
  expect(m.host_permissions).toEqual(HOST);
  expect(m).not.toHaveProperty('optional_permissions');
  expect(m).not.toHaveProperty('optional_host_permissions');
  expect(JSON.stringify(m)).not.toContain('<all_urls>');
});
test('Firefox 产物：data_collection、min version 不变', () => {
  const m = manifestForTarget(src, 'firefox');
  expect(m.browser_specific_settings.gecko.data_collection_permissions).toEqual({ required: ['websiteContent'] });
  expect(m.browser_specific_settings.gecko.strict_min_version).toBe('140.0');
});
test('源 manifest 不被修改', () => {
  const before = JSON.stringify(src);
  manifestForTarget(src, 'firefox');
  manifestForTarget(src, 'chrome');
  expect(JSON.stringify(src)).toBe(before);
});
test('manifest-target 不再导出 FIREFOX_REQUIRED_DNR', () => {
  expect(require('../scripts/manifest-target')).not.toHaveProperty('FIREFOX_REQUIRED_DNR');
});
