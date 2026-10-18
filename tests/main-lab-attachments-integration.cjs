/* Synthetic QA only: no student records, external uploads, or production writes. */
const playwright = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { unzipSync } = require('fflate');
const output = path.resolve('output/playwright/main-lab/attachments');
const pdfOutput = path.resolve('output/pdf');
const hosted = process.env.APP_URL || 'http://127.0.0.1:4174';
const key = 'electronics-555-main-lab-v3';
const max = 10 * 1024 * 1024;
const slots = ['A0', 'A1', 'M0trigger'];
const expected = (slot, extension = 'png') => `Screenshot_${slots.indexOf(slot) + 1}_Lab_${slots.indexOf(slot) + 1}.${extension}`;
const bmp = Buffer.alloc(58);
bmp.write('BM'); bmp.writeUInt32LE(58, 2); bmp.writeUInt32LE(54, 10); bmp.writeUInt32LE(40, 14);
bmp.writeInt32LE(1, 18); bmp.writeInt32LE(1, 22); bmp.writeUInt16LE(1, 26); bmp.writeUInt16LE(24, 28);
bmp.writeUInt32LE(4, 34); bmp[54] = 255;

async function go(page, index) {
  const menu = page.getByRole('button', { name: 'Open activity navigation', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.locator(`#steps [data-step="${index}"]`).click();
}
async function upload(page, slot, buffer, name = 'original.png', mimeType = 'image/png') {
  await page.locator(`[data-image-file="${slot}"]`).setInputFiles({ name, mimeType, buffer });
  await page.locator(`[data-upload="${slot}"]`).click();
  await page.locator(`[data-attachment="${slot}"] .image-status`).filter({ hasText: 'Attached locally' }).waitFor();
  await page.waitForFunction((slot) => !document.querySelector(`[data-upload="${slot}"]`).textContent.includes('Checking'), slot);
}
async function download(page, action) {
  await go(page, 4);
  const pending = page.waitForEvent('download');
  await page.locator(`#main [data-action="${action}"]`).click();
  const file = await pending;
  return { bytes: await fs.readFile(await file.path()), name: file.suggestedFilename() };
}
async function importBackup(page, data, confirm = true) {
  await page.locator('#import-file').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await page.locator('#confirm-import').waitFor();
  if (confirm) await page.locator('#confirm-import').click();
}
async function newWorkbook(page) {
  await page.locator('#save-menu-button').click();
  await page.locator('#save-menu [data-action="new"]').click();
  await page.locator('#confirm-new').click();
}
async function checkReport(page, attachedSlots, native = false) {
  const identity = await page.evaluate(() => {const record=JSON.parse(localStorage.getItem('electronics-555-main-lab-v3') || 'null'); return record?.group?.student1?.id && record?.group?.student2?.id;});
  if (!identity && !native) {
    await go(page,0);
    for (const [field,value] of Object.entries({'group.id':'QA','group.student1.name':'Synthetic One','group.student1.id':'000001','group.student2.name':'Synthetic Two','group.student2.id':'000002'})) await page.locator(`[data-field="${field}"]`).fill(value);
  }
  await page.evaluate(() => {
    window.printRequested = false;
    window.print = () => {
      window.dispatchEvent(new Event('beforeprint'));
      window.printReadyImages = [...document.querySelectorAll('#report img')].every((img) => img.complete && img.naturalWidth > 0);
      window.printWaitedForImages = !window.qaFileReadPending && !window.qaPendingDecodes;
      window.printRequested = true;
    };
  });
  if (native) await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  else {
    if (!(await page.locator('#save-menu').isVisible())) await page.locator('#save-menu-button').click();
    await page.locator('#save-menu [data-action="print"]').click();
    await page.waitForFunction(() => window.printRequested === true);
    assert.equal(await page.evaluate(() => window.printReadyImages), true, 'Print dialog must wait for decoded report images');
    assert.equal(await page.evaluate(() => window.printWaitedForImages), true, 'Print dialog must wait for uploads and image decoding');
  }
  await page.emulateMedia({ media: 'print' });
  const images = await page.locator('#report [data-report-image]').evaluateAll((elements) => elements.map((img) => ({
    slot: img.dataset.reportImage, complete: img.complete && img.naturalWidth > 0,
    src: img.src, width: img.getBoundingClientRect().width, height: img.getBoundingClientRect().height,
    ratio: img.naturalWidth / img.naturalHeight,
    lab: img.closest('.report-config').querySelector('h2').textContent,
    caption: img.parentElement.querySelector('figcaption').textContent,
    breakInside: getComputedStyle(img.closest('figure')).breakInside,
  })));
  assert.deepEqual(images.map((img) => img.slot), slots.filter((slot) => attachedSlots.includes(slot)));
  for (const img of images) {
    assert(img.complete, `Undecoded report image: ${img.slot}`);
    assert(img.src.startsWith('blob:'));
    assert(img.width > 0 && img.height > 0 && img.height <= 200 * 96 / 25.4 + 1);
    assert(Math.abs(img.width / img.height - img.ratio) < .01, 'Image must not be stretched');
    assert.match(img.lab, new RegExp(`Lab ${slots.indexOf(img.slot) + 1}`));
    assert(img.caption.startsWith(`Screenshot_${slots.indexOf(img.slot) + 1}_Lab_`));
    assert.equal(img.breakInside, 'avoid');
  }
  assert.equal(await page.locator('#report .report-screenshot .missing').filter({ hasText: 'Image not attached' }).count(), 3 - attachedSlots.length);
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  return images;
}
async function saveReportPdf(page, filename) {
  await page.emulateMedia({ media: 'print' });
  assert(await page.locator('#report').isVisible());
  assert.equal(await page.locator('#workbook').isVisible(), false);
  await page.waitForFunction(() => [...document.querySelectorAll('#report img')].every((img) => img.complete && img.naturalWidth > 0));
  await page.pdf({ path: path.join(pdfOutput, filename), format: 'A4', preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
}
async function fixtureImages(page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 360;
    const c = canvas.getContext('2d');
    c.fillStyle = '#102a36'; c.fillRect(0, 0, 800, 360);
    c.fillStyle = '#eee'; c.font = '20px sans-serif'; c.fillText('Synthetic oscilloscope QA image — not measured lab data', 24, 35);
    c.strokeStyle = '#365360'; c.lineWidth = 1;
    for (let x = 40; x < 800; x += 40) { c.beginPath(); c.moveTo(x, 55); c.lineTo(x, 330); c.stroke(); }
    for (let y = 60; y < 330; y += 30) { c.beginPath(); c.moveTo(20, y); c.lineTo(780, y); c.stroke(); }
    c.strokeStyle = '#ffd457'; c.lineWidth = 3; c.beginPath(); c.moveTo(25, 170);
    for (let x = 25; x < 775; x += 150) { c.lineTo(x, 80); c.lineTo(x + 90, 80); c.lineTo(x + 90, 170); c.lineTo(x + 150, 170); } c.stroke();
    c.strokeStyle = '#53d7dc'; c.beginPath(); c.moveTo(25, 300);
    for (let x = 25; x < 775; x += 150) { c.lineTo(x + 90, 230); c.lineTo(x + 150, 300); } c.stroke();
    c.fillStyle = '#eee'; c.font = '16px sans-serif'; c.fillText('500 ms/div    2 V/div    f = 1 Hz', 25, 348);
    return Object.fromEntries(['png', 'jpeg', 'webp'].map((type) => [type, canvas.toDataURL(`image/${type}`).split(',')[1]]));
  });
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  await fs.mkdir(pdfOutput, { recursive: true });
  const fixtureBrowser = await playwright.chromium.launch();
  const sharedImages = await fixtureImages(await fixtureBrowser.newPage());
  await fixtureBrowser.close();
  for (const engine of (process.env.BROWSERS || 'chromium,firefox,webkit').split(',')) {
    const browser = await playwright[engine].launch({ headless: true });
    const profiles = [], persistentContexts = [];
    const newContext = async (options) => {
      if (engine !== 'webkit') return browser.newContext(options);
      // WebKit's ephemeral test contexts cannot persist Blob/File data. Use
      // a normal profile for persistence, and separately test denied storage.
      const profile = await fs.mkdtemp(path.join(os.tmpdir(), '555-worksheet-webkit-'));
      profiles.push(profile);
      const context = await playwright.webkit.launchPersistentContext(profile, { headless: true, ...options });
      persistentContexts.push(context);
      return context;
    };
    try {
      for (const mode of ['hosted']) {
        const context = await newContext({ viewport: { width: 1448, height: 900 }, acceptDownloads: true, offline: mode === 'offline' && engine !== 'webkit' });
        if (mode === 'offline' && engine === 'webkit') await context.route(/^https?:/, (route) => route.abort());
        const page = await context.newPage(), errors = [], requests = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('request', (request) => { if (/^https?:/.test(request.url())) requests.push({ url: request.url(), method: request.method() }); });
        page.on('dialog', (dialog) => dialog.accept());
        const url = `${hosted}/worksheets/555-main-lab.html`;
        await page.goto(url);
        await checkReport(page, []);
        // WebKit can decode WebP but its canvas encoder may fall back to PNG.
        const raw = sharedImages, png = Buffer.from(raw.png, 'base64');
        await page.locator('[data-field="group.id"]').fill(`${engine}-${mode}`);
        await go(page, 1);
        const panel = page.locator('[data-attachment="A0"]');
        await page.locator('[data-image-file="A0"]').setInputFiles({ name: 'scope.PNG', mimeType: 'image/png', buffer: png });
        assert.match(await panel.locator('.image-status').innerText(), /Image not attached/);
        assert.equal(await panel.locator('.image-preview img').count(), 0);
        await panel.locator('[data-upload]').click();
        await panel.locator('.image-status').filter({ hasText: expected('A0') }).waitFor();
        assert(await panel.locator('img').evaluate((img) => img.complete && img.naturalWidth === 800));
        await checkReport(page, ['A0']);
        if (engine === 'chromium' && mode === 'hosted') {
          await page.evaluate(() => {
            window.qaFileArrayBuffer = File.prototype.arrayBuffer;
            File.prototype.arrayBuffer = async function () {
              window.qaFileReadPending = true;
              await new Promise((resolve) => setTimeout(resolve, 400));
              const result = await window.qaFileArrayBuffer.call(this);
              window.qaFileReadPending = false;
              return result;
            };
            window.qaImageDecode = HTMLImageElement.prototype.decode;
            HTMLImageElement.prototype.decode = async function () {
              if (!this.hasAttribute('data-report-image')) return window.qaImageDecode.call(this);
              window.qaPendingDecodes = (window.qaPendingDecodes || 0) + 1;
              await Promise.all([window.qaImageDecode.call(this), new Promise((resolve) => setTimeout(resolve, 100))]);
              window.qaPendingDecodes--;
            };
          });
          // Press print while the selected file is still being validated.
          await page.locator('[data-image-file="A0"]').setInputFiles({ name: 'immediate.png', mimeType: 'image/png', buffer: png });
          await panel.locator('[data-upload]').click();
          await checkReport(page, ['A0']);
          await page.evaluate(() => {
            File.prototype.arrayBuffer = window.qaFileArrayBuffer;
            HTMLImageElement.prototype.decode = window.qaImageDecode;
            window.printRequested = false;
            HTMLImageElement.prototype.decode = function () { return this.hasAttribute('data-report-image') ? Promise.reject(new Error('Synthetic decode failure')) : window.qaImageDecode.call(this); };
          });
          await page.locator('#save-menu-button').click();
          await page.locator('#save-menu [data-action="print"]').click();
          await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('Could not prepare the report'));
          assert.equal(await page.evaluate(() => window.printRequested), false, 'A failed image must not open a blank printout');
          await page.evaluate(() => { HTMLImageElement.prototype.decode = window.qaImageDecode; });
          await checkReport(page, ['A0']);
        }
        // Real decoding of all four accepted formats; replacement preserves actual bytes.
        for (const [name, mimeType, buffer, extension] of [
          ['scope.jpeg', 'image/jpeg', Buffer.from(raw.jpeg, 'base64'), 'jpeg'],
          ['scope.bmp', 'image/bmp', bmp, 'bmp'],
          ['scope.webp', 'image/webp', Buffer.from(raw.webp, 'base64'), 'webp'],
          ['scope.png', 'image/png', png, 'png'],
        ]) {
          await upload(page, 'A0', buffer, name, mimeType);
          await checkReport(page, ['A0']);
          assert.match(await panel.locator('.image-status').innerText(), new RegExp(expected('A0', extension)));
          const backup = JSON.parse((await download(page, 'export')).bytes);
          assert.deepEqual(Buffer.from(backup.images[0].data, 'base64'), buffer);
          await go(page, 1);
        }
        // Every invalid replacement must leave the previous attachment untouched.
        for (const [name, buffer, message] of [
          ['bad.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), /PNG, JPEG, BMP or WebP/],
          ['bad.png', Buffer.from([137,80,78,71,13,10,26,10,1,2,3,4]), /corrupt|cannot be opened/],
          ['empty.png', Buffer.alloc(0), /10 MiB/],
          ['big.png', Buffer.alloc(max + 1), /10 MiB/],
        ]) {
          await page.locator('[data-image-file="A0"]').setInputFiles({ name, mimeType: 'image/png', buffer });
          await panel.locator('[data-upload]').click();
          await page.waitForFunction(() => !document.querySelector('[data-upload="A0"]').textContent.includes('Checking'));
          assert.match(await page.locator('#toast').innerText(), message);
          assert.match(await panel.locator('.image-status').innerText(), /Attached locally.*Screenshot_1_Lab_1.png/);
        }
        for (const [slot, index] of [['A1', 2], ['M0trigger', 3]]) { await go(page, index); await upload(page, slot, png); }
        const currentReport = await checkReport(page, slots);
        await go(page, 1);
        await page.locator('[data-field="configs.A0.design.rationale"]').fill('Synthetic QA: latest typed answer must appear in native printing.');
        assert.deepEqual((await checkReport(page, slots, true)).map((img) => img.src), currentReport.map((img) => img.src), 'Navigation must not revoke report image URLs');
        assert.match(await page.locator('#report').innerText(), /latest typed answer must appear in native printing/);
        await go(page, 3);
        if (engine === 'chromium' && mode === 'hosted') {
          await saveReportPdf(page, '555-report-images-qa.pdf');
          const tall = Buffer.from(await page.evaluate(() => {
            const c = document.createElement('canvas'); c.width = 600; c.height = 1600;
            const ctx = c.getContext('2d'); ctx.fillStyle = '#102a36'; ctx.fillRect(0, 0, 600, 1600);
            ctx.font = '24px sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('SYNTHETIC TALL QA IMAGE', 30, 50);
            for (let y = 100; y < 1600; y += 100) { ctx.fillStyle = y % 200 ? '#ffd457' : '#53d7dc'; ctx.fillRect(30, y, 540, 3); ctx.fillText(`QA height ${y}`, 30, y + 35); }
            return c.toDataURL('image/png').split(',')[1];
          }), 'base64');
          await upload(page, 'M0trigger', tall);
          await checkReport(page, slots);
          await saveReportPdf(page, '555-report-tall-qa.pdf');
          await upload(page, 'M0trigger', png);
        }
        const backupFile = await download(page, 'export'), backup = JSON.parse(backupFile.bytes);
        assert.equal(backup.images.length, 3); assert.equal(backup.record.schemaVersion, 3);
        assert.match(await page.locator('.stats').innerText(), /3\/3\s+Images attached/);
        const zipFile = await download(page, 'zip'), zip = unzipSync(zipFile.bytes);
        assert.deepEqual(Object.keys(zip).sort(), [backupFile.name, 'screenshots/', ...slots.map((slot) => `screenshots/${expected(slot)}`)].sort());
        for (const slot of slots) assert.deepEqual(Buffer.from(zip[`screenshots/${expected(slot)}`]), png);
        const zipBackup = JSON.parse(Buffer.from(zip[backupFile.name]).toString());
        assert.deepEqual(zipBackup.images, backup.images);
        // Wait for the atomic image write and test real browser persistence.
        await page.waitForFunction(() => !document.querySelector('#save-status').textContent.includes('Saving images'));
        const savedStatus = await page.locator('#save-status').innerText();
        assert.doesNotMatch(savedStatus, /not saved|could not|paused/, `${engine} ${mode} storage before reload`);
        await page.reload(); await go(page, 1);
        try { await panel.locator('.image-status').filter({ hasText: 'Attached locally' }).waitFor(); }
        catch (error) { console.error(engine, mode, await panel.innerText(), await page.locator('#save-status').innerText()); throw error; }
        await checkReport(page, slots);
        await panel.locator('[data-remove-image]').click();
        assert.equal(await panel.locator('img').count(), 0);
        await checkReport(page, ['A1', 'M0trigger']);
        const removed = JSON.parse((await download(page, 'export')).bytes);
        assert.equal(removed.images.length, 2); assert.equal(removed.record.evidence.A0.filename, '');
        // Import the same record ID with a different image set: no stale IDB images may return.
        await importBackup(page, { ...backup, images: [] });
        await checkReport(page, [], true);
        await go(page, 1); assert.match(await panel.locator('.image-status').innerText(), /Image not attached/);
        await page.reload(); await go(page, 4);
        await page.waitForFunction(() => !document.querySelector('#save-status').textContent.includes('Saving images'));
        assert.match(await page.locator('.stats').innerText(), /0\/3\s+Images attached/);
        // Old v2 imports retain names but do not inherit the current group's blobs.
        const old = structuredClone(backup.record); old.recordId += '-other'; old.group.id = 'OTHER-GROUP';
        await importBackup(page, old);
        await checkReport(page, []);
        await go(page, 1); assert.match(await panel.locator('.image-status').innerText(), /Image not attached.*Previously recorded/);
        assert.equal(JSON.parse((await download(page, 'export')).bytes).images.length, 0);
        await importBackup(page, backup);
        await checkReport(page, slots);
        const restored = JSON.parse((await download(page, 'export')).bytes);
        assert.deepEqual(restored.images, backup.images);
        assert.deepEqual(restored.record.configs, backup.record.configs);
        // Responsive preview layouts after attachment restoration.
        for (const width of [1448, 768, 390]) {
          await page.setViewportSize({ width, height: 900 }); await go(page, 3);
          const preview = page.locator('[data-attachment="M0trigger"]');
          await preview.scrollIntoViewIfNeeded();
          const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
          assert(size.scroll <= size.width + 1, `${engine} ${mode} overflow at ${width}`);
          await preview.screenshot({ path: path.join(output, `${engine}-${mode}-${width}.png`), animations: 'disabled', style: '.topbar,footer,#toast{visibility:hidden!important}' });
        }
        await newWorkbook(page);
        await checkReport(page, []);
        const empty = JSON.parse((await download(page, 'export')).bytes);
        assert.equal(empty.images.length, 0); assert.notEqual(empty.record.recordId, backup.record.recordId);
        assert.equal(empty.record.configs.A0.original, null);
        // Malformed embedded backup must not replace any current answers.
        const bad = structuredClone(backup); bad.images[0].data = 'AAAA';
        await page.locator('#import-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) });
        await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('Could not load this backup'));
        assert.equal(await page.locator('#confirm-import').count(), 0);
        assert.equal(JSON.parse((await download(page, 'export')).bytes).record.recordId, empty.record.recordId);
        assert.deepEqual(errors, [], `${engine} ${mode} page errors`);
        assert(requests.every((request) => request.method === 'GET' && [url, `${hosted}/favicon.ico`].includes(request.url)), JSON.stringify(requests));
        if (mode === 'offline') assert.equal(requests.length, 0);
        await context.close();
        console.log(`PASS ${engine} ${mode}: report images/button/native printing, all formats, invalid replacements, persistence, JSON/ZIP bytes, group isolation, responsive layouts, no upload requests`);
      }
      // Deliberate IndexedDB failure: keep the image in session and export it.
      const denied = await newContext({ acceptDownloads: true });
      await denied.addInitScript(() => Object.defineProperty(window, 'indexedDB', { get() { return { open() { throw new Error('QA denied storage'); } }; } }));
      const page = await denied.newPage(); page.on('dialog', (dialog) => dialog.accept());
      await page.goto(`${hosted}/worksheets/555-main-lab.html`);
      await go(page, 1); const raw = await fixtureImages(page), png = Buffer.from(raw.png, 'base64');
      await upload(page, 'A0', png);
      await page.waitForFunction(() => document.querySelector('#save-status').textContent.includes('Images not saved'));
      await checkReport(page, ['A0']);
      const safe = JSON.parse((await download(page, 'export')).bytes);
      assert.deepEqual(Buffer.from(safe.images[0].data, 'base64'), png);
      await denied.close();
      console.log(`PASS ${engine}: storage failure retains exportable session image and warns`);
    } finally {
      await Promise.allSettled(persistentContexts.map((context) => context.close()));
      await browser.close();
      for (const profile of profiles) await fs.rm(profile, { recursive: true, force: true });
    }
  }
  // Built site navigation must leave the SPA and open the physical static file.
  const browser = await playwright.chromium.launch();
  try {
    const page = await browser.newPage();
    for (const source of ['/555-timer', '/resources']) {
      await page.goto(`${hosted}${source}`);
      await page.locator('a[href="/worksheets/555-main-lab.html"]').last().click();
      await page.locator('#workbook').waitFor();
      assert.equal(new URL(page.url()).pathname, '/worksheets/555-main-lab.html');
    }
  } finally { await browser.close(); }
  console.log('PASS built site: 555 Timer and Resources links open the standalone worksheet');
})().catch((error) => { console.error(error); process.exitCode = 1; });
