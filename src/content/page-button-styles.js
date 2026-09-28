export const PAGE_BUTTON_STYLES = `
    .arxiv-md-btn-container {
      display: flex;
      gap: 12px;
      margin: 16px 0 16px 20px;
      align-items: center;
      flex-wrap: wrap;
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
      color: white;
      transition: transform 0.15s ease, box-shadow 0.2s ease, background 0.2s ease;
      box-shadow: 0 2px 6px rgba(0,0,0,0.08);
      position: relative;
      overflow: hidden;
      text-decoration: none !important;
      line-height: normal;
    }

    .arxiv-md-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none !important;
      box-shadow: none !important;
    }

    .arxiv-md-btn-primary {
      background: #7F1D1D;
      box-shadow: 0 4px 10px rgba(127, 29, 29, 0.25);
    }
    .arxiv-md-btn-primary:not(:disabled):hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 14px rgba(127, 29, 29, 0.3);
      background: #991B1B;
    }
    .arxiv-md-btn-primary:not(:disabled):active {
      transform: scale(0.97);
    }

    .arxiv-md-btn-secondary {
      background: #92400E;
      box-shadow: 0 4px 10px rgba(146, 64, 14, 0.2);
    }
    .arxiv-md-btn-secondary:not(:disabled):hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 14px rgba(146, 64, 14, 0.28);
      background: #B45309;
    }
    .arxiv-md-btn-secondary:not(:disabled):active {
      transform: scale(0.97);
    }

    .arxiv-md-btn-quiet {
      background: transparent;
      color: #7F1D1D;
      border-color: #e7d5d3;
      box-shadow: none;
    }
    .arxiv-md-btn-quiet:not(:disabled):hover {
      background: #f8f1f0;
    }

    .arxiv-md-btn-sub {
      font-size: 12px;
      font-weight: 400;
      opacity: 0.85;
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
      padding: 6px 12px;
      background: #f9fafb;
      border-radius: 6px;
      font-size: 12px;
      color: #4b5563;
      align-items: flex-start;
      flex-direction: column;
      gap: 4px;
      border: 1px solid #e5e7eb;
    }

    .arxiv-md-progress.error {
      background: #fef2f2;
      border-color: #fecaca;
      color: #991b1b;
    }

    .arxiv-md-progress.success {
      background: #ecfdf5;
      border-color: #a7f3d0;
      color: #065f46;
    }

    .progress-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .progress-detail {
      font-size: 12px;
      color: #6b7280;
    }

    .arxiv-md-hint {
      display: none;
      font-size: 12px;
      color: #6b7280;
      padding: 6px 10px;
      border-left: 3px solid #d1d5db;
      background: #f9fafb;
      border-radius: 6px;
    }

    .arxiv-md-auto {
      display: none;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      padding: 8px 12px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 12px;
      color: #374151;
    }

    .arxiv-md-auto .auto-desc {
      color: #6b7280;
      font-size: 12px;
    }

    .arxiv-md-auto-actions {
      display: flex;
      gap: 8px;
    }

    .arxiv-md-auto-btn {
      border: 1px solid #e5e7eb;
      background: white;
      color: #111827;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
    }

    .arxiv-md-auto-btn.primary {
      background: #7F1D1D;
      border-color: #7F1D1D;
      color: white;
    }
  `;
