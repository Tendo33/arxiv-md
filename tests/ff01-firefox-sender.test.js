// 待决策 1（主管 23:14）：Firefox 扩展页是 moz-extension://<UUID>/（UUID ≠ runtime.id），
// CONFIRM_PDF_SEND / OPEN_DISCLOSURE 原来只认 chrome-extension://<id>/ → 在 Firefox 159 真机被拒。
import { extensionPagePrefixes, handleOpenDisclosure, isExtensionPageSender, isTrustedArxivSender } from '../src/background/message-guards';

const ID = 'arxiv-md@tendo33';
const UUID = '0f0f0f0f-ff02-4a00-8000-000000000002';
const BASE = `moz-extension://${UUID}/`;
const popup = { id: ID, url: `${BASE}popup.html` };

describe('Firefox 扩展页 sender', () => {
  test('popup / 设置页（moz-extension://<UUID>/，id 相同）通过', () => {
    expect(isExtensionPageSender(popup, ID, BASE)).toBe(true);
    expect(isTrustedArxivSender(popup, ID, BASE)).toBe(true);
    expect(isTrustedArxivSender({ id: ID, url: `${BASE}settings.html#disclose=paddleocr`, tab: { id: 2 } }, ID, BASE)).toBe(true);
    const open = jest.fn();
    expect(handleOpenDisclosure({ provider: 'paddleocr' }, popup, ID, open, BASE)).toBe(true);
    expect(open).toHaveBeenCalledWith('paddleocr');
  });

  test('默认从全局 chrome.runtime.getURL("") 取前缀', () => {
    const prev = global.chrome;
    global.chrome = { runtime: { getURL: (p) => `${BASE}${p}` } };
    try {
      expect(isExtensionPageSender(popup, ID)).toBe(true);
      expect(extensionPagePrefixes(ID)).toEqual([`chrome-extension://${ID}/`, BASE]);
    } finally {
      global.chrome = prev;
    }
  });

  test('仍然拒绝：外部网页、其他扩展、别的 UUID、content script、id 不符', () => {
    const open = jest.fn();
    const bad = [
      { id: ID, url: 'https://evil.example/popup.html' },
      { id: 'other@ext', url: 'moz-extension://aaaa-other/popup.html' },
      { id: 'other@ext', url: `${BASE}popup.html` },
      { id: ID, url: 'moz-extension://aaaa-other/popup.html' },
      { url: `${BASE}popup.html` },
    ];
    for (const s of bad) {
      expect(isExtensionPageSender(s, ID, BASE)).toBe(false);
      expect(handleOpenDisclosure({ provider: 'paddleocr' }, s, ID, open, BASE)).toBe(false);
    }
    // content script（带 tab）不能确认发送，跟原来一样
    expect(isExtensionPageSender({ id: ID, url: 'https://arxiv.org/abs/1', tab: { id: 1 } }, ID, BASE)).toBe(false);
    expect(isExtensionPageSender({ id: ID, url: `${BASE}popup.html`, tab: { id: 1 } }, ID, BASE)).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  test('不规范的 base 不会被当成前缀（不放宽）', () => {
    for (const b of ['', 'moz-extension://', 'https://evil.example/', 'moz-extension://x/y/', 'moz-extension://a@b/']) {
      expect(extensionPagePrefixes(ID, b)).toEqual([`chrome-extension://${ID}/`]);
    }
    expect(isExtensionPageSender({ id: ID, url: 'moz-extension://anything/popup.html' }, ID, 'moz-extension://')).toBe(false);
  });

  test('Chrome 行为不变', () => {
    const cbase = `chrome-extension://${ID}/`;
    expect(extensionPagePrefixes(ID, cbase)).toEqual([cbase]);
    expect(isExtensionPageSender({ id: ID, url: `${cbase}popup.html` }, ID, cbase)).toBe(true);
    expect(isExtensionPageSender({ id: ID, url: `${cbase}popup.html` }, ID)).toBe(true);
    expect(isExtensionPageSender({ id: 'other', url: 'chrome-extension://other/x' }, ID)).toBe(false);
  });
});
