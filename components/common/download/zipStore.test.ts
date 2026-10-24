import { describe, it, expect } from 'vitest';
import { buildZip, crc32 } from './zipStore';

describe('zipStore', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789')).toString(16)).toBe('cbf43926');
  });

  it('writes local headers, a central directory and the end record', () => {
    const zip = buildZip([{ name: 'a.txt', data: 'hello' }, { name: 'dir/b.xml', data: '<x/>' }]);
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    const end = zip.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    const centralStart = view.getUint32(end + 16, true);
    expect(view.getUint32(centralStart, true)).toBe(0x02014b50);
    expect(new TextDecoder().decode(zip)).toContain('hello');
    expect(view.getUint32(14, true)).toBe(crc32(new TextEncoder().encode('hello')));
  });
});
