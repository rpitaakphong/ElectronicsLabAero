import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { zipSync, unzipSync, strToU8 } from 'fflate';
import { createRecord, validateRecord, updateField, preserve, identityIssues, completeness, CAPTURES, TONES, STORAGE_KEY, DATABASE, PRESERVE_FIELDS, MAX_CODE, codeEntries } from '../activities/noise-filtering-main-lab-v2/model.js';
import { createRecord as legacyRecord } from '../activities/noise-filtering-main-lab-v1/model.js';
import { validateFile, createBackup, parseBackup, createZip, parseFile, MAX_CSV, MAX_TOTAL, checkTotal } from '../activities/noise-filtering-main-lab-v2/files.js';
import { screen, report } from '../activities/noise-filtering-main-lab-v2/views.js';
import { circuit } from '../activities/noise-filtering-main-lab-v2/scientific.js';
import { FILTER_EXAMPLE } from '../activities/noise-filtering-main-lab-v2/filter-examples.js';
import { sketchSources } from '../activities/noise-filtering-main-lab-v2/package-source.mjs';
const decode = async () => true;
const csv = new Blob(['Format,Scope waveform\r\nTime,Voltage\r\n0,2.0\r\n0.001,2.1\r\n']);
const png = new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDV8AAAAASUVORK5CYII=', 'base64')]);
const fixture = async () => ({ 'baseline.csv': await validateFile('baseline.csv', csv, 'scope-original.csv', decode), 'baseline.image': await validateFile('baseline.image', png, 'fft-original.png', decode) });
function preservedRecord() {
  const r = createRecord();
  for (const [id, keys] of Object.entries(PRESERVE_FIELDS)) {
    for (const key of keys) updateField(r, key, key.startsWith('code.') ? 'void setup() {}\r\nvoid loop() {}\r\n// <script>literal & Ω `text`</script>' : `Original ${key}`);
    preserve(r, id);
  }
  return r;
}
test('aircraft v2 isolates old records and retains exactly five required files', () => {
  const r = createRecord(); assert.equal(r.schemaVersion, 2); assert.deepEqual(validateRecord(r), r);
  assert(STORAGE_KEY.endsWith('-v2') && DATABASE.endsWith('-v2'));
  assert.deepEqual(TONES, [50, 55, 70, 120, 150, 180]);
  assert.equal(CAPTURES.filter((c) => c.kind === 'both').length * 2 + CAPTURES.filter((c) => c.kind === 'image').length, 5);
  assert(completeness(r).some((s) => s.includes('scope CSV')));
  assert.throws(() => validateRecord(legacyRecord()), /legacy LDR/);
  for (const activityId of ['555-main-lab', 'noise-filtering-prelab-20261026']) assert.throws(() => validateRecord({ ...r, activityId }), /aircraft/);
});
test('code supports more than 64 KiB, literal input and bounded UTF-8 size', () => {
  const r = createRecord(), text = 'x'.repeat(70 * 1024) + '</textarea><script>literal</script>';
  updateField(r, 'code.generator', text); assert.equal(validateRecord(r).fields['code.generator'], text);
  assert.throws(() => updateField(r, 'code.generator', 'x'.repeat(MAX_CODE + 1)), /128 KiB/);
  assert.throws(() => updateField(r, 'code.generator', 'Ω'.repeat(MAX_CODE / 2 + 1)), /128 KiB/);
  assert.throws(() => updateField(r, 'debug.fix', 'x'.repeat(4001)), /cannot/);
  assert.throws(() => updateField(r, 'unknown', 'x'), /cannot/);
});
test('generator, initial design and digital versions remain independent of subsequent edits', () => {
  const r = createRecord(); assert.throws(() => preserve(r, 'generator'), /Complete/);
  const complete = preservedRecord(), original = structuredClone(complete.originals);
  updateField(complete, 'code.generator', 'Changed generator'); updateField(complete, 'code.digital', 'Changed digital');
  updateField(complete, 'design.cutoff', 'Revised design'); assert.deepEqual(complete.originals, original);
  assert.throws(() => preserve(complete, 'design'), /already/);
  complete.originals.design.fields['design.cutoff'] = ''; assert.throws(() => validateRecord(complete), /preserved/);
});
test('one required name supports one, two or three members with optional IDs', () => {
  const r = createRecord(); Object.assign(r.fields, { 'group.groupId': 'QA', 'group.student1Name': 'Synthetic A' });
  assert.deepEqual(identityIssues(r), []); assert(!report(r, {}, {}).includes('Student 2')); assert(!report(r, {}, {}).includes('Student 3'));
  r.fields['group.student2Name'] = 'Synthetic B'; assert.deepEqual(identityIssues(r), []);
  r.fields['group.student3Name'] = 'Synthetic C'; assert.deepEqual(identityIssues(r), []);
  assert(report(r, {}, {}).includes('Synthetic C'));
  r.fields['group.student1Id'] = '00001'; r.fields['group.student3Id'] = '00001'; assert.match(identityIssues(r).join(), /differ/);
  r.fields['group.student3Id'] = '00003'; assert.deepEqual(identityIssues(r), []);
  r.fields['group.student1Name'] = ' '; assert.match(identityIssues(r).join(), /Student 1 name/);
});
test('malformed records still fail validation', () => {
  const r = createRecord();
  r.fields.unknown = 'x'; assert.throws(() => validateRecord(r), /fields/); delete r.fields.unknown;
  r.current = 9; assert.throws(() => validateRecord(r), /page/); r.current = 0;
  r.fileSlots = ['baseline.csv', 'baseline.csv']; assert.throws(() => validateRecord(r), /inventory/);
});
test('two-member v2 records normalize without changing existing answers or attachment identity', async () => {
  const r = preservedRecord(), files = await fixture();
  r.fields['group.student2Name'] = 'Existing member';
  const backup = await createBackup(r, files);
  delete backup.record.fields['group.student3Name']; delete backup.record.fields['group.student3Id'];
  const oldText = JSON.stringify(backup), restored = await parseBackup(oldText, decode);
  assert.equal(JSON.stringify(backup), oldText);
  assert.equal(restored.record.recordId, backup.record.recordId);
  assert.equal(restored.record.fields['group.student2Name'], 'Existing member');
  assert.equal(restored.record.fields['group.student3Name'], ''); assert.equal(restored.record.fields['group.student3Id'], '');
  assert.deepEqual(restored.record.originals, backup.record.originals);
  assert.equal(await restored.files['baseline.csv'].blob.text(), await csv.text());
  const entries = unzipSync(await createZip(r, files)); entries['main_lab_backup.json'] = strToU8(oldText);
  assert.equal((await parseFile(zipSync(entries, { level: 0 }), decode)).record.fields['group.student3Name'], '');
  const invalid = structuredClone(backup.record); delete invalid.fields['setup.board'];
  assert.throws(() => validateRecord(invalid), /fields/);
});
test('original scope CSV/image bytes survive validation; invalid replacements fail', async () => {
  const files = await fixture(); assert.equal(await files['baseline.csv'].blob.text(), await csv.text());
  await assert.rejects(validateFile('baseline.csv', new Blob(['<html>bad</html>']), 'x.csv'), /header/);
  await assert.rejects(validateFile('baseline.csv', new Blob(['a,b\n1,\0']), 'x.csv'), /binary/);
  await assert.rejects(validateFile('baseline.csv', new Blob([new Uint8Array([255])]), 'x.csv'), /UTF/);
  await assert.rejects(validateFile('baseline.csv', new Blob([new Uint8Array(MAX_CSV + 1)]), 'x.csv'), /5 MiB/);
  await assert.rejects(validateFile('baseline.image', new Blob(['<svg/>']), 'x.png'), /PNG/);
  await assert.rejects(validateFile('baseline.image', png, 'x.png', async () => { throw new Error('cannot decode'); }), /decode/);
  assert.throws(() => checkTotal({ a: { blob: { size: MAX_TOTAL + 1 } } }), /32 MiB/);
});
test('JSON/ZIP round trips retain current and preserved source, designs and attachment bytes', async () => {
  const r = preservedRecord(), files = await fixture(); updateField(r, 'code.digital', '// Later correction\nvoid setup(){}\nvoid loop(){}');
  Object.assign(r.fields, { 'group.student1Name': 'Member A', 'group.student2Name': 'Member B', 'group.student3Name': 'Member C' });
  const backup = await createBackup(r, files); assert.equal(backup.backupVersion, 2);
  const restored = await parseBackup(JSON.stringify(backup), decode), bytes = await createZip(r, files), entries = unzipSync(bytes);
  assert.deepEqual((await parseFile(bytes, decode)).record, restored.record);
  assert.equal(restored.record.fields['group.student3Name'], 'Member C');
  for (const [name, source] of Object.entries(codeEntries(r))) assert.equal(Buffer.from(entries[name]).toString(), source);
  for (const [slot, f] of Object.entries(files)) assert.deepEqual(entries[(slot.endsWith('.csv') ? 'data/' : 'screenshots/') + f.filename], new Uint8Array(await f.blob.arrayBuffer()));
  assert(Object.keys(entries).includes('code/') && Object.keys(entries).length === 10);
  const draft = await parseFile(await createZip(createRecord(), {}), decode); assert.equal(Object.keys(draft.files).length, 0);
});
test('tampered code/evidence, path traversal, missing files and wrong backups are rejected', async () => {
  const r = preservedRecord(), files = await fixture(), entries = unzipSync(await createZip(r, files));
  entries['code/digital_preserved/digital_preserved.ino'] = strToU8('tampered');
  await assert.rejects(parseFile(zipSync(entries, { level: 0 }), decode), /code differs/);
  delete entries['code/digital_preserved/digital_preserved.ino']; entries['../evil'] = strToU8('test');
  await assert.rejects(parseFile(zipSync(entries, { level: 0 }), decode), /Unsafe/);
  const backup = await createBackup(r, files); backup.attachments.pop(); await assert.rejects(parseBackup(JSON.stringify(backup), decode), /missing/);
  await assert.rejects(parseBackup(JSON.stringify({ format: 'noise-filtering-main-lab-backup', backupVersion: 1 }), decode), /legacy LDR/);
  await assert.rejects(parseBackup(JSON.stringify({ format: '555-main-lab-backup', backupVersion: 2 }), decode), /aircraft/);
  await assert.rejects(parseBackup('{bad', decode), /readable/);
});
test('student pages provide discovery, literal code, equations and live-only boundaries', () => {
  const r = preservedRecord(); updateField(r, 'scope.procedure', '<img src=x onerror=alert(1)>');
  const pages = Array.from({ length: 5 }, (_, i) => screen(r, i));
  assert(pages[1].includes('&lt;img') && !pages[1].includes('<img src=x'));
  assert(pages[0].includes('legacy') && pages[0].includes('128 KiB'));
  assert(pages[3].includes('RC_MA') && pages[3].includes('RC_EMA') && pages[3].includes('DIGITAL_FILTERS'));
  assert(!/Press (?:the )?(?:Math|MATH)|MATH\s*→\s*FFT/.test(pages.join('')));
  assert(!pages.join('').includes('/noise-filtering-post-lab'));
  assert(pages[1].includes('<math') && pages[2].includes('<math') && report(r, {}, {}).includes('<math'));
  assert(circuit('baseline').includes('A0') && circuit('baseline').includes('A1'));
  assert(circuit('filtered').includes('Your R') && !circuit('baseline').includes('D9'));
});
test('packaging exposes only student resources and preserves the exact standalone starter', async () => {
  const html = await readFile('public/worksheets/noise-filtering-main-lab-v2.html', 'utf8');
  assert(!/<script[^>]+src=/.test(html)); assert(!/@import|url\(https?:/.test(html));
  assert(!html.includes('INSTRUCTOR_PILOT.md') && !html.includes('repaired.ino'));
  const directory = 'public/courses/2145427/week12/main-lab/v2.0.0/';
  assert.deepEqual((await readdir(directory)).sort(), ['CAPTURE_GUIDE.txt', 'FILTER_EXAMPLES.txt', 'aircraft_signal_starter.zip']);
  const zip = unzipSync(new Uint8Array(await readFile(directory + 'aircraft_signal_starter.zip'))), sources = await sketchSources();
  assert.deepEqual(Object.keys(zip), ['aircraft_signal_starter/aircraft_signal_starter.ino']);
  assert.equal(Buffer.from(Object.values(zip)[0]).toString(), sources.starter);
  assert.equal(await readFile(directory + 'FILTER_EXAMPLES.txt', 'utf8'), FILTER_EXAMPLE);
  assert.equal(sources.repaired, sources.starter.replace('timerOK = startSignalGenrator();', 'timerOK = startSignalGenerator();'));
  assert(!sources.starter.includes('#include "signal_math.h"'));
});
test('actual shared waveform, timing, queue and working filter examples pass C++ numerical checks', async () => {
  await mkdir('output/noise-aircraft-v2-tests', { recursive: true });
  await writeFile('output/noise-aircraft-v2-tests/filter_examples.h', FILTER_EXAMPLE);
  const compile = spawnSync(process.env.CXX || 'c++', ['-std=c++17', '-Wall', '-Wextra', '-Werror', '-Ioutput/noise-aircraft-v2-tests', 'tests/noise-main-lab-v2-numerics.cpp', '-o', 'output/noise-aircraft-v2-tests/numerics'], { encoding: 'utf8' });
  assert.equal(compile.status, 0, compile.stderr);
  const run = spawnSync('output/noise-aircraft-v2-tests/numerics', [], { encoding: 'utf8' }); assert.equal(run.status, 0, run.stderr);
});
test('real completed firmware keeps sampling through serial stalls and preserves partial lines', async () => {
  await mkdir('output/noise-aircraft-v2-runtime', { recursive: true });
  await writeFile('output/noise-aircraft-v2-runtime/digital.ino', (await sketchSources()).digital);
  const compile = spawnSync(process.env.CXX || 'c++', ['-std=c++17', '-Wall', '-Wextra', '-Werror', '-Itests/fixtures/aircraft', '-Ioutput/noise-aircraft-v2-runtime', 'tests/noise-main-lab-v2-runtime.cpp', '-o', 'output/noise-aircraft-v2-runtime/runtime'], { encoding: 'utf8' });
  assert.equal(compile.status, 0, compile.stderr);
  const run = spawnSync('output/noise-aircraft-v2-runtime/runtime', [], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
});
