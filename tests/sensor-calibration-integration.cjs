// Synthetic browser journeys; no values in this file are hardware measurements.
const { chromium, firefox, webkit } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const origin = process.env.APP_URL || 'http://127.0.0.1:4187';
const output = path.resolve('output/playwright/sensor-calibration');
const engines = (process.env.BROWSERS || 'chromium,firefox,webkit').split(',');
const image = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
  'base64',
);
let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks++;
}
async function saved(page) {
  try {
    await page.waitForFunction(() =>
      document
        .getElementById('save-status')
        ?.textContent.includes('Saved in this browser'),
    );
  } catch (error) {
    throw new Error(
      `${error.message}; save state: ${await page.locator('#save-status').textContent()}; storage: ${await page.locator('#storage-warning').textContent()}`,
    );
  }
}
async function go(page, n) {
  if (
    (await page.locator('#menu-button').isVisible()) &&
    (await page.locator('#menu-button').getAttribute('aria-expanded')) ===
      'false'
  )
    await page.locator('#menu-button').click();
  await page.locator(`#steps [data-page="${n}"]`).click();
  await page.locator('#main > .page-title h1').waitFor();
}
async function download(page, action) {
  const waiting = page.waitForEvent('download');
  if (!(await page.locator(`#main button[data-action="${action}"]`).count())) {
    await page.locator('#save-menu-button').click();
    await page.locator(`#save-menu [data-action="${action}"]`).click();
  } else await page.locator(`#main button[data-action="${action}"]`).click();
  const d = await waiting,
    filename = path.join(output, `${Date.now()}-${d.suggestedFilename()}`);
  await d.saveAs(filename);
  return { filename, bytes: new Uint8Array(await fs.readFile(filename)) };
}
async function importFile(page, filename, action, confirm = true) {
  const waiting = page.waitForEvent('filechooser');
  if (action === 'source')
    await page.locator('#main button[data-action="source"]').click();
  else {
    await page.locator('#save-menu-button').click();
    await page.locator('#save-menu button[data-action="import"]').click();
  }
  const chooser = await waiting;
  await chooser.setFiles(filename);
  await page.locator('#dialog[open]').waitFor();
  await page.locator(confirm ? '#dialog-confirm' : '#dialog-cancel').click();
  await page.locator('#dialog').waitFor({ state: 'hidden' });
}
const syntheticCSV =
  '\uFEFFtrial,condition,reference distance (cm),echo time (us),note,extra\r\n1,perpendicular,12,705,"QA, not measured",001\r\n2,perpendicular,12,,No echo: QA failure,002\r\n3,perpendicular,12,bad text,Excluded: QA exclusion,003\r\n';
const syntheticCode =
  '// Synthetic QA fixture only\n// <script>literal text</script>\nvoid setup() {}\nvoid loop() {}\n' +
  Array.from(
    { length: 90 },
    (_, i) =>
      `// Synthetic QA comment line ${i + 1}; not a supplied measurement program.\n`,
  ).join('');
async function attach(page, slot, name, buffer, mimeType = 'text/plain') {
  const waiting = page.waitForEvent('filechooser');
  await page.locator(`[data-file="${slot}"]`).click();
  await (
    await waiting
  ).setFiles({ name, mimeType, buffer: Buffer.from(buffer) });
  await page.locator(`[data-remove-file="${slot}"]`).waitFor();
  await page.waitForFunction(() =>
    document.querySelector('#message').textContent.includes('attached locally'),
  );
}
async function mainJourney(browser, engine, model, files) {
  const context = await browser.newContext({
    viewport: { width: 1512, height: 1000 },
    acceptDownloads: true,
  });
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${origin}/worksheets/sensor-calibration-main-lab.html`);
  await page.locator('#main > .page-title h1').waitFor();
  await page.locator('[data-field="groupId"]').fill(`SYNTHETIC-${engine}`);
  await page.locator('[data-field="member1Name"]').fill('Synthetic Student');
  await page.locator('[data-field="member1Id"]').fill('000123');
  await go(page, 1);
  check(
    await page.locator('[data-field="design"]').isDisabled(),
    `${engine}: later answers initially locked`,
  );
  check(
    await page
      .locator('.gate-controls')
      .evaluate((el) => getComputedStyle(el).opacity === '1'),
    `${engine}: locked instructions keep full contrast`,
  );
  check(
    await page
      .locator('#main')
      .innerText()
      .then((t) => t.includes('Complete three runs')),
    `${engine}: locked instructions readable`,
  );
  await go(page, 3);
  check(
    await page.locator('[data-file="calibrationData"]').isDisabled(),
    `${engine}: later uploads locked`,
  );
  await go(page, 0);
  await attach(page, 'circuit', 'synthetic.png', image, 'image/png');
  await go(page, 1);
  check(
    await page.locator('[data-field="design"]').isDisabled(),
    `${engine}: photo alone does not unlock`,
  );
  await go(page, 0);
  await page.locator('[data-field="code"]').fill(syntheticCode);
  await page.locator('[data-field="code"]').scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(output, `${engine}-main-code.png`),
    animations: 'disabled',
  });
  check(
    (await page
      .locator(
        '#main [data-file="circuit2"],#main [data-file="circuit3"],#main [data-file="code"],#main [data-field="help"]',
      )
      .count()) === 0,
    `${engine}: only one photo upload and pasted code`,
  );

  check(
    (await page.locator('[data-field="code"]').inputValue()).includes(
      '<script>literal text</script>',
    ),
    `${engine}: code rendered literally`,
  );
  check(
    (await page.locator('#main script').count()) === 0,
    `${engine}: pasted code not executed`,
  );
  await go(page, 1);
  check(
    await page.locator('[data-field="design"]').isEnabled(),
    `${engine}: photograph and pasted code unlock editing`,
  );
  check(
    (await page.locator('[data-field="xVariable"]').inputValue()) === '' &&
      (await page.locator('[data-field="yVariable"]').inputValue()) === '',
    `${engine}: axis responses start blank`,
  );
  await page
    .locator('[data-field="xVariable"]')
    .fill('QA x: ruler distance (cm)');
  await page
    .locator('[data-field="yVariable"]')
    .fill('QA y: echo duration (µs)');
  check(
    (await page.locator('#main input,#main textarea').count()) === 3,
    `${engine}: Section 2 has three answer boxes`,
  );
  const desktopX = await page.locator('[data-field="xVariable"]').boundingBox(),
    desktopY = await page.locator('[data-field="yVariable"]').boundingBox();
  check(
    Math.abs(desktopX.y - desktopY.y) < 2 && desktopY.x > desktopX.x,
    `${engine}: axis fields sit side by side`,
  );
  await page
    .locator('[data-field="design"]')
    .fill('QA custom design: no assigned distances\n<literal student words>');
  check(
    (await page.locator('#main textarea').count()) === 1,
    `${engine}: Section 2 keeps one procedure textarea`,
  );
  check(
    (await page.locator('[data-field="design"]').getAttribute('rows')) === '5',
    `${engine}: procedure starts at five lines`,
  );
  check(
    await page
      .locator('[data-field="design"]')
      .evaluate((el) => getComputedStyle(el).resize === 'vertical'),
    `${engine}: procedure box can be resized`,
  );
  check(
    (await page
      .locator('#main h2,#main [data-uncertainty],#main .earlier-notes')
      .count()) === 0,
    `${engine}: no duplicate heading or empty old notes`,
  );
  await page.screenshot({
    path: path.join(output, `${engine}-procedure-desktop.png`),
    animations: 'disabled',
  });
  await saved(page);
  await page.reload();
  await page.locator('[data-field="design"]').waitFor();
  check(
    (await page.locator('[data-field="design"]').inputValue()) ===
      'QA custom design: no assigned distances\n<literal student words>',
    `${engine}: free procedure survives reload unchanged`,
  );
  check(
    (await page.locator('[data-field="xVariable"]').inputValue()) ===
      'QA x: ruler distance (cm)' &&
      (await page.locator('[data-field="yVariable"]').inputValue()) ===
        'QA y: echo duration (µs)',
    `${engine}: axis responses survive reload unchanged`,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileX = await page.locator('[data-field="xVariable"]').boundingBox(),
    mobileY = await page.locator('[data-field="yVariable"]').boundingBox();
  check(
    mobileY.y > mobileX.y && Math.abs(mobileX.x - mobileY.x) < 2,
    `${engine}: axis fields stack on mobile`,
  );

  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
    `${engine}: procedure fits mobile width`,
  );
  await page.screenshot({
    path: path.join(output, `${engine}-procedure-mobile.png`),
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 1512, height: 1000 });
  await go(page, 2);
  check(
    await page
      .locator('.csv-example img')
      .evaluate((img) => img.complete && img.naturalWidth > 0),
    `${engine}: CSV example image loads`,
  );
  check(
    (await page.locator('.csv-headings code').innerText()) ===
      'trial,condition,reference distance (cm),echo time (us),note',
    `${engine}: five-column CSV instructions`,
  );
  check(
    (await page.locator('.csv-example img').getAttribute('alt')).includes(
      'five columns',
    ),
    `${engine}: accessible five-column table image`,
  );
  check(
    (await page.locator('table').count()) === 0,
    `${engine}: no preset measurement table`,
  );
  await page.screenshot({
    path: path.join(output, `${engine}-csv-example-desktop.png`),
  });
  await go(page, 3);
  check(
    (await page.locator('#main math').count()) === 4,
    `${engine}: main lab shows mean, standard deviation, line and sensitivity equations`,
  );
  check(
    (await page
      .locator(
        '#main [data-field="uSlope"],#main [data-field="uIntercept"],#main [data-field="covariance"]',
      )
      .count()) === 0,
    `${engine}: parameter uncertainty fields are reserved for the post-lab`,
  );
  await attach(
    page,
    'calibrationData',
    'calibration.csv',
    syntheticCSV,
    'text/csv',
  );
  await attach(page, 'calibration', 'calibration.png', image, 'image/png');
  await page.locator('[data-field="slope"]').fill('still calculating?');
  check(
    (await page.locator('[data-field="slope"]').inputValue()) ===
      'still calculating?',
    `${engine}: invalid answer kept literally`,
  );
  check(
    (await page.locator('.field-warning').textContent()).includes('finite'),
    `${engine}: numeric guidance shown`,
  );
  check(
    await page
      .locator('math')
      .first()
      .evaluate((el) => el.getBoundingClientRect().height > 10),
    `${engine}: native formulas rendered`,
  );
  await page.locator('.equation').first().scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(output, `${engine}-main-calculations-desktop.png`),
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
    `${engine}: simplified calculation section fits mobile width`,
  );
  await page.locator('.equation').first().scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(output, `${engine}-main-calculations-mobile.png`),
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 1512, height: 1000 });
  // An incomplete or malformed source CSV is kept, rather than repaired or dropped.
  await attach(
    page,
    'calibrationData',
    'draft.csv',
    'wrong,headers\n"unclosed',
    'text/csv',
  );
  check(
    (
      await page.locator('[data-slot="calibrationData"] .notice').innerText()
    ).includes('unclosed'),
    `${engine}: malformed CSV guidance`,
  );
  const draft = await download(page, 'json');
  const draftValue = await files.parseFile(
    draft.bytes,
    'main',
    async () => true,
  );
  check(
    draftValue.files.calibrationData.text === 'wrong,headers\n"unclosed',
    `${engine}: malformed CSV retained in backup`,
  );
  await attach(
    page,
    'calibrationData',
    'calibration.csv',
    syntheticCSV,
    'text/csv',
  );
  await go(page, 4);
  await attach(
    page,
    'validationData',
    'validation.csv',
    syntheticCSV,
    'text/csv',
  );
  await page
    .locator('[data-field="validationWorking"]')
    .fill('QA validation calculations remain');
  await go(page, 5);
  await attach(
    page,
    'angleData',
    'angle.csv',
    syntheticCSV.replace('perpendicular', 'tilted'),
    'text/csv',
  );
  await attach(page, 'angle', 'angle.png', image, 'image/png');
  await page
    .locator('[data-field="anglePlan"]')
    .fill('QA: angle estimated; ruler point controlled');
  // Removing either first upload relocks later fields without deleting completed answers or CSV.
  await go(page, 0);
  await page.locator('[data-remove-file="circuit"]').click();
  await go(page, 1);
  check(
    await page.locator('[data-field="design"]').isDisabled(),
    `${engine}: removing photo relocks`,
  );
  check(
    (await page.locator('[data-field="design"]').inputValue()).includes(
      'QA custom design',
    ),
    `${engine}: answers retained while locked`,
  );
  await go(page, 3);
  check(
    await page.locator('[data-remove-file="calibrationData"]').isDisabled(),
    `${engine}: existing CSV retained while locked`,
  );
  await go(page, 0);
  await attach(page, 'circuit', 'another-view.png', image, 'image/png');
  await page.locator('[data-field="code"]').fill('');
  await go(page, 4);
  check(
    await page.locator('[data-field="validationWorking"]').isDisabled(),
    `${engine}: removing code relocks`,
  );
  await go(page, 0);
  await page.locator('[data-field="code"]').fill(syntheticCode);
  await go(page, 4);
  check(
    await page.locator('[data-field="validationWorking"]').isEnabled(),
    `${engine}: replacing code restores editing`,
  );
  await saved(page);
  await page.reload();
  await page.locator('#main > .page-title h1').waitFor();
  check(
    (await page.locator('[data-field="validationWorking"]').inputValue()) ===
      'QA validation calculations remain',
    `${engine}: autosave restores new workflow`,
  );
  await go(page, 6);
  const group = await download(page, 'zip');
  const parsed = await files.parseFile(group.bytes, 'main', async () => true);
  check(
    parsed.record.schemaVersion === 2 &&
      parsed.record.fields.member1Id === '000123',
    `${engine}: v2 export with literal ID`,
  );
  check(
    Buffer.compare(
      Buffer.from(await parsed.files.calibrationData.blob.arrayBuffer()),
      Buffer.from(syntheticCSV),
    ) === 0,
    `${engine}: CSV original bytes including BOM and extra columns`,
  );
  check(
    parsed.record.fields.code === syntheticCode,
    `${engine}: original code retained`,
  );
  check(
    Buffer.compare(
      Buffer.from(await parsed.files.circuit.blob.arrayBuffer()),
      image,
    ) === 0,
    `${engine}: photograph retained`,
  );
  const csvs = await download(page, 'csv');
  check(
    Buffer.from(csvs.bytes).subarray(0, 2).toString() === 'PK',
    `${engine}: original CSV download packaged`,
  );
  const fresh = await browser.newContext({ acceptDownloads: true }),
    recovered = await fresh.newPage();
  await recovered.goto(`${origin}/worksheets/sensor-calibration-main-lab.html`);
  await recovered.locator('#main > .page-title h1').waitFor();
  await importFile(recovered, group.filename, 'import', false);
  check(
    (await recovered.locator('[data-field="groupId"]').inputValue()) === '',
    `${engine}: cancelled import keeps draft`,
  );
  await importFile(recovered, group.filename, 'import');
  await go(recovered, 4);
  check(
    await recovered.locator('[data-field="validationWorking"]').isEnabled(),
    `${engine}: fresh restore includes prerequisites`,
  );
  check(
    (await recovered
      .locator('[data-field="validationWorking"]')
      .inputValue()) === 'QA validation calculations remain',
    `${engine}: fresh restore includes answers`,
  );
  await go(recovered, 1);
  check(
    (await recovered.locator('[data-field="xVariable"]').inputValue()) ===
      'QA x: ruler distance (cm)' &&
      (await recovered.locator('[data-field="yVariable"]').inputValue()) ===
        'QA y: echo duration (µs)',
    `${engine}: fresh backup restores axis responses`,
  );
  const earlier = await files.parseFile(group.bytes, 'main', async () => true);
  earlier.record.fields.origin = 'QA earlier reference point';
  earlier.record.uncertainty.origin.scope = 'QA earlier shared effect';
  const earlierPath = path.join(output, `${engine}-earlier-procedure.zip`);
  const archive = await import(
    pathToFileURL(path.resolve('activities/sensor-calibration/archive.js'))
  );
  const { zipSync } = await import('fflate');
  const oldEntries = Object.fromEntries(
    archive.readArchive(
      await files.createZip('main', earlier.record, earlier.files),
    ),
  );
  const oldManifest = JSON.parse(
    new TextDecoder().decode(oldEntries['workbook.json']),
  );
  delete oldManifest.record.fields.xVariable;
  delete oldManifest.record.fields.yVariable;
  oldEntries['workbook.json'] = new TextEncoder().encode(
    JSON.stringify(oldManifest),
  );
  await fs.writeFile(earlierPath, zipSync(oldEntries, { level: 0 }));
  await importFile(recovered, earlierPath, 'import');
  await go(recovered, 1);
  check(
    (await recovered.locator('[data-field="xVariable"]').inputValue()) === '' &&
      (await recovered.locator('[data-field="yVariable"]').inputValue()) === '',
    `${engine}: older backup restores with blank axis fields`,
  );
  check(
    (await recovered.locator('#main textarea').count()) === 1,
    `${engine}: restored old notes do not add editable boxes`,
  );
  check(
    (await recovered.locator('.earlier-notes').getAttribute('open')) === null,
    `${engine}: earlier notes start collapsed`,
  );
  await recovered.locator('.earlier-notes > summary').click();
  check(
    (await recovered.locator('.earlier-notes').innerText()).includes(
      'QA earlier shared effect',
    ),
    `${engine}: earlier notes remain readable`,
  );
  check(
    (await recovered
      .locator(
        '.earlier-notes input,.earlier-notes textarea,.earlier-notes select',
      )
      .count()) === 0,
    `${engine}: earlier notes are read-only`,
  );
  const earlierBackup = await download(recovered, 'json');
  const earlierRestored = await files.parseFile(
    earlierBackup.bytes,
    'main',
    async () => true,
  );
  check(
    earlierRestored.record.fields.origin === 'QA earlier reference point' &&
      earlierRestored.record.uncertainty.origin.scope ===
        'QA earlier shared effect',
    `${engine}: older notes survive another backup`,
  );
  await saved(recovered);
  await fresh.close();
  await page.setViewportSize({ width: 390, height: 844 });
  await go(page, 2);
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
    `${engine}: mobile page width`,
  );
  check(
    await page
      .locator('.csv-example')
      .evaluate((el) => el.scrollWidth > el.clientWidth),
    `${engine}: CSV image scrolls inside page`,
  );
  await page.screenshot({
    path: path.join(output, `${engine}-main-mobile.png`),
  });
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.emulateMedia({ media: 'print' });
  check(
    (await page.locator('#report .report-section').count()) === 7,
    `${engine}: all main sections print`,
  );
  check(
    (await page
      .locator('#report input,#report textarea,#report select')
      .count()) === 0,
    `${engine}: main print read-only`,
  );
  check(
    (await page.locator('#report').innerText()).includes(syntheticCode),
    `${engine}: printed code complete`,
  );
  if (engine === 'chromium')
    await page.pdf({
      path: path.join(output, 'main-report.synthetic.pdf'),
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });
  await page.emulateMedia({ media: 'screen' });
  await saved(page);
  check(errors.length === 0, `${engine}: no main errors: ${errors.join(', ')}`);
  await context.close();
  return group;
}
async function postJourney(browser, engine, group, model, files) {
  const context = await browser.newContext({
      viewport: { width: 1512, height: 1000 },
      acceptDownloads: true,
    }),
    page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${origin}/worksheets/sensor-calibration-post-lab.html`);
  await page.locator('[data-field="name"]').waitFor();
  await page.locator('[data-field="name"]').fill('Synthetic Student');
  await page.locator('[data-field="studentId"]').fill('000123');
  await importFile(page, group.filename, 'source');
  check(
    (await page
      .locator('#main [data-slot="calibrationData"] [data-file]')
      .count()) === 0,
    `${engine}: source CSV has no editing controls`,
  );
  check(
    (await page.locator('#main [data-uncertainty]').count()) === 0,
    `${engine}: source reference notes read-only`,
  );
  check(
    (await page
      .locator('#main .earlier-notes,#main .print-uncertainty')
      .count()) === 0,
    `${engine}: source omits empty retired notes`,
  );
  await go(page, 2);
  check(
    (await page
      .locator(
        '#main [data-field="uSlope"],#main [data-field="uIntercept"],#main [data-field="covariance"]',
      )
      .count()) === 3,
    `${engine}: individual post-lab requires both coefficient uncertainties and covariance`,
  );
  await page.locator('[data-field="covariance"]').fill('-0.125');
  await page
    .locator('[data-field="fitWorking"]')
    .fill('QA own calculations\n<literal>');
  await attach(page, 'calibration', 'own-plot.png', image, 'image/png');
  await attach(page, 'residuals', 'residuals.png', image, 'image/png');
  await page.screenshot({
    path: path.join(output, `${engine}-post-equations.png`),
  });
  await go(page, 6);
  check(
    (await page.locator('math').count()) >= 4,
    `${engine}: propagation equations available`,
  );
  await page
    .locator('[data-field="propagationWorking"]')
    .fill('QA covariance and shared-reference model');
  await go(page, 7);
  await page
    .locator('[data-field="angleDiscussion"]')
    .fill('QA tilted/returned comparison');
  await attach(page, 'angle', 'own-angle.png', image, 'image/png');
  const parsedGroup = await files.parseFile(
    group.bytes,
    'main',
    async () => true,
  );
  parsedGroup.record.fields.groupId = 'QA REPLACED GROUP';
  const replacement = path.join(output, `${engine}-replacement.zip`);
  await fs.writeFile(
    replacement,
    await files.createZip('main', parsedGroup.record, parsedGroup.files),
  );
  await go(page, 0);
  await importFile(page, replacement, 'source');
  check(
    (await page.locator('#main .notice').innerText()).includes(
      'answers and attachments',
    ),
    `${engine}: replacing source requests review`,
  );
  await go(page, 2);
  check(
    (await page.locator('[data-field="fitWorking"]').inputValue()) ===
      'QA own calculations\n<literal>',
    `${engine}: replacing source preserves own writing`,
  );
  check(
    (await page.locator('[data-remove-file="residuals"]').count()) === 1,
    `${engine}: replacing source preserves graphs`,
  );
  await go(page, 8);
  const conclusionLabel = model.labels('post').conclusion,
    helpLabel = model.labels('post').help;
  check(
    (await page.locator('.review li').allTextContents()).includes(
      conclusionLabel,
    ),
    `${engine}: blank final conclusion is listed as missing`,
  );
  await page
    .locator('[data-field="conclusion"]')
    .fill('QA final conclusion\n<literal>');
  check(
    !(await page.locator('.review li').allTextContents()).includes(
      conclusionLabel,
    ),
    `${engine}: typing final conclusion immediately clears its missing entry`,
  );
  check(
    await page
      .locator('[data-field="conclusion"]')
      .evaluate((el) => el === document.activeElement),
    `${engine}: refreshing completion keeps the answer focused`,
  );
  await page.locator('[data-field="conclusion"]').fill('');
  check(
    (await page.locator('.review li').allTextContents()).includes(
      conclusionLabel,
    ),
    `${engine}: clearing the conclusion immediately restores its missing entry`,
  );
  await page
    .locator('[data-field="conclusion"]')
    .fill('QA final conclusion\n<literal>');
  await page.locator('[data-field="help"]').fill('QA test software only');
  check(
    !(await page.locator('.review li').allTextContents()).includes(helpLabel),
    `${engine}: typing help disclosure immediately clears its missing entry`,
  );
  const individual = await download(page, 'zip'),
    parsed = await files.parseFile(individual.bytes, 'post', async () => true);
  check(parsed.record.needsReview, `${engine}: review flag retained`);
  check(
    parsed.record.fields.covariance === '-0.125',
    `${engine}: coefficient text retained`,
  );
  check(
    parsed.record.fields.conclusion === 'QA final conclusion\n<literal>' &&
      parsed.record.fields.help === 'QA test software only',
    `${engine}: immediate download retains final answers after completion refresh`,
  );
  check(
    parsed.parsedSource.record.fields.groupId === 'QA REPLACED GROUP',
    `${engine}: replacement source exported`,
  );
  check(
    Buffer.compare(
      Buffer.from(parsed.source.bytes),
      await fs.readFile(replacement),
    ) === 0,
    `${engine}: exact group source bytes`,
  );
  const fresh = await browser.newContext({ acceptDownloads: true }),
    recovered = await fresh.newPage();
  await recovered.goto(`${origin}/worksheets/sensor-calibration-post-lab.html`);
  await recovered.locator('[data-field="name"]').waitFor();
  await importFile(recovered, individual.filename, 'import');
  await go(recovered, 2);
  check(
    (await recovered.locator('[data-field="fitWorking"]').inputValue()) ===
      'QA own calculations\n<literal>',
    `${engine}: fresh individual restore`,
  );
  check(
    (await recovered.locator('[data-remove-file="residuals"]').count()) === 1,
    `${engine}: fresh individual restores graph`,
  );
  await go(recovered, 8);
  await recovered.locator('[data-action="reviewed"]').check();
  check(
    !(await recovered.locator('.review li').allTextContents()).includes(
      'Check your answers against the replacement group file.',
    ),
    `${engine}: confirming replacement-source review immediately clears the reminder`,
  );
  await saved(recovered);
  await fresh.close();
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.emulateMedia({ media: 'print' });
  check(
    (await page.locator('#report .report-section').count()) === 9,
    `${engine}: post report has all sections`,
  );
  check(
    (await page
      .locator('#report input,#report textarea,#report select')
      .count()) === 0,
    `${engine}: post report read-only`,
  );
  if (engine === 'chromium')
    await page.pdf({
      path: path.join(output, 'post-report.synthetic.pdf'),
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });
  await page.emulateMedia({ media: 'screen' });
  await saved(page);
  check(errors.length === 0, `${engine}: no post errors: ${errors.join(', ')}`);
  await context.close();
}
async function legacyJourney(browser, engine, legacyModel, legacyFiles, files) {
  const context = await browser.newContext({ acceptDownloads: true }),
    page = await context.newPage();
  await page.goto(`${origin}/worksheets/sensor-calibration-main-lab.html`);
  await page.locator('[data-field="groupId"]').fill('QA VERSION TWO SURVIVES');
  await saved(page);
  const old = legacyModel.createRecord('main');
  old.fields.groupId = 'QA OLDER WORK';
  old.measurements[0].readings[0].value = 'old literal';
  await page.evaluate(async (record) => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('electronics-sensor-calibration-main-v1', 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('workbooks'))
          req.result.createObjectStore('workbooks');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction('workbooks', 'readwrite');
      tx.objectStore('workbooks').put(
        { record, files: {}, source: null },
        'active',
      );
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
    db.close();
  }, old);
  await page.reload();
  await page.locator('[data-field="groupId"]').waitFor();
  await page.locator('#save-menu-button').click();
  check(
    await page.locator('#legacy-recovery').isVisible(),
    `${engine}: detects version-one browser work`,
  );
  await page.locator('#legacy-recovery').click();
  await page.locator('#dialog[open]').waitFor();
  check(
    (await page.locator('#dialog input,#dialog textarea').count()) === 0,
    `${engine}: legacy recovery read-only`,
  );
  const waiting = page.waitForEvent('download');
  await page.locator('#dialog-confirm').click();
  const d = await waiting,
    name = path.join(output, `${engine}-legacy-recovery.zip`);
  await d.saveAs(name);
  const restored = await files.parseFile(
    new Uint8Array(await fs.readFile(name)),
    'main',
    async () => true,
  );
  check(
    restored.legacy &&
      restored.record.measurements[0].readings[0].value === 'old literal',
    `${engine}: legacy recovery preserves data`,
  );
  check(
    (await page.locator('[data-field="groupId"]').inputValue()) ===
      'QA VERSION TWO SURVIVES',
    `${engine}: recovery does not replace v2`,
  );
  await page.reload();
  await page.locator('[data-field="groupId"]').waitFor();
  await page.locator('#save-menu-button').click();
  check(
    await page.locator('#legacy-recovery').isVisible(),
    `${engine}: original v1 save remains`,
  );
  await page.locator('#save-menu-button').click();
  await importFile(page, name, 'import', false);
  check(
    (await page.locator('[data-field="groupId"]').inputValue()) ===
      'QA VERSION TWO SURVIVES',
    `${engine}: v1 import stays in recovery`,
  );
  await context.close();
}
async function unavailableStorage(browser, engine) {
  const context = await browser.newContext({ acceptDownloads: true });
  await context.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      get() {
        throw new Error('Synthetic storage denial');
      },
    });
  });
  const page = await context.newPage();
  await page.goto(`${origin}/worksheets/sensor-calibration-main-lab.html`);
  await page.locator('#main > .page-title h1').waitFor();
  check(
    await page.locator('#storage-warning').isVisible(),
    `${engine}: unavailable-storage notice`,
  );
  await page.locator('[data-field="groupId"]').fill('QA session survives');
  const draft = await download(page, 'json'),
    value = JSON.parse(Buffer.from(draft.bytes).toString());
  check(
    value.record.fields.groupId === 'QA session survives',
    `${engine}: download works without storage`,
  );
  page.on('dialog', (d) => d.accept());
  await context.close();
}
async function quotaRecovery(browser, engine) {
  const context = await browser.newContext({ acceptDownloads: true });
  await context.addInitScript(() => {
    window.qaOriginalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function () {
      throw new DOMException(
        'Synthetic QA quota failure',
        'QuotaExceededError',
      );
    };
  });
  const page = await context.newPage();
  await page.goto(`${origin}/worksheets/sensor-calibration-main-lab.html`);
  await page.locator('[data-field="groupId"]').fill('QA WRITE FAILURE');
  await page.waitForFunction(() =>
    document
      .getElementById('storage-warning')
      .textContent.includes('autosave is unavailable'),
  );
  const backup = await download(page, 'json');
  check(
    JSON.parse(Buffer.from(backup.bytes).toString()).record.fields.groupId ===
      'QA WRITE FAILURE',
    `${engine}: quota failure keeps downloadable work`,
  );
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = window.qaOriginalPut;
  });
  await page.locator('#save-menu-button').click();
  await page.locator('[data-action="save"]').click();
  await page.locator('#dialog[open]').waitFor();
  await page.locator('#dialog-confirm').click();
  await saved(page);
  check(
    await page.locator('#storage-warning').isHidden(),
    `${engine}: retry clears storage warning`,
  );
  // Avoid reinstalling the deliberate failure on reload.
  await context.close();
}
// Compare the actual worksheet template, rather than a separately invented palette.
async function templateStyles(surface) {
  return surface.evaluate(() => {
    const sample = (selector, props) => {
      const style = getComputedStyle(document.querySelector(selector));
      return Object.fromEntries(props.map((key) => [key, style[key]]));
    };
    return {
      root: sample('html', [
        'fontFamily',
        'fontSize',
        'lineHeight',
        'backgroundColor',
        'color',
      ]),
      sidebar: sample('#sidebar', ['width', 'backgroundColor']),
      brand: sample('.brand', ['padding', 'display']),
      header: sample('.topbar', ['height', 'padding', 'backgroundColor']),
      menu: sample('#menu-button', ['display', 'fontSize', 'padding']),
      label: sample('#main .field label', [
        'fontSize',
        'fontWeight',
        'lineHeight',
        'marginBottom',
      ]),
      title: sample('h1', ['fontSize', 'lineHeight']),
      leadin: sample('.leadin', ['fontSize', 'color', 'maxWidth']),
      content: sample('#main', ['padding', 'maxWidth']),
      paper: sample('.paper', [
        'padding',
        'borderRadius',
        'backgroundColor',
        'borderColor',
      ]),
      input: sample('#main input[type="text"]', [
        'fontFamily',
        'fontSize',
        'padding',
        'borderRadius',
        'borderColor',
      ]),
      footer: sample('footer', ['minHeight', 'padding', 'backgroundColor']),
      save: sample('#save-menu-button', [
        'fontSize',
        'padding',
        'borderRadius',
      ]),
    };
  });
}
async function hostedJourney(browser, engine) {
  const context = await browser.newContext({
    viewport: { width: 1512, height: 1000 },
    acceptDownloads: true,
  });
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const reference = await context.newPage();
  await reference.goto(`${origin}/worksheets/555-main-lab.html`);
  await reference.locator('.screen-head').waitFor();
  const expected = await templateStyles(reference);
  await page.goto(`${origin}/sensor-calibration/main-lab`);
  await page.locator('.calibration-workspace[data-status="ready"]').waitFor();
  let frame = await (
    await page.locator('.calibration-workspace-frame').elementHandle()
  ).contentFrame();
  check(
    (await page.getByRole('banner').count()) === 0,
    `${engine}: no second site header above the worksheet`,
  );
  check(
    await frame.locator('.brand').isVisible(),
    `${engine}: original worksheet branding visible`,
  );
  check(
    await page
      .locator('iframe')
      .evaluate((el) => el.getBoundingClientRect().height === innerHeight),
    `${engine}: worksheet fills the browser view`,
  );
  assert.deepEqual(await templateStyles(frame), expected);
  checks++;
  check(
    (await frame.locator('#steps small').count()) === 7,
    `${engine}: template section descriptions`,
  );
  check(
    (await frame.locator('#breadcrumb').innerText()) ===
      'Build and document your system.',
    `${engine}: current section below workbook title`,
  );
  await page.screenshot({
    path: path.join(output, `${engine}-hosted-desktop.png`),
    animations: 'disabled',
  });
  await frame.locator('[data-field="groupId"]').fill(`HOSTED-QA-${engine}`);
  // A template link must flush a pending save before leaving the full-view worksheet.
  await frame.locator('.brand').click();
  await page.waitForURL(`${origin}/sensor-calibration`);
  await page.getByRole('link', { name: /Open group main lab/ }).click();
  await page.locator('.calibration-workspace[data-status="ready"]').waitFor();
  frame = await (
    await page.locator('.calibration-workspace-frame').elementHandle()
  ).contentFrame();
  check(
    (await frame.locator('[data-field="groupId"]').inputValue()) ===
      `HOSTED-QA-${engine}`,
    `${engine}: template navigation preserves last edit`,
  );
  await go(frame, 2);
  check(
    (await frame.locator('#screen-count').innerText()) === '3 / 7',
    `${engine}: section counter`,
  );
  check(
    (await frame.locator('#steps [data-page="0"] .step-number').innerText()) ===
      '✓',
    `${engine}: opened page indicator`,
  );
  check(
    (await frame.locator('#steps [data-page="2"] .step-number').innerText()) ===
      '●',
    `${engine}: active page indicator`,
  );
  await frame.evaluate(() => {
    window.print = () => {
      window.dispatchEvent(new Event('beforeprint'));
      window.qaPrinted = true;
    };
  });
  await frame.locator('#save-menu-button').click();
  await frame.locator('#save-menu [data-action="print"]').click();
  await frame.waitForFunction(() => window.qaPrinted);
  check(
    (await frame.locator('#report .report-section').count()) === 7,
    `${engine}: template save menu prints complete report`,
  );
  await go(frame, 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await reference.setViewportSize({ width: 390, height: 844 });
  assert.deepEqual(
    await templateStyles(frame),
    await templateStyles(reference),
  );
  checks++;
  await frame.locator('#menu-button').click();
  check(
    await frame
      .locator('#close-navigation')
      .evaluate((el) => el === document.activeElement),
    `${engine}: drawer initial focus`,
  );
  check(
    await frame.locator('.frame').evaluate((el) => el.hasAttribute('inert')),
    `${engine}: drawer contains background focus`,
  );
  await page.keyboard.press('Shift+Tab');
  check(
    await frame
      .locator('.brand')
      .evaluate((el) => el === document.activeElement),
    `${engine}: drawer includes worksheet return link`,
  );
  await page.keyboard.press('Shift+Tab');
  check(
    await frame
      .locator('#steps [data-page="6"]')
      .evaluate((el) => el === document.activeElement),
    `${engine}: drawer wraps keyboard focus`,
  );
  await page.keyboard.press('Escape');
  check(
    await frame
      .locator('#menu-button')
      .evaluate((el) => el === document.activeElement),
    `${engine}: Escape restores drawer trigger`,
  );
  await frame.locator('#save-menu-button').click();
  check(
    await frame.locator('#save-menu').isVisible(),
    `${engine}: mobile save menu opens`,
  );
  await page.keyboard.press('Escape');
  check(
    await frame.locator('#save-menu').isHidden(),
    `${engine}: Escape closes save menu`,
  );
  await page.screenshot({
    path: path.join(output, `${engine}-hosted-mobile.png`),
    animations: 'disabled',
  });
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
    `${engine}: full-view mobile width`,
  );
  await saved(frame);
  await page.goto(`${origin}/worksheets/sensor-calibration-main-lab.html`);
  await go(page, 0);
  check(
    (await page.locator('[data-field="groupId"]').inputValue()) ===
      `HOSTED-QA-${engine}`,
    `${engine}: original document has the same saved work`,
  );
  await saved(page);
  await page.goto(`${origin}/sensor-calibration/post-lab`);
  await page.locator('.calibration-workspace[data-status="ready"]').waitFor();
  frame = await (
    await page.locator('.calibration-workspace-frame').elementHandle()
  ).contentFrame();
  check(
    await frame.locator('.brand').isVisible(),
    `${engine}: individual worksheet uses the same light template`,
  );
  check(
    (await frame
      .locator('html')
      .evaluate((el) => getComputedStyle(el).backgroundColor)) ===
      'rgb(244, 246, 243)',
    `${engine}: individual worksheet light background`,
  );
  check(
    (await frame.locator('#steps small').count()) === 9,
    `${engine}: individual section descriptions`,
  );
  await page.setViewportSize({ width: 1512, height: 1000 });
  await page.screenshot({
    path: path.join(output, `${engine}-hosted-post-desktop.png`),
    animations: 'disabled',
  });
  check(
    errors.length === 0,
    `${engine}: no hosted page errors: ${errors.join(', ')}`,
  );
  await context.close();
}
(async () => {
  await fs.mkdir(output, { recursive: true });
  const model = await import(
      pathToFileURL(path.resolve('activities/sensor-calibration/model.js'))
    ),
    files = await import(
      pathToFileURL(path.resolve('activities/sensor-calibration/files.js'))
    );
  const legacyModel = await import(
      pathToFileURL(
        path.resolve('activities/sensor-calibration/legacy/model.js'),
      )
    ),
    legacyFiles = await import(
      pathToFileURL(
        path.resolve('activities/sensor-calibration/legacy/files.js'),
      )
    );
  for (const engine of engines) {
    const browser = await { chromium, firefox, webkit }[engine].launch({
      headless: true,
    });
    try {
      const group = await mainJourney(browser, engine, model, files);
      await postJourney(browser, engine, group, model, files);
      await legacyJourney(browser, engine, legacyModel, legacyFiles, files);
      await unavailableStorage(browser, engine);
      await quotaRecovery(browser, engine);
      await hostedJourney(browser, engine);
      console.log(
        `${engine}: redesigned group / individual / recovery / responsive / print / storage journeys passed`,
      );
    } finally {
      await browser.close();
    }
  }
  await fs.writeFile(
    path.join(output, 'results.json'),
    JSON.stringify({ syntheticOnly: true, engines, checks }, null, 2),
  );
  console.log(`${checks} browser checks passed.`);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
