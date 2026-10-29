/** Firefox：AbortSignal.any 自 Firefox 124 起可用（MDN），声明 gecko.strict_min_version 124.0；权限不变 */
import manifest from '../src/manifest.json';

test('gecko strict_min_version 124.0', () => {
  expect(manifest.browser_specific_settings.gecko.strict_min_version).toBe('124.0');
});
test('权限数组未改动（红线）', () => {
  expect(manifest.permissions).toEqual(['storage', 'downloads', 'activeTab', 'notifications', 'alarms', 'contextMenus']);
  expect(manifest.host_permissions).toEqual(['https://arxiv.org/*', 'https://ar5iv.org/*', 'https://ar5iv.labs.arxiv.org/*', 'https://export.arxiv.org/*', 'https://mineru.net/*', 'https://cdn-mineru.openxlab.org.cn/*']);
  expect(manifest.optional_permissions).toEqual(['declarativeNetRequestWithHostAccess']);
  expect(manifest.optional_host_permissions).toEqual(['https://paddleocr.aistudio-app.com/*', 'https://*.bj.bcebos.com/*']);
});
