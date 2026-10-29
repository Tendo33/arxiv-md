// R4-10：下载适配层。Chrome MV3 SW 没有 URL.createObjectURL → data URL；Firefox 后台（event page）有 → blob URL
import { createZip } from './zip.js';

export function canUseBlobUrl(env = globalThis) {
  return !!(env.URL && typeof env.URL.createObjectURL === 'function');
}

function bytesToBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** @returns {Promise<{url:string, revoke:()=>void, kind:'blob'|'data'}>} */
export async function toDownloadUrl(blob, env = globalThis) {
  if (canUseBlobUrl(env)) {
    const url = env.URL.createObjectURL(blob);
    return { url, kind: 'blob', revoke: () => { try { env.URL.revokeObjectURL(url); } catch { /* noop */ } } };
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { url: `data:${blob.type || 'application/octet-stream'};base64,${bytesToBase64(bytes)}`, kind: 'data', revoke: () => {} };
}

/**
 * 按整理结果打包：有图片 → ZIP（paper.md + figures/），没图片 → 直接 .md
 * @param {{markdown:string, images?:{to:string,data?:Uint8Array}[]}} result
 * @param {string} baseName 不含扩展名
 * @returns {{blob:Blob, filename:string}}
 */
export function buildDeliverable(result, baseName) {
  const imgs = (result.images || []).filter((i) => i.data);
  if (!imgs.length) return { blob: new Blob([result.markdown], { type: 'text/markdown;charset=utf-8' }), filename: `${baseName}.md` };
  const zip = createZip([{ name: 'paper.md', data: result.markdown }, ...imgs.map((i) => ({ name: i.to, data: i.data }))]);
  return { blob: new Blob([zip], { type: 'application/zip' }), filename: `${baseName}.zip` };
}

/** download: (opts:{url,filename,saveAs,conflictAction}) => Promise<id>，由插件侧注入 chrome.downloads.download */
export async function saveDeliverable(result, baseName, { download, env = globalThis } = {}) {
  const { blob, filename } = buildDeliverable(result, baseName);
  const { url, revoke, kind } = await toDownloadUrl(blob, env);
  try {
    const id = await download({ url, filename, saveAs: false, conflictAction: 'uniquify' });
    return { id, filename, kind };
  } finally {
    if (kind === 'blob') setTimeout(revoke, 60000);
  }
}
