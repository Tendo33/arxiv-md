// 根据宿主页面实际背景决定注入 UI 用亮色还是暗色。
// 页面背景透明时向上取 html；都取不到按亮色处理。

function parseRgb(color) {
  const m = String(color || '').match(/[\d.]+/g);
  if (!m || m.length < 3) return null;
  const [r, g, b, a = 1] = m.map(Number);
  return { r, g, b, a };
}

export function isDarkColor(color) {
  const c = parseRgb(color);
  if (!c || c.a < 0.5) return null;
  const lin = (v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  return L < 0.2;
}

export function detectPageTheme(doc = document, getStyle = (el) => getComputedStyle(el)) {
  for (const el of [doc.body, doc.documentElement]) {
    if (!el) continue;
    const dark = isDarkColor(getStyle(el).backgroundColor);
    if (dark !== null) return dark ? 'dark' : 'light';
  }
  return 'light';
}
