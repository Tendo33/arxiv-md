// release-polish 图标：换成 option-faithful/brand-color 定稿；icons 和 action.default_icon 都带 16/32/48/128
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import manifest from '../src/manifest.json';

const root = path.join(__dirname, '..');
const SIZES = ['16', '32', '48', '128'];
const png = (s) => fs.readFileSync(path.join(root, 'assets', `icon-${s}.png`));
const dims = (b) => [b.readUInt32BE(16), b.readUInt32BE(20)];

test.each([['icons', manifest.icons], ['action.default_icon', manifest.action.default_icon]])('%s 有 16/32/48/128', (_n, map) => {
  expect(Object.keys(map)).toEqual(SIZES);
  SIZES.forEach((s) => expect(map[s]).toBe(`assets/icon-${s}.png`));
});

test.each(SIZES)('icon-%s.png 是对应尺寸的 RGBA PNG', (s) => {
  const b = png(s);
  expect(b.subarray(1, 4).toString()).toBe('PNG');
  expect(dims(b)).toEqual([Number(s), Number(s)]);
  expect(b[25]).toBe(6);
});

const designDir = '/workspace/chrome-ext-team/arxiv-md/design/icon-refine/option-faithful/brand-color';
(fs.existsSync(designDir) ? test.each(SIZES) : test.skip.each(SIZES))('icon-%s.png 与设计定稿逐字节一致', (s) => {
  const h = (b) => crypto.createHash('sha256').update(b).digest('hex');
  expect(h(png(s))).toBe(h(fs.readFileSync(path.join(designDir, `icon-${s}.png`))));
});
