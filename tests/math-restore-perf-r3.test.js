import { restoreMathPlaceholders } from '../src/content/ar5iv-math';

describe('R3 perf：数学占位符单次扫描恢复', () => {
  test('行内/块级、重复出现、字面 $ 与未知占位符保持原行为', () => {
    const map = new Map([
      ['MATHINLINESTART1MATHINLINEEND', { latex: ' a+b ', isBlock: false }],
      ['MATHBLOCKSTART2MATHBLOCKEND', { latex: '\\$x', isBlock: true }],
    ]);
    const md = 'x MATHINLINESTART1MATHINLINEEND y MATHINLINESTART1MATHINLINEEND\nMATHBLOCKSTART2MATHBLOCKEND MATHINLINESTART9MATHINLINEEND';
    expect(restoreMathPlaceholders(md, map)).toBe('x $a+b$ y $a+b$\n$$\\$x$$ MATHINLINESTART9MATHINLINEEND');
  });
  test('MATHINLINESTART1 不会误吃 MATHINLINESTART10', () => {
    const map = new Map([
      ['MATHINLINESTART1MATHINLINEEND', { latex: 'a', isBlock: false }],
      ['MATHINLINESTART10MATHINLINEEND', { latex: 'b', isBlock: false }],
    ]);
    expect(restoreMathPlaceholders('MATHINLINESTART10MATHINLINEEND MATHINLINESTART1MATHINLINEEND', map)).toBe('$b$ $a$');
  });
  test('2000 个公式在 200ms 内完成', () => {
    const map = new Map(); let md = '';
    for (let i = 0; i < 2000; i++) { const p = `MATHINLINESTART${i}MATHINLINEEND`; map.set(p, { latex: `x_${i}`, isBlock: false }); md += `t ${p}\n`; }
    const t = Date.now(); restoreMathPlaceholders(md, map);
    expect(Date.now() - t).toBeLessThan(200);
  });
});
