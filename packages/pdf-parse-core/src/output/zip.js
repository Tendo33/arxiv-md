// R4-10：自写 store-only（不压缩）ZIP + CRC32，避免引入新依赖（fflate 需过审）
// 仅支持 <4GB、UTF-8 文件名（通用标志位 bit 11），足够 paper.md + figures/
let CRC_TABLE = null;
function crcTable() {
  if (CRC_TABLE) return CRC_TABLE;
  CRC_TABLE = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    CRC_TABLE[n] = c >>> 0;
  }
  return CRC_TABLE;
}

export function crc32(bytes) {
  const t = crcTable();
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const enc = new TextEncoder();
const toBytes = (d) => (typeof d === 'string' ? enc.encode(d) : d instanceof Uint8Array ? d : new Uint8Array(d));

function dosTime(date) {
  const d = date || new Date(1980, 0, 1);
  return {
    time: ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31),
    date: (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31),
  };
}

/**
 * @param {{name:string, data:string|Uint8Array|ArrayBuffer}[]} files
 * @param {{date?:Date}} [opts] 固定日期便于测试可复现
 * @returns {Uint8Array}
 */
export function createZip(files, { date } = {}) {
  const { time, date: dd } = dosTime(date);
  const locals = []; const centrals = []; let offset = 0;
  const seen = new Set();
  for (const f of files) {
    const name = String(f.name).replace(/^\/+/, '');
    if (!name || name.includes('..') || seen.has(name)) throw new Error(`bad zip entry name: ${f.name}`);
    seen.add(name);
    const nameBytes = enc.encode(name); const data = toBytes(f.data); const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, time, true); lh.setUint16(12, dd, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, nameBytes.length, true); lh.setUint16(28, 0, true);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, time, true); ch.setUint16(14, dd, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, nameBytes.length, true);
    ch.setUint32(42, offset, true);
    locals.push(new Uint8Array(lh.buffer), nameBytes, data);
    centrals.push(new Uint8Array(ch.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const cdSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  const parts = [...locals, ...centrals, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((n, b) => n + b.length, 0));
  let p = 0; for (const b of parts) { out.set(b, p); p += b.length; }
  return out;
}
