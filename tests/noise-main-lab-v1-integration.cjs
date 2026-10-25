/* Isolated synthetic QA. No real student data, external uploads or production writes. */
const playwright = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { unzipSync } = require('fflate');
const { pathToFileURL } = require('node:url');
const origin = process.env.APP_URL || 'http://127.0.0.1:4182';
const url = origin + '/worksheets/noise-filtering-main-lab-v1.html';
const output = path.resolve('output/playwright/noise-main-lab-v1');
const key = 'electronics-noise-filtering-main-lab-v1';
const prekey = '2145427-W12-prelab-20261026-impl-v1';
const oldkey = 'electronics-555-main-lab-v3';
const results = [];
function check(name, actual) { assert(actual, name); results.push(name); }
async function ready(page) {
  await page.waitForFunction(() => !document.querySelector('#workbook').inert && !document.querySelector('#save-status').textContent.includes('Not saved yet'));
}
async function go(page, n) {
  const menu = page.locator('#menu-button');
  if (await menu.isVisible()) await menu.click();
  await page.locator(`#steps [data-step="${n}"]`).click();
  assert.equal(await page.locator('#screen-count').innerText(), `${n + 1} / 5`);
  if (await menu.isVisible()) await page.waitForFunction(() => document.querySelector('#sidebar').getBoundingClientRect().right <= 0);
}
async function menuAction(page, action) {
  if (!(await page.locator('#save-menu').isVisible())) await page.locator('#save-menu-button').click();
  await page.locator(`#save-menu [data-action="${action}"]`).click();
}
async function download(page, action) {
  const wait = page.waitForEvent('download');
  await menuAction(page, action);
  const file = await wait;
  return { bytes: await fs.readFile(await file.path()), name: file.suggestedFilename() };
}
async function upload(page, slot, bytes, name) {
  const capture = slot.split('.')[0];
  await page.locator(`#capture-${capture}`).evaluate((el) => { el.open = true; });
  await page.locator(`[data-file="${slot}"]`).setInputFiles({ name, mimeType: slot.endsWith('.csv') ? 'text/csv' : 'image/png', buffer: bytes });
  await page.locator(`[data-upload="${slot}"]`).click();
  await page.locator(`[data-attachment="${slot}"] .image-status`).filter({ hasText: 'Attached locally' }).waitFor();
}
async function importData(page, bytes, confirm = true, extension = 'zip') {
  await page.locator('#import-file').setInputFiles({ name: `trial.${extension}`, mimeType: extension === 'zip' ? 'application/zip' : 'application/json', buffer: bytes });
  await page.locator('#confirm-import').waitFor();
  await page.locator(confirm ? '#confirm-import' : '#cancel-import').click();
}
async function stored(page) { return page.evaluate((key) => localStorage.getItem(key), key); }
async function report(page) {
  await page.evaluate(() => { window.printCalled = false; window.print = () => { window.dispatchEvent(new Event('beforeprint')); window.printCalled = true; }; });
  await menuAction(page, 'print');
  await page.waitForFunction(() => window.printCalled);
  check('Report images decoded before printing', await page.locator('#report img').evaluateAll((els) => els.every((img) => img.complete && img.naturalWidth > 0)));
  check('Report uses mathematical notation', await page.locator('#report math').count() >= 6);
  await page.emulateMedia({ media: 'print' });
  check('Print excludes worksheet controls', !(await page.locator('#workbook').isVisible()) && await page.locator('#report').isVisible());
}
(async () => {
  const model = await import(pathToFileURL(path.resolve('activities/noise-filtering-main-lab-v1/model.js')));
  await fs.mkdir(output, { recursive: true });
  const csv = Buffer.from('# SYNTHETIC QA ONLY - NOT MEASURED DATA\r\n# nominal_sample_rate_hz,500\r\nsample_index,t_us,raw_counts,raw_v,ma5_v,ma21_v,ema20_v,ema04_v\r\n0,0,1638,2,2,2,2,2\r\n1,2000,1639,2.0012,2.00024,2.00006,2.00024,2.000048\r\n# END_NOISE_LAB_CSV_V1\r\n');
  for (const engine of (process.env.BROWSERS || 'chromium,firefox,webkit').split(',')) {
    const browser = await playwright[engine].launch({ headless: true });
    const contexts = [], profiles = [];
    const context = async () => {
      let c;
      if (engine === 'webkit') {
        const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'noise-main-webkit-')); profiles.push(profile);
        c = await playwright.webkit.launchPersistentContext(profile, { headless: true, viewport: { width: 1512, height: 1000 }, acceptDownloads: true });
      } else c = await browser.newContext({ viewport: { width: 1512, height: 1000 }, acceptDownloads: true });
      contexts.push(c); return c;
    };
    try {
      const c = await context(), page = await c.newPage(), errors = [], requests = [];
      page.on('pageerror', (e) => errors.push(e.message)); page.on('dialog', (d) => d.accept());
      await page.goto(url); await ready(page);
      const png = Buffer.from(await page.evaluate(() => {
        const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 340;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#0b2434'; ctx.fillRect(0, 0, 900, 340);
        ctx.fillStyle = '#ffffff'; ctx.font = '22px sans-serif'; ctx.fillText('SYNTHETIC QA — not measured lab data', 25, 36);
        ctx.strokeStyle = '#325269'; ctx.lineWidth = 1;
        for (let x = 20; x < 900; x += 40) { ctx.beginPath(); ctx.moveTo(x, 60); ctx.lineTo(x, 300); ctx.stroke(); }
        for (let y = 60; y <= 300; y += 40) { ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(880, y); ctx.stroke(); }
        ctx.lineWidth = 3; ctx.strokeStyle = '#ffd361'; ctx.beginPath();
        for (let x = 20; x < 880; x++) { const y = 180 + 80 * Math.sin(x / 35); x === 20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
        return canvas.toDataURL('image/png').split(',')[1];
      }), 'base64');
      page.on('request', (r) => requests.push(r.url()));
      await page.evaluate(([p, o]) => { localStorage.setItem(p, 'PRELAB_SENTINEL'); localStorage.setItem(o, '555_SENTINEL'); }, [prekey, oldkey]);
      const draft = await download(page, 'zip');
      check(`${engine}: incomplete ZIP downloadable`, Object.keys(unzipSync(draft.bytes)).length === 3);
      await menuAction(page, 'print');
      check(`${engine}: incomplete identity explained`, (await page.locator('#toast').innerText()).includes('Group ID'));
      for (const [field, value] of Object.entries({ 'group.groupId': 'SYNTHETIC-QA', 'group.student1Name': 'Trial Student One', 'group.student1Id': 'QA001', 'setup.board': 'UNO R4 Minima — synthetic test', 'setup.sketch': '1.0.0', 'setup.reference': '4.98', 'setup.nominalRate': '500', 'setup.actualRate': '499.98' })) await page.locator(`[data-field="${field}"]`).fill(value);
      await page.locator('#next').focus(); await page.keyboard.press('Enter');
      check(`${engine}: keyboard Continue`, (await page.locator('#screen-count').innerText()) === '2 / 5');
      const originals = {};
      for (const [index, exp] of [[1, 'baseline'], [2, 'analog'], [3, 'digital']]) {
        await go(page, index);
        await page.locator(`[data-preserve="${exp}"]`).click();
        check(`${engine}: prediction cannot freeze empty ${exp}`, (await page.locator('#toast').innerText()).includes('reasoning'));
        const values = { configuration: `${exp}: 10 kΩ, 1 µF; sample rate 500`, prediction: `Preserved ${exp}: <script>window.injected=true</script> "quotes" and \`backticks\``, reason: 'Prediction depends on actual LDR response and clipping.' };
        for (const [field, value] of Object.entries(values)) await page.locator(`[data-field="prediction.${exp}.${field}"]`).fill(value);
        await page.locator(`[data-preserve="${exp}"]`).click(); originals[exp] = values;
        await page.locator(`[data-field="prediction.${exp}.prediction"]`).fill(`Correction for ${exp}: compare measured conditions.`);
        check(`${engine}: original remains literal ${exp}`, (await page.locator('#main').innerText()).includes(values.prediction) && !(await page.evaluate(() => window.injected)));
        for (const cap of model.CAPTURES.filter((item) => item.page === index && item.kind !== 'optional')) {
          await page.locator(`#capture-${cap.id}`).evaluate((el) => { el.open = true; });
          if (cap.kind === 'csv' || cap.kind === 'both') await upload(page, cap.id + '.csv', csv, 'original-capture.csv');
          if (cap.kind === 'image' || cap.kind === 'both') await upload(page, cap.id + '.image', png, 'original-scope.png');
        }
        // Enter all remaining visible fields through their real input handlers; no direct record mutation.
        await page.locator('#main [data-field]').evaluateAll((els) => els.forEach((el) => {
          if (!el.value) { el.value = el.dataset.field.includes('runId') ? 'SYNTHETIC-RUN-001' : el.dataset.field.includes('rate') ? '500' : el.dataset.field.includes('windowStart') ? '0' : el.dataset.field.includes('windowEnd') ? '3.998' : 'Synthetic entry — instructor pilot required'; el.dispatchEvent(new Event('input', { bubbles: true })); }
        }));
      }
      await go(page, 0);
      await page.locator('#main [data-field]').evaluateAll((els) => els.forEach((el) => {
        if (!el.value && !el.dataset.field.includes('student2')) { el.value = 'Synthetic apparatus entry'; el.dispatchEvent(new Event('input', { bubbles: true })); }
      }));
      await go(page, 4);
      check(`${engine}: complete evidence checklist`, (await page.locator('#main').innerText()).includes('listed fields and required files are present'));
      const jsonDownload = await download(page, 'export'), json = JSON.parse(jsonDownload.bytes), zipDownload = await download(page, 'zip');
      const zip = unzipSync(zipDownload.bytes), backup = JSON.parse(Buffer.from(zip['main_lab_backup.json']));
      check(`${engine}: original filenames retained`, backup.attachments.every((a) => a.originalName.startsWith('original-')));
      check(`${engine}: JSON and ZIP contain same saved work`, JSON.stringify(json) === JSON.stringify(backup));
      for (const a of backup.attachments) {
        const raw = Buffer.from(a.data, 'base64'), expected = a.slot.endsWith('.csv') ? csv : png;
        assert.deepEqual(raw, expected);
        assert.deepEqual(Buffer.from(zip[(a.slot.endsWith('.csv') ? 'data/' : 'screenshots/') + a.filename]), expected);
      }
      check(`${engine}: all original attachment bytes retained`, backup.attachments.length === 21);
      for (const [exp, values] of Object.entries(originals)) for (const [field, value] of Object.entries(values)) assert.equal(backup.record.originals[exp][field], value);
      check(`${engine}: saved prediction corrections separate`, backup.record.fields['prediction.analog.prediction'].startsWith('Correction'));
      await fs.writeFile(path.join(output, `synthetic-main-lab-${engine}.zip`), zipDownload.bytes);
      await fs.writeFile(path.join(output, `synthetic-main-lab-${engine}.json`), jsonDownload.bytes);
      await menuAction(page, 'save');
      await page.waitForFunction(() => document.querySelector('#save-status').textContent.startsWith('Answers saved'));
      await page.reload(); await ready(page);
      check(`${engine}: browser reload retains complete files`, JSON.parse((await download(page, 'export')).bytes).attachments.length === 21);
      await go(page, 1);
      await page.locator('#capture-baseline10').evaluate((el) => { el.open = true; });
      const beforeInvalid = await stored(page);
      await page.locator('[data-file="baseline10.csv"]').setInputFiles({ name: 'invalid.csv', mimeType: 'text/csv', buffer: Buffer.from([0, 1, 2]) });
      await page.locator('[data-upload="baseline10.csv"]').click();
      await page.locator('#toast').filter({ hasText: 'control data' }).waitFor();
      check(`${engine}: invalid evidence cannot replace attachment`, beforeInvalid === await stored(page));
      await page.locator('[data-file="baseline10.image"]').setInputFiles({ name: 'invalid.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
      await page.locator('[data-upload="baseline10.image"]').click();
      await page.locator('#toast').filter({ hasText: /PNG|image|Unsupported/ }).waitFor();
      check(`${engine}: invalid image rejected`, beforeInvalid === await stored(page));
      await page.locator('#import-file').setInputFiles({ name: 'wrong.json', mimeType: 'application/json', buffer: Buffer.from('{"activity":"555"}') });
      await page.locator('#toast').filter({ hasText: 'Choose a Noise' }).waitFor();
      check(`${engine}: wrong identity rejected without replacement`, beforeInvalid === await stored(page));
      await importData(page, draft.bytes, false);
      check(`${engine}: cancelled import retains answers`, beforeInvalid === await stored(page));
      await menuAction(page, 'new'); await page.locator('#cancel-new').click();
      check(`${engine}: cancelled new workbook retains answers`, beforeInvalid === await stored(page));
      const c2 = await context(), restored = await c2.newPage(); restored.on('dialog', (d) => d.accept());
      await restored.goto(url); await ready(restored); await importData(restored, zipDownload.bytes);
      await menuAction(restored, 'save');
      await restored.waitForFunction(() => document.querySelector('#save-status').textContent.startsWith('Answers saved'));
      await restored.reload(); await ready(restored);
      const restoredBackup = JSON.parse((await download(restored, 'export')).bytes);
      check(`${engine}: fresh-browser ZIP restore`, restoredBackup.attachments.length === 21 && JSON.stringify(restoredBackup.record.originals) === JSON.stringify(backup.record.originals));
      check(`${engine}: restored copy gets independent attachment identity`, restoredBackup.record.recordId !== backup.record.recordId);
      await importData(restored, jsonDownload.bytes, true, 'json');
      check(`${engine}: JSON restore includes all files`, JSON.parse((await download(restored, 'export')).bytes).attachments.length === 21);
      await report(page);
      if (engine === 'chromium') await page.pdf({ path: path.join(output, 'synthetic-main-lab-report.pdf'), format: 'A4', preferCSSPageSize: true, printBackground: true });
      await page.emulateMedia({ media: 'screen' }); await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
      await go(page, 0);
      await page.locator('[data-field="group.student2Name"]').fill('Trial Student Two');
      await page.locator('[data-field="group.student2Id"]').fill('QA002');
      await report(page);
      check(`${engine}: two members appear in report`, (await page.locator('#report').innerText()).includes('Trial Student Two'));
      await page.emulateMedia({ media: 'screen' }); await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
      for (const width of engine === 'chromium' ? [1512, 768, 390, 320] : [390]) {
        await page.setViewportSize({ width, height: 1000 });
        if (width < 820) {
          await page.locator('#menu-button').click();
          await page.locator('#close-navigation').focus(); await page.keyboard.press('Shift+Tab');
          check(`${engine}: mobile drawer traps keyboard focus ${width}`, await page.locator('#steps button').last().evaluate((el) => document.activeElement === el));
          await page.keyboard.press('Escape');
          check(`${engine}: Escape restores navigation trigger ${width}`, await page.locator('#menu-button').evaluate((el) => document.activeElement === el));
          check(`${engine}: closed mobile navigation is inert ${width}`, await page.locator('#sidebar').evaluate((el) => el.inert));
        }
        for (let step = 0; step < 5; step++) {
          await go(page, step);
          check(`${engine}: viewport ${width} page ${step + 1}`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
          for (const math of await page.locator('#main math').all()) check(`${engine}: mathematical layout ${width}/${step}`, await math.evaluate((el) => el.getBoundingClientRect().height > 10 && parseFloat(getComputedStyle(el).fontSize) >= 16));
        }
        await go(page, 2);
        await page.screenshot({ path: path.join(output, `${engine}-analog-${width}.png`), fullPage: false });
        if (engine === 'chromium' && width === 1512) await page.locator('.noise-diagram').first().screenshot({ path: path.join(output, 'analog-circuit.png') });
      }
      check(`${engine}: unrelated storage unchanged`, await page.evaluate(([p, o]) => localStorage.getItem(p) === 'PRELAB_SENTINEL' && localStorage.getItem(o) === '555_SENTINEL', [prekey, oldkey]));
      // Check document links and history on a separate page, leaving the trial workbook intact.
      const nav = await c.newPage();
      await nav.goto(origin + '/noise-and-filtering');
      await nav.getByRole('link', { name: /Open main lab/ }).click(); await ready(nav);
      check(`${engine}: topic opens the current main-lab document`, nav.url() === origin + '/worksheets/noise-filtering-main-lab.html');
      check(`${engine}: current worksheet links to preserved legacy work`, await nav.locator('a[href="/worksheets/noise-filtering-main-lab-v1.html"]').count() === 1);
      await nav.goBack(); check(`${engine}: Back returns to topic`, new URL(nav.url()).pathname === '/noise-and-filtering');
      await nav.goForward(); await ready(nav);
      await nav.locator('.trail a').click();
      await nav.goto(origin + '/resources');
      check(`${engine}: Resources has current main-lab link`, await nav.locator('a[href="/worksheets/noise-filtering-main-lab.html"]').count() >= 1);
      const sketchResponse = await nav.request.get(origin + model.DOWNLOAD_BASE + 'noise_filtering_main_lab.zip');
      check(`${engine}: sketch download available`, sketchResponse.ok() && Object.keys(unzipSync(await sketchResponse.body())).some((p) => p.endsWith('.ino')));
      await nav.goto(url); await ready(nav); await go(nav, 0);
      const popupWait = c.waitForEvent('page'); await nav.getByRole('link', { name: 'Open pre-lab reference ↗' }).click();
      const popup = await popupWait; await popup.waitForLoadState();
      check(`${engine}: pre-lab reference opens separate existing workbook`, new URL(popup.url()).pathname === model.PRELAB); await popup.close();
      check(`${engine}: standalone workflow has no runtime network dependency`, requests.every((r) => r === url || r.startsWith('blob:')));
      check(`${engine}: no browser runtime errors`, errors.length === 0);
      // Storage denial must keep this session and portable exports usable.
      const deniedContext = await context();
      await deniedContext.addInitScript(() => {
        Storage.prototype.setItem = () => { throw new DOMException('Synthetic denied storage', 'QuotaExceededError'); };
        Object.defineProperty(window, 'indexedDB', { get: () => { throw new Error('Synthetic blocked IDB'); } });
      });
      const denied = await deniedContext.newPage(); denied.on('dialog', (d) => d.accept());
      await denied.goto(url); await ready(denied);
      await denied.locator('[data-field="group.groupId"]').fill('UNSAVED-SESSION');
      check(`${engine}: storage failure gives backup guidance`, (await denied.locator('#save-status').innerText()).includes('download JSON or ZIP now'));
      await go(denied, 1); await upload(denied, 'baseline10.csv', csv, 'original-capture.csv');
      const unsaved = JSON.parse((await download(denied, 'export')).bytes);
      check(`${engine}: storage-denied session exports answers and files`, unsaved.record.fields['group.groupId'] === 'UNSAVED-SESSION' && unsaved.attachments.length === 1);
      if (engine === 'chromium') {
        const corruptContext = await context();
        await corruptContext.addInitScript((key) => { localStorage.setItem(key, '{unreadable record'); }, key);
        const corrupt = await corruptContext.newPage(); corrupt.on('dialog', (d) => d.accept());
        await corrupt.goto(url); await ready(corrupt);
        await corrupt.locator('[data-field="group.groupId"]').fill('temporary session'); await menuAction(corrupt, 'save');
        check('Unreadable browser record remains untouched', await stored(corrupt) === '{unreadable record');
        const raw = await download(corrupt, 'recover'); check('Unreadable record recovery download', raw.bytes.toString() === '{unreadable record');
        await menuAction(corrupt, 'new'); await corrupt.locator('#confirm-new').click();
        check('Explicit new workbook exits protective pause', JSON.parse(await stored(corrupt)).fields['group.groupId'] === '');
        const missingContext = await context();
        await missingContext.addInitScript(([key, record]) => { localStorage.setItem(key, JSON.stringify(record)); }, [key, backup.record]);
        const missing = await missingContext.newPage(); missing.on('dialog', (d) => d.accept());
        await missing.goto(url); await ready(missing);
        const protectedText = await stored(missing);
        await menuAction(missing, 'save');
        check('Missing browser files pause replacement of their record', protectedText === await stored(missing));
        check('Missing evidence explains recovery', (await missing.locator('#save-status').innerText()).includes('protect unreadable or missing'));
      }
      console.log(`${engine}: complete trial, portable files, layouts, reports and failure cases passed.`);
    } finally {
      for (const c of contexts) await c.close();
      await browser.close(); for (const p of profiles) await fs.rm(p, { recursive: true, force: true });
    }
  }
  await fs.writeFile(path.join(output, `results-${(process.env.BROWSERS || 'chromium,firefox,webkit').replaceAll(',', '-')}.json`), JSON.stringify(results, null, 2));
  console.log(`${results.length} main-lab browser checks passed.`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
