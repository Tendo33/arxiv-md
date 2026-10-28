// 注入到 arxiv.org 页面的样式。变量都挂在 .arxiv-md-btn-container 上并带 --amd- 前缀，
// 不依赖页面 :root，避免被 arXiv 自身样式污染。取值来自 design/tokens.css（arXiv 品牌）。
export const PAGE_BUTTON_STYLES = `
    .arxiv-md-btn-container {
      --amd-brand: #b31b1b; --amd-brand-hover: #931616; --amd-brand-press: #7a1212; --amd-brand-on: #ffffff;
      --amd-surface: #ffffff; --amd-surface-2: #f1f3f5; --amd-border: #dde1e6; --amd-border-strong: #c3c9d1;
      --amd-text: #1b1f24; --amd-text-2: #5b6270; --amd-text-disabled: #8b929c;
      --amd-success: #0f7a3d; --amd-success-bg: #e7f5ec; --amd-danger: #b42318; --amd-danger-bg: #fdecea;
      --amd-focus: #b31b1b;
      display: flex;
      gap: 12px;
      margin: 16px 0 16px 20px;
      align-items: center;
      flex-wrap: wrap;
      color: var(--amd-text);
    }
    @media (prefers-color-scheme: dark) {
      .arxiv-md-btn-container {
        --amd-brand: #f87171; --amd-brand-hover: #fb9191; --amd-brand-press: #f05252; --amd-brand-on: #1b0606;
        --amd-surface: #1b1d22; --amd-surface-2: #24272d; --amd-border: #33373e; --amd-border-strong: #4a4f57;
        --amd-text: #e8eaed; --amd-text-2: #a1a7b3; --amd-text-disabled: #6b717b;
        --amd-success: #4ade80; --amd-success-bg: #13301f; --amd-danger: #f87171; --amd-danger-bg: #3a1717;
        --amd-focus: #f87171;
      }
    }

    .arxiv-md-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 36px;
      padding: 0 14px;
      border: 1px solid transparent;
      border-radius: 8px;
      cursor: pointer;
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
      color: var(--amd-text);
      background: var(--amd-surface);
      transition: background-color 120ms cubic-bezier(.2,0,0,1), border-color 120ms cubic-bezier(.2,0,0,1);
      position: relative;
      overflow: hidden;
      text-decoration: none !important;
      line-height: normal;
    }

    .arxiv-md-btn:focus-visible,
    .arxiv-md-result-btn:focus-visible,
    .arxiv-md-auto-btn:focus-visible {
      outline: 2px solid var(--amd-focus);
      outline-offset: 2px;
    }

    .arxiv-md-btn:disabled {
      background: var(--amd-surface-2);
      color: var(--amd-text-disabled);
      border-color: var(--amd-border);
      cursor: not-allowed;
    }

    .arxiv-md-btn-primary {
      background: var(--amd-brand);
      color: var(--amd-brand-on);
    }
    .arxiv-md-btn-primary:not(:disabled):hover { background: var(--amd-brand-hover); }
    .arxiv-md-btn-primary:not(:disabled):active { background: var(--amd-brand-press); }

    /* PDF、BibTeX：次级按钮（surface 底 + 描边），不和主操作抢层级 */
    .arxiv-md-btn-secondary,
    .arxiv-md-btn-quiet {
      background: var(--amd-surface);
      color: var(--amd-text);
      border-color: var(--amd-border-strong);
    }
    .arxiv-md-btn-secondary:not(:disabled):hover,
    .arxiv-md-btn-quiet:not(:disabled):hover { background: var(--amd-surface-2); }

    .arxiv-md-btn-sub {
      font-size: 12px;
      font-weight: 400;
      margin-left: 6px;
    }

    .arxiv-md-btn svg {
      margin-right: 6px;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .animate-spin {
      animation: spin 1s linear infinite;
      margin-right: 6px;
    }

    .arxiv-md-progress {
      display: none;
      padding: 8px 12px;
      background: var(--amd-surface);
      border-radius: 8px;
      font-size: 12px;
      color: var(--amd-text);
      align-items: flex-start;
      flex-direction: column;
      gap: 4px;
      border: 1px solid var(--amd-border);
      border-left: 4px solid var(--amd-brand);
    }

    .arxiv-md-progress.error {
      background: var(--amd-danger-bg);
      border-color: var(--amd-danger);
      color: var(--amd-danger);
    }

    .arxiv-md-progress.success {
      background: var(--amd-success-bg);
      border-color: var(--amd-success);
      color: var(--amd-success);
    }

    .progress-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
    }

    .progress-detail {
      font-size: 12px;
      color: var(--amd-text-2);
    }
    .arxiv-md-progress.error .progress-detail,
    .arxiv-md-progress.success .progress-detail { color: var(--amd-text); }

    .arxiv-md-result-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 2px;
    }

    .arxiv-md-result-btn {
      min-height: 32px;
      padding: 0 12px;
      font-size: 12px;
      font-weight: 600;
      border-radius: 8px;
      border: 1px solid var(--amd-border-strong);
      background: var(--amd-surface);
      color: var(--amd-text);
      cursor: pointer;
    }

    .arxiv-md-result-btn.primary {
      background: var(--amd-brand);
      border-color: var(--amd-brand);
      color: var(--amd-brand-on);
    }

    .arxiv-md-result-status {
      font-size: 12px;
      color: var(--amd-text);
    }

    .arxiv-md-hint {
      display: none;
      font-size: 12px;
      color: var(--amd-text-2);
      padding: 6px 10px;
      border-left: 3px solid var(--amd-border-strong);
      background: var(--amd-surface-2);
      border-radius: 6px;
    }

    .arxiv-md-auto {
      display: none;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      padding: 8px 12px;
      background: var(--amd-surface);
      border: 1px solid var(--amd-border);
      border-radius: 8px;
      font-size: 12px;
      color: var(--amd-text);
    }

    .arxiv-md-auto .auto-desc {
      color: var(--amd-text-2);
      font-size: 12px;
    }

    .arxiv-md-auto-actions {
      display: flex;
      gap: 8px;
    }

    .arxiv-md-auto-btn {
      min-height: 32px;
      padding: 0 12px;
      border: 1px solid var(--amd-border-strong);
      background: var(--amd-surface);
      color: var(--amd-text);
      border-radius: 8px;
      font-size: 12px;
      cursor: pointer;
    }

    .arxiv-md-auto-btn.primary {
      background: var(--amd-brand);
      border-color: var(--amd-brand);
      color: var(--amd-brand-on);
    }

    @media (prefers-reduced-motion: reduce) {
      .arxiv-md-btn, .arxiv-md-result-btn, .arxiv-md-auto-btn { transition: none; }
      .animate-spin { animation: none; }
    }
  `;
