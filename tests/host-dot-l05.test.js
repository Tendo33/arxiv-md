// QA L-05：任务行权限错误里的域名带点（F16 截图放大后 "r." 字距很紧，文本本身没丢点）——回归保护
import { taskErrorText } from '../src/ui/popup/task-error-text';
import { translations } from '../src/config/locales';

test.each(['zh', 'en'])('%s：PERMISSION_MISSING 的 host 原样带点', (lang) => {
  const task = { errorCode: 'PERMISSION_MISSING', errorHost: 'paddleocr.aistudio-app.com' };
  expect(taskErrorText(task, translations[lang])).toContain('paddleocr.aistudio-app.com');
});
