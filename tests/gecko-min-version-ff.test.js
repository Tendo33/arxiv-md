/**
 * Firefox：gecko.strict_min_version 140.0——当前 ESR 是 140 系，且 140 起有内置数据收集同意页
 * （data_collection_permissions），不自建同意页。AbortSignal.any（Firefox 124+）在 140 上必然可用，
 * http.js 的手动转发兜底仍保留。1.2.2 起 PaddleOCR 域名和 DNR 改为安装时授予（Simon 决定），不新增其它域名。
 */
import manifest from '../src/manifest.json';

test('gecko strict_min_version 140.0', () => {
  expect(manifest.browser_specific_settings.gecko.strict_min_version).toBe('140.0');
});
test('权限数组（红线）：只有原有权限 + 原可选权限移入必需，没有 optional_*、没有 <all_urls>', () => {
  expect(manifest.permissions).toEqual(['storage', 'downloads', 'activeTab', 'notifications', 'alarms', 'contextMenus', 'declarativeNetRequestWithHostAccess']);
  expect(manifest.host_permissions).toEqual(['https://arxiv.org/*', 'https://ar5iv.org/*', 'https://ar5iv.labs.arxiv.org/*', 'https://export.arxiv.org/*', 'https://mineru.net/*', 'https://cdn-mineru.openxlab.org.cn/*', 'https://paddleocr.aistudio-app.com/*', 'https://*.bj.bcebos.com/*']);
  expect(manifest).not.toHaveProperty('optional_permissions');
  expect(manifest).not.toHaveProperty('optional_host_permissions');
  expect(JSON.stringify(manifest)).not.toContain('<all_urls>');
});
