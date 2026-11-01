import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { zipSync, strToU8 } from 'fflate';
import {
  createRecord,
  validateRecord,
  DISTANCES,
  namespace,
  addAttempt,
  parseRectangle,
  pasteReadings,
  numericIssue,
  readingIssue,
  rawCSV,
  draftIssues,
} from '../activities/sensor-calibration/legacy/model.js';
import {
  createBackup,
  createZip,
  parseFile,
  validateAttachment,
  persistentFiles,
  MAX_IMAGE,
  checkFiles,
} from '../activities/sensor-calibration/legacy/files.js';
import { readArchive } from '../activities/sensor-calibration/archive.js';

const bytes = (value) => new TextEncoder().encode(JSON.stringify(value));
const decodeFixture = async () => true;
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
const state = (kind) => ({
  kind,
  record: createRecord(kind),
  files: {},
  source: null,
  parsedSource: null,
  urls: {},
});
function syntheticMain() {
  const r = createRecord('main');
  r.fields.groupId = 'SYNTHETIC QA';
  r.fields.member1Name = 'Synthetic Student';
  r.fields.member1Id = '000123';
  r.fields.code =
    '// Synthetic fixture text, not a hardware measurement\nvoid loop() {}';
  r.measurements.forEach((row) => {
    row.reference = String(row.nominal);
    row.readings.forEach((a, i) => {
      a.value = String(200 + i);
    });
  });
  return r;
}
test('three distinct runs contain 108 planned echoes; held-out and movement sets stay separate', () => {
  const r = createRecord('main');
  for (const run of [1, 2, 3])
    assert.deepEqual(
      r.measurements
        .filter((row) => row.id.startsWith(`r${run}`))
        .map((row) => row.nominal),
      DISTANCES,
    );
  assert.equal(
    r.measurements
      .filter((row) => row.id.startsWith('r'))
      .flatMap((row) => row.readings).length,
    108,
  );
  assert.deepEqual(
    r.measurements
      .filter((row) => row.id.startsWith('v'))
      .map((row) => row.nominal),
    [25, 45],
  );
  assert.deepEqual(
    r.measurements
      .filter((row) => row.id.startsWith('small-'))
      .map((row) => row.nominal),
    [30, 30.5, 30],
  );
  assert.equal(r.measurements.length, 23);
  assert.notEqual(namespace('main'), namespace('post'));
});
test('record validation preserves literal incomplete answers, leading-zero IDs and unknown numeric text', () => {
  const r = syntheticMain();
  r.measurements[0].readings[0].value = 'perhaps 12?';
  r.fields.origin = '<script>not executable</script>\noriginal';
  assert.deepEqual(validateRecord(r, 'main'), r);
  assert.match(numericIssue('Infinity'), /finite/);
  assert.match(numericIssue('0', true), /positive/);
  assert.equal(numericIssue('-0.25'), '');
  assert.equal(numericIssue('1.2e3'), '');
  assert.equal(validateRecord(r, 'main').fields.member1Id, '000123');
});
test('reject unsupported shapes, duplicate attempts, reordered distances and wrong activity', () => {
  for (const mutate of [
    (r) => {
      r.extra = '';
    },
    (r) => {
      r.measurements[0].readings[1].id = 1;
    },
    (r) => {
      r.measurements.reverse();
    },
    (r) => {
      r.activityId = '555-main-lab';
    },
    (r) => {
      r.fields.extra = '';
    },
  ]) {
    const r = createRecord('main');
    mutate(r);
    assert.throws(() => validateRecord(r, 'main'));
  }
});
test('timeouts and exclusions remain distinct and extra attempts never overwrite the original six', () => {
  const r = createRecord('main'),
    row = r.measurements[0];
  row.readings[0] = {
    id: 1,
    value: '0',
    status: 'timeout',
    reason: 'No complete echo',
  };
  row.readings[1] = {
    id: 2,
    value: 'bad text',
    status: 'excluded',
    reason: 'Target moved',
  };
  assert.equal(readingIssue(row.readings[0]), '');
  assert.equal(readingIssue(row.readings[1]), '');
  addAttempt(r, row.id);
  row.readings[6].value = '601';
  assert.equal(row.readings[0].value, '0');
  assert.equal(row.readings[6].id, 7);
  assert.deepEqual(validateRecord(r, 'main'), r);
  assert.match(rawCSV(r), /"0","timeout","No complete echo"/);
});
test('quoted CSV and rectangular paste preserve text and do not cross run boundaries', () => {
  assert.deepEqual(parseRectangle('"a,b",c\r\n"d""e",f\r\n'), [
    ['a,b', 'c'],
    ['d"e', 'f'],
  ]);
  const r = createRecord('main');
  r.measurements[0].readings[0].status = 'excluded';
  pasteReadings(r, 'r1d10', 0, '100\tbad\n200\t300\n');
  assert.equal(r.measurements[0].readings[0].status, 'excluded');
  assert.equal(r.measurements[0].readings[1].value, 'bad');
  assert.equal(r.measurements[1].readings[0].value, '200');
  const before = structuredClone(r);
  assert.throws(() => pasteReadings(r, 'r1d50', 0, '1\n2'), /beyond/);
  assert.throws(() => pasteReadings(r, 'r1d10', 5, '1\t2'), /beyond/);
  assert.throws(() => pasteReadings(r, 'r1d10', 0, '1\t2\n3'), /rectangular/);
  assert.deepEqual(r, before);
});
test('CSV escapes spreadsheet formulas while JSON retains exact original strings', async () => {
  const r = syntheticMain();
  r.measurements[0].notes = '=HYPERLINK("bad")';
  assert.match(rawCSV(r), /'=HYPERLINK/);
  const parsed = await parseFile(
    bytes(await createBackup('main', r, {})),
    'main',
    decodeFixture,
  );
  assert.equal(parsed.record.measurements[0].notes, '=HYPERLINK("bad")');
});
test('group JSON and ZIP restore raw values, extra attempts, uncertainty, code and original image bytes', async () => {
  const r = syntheticMain();
  addAttempt(r, 'r1d10');
  r.measurements[0].readings[6].value = 'replacement';
  r.uncertainty.origin = {
    status: 'Not quantified',
    value: '',
    units: 'mm',
    distribution: 'unknown',
    scope: 'shared',
    source: 'Synthetic record',
    justification: 'Original words\nand newline',
  };
  const f = await validateAttachment(
      'main',
      'setup',
      new Blob([png]),
      decodeFixture,
    ),
    files = { setup: f };
  for (const payload of [
    bytes(await createBackup('main', r, files)),
    await createZip('main', r, files),
  ]) {
    const result = await parseFile(payload, 'main', decodeFixture);
    assert.deepEqual(result.record, r);
    assert.deepEqual(
      new Uint8Array(await result.files.setup.blob.arrayBuffer()),
      png,
    );
  }
  const archive = readArchive(await createZip('main', r, files));
  assert.ok(archive.has('raw_data.csv'));
  assert.ok(archive.has('uncertainty_records.csv'));
  assert.ok(archive.has('uploaded_code.ino'));
});
test('individual backups retain the exact original group file and all individual work', async () => {
  const group = await createZip('main', syntheticMain(), {}),
    source = { name: 'original-group.zip', bytes: group };
  const r = createRecord('post');
  r.fields.name = 'Synthetic Student';
  r.fields.studentId = '000123';
  r.fields.covariance = '-0.125';
  r.fields.propagationWorking = 'Original calculation\nwith an assumption';
  r.needsReview = true;
  const f = await validateAttachment(
    'post',
    'residuals',
    new Blob([png]),
    decodeFixture,
  );
  for (const payload of [
    bytes(await createBackup('post', r, { residuals: f }, source)),
    await createZip('post', r, { residuals: f }, source),
  ]) {
    const result = await parseFile(payload, 'post', decodeFixture);
    assert.deepEqual(result.record, r);
    assert.deepEqual(result.source.bytes, group);
    assert.equal(result.source.name, source.name);
    assert.equal(result.parsedSource.record.fields.groupId, 'SYNTHETIC QA');
    assert.deepEqual(
      new Uint8Array(await result.files.residuals.blob.arrayBuffer()),
      png,
    );
  }
});
test('wrong-workbook, unknown-version, malformed JSON and corrupt ZIP imports fail without modifying existing records', async () => {
  const original = syntheticMain(),
    copy = structuredClone(original),
    backup = await createBackup('main', original, {});
  await assert.rejects(parseFile(bytes(backup), 'post'), /Sensor Calibration/);
  await assert.rejects(
    parseFile(bytes({ ...backup, backupVersion: 55 }), 'main'),
    /Sensor Calibration/,
  );
  await assert.rejects(
    parseFile(new TextEncoder().encode('{bad'), 'main'),
    /readable/,
  );
  const zip = await createZip('main', original, {});
  zip[100] ^= 1;
  await assert.rejects(parseFile(zip, 'main'));
  assert.deepEqual(original, copy);
});
test('ZIP rejects altered derived CSVs, unexpected paths and compressed entries', async () => {
  const original = await createZip('main', syntheticMain(), {});
  const entries = Object.fromEntries(readArchive(original));
  await assert.rejects(
    parseFile(
      zipSync(
        { ...entries, 'raw_data.csv': strToU8('tampered') },
        { level: 0 },
      ),
      'main',
    ),
    /CSV/,
  );
  await assert.rejects(
    parseFile(
      zipSync({ ...entries, '../outside.txt': strToU8('bad') }, { level: 0 }),
      'main',
    ),
    /Unsafe/,
  );
  await assert.rejects(
    parseFile(
      zipSync({ ...entries, 'unexpected.txt': strToU8('bad') }, { level: 0 }),
      'main',
    ),
    /Unexpected/,
  );
  await assert.rejects(
    parseFile(zipSync(entries, { level: 6 }), 'main'),
    /compressed/,
  );
});
test('attachment validation rejects unsupported content, bad image decoding and size excess', async () => {
  await assert.rejects(
    validateAttachment('main', 'setup', new Blob(['<svg/>']), decodeFixture),
    /PNG/,
  );
  await assert.rejects(
    validateAttachment('post', 'setup', new Blob([png]), decodeFixture),
    /Choose/,
  );
  await assert.rejects(
    validateAttachment('main', 'setup', new Blob([png]), async () => {
      throw new Error('decode failed');
    }),
    /decode/,
  );
  await assert.rejects(
    validateAttachment(
      'main',
      'setup',
      new Blob([new Uint8Array(MAX_IMAGE + 1)]),
      decodeFixture,
    ),
    /10 MiB/,
  );
  assert.throws(
    () => checkFiles({ x: { blob: { size: 33 * 1024 * 1024 } } }),
    /32 MiB/,
  );
});
test('browser persistence stores original image bytes without IndexedDB Blob dependence', async () => {
  const f = await validateAttachment(
    'main',
    'setup',
    new Blob([png]),
    decodeFixture,
  );
  const stored = await persistentFiles({ setup: f });
  assert.ok(stored.setup.bytes instanceof Uint8Array);
  assert.equal('blob' in stored.setup, false);
  assert.deepEqual(stored.setup.bytes, png);
  const restored = await validateAttachment(
    'main',
    'setup',
    new Blob([structuredClone(stored).setup.bytes]),
    decodeFixture,
  );
  assert.deepEqual(new Uint8Array(await restored.blob.arrayBuffer()), png);
});
