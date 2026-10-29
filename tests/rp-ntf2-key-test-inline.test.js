// release-polish 设计 NTF2：Key 测试结果只出现在内联状态框（#tokenStatus），不再弹 toast
import fs from 'fs';
import path from 'path';

const src = fs.readFileSync(path.join(__dirname, '../src/ui/settings/pdf-provider.js'), 'utf8');
const onTest = src.slice(src.indexOf('async function onTest'), src.indexOf('function bind()'));

describe('NTF2 Key 测试结果', () => {
  test('onTest 存在且写 #tokenStatus', () => {
    expect(onTest.length).toBeGreaterThan(100);
    expect(onTest).toContain("$('tokenStatus')");
    for (const k of ['token_empty_error', 'token_testing', 'token_api_valid', 'token_api_invalid', 'token_test_error']) expect(onTest).toContain(k);
  });
  test('成功 / 失败 / 空 Key 都不调用 toast', () => {
    expect(onTest).not.toMatch(/\btoast\(/);
  });
});
