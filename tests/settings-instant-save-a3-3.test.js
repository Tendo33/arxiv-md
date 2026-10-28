import fs from 'fs';
import path from 'path';
import { parseHTML } from 'linkedom';
import { bindInstantSave } from '../src/ui/settings/instant-save';

const html = fs.readFileSync(path.join(__dirname, '../src/ui/settings/settings.html'), 'utf8');

function setup() {
  const { document } = parseHTML(html);
  const storage = {
    setConversionMode: jest.fn(async () => {}), setShowNotifications: jest.fn(async () => {}),
    setAutoConvert: jest.fn(async () => {}), setIncludeMetadata: jest.fn(async () => {}),
    setProviderKey: jest.fn(async () => {}),
  };
  const onSaved = jest.fn();
  const onError = jest.fn();
  bindInstantSave(document, storage, { onSaved, onError });
  const fire = async (el) => { el.dispatchEvent(new document.defaultView.Event('change')); await new Promise((r) => setImmediate(r)); };
  return { document, storage, onSaved, onError, fire };
}

describe('A3-3 设置即时保存', () => {
  test('没有「保存」按钮，改为自动保存提示', () => {
    expect(html).not.toContain('id="saveBtn"');
    expect(html).toContain('data-i18n="autosave_note"');
  });
  test('切换模式只写模式一项，并提示已保存', async () => {
    const { document, storage, onSaved, fire } = setup();
    const always = document.querySelector('input[name="conversionMode"][value="always"]');
    always.checked = true;
    await fire(always);
    expect(storage.setConversionMode).toHaveBeenCalledWith('always');
    expect(storage.setAutoConvert).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
  test('取消选中的单选不写入', async () => {
    const { document, storage, fire } = setup();
    const fast = document.querySelector('input[name="conversionMode"][value="fast"]');
    fast.checked = false;
    await fire(fast);
    expect(storage.setConversionMode).not.toHaveBeenCalled();
  });
  test('复选框与 Token（去空格；清空即清除）', async () => {
    const { document, storage, fire } = setup();
    const meta = document.getElementById('includeMetadata');
    meta.checked = false;
    await fire(meta);
    expect(storage.setIncludeMetadata).toHaveBeenCalledWith(false);
    // R4-14：Key 输入框通用化，按 data-provider 存到对应后端
    const tok = document.getElementById('providerKey');
    tok.value = '  abcdefghijk  ';
    await fire(tok);
    expect(storage.setProviderKey).toHaveBeenLastCalledWith('paddleocr', 'abcdefghijk');
    tok.value = '';
    await fire(tok);
    expect(storage.setProviderKey).toHaveBeenLastCalledWith('paddleocr', '');
  });
  test('写入失败走 onError，不提示已保存', async () => {
    const { document, storage, onSaved, onError, fire } = setup();
    storage.setAutoConvert.mockRejectedValueOnce(new Error('quota'));
    await fire(document.getElementById('autoConvert'));
    expect(onError).toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
