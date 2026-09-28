/**
 * 显示自定义确认对话框
 * @returns {Promise<boolean>}
 */
export function showConfirm(message) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirmOverlay');
    const msgEl = document.getElementById('confirmMessage');
    const okBtn = document.getElementById('confirmOk');
    const cancelBtn = document.getElementById('confirmCancel');
    const dialog = overlay.querySelector('.confirm-dialog');
    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const previousFocus = document.activeElement;
    let resolved = false;

    const getFocusable = () =>
      Array.from(dialog.querySelectorAll(focusableSelector)).filter(
        (el) => !el.disabled && el.offsetParent !== null,
      );

    msgEl.textContent = message;
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');

    const focusFirst = () => {
      const focusable = getFocusable();
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        dialog.focus();
      }
    };

    const cleanup = () => {
      overlay.classList.remove('show');
      overlay.setAttribute('aria-hidden', 'true');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onOverlayClick);
      document.removeEventListener('keydown', onKeydown);
      if (previousFocus && typeof previousFocus.focus === 'function') {
        previousFocus.focus();
      }
    };

    const onOk = () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(true);
    };

    const onCancel = () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(false);
    };

    const onOverlayClick = (event) => {
      if (event.target === overlay) {
        onCancel();
      }
    };

    const onKeydown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlayClick);
    document.addEventListener('keydown', onKeydown);
    focusFirst();
  });
}
