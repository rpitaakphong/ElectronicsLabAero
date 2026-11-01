// All files and measurements below are synthetic software-test fixtures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { zipSync, strToU8 } from 'fflate';
import {
  createRecord,
  MAIN_FIELDS,
  POST_FIELDS,
  validateRecord,
  namespace,
  prerequisites,
  parseCSV,
  csvGuidance,
  CSV_HEADERS,
  draftIssues,
} from '../activities/sensor-calibration/model.js';
import {
  createBackup,
  createZip,
  parseFile,
  validateAttachment,
  persistentFiles,
  checkFiles,
  MAX_CODE,
  MAX_CSV,
} from '../activities/sensor-calibration/files.js';
import { createRecord as oldRecord } from '../activities/sensor-calibration/legacy/model.js';
import { createZip as oldZip } from '../activities/sensor-calibration/legacy/files.js';
import { readArchive } from '../activities/sensor-calibration/archive.js';
import { csvLayoutImage } from '../activities/sensor-calibration/csv-layout.js';
import {
  EQUATIONS,
  esc,
  mainContent,
  postContent,
  report,
} from '../activities/sensor-calibration/views.js';
const encode = (value) => new TextEncoder().encode(JSON.stringify(value));
const decoder = async () => true;
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
const csv =
  '\uFEFF' +
  CSV_HEADERS.join(',') +
  '\r\n1,perpendicular,12,705,"QA, not measured"\r\n2,perpendicular,12,,No echo: QA failure\r\n3,perpendicular,12,bad text,Excluded: QA exclusion\r\n';
const sketch =
  '// Synthetic fixture only\n<script>literal student text</script>\nvoid setup() {}\nvoid loop() {}';
const state = (kind) => ({
  kind,
  record: createRecord(kind),
  files: {},
  source: null,
  parsedSource: null,
  urls: {},
});
async function attachments() {
  return {
    circuit: await validateAttachment(
      'main',
      'circuit',
      new Blob([png]),
      decoder,
      'photo.png',
    ),
    code: await validateAttachment(
      'main',
      'code',
      new Blob([sketch]),
      decoder,
      'my_measurement.ino',
    ),
    calibrationData: await validateAttachment(
      'main',
      'calibrationData',
      new Blob([csv]),
      decoder,
      'my-data.csv',
    ),
  };
}
test('version two uses separate records and namespaces without fixed measurement rows', () => {
  const r = createRecord('main');
  assert.equal(r.schemaVersion, 2);
  assert.equal('measurements' in r, false);
  assert.match(namespace('main'), /v2$/);
  assert.notEqual(namespace('main'), namespace('post'));
  r.fields.member1Id = '000123';
  r.fields.design = 'perhaps? <script> literal\noriginal';
  assert.deepEqual(validateRecord(r, 'main'), r);
  assert.throws(() => validateRecord(oldRecord('main'), 'main'));
  assert.throws(() => validateRecord({ ...r, extra: '' }, 'main'));
});
test('one circuit photograph and nonblank pasted code unlock later sections without file upload controls', () => {
  const s = state('main');
  s.record.fields.design = 'kept';
  assert.equal(prerequisites(s.files, s.record), false);
  s.files.circuit = {};
  assert.equal(prerequisites(s.files, s.record), false);
  s.record.fields.code = '  \n';
  assert.equal(prerequisites(s.files, s.record), false);
  s.record.fields.code = sketch;
  assert.equal(prerequisites(s.files, s.record), true);
  assert.doesNotMatch(mainContent(s, 1), /gate-controls/);
  delete s.files.circuit;
  assert.equal(prerequisites(s.files, s.record), false);
  assert.match(mainContent(s, 1), /fieldset class="gate-controls" disabled/);
  assert.match(mainContent(s, 1), />kept<\/textarea>/);
  const html = mainContent(s, 0);
  assert.match(html, /textarea[^>]*data-field="code"/);
  assert.doesNotMatch(
    html,
    /data-file="(?:code|circuit2|circuit3)"|data-field="help"/,
  );
  assert.match(html, /&lt;script&gt;literal student text&lt;\/script&gt;/);
});
test('CSV parsing preserves BOM, quoted commas, quotes, newlines, empty fields and literal invalid text', () => {
  assert.deepEqual(parseCSV('\uFEFFa,b\r\n"x,y","line\n""two"""\r\n'), [
    ['a', 'b'],
    ['x,y', 'line\n"two"'],
  ]);
  assert.deepEqual(parseCSV('a,b\r1,\r'), [
    ['a', 'b'],
    ['1', ''],
  ]);
  assert.throws(() => parseCSV('a,b\n"unclosed'));
  assert.throws(() => parseCSV('a,b\n"quoted"suffix,2'));
  assert.throws(() => parseCSV('a,b\nx"y,2'));
  const parsed = csvGuidance(csv);
  assert.deepEqual(parsed.issues, []);
  assert.equal(parsed.rows[3][3], 'bad text');
  assert.equal(parsed.rows[2][3], '');
});
test('CSV guidance reports missing values and runs, failed-echo durations and exclusions without rewriting input', () => {
  const original = csv
    .replace('3,perpendicular', '2,perpendicular')
    .replace(',,No echo', ',0,No echo')
    .replace('Excluded: QA exclusion', 'Excluded:');
  const parsed = csvGuidance(original);
  assert.ok(parsed.issues.some((s) => s.includes('no valid duration')));
  assert.ok(parsed.issues.some((s) => s.includes('three calibration runs')));
  assert.ok(parsed.issues.some((s) => s.includes('explain')));
  assert.equal(parsed.rows[2][3], '0');
  assert.match(csvGuidance('a,b\n1,2').issues.join(), /missing column/);
  assert.ok(
    csvGuidance(
      CSV_HEADERS.join(',') + '\n1,perpendicular,12,not a number,note',
    ).issues.some((s) => s.includes('positive echo')),
  );
  assert.match(
    csvGuidance(CSV_HEADERS.join(',') + '\n1,perpendicular,12').issues.join(),
    /number of columns/,
  );
});
test('CSV extra columns and spreadsheet expressions are retained as literal text', async () => {
  const s = csv
    .replace('echo time (us),note', 'echo time (us),note,extra')
    .replaceAll('\r\n1,', '\r\n1,')
    .replace('"QA, not measured"', '"QA, not measured",=SUM(A1:A2)')
    .replace('QA failure', 'QA failure,001')
    .replace('QA exclusion', 'QA exclusion,=HYPERLINK(""""bad"""")');
  const f = await validateAttachment(
    'main',
    'calibrationData',
    new Blob([s]),
    decoder,
    'draft.csv',
  );
  assert.equal(f.text, s.replace(/^\uFEFF/, ''));
  assert.deepEqual(
    new Uint8Array(await f.blob.arrayBuffer()),
    new TextEncoder().encode(s),
  );
});
test('JSON and ZIP round trips keep original CSV/code/photo bytes, names and draft answers', async () => {
  const r = createRecord('main');
  r.fields.groupId = 'SYNTHETIC QA';
  r.fields.member1Id = '000123';
  r.fields.anglePlan = '<script>not executed</script>';
  r.fields.code = sketch;
  r.uncertainty.origin.scope = 'shared';
  const files = await attachments();
  for (const payload of [
    encode(await createBackup('main', r, files)),
    await createZip('main', r, files),
  ]) {
    const result = await parseFile(payload, 'main', decoder);
    assert.deepEqual(result.record, r);
    for (const slot of Object.keys(files)) {
      assert.deepEqual(
        new Uint8Array(await result.files[slot].blob.arrayBuffer()),
        new Uint8Array(await files[slot].blob.arrayBuffer()),
      );
      assert.equal(result.files[slot].originalName, files[slot].originalName);
    }
  }
  const entries = readArchive(await createZip('main', r, files));
  assert.ok(entries.has('files/calibrationData.csv'));
  assert.ok(entries.has('files/code.ino'));
  assert.ok(entries.has('uncertainty_records.csv'));
});
test('individual exports contain the exact original group file and retain independent answers', async () => {
  const group = await createZip(
    'main',
    createRecord('main'),
    await attachments(),
  );
  const source = { name: 'group.zip', bytes: group };
  const r = createRecord('post');
  r.fields.conclusion = 'My own words\n<literal>';
  r.needsReview = true;
  for (const payload of [
    encode(await createBackup('post', r, {}, source)),
    await createZip('post', r, {}, source),
  ]) {
    const p = await parseFile(payload, 'post', decoder);
    assert.deepEqual(p.source.bytes, group);
    assert.equal(p.parsedSource.files.code.originalName, 'my_measurement.ino');
    assert.deepEqual(p.record, r);
  }
});
test('attachments reject wrong slots, file types, binary text, invalid UTF-8 and oversized uploads', async () => {
  await assert.rejects(
    validateAttachment('main', 'code', new Blob([sketch]), decoder, 'file.js'),
    /\.ino/,
  );
  await assert.rejects(
    validateAttachment(
      'main',
      'calibrationData',
      new Blob([new Uint8Array([255])]),
      decoder,
      'data.csv',
    ),
    /UTF-8/,
  );
  await assert.rejects(
    validateAttachment('main', 'code', new Blob(['a\0b']), decoder, 'code.ino'),
    /binary/,
  );
  await assert.rejects(
    validateAttachment('post', 'code', new Blob([sketch]), decoder, 'code.ino'),
    /Unknown/,
  );
  await assert.rejects(
    validateAttachment(
      'main',
      'circuit',
      new Blob(['<svg/>']),
      decoder,
      'photo.svg',
    ),
    /PNG/,
  );
  await assert.rejects(
    validateAttachment(
      'main',
      'code',
      new Blob([new Uint8Array(MAX_CODE + 1)]),
      decoder,
      'code.ino',
    ),
    /1 MiB/,
  );
  await assert.rejects(
    validateAttachment(
      'main',
      'calibrationData',
      new Blob([new Uint8Array(MAX_CSV + 1)]),
      decoder,
      'data.csv',
    ),
    /5 MiB/,
  );
  assert.throws(
    () => checkFiles({ x: { blob: { size: 33 * 1024 * 1024 } } }),
    /32 MiB/,
  );
});
test('persistence stores byte arrays for every attachment and restores original names and text', async () => {
  const files = await attachments(),
    stored = structuredClone(await persistentFiles(files));
  for (const [slot, f] of Object.entries(stored)) {
    assert.ok(f.bytes instanceof Uint8Array);
    assert.equal('blob' in f, false);
    const restored = await validateAttachment(
      'main',
      slot,
      new Blob([f.bytes]),
      decoder,
      f.originalName,
    );
    assert.equal(restored.originalName, files[slot].originalName);
    assert.deepEqual(
      new Uint8Array(await restored.blob.arrayBuffer()),
      f.bytes,
    );
  }
});
test('corrupt and wrong-activity imports fail without modifying the current workbook', async () => {
  const r = createRecord('main'),
    before = structuredClone(r),
    zip = await createZip('main', r, {}),
    entries = Object.fromEntries(readArchive(zip));
  await assert.rejects(parseFile(zip, 'post', decoder));
  await assert.rejects(
    parseFile(
      encode({ ...(await createBackup('main', r, {})), backupVersion: 99 }),
      'main',
      decoder,
    ),
  );
  await assert.rejects(
    parseFile(
      zipSync({ ...entries, '../escape': strToU8('bad') }, { level: 0 }),
      'main',
      decoder,
    ),
    /Unsafe/,
  );
  await assert.rejects(
    parseFile(
      zipSync(
        { ...entries, 'uncertainty_records.csv': strToU8('tampered') },
        { level: 0 },
      ),
      'main',
      decoder,
    ),
    /CSV/,
  );
  await assert.rejects(
    parseFile(
      zipSync({ ...entries, 'extra.txt': strToU8('bad') }, { level: 0 }),
      'main',
      decoder,
    ),
    /Unexpected/,
  );
  await assert.rejects(
    parseFile(zipSync(entries, { level: 6 }), 'main', decoder),
    /compressed/,
  );
  assert.deepEqual(r, before);
});
test('version-one JSON/ZIP remain available for recovery without conversion', async () => {
  const old = oldRecord('main');
  old.measurements[0].readings[0].value = 'original v1 text';
  const payload = await oldZip('main', old, {});
  const parsed = await parseFile(payload, 'main', decoder);
  assert.equal(parsed.legacy, true);
  assert.deepEqual(parsed.record, old);
  assert.equal(parsed.record.schemaVersion, 1);
});
test('read-only group views escape code, CSV, source names and student prose', async () => {
  const s = state('post'),
    r = createRecord('main');
  r.fields.design = '<img src=x onerror=alert(1)>';
  s.source = { name: '<script>file</script>.zip' };
  s.parsedSource = { record: r, files: await attachments() };
  s.urls = {};
  const html = postContent(s, 0);
  assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('&lt;script&gt;literal'));
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('data-uncertainty='), false);
  assert.equal(html.includes('data-file='), false);
  assert.equal(esc('<>'), '&lt;&gt;');
});
test('student instructions cover the chosen workflow and explained equations without supplied wiring, code or fixed tables', () => {
  const main = state('main'),
    post = state('post'),
    all = Array.from({ length: 7 }, (_, i) => mainContent(main, i)).join('');
  assert.match(all, /Complete three runs/i);
  assert.match(all, /data:image\/svg\+xml/);
  assert.match(all, /placeholders/);
  assert.match(all, /perpendicular.*tilted.*returned/s);
  assert.doesNotMatch(
    all,
    /measurement-table|data-row=|D9|D8|115200|ultrasonic_echo.zip|108 calibration|small.movement|smoothing/,
  );
  for (let i = 0; i < 9; i++) assert.ok(postContent(post, i).length > 100);
  assert.match(postContent(post, 6), /regression-conditional/);
  assert.match(postContent(post, 6), /same effect twice/);
  assert.match(postContent(post, 6), /exact 95%/);
  for (const key of [
    'slope',
    'intercept',
    'uSlope',
    'uIntercept',
    'covariance',
    'propagation',
    'signedError',
  ])
    assert.match(EQUATIONS[key], /<math/);
  assert.match(EQUATIONS.propagation, /cov/);
  assert.match(EQUATIONS.sd, /<mo>\(<\/mo>.*<mo>−<\/mo>.*<mo>\)<\/mo>/);
  const printed = report(main);
  assert.doesNotMatch(printed, /<textarea|<input|<select|data-file=/);
  assert.match(printed, /version 2/);
  assert.doesNotMatch(printed, /Add a graph of the distance checks if useful/);
  assert.doesNotMatch(printed, /Add another circuit photograph if needed/);
  assert.ok(draftIssues(post.record, 'post').length > 0);
});
test('Section 4 keeps the main-lab calculations while detailed fitting uncertainty stays in the post-lab', () => {
  const main = state('main'),
    post = state('post');
  main.files.circuit = {};
  main.record.fields.code = sketch;
  for (const print of [false, true]) {
    const section = mainContent(main, 3, print),
      individual = postContent(post, 2, print);
    for (const key of ['mean', 'sd', 'calibration', 'inverseSensitivity'])
      assert.ok(section.includes(EQUATIONS[key]), `main lab retains ${key}`);
    for (const key of [
      'spread',
      'slope',
      'intercept',
      'residual',
      'residualSD',
      'uSlope',
      'uIntercept',
      'covariance',
    ]) {
      assert.equal(
        section.includes(EQUATIONS[key]),
        false,
        `main lab omits ${key}`,
      );
      assert.ok(individual.includes(EQUATIONS[key]), `post-lab teaches ${key}`);
    }
    assert.doesNotMatch(
      section,
      /data-field="(?:uSlope|uIntercept|covariance)"|earlier-fit-notes/,
    );
  }
  const requiredMain = draftIssues(main.record, 'main'),
    requiredPost = draftIssues(post.record, 'post');
  for (const key of ['uSlope', 'uIntercept', 'covariance']) {
    assert.equal(requiredMain.includes(MAIN_FIELDS[key]), false);
    assert.ok(requiredPost.includes(POST_FIELDS[key]));
  }
  assert.doesNotMatch(MAIN_FIELDS.provisionalWorking, /uncertaint|covariance/);
  assert.doesNotMatch(MAIN_FIELDS.validationWorking, /uncertaint/);
});
test('earlier group parameter uncertainties survive backups and remain read-only in reports and imported sources', async () => {
  const main = state('main'),
    post = state('post');
  main.record.fields.uSlope = 'Earlier calculation\n  <literal text>  ';
  main.record.fields.covariance = '-0.125';
  const before = structuredClone(main.record);
  post.source = { name: 'group.zip' };
  post.parsedSource = { record: main.record, files: {} };
  for (const print of [false, true]) {
    for (const html of [
      mainContent(main, 3, print),
      postContent(post, 0, print),
    ]) {
      assert.match(html, /Earlier calculation\n  &lt;literal text&gt;  /);
      assert.match(html, /-0\.125/);
      assert.doesNotMatch(
        html,
        /data-field="(?:uSlope|uIntercept|covariance)"/,
      );
      assert.doesNotMatch(
        html,
        /Enter the initial standard uncertainty u\(a₀\)/,
      );
      assert.ok(
        html.includes(
          `<details class="earlier-fit-notes"${print ? ' open' : ''}>`,
        ),
      );
    }
  }
  for (const payload of [
    encode(await createBackup('main', main.record, {})),
    await createZip('main', main.record, {}),
  ]) {
    const parsed = await parseFile(payload, 'main', decoder);
    assert.deepEqual(parsed.record, before);
  }
  assert.deepEqual(main.record, before);
});
test('packaging produces standalone worksheets and removes the provided program download', async () => {
  for (const kind of ['main', 'post']) {
    const html = await readFile(
      `public/worksheets/sensor-calibration-${kind}-lab.html`,
      'utf8',
    );
    assert.ok(html.includes(`data-kind="${kind}"`));
    assert.doesNotMatch(html, /WORKBOOK_(JS|CSS|KIND|TITLE)/);
    assert.equal(/<script\b[^>]*src=/i.test(html), false);
    assert.equal(/<link\b[^>]*href="(?!data:)/i.test(html), false);
    assert.ok(html.includes('data:image/svg+xml'));
  }
  await assert.rejects(
    access(
      'public/courses/2145427/sensor-calibration/v1.0.0/ultrasonic_echo.zip',
    ),
  );
});

test('earlier version-two uploads prefill the code box and first photograph without losing file bytes', async () => {
  const record = createRecord('main');
  delete record.fields.code;
  const files = await attachments();
  files.circuit2 = await validateAttachment(
    'main',
    'circuit2',
    new Blob([png]),
    decoder,
    'extra-photo.png',
  );
  delete files.circuit;
  const backup = await createBackup('main', createRecord('main'), files);
  backup.record = record;
  const parsed = await parseFile(encode(backup), 'main', decoder);
  assert.equal(parsed.record.fields.code, sketch);
  assert.equal(parsed.files.circuit.originalName, 'extra-photo.png');
  assert.equal(parsed.files.code.text, sketch);
  assert.equal(prerequisites(parsed.files, parsed.record), true);
  parsed.record.fields.code = '';
  const again = await parseFile(
    encode(await createBackup('main', parsed.record, parsed.files)),
    'main',
    decoder,
  );
  assert.equal(again.record.fields.code, '');
  assert.equal(prerequisites(again.files, again.record), false);
  const zip = await createZip('main', parsed.record, parsed.files);
  assert.ok(readArchive(zip).has('files/code.ino'));
});

test('Section 2 explains calibration and has two blank axis fields and a five-line procedure', () => {
  const s = state('main');
  s.files.circuit = {};
  s.record.fields.code = sketch;
  s.record.fields.design =
    'Our own procedure\n1. Position the target.\n<literal notes>';
  const html = mainContent(s, 1);
  assert.equal([...html.matchAll(/<textarea\b/g)].length, 1);
  assert.equal([...html.matchAll(/<input\b/g)].length, 2);
  assert.match(html, /data-field="xVariable" value=""/);
  assert.match(html, /data-field="yVariable" value=""/);
  assert.match(html, /What quantity will you use for x, and in what unit\?/);
  assert.match(html, /What quantity will you use for y, and in what unit\?/);
  assert.match(html, /Calibration establishes the relationship/);
  assert.match(html, /collect paired measurements/);

  assert.match(html, /data-field="design" rows="5" maxlength="16000"/);
  assert.match(html, /Write your calibration procedure\./);
  assert.match(html, /Complete three runs and reserve two other distances/);
  assert.match(html, /paragraphs, steps or brief notes/);
  assert.match(html, /&lt;literal notes&gt;/);
  assert.doesNotMatch(
    html,
    /<h2|data-uncertainty=|data-field="(?:origin|alignment|graduation|accuracy|placement|environment)"|earlier-notes/,
  );
  const printed = mainContent(s, 1, true);
  assert.doesNotMatch(
    printed,
    /<textarea|<input|<select|print-uncertainty|earlier-notes/,
  );
  assert.match(printed, /Our own procedure/);
  const issues = draftIssues(s.record, 'main');
  assert.ok(issues.includes(MAIN_FIELDS.xVariable));
  assert.ok(issues.includes(MAIN_FIELDS.yVariable));
  s.record.fields.xVariable = 'Student x explanation';
  s.record.fields.yVariable = 'Student y explanation';
  assert.equal(
    draftIssues(s.record, 'main').includes(MAIN_FIELDS.xVariable),
    false,
  );
  assert.equal(
    draftIssues(s.record, 'main').includes(MAIN_FIELDS.yVariable),
    false,
  );

  for (const key of [
    'origin',
    'alignment',
    'graduation',
    'accuracy',
    'placement',
    'environment',
  ])
    assert.equal(issues.includes(MAIN_FIELDS[key]), false);
  assert.equal(issues.includes('Write your calibration procedure.'), false);
  s.record.fields.design = '';
  assert.ok(
    draftIssues(s.record, 'main').includes('Write your calibration procedure.'),
  );
});

test('earlier populated measurement notes stay collapsed and read-only without empty uncertainty entries', async () => {
  const s = state('main');
  s.record.fields.design = 'Free response\nwith original spacing  ';
  s.record.fields.xVariable = 'Our x quantity with <literal> units';
  s.record.fields.yVariable = 'Our y quantity with µs';
  s.record.fields.origin = 'Earlier origin <literal>';
  s.record.fields.placement = 'Earlier bound in mm';
  s.record.uncertainty.origin.scope = 'Earlier shared effect';
  const before = structuredClone(s.record),
    html = mainContent(s, 1);
  assert.match(
    html,
    /<details class="earlier-notes"><summary>Read your earlier measurement notes\.<\/summary>/,
  );
  assert.equal([...html.matchAll(/<textarea\b/g)].length, 1);
  assert.equal([...html.matchAll(/class="print-uncertainty"/g)].length, 1);
  assert.match(html, /Earlier origin &lt;literal&gt;/);
  assert.match(html, /Earlier shared effect/);
  assert.doesNotMatch(
    html,
    /data-uncertainty=|What accuracy does the ruler manufacturer state|\[not recorded\]/,
  );
  assert.match(mainContent(s, 1, true), /<details class="earlier-notes" open>/);
  for (const payload of [
    encode(await createBackup('main', s.record, {})),
    await createZip('main', s.record, {}),
  ]) {
    const parsed = await parseFile(payload, 'main', decoder);
    assert.deepEqual(parsed.record, before);
  }
});

test('individual source and uncertainty sections show the free procedure and only populated earlier notes', () => {
  const s = state('post'),
    group = createRecord('main');
  group.fields.design = 'Our free procedure\n<literal>';
  group.fields.xVariable = 'Our x response <literal>';
  group.fields.yVariable = 'Our y response, with units';
  s.source = { name: 'group.zip' };
  s.parsedSource = { record: group, files: {} };
  for (const page of [0, 5]) {
    const html = postContent(s, page);
    assert.match(html, /Our free procedure/);
    assert.match(html, /Our x response &lt;literal&gt;/);
    assert.match(html, /Our y response, with units/);
    assert.doesNotMatch(html, /data-field="(?:xVariable|yVariable)"/);
    assert.doesNotMatch(html, /earlier-notes|print-uncertainty/);
  }
  assert.equal(
    [...postContent(s, 5).matchAll(/class="uncertainty-card"/g)].length,
    6,
  );
  group.fields.graduation = 'Earlier ruler graduation';
  group.uncertainty.placement.justification = 'Earlier positioning estimate';
  for (const page of [0, 5]) {
    const html = postContent(s, page);
    assert.match(html, /Earlier ruler graduation/);
    assert.match(html, /Earlier positioning estimate/);
    assert.doesNotMatch(
      html,
      /data-field="graduation"|data-uncertainty="placement"/,
    );
  }
});

test('older version-two records and JSON/ZIP backups default missing axis fields without changing existing work', async () => {
  const old = createRecord('main');
  old.fields.design = 'Original procedure\n  original spacing';
  old.fields.code = sketch;
  old.fields.origin = 'Original measurement note';
  old.uncertainty.origin.scope = 'Original shared effect';
  delete old.fields.xVariable;
  delete old.fields.yVariable;
  const before = structuredClone(old),
    normalized = validateRecord(old, 'main');
  assert.deepEqual(old, before);
  assert.equal(normalized.fields.xVariable, '');
  assert.equal(normalized.fields.yVariable, '');
  assert.equal(normalized.fields.design, old.fields.design);
  assert.equal(normalized.schemaVersion, 2);
  assert.match(namespace('main'), /v2$/);
  const json = await createBackup('main', normalized, {});
  delete json.record.fields.xVariable;
  delete json.record.fields.yVariable;
  const zip = Object.fromEntries(
    readArchive(await createZip('main', normalized, {})),
  );
  const manifest = JSON.parse(new TextDecoder().decode(zip['workbook.json']));
  delete manifest.record.fields.xVariable;
  delete manifest.record.fields.yVariable;
  zip['workbook.json'] = strToU8(JSON.stringify(manifest));
  for (const payload of [encode(json), zipSync(zip, { level: 0 })]) {
    const parsed = await parseFile(payload, 'main', decoder);
    assert.deepEqual(parsed.record, normalized);
    assert.ok(
      draftIssues(parsed.record, 'main').includes(MAIN_FIELDS.xVariable),
    );
    assert.ok(
      draftIssues(parsed.record, 'main').includes(MAIN_FIELDS.yVariable),
    );
  }
  const partial = structuredClone(old);
  partial.fields.xVariable = 'Previously entered x';
  assert.equal(
    validateRecord(partial, 'main').fields.xVariable,
    'Previously entered x',
  );
  assert.equal(validateRecord(partial, 'main').fields.yVariable, '');
  assert.throws(() =>
    validateRecord(
      { ...normalized, fields: { ...normalized.fields, xVariable: 123 } },
      'main',
    ),
  );
});

test('the five-column example and instructions use the same headings without a reading or status column', () => {
  assert.deepEqual(CSV_HEADERS, [
    'trial',
    'condition',
    'reference distance (cm)',
    'echo time (us)',
    'note',
  ]);
  const svg = decodeURIComponent(
    csvLayoutImage.slice(csvLayoutImage.indexOf(',') + 1),
  );
  for (const heading of CSV_HEADERS)
    assert.ok(svg.includes(`>${heading}</text>`));
  assert.equal(
    [...svg.matchAll(/font-size="17" font-weight="700"/g)].length,
    5,
  );
  assert.doesNotMatch(svg, />run<|>reading<|>status<|>notes</);
  const html = mainContent(state('main'), 2);
  assert.ok(html.includes(CSV_HEADERS.join(',')));
  assert.match(html, /Repeat the trial number/);
  assert.match(html, /Excluded:/);
  assert.doesNotMatch(html, /run,condition|reading,echo_time_us|for status/);
});
test('five-column repeated attempts and empty ordinary notes are accepted without altering values', () => {
  const text =
    CSV_HEADERS.join(',') +
    '\n1,perpendicular,12,705,\n1,perpendicular,12,705,\n2,perpendicular,12,,No echo returned\n3,perpendicular,12,bad text,Excluded: target moved';
  const parsed = csvGuidance(text);
  assert.deepEqual(parsed.issues, []);
  assert.equal(parsed.rows[1][4], '');
  assert.equal(parsed.rows[2][3], '705');
  assert.equal(parsed.rows[4][3], 'bad text');
  const other =
    CSV_HEADERS.join(',') +
    '\n1,tilted,12,,\n2,returned,12,0,\n3,perpendicular,12,700,';
  assert.ok(
    csvGuidance(other).issues.some((s) => s.includes('explain the failed')),
  );
  assert.ok(csvGuidance(other).issues.some((s) => s.includes('positive echo')));
  assert.deepEqual(
    csvGuidance(
      text
        .replace('trial,', 'trail,')
        .replace('echo time (us)', 'echo time (µs)'),
    ).issues,
    [],
  );
});
test('earlier seven-column CSV files remain readable and retain their exact bytes in JSON and ZIP backups', async () => {
  const text =
    '\uFEFFrun,condition,reference_distance_cm,reading,echo_time_us,status,notes\r\n1,perpendicular,12,1,705,ok,old note\r\n2,perpendicular,12,1,,no_echo,old failure\r\n3,perpendicular,12,1,bad text,excluded,old reason\r\n';
  assert.deepEqual(csvGuidance(text).issues, []);
  const file = await validateAttachment(
    'main',
    'calibrationData',
    new Blob([text]),
    decoder,
    'earlier.csv',
  );
  for (const data of [
    encode(
      await createBackup('main', createRecord('main'), {
        calibrationData: file,
      }),
    ),
    await createZip('main', createRecord('main'), { calibrationData: file }),
  ]) {
    const parsed = await parseFile(data, 'main', decoder);
    assert.deepEqual(
      new Uint8Array(await parsed.files.calibrationData.blob.arrayBuffer()),
      new TextEncoder().encode(text),
    );
    assert.deepEqual(csvGuidance(parsed.files.calibrationData.text).issues, []);
  }
});
