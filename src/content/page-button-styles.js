// 注入到 arxiv.org 页面的样式。变量都挂在 .arxiv-md-btn-container 上并带 --amd- 前缀，
// 不依赖页面 :root，避免被 arXiv 自身样式污染。暗色由 data-theme=dark 打开（见 page-theme.js）。取值来自 design/tokens.css（arXiv 品牌）。
export const PAGE_BUTTON_STYLES = `
    .arxiv-md-btn-container {
      --amd-brand: #b31b1b; --amd-brand-hover: #931616; --amd-brand-press: #7a1212; --amd-brand-on: #ffffff;
      --amd-surface: #ffffff; --amd-surface-2: #f1f3f5; --amd-border: #dde1e6; --amd-border-strong: #c3c9d1;
      --amd-text: #1b1f24; --amd-text-2: #5b6270; --amd-text-disabled: #8b929c;
      --amd-success: #0f7a3d; --amd-success-bg: #e7f5ec; --amd-danger: #b42318; --amd-danger-bg: #fdecea;
      --amd-warning: #92400e; --amd-warning-bg: #fef3c7;
      --amd-info: #1f5fbf; --amd-info-bg: #e8f0fc;
      --amd-focus: #b31b1b;
      display: flex;
      gap: 12px;
      margin: 16px 0 16px 20px;
      align-items: center;
      flex-wrap: wrap;
      color: var(--amd-text);
    }
    /* 暗色跟随宿主页面而不是系统：arxiv.org 本身没有暗色，系统暗色时在白底页面上放暗色按钮反而突兀、焦点环对比度不足 */
    .arxiv-md-btn-container[data-theme="dark"] {
        --amd-brand: #f87171; --amd-brand-hover: #fb9191; --amd-brand-press: #f05252; --amd-brand-on: #1b0606;
        --amd-surface: #1b1d22; --amd-surface-2: #24272d; --amd-border: #33373e; --amd-border-strong: #4a4f57;
        --amd-text: #e8eaed; --amd-text-2: #a1a7b3; --amd-text-disabled: #6b717b;
        --amd-success: #4ade80; --amd-success-bg: #13301f; --amd-danger: #f87171; --amd-danger-bg: #3a1717;
        --amd-warning: #fbbf24; --amd-warning-bg: #33270a;
        --amd-info: #7cb2ff; --amd-info-bg: #152a47;
        --amd-focus: #f87171;
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

    /* rp2b ③：已提交（还没完成）用信息蓝 + 时钟图标，与 popup S-2 一致 */
    .arxiv-md-progress.submitted {
      background: var(--amd-info-bg);
      border-color: var(--amd-info);
      color: var(--amd-info);
    }
    .progress-icon { flex: none; }

    /* R5-04：已取消——中性灰（用户主动取消，不是错误），左边框也去掉品牌红 */
    .arxiv-md-progress.canceled {
      background: var(--amd-surface-2);
      border-color: var(--amd-border-strong);
      color: var(--amd-text);
    }

    .arxiv-md-progress.warning {
      background: var(--amd-warning-bg);
      border-color: var(--amd-warning);
      color: var(--amd-warning);
    }

    .progress-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
    }

    /* M-1：页面进度卡的进度条（亮色品牌红/灰轨道，暗色跟随宿主 data-theme） */
    .progress-percent { font-variant-numeric: tabular-nums; min-width: 4ch; text-align: right; }
    .progress-bar { align-self: stretch; min-width: 160px; height: 4px; border-radius: 2px; background: #d0d4dc; overflow: hidden; margin-top: 6px; }
    .progress-bar[hidden] { display: none; }
    .progress-fill { display: block; height: 100%; width: 0; border-radius: 2px; background: #b31b1b; transition: width .2s; }
    .arxiv-md-btn-container[data-theme="dark"] .progress-bar { background: #3a3f47; }
    .arxiv-md-btn-container[data-theme="dark"] .progress-fill { background: #f87171; }
    .progress-bar.indeterminate .progress-fill { width: 30%; animation: amd-indet 1.2s ease-in-out infinite; }
    @keyframes amd-indet { 0% { transform: translateX(-100%); } 100% { transform: translateX(340%); } }
    @media (prefers-reduced-motion: reduce) {
      .progress-bar.indeterminate .progress-fill { animation: none; transform: none; width: 30%; }
    }

    .progress-detail {
      font-size: 12px;
      color: var(--amd-text-2);
    }
    .arxiv-md-progress.error .progress-detail,
    .arxiv-md-progress.success .progress-detail,
    .arxiv-md-progress.submitted .progress-detail,
    .arxiv-md-progress.canceled .progress-detail,
    .arxiv-md-progress.warning .progress-detail { color: var(--amd-text); }
    .progress-file {
      font-size: 12px;
      color: var(--amd-text-2);
      overflow-wrap: anywhere;
    }

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

    /* ===== abs-buttons v2（design-abs-buttons-2026-10-29 §1 + 5.6/5.7；R04/R05/R10/R11/R14，旧编号 A1–A3）===== */
    /* A1 按钮：32px 高、6px 圆角、13px/600，图标 16px；与 .submission-history 左缘对齐 */
    .arxiv-md-btn-container { gap: 8px; margin: 12px 0 16px 20px; align-items: flex-start; flex-wrap: wrap; }
    @media (max-width: 800px) { .arxiv-md-btn-container { margin-left: 0; } }
    .arxiv-md-btn { height: 32px; padding: 0 12px; gap: 6px; border-radius: 6px; font-size: 13px; font-weight: 600; line-height: 1; white-space: nowrap; box-shadow: none; }
    .arxiv-md-btn svg, .arxiv-md-btn .animate-spin { width: 16px; height: 16px; flex: none; margin: 0; }
    .arxiv-md-btn-primary { border-color: var(--amd-brand); }
    .arxiv-md-btn-primary:not(:disabled):hover { border-color: var(--amd-brand-hover); }
    .arxiv-md-btn-primary:not(:disabled):active { border-color: var(--amd-brand-press); }
    .arxiv-md-btn-secondary:not(:disabled):active, .arxiv-md-btn-quiet:not(:disabled):active { background: var(--amd-surface-2); }
    /* 副标题：不加括号，「·」由 CSS 生成（读屏不念） */
    .arxiv-md-btn-sub { margin: 0; font-size: 12px; font-weight: 400; }
    .arxiv-md-btn-sub::before { content: "·"; margin-right: 6px; opacity: .7; }
    .arxiv-md-btn-primary .arxiv-md-btn-sub { color: rgba(255,255,255,.86); }
    .arxiv-md-btn-container[data-theme="dark"] .arxiv-md-btn-primary .arxiv-md-btn-sub { color: inherit; }
    .arxiv-md-btn-secondary .arxiv-md-btn-sub { color: var(--amd-text-2); }

    /* A2 状态行：任何宽度都独占按钮行下方一行（flex:0 0 100%），状态切换不移动按钮行（R05）。
       不是卡片：无底色、无边框；内层网格「图标+粗体标题 … 关闭」/「说明」，>480 时收缩包裹、「关闭」紧跟最长一行 16px */
    .arxiv-md-progress, .arxiv-md-hint, .arxiv-md-auto { flex: 0 0 100%; box-sizing: border-box; min-width: 0; }
    .arxiv-md-progress { padding: 0 8px 0 0; background: none; border: 0; border-radius: 0; font-size: 13px; line-height: 20px; color: var(--amd-text);
      grid-template-columns: minmax(0, max-content) auto; justify-content: start; column-gap: 16px; row-gap: 2px; align-items: center; }
    .arxiv-md-progress[style*="flex"] { display: grid !important; }
    .arxiv-md-progress.error, .arxiv-md-progress.success, .arxiv-md-progress.submitted,
    .arxiv-md-progress.warning, .arxiv-md-progress.canceled { background: none; border: 0; color: var(--amd-text); }
    .arxiv-md-progress .progress-row { grid-column: 1; grid-row: 1; min-width: 0; gap: 6px; flex-wrap: nowrap; margin: 0; }
    .arxiv-md-progress .progress-text { white-space: nowrap; }
    .arxiv-md-progress .progress-percent:empty { display: none; }
    .arxiv-md-progress .progress-icon { width: 16px; height: 16px; flex: none; }
    .arxiv-md-progress.success   .progress-icon, .arxiv-md-progress.success   .progress-text { color: var(--amd-success); }
    .arxiv-md-progress.error     .progress-icon, .arxiv-md-progress.error     .progress-text { color: var(--amd-danger); }
    .arxiv-md-progress.submitted .progress-icon, .arxiv-md-progress.submitted .progress-text { color: var(--amd-info); }
    .arxiv-md-progress.warning   .progress-icon, .arxiv-md-progress.warning   .progress-text { color: var(--amd-warning); }
    /* A3：已取消用中性色（用户主动取消，不是错误） */
    .arxiv-md-progress.canceled  .progress-icon, .arxiv-md-progress.canceled  .progress-text,
    .arxiv-md-progress.canceled  .progress-detail { color: var(--amd-text-2); }
    .arxiv-md-progress .progress-detail, .arxiv-md-progress .progress-file { grid-column: 1; padding-left: 22px; margin: 0; min-width: 0; overflow-wrap: anywhere; font-size: 13px; }
    .arxiv-md-progress .progress-detail { color: var(--amd-text); }
    .arxiv-md-progress .progress-file { font-size: 12px; color: var(--amd-text-2); }
    .arxiv-md-progress .progress-bar { grid-column: 1; width: 100%; max-width: 320px; min-width: 160px; height: 4px; margin-top: 4px; }
    .arxiv-md-progress .arxiv-md-result-actions { grid-column: 2; grid-row: 1; justify-self: end; margin: 0; flex-wrap: wrap; }
    @media (max-width: 480px) {
      .arxiv-md-progress { grid-template-columns: minmax(0, 1fr) auto; justify-content: stretch; }
      .arxiv-md-progress .progress-detail, .arxiv-md-progress .progress-file, .arxiv-md-progress .progress-bar { grid-column: 1 / -1; }
    }
    /* 状态行里的操作：文字按钮（关闭 / 复制 Markdown），点击区 ≥24px */
    .arxiv-md-result-btn { min-height: 24px; padding: 0 6px; margin: 0; border: 0; background: none; font-size: 12px; font-weight: 500;
      color: var(--amd-text-2); text-decoration: underline; text-underline-offset: 2px; border-radius: 4px; white-space: nowrap; }
    .arxiv-md-result-btn:hover { color: var(--amd-text); background: var(--amd-surface-2); }
    .arxiv-md-result-btn.primary { background: none; border: 0; color: var(--amd-brand); font-weight: 600; }
    .arxiv-md-hint { padding: 0; border: 0; background: none; font-size: 13px; }
    .arxiv-md-btn-container .nw { white-space: nowrap; }

    @media (prefers-reduced-motion: reduce) {
      .arxiv-md-btn, .arxiv-md-result-btn, .arxiv-md-auto-btn { transition: none; }
      .animate-spin { animation: none; }
    }
  `;
