// Minimal ZIP writer (stored, no compression) — enough for small Office files without a library

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export const crc32 = (data: Uint8Array) => {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

// 1980-01-01 00:00, the earliest DOS date; keeps output identical for identical input
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

const header = (size: number, write: (view: DataView) => void) => {
  const bytes = new Uint8Array(size);
  write(new DataView(bytes.buffer));
  return bytes;
};

export const buildZip = (files: { name: string; data: string | Uint8Array }[]): Uint8Array<ArrayBuffer> => {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = typeof file.data === 'string' ? encoder.encode(file.data) : file.data;
    const crc = crc32(data);
    const fields = (view: DataView, at: number) => {
      view.setUint16(at, 20, true);          // version needed
      view.setUint16(at + 2, 0x0800, true);  // UTF-8 names
      view.setUint16(at + 4, 0, true);       // stored
      view.setUint16(at + 6, DOS_TIME, true);
      view.setUint16(at + 8, DOS_DATE, true);
      view.setUint32(at + 10, crc, true);
      view.setUint32(at + 14, data.length, true);
      view.setUint32(at + 18, data.length, true);
      view.setUint16(at + 22, name.length, true);
    };
    const local = header(30, view => { view.setUint32(0, 0x04034b50, true); fields(view, 4); });
    central.push(header(46, view => {
      view.setUint32(0, 0x02014b50, true);
      view.setUint16(4, 20, true);           // version made by
      fields(view, 6);
      view.setUint32(42, offset, true);
    }), name);
    parts.push(local, name, data);
    offset += local.length + name.length + data.length;
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = header(22, view => {
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(8, files.length, true);
    view.setUint16(10, files.length, true);
    view.setUint32(12, centralSize, true);
    view.setUint32(16, offset, true);
  });

  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of all) { out.set(part, at); at += part.length; }
  return out;
};
