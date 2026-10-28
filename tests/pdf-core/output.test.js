// R4-10：store-only ZIP + 下载适配层两条分支
import { createZip, crc32 } from '@pdf-core/output/zip';
import { toDownloadUrl, buildDeliverable, saveDeliverable, canUseBlobUrl } from '@pdf-core/output/save';
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const blobBytes = async (b) => new Uint8Array(await b.arrayBuffer());

describe('zip', () => {
  test('crc32 已知值', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });
  test('系统 unzip 能解开并校验 CRC（含中文文件名、二进制）', () => {
    const bin = new Uint8Array(300).map((_, i) => i & 255);
    const z = createZip([{ name: 'paper.md', data: '# 标题\n$x$' }, { name: 'figures/fig-1-1.png', data: bin }, { name: '图.txt', data: new Uint8Array([1, 2]).buffer }], { date: new Date(2026, 9, 28, 12, 0, 0) });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-'));
    const f = path.join(dir, 'a.zip'); fs.writeFileSync(f, z);
    let ok = true;
    try { execFileSync('python3', ['-c', `import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print(z.namelist());assert z.read('paper.md').decode()=='# 标题\\n$x$';assert z.read('figures/fig-1-1.png')==bytes(i&255 for i in range(300))`, f]); } catch (e) { ok = String(e.stderr || e); }
    expect(ok).toBe(true);
  });
  test('非法/重复文件名抛错', () => {
    expect(() => createZip([{ name: '../x', data: '' }])).toThrow();
    expect(() => createZip([{ name: 'a', data: '' }, { name: 'a', data: '' }])).toThrow();
    expect(() => createZip([{ name: '', data: '' }])).toThrow();
  });
});

describe('save', () => {
  test('没有 createObjectURL（Chrome SW）→ data URL', async () => {
    const env = { URL: {} };
    expect(canUseBlobUrl(env)).toBe(false);
    const r = await toDownloadUrl(new Blob(['hi'], { type: 'text/markdown' }), env);
    expect(r.kind).toBe('data');
    expect(r.url).toBe(`data:text/markdown;base64,${Buffer.from('hi').toString('base64')}`);
    r.revoke();
  });
  test('有 createObjectURL（Firefox 后台）→ blob URL，下载后回收', async () => {
    jest.useFakeTimers();
    const env = { URL: { createObjectURL: jest.fn(() => 'blob:x'), revokeObjectURL: jest.fn() } };
    const download = jest.fn(async () => 7);
    const r = await saveDeliverable({ markdown: 'a' }, 'p', { download, env });
    expect(r).toEqual({ id: 7, filename: 'p.md', kind: 'blob' });
    expect(download).toHaveBeenCalledWith({ url: 'blob:x', filename: 'p.md', saveAs: false, conflictAction: 'uniquify' });
    jest.advanceTimersByTime(60000);
    expect(env.URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
    jest.useRealTimers();
  });
  test('有图 → ZIP（paper.md + figures/），没取到图片字节 → .md', async () => {
    const z = buildDeliverable({ markdown: 'm', images: [{ to: 'figures/fig-1-1.png', data: new Uint8Array([1]) }] }, 'p');
    expect(z.filename).toBe('p.zip');
    const b = await blobBytes(z.blob);
    expect(Array.from(b.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(buildDeliverable({ markdown: 'm', images: [{ to: 'figures/x.png' }] }, 'p').filename).toBe('p.md');
  });
  test('data URL 分支下 download 失败会抛出', async () => {
    await expect(saveDeliverable({ markdown: 'a' }, 'p', { download: async () => { throw new Error('x'); }, env: { URL: {} } })).rejects.toThrow('x');
  });
});
