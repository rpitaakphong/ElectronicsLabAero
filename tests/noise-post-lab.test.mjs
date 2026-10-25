import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { createRecord, updateField, withSource, missingWork, validateRecord, STORAGE_KEY, DATABASE } from '../activities/noise-filtering-post-lab/model.js';
import { parseSource, createBackup, createZip, parseBackup, validateSources, FORMAT } from '../activities/noise-filtering-post-lab/files.js';
import { readArchive } from '../activities/noise-filtering-post-lab/archive.js';
import { screen, report, sourceIssues } from '../activities/noise-filtering-post-lab/views.js';
import { fixtures, prelabZip, decode } from './fixtures/noise-post-lab.mjs';
const f = await fixtures();
const main = await parseSource('main', f.main, decode), pre = await parseSource('prelab', f.prelab);
function work() {
  let record = withSource(createRecord(), 'main', main, 'group.zip');
  record = withSource(record, 'prelab', pre, 'personal.zip');
  const sources = { main: { name: 'group.zip', blob: new Blob([f.main]) }, prelab: { name: 'personal.zip', blob: new Blob([f.prelab]) } };
  return { record, sources };
}
test('loads current source ZIPs, optional group identities and compatible R4 pre-lab', async () => {
  assert.equal(main.record.fields['group.student3Name'], pre.student.name);
  assert.equal(main.record.fields['group.student1Id'], '');
  assert.equal((await parseSource('prelab', prelabZip({ ...f.pre, package: '2145427-W12-prelab-review-r4', schema: '2145427-w12-prelab-evidence-review-r4' }))).student.id, f.pre.student.id);
  assert.equal(STORAGE_KEY, 'electronics-noise-filtering-post-lab-v1'); assert.notEqual(STORAGE_KEY, DATABASE);
});
test('source replacement keeps individual answers, original values and marks review', () => {
  const { record } = work(); updateField(record, 'pulses', '<script>literal</script>');
  const next = withSource(record, 'main', main, 'second.zip');
  assert.equal(next.fields.pulses, record.fields.pulses); assert.equal(next.needsReview, true); assert.equal(next.identityConfirmed, false);
  assert.equal(record.sources.main.name, 'group.zip'); assert.equal(next.fields.name, pre.student.name);
  assert.equal(main.record.fields['code.processing'], f.record.fields['code.processing']);
});
test('full ZIP/JSON restore retains original ZIP and image bytes and long literal code', async () => {
  const { record, sources } = work(); record.fields.pulses = 'My individual response';
  const json = await createBackup(record, sources);
  for (const bytes of [strToU8(JSON.stringify(json)), await createZip(record, sources)]) {
    const restored = await parseBackup(bytes, decode);
    assert.deepEqual(restored.record, record);
    assert.deepEqual(new Uint8Array(await restored.sources.main.blob.arrayBuffer()), f.main);
    assert.deepEqual(new Uint8Array(await restored.sources.prelab.blob.arrayBuffer()), f.prelab);
    assert.deepEqual(new Uint8Array(await restored.parsed.main.files['comparison.image'].blob.arrayBuffer()), new Uint8Array(f.image));
    assert.equal(restored.parsed.main.record.fields['code.processing'], f.record.fields['code.processing']);
  }
});
test('unfinished work and valid draft source records remain downloadable', async () => {
  const r = createRecord(); assert(missingWork(r).length > 0);
  const result = await parseBackup(await createZip(r, {}), decode); assert.deepEqual(result.record, r);
  const draft = structuredClone(f.pre); draft.status = 'draft'; draft.originals.p1 = null; draft.responses.p1revision = '';
  assert.equal((await parseSource('prelab', prelabZip(draft))).originals.p1, null);
});
test('rejects other workbooks, mismatched embedded source copies and duplicate paths', async () => {
  await assert.rejects(parseSource('prelab', f.main)); await assert.rejects(parseSource('main', f.prelab));
  const { record, sources } = work(); const bytes = await createZip(record, sources), entries = Object.fromEntries(readArchive(bytes));
  entries['sources/group_main_lab.zip'] = f.prelab;
  await assert.rejects(parseBackup(zipSync(entries, { level: 0 }), decode), /differ/);
  const parts = Object.fromEntries(readArchive(f.prelab));
  const e = JSON.parse(new TextDecoder().decode(parts['prelab_evidence.json'])); e.responses.studentName = 'Different'; e.student.name = 'Different';
  parts['prelab_evidence.json'] = strToU8(JSON.stringify(e));
  await assert.rejects(parseSource('prelab', zipSync(parts, { level: 0 })), /do not match/);
  await assert.rejects(parseSource('prelab', zipSync({ '../unsafe': strToU8('bad') }, { level: 0 })), /Unsafe/);
  await assert.rejects(parseBackup(strToU8(JSON.stringify({ format: '555-post-lab-backup' })), decode));
  assert.throws(() => validateRecord({ ...record, schemaVersion: 2 }));
});
test('rejects truncated, oversized and incomplete backups without changing existing state', async () => {
  const { record, sources } = work(), before = structuredClone(record);
  await assert.rejects(parseSource('prelab', f.prelab.slice(0, -2)));
  await assert.rejects(parseSource('prelab', new Uint8Array(2 * 1024 * 1024 + 1)));
  await assert.rejects(validateSources(record, { main: sources.main }, decode), /missing/);
  await assert.rejects(parseBackup(strToU8(JSON.stringify({ format: FORMAT, backupVersion: 1, record, files: [] })), decode), /missing/);
  assert.deepEqual(record, before);
});
test('views put screenshot before discussion and render code/answers as text with typeset equations', () => {
  const { record } = work(), parsed = { main, prelab: pre }, urls = Object.fromEntries(Object.keys(main.files).map(k => [k, 'blob:synthetic']));
  record.fields.pulses = '</textarea><script>alert(1)</script>';
  const pulses = screen(record, 2, parsed, urls);
  assert(pulses.indexOf('<img') < pulses.indexOf('answer-pulses')); assert(!pulses.includes('<script>'));
  assert.equal((pulses.match(/<textarea/g) || []).length, 1);
  const rc = screen(record, 1, parsed, urls); assert(rc.includes('<math')); assert(rc.includes('Your cutoff calculation')); assert(rc.includes('value=""'));
  const printed = report(record, parsed, urls); assert(printed.includes('<math')); assert(printed.includes('&lt;script&gt;')); assert(!printed.includes('<textarea')); assert(!printed.includes('<script>'));
  assert(!screen(record, 0, parsed, urls).includes('id="identity-confirm" type="checkbox"  disabled'));
});

test('post-lab accepts CSV processing without an Arduino filter sketch or CSV submission', () => {
  const parsed = { main, prelab: pre }, { record } = work();
  assert.equal(main.record.fields['code.digital'], '');
  assert(!sourceIssues(parsed).some(s => /Arduino|sketch|CSV|code|Program used/.test(s)));
  const html = screen(record, 3, parsed, {});
  assert(html.includes('Python') && html.includes('Time (s)') && html.includes('Voltage (V)'));
  assert(html.includes('MA and EMA spreadsheet formulas or code'));
  assert(!html.includes('A1 sample') && !html.includes('Serial Plotter'));
  const older = structuredClone(main.record);
  for (const key of Object.keys(older.fields)) if (key.startsWith('processing.') || key === 'code.processing') older.fields[key] = '';
  older.fields['code.digital'] = '// earlier Arduino sketch'; older.fields['digital.rate'] = '1000';
  const legacy = { main: { record: older, files: main.files }, prelab: pre };
  assert(!sourceIssues(legacy).some(s => /Program used|formulas|sample rate/.test(s)));
  assert(screen(record, 3, legacy, {}).includes('earlier Arduino sketch'));
});

test('post-lab shows the combined FFT image and still accepts earlier separate captures', () => {
  const { record } = work(), parsed = { main, prelab: pre };
  const html = screen(record, 1, parsed, {});
  assert(html.includes('CH1 and CH2 FFT comparison image'));
  assert(html.includes('synthetic-fftComparison.jpeg'));
  assert(!html.includes('no image in the group ZIP'));
  const oldFiles = { ...main.files, 'inputFFT.image': main.files['fftComparison.image'], 'outputFFT.image': main.files['fftComparison.image'] };
  delete oldFiles['fftComparison.image'];
  const older = { main: { record: main.record, files: oldFiles }, prelab: pre };
  assert(!sourceIssues(older).some(s => s.includes('FFT in one image')));
  assert(screen(record, 1, older, {}).includes('earlier group ZIP contains separate FFT images'));
});

test('post-lab shows both trial figures without requesting old table values', () => {
  const { record } = work(), parsed = { main, prelab: pre }, html = screen(record, 3, parsed, {});
  assert(html.includes('synthetic-maTrials.jpeg') && html.includes('synthetic-emaTrials.jpeg'));
  assert(!html.includes('<table') && !html.includes('Compare digital-filter settings after the same RC'));
  assert(!sourceIssues(parsed).some(s => s.includes('Group trial missing')));
  const missing = { main: { record: main.record, files: { ...main.files } }, prelab: pre };
  delete missing.main.files['emaTrials.image'];
  assert(sourceIssues(missing).some(s => s.includes('EMA figure')));
  const older = { main: { record: main.record, files: { ...main.files, 'digital.image': main.files['maTrials.image'] } }, prelab: pre };
  delete older.main.files['maTrials.image']; delete older.main.files['emaTrials.image'];
  assert(!sourceIssues(older).some(s => /(?:MA|EMA) figure/.test(s)));
  assert(screen(record, 3, older, {}).includes('earlier group ZIP contains one combined digital-filter figure'));
});
