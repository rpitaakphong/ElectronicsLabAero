import { zipSync, strToU8 } from 'fflate';
import { REQUIRED_CAPTURES, MAX_RECORD_BYTES, parseRecord, validateRecord } from './model.js';
import { backupEntry, utf8 } from './archive.js';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_BACKUP_BYTES = 64 * 1024 * 1024;
export const BACKUP_FORMAT = '555-main-lab-backup';
/** @typedef {{blob: Blob, filename: string, type: string}} Attachment */
/** @typedef {Record<string, Attachment>} Attachments */
const formats = {
  png: { type: 'image/png', extensions: ['png'] },
  jpeg: { type: 'image/jpeg', extensions: ['jpg', 'jpeg'] },
  bmp: { type: 'image/bmp', extensions: ['bmp'] },
  webp: { type: 'image/webp', extensions: ['webp'] },
};

export function imageFormat(bytes) {
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)) return 'png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpeg';
  if (bytes.length >= 14 && bytes[0] === 66 && bytes[1] === 77) return 'bmp';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'webp';
  throw new Error('Choose a PNG, JPEG, BMP or WebP image. SVG and other file types are not accepted.');
}
export function imageName(slot, format, originalName) {
  const index = REQUIRED_CAPTURES.indexOf(slot);
  if (index < 0 || !formats[format]) throw new Error('Unknown screenshot slot or image format.');
  const extension = originalName.split('.').at(-1).toLowerCase();
  const suffix = formats[format].extensions.includes(extension) ? extension : formats[format].extensions[0];
  return `Screenshot_${index + 1}_Lab_${index + 1}.${suffix}`;
}
// Decode the actual bytes, never trust the file extension or supplied MIME type.
export function decodeImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob), image = new Image();
    const timeout = setTimeout(() => finish(false), 10000);
    const finish = (ok) => {
      clearTimeout(timeout);
      image.onload = image.onerror = null;
      image.src = '';
      URL.revokeObjectURL(url);
      if (ok) resolve(true);
      else reject(new Error('This image is corrupt or cannot be opened. Choose another image.'));
    };
    image.onload = () => finish(image.naturalWidth > 0 && image.naturalHeight > 0);
    image.onerror = () => finish(false);
    image.src = url;
  });
}
export async function validateImage(slot, blob, originalName, decode = decodeImage) {
  if (!blob.size || blob.size > MAX_IMAGE_BYTES) throw new Error('Each image must be non-empty and no larger than 10 MiB.');
  const format = imageFormat(new Uint8Array(await blob.slice(0, 16).arrayBuffer()));
  const type = formats[format].type;
  // Detach from the file chooser's temporary File backing before persistence.
  const typedBlob = new Blob([await blob.arrayBuffer()], { type });
  await decode(typedBlob);
  return { blob: typedBlob, type, filename: imageName(slot, format, originalName) };
}
function base64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
function unbase64(value) {
  if (typeof value !== 'string' || value.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error('Invalid embedded image data.');
  const binary = atob(value);
  if (btoa(binary) !== value) throw new Error('Invalid embedded image data.');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
export async function createBackup(record, images) {
  const valid = validateRecord(record);
  const entries = await Promise.all(REQUIRED_CAPTURES.filter((slot) => images[slot]).map(async (slot) => {
    const image = images[slot];
    valid.evidence[slot].filename = image.filename;
    return { slot, filename: image.filename, type: image.type, data: base64(new Uint8Array(await image.blob.arrayBuffer())) };
  }));
  return { format: BACKUP_FORMAT, backupVersion: 2, record: valid, images: entries };
}
export async function parseBackup(text, decode = decodeImage) {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error('The backup exceeds the 64 MiB limit.');
  let value;
  try { value = JSON.parse(text); } catch { throw new Error('This is not a readable JSON backup.'); }
  if (value?.format !== BACKUP_FORMAT) return { record: parseRecord(text), images: {}, migrated: value?.schemaVersion === 2 };
  if (![1, 2].includes(value.backupVersion) || !Array.isArray(value.images) || value.images.length > 3) throw new Error('Unsupported image backup format.');
  if (new TextEncoder().encode(JSON.stringify(value.record)).length > MAX_RECORD_BYTES) throw new Error('The answer record exceeds the 8 MiB limit.');
  const record = validateRecord(value.record);
  /** @type {Attachments} */
  const images = {};
  for (const item of value.images) {
    if (!item || !REQUIRED_CAPTURES.includes(item.slot) || images[item.slot] || typeof item.filename !== 'string') throw new Error('Invalid or duplicate screenshot entry.');
    const image = await validateImage(item.slot, new Blob([unbase64(item.data)]), item.filename, decode);
    if (image.type !== item.type || image.filename !== item.filename) throw new Error('The screenshot name or type does not match its image data.');
    images[item.slot] = image;
    record.evidence[item.slot].filename = image.filename;
  }
  return { record, images, migrated: value.record.schemaVersion === 2 };
}
export async function createLabZip(record, images, backupName) {
  const backup = await createBackup(record, images);
  const files = { [backupName]: strToU8(JSON.stringify(backup, null, 2)), 'screenshots/': new Uint8Array() };
  for (const slot of REQUIRED_CAPTURES) {
    if (images[slot]) files[`screenshots/${images[slot].filename}`] = new Uint8Array(await images[slot].blob.arrayBuffer());
  }
  // Store original bytes, without re-encoding or recompressing the images.
  return zipSync(files, { level: 0 });
}
export async function parseMainFile(bytes, decode = decodeImage) {
  if (bytes[0] !== 80 || bytes[1] !== 75) return parseBackup(utf8(bytes), decode);
  const { files, text, name } = backupEntry(bytes);
  const parsed = await parseBackup(text, decode);
  const expected = new Set([name, 'screenshots/']);
  for (const slot of REQUIRED_CAPTURES) if (parsed.images[slot]) {
    const image = parsed.images[slot], path = `screenshots/${image.filename}`;
    expected.add(path);
    const original = files.get(path), embedded = new Uint8Array(await image.blob.arrayBuffer());
    if (!original || original.length !== embedded.length || original.some((byte, i) => byte !== embedded[i])) throw new Error('ZIP screenshots do not match the embedded backup.');
  }
  if ([...files.keys()].some((key) => !expected.has(key)) || (files.get('screenshots/')?.length || 0)) throw new Error('Unexpected ZIP file. Choose the original worksheet download.');
  return parsed;
}

// One atomic entry per record ID, so imports never merge another group's files.
/** @param {IDBFactory | null} [factory] */
export function imageStore(factory, databaseName = 'electronics-555-main-lab-images') {
  let database;
  async function open() {
    // Access itself can throw in restricted/private browser contexts.
    if (factory === undefined) factory = globalThis.indexedDB;
    if (!factory) throw new Error('Image storage is unavailable.');
    if (!database) database = new Promise((resolve, reject) => {
      const request = factory.open(databaseName, 1);
      const timeout = setTimeout(() => reject(new Error('Image storage did not respond.')), 5000);
      request.onupgradeneeded = () => request.result.createObjectStore('workbooks');
      request.onerror = () => { clearTimeout(timeout); reject(request.error); };
      request.onblocked = () => { clearTimeout(timeout); reject(new Error('Image storage is blocked.')); };
      request.onsuccess = () => { clearTimeout(timeout); resolve(request.result); };
    });
    return database;
  }
  async function transact(recordId, images, write) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('workbooks', write ? 'readwrite' : 'readonly');
      const store = transaction.objectStore('workbooks');
      const request = write ? store.put(images, recordId) : store.get(recordId);
      const timeout = setTimeout(() => { transaction.abort(); }, 5000);
      transaction.oncomplete = () => { clearTimeout(timeout); resolve(write ? undefined : request.result || {}); };
      transaction.onabort = transaction.onerror = () => { clearTimeout(timeout); reject(transaction.error || new Error('Image storage failed.')); };
    });
  }
  return { read: (recordId) => transact(recordId, null, false), write: (recordId, images) => transact(recordId, images, true) };
}
