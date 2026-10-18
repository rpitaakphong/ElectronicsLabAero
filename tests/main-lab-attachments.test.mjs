import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
import { createRecord, progress } from '../activities/555-main-lab/model.js';
import { imageFormat, imageName, validateImage, createBackup, parseBackup, createLabZip, MAX_IMAGE_BYTES, imageStore } from '../activities/555-main-lab/attachments.js';

const bytes = Uint8Array.from([137,80,78,71,13,10,26,10,1,2,3,4]);
const decode = async () => true; // Real browser decoding is exercised by the integration test.
const sample = (slot = 'A0', name = 'original.PNG') => validateImage(slot, new Blob([bytes]), name, decode);

test('names reflect actual formats while keeping supported original extensions', () => {
  assert.equal(imageName('A0', 'png', 'scope.PNG'), 'Screenshot_1_Lab_1.png');
  assert.equal(imageName('A1', 'jpeg', 'scope.jpeg'), 'Screenshot_2_Lab_2.jpeg');
  assert.equal(imageName('M0trigger', 'jpeg', 'misleading.png'), 'Screenshot_3_Lab_3.jpg');
  assert.equal(imageFormat(Uint8Array.of(255,216,255)), 'jpeg');
  assert.equal(imageFormat(Uint8Array.of(66,77,...Array(12).fill(0))), 'bmp');
  assert.equal(imageFormat(new TextEncoder().encode('RIFF1234WEBP')), 'webp');
  assert.throws(() => imageName('../escape', 'png', 'x.png'));
});
test('validation rejects unsupported, empty, oversized and undecodable images without mutating existing data', async () => {
  const previous = await sample();
  await assert.rejects(validateImage('A0', new Blob(['<svg></svg>']), 'a.png', decode), /PNG, JPEG, BMP or WebP/);
  await assert.rejects(validateImage('A0', new Blob([]), 'a.png', decode), /10 MiB/);
  await assert.rejects(validateImage('A0', new Blob([new Uint8Array(MAX_IMAGE_BYTES + 1)]), 'a.png', decode), /10 MiB/);
  await assert.rejects(validateImage('A0', new Blob([bytes]), 'a.png', async () => { throw new Error('corrupt'); }), /corrupt/);
  assert.deepEqual(new Uint8Array(await previous.blob.arrayBuffer()), bytes);
});
test('new envelope round-trips answers, original bytes, and exactly three allowed slots', async () => {
  const record = createRecord();
  record.group.id = 'QA'; record.configs.A0.prediction.high = '.12300';
  const images = { A0: await sample(), A1: await sample('A1'), M0trigger: await sample('M0trigger') };
  const backup = await createBackup(record, images);
  assert.equal(record.evidence.A0.filename, '', 'Export must not mutate the live record');
  assert.equal(backup.record.schemaVersion, 2);
  assert.equal(backup.backupVersion, 1);
  const parsed = await parseBackup(JSON.stringify(backup), decode);
  assert.deepEqual(parsed.record, backup.record);
  assert.equal(progress(parsed.record, Object.keys(parsed.images)).captures, 3);
  for (const image of Object.values(parsed.images)) assert.deepEqual(new Uint8Array(await image.blob.arrayBuffer()), bytes);
  assert.equal(parsed.record.configs.A0.prediction.high, '.12300');
});
test('legacy v2 filenames stay intact but cannot become attachments; v1 recovery still applies', async () => {
  const record = createRecord(); record.evidence.A0.filename = 'legacy.png';
  const parsed = await parseBackup(JSON.stringify(record), decode);
  assert.deepEqual(parsed.record, record); assert.deepEqual(parsed.images, {});
  assert.equal(progress(parsed.record).captures, 0);
  await assert.rejects(parseBackup(JSON.stringify({ ...record, schemaVersion: 1 }), decode), /START_HERE-v1/);
});
test('invalid embedded files and duplicate slots reject the complete import', async () => {
  const backup = await createBackup(createRecord(), { A0: await sample() });
  const malformed = structuredClone(backup); malformed.images[0].data = '%%%';
  await assert.rejects(parseBackup(JSON.stringify(malformed), decode), /Invalid embedded/);
  const duplicate = structuredClone(backup); duplicate.images.push(duplicate.images[0]);
  await assert.rejects(parseBackup(JSON.stringify(duplicate), decode), /duplicate/);
  const path = structuredClone(backup); path.images[0].filename = '../scope.png';
  await assert.rejects(parseBackup(JSON.stringify(path), decode), /does not match/);
  const version = structuredClone(backup); version.backupVersion = 2;
  await assert.rejects(parseBackup(JSON.stringify(version), decode), /Unsupported/);
});
test('ZIP contains the complete backup and byte-identical images under screenshots/', async () => {
  const record = createRecord(), images = { A0: await sample(), M0trigger: await sample('M0trigger') };
  const zip = unzipSync(await createLabZip(record, images, '555_MAIN_LAB_QA.json'));
  assert.deepEqual(Object.keys(zip).sort(), ['555_MAIN_LAB_QA.json', 'screenshots/', 'screenshots/Screenshot_1_Lab_1.png', 'screenshots/Screenshot_3_Lab_3.png'].sort());
  assert.deepEqual(zip['screenshots/Screenshot_1_Lab_1.png'], bytes);
  const parsed = await parseBackup(strFromU8(zip['555_MAIN_LAB_QA.json']), decode);
  assert.equal(Object.keys(parsed.images).length, 2);
});
test('unavailable IndexedDB fails explicitly, allowing callers to keep session images', async () => {
  await assert.rejects(imageStore(null).read('QA'), /unavailable/);
});
test('a blocked IndexedDB property cannot prevent the worksheet runtime from starting', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  try {
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, get() { throw new Error('QA storage blocked'); } });
    const store = imageStore();
    await assert.rejects(store.read('QA'), /QA storage blocked/);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'indexedDB', previous);
    else delete globalThis.indexedDB;
  }
});
test('maximum-size images remain portable through base64 backups', async () => {
  const large = new Uint8Array(MAX_IMAGE_BYTES); large.set(bytes);
  const image = await validateImage('A0', new Blob([large]), 'scope.png', decode);
  const backup = await createBackup(createRecord(), { A0: image });
  const parsed = await parseBackup(JSON.stringify(backup), decode);
  assert.deepEqual(new Uint8Array(await parsed.images.A0.blob.arrayBuffer()), large);
});
test('online and offline HTML are identical and ZIP runtime is bundled, not fetched', async () => {
  const offline = await readFile(new URL('../output/555-main-lab/START_HERE.html', import.meta.url));
  const online = await readFile(new URL('../public/worksheets/555-main-lab.html', import.meta.url));
  assert.deepEqual(offline, online);
  assert.doesNotMatch(online.toString(), /<script[^>]+src=|fetch\(|XMLHttpRequest|sendBeacon\(/);
});
