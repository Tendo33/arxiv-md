// R09 补充：pdf_desc 手工短语表；中英文之间的空格也是断点（权限提示「访问 {host} 才能使用 {provider}」）
import { NW_ZH, splitZh } from '../src/ui/settings/nw-segments';
import { translations } from '../src/config/locales';

describe('R09 pdf_desc / spaces', () => {
  test('pdf_desc 表拼回来与 zh 文案一致', () => {
    const zh = translations.zh || translations.zh_CN;
    expect(NW_ZH.pdf_desc.join('')).toBe(zh.pdf_desc);
  });
  test('空格处切开', () => {
    expect(splitZh('需要授权访问 a.b.com 才能使用 PaddleOCR')).toEqual(['需要授权访问 ', 'a.b.com ', '才能使用 ', 'PaddleOCR']);
  });
});
