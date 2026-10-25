import { zipSync, strToU8 } from 'fflate';
import { SLOT_IDS, validateRecord, DATABASE, codeEntries } from './model.js';
import { readArchive, utf8, MAX_ZIP_BYTES } from './archive.js';
import { imageFormat, decodeImage, imageStore } from '../555-main-lab/attachments.js';

export const FORMAT = 'noise-filtering-main-lab-backup';
export const MAX_JSON = 64 * 1024 * 1024;
export const MAX_TOTAL = 32 * 1024 * 1024;
export const MAX_CSV = 5 * 1024 * 1024;
export const MAX_IMAGE = 10 * 1024 * 1024;
export const fileStore = (factory) => imageStore(factory, DATABASE);
const types = { png: 'image/png', jpeg: 'image/jpeg', bmp: 'image/bmp', webp: 'image/webp' };
export function pathFor(slot, file) { return `${slot.endsWith('.csv') ? 'data' : 'screenshots'}/${file.filename}`; }
export async function validateFile(slot, blob, originalName, decode = decodeImage) {
  if (!SLOT_IDS.includes(slot) || typeof originalName !== 'string' || originalName.length > 255) throw new Error('Unknown evidence slot or invalid filename.');
  const csv = slot.endsWith('.csv');
  if (!blob.size || blob.size > (csv ? MAX_CSV : MAX_IMAGE)) throw new Error(csv ? 'Choose a non-empty CSV no larger than 5 MiB.' : 'Choose a non-empty image no larger than 10 MiB.');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let extension, type;
  if (csv) {
    if (!/\.csv$/i.test(originalName)) throw new Error('Choose a CSV recording.');
    let text;
    try { text = utf8(bytes).replace(/^\uFEFF/, ''); } catch { throw new Error('CSV must be readable UTF-8 text.'); }
    for (const c of text) if (c.charCodeAt(0) < 32 && !['\t', '\n', '\r'].includes(c)) throw new Error('CSV contains binary/control data.');
    const lines = text.split(/\r?\n/).filter((line) => line.trim() && !line.startsWith('#'));
    if (lines.length < 2 || !/[,;\t]/.test(lines[0])) throw new Error('CSV needs a delimited header and data rows. Keep the complete recording.');
    extension = 'csv'; type = 'text/csv';
  } else {
    extension = imageFormat(bytes); type = types[extension];
    await decode(new Blob([bytes], { type }));
  }
  return { blob: new Blob([bytes], { type }), type, originalName, filename: `${slot.replace('.', '_')}.${extension}` };
}
export function checkTotal(files) {
  if (Object.keys(files).length > SLOT_IDS.length || Object.values(files).reduce((sum, f) => sum + f.blob.size, 0) > MAX_TOTAL) throw new Error('Attachments exceed the 32 MiB workbook limit. Use smaller scope images or split unnecessary recordings.');
}
function base64(bytes) {
  let value = '';
  for (let i = 0; i < bytes.length; i += 0x8000) value += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(value);
}
function unbase64(value) {
  if (typeof value !== 'string' || value.length > Math.ceil(MAX_IMAGE / 3) * 4 || value.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error('Invalid attachment encoding.');
  const binary = atob(value);
  if (btoa(binary) !== value) throw new Error('Invalid attachment encoding.');
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
export async function createBackup(record, files) {
  checkTotal(files);
  const attachments = await Promise.all(Object.entries(files).map(async ([slot, f]) => ({ slot, filename: f.filename, originalName: f.originalName, type: f.type, data: base64(new Uint8Array(await f.blob.arrayBuffer())) })));
  return { format: FORMAT, backupVersion: 2, record: validateRecord({ ...record, fileSlots: Object.keys(files) }), attachments };
}
export async function parseBackup(text, decode = decodeImage) {
  if (new TextEncoder().encode(text).length > MAX_JSON) throw new Error('JSON exceeds 64 MiB.');
  let value;
  try { value = JSON.parse(text); } catch { throw new Error('This is not readable JSON.'); }
  if (value?.format === FORMAT && value.backupVersion === 1) throw new Error('This is a legacy LDR v1 backup. Open the legacy worksheet linked on page 1 to restore it; current answers have not changed.');
  if (value?.format !== FORMAT || value.backupVersion !== 2 || !Array.isArray(value.attachments) || value.attachments.length > SLOT_IDS.length) throw new Error('Choose a Noise and Filtering aircraft main-lab v2 backup. Individual pre-lab and 555 files are not imported here.');
  const record = validateRecord(value.record), files = {};
  for (const item of value.attachments) {
    if (!item || !SLOT_IDS.includes(item.slot) || Object.hasOwn(files, item.slot)) throw new Error('Invalid or duplicate attachment slot.');
    const file = await validateFile(item.slot, new Blob([unbase64(item.data)]), item.originalName, decode);
    if (file.type !== item.type || file.filename !== item.filename) throw new Error('Attachment metadata does not match its bytes.');
    files[item.slot] = file;
    checkTotal(files);
  }
  if (record.fileSlots.length !== Object.keys(files).length || record.fileSlots.some((slot) => !files[slot])) throw new Error('Backup is missing declared evidence.');
  return { record, files };
}
export async function createZip(record, files) {
  const backup = await createBackup(record, files);
  const entries = { 'main_lab_backup.json': strToU8(JSON.stringify(backup, null, 2)), 'screenshots/': new Uint8Array(), 'data/': new Uint8Array(), 'code/': new Uint8Array() };
  for (const [name, source] of Object.entries(codeEntries(backup.record))) entries[name] = strToU8(source);
  for (const [slot, f] of Object.entries(files)) entries[pathFor(slot, f)] = new Uint8Array(await f.blob.arrayBuffer());
  const bytes = zipSync(entries, { level: 0 });
  if (bytes.length > MAX_ZIP_BYTES) throw new Error('ZIP exceeds 96 MiB.');
  return bytes;
}
export async function parseFile(bytes, decode = decodeImage) {
  if (bytes.length > MAX_ZIP_BYTES) throw new Error('File exceeds 96 MiB.');
  if (bytes[0] !== 80 || bytes[1] !== 75) return parseBackup(utf8(bytes), decode);
  const entries = readArchive(bytes), backup = entries.get('main_lab_backup.json');
  if (!backup) throw new Error('ZIP is not a Noise and Filtering main-lab download.');
  const result = await parseBackup(utf8(backup), decode);
  const expected = new Set(['main_lab_backup.json', 'screenshots/', 'data/', 'code/']);
  for (const [name, source] of Object.entries(codeEntries(result.record))) {
    expected.add(name);
    const actual = entries.get(name), original = strToU8(source);
    if (!actual || actual.length !== original.length || actual.some((b, i) => b !== original[i])) throw new Error('ZIP code differs from its backup. Keep the original download intact.');
  }
  for (const [slot, f] of Object.entries(result.files)) {
    const path = pathFor(slot, f), actual = entries.get(path), embedded = new Uint8Array(await f.blob.arrayBuffer());
    if (!actual || actual.length !== embedded.length || actual.some((b, i) => b !== embedded[i])) throw new Error('ZIP evidence differs from its backup.');
    expected.add(path);
  }
  if (entries.size !== expected.size || [...entries.keys()].some((name) => !expected.has(name)) || entries.get('screenshots/')?.length !== 0 || entries.get('data/')?.length !== 0 || entries.get('code/')?.length !== 0) throw new Error('ZIP contains unexpected or missing files.');
  return result;
}
