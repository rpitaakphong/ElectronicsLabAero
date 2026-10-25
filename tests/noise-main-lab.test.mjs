import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { zipSync, unzipSync, strToU8 } from 'fflate';
import { JSDOM } from 'jsdom';
import { createRecord, validateRecord, updateField, preserve, identityIssues, completeness, CAPTURES, SCREENS, TABLES, ALLOWANCES, STORAGE_KEY, DATABASE, PRESERVE_FIELDS, MAX_CODE, codeEntries } from '../activities/noise-filtering-main-lab/model.js';
import { createRecord as legacyRecord } from '../activities/noise-filtering-main-lab-v1/model.js';
import { createRecord as sineRecord } from '../activities/noise-filtering-main-lab-v2/model.js';
import { createRecord as pulseRecord } from '../activities/noise-filtering-main-lab-v3/model.js';
import { createBackup as pulseBackup, parseBackup as parsePulseBackup } from '../activities/noise-filtering-main-lab-v3/files.js';
import { validateFile, createBackup, parseBackup, createZip, parseFile, MAX_IMAGE, MAX_TOTAL, checkTotal } from '../activities/noise-filtering-main-lab/files.js';
import { screen, report } from '../activities/noise-filtering-main-lab/views.js';
import { circuit } from '../activities/noise-filtering-main-lab/scientific.js';
import { FILTER_EXAMPLE } from '../activities/noise-filtering-main-lab/instructor/filter-examples.js';
import { sketchSources } from '../activities/noise-filtering-main-lab/package-source.mjs';
const decode = async () => true;
const csv = new Blob(['Format,Scope waveform\r\nTime,Voltage\r\n0,2.0\r\n0.001,2.1\r\n']);
const png = new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDV8AAAAASUVORK5CYII=', 'base64')]);
const fixture = async () => ({ 'source.image': await validateFile('source.image', png, 'original-waveform.png', decode), 'spectrum.image': await validateFile('spectrum.image', png, 'original-fft.png', decode) });
function preservedRecord() {
  const r = createRecord();
  for (const [id, keys] of Object.entries(PRESERVE_FIELDS)) {
    for (const key of keys) updateField(r, key, key.startsWith('code.') ? 'void setup() {}\r\nvoid loop() {}\r\n// <script>literal & Ω `text`</script>' : `Original ${key}`);
    preserve(r, id);
  }
  return r;
}
test('seven sections, v4 namespaces, blank frequency rows and six required images', () => {
  const r = createRecord(); assert.equal(r.schemaVersion, 4); assert.deepEqual(validateRecord(r), r);
  assert(STORAGE_KEY.endsWith('-v4') && DATABASE.endsWith('-v4'));
  assert.equal(SCREENS.length, 7); assert.equal(ALLOWANCES.reduce((n, v) => n + parseInt(v), 0), 170);
  assert.equal(CAPTURES.filter(c => c.kind === 'image').length, 6);
  for (const [id] of TABLES.discovery.rows) assert.equal(r.fields[`discovery.${id}.frequency`], '');
  assert(!completeness(r).some((s) => /(?:attach|submit).*CSV/.test(s)));
  assert.throws(() => validateRecord(legacyRecord()), /legacy LDR/);
  assert.throws(() => validateRecord(sineRecord()), /sine-wave v2/);
  for (const activityId of ['555-main-lab', 'noise-filtering-prelab-20261026']) assert.throws(() => validateRecord({ ...r, activityId }), /aircraft/);
  for (let current = 0; current < 7; current++) assert.equal(validateRecord({...r, current}).current, current);
  assert.throws(() => validateRecord({...r, current: 7}), /page/);
});
test('code supports more than 64 KiB, literal input and bounded UTF-8 size', () => {
  const r = createRecord(), text = 'x'.repeat(70 * 1024) + '</textarea><script>literal</script>';
  updateField(r, 'code.generator', text); assert.equal(validateRecord(r).fields['code.generator'], text);
  assert.throws(() => updateField(r, 'code.generator', 'x'.repeat(MAX_CODE + 1)), /128 KiB/);
  assert.throws(() => updateField(r, 'code.generator', 'Ω'.repeat(MAX_CODE / 2 + 1)), /128 KiB/);
  assert.throws(() => updateField(r, 'source.verification', 'x'.repeat(4001)), /cannot/);
  assert.throws(() => updateField(r, 'unknown', 'x'), /cannot/);
});
test('generator, initial design and digital versions remain independent of subsequent edits', () => {
  const r = createRecord(); assert.throws(() => preserve(r, 'generator'), /Complete/);
  const complete = preservedRecord(), original = structuredClone(complete.originals);
  updateField(complete, 'code.generator', 'Changed generator'); updateField(complete, 'code.digital', 'Changed digital');
  updateField(complete, 'design.cutoff', 'Revised design'); assert.deepEqual(complete.originals, original);
  assert.throws(() => preserve(complete, 'design'), /already/);
  complete.originals.design.fields['design.cutoff'] = ''; assert.throws(() => validateRecord(complete), /saved copy/);
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
  r.fileSlots = ['source.image', 'source.image']; assert.throws(() => validateRecord(r), /inventory/);
});
test('v3 pulse records restore only in their own worksheet', async () => {
  const r = pulseRecord(); r.fields['scope.observations'] = 'EXISTING V3 MEASUREMENTS';
  const backup = await pulseBackup(r, {}), original = JSON.stringify(backup);
  await assert.rejects(parseBackup(original, decode), /five-section pulse v3.*noise-filtering-main-lab-v3/);
  assert.throws(() => validateRecord(r), /five-section pulse v3/);
  const restored = await parsePulseBackup(original, decode);
  assert.equal(restored.record.fields['scope.observations'], 'EXISTING V3 MEASUREMENTS');
  assert.equal(JSON.stringify(backup), original);
});
test('image validation rejects CSV, oversized images and malformed replacements', async () => {
  const files = await fixture(); assert.deepEqual(await files['source.image'].blob.arrayBuffer(), await png.arrayBuffer());
  await assert.rejects(validateFile('source.csv', csv, 'x.csv'), /cannot be added/);
  await assert.rejects(validateFile('source.image', csv, 'x.csv'), /PNG/);
  await assert.rejects(validateFile('source.image', new Blob([new Uint8Array(MAX_IMAGE + 1)]), 'x.png'), /10 MiB/);
  await assert.rejects(validateFile('source.image', new Blob(['<svg/>']), 'x.png'), /PNG/);
  await assert.rejects(validateFile('source.image', png, 'x.png', async () => { throw new Error('cannot decode'); }), /decode/);
  assert.throws(() => checkTotal({ a: { blob: { size: MAX_TOTAL + 1 } } }), /32 MiB/);
});
test('JSON/ZIP round trips retain current and preserved source, designs and attachment bytes', async () => {
  const r = preservedRecord(), files = await fixture(); updateField(r, 'code.digital', '// Later correction\nvoid setup(){}\nvoid loop(){}');
  Object.assign(r.fields, { 'group.student1Name': 'Member A', 'group.student2Name': 'Member B', 'group.student3Name': 'Member C' });
  const backup = await createBackup(r, files); assert.equal(backup.backupVersion, 4);
  const restored = await parseBackup(JSON.stringify(backup), decode), bytes = await createZip(r, files), entries = unzipSync(bytes);
  assert.deepEqual((await parseFile(bytes, decode)).record, restored.record);
  assert.equal(restored.record.fields['group.student3Name'], 'Member C');
  for (const [name, source] of Object.entries(codeEntries(r))) assert.equal(Buffer.from(entries[name]).toString(), source);
  for (const [slot, f] of Object.entries(files)) assert.deepEqual(entries['screenshots/' + f.filename], new Uint8Array(await f.blob.arrayBuffer()));
  assert(Object.keys(entries).includes('code/') && Object.keys(entries).length === 9);
  const draft = await parseFile(await createZip(createRecord(), {}), decode); assert.equal(Object.keys(draft.files).length, 0);
});
test('all pages, saved-copy panels, report and guide use plain language', async () => {
  const prohibited = /\b(?:preserv\w*|evidence|artifacts?)\b/i;
  for (const record of [createRecord(), preservedRecord()]) {
    for (const html of [...Array.from({ length: 7 }, (_, page) => screen(record, page)), report(record, {}, {})]) {
      const dom = new JSDOM(html);
      assert.doesNotMatch(dom.window.document.body.textContent, prohibited);
      dom.window.close();
    }
  }
  assert.doesNotMatch(await readFile('activities/noise-filtering-main-lab/LAB_GUIDE.txt', 'utf8'), prohibited);
  assert.doesNotMatch(completeness(createRecord()).join('\n'), prohibited);
  assert.match(screen(createRecord(), 0), /Save initial source code/);
  assert.doesNotMatch(screen(createRecord(), 2), /Save your initial design|Save initial RC design|data-preserve="design"/);
  assert.doesNotMatch(completeness(createRecord()).join('\n'), /Save initial RC design/i);
  assert.doesNotMatch(screen(createRecord(), 5), /data-preserve="digital"/);
  assert.match(screen(createRecord(), 5), /MA and EMA spreadsheet formulas or code/);
});
test('tampered code/evidence, path traversal, missing files and wrong backups are rejected', async () => {
  const r = preservedRecord(), files = await fixture(), entries = unzipSync(await createZip(r, files));
  entries['code/digital_saved/digital_saved.ino'] = strToU8('tampered');
  await assert.rejects(parseFile(zipSync(entries, { level: 0 }), decode), /code differs/);
  delete entries['code/digital_saved/digital_saved.ino']; entries['../evil'] = strToU8('test');
  await assert.rejects(parseFile(zipSync(entries, { level: 0 }), decode), /Unsafe/);
  const backup = await createBackup(r, files); backup.attachments.pop(); await assert.rejects(parseBackup(JSON.stringify(backup), decode), /missing/);
  await assert.rejects(parseBackup(JSON.stringify({ format: 'noise-filtering-main-lab-backup', backupVersion: 1 }), decode), /legacy LDR/);
  await assert.rejects(parseBackup(JSON.stringify({ format: '555-main-lab-backup', backupVersion: 2 }), decode), /aircraft/);
  await assert.rejects(parseBackup('{bad', decode), /readable/);
});
test('student pages provide discovery, literal code, equations and independent coding', () => {
  const r = preservedRecord(); updateField(r, 'discovery.1.reason', '<img src=x onerror=alert(1)>');
  const pages = SCREENS.map((_, i) => screen(r, i));
  assert(pages[1].includes('&lt;img') && !pages[1].includes('<img src=x'));
  assert(pages[0].includes('v3 workbook') && pages[0].includes('128 KiB'));
  assert(pages[5].includes('Excel, MATLAB, Python') && pages[5].includes('actual sampling interval'));
  assert(pages[4].includes('500 ms/div') && pages[4].includes('10,000-point') && pages[4].includes('Detail CSV'));
  assert(!/Press (?:the )?(?:Math|MATH)|MATH\s*→\s*FFT/.test(pages.join('')));
  assert(!pages.join('').includes('/noise-filtering-post-lab'));
  assert(!pages.join('').includes('source clean') && !pages.join('').includes('FILTER_EXAMPLES'));
  assert(!pages.join('').includes('.csv') && !pages.join('').includes('ExampleMA'));
  assert(pages[3].includes('same time-domain screen') && pages[4].includes('one image containing both CH1 input and CH2 RC output FFT'));
  assert(pages[1].includes('different example frequencies') && pages[4].includes('dBV RMS'));
  assert(report(r, {}, {}).includes('7. Save Lab Files'));
  assert(circuit('baseline').includes('A1 is not connected') && circuit('digital').includes('A1 · ADC IN'));
  assert(circuit('filtered').includes('Your R'));
});
test('v4 packages only the source sketch and guide; legacy v3 remains recoverable', async () => {
  const html = await readFile('public/worksheets/noise-filtering-main-lab.html', 'utf8');
  assert(!/<script[^>]+src=/.test(html)); assert(!/@import|url\(https?:/.test(html));
  assert(!html.includes('INSTRUCTOR_PILOT.md') && !html.includes('ExampleMA') && !html.includes('processSample('));
  const directory = 'public/courses/2145427/week12/main-lab/v4.0.0/';
  assert.deepEqual((await readdir(directory)).sort(), ['LAB_GUIDE.txt', 'aircraft_pulse_source.zip']);
  const zip = unzipSync(new Uint8Array(await readFile(directory + 'aircraft_pulse_source.zip'))), sources = await sketchSources();
  assert.deepEqual(Object.keys(zip), ['aircraft_pulse_source/aircraft_pulse_source.ino']);
  assert.equal(Buffer.from(Object.values(zip)[0]).toString(), sources.source);
  assert(!/Serial\.|analogRead\(|processSample\(|startSignalGenrator/.test(sources.source));
  assert(sources.source.includes('analogWriteResolution(12)') && sources.source.includes('DAC_RATE = 4000'));
  const legacy = await readFile('public/worksheets/noise-filtering-main-lab-v3.html', 'utf8');
  assert(legacy.includes('electronics-noise-filtering-main-lab-v3') && !legacy.includes('electronics-noise-filtering-main-lab-v4'));
});
test('actual shared waveform, timing, queue and working filter examples pass C++ numerical checks', async () => {
  await mkdir('output/noise-aircraft-tests', { recursive: true });
  await writeFile('output/noise-aircraft-tests/filter_examples.h', FILTER_EXAMPLE);
  const compile = spawnSync(process.env.CXX || 'c++', ['-std=c++17', '-Wall', '-Wextra', '-Werror', '-Ioutput/noise-aircraft-tests', 'tests/noise-main-lab-numerics.cpp', '-o', 'output/noise-aircraft-tests/numerics'], { encoding: 'utf8' });
  assert.equal(compile.status, 0, compile.stderr);
  const run = spawnSync('output/noise-aircraft-tests/numerics', [], { encoding: 'utf8' }); assert.equal(run.status, 0, run.stderr);
});
test('real completed firmware keeps sampling through serial stalls and preserves partial lines', async () => {
  await mkdir('output/noise-aircraft-runtime', { recursive: true });
  await writeFile('output/noise-aircraft-runtime/digital.ino', (await sketchSources()).digital);
  const compile = spawnSync(process.env.CXX || 'c++', ['-std=c++17', '-Wall', '-Wextra', '-Werror', '-Itests/fixtures/aircraft', '-Ioutput/noise-aircraft-runtime', 'tests/noise-main-lab-runtime.cpp', '-o', 'output/noise-aircraft-runtime/runtime'], { encoding: 'utf8' });
  assert.equal(compile.status, 0, compile.stderr);
  const run = spawnSync('output/noise-aircraft-runtime/runtime', [], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
});
test('actual source-only sketch generates the waveform without ADC or serial output', async () => {
  await mkdir('output/noise-aircraft-source', { recursive: true });
  await writeFile('output/noise-aircraft-source/source.ino', (await sketchSources()).source);
  const compile = spawnSync(process.env.CXX || 'c++', ['-std=c++17', '-Wall', '-Wextra', '-Werror', '-Itests/fixtures/aircraft', '-Ioutput/noise-aircraft-source', 'tests/noise-main-lab-source.cpp', '-o', 'output/noise-aircraft-source/source'], { encoding: 'utf8' });
  assert.equal(compile.status, 0, compile.stderr);
  const run = spawnSync('output/noise-aircraft-source/source', [], { encoding: 'utf8' }); assert.equal(run.status, 0, run.stderr);
});

test('CSV task requires two labelled trial figures without a trial table or extra metadata inputs', async () => {
  const r = createRecord(), html = screen(r, 5), doc = new JSDOM(html).window.document;
  for (const text of ['Time (s)', 'Voltage (V)', 'legend', 'descriptive title', 'MA window', 'EMA coefficient', 'same recording', 'five-second', 'do not submit or attach it', '5 samples, 51 samples', '0.4, 0.02']) assert(html.includes(text));
  assert(!doc.querySelector('table'));
  assert.equal(doc.querySelectorAll('input[type="file"]').length, 2);
  assert(!doc.querySelector('[data-field^="digital."]'));
  assert(!doc.querySelector('[data-field^="capture.maTrials."]'));
  assert(!doc.querySelector('[data-field^="capture.emaTrials."]'));
  assert(!Array.from(doc.querySelectorAll('math')).some(el => /1000|4095/.test(el.textContent)));
  assert(doc.querySelector('[data-field="processing.program"]') && doc.querySelector('[data-field="code.processing"]'));
  assert(!doc.querySelector('[data-field="code.digital"]'));
  assert(!/A1|Serial Plotter|500,000 baud/.test(doc.body.textContent));
  const trialIssues = files => completeness(r, files).filter(s => /(?:MA|EMA) figure:/.test(s));
  assert.equal(trialIssues({}).length, 2);
  const files = { 'maTrials.image': await validateFile('maTrials.image', png, 'MA-5-51-chosen.png', decode) };
  assert.equal(trialIssues(files).length, 1); assert(trialIssues(files)[0].includes('EMA figure'));
  files['emaTrials.image'] = await validateFile('emaTrials.image', png, 'EMA-04-002-chosen.png', decode);
  assert.equal(trialIssues(files).length, 0);
  assert(!completeness(r, files).some(s => /Compare digital-filter settings|MA · 5|EMA · coefficient|capture.maTrials|capture.emaTrials/.test(s)));
  const formulas = '=AVERAGE(B2:B6)\r\nC3=$F$1*B3+(1-$F$1)*C2\r\n# <script>literal</script>';
  updateField(r, 'code.processing', formulas);
  const zip = await createZip(r, files), entries = unzipSync(zip), restored = await parseFile(zip, decode);
  assert.equal(Buffer.from(entries['code/MA_EMA_formulas_or_code.txt']).toString(), formulas);
  for (const slot of Object.keys(files)) assert.deepEqual(new Uint8Array(await restored.files[slot].blob.arrayBuffer()), new Uint8Array(await png.arrayBuffer()));
  assert.equal(restored.record.fields['code.processing'], formulas);
  assert(report(r, files, {}).includes('Time (s)'));
  assert(!report(r, files, {}).includes('Compare digital-filter settings after the same RC'));
  assert(!Object.keys(entries).some(path => /\.csv$|digital_.*\.ino$/.test(path)));
});
test('older v4 JSON and ZIP retain original answers, sketches and images while new fields start blank', async () => {
  const r = preservedRecord(), files = await fixture(), backup = await createBackup(r, files);
  for (const key of Object.keys(backup.record.fields)) if (key.startsWith('processing.') || key === 'code.processing' || key.startsWith('capture.fftComparison.') || key.startsWith('capture.maTrials.') || key.startsWith('capture.emaTrials.')) delete backup.record.fields[key];
  const old = JSON.stringify(backup), before = structuredClone(backup.record);
  const parts = unzipSync(await createZip(r, files)); parts['main_lab_backup.json'] = strToU8(old);
  for (const restored of [await parseBackup(old, decode), await parseFile(zipSync(parts, { level: 0 }), decode)]) {
    for (const [key, value] of Object.entries(before.fields)) assert.equal(restored.record.fields[key], value);
    assert.deepEqual(restored.record.originals, before.originals);
    assert.equal(restored.record.fields['processing.program'], '');
    assert.equal(restored.record.fields['code.processing'], '');
    assert(screen(restored.record, 5).includes('Earlier Arduino filtering work'));
    assert.equal(restored.files['source.image'].originalName, 'original-waveform.png');
  }
  assert.deepEqual(backup.record, before);
  const corrupt = structuredClone(backup.record); delete corrupt.fields['source.verification'];
  assert.throws(() => validateRecord(corrupt), /fields/);
});

test('Section 5 requires one combined CH1/CH2 FFT image and retains older separate images', async () => {
  const r = createRecord(), dom = new JSDOM(screen(r, 4)), doc = dom.window.document;
  assert.equal(doc.querySelectorAll('input[type="file"]').length, 1);
  assert(doc.querySelector('[data-file="fftComparison.image"]'));
  assert(!doc.querySelector('[data-file="inputFFT.image"]') && !doc.querySelector('[data-file="outputFFT.image"]'));
  for (const key of ['runId', 'source', 'settings', 'notes']) updateField(r, `capture.fftComparison.${key}`, 'CH1 and CH2 FFT');
  assert(completeness(r).some(s => s.includes('CH1 input and CH2 RC output FFT in one image: attach')));
  const files = { 'fftComparison.image': await validateFile('fftComparison.image', png, 'CH1-CH2-comparison.png', decode) };
  assert(!completeness(r, files).some(s => /FFT in one image|Earlier CH[12]/.test(s)));
  const restored = await parseFile(await createZip(r, files), decode);
  assert.deepEqual(new Uint8Array(await restored.files['fftComparison.image'].blob.arrayBuffer()), new Uint8Array(await png.arrayBuffer()));
  const earlierFiles = {};
  for (const id of ['inputFFT', 'outputFFT']) earlierFiles[`${id}.image`] = await validateFile(`${id}.image`, png, `${id}.png`, decode);
  const earlier = await createBackup(r, earlierFiles);
  for (const key of Object.keys(earlier.record.fields)) if (key.startsWith('capture.fftComparison.')) delete earlier.record.fields[key];
  const loaded = await parseBackup(JSON.stringify(earlier), decode);
  assert.equal(loaded.record.fields['capture.fftComparison.runId'], '');
  for (const id of ['inputFFT', 'outputFFT']) assert.equal(loaded.files[`${id}.image`].originalName, `${id}.png`);
  assert(report(loaded.record, loaded.files, {}).includes('Earlier CH2 output FFT'));
  dom.window.close();
});

test('older trial values and the earlier combined figure survive restore without becoming current requirements', async () => {
  const r = createRecord(); updateField(r, 'digital.maShort.amplitude', 'Earlier pulse reading');
  const files = { 'digital.image': await validateFile('digital.image', png, 'earlier-combined.png', decode) };
  const backup = await createBackup(r, files);
  for (const key of Object.keys(backup.record.fields)) if (/^capture\.(maTrials|emaTrials)\./.test(key)) delete backup.record.fields[key];
  const restored = await parseBackup(JSON.stringify(backup), decode);
  assert.equal(restored.record.fields['digital.maShort.amplitude'], 'Earlier pulse reading');
  assert.equal(restored.files['digital.image'].originalName, 'earlier-combined.png');
  assert.equal(restored.record.fields['capture.maTrials.runId'], '');
  assert.equal(restored.record.fields['capture.emaTrials.runId'], '');
  assert.equal(completeness(restored.record, restored.files).filter(s => /(?:MA|EMA) figure:/.test(s)).length, 2);
  assert(screen(restored.record, 5, restored.files, {}).includes('Earlier combined digital-filter figure'));
});

test('Section 2 replaces FFT questionnaire and image-detail inputs with the scope screenshot', async () => {
  const r = createRecord(), doc = new JSDOM(screen(r, 1)).window.document;
  assert(!doc.querySelector('[data-field^="scope."]'));
  assert(!doc.querySelector('[data-field^="capture.spectrum."]'));
  assert.equal(doc.querySelectorAll('input[type="file"]').length, 1);
  assert(doc.querySelector('[data-file="spectrum.image"]'));
  assert(doc.querySelector('[data-field="discovery.1.frequency"]'));
  assert(!completeness(r).some(s => /FFT and peak-reading procedure|FFT source, window|separation of nearby frequency peaks/.test(s)));
  assert(completeness(r).some(s => /Initial input FFT: attach/.test(s)));
  const files = { 'spectrum.image': await validateFile('spectrum.image', png, 'oscilloscope-FFT.png', decode) };
  assert(!completeness(r, files).some(s => s.startsWith('Initial input FFT:')));
  updateField(r, 'scope.procedure', 'Earlier procedure'); updateField(r, 'scope.settings', 'Earlier FFT settings');
  updateField(r, 'capture.spectrum.settings', 'Earlier image settings');
  const restored = await parseFile(await createZip(r, files), decode);
  assert.equal(restored.record.fields['scope.procedure'], 'Earlier procedure');
  assert.equal(restored.record.fields['capture.spectrum.settings'], 'Earlier image settings');
  assert(!report(r, files, {}).includes('FFT and peak-reading procedure you discovered'));
});
