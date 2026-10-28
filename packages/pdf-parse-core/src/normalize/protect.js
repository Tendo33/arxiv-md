// 把 ``` 代码块和 `行内代码` 先挖掉，整理完再放回，避免误改代码里的反斜杠/表格/图片语法
export function withCodeProtected(md, fn) {
  const saved = [];
  const hold = (m) => { saved.push(m); return `\uE000${saved.length - 1}\uE000`; };
  const masked = String(md).replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, hold).replace(/`[^`\n]+`/g, hold);
  return fn(masked).replace(/\uE000(\d+)\uE000/g, (_, i) => saved[Number(i)]);
}
