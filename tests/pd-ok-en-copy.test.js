// QA 严格矩阵把 en 披露确认按钮记成 "Confirm"：ui-baseline-check 的 FOCUS 用 textContent.slice(0, 8) 作标识，
// 截断了 "Confirm and continue"。这里锁住真实文案和可访问名，防止以后真的被改成 popup_action_consent 的 "Confirm"。
import { parseHTML } from 'linkedom';
import { buildDisclosurePanel } from '../src/ui/settings/disclosure';
import { translations } from '../src/config/locales';
const { document } = parseHTML('<!doctype html><html><body></body></html>');

test.each(['paddleocr', 'mineru'])('en %s：.pd-ok 文字是 Confirm and continue，无覆盖它的 aria-label', (id) => {
  expect(translations.en.pdf_disc_ok).toBe('Confirm and continue');
  const { panel } = buildDisclosurePanel(document, translations.en, { id, label: id }, (k, t) => t);
  const ok = panel.querySelector('.pd-ok');
  expect(ok.textContent.trim()).toBe('Confirm and continue');
  expect(ok.hasAttribute('aria-label')).toBe(false);
  expect(ok.textContent.trim()).not.toBe(translations.en.popup_action_consent);
});
