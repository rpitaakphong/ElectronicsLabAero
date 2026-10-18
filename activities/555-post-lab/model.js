import {
  createRecord,
  validateRecord,
  identityIssues,
  pairStudents,
  clone,
  downloadStem,
  MAX_TEXT_LENGTH,
} from '../555-main-lab/model.js';
import {
  createBackup,
  parseBackup,
  MAX_BACKUP_BYTES,
} from '../555-main-lab/attachments.js';
import { backupEntry, utf8 } from '../555-main-lab/archive.js';
import { validatePrelab, MAX_JSON_BYTES } from './prelab.js';
import { zipSync, strToU8 } from 'fflate';

export const ACTIVE_KEY = 'electronics-555-post-lab-active-v1';
export const FORMAT = '555-post-lab-backup';
export const PAGES = [
  'Import files',
  'Pre-lab evidence',
  'Main-lab results',
  'Analysis and conclusions',
  'Report',
];
export function createPostlab() {
  const blank = createRecord();
  return {
    activityId: '555-post-lab',
    schemaVersion: 1,
    recordId: blank.recordId,
    createdAt: blank.createdAt,
    updatedAt: blank.updatedAt,
    sources: { prelab: null, main: null },
    sourceNames: { prelab: '', main: '' },
    analysis: blank.analysis,
    optional: blank.optional,
    identityConfirmed: false,
    needsReview: false,
  };
}
export function validatePostlab(value) {
  const template = createPostlab();
  const shape = (actual, expected) =>
    actual &&
    typeof actual === 'object' &&
    !Array.isArray(actual) &&
    Object.keys(actual).length === Object.keys(expected).length &&
    Object.keys(expected).every((key) => Object.hasOwn(actual, key));
  if (
    !shape(value, template) ||
    value.activityId !== template.activityId ||
    value.schemaVersion !== 1 ||
    typeof value.recordId !== 'string' ||
    !value.recordId ||
    value.recordId.length > 200 ||
    ![value.createdAt, value.updatedAt].every(
      (at) => typeof at === 'string' && Number.isFinite(Date.parse(at)),
    ) ||
    typeof value.identityConfirmed !== 'boolean' ||
    typeof value.needsReview !== 'boolean'
  )
    throw new Error('Unsupported or incomplete individual post-lab backup.');
  for (const key of ['analysis', 'optional', 'sourceNames']) {
    if (
      !shape(value[key], template[key]) ||
      Object.values(value[key]).some(
        (text) => typeof text !== 'string' || text.length > MAX_TEXT_LENGTH,
      )
    )
      throw new Error(
        'An individual answer has an invalid format or exceeds 4,000 characters.',
      );
  }
  if (!shape(value.sources, template.sources))
    throw new Error('Invalid post-lab source sections.');
  const result = clone(value);
  if (value.sources.prelab !== null) {
    if (
      new TextEncoder().encode(JSON.stringify(value.sources.prelab)).length >
      MAX_JSON_BYTES
    )
      throw new Error('Pre-lab evidence exceeds 2 MiB.');
    result.sources.prelab = validatePrelab(value.sources.prelab);
  }
  if (value.sources.main !== null) {
    if (value.sources.main.schemaVersion !== 3)
      throw new Error(
        'Open the earlier main-lab backup in the main worksheet, confirm both students and add their IDs, then download a new ZIP.',
      );
    result.sources.main = validateRecord(value.sources.main);
  }
  return result;
}
export function issues(record, confirmation = true) {
  const list = [],
    pre = record.sources.prelab,
    main = record.sources.main;
  if (!pre) list.push('Import your own finalized pre-lab evidence.');
  if (!main) list.push('Import the pair’s main-lab ZIP or JSON backup.');
  if (main) list.push(...identityIssues(main));
  if (
    pre &&
    main &&
    pairStudents(main).filter(
      (s) => s.id.trim() === pre.student.university_student_id.trim(),
    ).length !== 1
  )
    list.push(
      'The pre-lab student ID must match exactly one student in the pair.',
    );
  if (confirmation && !record.identityConfirmed)
    list.push(
      'Confirm that these are your own pre-lab and your pair’s results.',
    );
  if (confirmation && record.needsReview)
    list.push(
      'Review your analysis after replacing source data, then confirm the review.',
    );
  return list;
}
export function withSource(record, kind, source, filename) {
  const old = record.sources[kind];
  if (
    kind === 'prelab' &&
    old &&
    old.student.university_student_id.trim() !==
      source.student.university_student_id.trim()
  )
    throw new Error(
      'This pre-lab belongs to a different student. Start a new individual workspace; existing writing will not be assigned to another student.',
    );
  if (kind === 'main' && old && old.group.id.trim() !== source.group.id.trim())
    throw new Error(
      'This file belongs to a different group. Start a new individual workspace first.',
    );
  const next = clone(record);
  next.sources[kind] = clone(source);
  next.sourceNames[kind] = filename.slice(0, 4000);
  next.identityConfirmed = false;
  if (old && Object.values(record.analysis).some((text) => text.trim()))
    next.needsReview = true;
  next.updatedAt = new Date().toISOString();
  return validatePostlab(next);
}
export function postlabFilename(record) {
  const student = record.sources.prelab?.student;
  return downloadStem('555_POST_LAB', record.sources.main?.group.id || '', [
    {
      name: student?.full_name || '',
      id: student?.university_student_id || '',
    },
  ]);
}
export async function postlabBackup(record, images) {
  const valid = validatePostlab(record);
  const main = valid.sources.main
    ? await createBackup(valid.sources.main, images)
    : null;
  if (!main && Object.keys(images).length)
    throw new Error('Images cannot exist without their main-lab record.');
  return {
    format: FORMAT,
    backupVersion: 1,
    record: valid,
    images: main?.images || [],
  };
}
export async function parsePostlabFile(bytes, decode) {
  let files, name, text;
  if (bytes[0] === 80 && bytes[1] === 75)
    ({ files, name, text } = backupEntry(bytes));
  else text = utf8(bytes);
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES)
    throw new Error('Individual JSON backup exceeds 64 MiB.');
  const value = JSON.parse(text);
  if (
    value?.format !== FORMAT ||
    value.backupVersion !== 1 ||
    !Array.isArray(value.images)
  )
    throw new Error('Choose an individual post-lab backup, not a source file.');
  const record = validatePostlab(value.record);
  const main = record.sources.main
    ? await parseBackup(
        JSON.stringify({
          format: '555-main-lab-backup',
          backupVersion: 2,
          record: record.sources.main,
          images: value.images,
        }),
        decode,
      )
    : null;
  if (!main && value.images.length)
    throw new Error('Orphaned screenshot data.');
  const images = main?.images || {};
  if (main) record.sources.main = main.record;
  if (files) {
    const allowed = new Set([name, 'screenshots/']);
    for (const image of Object.values(images)) {
      const path = `screenshots/${image.filename}`,
        original = files.get(path),
        embedded = new Uint8Array(await image.blob.arrayBuffer());
      allowed.add(path);
      if (
        !original ||
        original.length !== embedded.length ||
        original.some((b, i) => b !== embedded[i])
      )
        throw new Error('ZIP screenshot integrity check failed.');
    }
    if (
      [...files.keys()].some((key) => !allowed.has(key)) ||
      files.get('screenshots/')?.length ||
      0
    )
      throw new Error('Unexpected individual ZIP contents.');
  }
  return { record, images };
}
export async function postlabZip(record, images) {
  const backup = await postlabBackup(record, images);
  const files = {
    [`${postlabFilename(record)}.json`]: strToU8(
      JSON.stringify(backup, null, 2),
    ),
    'screenshots/': new Uint8Array(),
  };
  for (const image of Object.values(images))
    files[`screenshots/${image.filename}`] = new Uint8Array(
      await image.blob.arrayBuffer(),
    );
  return zipSync(files, { level: 0 });
}
