// 三审 P3：KEY_NOT_ON_DEVICE 失败行文案按界面语言显示，不再写死中文
import { translations } from '../src/config/locales';
import { createTaskRow, setTaskListLanguage } from '../src/ui/popup/task-list';
import { parseHTML as __parseHTML } from 'linkedom';
// release-polish AR-04：createTaskRow 返回 DOM 节点，这里在 linkedom 文档里构建后取 outerHTML 再断言
const __doc = __parseHTML('<!doctype html><html><body></body></html>').document;
const rowHtml = (task) => require('../src/ui/popup/task-list').createTaskRow(task, __doc).outerHTML;

const task = { id: 't1', status: 'failed', provider: 'mineru', paperInfo: { title: 'P' }, createdAt: Date.now(),
  error: 'mineru: AUTH_INVALID (key_not_on_device)', errorCode: 'AUTH_INVALID', errorReason: 'key_not_on_device' };
const errText = (html) => (html.match(/<span class="row-err">([^<]*)<\/span>/) || [])[1];

describe('err_reason_key_not_on_device', () => {
  afterAll(() => setTaskListLanguage('en'));
  test('zh 和 en 都有', () => {
    expect(translations.zh.err_reason_key_not_on_device).toContain('请在本设备');
    expect(translations.en.err_reason_key_not_on_device).toMatch(/Re-enter it on this device/);
  });
  test('中文界面显示中文', () => {
    setTaskListLanguage('zh');
    const s = errText(rowHtml(task));
    expect(s).toBe('本设备还没有 MinerU 的 Key（Key 不会跨设备同步），请在本设备的设置 › PDF 解析里重新填写');
  });
  test('英文界面显示英文，不含中文', () => {
    setTaskListLanguage('en');
    const s = errText(rowHtml(task));
    expect(s).toContain('No MinerU key on this device');
    expect(s).not.toMatch(/[\u4e00-\u9fff]/);
  });
  test('没有对应文案的 reason 沿用原 error', () => {
    setTaskListLanguage('en');
    expect(errText(rowHtml({ ...task, errorReason: 'other', error: 'raw msg' }))).toBe('raw msg');
  });
});
