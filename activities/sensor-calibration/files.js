import { zipSync, strToU8 } from 'fflate';
import {
  imageFormat,
  decodeImage,
  imageStore,
} from '../555-main-lab/attachments.js';
import { readArchive, utf8 } from './archive.js';
import {
  VERSION,
  ATTACHMENTS,
  FILE_KINDS,
  namespace,
  validateRecord,
  uncertaintyCSV,
} from './model.js';
import { parseFile as parseLegacyFile } from './legacy/files.js';
export {
  store as legacyStore,
  createBackup as legacyBackup,
  createZip as legacyZip,
} from './legacy/files.js';
export const MAX_IMAGE = 10 * 1024 * 1024,
  MAX_CODE = 1024 * 1024,
  MAX_CSV = 5 * 1024 * 1024,
  MAX_TOTAL = 32 * 1024 * 1024,
  MAX_GROUP = 96 * 1024 * 1024,
  MAX_FILE = 256 * 1024 * 1024;
const format = (kind) => `sensor-calibration-${kind}-backup`;
const types = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  bmp: 'image/bmp',
  webp: 'image/webp',
};
const fileBytes = new WeakMap();
export const store = (kind, factory) => imageStore(factory, namespace(kind));
export async function persistentFiles(files) {
  const result = {};
  for (const [slot, f] of Object.entries(files)) {
    if (!fileBytes.has(f.blob))
      fileBytes.set(
        f.blob,
        f.blob.arrayBuffer().then((b) => new Uint8Array(b)),
      );
    result[slot] = {
      bytes: await fileBytes.get(f.blob),
      filename: f.filename,
      originalName: f.originalName,
      type: f.type,
    };
  }
  return result;
}
function encode(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function decode(s, limit) {
  if (
    typeof s !== 'string' ||
    s.length > Math.ceil(limit / 3) * 4 ||
    s.length % 4 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(s)
  )
    throw new Error('Invalid embedded file data.');
  const b = atob(s);
  if (btoa(b) !== s || b.length > limit)
    throw new Error('Invalid embedded file size.');
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}
export function attachmentKind(kind, slot) {
  if (!Object.hasOwn(ATTACHMENTS[kind] || {}, slot))
    throw new Error('Unknown attachment.');
  return FILE_KINDS[slot] || 'image';
}
export async function validateAttachment(
  kind,
  slot,
  blob,
  decodePicture = decodeImage,
  originalName = blob.name || '',
) {
  const category = attachmentKind(kind, slot),
    limit =
      category === 'code' ? MAX_CODE : category === 'csv' ? MAX_CSV : MAX_IMAGE;
  if (!blob.size || blob.size > limit)
    throw new Error(
      category === 'image'
        ? 'Choose a PNG, JPEG, BMP or WebP image up to 10 MiB.'
        : `Choose a ${category === 'code' ? '.ino file up to 1' : '.csv file up to 5'} MiB.`,
    );
  if (typeof originalName !== 'string' || originalName.length > 255)
    throw new Error('The filename is too long.');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let extension, type, text;
  if (category === 'image') {
    extension = imageFormat(bytes);
    type = types[extension];
    await decodePicture(new Blob([bytes], { type }));
  } else {
    extension = category === 'code' ? 'ino' : 'csv';
    type = category === 'code' ? 'text/plain' : 'text/csv';
    if (originalName && !originalName.toLowerCase().endsWith(`.${extension}`))
      throw new Error(`Choose a .${extension} file.`);
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      throw new Error(
        'Save the text file using UTF-8 encoding, then upload it again.',
      );
    }
    if (text.includes('\0'))
      throw new Error('Choose a text file rather than a binary file.');
  }
  return {
    blob: new Blob([bytes], { type }),
    filename: `${slot}.${extension}`,
    originalName: originalName || `${slot}.${extension}`,
    type,
    ...(text === undefined ? {} : { text }),
  };
}
export function checkFiles(files) {
  if (Object.values(files).reduce((n, f) => n + f.blob.size, 0) > MAX_TOTAL)
    throw new Error(
      'Attachments exceed the 32 MiB workbook limit. Use smaller files.',
    );
}
// Keep earlier uploads while making the existing code and first photo available in the simpler form.
export function restoreGroupInputs(record, files, hadCodeField) {
  if (!record.activityId.endsWith('main')) return;
  if (!hadCodeField) record.fields.code = files.code?.text || '';
  if (!files.circuit) {
    const slot = ['circuit2', 'circuit3'].find((key) => files[key]);
    if (slot) {
      const file = files[slot];
      files.circuit = {
        ...file,
        filename: file.filename.replace(slot, 'circuit'),
      };
      delete files[slot];
    }
  }
}
export async function createBackup(kind, record, files, source = null) {
  checkFiles(files);
  const backup = {
    format: format(kind),
    backupVersion: VERSION,
    record: validateRecord(record, kind),
    attachments: [],
    source: null,
  };
  for (const [slot, f] of Object.entries(files)) {
    attachmentKind(kind, slot);
    backup.attachments.push({
      slot,
      filename: f.filename,
      originalName: f.originalName,
      type: f.type,
      data: encode(new Uint8Array(await f.blob.arrayBuffer())),
    });
  }
  if (source) {
    if (
      kind !== 'post' ||
      !(source.bytes instanceof Uint8Array) ||
      !source.bytes.length ||
      source.bytes.length > MAX_GROUP ||
      typeof source.name !== 'string' ||
      !source.name ||
      source.name.length > 255
    )
      throw new Error('Invalid group source.');
    backup.source = { name: source.name, data: encode(source.bytes) };
  }
  return backup;
}
export async function createZip(kind, record, files, source = null) {
  const backup = await createBackup(kind, record, files, source);
  /** @type {Record<string, Uint8Array>} */
  const entries = {};
  for (const f of backup.attachments) {
    f.path = `files/${f.filename}`;
    entries[f.path] = new Uint8Array(await files[f.slot].blob.arrayBuffer());
    delete f.data;
  }
  if (backup.source) {
    backup.source.path =
      source.bytes[0] === 80 && source.bytes[1] === 75
        ? 'sources/group.zip'
        : 'sources/group.json';
    entries[backup.source.path] = source.bytes;
    delete backup.source.data;
  }
  entries['workbook.json'] = strToU8(JSON.stringify(backup, null, 2));
  entries['uncertainty_records.csv'] = strToU8(uncertaintyCSV(record, kind));
  const bytes = zipSync(entries, { level: 0 });
  if (bytes.length > (kind === 'main' ? MAX_GROUP : MAX_FILE))
    throw new Error('This ZIP exceeds the worksheet limit. Use smaller files.');
  return bytes;
}
const exact = (a, keys) =>
  a &&
  typeof a === 'object' &&
  !Array.isArray(a) &&
  Object.keys(a)
    .sort((a, b) => a.localeCompare(b))
    .join('|') === [...keys].sort((a, b) => a.localeCompare(b)).join('|');
const matches = (actual, expected) => {
  const b = strToU8(expected);
  return (
    actual && actual.length === b.length && actual.every((v, i) => v === b[i])
  );
};
export async function parseFile(bytes, kind, decodePicture = decodeImage) {
  if (
    !(bytes instanceof Uint8Array) ||
    !bytes.length ||
    bytes.length > (kind === 'main' ? MAX_GROUP : MAX_FILE)
  )
    throw new Error(
      'This backup is empty or exceeds the worksheet size limit.',
    );
  let value,
    entries = null;
  if (bytes[0] === 80 && bytes[1] === 75) {
    entries = readArchive(bytes);
    const json = entries.get('workbook.json');
    if (!json || json.length > 10 * 1024 * 1024)
      throw new Error('Missing or oversized worksheet manifest.');
    try {
      value = JSON.parse(utf8(json));
    } catch {
      throw new Error('The worksheet manifest is not readable JSON.');
    }
  } else {
    if (bytes.length > (kind === 'main' ? 64 : 192) * 1024 * 1024)
      throw new Error('JSON backup exceeds the supported size limit.');
    try {
      value = JSON.parse(utf8(bytes));
    } catch {
      throw new Error('This is not a readable worksheet JSON backup.');
    }
  }
  if (value?.backupVersion === 1)
    return {
      ...(await parseLegacyFile(bytes, kind, decodePicture)),
      legacy: true,
    };
  if (
    !exact(value, [
      'format',
      'backupVersion',
      'record',
      'attachments',
      'source',
    ]) ||
    value.format !== format(kind) ||
    value.backupVersion !== VERSION ||
    !Array.isArray(value.attachments) ||
    value.attachments.length > Object.keys(ATTACHMENTS[kind]).length
  )
    throw new Error(
      'Choose a supported Sensor Calibration worksheet ZIP or JSON backup.',
    );
  const record = validateRecord(value.record, kind),
    files = {},
    expected = new Set(['workbook.json', 'uncertainty_records.csv']);
  for (const item of value.attachments) {
    if (
      !exact(item, [
        'slot',
        'filename',
        'originalName',
        'type',
        entries ? 'path' : 'data',
      ]) ||
      !Object.hasOwn(ATTACHMENTS[kind], item.slot) ||
      Object.hasOwn(files, item.slot)
    )
      throw new Error('Invalid or duplicate attachment.');
    const category = attachmentKind(kind, item.slot),
      limit =
        category === 'code'
          ? MAX_CODE
          : category === 'csv'
            ? MAX_CSV
            : MAX_IMAGE;
    let b;
    if (entries) {
      if (item.path !== `files/${item.filename}` || !entries.has(item.path))
        throw new Error('Missing attachment.');
      b = entries.get(item.path);
      expected.add(item.path);
    } else b = decode(item.data, limit);
    const f = await validateAttachment(
      kind,
      item.slot,
      new Blob([b]),
      decodePicture,
      item.originalName,
    );
    if (f.filename !== item.filename || f.type !== item.type)
      throw new Error('Attachment type or path does not match its contents.');
    files[item.slot] = f;
  }
  checkFiles(files);
  let source = null,
    parsedSource = null;
  if (value.source !== null) {
    if (
      kind !== 'post' ||
      !exact(value.source, ['name', entries ? 'path' : 'data']) ||
      typeof value.source.name !== 'string' ||
      !value.source.name ||
      value.source.name.length > 255
    )
      throw new Error('Invalid group source.');
    const s = value.source;
    if (
      entries &&
      !['sources/group.zip', 'sources/group.json'].includes(s.path)
    )
      throw new Error('Invalid group source path.');
    const b = entries ? entries.get(s.path) : decode(s.data, MAX_GROUP);
    if (!b || !b.length || b.length > MAX_GROUP)
      throw new Error('The group source is missing or oversized.');
    parsedSource = await parseFile(b, 'main', decodePicture);
    if (parsedSource.legacy)
      throw new Error(
        'Version-two individual work requires a version-two group source. Older work remains available through recovery.',
      );
    source = { name: s.name, bytes: b.slice() };
    if (entries) expected.add(s.path);
  }
  if (entries) {
    if (
      !matches(
        entries.get('uncertainty_records.csv'),
        uncertaintyCSV(record, kind),
      )
    )
      throw new Error('Uncertainty CSV does not match the saved record.');
    if ([...entries.keys()].some((k) => !expected.has(k)))
      throw new Error('Unexpected files in this worksheet ZIP.');
  }
  if (kind === 'main')
    restoreGroupInputs(
      record,
      files,
      Object.hasOwn(value.record.fields, 'code'),
    );
  return { record, files, source, parsedSource, legacy: false };
}
