// Bounded stored-entry reader for original worksheet ZIPs and self-contained post-lab backups.
// Do not extract paths to disk or inflate arbitrary third-party archives.
export const MAX_ZIP_BYTES = 256 * 1024 * 1024;
const decoder = new TextDecoder('utf-8', { fatal: true });
export const utf8 = (bytes) => decoder.decode(bytes);
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function readArchive(bytes) {
  if (bytes.length < 22 || bytes.length > MAX_ZIP_BYTES)
    throw new Error('ZIP is truncated or exceeds 256 MiB.');
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (n) => v.getUint16(n, true),
    u32 = (n) => v.getUint32(n, true);
  const end = bytes.length - 22;
  if (u32(end) !== 0x06054b50 || u16(end + 20) || u16(end + 4) || u16(end + 6))
    throw new Error('Unsupported ZIP directory.');
  const count = u16(end + 10),
    offset = u32(end + 16);
  if (
    !count ||
    count > 100 ||
    u16(end + 8) !== count ||
    offset + u32(end + 12) !== end
  )
    throw new Error('ZIP contains unexpected entries.');
  const entries = new Map();
  let cursor = offset,
    localEnd = 0,
    total = 0;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || u32(cursor) !== 0x02014b50)
      throw new Error('Invalid ZIP directory entry.');
    const flags = u16(cursor + 8),
      method = u16(cursor + 10),
      crc = u32(cursor + 16),
      size = u32(cursor + 24);
    const nameSize = u16(cursor + 28),
      extra = u16(cursor + 30),
      comment = u16(cursor + 32),
      local = u32(cursor + 42);
    const attributes = u32(cursor + 38);
    if (
      flags & ~0x0800 ||
      method !== 0 ||
      u32(cursor + 20) !== size ||
      u16(cursor + 34) ||
      ((attributes >>> 16) & 0xf000) === 0xa000
    )
      throw new Error(
        'Encrypted, compressed, spanned or linked ZIP entries are not accepted. Use the worksheet’s original ZIP.',
      );
    if (
      cursor + 46 + nameSize + extra + comment > end ||
      local !== localEnd ||
      local + 30 > offset
    )
      throw new Error('Invalid ZIP bounds.');
    const name = utf8(bytes.subarray(cursor + 46, cursor + 46 + nameSize));
    if (
      !name ||
      name.includes('..') ||
      name.startsWith('/') ||
      name.includes('\\') ||
      name.includes('\0') ||
      entries.has(name)
    )
      throw new Error('Unsafe or duplicate ZIP filename.');
    if (
      u32(local) !== 0x04034b50 ||
      u16(local + 6) !== flags ||
      u16(local + 8) !== method ||
      u32(local + 14) !== crc ||
      u32(local + 18) !== size ||
      u32(local + 22) !== size ||
      u16(local + 26) !== nameSize
    )
      throw new Error('ZIP headers disagree.');
    if (utf8(bytes.subarray(local + 30, local + 30 + nameSize)) !== name)
      throw new Error('ZIP filenames disagree.');
    const start = local + 30 + nameSize + u16(local + 28);
    total += size;
    if (
      start + size > offset ||
      total > MAX_ZIP_BYTES ||
      size > MAX_ZIP_BYTES
    )
      throw new Error('ZIP entry exceeds supported bounds.');
    const data = bytes.subarray(start, start + size);
    if (crc32(data) !== crc) throw new Error('ZIP integrity check failed.');
    entries.set(name, data);
    localEnd = start + size;
    cursor += 46 + nameSize + extra + comment;
  }
  if (cursor !== end || localEnd !== offset)
    throw new Error('ZIP has extra or missing data.');
  return entries;
}
