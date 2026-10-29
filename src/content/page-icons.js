// release-polish AR-04：页面按钮图标，交给 utils/dom.svg 构建（不再是 innerHTML 模板）
export const ICON_MARKDOWN = ['svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'currentColor', 'aria-hidden': 'true' }, [
  ['path', { d: 'M8.5 1.5A1.5 1.5 0 0 0 7 0H3.5A1.5 1.5 0 0 0 2 1.5v13A1.5 1.5 0 0 0 3.5 16h9a1.5 1.5 0 0 0 1.5-1.5V7L8.5 1.5z' }],
  ['path', { d: 'M8 1v5.5A1.5 1.5 0 0 0 9.5 8H15' }],
]];

export const ICON_PDF = ['svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'currentColor', 'aria-hidden': 'true' }, [
  ['path', { d: 'M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z' }],
  ['path', { d: 'M8.5 6.5a.5.5 0 0 0-1 0v3.793L6.354 9.146a.5.5 0 1 0-.708.708l2 2a.5.5 0 0 0 .708 0l2-2a.5.5 0 0 0-.708-.708L8.5 10.293V6.5z' }],
]];

export const ICON_SPINNER = ['svg', { class: 'animate-spin', width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' }, [
  ['circle', { cx: 12, cy: 12, r: 10, stroke: 'currentColor', 'stroke-width': 4, 'stroke-opacity': '0.3' }],
  ['path', { fill: 'currentColor', d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' }],
]];
