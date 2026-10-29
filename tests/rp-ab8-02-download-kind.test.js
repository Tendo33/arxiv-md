// release-polish AB8-02：下载中断原因细分，zh/en 文案各自对应
import { downloadFailureKind } from '../src/utils/helpers';
import { statusCardErrorText } from '../src/content/status-error';
import { translations } from '../src/config/locales';

const k = (r) => downloadFailureKind({ code: 'DOWNLOAD_INTERRUPTED', downloadError: r });
test.each([
  ['SERVER_BAD_CONTENT', 'notfound'], ['SERVER_FORBIDDEN', 'forbidden'], ['SERVER_UNAUTHORIZED', 'forbidden'],
  ['SERVER_FAILED', 'server'], ['SERVER_NO_RANGE', 'server'], ['SERVER_CONTENT_LENGTH_MISMATCH', 'network'],
  ['NETWORK_FAILED', 'network'], ['USER_CANCELED', 'canceled'], ['FILE_NO_SPACE', 'file'], ['CRASH', 'other'],
])('%s → %s', (r, kind) => expect(k(r)).toBe(kind));

test.each(['zh', 'en'])('%s：每类都有通知和状态卡文案，notfound/forbidden/server 互不相同', (lang) => {
  const t = translations[lang];
  for (const kind of ['notfound', 'forbidden', 'server']) {
    expect(t[`notify_download_failed_${kind}_title`]).toBeTruthy();
    expect(t[`notify_download_failed_${kind}_body`]).toBeTruthy();
    expect(statusCardErrorText({ success: false, downloadFailure: kind }, t)).toBe(t[`content_error_download_${kind}`]);
  }
  expect(new Set(['notfound', 'forbidden', 'server'].map((x) => t[`content_error_download_${x}`])).size).toBe(3);
  expect(t.content_error_download_notfound).not.toMatch(/限流|rate-limit/);
});
