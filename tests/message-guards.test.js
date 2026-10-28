import { isTrustedArxivSender, isValidArxivId, triggerConversionInActiveTab } from '../src/background/message-guards';

describe('后台消息校验', () => {
  test('arXiv ID 格式', () => {
    ['1706.03762', '2305.18290v3', '0704.0001', 'hep-th/9901001', 'math.GT/0309136v2'].forEach((id) => expect(isValidArxivId(id)).toBe(true));
    ['', null, 123, '1706.03762&max_results=1000', '../../etc', '170.03762', '1706.037620', 'abs/1706.03762', '1706.03762 '].forEach((id) => expect(isValidArxivId(id)).toBe(false));
  });

  test('只接受本扩展、来自 arXiv 页或扩展自身页面的消息', () => {
    const rid = 'ext-id';
    expect(isTrustedArxivSender({ id: rid, tab: { id: 1, url: 'https://arxiv.org/pdf/1706.03762' } }, rid)).toBe(true);
    expect(isTrustedArxivSender({ id: rid, url: 'chrome-extension://ext-id/popup.html' }, rid)).toBe(true);
    expect(isTrustedArxivSender({ id: 'other', tab: { id: 1, url: 'https://arxiv.org/abs/1' } }, rid)).toBe(false);
    expect(isTrustedArxivSender({ id: rid, tab: { id: 1, url: 'https://evil.example/arxiv.org' } }, rid)).toBe(false);
    expect(isTrustedArxivSender({ id: rid, tab: { id: 1, url: 'http://arxiv.org/abs/1' } }, rid)).toBe(false);
    expect(isTrustedArxivSender(undefined, rid)).toBe(false);
  });
});

describe('快捷键在非 arXiv 页', () => {
  const flush = () => new Promise((r) => setTimeout(r, 0));

  test('sendMessage 返回的 Promise 被拒绝时不留下未处理的 rejection', async () => {
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    const log = jest.fn();
    const tabs = {
      query: (q, cb) => cb([{ id: 7, url: 'https://example.com/' }]),
      sendMessage: jest.fn(() => Promise.reject(new Error('Could not establish connection. Receiving end does not exist.'))),
    };
    triggerConversionInActiveTab(tabs, {}, log);
    await flush(); await flush();
    process.off('unhandledRejection', unhandled);
    expect(tabs.sendMessage).toHaveBeenCalledWith(7, { type: 'TRIGGER_CONVERSION' }, expect.any(Function));
    expect(unhandled).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Could not establish connection'));
  });

  test('回调式 API 读取 runtime.lastError；同步抛错也不外泄', () => {
    const log = jest.fn();
    const runtime = { lastError: null };
    const tabs = {
      query: (q, cb) => cb([{ id: 3 }]),
      sendMessage: (id, msg, cb) => { runtime.lastError = { message: 'Receiving end does not exist.' }; cb(); runtime.lastError = null; },
    };
    triggerConversionInActiveTab(tabs, runtime, log);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Receiving end does not exist'));
    const throwing = { query: (q, cb) => cb([{ id: 3 }]), sendMessage: () => { throw new Error('No tab with id'); } };
    expect(() => triggerConversionInActiveTab(throwing, {}, log)).not.toThrow();
    expect(() => triggerConversionInActiveTab({ query: (q, cb) => cb([]), sendMessage: jest.fn() }, {})).not.toThrow();
  });
});
