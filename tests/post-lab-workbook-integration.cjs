/* Synthetic browser QA only. Never imports or publishes a real student submission. */
const playwright = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const host = process.env.APP_URL || 'http://127.0.0.1:4174';
const output = path.resolve('output/playwright/pair-postlab');
const slots = ['A0', 'A1', 'M0trigger'];
const payload = (value, name = 'backup.json') => ({
  name,
  mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify(value)),
});
async function go(page, index) {
  if (await page.locator('#menu-button').isVisible())
    await page.locator('#menu-button').click();
  await page.locator(`#steps [data-step="${index}"]`).click();
}
async function source(page, kind, bytes, name) {
  await go(page, 0);
  await page.locator(`[data-source="${kind}"]`).setInputFiles({
    name,
    mimeType: name.endsWith('.zip') ? 'application/zip' : 'application/json',
    buffer: Buffer.from(bytes),
  });
  await page.locator(`[data-import-source="${kind}"]`).click();
  await page.locator('#confirm-import').click();
}
async function menu(page, action) {
  if (!(await page.locator('#save-menu').isVisible()))
    await page.locator('#save-menu-button').click();
  await page.locator(`#save-menu [data-action="${action}"]`).click();
}
async function backup(page, action = 'export') {
  const pending = page.waitForEvent('download');
  await menu(page, action);
  const file = await pending;
  return {
    bytes: await fs.readFile(await file.path()),
    name: file.suggestedFilename(),
  };
}
async function print(page, images, native = false) {
  await page.evaluate(() => {
    window.printCalled = false;
    window.print = () => {
      window.dispatchEvent(new Event('beforeprint'));
      window.printReady = [...document.querySelectorAll('#report img')].every(
        (img) => img.complete && img.naturalWidth,
      );
      window.printCalled = true;
    };
  });
  if (native)
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  else {
    await menu(page, 'print');
    await page.waitForFunction(() => window.printCalled);
    assert.equal(await page.evaluate(() => window.printReady), true);
  }
  assert.equal(
    await page.locator('#report img[data-report-image]').count(),
    images,
  );
  await page.waitForFunction(() =>
    [...document.querySelectorAll('#report img')].every(
      (img) => img.complete && img.naturalWidth,
    ),
  );
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
}
(async () => {
  await fs.mkdir(output, { recursive: true });
  await fs.mkdir('output/pdf', { recursive: true });
  const { createRecord, preservePrediction } =
    await import('../activities/555-main-lab/model.js');
  const { createBackup, createLabZip } =
    await import('../activities/555-main-lab/attachments.js');
  const { makeValidSyntheticEvidence } =
    await import('./fixtures/prelab-synthetic.mjs');
  const { zipOneStored } = await import('../activities/555-post-lab/prelab.js');
  const pre = makeValidSyntheticEvidence();
  pre.learning_progress.practice_responses = {
    s04thought: 'Synthetic switching explanation',
    s5period: '0.08416',
  };
  const preZip = zipOneStored('prelab_evidence.json', JSON.stringify(pre));
  const main = createRecord();
  main.group = {
    id: 'QA-pair',
    student1: { name: pre.student.full_name, id: 'TEST0001' },
    student2: { name: 'Synthetic Partner', id: '000002' },
  };
  for (const [id, design] of Object.entries({
    A0: { r1a: '10', r2a: '33', r2b: '33', capacitor: '10' },
    A1: { r1a: '33', r1b: '10', r2a: '33', r2b: '10', capacitor: '10' },
    M0: { r1a: '33', r1b: '33', capacitor: '10' },
  })) {
    Object.assign(main.configs[id].design, design);
    main.configs[id].prediction.reason = 'Synthetic QA prediction';
    preservePrediction(main, id);
    Object.assign(main.configs[id].measurement, {
      frequency: id === 'A0' ? '1.02' : '1.01',
      high: '.6',
      low: '.3',
      period: '.9',
      pulse: '.73',
      supply: '5',
      outHigh: '3.8',
      outLow: '.1',
      method: 'Synthetic QA method',
    });
  }
  let formats;
  for (const engine of ['chromium', 'firefox', 'webkit']) {
    let browser, context, profile;
    if (engine === 'webkit') {
      profile = await fs.mkdtemp(path.join(os.tmpdir(), '555-postlab-'));
      context = await playwright.webkit.launchPersistentContext(profile, {
        headless: true,
        viewport: { width: 1448, height: 900 },
        acceptDownloads: true,
      });
    } else {
      browser = await playwright[engine].launch({ headless: true });
      context = await browser.newContext({
        viewport: { width: 1448, height: 900 },
        acceptDownloads: true,
      });
    }
    const page = await context.newPage(),
      errors = [],
      requests = [];
    context.on('page', (p) => p.on('dialog', (d) => d.accept()));
    page.on('dialog', (d) => d.accept());
    context.on('request', (r) =>
      requests.push({ method: r.method(), url: r.url() }),
    );
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(`${host}/worksheets/555-post-lab.html`);
      await page.waitForSelector('body[data-ready="true"]');
      if (!formats)
        formats = await page.evaluate(() => {
          const canvas = document.createElement('canvas');
          canvas.width = 800;
          canvas.height = 360;
          const c = canvas.getContext('2d');
          c.fillStyle = '#102a36';
          c.fillRect(0, 0, 800, 360);
          c.fillStyle = '#fff';
          c.font = '20px sans-serif';
          c.fillText(
            'Synthetic QA waveform - not real lab measurements',
            24,
            36,
          );
          c.strokeStyle = '#38545e';
          for (let x = 20; x < 800; x += 40) {
            c.beginPath();
            c.moveTo(x, 60);
            c.lineTo(x, 330);
            c.stroke();
          }
          c.strokeStyle = '#ffd457';
          c.lineWidth = 3;
          c.beginPath();
          c.moveTo(25, 220);
          for (let x = 25; x < 750; x += 150) {
            c.lineTo(x, 110);
            c.lineTo(x + 90, 110);
            c.lineTo(x + 90, 220);
            c.lineTo(x + 150, 220);
          }
          c.stroke();
          const result = {
            png: canvas.toDataURL('image/png').split(',')[1],
            jpeg: canvas.toDataURL('image/jpeg').split(',')[1],
            webp: canvas.toDataURL('image/webp').split(',')[1],
          };
          const raw = c.getImageData(0, 0, 800, 360).data,
            bmp = new Uint8Array(54 + 800 * 360 * 3),
            v = new DataView(bmp.buffer);
          bmp.set([66, 77]);
          v.setUint32(2, bmp.length, true);
          v.setUint32(10, 54, true);
          v.setUint32(14, 40, true);
          v.setInt32(18, 800, true);
          v.setInt32(22, 360, true);
          v.setUint16(26, 1, true);
          v.setUint16(28, 24, true);
          for (let y = 0; y < 360; y++)
            for (let x = 0; x < 800; x++) {
              const i = (y * 800 + x) * 4,
                o = 54 + ((359 - y) * 800 + x) * 3;
              bmp[o] = raw[i + 2];
              bmp[o + 1] = raw[i + 1];
              bmp[o + 2] = raw[i];
            }
          let binary = '';
          for (let i = 0; i < bmp.length; i += 0x8000)
            binary += String.fromCharCode(...bmp.subarray(i, i + 0x8000));
          result.bmp = btoa(binary);
          return result;
        });
      const images = Object.fromEntries(
        slots.map((slot, i) => {
          const fmt = ['png', 'jpeg', 'webp'][i];
          return [
            slot,
            {
              blob: new Blob([Buffer.from(formats[fmt], 'base64')], {
                type: `image/${fmt}`,
              }),
              type: `image/${fmt}`,
              filename: `Screenshot_${i + 1}_Lab_${i + 1}.${fmt}`,
            },
          ];
        }),
      );
      const mainBackup = await createBackup(main, images),
        mainZip = await createLabZip(main, images, 'pair-data.json');
      await print(page, 0, true);
      assert.match(
        await page
          .locator('#report')
          .innerText()
          .catch(() => page.locator('#report').textContent()),
        /DRAFT/,
      );
      if (engine === 'firefox') {
        await source(page, 'main', mainZip, 'pair.zip');
        await source(
          page,
          'prelab',
          Buffer.from(JSON.stringify(pre)),
          'prelab_evidence.json',
        );
      } else {
        await source(page, 'prelab', preZip, 'prelab.zip');
        await source(page, 'main', mainZip, 'pair.zip');
      }
      await page.locator('[data-confirm]').check();
      await go(page, 2);
      assert.equal(await page.locator('#main img').count(), 3);
      assert.equal(await page.locator('#main [data-field]').count(), 0);
      await go(page, 1);
      assert.match(
        await page.locator('#main').innerText(),
        /Original response/,
      );
      assert.equal(await page.locator('#main textarea').count(), 0);
      await go(page, 3);
      assert.equal(await page.locator('[data-field^="analysis."]').count(), 10);
      for (const input of await page.locator('[data-field^="analysis."]').all())
        await input.fill('Independent synthetic QA answer');
      await page.waitForFunction(() =>
        document
          .querySelector('#save-status')
          .textContent.startsWith('Saved in'),
      );
      const saved = await backup(page),
        decoded = JSON.parse(saved.bytes);
      assert.equal(
        decoded.record.sources.prelab.student.university_student_id,
        'TEST0001',
      );
      assert.equal(decoded.images.length, 3);
      assert.match(saved.name, /QA-pair.*TEST0001/);
      const zip = await backup(page, 'zip');
      assert(zip.bytes[0] === 80 && zip.bytes[1] === 75);
      await print(page, 3);
      await print(page, 3, true);
      if (engine === 'chromium') {
        await page.emulateMedia({ media: 'print' });
        await page.pdf({
          path: 'output/pdf/555-individual-post-lab-qa.pdf',
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: true,
        });
        await page.emulateMedia({ media: 'screen' });
      }
      await page.reload();
      await page.waitForSelector('body[data-ready="true"]');
      await go(page, 3);
      assert.equal(
        await page.locator('[data-field="analysis.conclusionA"]').inputValue(),
        'Independent synthetic QA answer',
      );
      await print(page, 3);
      for (const width of [1448, 768, 390]) {
        await page.setViewportSize({ width, height: 900 });
        for (let i = 0; i < 5; i++) {
          await go(page, i);
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
            `${engine}: page ${i} overflows at ${width}`,
          );
        }
        await page.screenshot({
          path: path.join(output, `${engine}-${width}.png`),
        });
      }
      await page.setViewportSize({ width: 1448, height: 900 });
      const revised = structuredClone(pre);
      revised.questions['PRE-P01'].working_response.reasoning =
        'Updated synthetic response';
      await source(
        page,
        'prelab',
        Buffer.from(JSON.stringify(revised)),
        'revised.json',
      );
      await go(page, 4);
      assert.equal(await page.locator('[data-reviewed]').count(), 1);
      await page.locator('[data-confirm]').check();
      await page.locator('[data-reviewed]').check();
      await print(page, 3);
      const other = structuredClone(pre);
      other.student.university_student_id = 'FOREIGN';
      await go(page, 0);
      await page
        .locator('[data-source="prelab"]')
        .setInputFiles(payload(other, 'foreign.json'));
      await page.locator('[data-import-source="prelab"]').click();
      await page.waitForFunction(() =>
        document
          .querySelector('#toast')
          .textContent.includes('different student'),
      );
      assert.equal(await page.locator('#confirm-import').count(), 0);
      await go(page, 3);
      assert.equal(
        await page.locator('[data-field="analysis.conclusionA"]').inputValue(),
        'Independent synthetic QA answer',
      );
      // Replace the main source with one actual BMP screenshot; no stale images.
      const bmpImages = {
        A0: {
          blob: new Blob([Buffer.from(formats.bmp, 'base64')], {
            type: 'image/bmp',
          }),
          type: 'image/bmp',
          filename: 'Screenshot_1_Lab_1.bmp',
        },
      };
      const replaced = await createBackup(main, bmpImages);
      await source(
        page,
        'main',
        Buffer.from(JSON.stringify(replaced)),
        'bmp-main.json',
      );
      await go(page, 4);
      await page.locator('[data-confirm]').check();
      if (await page.locator('[data-reviewed]').count())
        await page.locator('[data-reviewed]').check();
      await print(page, 1);
      assert.equal(
        await page
          .locator('#report .missing')
          .filter({ hasText: 'Image not attached' })
          .count(),
        2,
      );
      // Restore the full backup, then verify separate main/post-lab tab storage.
      await page.locator('#import-file').setInputFiles({
        name: 'individual.zip',
        mimeType: 'application/zip',
        buffer: zip.bytes,
      });
      await page.locator('#confirm-import').click();
      await print(page, 3);
      const mainPage = await context.newPage();
      mainPage.on('pageerror', (e) => errors.push(e.message));
      await mainPage.goto(`${host}/worksheets/555-main-lab.html`);
      await mainPage.locator('#import-file').setInputFiles(payload(mainBackup));
      await mainPage.locator('#confirm-import').click();
      await print(mainPage, 3);
      assert.equal(
        await mainPage.locator('#report [data-report-image]').count(),
        3,
      );
      assert.doesNotMatch(
        await mainPage.locator('#report').textContent(),
        /Independent synthetic QA answer/,
      );
      if (engine === 'chromium') {
        await mainPage.emulateMedia({ media: 'print' });
        await mainPage.pdf({
          path: 'output/pdf/555-paired-main-lab-qa.pdf',
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: true,
        });
        await mainPage.emulateMedia({ media: 'screen' });
      }
      const pairSaved = await mainPage.evaluate(() =>
        localStorage.getItem('electronics-555-main-lab-v3'),
      );
      await menu(page, 'new');
      await page.locator('#confirm-new').click();
      await go(page, 2);
      assert.equal(await page.locator('#main img').count(), 0);
      await print(page, 0, true);
      const partner = structuredClone(pre);
      partner.student = {
        full_name: 'Synthetic Partner',
        university_student_id: '000002',
      };
      await source(
        page,
        'prelab',
        Buffer.from(JSON.stringify(partner)),
        'partner.json',
      );
      await source(page, 'main', mainZip, 'pair.zip');
      await page.locator('[data-confirm]').check();
      await go(page, 3);
      assert.equal(
        await page.locator('[data-field="analysis.conclusionA"]').inputValue(),
        '',
      );
      assert.equal(
        await mainPage.evaluate(() =>
          localStorage.getItem('electronics-555-main-lab-v3'),
        ),
        pairSaved,
      );
      await print(page, 3);
      assert.doesNotMatch(
        await page.locator('#report').textContent(),
        /Independent synthetic QA answer/,
      );
      // Two individual tabs keep their own record even if the active pointer changes.
      const firstStudent = await context.newPage();
      await firstStudent.goto(`${host}/worksheets/555-post-lab.html`);
      await firstStudent.waitForSelector('body[data-ready="true"]');
      await firstStudent.locator('#import-file').setInputFiles({
        name: 'first-student.json',
        mimeType: 'application/json',
        buffer: saved.bytes,
      });
      await firstStudent.locator('#confirm-import').click();
      await go(page, 3);
      await page
        .locator('[data-field="analysis.conclusionA"]')
        .fill('Partner-only conclusion');
      await page.waitForFunction(() =>
        document
          .querySelector('#save-status')
          .textContent.startsWith('Saved in'),
      );
      await go(firstStudent, 3);
      assert.equal(
        await firstStudent
          .locator('[data-field="analysis.conclusionA"]')
          .inputValue(),
        'Independent synthetic QA answer',
      );
      const firstAgain = JSON.parse((await backup(firstStudent)).bytes);
      assert.equal(
        firstAgain.record.sources.prelab.student.university_student_id,
        'TEST0001',
      );
      assert.equal(
        JSON.parse((await backup(page)).bytes).record.sources.prelab.student
          .university_student_id,
        '000002',
      );
      await firstStudent.close();
      // Automatic local-v2 recovery is previewed, with images and the old save untouched.
      const legacyData = structuredClone(main);
      legacyData.schemaVersion = 2;
      legacyData.group = {
        id: 'QA-pair',
        members: 'Synthetic Test Student\nSynthetic Partner',
      };
      delete legacyData.legacyMembers;
      legacyData.analysis.conclusionA =
        'Earlier shared conclusion - recovery only';
      const legacyText = JSON.stringify(legacyData),
        legacyPage = await context.newPage();
      await legacyPage.addInitScript((text) => {
        localStorage.removeItem('electronics-555-main-lab-v3');
        localStorage.setItem('electronics-555-main-lab-v2', text);
      }, legacyText);
      await legacyPage.goto(`${host}/worksheets/555-main-lab.html`);
      await legacyPage.locator('#confirm-import').waitFor();
      assert.match(
        await legacyPage.locator('#dialog-body').textContent(),
        /Earlier v2 data/,
      );
      await legacyPage.locator('#confirm-import').click();
      assert.equal(
        await legacyPage
          .locator('[data-field="group.student1.id"]')
          .inputValue(),
        '',
      );
      assert.equal(
        await legacyPage.evaluate(() =>
          localStorage.getItem('electronics-555-main-lab-v2'),
        ),
        legacyText,
      );
      await legacyPage
        .locator('[data-field="group.student1.id"]')
        .fill('TEST0001');
      await legacyPage
        .locator('[data-field="group.student2.id"]')
        .fill('000002');
      await print(legacyPage, 3);
      assert.doesNotMatch(
        await legacyPage.locator('#report').textContent(),
        /Earlier shared conclusion/,
      );
      await legacyPage.close();
      // Storage-denied session keeps complete imported evidence and printing.
      const denied = await context.newPage();
      await denied.addInitScript(() =>
        Object.defineProperty(window, 'indexedDB', {
          get() {
            throw new Error('Synthetic denied storage');
          },
        }),
      );
      await denied.goto(`${host}/worksheets/555-post-lab.html`);
      await denied.waitForSelector('body[data-ready="true"]');
      await menu(denied, 'new');
      await denied.locator('#confirm-new').click();
      await source(denied, 'prelab', preZip, 'prelab.zip');
      await source(denied, 'main', mainZip, 'pair.zip');
      await denied.locator('[data-confirm]').check();
      await print(denied, 3);
      const recovery = JSON.parse((await backup(denied)).bytes);
      assert.equal(recovery.images.length, 3);
      assert.match(
        await denied.locator('#save-status').textContent(),
        /Save failed|Saving|Unsaved/,
      );
      await denied.close();
      // A solo group selects unrestricted timing values through the real forms.
      const solo = createRecord();
      solo.group = {
        id: 'QA-solo',
        student1: { name: pre.student.full_name, id: 'TEST0001' },
        student2: { name: '', id: '' },
      };
      await mainPage
        .locator('#import-file')
        .setInputFiles(payload(await createBackup(solo, images)));
      await mainPage.locator('#confirm-import').click();
      await go(mainPage, 0);
      assert.equal(
        await mainPage
          .getByLabel('Student 2 name (optional)', { exact: true })
          .count(),
        1,
      );
      const fillMain = (field, value) =>
        mainPage.locator(`[data-field="${field}"]`).fill(value);
      for (const [index, id, values] of [
        [1, 'A0', { r1a: '127.25', r2a: '812.75', capacitor: '0.47' }],
        [2, 'A1', { r1a: '500.5', r2a: '501.5' }],
        [3, 'M0', { r1a: '31.5', capacitor: '22' }],
      ]) {
        await go(mainPage, index);
        if (id !== 'A1') {
          assert.equal(
            await mainPage
              .locator(`[data-field="configs.${id}.design.capacitor"]`)
              .evaluate((el) => el.tagName),
            'INPUT',
          );
        }
        for (const [key, value] of Object.entries(values))
          await fillMain(`configs.${id}.design.${key}`, value);
        await fillMain(
          `configs.${id}.prediction.${id === 'M0' ? 'pulse' : 'frequency'}`,
          '1',
        );
        await mainPage.locator(`[data-preserve="${id}"]`).click();
        assert.equal(
          await mainPage
            .locator(
              `[data-field="configs.${id}.measurement.${id === 'M0' ? 'pulse' : 'frequency'}"]`,
            )
            .isEnabled(),
          true,
        );
        await fillMain(
          `configs.${id}.measurement.${id === 'M0' ? 'pulse' : 'frequency'}`,
          '1.01',
        );
        await mainPage
          .locator('summary')
          .filter({ hasText: 'Component measurements and tolerances' })
          .click();
        await fillMain(
          `configs.${id}.design.measuredC`,
          values.capacitor || '0.47',
        );
      }
      await go(mainPage, 1);
      await fillMain('configs.A0.design.capacitor', '47');
      await go(mainPage, 2);
      assert.match(
        await mainPage.locator('[data-fixed-capacitor]').textContent(),
        /0.47/,
      );
      const soloJson = await backup(mainPage);
      const soloData = JSON.parse(soloJson.bytes);
      assert.match(soloJson.name, /QA-solo.*TEST0001/);
      assert.doesNotMatch(soloJson.name, /DRAFT|Partner/);
      assert.equal(
        soloData.record.configs.A0.original.design.capacitor,
        '0.47',
      );
      assert.equal(
        soloData.record.configs.A1.original.reference.capacitor,
        '0.47',
      );
      assert.equal(soloData.record.configs.M0.original.design.capacitor, '22');
      const soloZip = await backup(mainPage, 'zip');
      await print(mainPage, 3);
      assert.doesNotMatch(
        await mainPage.locator('#report').textContent(),
        /Student 2|DRAFT/,
      );
      if (engine === 'chromium') {
        await mainPage.emulateMedia({ media: 'print' });
        await mainPage.pdf({
          path: 'output/pdf/555-solo-main-lab-qa.pdf',
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: true,
        });
        await mainPage.emulateMedia({ media: 'screen' });
      }
      await menu(page, 'new');
      await page.locator('#confirm-new').click();
      await source(page, 'main', soloZip.bytes, soloZip.name);
      await source(page, 'prelab', preZip, 'prelab.zip');
      await page.locator('[data-confirm]').check();
      await go(page, 3);
      await page
        .locator('[data-field="analysis.conclusionA"]')
        .fill('Individual conclusion from a solo group.');
      await print(page, 3);
      assert.doesNotMatch(
        await page.locator('#report').textContent(),
        /Student 2|DRAFT \/ INCOMPLETE/,
      );
      if (engine === 'chromium') {
        await page.emulateMedia({ media: 'print' });
        await page.pdf({
          path: 'output/pdf/555-solo-post-lab-qa.pdf',
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: true,
        });
        await page.emulateMedia({ media: 'screen' });
      }
      for (const width of [1448, 768, 390]) {
        await mainPage.setViewportSize({ width, height: 900 });
        await go(mainPage, 0);
        if (
          (await mainPage
            .locator('#menu-button')
            .getAttribute('aria-expanded')) === 'true'
        )
          await mainPage.keyboard.press('Escape');
        assert(
          await mainPage
            .getByLabel('Student 2 ID (optional)', { exact: true })
            .isVisible(),
        );
        assert(
          await mainPage.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        );
        await mainPage.screenshot({
          path: path.join(output, `${engine}-solo-${width}.png`),
          fullPage: true,
          animations: 'disabled',
        });
      }
      // A partial second student remains a downloadable draft, not a completed report.
      await fillMain('group.student2.name', 'Optional Partner');
      await menu(mainPage, 'print');
      assert.match(
        await mainPage.locator('#toast').textContent(),
        /Student 2 ID/,
      );
      assert.equal(
        JSON.parse((await backup(mainPage)).bytes).record.group.student2.name,
        'Optional Partner',
      );
      await fillMain('group.student2.id', 'TEST0001');
      await menu(mainPage, 'print');
      assert.match(await mainPage.locator('#toast').textContent(), /different/);
      await fillMain('group.student2.id', '000002');
      await print(mainPage, 3);
      assert.match(
        await mainPage.locator('#report').textContent(),
        /Student 2/,
      );
      assert.deepEqual(errors, []);
      assert(
        requests
          .filter((r) => /^https?:/.test(r.url))
          .every((r) => r.method === 'GET' && r.url.startsWith(host + '/')),
        'Student data must never be posted or sent to another server',
      );
      console.log(
        `PASS ${engine}: unrestricted timing values, solo/two-student groups, source imports, responsive pages, reports, restore, replacement, identity and storage isolation; no upload requests`,
      );
    } finally {
      await context.close();
      if (browser) await browser.close();
      if (profile) await fs.rm(profile, { recursive: true, force: true });
    }
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
