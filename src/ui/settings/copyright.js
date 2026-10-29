// AR-08：设置页页脚版权年份——首发 2025，之后显示 2025–当前年份
export const FIRST_YEAR = 2025;

export function copyrightYears(now = new Date()) {
  const y = now.getFullYear();
  return y > FIRST_YEAR ? `${FIRST_YEAR}–${y}` : String(FIRST_YEAR);
}

export function renderCopyrightYear(doc, now = new Date()) {
  const el = doc.getElementById('copyrightYears');
  if (el) el.textContent = copyrightYears(now);
}
