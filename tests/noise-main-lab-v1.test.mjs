import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { zipSync, unzipSync, strToU8 } from 'fflate';
import { ACTIVITY, createRecord, validateRecord, updateField, preserve, identityIssues, completeness, CAPTURES, STORAGE_KEY, DATABASE } from '../activities/noise-filtering-main-lab-v1/model.js';
import { validateFile, createBackup, parseBackup, createZip, parseFile, MAX_CSV, MAX_TOTAL, checkTotal } from '../activities/noise-filtering-main-lab-v1/files.js';
import { screen, report } from '../activities/noise-filtering-main-lab-v1/views.js';
import { circuit } from '../activities/noise-filtering-main-lab-v1/scientific.js';
const decode = async () => true;
const csv = new Blob(['# SYNTHETIC QA\r\nsample_index,t_us,raw_v\r\n0,0,2.0\r\n1,2000,2.01\r\n']);
const png = new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDV8AAAAASUVORK5CYII=', 'base64')]);
const fixture = async () => ({ 'snr_raw.csv': await validateFile('snr_raw.csv', csv, 'synthetic.csv', decode), 'snr_raw.image': await validateFile('snr_raw.image', png, 'synthetic.png', decode) });

test('new main lab has isolated v1 records and all required SNR evidence', () => {
  const r = createRecord(); assert.equal(r.activityId, ACTIVITY); assert.equal(r.schemaVersion, 1);
  assert(Object.values(r.fields).every((v) => v === ''));
  assert(!STORAGE_KEY.includes('555') && !DATABASE.includes('prelab'));
  assert.deepEqual(validateRecord(r), r);
  assert.equal(CAPTURES.filter((c) => c.id.startsWith('snr_') && c.kind === 'both').length, 3);
  assert(completeness(r).some((v) => /SNR.*attach CSV/.test(v)));
  for (const activityId of ['555-main-lab', 'noise-filtering-prelab-20261026']) assert.throws(() => validateRecord({ ...r, activityId }), /main-lab v1/);
});
test('preserved bench predictions survive later corrections and reject direct mutation routes', () => {
  const r = createRecord(); assert.throws(() => preserve(r, 'analog'), /Enter/);
  for (const k of ['configuration', 'prediction', 'reason']) updateField(r, `prediction.analog.${k}`, 'Synthetic original');
  preserve(r, 'analog'); const p = structuredClone(r.originals.analog);
  updateField(r, 'prediction.analog.prediction', 'Synthetic revised');
  assert.deepEqual(r.originals.analog, p); assert.throws(() => preserve(r, 'analog'), /already/);
  assert.throws(() => updateField(r, 'originals.analog', 'replace'), /cannot/);
  r.originals.analog.reason = ''; assert.throws(() => validateRecord(r), /preserved/);
});
test('identity allows one or two members without inventing a second participant', () => {
  const r = createRecord(); Object.assign(r.fields, { 'group.groupId': 'QA', 'group.student1Name': 'Synthetic A', 'group.student1Id': '00001' });
  assert.deepEqual(identityIssues(r), []); assert(!report(r, {}, {}).includes('Student 2'));
  r.fields['group.student2Name'] = 'Synthetic B'; assert.match(identityIssues(r).join(), /both/);
  r.fields['group.student2Id'] = '00001'; assert.match(identityIssues(r).join(), /differ/);
  r.fields['group.student2Id'] = '00002'; assert.deepEqual(identityIssues(r), []);
});
test('oversized, malformed and unknown record fields are rejected', () => {
  const r = createRecord(); r.fields.unknown = 'x'; assert.throws(() => validateRecord(r), /fields/);
  delete r.fields.unknown; r.current = 9; assert.throws(() => validateRecord(r), /page/);
  r.current = 0; r.fileSlots = ['snr_raw.csv', 'snr_raw.csv']; assert.throws(() => validateRecord(r), /inventory/);
  assert.throws(() => updateField(createRecord(), 'setup.board', 'x'.repeat(4001)), /cannot/);
});
test('CSV and image validation preserves original bytes and rejects invalid replacements', async () => {
  const files = await fixture(); assert.equal(await files['snr_raw.csv'].blob.text(), await csv.text());
  await assert.rejects(validateFile('snr_raw.csv', new Blob(['<html>bad</html>']), 'x.csv'), /header/);
  await assert.rejects(validateFile('snr_raw.csv', new Blob(['a,b\n1,\0']), 'x.csv'), /binary/);
  await assert.rejects(validateFile('snr_raw.csv', new Blob([new Uint8Array([255, 255])]), 'x.csv'), /UTF/);
  await assert.rejects(validateFile('snr_raw.csv', new Blob([new Uint8Array(MAX_CSV + 1)]), 'x.csv'), /5 MiB/);
  await assert.rejects(validateFile('snr_raw.image', new Blob(['<svg/>']), 'x.png'), /PNG/);
  await assert.rejects(validateFile('snr_raw.image', png, 'x.png', async () => { throw new Error('cannot decode'); }), /decode/);
  assert.throws(() => checkTotal({ a: { blob: { size: MAX_TOTAL + 1 } } }), /32 MiB/);
});
test('draft and complete backup/ZIP round trips preserve fields, predictions and original evidence', async () => {
  const r = createRecord(), files = await fixture();
  r.fields['notes.digitalNotes'] = '<script>literal</script> `quotes` & Ω';
  const backup = await createBackup(r, files); const restored = await parseBackup(JSON.stringify(backup), decode);
  assert.equal(restored.record.fields['notes.digitalNotes'], r.fields['notes.digitalNotes']);
  assert.equal(await restored.files['snr_raw.csv'].blob.text(), await csv.text());
  const bytes = await createZip(r, files), entries = unzipSync(bytes);
  assert.deepEqual(Object.keys(entries).sort(), ['data/', 'data/snr_raw_csv.csv', 'main_lab_backup.json', 'screenshots/', 'screenshots/snr_raw_image.png'].sort());
  const parsed = await parseFile(bytes, decode); assert.deepEqual(parsed.record, restored.record);
  assert.deepEqual(new Uint8Array(await parsed.files['snr_raw.image'].blob.arrayBuffer()), new Uint8Array(await png.arrayBuffer()));
  assert.equal(Object.keys((await parseFile(await createZip(createRecord(), {}), decode)).files).length, 0);
});
test('ZIP integrity, duplicate paths, untrusted activities and missing evidence fail without a partial result', async () => {
  const files = await fixture(), r = createRecord(), bytes = await createZip(r, files);
  const corrupt = bytes.slice(); corrupt[80] ^= 1; await assert.rejects(parseFile(corrupt, decode), /integrity|header|filename/i);
  const entries = unzipSync(bytes); entries['data/snr_raw_csv.csv'] = strToU8('a,b\n0,1');
  await assert.rejects(parseFile(zipSync(entries, { level: 0 }), decode), /differs/);
  entries['../evil'] = strToU8('test'); await assert.rejects(parseFile(zipSync(entries, { level: 0 }), decode), /Unsafe/);
  const backup = await createBackup(r, files); backup.attachments.pop(); await assert.rejects(parseBackup(JSON.stringify(backup), decode), /missing/);
  await assert.rejects(parseBackup(JSON.stringify({ format: '555-main-lab-backup', backupVersion: 2 }), decode), /Noise/);
  await assert.rejects(parseBackup('{bad', decode), /readable/);
});
test('student pages retain pre-lab boundaries, real tables, typeset math and literal learner input', () => {
  const r = createRecord(); r.fields['notes.usefulSignal'] = '<img src=x onerror=alert(1)>';
  const pages = Array.from({ length: 5 }, (_, i) => screen(r, i));
  assert(pages[1].includes('&lt;img')); assert(!pages[1].includes('<img src=x'));
  assert(pages[2].includes('PRE-P01') && pages[3].includes('PRE-P02'));
  assert(pages[2].includes('5 Hz') && pages[2].includes('SNR is required'));
  assert(pages[2].includes('<math') && pages[3].includes('<math'));
  assert(!pages.join('').includes('/noise-filtering-post-lab'));
  for (const kind of ['baseline', 'analog', 'generator']) { const svg = circuit(kind); assert(svg.includes('A0')); assert(svg.includes('GND')); }
  assert(circuit('baseline').includes('1 kΩ')); assert(circuit('generator').includes('D9 is not connected'));
});
test('packaged worksheet needs no runtime network and exposes only the student downloads', async () => {
  const html = await readFile('public/worksheets/noise-filtering-main-lab-v1.html', 'utf8');
  assert(!/<script[^>]+src=/.test(html)); assert(!/@import|url\(https?:/.test(html));
  const sketch = unzipSync(new Uint8Array(await readFile('public/courses/2145427/week12/main-lab/v1.0.0/noise_filtering_main_lab.zip')));
  assert.deepEqual(Object.keys(sketch).sort(), ['noise_filtering_main_lab/acquisition.h', 'noise_filtering_main_lab/noise_filtering_main_lab.ino']);
  assert(!html.includes('INSTRUCTOR_PILOT.md'));
});
test('actual Arduino filter/timing implementation passes host numerical regression', async () => {
  await mkdir('output/noise-main-lab', { recursive: true });
  const compile = spawnSync(process.env.CXX || 'c++', ['-std=c++17', '-Wall', '-Wextra', '-Werror', 'tests/noise-main-lab-v1-numerics.cpp', '-o', 'output/noise-main-lab/numerics-v1'], { encoding: 'utf8' });
  assert.equal(compile.status, 0, compile.stderr);
  const run = spawnSync('output/noise-main-lab/numerics-v1', [], { encoding: 'utf8' }); assert.equal(run.status, 0, run.stderr);
});
