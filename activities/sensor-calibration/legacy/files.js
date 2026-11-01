import { zipSync, strToU8 } from 'fflate';
import { imageFormat, decodeImage, imageStore } from '../../555-main-lab/attachments.js';
import { readArchive, utf8 } from '../archive.js';
import { VERSION, ATTACHMENTS, namespace, validateRecord, rawCSV, uncertaintyCSV } from './model.js';

export const MAX_IMAGE = 10 * 1024 * 1024;
export const MAX_TOTAL = 32 * 1024 * 1024;
export const MAX_GROUP = 96 * 1024 * 1024;
export const MAX_FILE = 256 * 1024 * 1024;
const format = kind => `sensor-calibration-${kind}-backup`;
const types = { png: 'image/png', jpeg: 'image/jpeg', bmp: 'image/bmp', webp: 'image/webp' };
const imageBytes = new WeakMap();
export const store = (kind, factory) => imageStore(factory, namespace(kind));
// WebKit private contexts can store typed arrays in IndexedDB but reject Blobs.
// Cache detached bytes per immutable Blob so ordinary text edits do not reread images.
export async function persistentFiles(files) {
  const result = {};
  for (const [slot, f] of Object.entries(files)) {
    if (!imageBytes.has(f.blob)) imageBytes.set(f.blob, f.blob.arrayBuffer().then(buffer => new Uint8Array(buffer)));
    result[slot] = { bytes: await imageBytes.get(f.blob), filename: f.filename, type: f.type };
  }
  return result;
}
function encode(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function decode(s, limit) {
  if (typeof s !== 'string' || s.length > Math.ceil(limit / 3) * 4 || s.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw new Error('Invalid embedded file data.');
  const binary = atob(s);
  if (btoa(binary) !== s || binary.length > limit) throw new Error('Invalid embedded file size.');
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
export async function validateAttachment(kind, slot, blob, decodePicture = decodeImage) {
  if (!Object.hasOwn(ATTACHMENTS[kind], slot) || !blob.size || blob.size > MAX_IMAGE) throw new Error('Choose a PNG, JPEG, BMP or WebP image up to 10 MiB.');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const extension = imageFormat(bytes), type = types[extension];
  const detached = new Blob([bytes], { type });
  await decodePicture(detached);
  return { blob: detached, filename: `${slot}.${extension}`, type };
}
export function checkFiles(files) {
  if (Object.values(files).reduce((n, f) => n + f.blob.size, 0) > MAX_TOTAL) throw new Error('Images exceed the 32 MiB workbook limit. Use smaller images.');
}
export async function createBackup(kind, record, files, source = null) {
  checkFiles(files);
  const backup = { format: format(kind), backupVersion: VERSION, record: validateRecord(record, kind), attachments: [], source: null };
  for (const [slot, f] of Object.entries(files)) {
    if (!Object.hasOwn(ATTACHMENTS[kind], slot)) throw new Error('Unknown image slot.');
    backup.attachments.push({ slot, filename: f.filename, type: f.type, data: encode(new Uint8Array(await f.blob.arrayBuffer())) });
  }
  if (source) {
    if (kind !== 'post' || !source.bytes.length || source.bytes.length > MAX_GROUP || typeof source.name !== 'string' || source.name.length > 255) throw new Error('Invalid group source.');
    backup.source = { name: source.name, data: encode(source.bytes) };
  }
  return backup;
}
export async function createZip(kind, record, files, source = null) {
  const backup = await createBackup(kind, record, files, source);
  /** @type {Record<string, Uint8Array>} */
  const entries = {};
  for (const item of backup.attachments) {
    item.path = `images/${item.filename}`;
    entries[item.path] = new Uint8Array(await files[item.slot].blob.arrayBuffer());
    delete item.data;
  }
  if (backup.source) {
    backup.source.path = source.bytes[0] === 80 && source.bytes[1] === 75 ? 'sources/group.zip' : 'sources/group.json';
    entries[backup.source.path] = source.bytes;
    delete backup.source.data;
  }
  entries['workbook.json'] = strToU8(JSON.stringify(backup, null, 2));
  entries['uncertainty_records.csv'] = strToU8(uncertaintyCSV(record, kind));
  if (kind === 'main') {
    entries['raw_data.csv'] = strToU8(rawCSV(record));
    if (record.fields.code) entries['uploaded_code.ino'] = strToU8(record.fields.code);
  }
  const bytes = zipSync(entries, { level: 0 });
  if (bytes.length > (kind === 'main' ? MAX_GROUP : MAX_FILE)) throw new Error('This ZIP exceeds the worksheet limit. Use smaller images.');
  return bytes;
}
const exact = (a, keys) => a && typeof a === 'object' && !Array.isArray(a) && Object.keys(a).sort((x, y) => x.localeCompare(y)).join('|') === [...keys].sort((x, y) => x.localeCompare(y)).join('|');
const matchesText = (actual, expected) => {
  const encoded = strToU8(expected);
  return actual && actual.length === encoded.length && actual.every((b, i) => b === encoded[i]);
};
async function parseEnvelope(value, kind, entries, decodePicture) {
  if (!exact(value, ['format', 'backupVersion', 'record', 'attachments', 'source']) || value.format !== format(kind) || value.backupVersion !== VERSION || !Array.isArray(value.attachments) || value.attachments.length > Object.keys(ATTACHMENTS[kind]).length) throw new Error(`Choose a Sensor Calibration ${kind === 'main' ? 'group main-lab' : 'individual post-lab'} JSON or ZIP backup.`);
  const record = validateRecord(value.record, kind), files = {}, expected = new Set(['workbook.json', 'uncertainty_records.csv']);
  for (const item of value.attachments) {
    if (!exact(item, ['slot', 'filename', 'type', entries ? 'path' : 'data']) || !Object.hasOwn(ATTACHMENTS[kind], item.slot) || Object.hasOwn(files, item.slot)) throw new Error('Invalid or duplicate image attachment.');
    let bytes;
    if (entries) {
      if (item.path !== `images/${item.filename}` || !entries.has(item.path)) throw new Error('Missing image attachment.');
      bytes = entries.get(item.path); expected.add(item.path);
    } else bytes = decode(item.data, MAX_IMAGE);
    const f = await validateAttachment(kind, item.slot, new Blob([bytes]), decodePicture);
    if (f.filename !== item.filename || f.type !== item.type) throw new Error('Image filename or type does not match its bytes.');
    files[item.slot] = f;
  }
  checkFiles(files);
  let source = null, parsedSource = null;
  if (value.source !== null) {
    if (kind !== 'post' || !exact(value.source, ['name', entries ? 'path' : 'data']) || typeof value.source.name !== 'string' || !value.source.name || value.source.name.length > 255) throw new Error('Invalid group source.');
    const item = value.source;
    if (entries && !['sources/group.zip', 'sources/group.json'].includes(item.path)) throw new Error('Invalid group source path.');
    const bytes = entries ? entries.get(item.path) : decode(item.data, MAX_GROUP);
    if (!bytes || !bytes.length || bytes.length > MAX_GROUP) throw new Error('The group source is missing or exceeds 96 MiB.');
    parsedSource = await parseFile(bytes, 'main', decodePicture);
    source = { name: item.name, bytes: bytes.slice() };
    if (entries) expected.add(item.path);
  }
  if (entries) {
    if (!matchesText(entries.get('uncertainty_records.csv'), uncertaintyCSV(record, kind))) throw new Error('Uncertainty CSV does not match the saved record.');
    if (kind === 'main') {
      expected.add('raw_data.csv');
      if (!matchesText(entries.get('raw_data.csv'), rawCSV(record))) throw new Error('Raw CSV does not match the saved measurements.');
      if (record.fields.code) {
        expected.add('uploaded_code.ino');
        if (!matchesText(entries.get('uploaded_code.ino'), record.fields.code)) throw new Error('Uploaded code does not match the saved record.');
      }
    }
    if ([...entries.keys()].some(k => !expected.has(k))) throw new Error('Unexpected files in this worksheet ZIP.');
  }
  return { record, files, source, parsedSource };
}
export async function parseFile(bytes, kind, decodePicture = decodeImage) {
  if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > (kind === 'main' ? MAX_GROUP : MAX_FILE)) throw new Error('This backup is empty or exceeds the worksheet size limit.');
  let value, entries = null;
  if (bytes[0] === 80 && bytes[1] === 75) {
    entries = readArchive(bytes);
    const json = entries.get('workbook.json');
    if (!json || json.length > 10 * 1024 * 1024) throw new Error('Missing or oversized worksheet manifest.');
    try { value = JSON.parse(utf8(json)); } catch { throw new Error('The worksheet manifest is not readable JSON.'); }
  } else {
    if (bytes.length > (kind === 'main' ? 64 : 192) * 1024 * 1024) throw new Error('JSON backup exceeds the supported size limit.');
    try { value = JSON.parse(utf8(bytes)); } catch { throw new Error('This is not a readable worksheet JSON backup.'); }
  }
  return parseEnvelope(value, kind, entries, decodePicture);
}
