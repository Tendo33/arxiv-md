/**
 * 显示自定义确认对话框
 * @returns {Promise<boolean>}
 */
export function showConfirm(message, { title = null, okLabel = null, tone = 'danger' } = {}) {
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
    // 设计验收 M10：有标题时 标题=名字、正文=描述；没有标题（删除确认）时仍用正文当名字
    const titleEl = document.getElementById('confirmTitle');
    if (titleEl) {
      titleEl.textContent = title || '';
      titleEl.hidden = !title;
    }
    if (title && titleEl) {
      dialog.setAttribute('aria-labelledby', 'confirmTitle');
      dialog.setAttribute('aria-describedby', 'confirmMessage');
    } else {
      dialog.setAttribute('aria-labelledby', 'confirmMessage');
      dialog.removeAttribute('aria-describedby');
    }
    // 非删除类确认（如「发送并解析」）：换按钮文字，用品牌色而不是危险色
    const prevOkLabel = okBtn.textContent;
    if (okLabel) okBtn.textContent = okLabel;
    okBtn.classList.toggle('brand', tone === 'brand');
    // 关闭时 hidden + inert：读屏和 Tab 都进不去（axe aria-hidden-focus）
    overlay.hidden = false;
    overlay.inert = false;
    overlay.removeAttribute('inert');
    overlay.classList.add('show');

    // 初始焦点显式放在「取消」（破坏性最小，WAI-ARIA APG Alert Dialog），不依赖按钮的 DOM 顺序
    const focusFirst = () => {
      if (cancelBtn && !cancelBtn.disabled) cancelBtn.focus();
      else dialog.focus();
    };

    const cleanup = () => {
      overlay.classList.remove('show');
      overlay.hidden = true;
      if (okLabel) okBtn.textContent = prevOkLabel;
      okBtn.classList.remove('brand');
      overlay.inert = true;
      overlay.setAttribute('inert', '');
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
