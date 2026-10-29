// R4-15：UI 侧的后端显示名（与 pdf-parse-core providers 的 label 保持一致，避免 popup 打包整个 core）
export const PDF_PROVIDER_LABELS = Object.freeze({ paddleocr: 'PaddleOCR', mineru: 'MinerU' });
export const providerLabel = (id) => PDF_PROVIDER_LABELS[id] || PDF_PROVIDER_LABELS.mineru;
