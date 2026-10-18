import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { zipSync, strToU8, unzipSync } from 'fflate';
import {
  createRecord,
  validateRecord,
  preservePrediction,
  identityIssues,
  downloadStem,
} from '../activities/555-main-lab/model.js';
import {
  createLabZip,
  createBackup,
  parseMainFile,
  validateImage,
} from '../activities/555-main-lab/attachments.js';
import { readArchive } from '../activities/555-main-lab/archive.js';
import {
  parsePrelab,
  validatePrelab,
  zipOneStored,
} from '../activities/555-post-lab/prelab.js';
import {
  createPostlab,
  validatePostlab,
  withSource,
  issues,
  postlabBackup,
  parsePostlabFile,
  postlabZip,
} from '../activities/555-post-lab/model.js';
import {
  postlabScreen,
  individualReport,
} from '../activities/555-post-lab/views.js';
import { screen, report } from '../activities/555-main-lab/views.js';
import { makeValidSyntheticEvidence } from './fixtures/prelab-synthetic.mjs';
const encode = (value) => new TextEncoder().encode(JSON.stringify(value));
const decode = async () => true;
const png = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4);
function main() {
  const record = createRecord();
  record.group = {
    id: 'QA-pair',
    student1: { name: 'Synthetic Test Student', id: 'TEST0001' },
    student2: { name: 'Synthetic Partner', id: '000002' },
  };
  return record;
}
function individual() {
  return withSource(
    withSource(
      createPostlab(),
      'prelab',
      makeValidSyntheticEvidence(),
      'prelab.zip',
    ),
    'main',
    main(),
    'lab.zip',
  );
}
test('pair form has exactly four identity textboxes plus Group ID and no editable analysis', () => {
  const form = screen(main(), 0);
  assert.equal([...form.matchAll(/data-field="group\./g)].length, 5);
  assert.doesNotMatch(form, /group\.members|one name per line/);
  assert.doesNotMatch(
    screen(main(), 4),
    /data-field="analysis\.|Conclusions entered/,
  );
  assert.match(screen(main(), 4), /555-post-lab\.html/);
  assert.doesNotMatch(report(main()), /Post-lab analysis and conclusions/);
  assert.deepEqual(identityIssues(main()), []);
  const bad = main();
  bad.group.student2.id = 'TEST0001';
  assert.match(identityIssues(bad).join(' '), /different/);
});
test('v2 migration preserves original information, snapshots and earlier shared analysis', () => {
  const legacy = main();
  legacy.schemaVersion = 2;
  legacy.group = { id: 'old', members: 'First Student\nSecond Student' };
  delete legacy.legacyMembers;
  Object.assign(legacy.configs.A0.design, {
    r1a: '10',
    r2a: '33',
    r2b: '33',
    capacitor: '10',
  });
  legacy.configs.A0.prediction.reason = 'Unsure';
  preservePrediction(legacy, 'A0');
  legacy.analysis.conclusionA = 'Earlier pair answer';
  const before = JSON.stringify(legacy),
    restored = validateRecord(legacy);
  assert.equal(restored.schemaVersion, 3);
  assert.equal(restored.group.student1.name, 'First Student');
  assert.equal(restored.group.student1.id, '');
  assert.equal(restored.legacyMembers, legacy.group.members);
  assert.deepEqual(restored.configs, legacy.configs);
  assert.deepEqual(restored.analysis, legacy.analysis);
  assert.equal(JSON.stringify(legacy), before);
  legacy.group.members = 'A\nB\nC';
  assert.equal(validateRecord(legacy).group.student1.name, '');
});
test('download names retain Group ID and identities while removing unsafe path characters', () => {
  const name = downloadStem('555_MAIN_LAB', 'G/1', [
    { name: 'กานต์ / Test', id: '0000123' },
  ]);
  assert.match(name, /กานต์/);
  assert.match(name, /0000123/);
  assert.doesNotMatch(name, /\//);
});
test('actual pre-lab format validates uncertainty and preserves original/revised answers', () => {
  const pre = makeValidSyntheticEvidence(),
    original = JSON.stringify(pre);
  assert.deepEqual(parsePrelab(encode(pre)), pre);
  assert.deepEqual(
    parsePrelab(zipOneStored('prelab_evidence.json', JSON.stringify(pre))),
    pre,
  );
  assert.equal(JSON.stringify(pre), original);
  pre.questions['PRE-P01'].working_response.selections = { period: 'decrease' };
  pre.questions['PRE-P01'].working_response.reasoning = 'The period increases.';
  assert.deepEqual(
    validatePrelab(pre),
    pre,
    'Do not silently correct or grade inconsistent responses',
  );
});
test('pre-lab rejects drafts, wrong versions, foreign scenarios and tampered originals', () => {
  for (const edit of [
    (p) => (p.status = 'draft'),
    (p) => (p.schema_version = 'future'),
    (p) => (p.questions['PRE-P01'].scenario_ids = ['A0']),
    (p) =>
      (p.questions['PRE-P01'].initial_snapshot.response.reasoning = 'changed'),
  ]) {
    const pre = makeValidSyntheticEvidence();
    edit(pre);
    assert.throws(() => validatePrelab(pre));
  }
  assert.throws(
    () => parsePrelab(encode({ backup_kind: '2145427-prelab-full-workspace' })),
    /workspace backup/,
  );
  assert.throws(
    () => parsePrelab(new TextEncoder().encode('<html>Not evidence</html>')),
    /finalized pre-lab ZIP/,
  );
});
test('ZIP parser rejects duplicates, traversal, unexpected entries, corruption and oversized declarations', () => {
  const valid = zipOneStored(
    'prelab_evidence.json',
    JSON.stringify(makeValidSyntheticEvidence()),
  );
  const corrupt = valid.slice();
  corrupt[60] ^= 1;
  assert.throws(() => parsePrelab(corrupt));
  assert.throws(() =>
    parsePrelab(
      zipSync({ '../prelab_evidence.json': strToU8('{}') }, { level: 0 }),
    ),
  );
  assert.throws(() =>
    parsePrelab(
      zipSync(
        { 'prelab_evidence.json': strToU8('{}'), 'other.txt': strToU8('x') },
        { level: 0 },
      ),
    ),
  );
  const bad = valid.slice();
  new DataView(bad.buffer).setUint32(22, 0xffffffff, true);
  assert.throws(() => readArchive(bad));
});
test('main ZIP imports verify image bytes and reject extra files', async () => {
  const images = {
    A0: await validateImage('A0', new Blob([png]), 'scope.png', decode),
  };
  const zipped = await createLabZip(main(), images, 'main.json');
  const parsed = await parseMainFile(zipped, decode);
  assert.deepEqual(
    new Uint8Array(await parsed.images.A0.blob.arrayBuffer()),
    png,
  );
  const entries = unzipSync(zipped);
  entries['foreign.txt'] = strToU8('no');
  await assert.rejects(
    parseMainFile(zipSync(entries, { level: 0 }), decode),
    /Unexpected/,
  );
  delete entries['foreign.txt'];
  entries['screenshots/Screenshot_1_Lab_1.png'] = png.slice(1);
  await assert.rejects(
    parseMainFile(zipSync(entries, { level: 0 }), decode),
    /do not match/,
  );
});
test('envelope-1 v2 backups retain original images while upgrading pair details', async () => {
  const legacy = main();
  legacy.schemaVersion = 2;
  legacy.group = {
    id: 'QA-pair',
    members: 'Synthetic Test Student\nSynthetic Partner',
  };
  delete legacy.legacyMembers;
  const old = {
    format: '555-main-lab-backup',
    backupVersion: 1,
    record: legacy,
    images: [
      {
        slot: 'A0',
        filename: 'Screenshot_1_Lab_1.png',
        type: 'image/png',
        data: Buffer.from(png).toString('base64'),
      },
    ],
  };
  const parsed = await parseMainFile(encode(old), decode);
  assert.equal(parsed.migrated, true);
  assert.equal(parsed.record.group.student1.name, 'Synthetic Test Student');
  assert.equal(parsed.record.group.student1.id, '');
  assert.deepEqual(
    new Uint8Array(await parsed.images.A0.blob.arrayBuffer()),
    png,
  );
});
test('either import order creates the same evidence, without copying earlier shared analysis', () => {
  const a = individual(),
    b = withSource(
      withSource(createPostlab(), 'main', a.sources.main, 'lab.zip'),
      'prelab',
      makeValidSyntheticEvidence(),
      'prelab.zip',
    );
  assert.deepEqual(a.sources, b.sources);
  assert.deepEqual(issues(a, false), []);
  assert(Object.values(a.analysis).every((v) => v === ''));
  const html = postlabScreen(a, 3, {});
  assert.match(html, /data-field="analysis.workings"/);
  assert.doesNotMatch(html, /data-field="configs\./);
  assert.equal((html.match(/data-field="analysis\./g) || []).length, 10);
  assert.doesNotMatch(html, /reflect on your pre-lab/i);
});
test('identity match and explicit confirmation are required, preserving leading zero IDs', () => {
  const record = individual();
  assert.match(issues(record).join(' '), /Confirm/);
  record.identityConfirmed = true;
  assert.deepEqual(issues(record), []);
  record.sources.prelab.student.university_student_id = '000002';
  assert.deepEqual(issues(record, false), []);
  record.sources.prelab.student.university_student_id = '2';
  assert.match(issues(record, false).join(' '), /match exactly one/);
});
test('source replacement retains individual writing but requires review and fresh identity confirmation', () => {
  const record = individual();
  record.analysis.conclusionA = 'My own answer';
  record.identityConfirmed = true;
  const changed = main();
  changed.configs.A0.prediction.reason = 'Correction';
  const next = withSource(record, 'main', changed, 'corrected.zip');
  assert.equal(next.analysis.conclusionA, 'My own answer');
  assert.equal(next.needsReview, true);
  assert.equal(next.identityConfirmed, false);
  assert.equal(record.needsReview, false);
  changed.group.id = 'other';
  assert.throws(
    () => withSource(record, 'main', changed, 'other.zip'),
    /different group/,
  );
  const pre = makeValidSyntheticEvidence();
  pre.student.university_student_id = 'OTHER';
  assert.throws(
    () => withSource(record, 'prelab', pre, 'other.zip'),
    /different student/,
  );
});
test('individual backup and ZIP round-trip zero and three images, originals and writing', async () => {
  for (const count of [0, 1, 3]) {
    const record = individual();
    record.analysis.conclusionA = 'Independent result';
    const images = {};
    for (const slot of ['A0', 'A1', 'M0trigger'].slice(0, count))
      images[slot] = await validateImage(
        slot,
        new Blob([png]),
        'scope.png',
        decode,
      );
    const backup = await postlabBackup(record, images),
      parsed = await parsePostlabFile(encode(backup), decode);
    assert.deepEqual(parsed.record.sources.prelab, record.sources.prelab);
    assert.equal(parsed.record.analysis.conclusionA, 'Independent result');
    assert.equal(Object.keys(parsed.images).length, count);
    for (const image of Object.values(parsed.images))
      assert.deepEqual(new Uint8Array(await image.blob.arrayBuffer()), png);
    const zipped = await postlabZip(record, images),
      restored = await parsePostlabFile(zipped, decode);
    assert.deepEqual(restored.record, parsed.record);
    assert.equal(unzipSync(zipped)['screenshots/'].length, 0);
  }
});
test('unfinished individual work can be backed up without either source', async () => {
  const record = createPostlab();
  const parsed = await parsePostlabFile(
    encode(await postlabBackup(record, {})),
    decode,
  );
  assert.deepEqual(parsed.record, record);
});
test('invalid individual imports cannot silently become accepted sources or answers', async () => {
  const record = individual();
  record.analysis.extra = 'bad';
  assert.throws(() => validatePostlab(record));
  const backup = await postlabBackup(individual(), {});
  backup.images = [{ slot: 'foreign' }];
  await assert.rejects(parsePostlabFile(encode(backup), decode));
});
test('reports include complete source evidence and individual answers, not raw HTML or shared conclusions', () => {
  const record = individual();
  record.sources.main.analysis.conclusionA = 'OLD SHARED CONCLUSION';
  record.analysis.conclusionA = '<script>unsafe</script>';
  const rendered = individualReport(record, { A0: 'blob:local-image' });
  assert.match(rendered, /Original response \(preserved\)/);
  assert.match(rendered, /Revised response/);
  assert.match(rendered, /Understanding|understanding/);
  assert.match(rendered, /data-report-image="A0"/);
  assert.match(rendered, /Image not attached/);
  assert.match(rendered, /&lt;script&gt;unsafe/);
  assert.doesNotMatch(rendered, /<script>|OLD SHARED CONCLUSION/);
  assert.match(rendered, /DRAFT \/ INCOMPLETE/);
});
test('Vercel-only packaging includes both runtimes and no network upload APIs', async () => {
  const script = await readFile(
    new URL('../scripts/package-555-lab.mjs', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(script, /output\/555-main-lab|START_HERE/);
  for (const name of ['555-main-lab', '555-post-lab']) {
    const html = await readFile(
      new URL(`../public/worksheets/${name}.html`, import.meta.url),
      'utf8',
    );
    assert.doesNotMatch(
      html,
      /<script[^>]+src=|fetch\(|XMLHttpRequest|sendBeacon\(/,
    );
  }
});
