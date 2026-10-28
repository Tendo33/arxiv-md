import manifest from '../src/manifest.json';
import { REGEX } from '../src/config/constants';

describe('R1-01 快捷键在 /html/ 页有接收方', () => {
  test('content_scripts 匹配 abs/pdf/html，且没有新增权限', () => {
    expect(manifest.content_scripts[0].matches).toEqual(
      expect.arrayContaining(['https://arxiv.org/abs/*', 'https://arxiv.org/pdf/*', 'https://arxiv.org/html/*']),
    );
    expect(manifest.host_permissions).toContain('https://arxiv.org/*');
    // C-3：contextMenus 经 Simon 批准，是本轮唯一新增权限
    expect(manifest.permissions).toEqual(['storage', 'downloads', 'activeTab', 'notifications', 'alarms', 'contextMenus']);
  });
  test('HTML 页 URL 识别', () => {
    expect(REGEX.ARXIV_HTML_PAGE.test('https://arxiv.org/html/2106.09685v2')).toBe(true);
    expect(REGEX.ARXIV_HTML_PAGE.test('https://arxiv.org/html/2106.09685v2#S3')).toBe(true);
    expect(REGEX.ARXIV_HTML_PAGE.test('https://arxiv.org/abs/2106.09685')).toBe(false);
  });
});
