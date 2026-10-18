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
  groupStudents,
  designIssues,
  designReference,
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
import {
  numericAnswerIssue,
  answerProgress,
  updateIndividualField,
} from '../activities/555-post-lab/calculations.js';
import { comparisonSection } from '../activities/555-post-lab/comparison.js';
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
test('group form has exactly four identity textboxes plus Group ID and no editable analysis', () => {
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
test('solo identity is valid, while partial secondary details and duplicate IDs are blocked', () => {
  const record = main();
  record.group.student1.id = '000001';
  record.group.student2 = { name: ' ', id: '' };
  assert.deepEqual(identityIssues(record), []);
  assert.equal(groupStudents(record).length, 1);
  assert.doesNotMatch(report(record), /Student 2/);
  assert.match(screen(record, 0), /Student 2 name \(optional\)/);
  assert.match(screen(record, 0), /Student 2 ID \(optional\)/);
  const filename = downloadStem('MAIN', record.group.id, groupStudents(record));
  assert.match(filename, /000001/);
  assert.doesNotMatch(filename, /DRAFT|Partner/);
  record.group.student2.name = 'Second student';
  assert.deepEqual(identityIssues(record), ['Enter Student 2 ID.']);
  record.group.student2 = { name: '', id: '000002' };
  assert.deepEqual(identityIssues(record), ['Enter Student 2 name.']);
  record.group.student2.name = 'Second student';
  assert.deepEqual(identityIssues(record), []);
  record.group.student2.id = '000001';
  assert.match(identityIssues(record).join(' '), /different/);
});
test('solo legacy recovery retains the recorded member and requires only that student ID', () => {
  const legacy = main();
  legacy.schemaVersion = 2;
  legacy.group = { id: 'Solo legacy', members: '  Original Student  ' };
  delete legacy.legacyMembers;
  legacy.analysis.conclusionA = 'Earlier shared writing';
  const recovered = validateRecord(legacy);
  assert.equal(recovered.group.student1.name, 'Original Student');
  assert.deepEqual(recovered.group.student2, { name: '', id: '' });
  assert.equal(recovered.legacyMembers, '  Original Student  ');
  assert.equal(recovered.analysis.conclusionA, legacy.analysis.conclusionA);
  assert.deepEqual(identityIssues(recovered), ['Enter Student 1 ID.']);
  recovered.group.student1.id = '000001';
  assert.deepEqual(identityIssues(recovered), []);
});
test('free timing choices freeze Lab 2 capacitance and survive main and individual JSON/ZIP transfers', async () => {
  for (const capacitor of ['0.47', '22']) {
    const record = main();
    record.group.student2 = { name: '', id: '' };
    for (const id of ['A0', 'A1', 'M0']) {
      Object.assign(record.configs[id].design, {
        r1a: '127.25',
        capacitor,
        measuredR1: '126.8',
        measuredC: capacitor,
      });
      if (id.startsWith('A')) record.configs[id].design.r2a = '812.75';
      record.configs[id].prediction.reason = 'Student-selected values';
      preservePrediction(record, id);
      if (id === 'A0') record.configs.A0.measurement.frequency = '1.01';
    }
    record.configs.A0.design.capacitor = '47';
    record.configs.A0.measurement.frequency = '9';
    assert.deepEqual(designReference(record, 'A1'), {
      frequency: '1.01',
      capacitor,
    });
    const original = structuredClone(record.configs);
    const images = {
      A0: await validateImage('A0', new Blob([png]), 'scope.png', decode),
    };
    for (const bytes of [
      encode(await createBackup(record, images)),
      await createLabZip(record, images, 'main.json'),
    ]) {
      const restored = await parseMainFile(bytes, decode);
      assert.deepEqual(restored.record.configs, original);
      assert.deepEqual(identityIssues(restored.record), []);
      let post = withSource(
        withSource(createPostlab(), 'main', restored.record, 'main.zip'),
        'prelab',
        makeValidSyntheticEvidence(),
        'prelab.json',
      );
      post.identityConfirmed = true;
      assert.deepEqual(issues(post), []);
      assert.doesNotMatch(postlabScreen(post, 0, restored.images), /Student 2/);
      for (const exportBytes of [
        encode(await postlabBackup(post, restored.images)),
        await postlabZip(post, restored.images),
      ]) {
        const recovered = await parsePostlabFile(exportBytes, decode);
        assert.deepEqual(recovered.record.sources.main.configs, original);
        assert.deepEqual(
          new Uint8Array(await recovered.images.A0.blob.arrayBuffer()),
          png,
        );
      }
    }
  }
});
test('invalid timing text stays portable as a draft but cannot become a frozen initial design', async () => {
  for (const value of [
    '',
    '0',
    '-0.47',
    'Infinity',
    '1e309',
    'not yet measured',
  ]) {
    const record = main();
    Object.assign(record.configs.A0.design, {
      r1a: '127',
      r2a: '812',
      capacitor: value,
    });
    record.configs.A0.prediction.reason = 'Draft';
    assert(designIssues('A0', record.configs.A0.design).length);
    assert.throws(() => preservePrediction(record, 'A0'), /capacitance/);
    const restored = await parseMainFile(
      encode(await createBackup(record, {})),
      decode,
    );
    assert.equal(restored.record.configs.A0.design.capacitor, value);
  }
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
  assert.match(html, /data-field="calculations.A0.high"/);
  assert.doesNotMatch(html, /data-field="configs\./);
  assert.equal((html.match(/data-field="analysis\./g) || []).length, 8);
  assert.equal((html.match(/data-calculation-answer/g) || []).length, 13);
  assert.equal(
    (html.match(/data-field="calculations\.[^.]+\.explanation"/g) || []).length,
    3,
  );
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
test('numeric answers are text drafts, not graded or calculated, and survive JSON/ZIP with images', async () => {
  const record = individual();
  for (const text of ['-12.5', '+3', '0', '.25', '1e-3', '9999'])
    assert.equal(numericAnswerIssue(text), '');
  for (const text of ['-', '.', '1e', 'Infinity', 'NaN', '1%'])
    assert(numericAnswerIssue(text));
  assert(updateIndividualField(record, 'calculations.A0.high', '-12.5'));
  assert(updateIndividualField(record, 'calculations.A1.frequencyRatio', '0'));
  assert(updateIndividualField(record, 'calculations.M0.pulse', '-'));
  assert(
    updateIndividualField(
      record,
      'calculations.A0.explanation',
      'My short explanation',
    ),
  );
  assert.equal(updateIndividualField(record, 'sources.main', 'bad'), false);
  assert.equal(
    updateIndividualField(record, 'calculations.__proto__.high', 'bad'),
    false,
  );
  assert.equal(
    updateIndividualField(record, 'analysis.workings', 'overwrite'),
    false,
  );
  assert.deepEqual(answerProgress(record), { started: 4, total: 24 });
  const images = {
    A0: await validateImage('A0', new Blob([png]), 'scope.png', decode),
  };
  record.sources.main.evidence.A0.filename = images.A0.filename;
  for (const bytes of [
    encode(await postlabBackup(record, images)),
    await postlabZip(record, images),
  ]) {
    const restored = await parsePostlabFile(bytes, decode);
    assert.deepEqual(restored.record, record);
    assert.deepEqual(
      new Uint8Array(await restored.images.A0.blob.arrayBuffer()),
      png,
    );
  }
  const reportHtml = individualReport(record, {});
  assert.match(reportHtml, /-12.5 %/);
  assert.match(reportHtml, /My short explanation/);
  assert.doesNotMatch(
    reportHtml,
    /Signed deviation|Measured ratio|data-calculation-answer/,
  );
  const changed = withSource(
    record,
    'main',
    record.sources.main,
    'reimport.json',
  );
  assert(changed.needsReview);
  assert.deepEqual(changed.calculations, record.calculations);
  const numericOnly = individual();
  numericOnly.calculations.A0.high = '0';
  assert(
    withSource(numericOnly, 'main', numericOnly.sources.main, 'new.json')
      .needsReview,
  );
});
test('v1 local records and backups recover earlier writing without inventing numeric answers', async () => {
  const legacy = individual();
  legacy.schemaVersion = 1;
  delete legacy.calculations;
  legacy.analysis.workings = 'Earlier paper working';
  legacy.analysis.comparison = 'Earlier comparison';
  const restored = validatePostlab(legacy);
  assert.equal(legacy.schemaVersion, 1);
  assert.equal(restored.schemaVersion, 2);
  assert.equal(restored.analysis.workings, legacy.analysis.workings);
  assert(
    Object.values(restored.calculations).every((lab) =>
      Object.values(lab).every((v) => v === ''),
    ),
  );
  const envelope = {
    format: '555-post-lab-backup',
    backupVersion: 1,
    record: legacy,
    images: [],
  };
  assert.deepEqual(
    (await parsePostlabFile(encode(envelope), decode)).record,
    restored,
  );
  const zipped = zipSync(
    {
      'earlier-individual.json': encode(envelope),
      'screenshots/': new Uint8Array(),
    },
    { level: 0 },
  );
  assert.deepEqual((await parsePostlabFile(zipped, decode)).record, restored);
  assert.match(
    comparisonSection(restored),
    /Earlier individual comparison writing \(recovery\)/,
  );
  assert.match(individualReport(restored, {}), /recovery appendix/);
  assert.equal(answerProgress(restored).started, 0);
  for (const version of [0, 3]) {
    assert.throws(() =>
      validatePostlab({ ...restored, schemaVersion: version }),
    );
    await assert.rejects(
      parsePostlabFile(encode({ ...envelope, backupVersion: version }), decode),
    );
  }
});
test('missing references, zero denominators and changed frozen frequency never produce answers', () => {
  const record = individual();
  record.sources.main.configs.A0.prediction.high = '0';
  record.sources.main.configs.A0.measurement.high = '1';
  record.sources.main.configs.A1.measurement.low = '0';
  record.sources.main.configs.A1.measurement.high = '1';
  record.sources.main.configs.A0.measurement.frequency = '1.2';
  record.sources.main.configs.A1.original = {
    design: structuredClone(record.sources.main.configs.A1.design),
    prediction: structuredClone(record.sources.main.configs.A1.prediction),
    reference: { frequency: '1', capacitor: '0.47' },
    at: new Date().toISOString(),
  };
  const html = comparisonSection(record);
  assert.match(html, /denominator is zero/);
  assert.match(html, /a reference value is not recorded/);
  assert.match(html, /saved reference: 1 Hz/);
  assert.match(html, /current imported Lab 1 frequency: 1.2 Hz/);
  assert.equal(
    (html.match(/data-calculation-answer[^>]*value=""/g) || []).length,
    13,
  );
  assert.doesNotMatch(
    html,
    /Calculation help|Optional reference charts|Numerator:|Denominator:/,
  );
  assert.doesNotMatch(html, /Signed deviation|Measured ratio/);
});
test('invalid individual imports cannot silently become accepted sources or answers', async () => {
  const record = individual();
  record.analysis.extra = 'bad';
  assert.throws(() => validatePostlab(record));
  const backup = await postlabBackup(individual(), {});
  backup.images = [{ slot: 'foreign' }];
  await assert.rejects(parsePostlabFile(encode(backup), decode));
});
test('post-lab questions are explicit without helper text or retired optional sections', async () => {
  const record = individual();
  const html = postlabScreen(record, 3, {});
  assert.doesNotMatch(
    html,
    /Numerator:|Denominator:|Calculation help|Optional reference charts|Optional simulator results or additional notes|data-field="optional\./,
  );
  for (const key of [
    'paths',
    'conversion',
    'timing',
    'uncertainty',
    'verification',
    'conclusionA',
    'conclusionM',
    'improvement',
  ]) {
    assert.match(html, new RegExp(`data-field="analysis\\.${key}"`));
    assert.doesNotMatch(html, new RegExp(`field-analysis-${key}-hint`));
  }
  for (const text of [
    'charging and discharging paths',
    'role of pins 2, 6 and 7',
    'starting and ending voltages',
    'Discuss Lab 1, Lab 2 and Lab 3 separately',
    'support or contradict your explanation',
    'For Lab 1 and Lab 2 separately',
    'produced one pulse per brief button press',
    'which result it should improve and why',
  ])
    assert(html.includes(text));
  assert.equal((html.match(/data-calculation-answer/g) || []).length, 13);
  assert.deepEqual(answerProgress(record), { started: 0, total: 24 });
  assert.doesNotMatch(
    individualReport(record, {}),
    /Individual optional notes|Earlier individual optional notes/,
  );
  record.optional.simulation = 'Earlier individual simulation note';
  record.analysis.paths = 'Existing discussion';
  for (const bytes of [
    encode(await postlabBackup(record, {})),
    await postlabZip(record, {}),
  ]) {
    const parsed = await parsePostlabFile(bytes, decode);
    assert.deepEqual(parsed.record, record);
    const printed = individualReport(parsed.record, {});
    assert.match(
      printed,
      /Earlier individual optional notes · recovery appendix/,
    );
    assert.match(
      printed,
      /Earlier individual simulation note|Existing discussion/,
    );
    assert.doesNotMatch(
      printed,
      /Numerator:|Denominator:|Calculation help|Optional reference charts/,
    );
  }
});
test('Lab 1 post-lab and report show the duty target without changing answers or adding calculations', () => {
  const record = individual(), before = JSON.stringify(record);
  const html = postlabScreen(record, 3, {}), printed = individualReport(record, {});
  for (const output of [html, printed]) {
    assert.match(output, /0\.8 ≤ f ≤ 1\.3 Hz/);
    assert.match(output, /accepted measured range: 45–55%/);
    assert.match(output, /Aim for 50% HIGH duty cycle/);
  }
  assert.match(html, /Use your measured frequency and HIGH duty cycle for Lab 1/);
  assert.equal((html.match(/data-calculation-answer/g) || []).length, 13);
  assert.deepEqual(answerProgress(record), { started: 0, total: 24 });
  assert.equal(JSON.stringify(record), before);
  record.identityConfirmed = true;
  record.sources.main.configs.A0.measurement.duty = '60';
  assert.deepEqual(issues(record), [], 'Measured duty outside the target must not introduce a report restriction');
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
