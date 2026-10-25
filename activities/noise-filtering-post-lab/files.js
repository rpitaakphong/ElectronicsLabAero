import { zipSync, strToU8 } from 'fflate';
import { parseFile as parseMain } from '../noise-filtering-main-lab/files.js';
import { parsePrelabEvidence, parseWorkspaceBackup } from '../noise-filtering-prelab/integration/prelab-adapter.mjs';
import { imageStore } from '../555-main-lab/attachments.js';
import { readArchive, utf8, MAX_ZIP_BYTES } from './archive.js';
import { validateRecord, VERSION, DATABASE } from './model.js';

export const FORMAT = 'noise-filtering-post-lab-backup';
export const MAX_JSON = 140 * 1024 * 1024;
export const LIMITS = { main: 96 * 1024 * 1024, prelab: 2 * 1024 * 1024 };
/** @param {any} [factory] */
export const fileStore = (factory) => imageStore(factory, DATABASE);
const kinds = ['main', 'prelab'];
function equal(a, b) {
  if (a === b) return true;
  return a && b && typeof a === 'object' && typeof b === 'object' && Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => Object.hasOwn(b, k) && equal(a[k], b[k]));
}
/** @param {any} [decode] */
export async function parseSource(kind, bytes, decode) {
  if (!kinds.includes(kind) || bytes.length > LIMITS[kind] || bytes[0] !== 80 || bytes[1] !== 75) throw new Error('Choose the original worksheet ZIP within the supported size limit.');
  if (kind === 'main') return parseMain(bytes, decode);
  const entries = readArchive(bytes);
  const names = ['prelab_evidence.json', 'workspace_backup.json', 'prelab_report.txt'];
  if (entries.size !== names.length || names.some(n => !entries.has(n))) throw new Error('Choose your Noise and Filtering pre-lab ZIP containing its answers, workspace backup and report.');
  const prelab = parsePrelabEvidence(utf8(entries.get(names[0])));
  const { workspace } = parseWorkspaceBackup(utf8(entries.get(names[1])));
  if (prelab.package !== workspace.package || !equal(prelab.responses, workspace.fields) || !equal(prelab.originals, workspace.frozen) ||
      !equal(prelab.confirmations, workspace.checks) || (prelab.status === 'finalized') !== workspace.finalized ||
      prelab.created_client !== workspace.created || prelab.updated_client !== workspace.updated) throw new Error('The answers and workspace inside this pre-lab ZIP do not match. Use the original download.');
  utf8(entries.get(names[2]));
  return prelab;
}
/** @param {any} [decode] */
export async function validateSources(record, sources, decode) {
  if (!sources || typeof sources !== 'object' || Object.keys(sources).some(k => !kinds.includes(k))) throw new Error('Invalid source files.');
  const parsed = { main: null, prelab: null };
  for (const kind of kinds) {
    const meta = record.sources[kind], source = sources[kind];
    if (!!meta !== !!source) throw new Error('A source ZIP is missing. Restore a complete post-lab backup.');
    if (meta) {
      if (!(source.blob instanceof Blob) || source.blob.size > LIMITS[kind] || source.name !== meta.name) throw new Error('Source filename or size does not match the backup.');
      parsed[kind] = await parseSource(kind, new Uint8Array(await source.blob.arrayBuffer()), decode);
    }
  }
  return parsed;
}
const pathFor = kind => `sources/${kind === 'main' ? 'group_main_lab' : 'individual_pre_lab'}.zip`;
export function base64(bytes) {
  let value = '';
  for (let i = 0; i < bytes.length; i += 0x8000) value += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(value);
}
function unbase64(value, limit) {
  if (typeof value !== 'string' || value.length > Math.ceil(limit / 3) * 4 || value.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error('Invalid source encoding.');
  const binary = atob(value);
  if (btoa(binary) !== value) throw new Error('Invalid source encoding.');
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
export async function createBackup(record, sources) {
  const valid = validateRecord(record), files = [];
  for (const kind of kinds) {
    if (!!valid.sources[kind] !== !!sources[kind]) throw new Error('A source ZIP is unavailable. Restore it before making a complete backup.');
    if (sources[kind]) {
      const source = sources[kind];
      if (source.name !== valid.sources[kind].name || source.blob.size > LIMITS[kind]) throw new Error('Invalid source file.');
      files.push({ kind, name: source.name, data: base64(new Uint8Array(await source.blob.arrayBuffer())) });
    }
  }
  return { format: FORMAT, backupVersion: VERSION, record: valid, files };
}
export async function createZip(record, sources) {
  const entries = { 'post_lab_backup.json': strToU8(JSON.stringify(await createBackup(record, sources))), 'sources/': new Uint8Array() };
  for (const kind of kinds) if (sources[kind]) entries[pathFor(kind)] = new Uint8Array(await sources[kind].blob.arrayBuffer());
  const bytes = zipSync(entries, { level: 0 });
  if (bytes.length > MAX_ZIP_BYTES) throw new Error('Post-lab ZIP exceeds 256 MiB.');
  return bytes;
}
/** @param {any} [decode] */
export async function parseBackup(bytes, decode) {
  if (bytes.length > MAX_ZIP_BYTES) throw new Error('Post-lab backup exceeds 256 MiB.');
  const entries = bytes[0] === 80 && bytes[1] === 75 ? readArchive(bytes) : null;
  const json = entries ? entries.get('post_lab_backup.json') : bytes;
  if (!json || json.length > MAX_JSON) throw new Error('Choose a post-lab JSON or ZIP backup.');
  let value;
  try { value = JSON.parse(utf8(json)); } catch { throw new Error('The post-lab backup is not readable JSON.'); }
  if (value?.format !== FORMAT || value.backupVersion !== VERSION || !Array.isArray(value.files) || value.files.length > 2) throw new Error('This is not a Noise and Filtering individual post-lab backup. Load group and pre-lab ZIPs in Section 1.');
  const record = validateRecord(value.record), sources = {};
  for (const file of value.files) {
    if (!kinds.includes(file.kind) || Object.hasOwn(sources, file.kind) || file.name !== record.sources[file.kind]?.name) throw new Error('Invalid or duplicate source in backup.');
    sources[file.kind] = { name: file.name, blob: new Blob([unbase64(file.data, LIMITS[file.kind])], { type: 'application/zip' }) };
  }
  const parsed = await validateSources(record, sources, decode);
  if (entries) {
    const expected = ['post_lab_backup.json', 'sources/', ...Object.keys(sources).map(pathFor)];
    if (entries.size !== expected.length || expected.some(n => !entries.has(n)) || entries.get('sources/').length) throw new Error('Unexpected or missing files in post-lab ZIP.');
    for (const kind of Object.keys(sources)) {
      const embedded = new Uint8Array(await sources[kind].blob.arrayBuffer()), separate = entries.get(pathFor(kind));
      if (embedded.length !== separate.length || embedded.some((b, i) => b !== separate[i])) throw new Error('Source ZIP bytes differ from the complete backup.');
    }
  }
  return { record, sources, parsed };
}
