/* Synthetic, isolated student journey. Does not touch the user's workbook storage. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { unzipSync } = require('fflate');
const base = process.env.APP_URL || 'http://127.0.0.1:4184';
const url = base + '/worksheets/noise-filtering-post-lab.html';
const output = path.resolve('output/playwright/noise-post-lab');
let checks = 0;
function check(value, name) { assert(value, name); checks++; }
async function ready(page) { await page.waitForFunction(() => !document.querySelector('#workbook').inert); }
async function go(page, n) {
  if (await page.locator('#menu-button').isVisible()) await page.locator('#menu-button').click();
  await page.locator(`[data-step="${n}"]`).click();
  await page.waitForFunction(() => !document.querySelector('.frame').inert);
  if (await page.locator('#menu-button').isVisible()) await page.waitForFunction(() => document.querySelector('#sidebar').getBoundingClientRect().right <= 1);
  check((await page.locator('#screen-count').innerText()) === `${n + 1} / 5`, 'Five-section navigation');
}
async function action(page, name) {
  if (!(await page.locator('#save-menu').isVisible())) await page.locator('#save-menu-button').click();
  await page.locator(`#save-menu [data-action="${name}"]`).click();
}
async function download(page, name) {
  const wait = page.waitForEvent('download'); await action(page, name); const file = await wait;
  return fs.readFile(await file.path());
}
async function source(page, kind, buffer, confirm = true) {
  await page.locator(`[data-source="${kind}"]`).click();
  await page.locator('#source-file').setInputFiles({ name: `${kind}.zip`, mimeType: 'application/zip', buffer: Buffer.from(buffer) });
  await page.locator('#confirm-source').waitFor();
  await page.locator(confirm ? '#confirm-source' : '#cancel-source').click();
}
async function restore(page, bytes, confirm = true) {
  const filename = path.join(output, 'synthetic-individual-restore.zip');
  await fs.writeFile(filename, bytes);
  await page.locator('#import-file').setInputFiles([]);
  await page.locator('#import-file').setInputFiles(filename);
  await page.locator('#confirm-import').waitFor();
  await page.locator(confirm ? '#confirm-import' : '#cancel-import').click();
}
(async () => {
  await fs.mkdir(output, { recursive: true });
  const { fixtures } = await import(pathToFileURL(path.resolve('tests/fixtures/noise-post-lab.mjs')));
  const f = await fixtures();
  const browser = await chromium.launch({ headless: true });
  const contexts = [];
  const make = async (opts = {}) => { const c = await browser.newContext(opts); contexts.push(c); return c; };
  try {
    const context = await make({ viewport: { width: 1456, height: 853 } }), page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await context.addInitScript(() => { window.print = () => { window.__printCalled = true; }; });
    await page.goto(url); await ready(page);
    check((await page.locator('h1').innerText()) === 'Load Your Lab Files', 'Direct document loading');
    await page.evaluate(() => { for (const key of ['electronics-noise-filtering-main-lab-v4', '2145427-W12-prelab-20261026-impl-v1', 'electronics-555-main-lab-v3']) localStorage.setItem(key, 'unchanged-sentinel'); });
    const incomplete = await download(page, 'zip');
    check(Object.keys(unzipSync(incomplete)).includes('post_lab_backup.json'), 'Unfinished work downloads');
    await source(page, 'main', f.main, false);
    check(await page.locator('[data-original="main"]').count() === 0, 'Cancelled import leaves source empty');
    await source(page, 'main', f.main);
    await source(page, 'prelab', f.prelab);
    check(await page.locator('[data-field="name"]').inputValue() === f.pre.student.name, 'Personal identity prefilled');
    check(await page.locator('#identity-confirm').isEnabled(), 'Group optional IDs do not block individual confirmation');
    await page.locator('#identity-confirm').check();
    check(!await page.evaluate(() => window.__injected), 'Imported strings never execute');
    for (let n = 1; n < 5; n++) {
      await go(page, n);
      if (n === 1) {
        check(await page.locator('[data-field="cutoff"]').inputValue() === '', 'Calculated answers are left for the student');
        check((await page.locator('[data-field="cutoff"]').boundingBox()).width <= 220, 'Single-value box is compact');
        check(await page.locator('math').count() >= 5, 'RC and attenuation equations typeset');
        await page.screenshot({ path: path.join(output, 'rc-results.png') });
      }
      if (n === 2) {
        check(await page.locator('textarea').count() === 1, 'One substantial pulse discussion area');
        check(await page.evaluate(() => document.querySelector('.source-image').compareDocumentPosition(document.querySelector('[data-field="pulses"]')) & Node.DOCUMENT_POSITION_FOLLOWING), 'Screenshot precedes discussion');
        await page.locator('[data-field="pulses"]').fill('Individual pulse interpretation <script>literal only</script>');
        await page.locator('h2').filter({ hasText: 'Discuss the useful pulses' }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, 'pulse-discussion.png') });
      }
      if (n === 3) {
        check(await page.locator('.code-preview').last().textContent() === f.record.fields['code.processing'], 'Long code is shown literally');
        check((await page.locator('#main').innerText()).includes(f.pre.responses.p2revision), 'Personal EMA revision shown');
      }
      const controls = page.locator('#main [data-field]');
      for (let i = 0; i < await controls.count(); i++) if (!(await controls.nth(i).inputValue())) await controls.nth(i).fill('Synthetic individual calculation or explanation');
    }
    await action(page, 'save');
    await page.waitForFunction(() => document.querySelector('#save-status').textContent.includes('work saved'));
    await page.reload(); await ready(page);
    check((await page.locator('[data-field="recommendation"]').inputValue()).includes('Synthetic'), 'Answers reload from browser storage');
    const final = await download(page, 'zip'), json = await download(page, 'export');
    const parts = unzipSync(final), backup = JSON.parse(Buffer.from(parts['post_lab_backup.json']).toString());
    check(Buffer.from(parts['sources/group_main_lab.zip']).equals(Buffer.from(f.main)), 'Original main ZIP bytes intact');
    check(Buffer.from(parts['sources/individual_pre_lab.zip']).equals(Buffer.from(f.prelab)), 'Original pre-lab ZIP bytes intact');
    check(backup.record.fields.pulses.includes('<script>literal'), 'Literal writing saved exactly');
    check(!await page.evaluate(() => window.__injected), 'No imported code execution after all sections');
    await action(page, 'print');
    await page.waitForFunction(() => window.__printCalled === true);
    check(await page.evaluate(() => window.__printCalled), 'Print action opens report');
    check(await page.locator('#report math').count() >= 7, 'Report equations typeset');
    check(await page.locator('#report img').count() === 4, 'Analysis screenshots included in report');
    check(await page.locator('#report textarea').count() === 0, 'Report renders written answers');
    await page.emulateMedia({ media: 'print' });
    await page.locator('#report .display-equation').first().screenshot({ path: path.join(output, 'report-equation.png') });
    await page.pdf({ path: path.join(output, 'report-preview.pdf'), format: 'A4', pageRanges: '1-4' });
    await page.emulateMedia({ media: 'screen' });
    const fresh = await make(), freshPage = await fresh.newPage(); await freshPage.goto(url); await ready(freshPage);
    await restore(freshPage, final, false);
    check(await freshPage.locator('[data-field="name"]').inputValue() === '', 'Cancelled restore leaves answers unchanged');
    await restore(freshPage, final);
    check((await freshPage.locator('[data-field="recommendation"]').inputValue()).includes('Synthetic'), 'Fresh browser ZIP restoration');
    await go(freshPage, 2); check((await freshPage.locator('[data-field="pulses"]').inputValue()).includes('<script>literal'), 'Individual writing restored literally');
    await go(freshPage, 0); await source(freshPage, 'main', f.main);
    check((await freshPage.locator('.review-notice').innerText()).includes('replaced'), 'Source replacement marks review');
    await go(freshPage, 2); check((await freshPage.locator('[data-field="pulses"]').inputValue()).includes('Individual pulse'), 'Source replacement keeps writing');
    await go(freshPage, 4); await freshPage.locator('#review-confirm').check(); check(await freshPage.locator('.review-notice').count() === 0, 'Review confirmation clears reminder');
    await freshPage.locator('#import-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{bad') });
    await freshPage.locator('#toast').filter({ hasText: 'not readable' }).waitFor();
    check((await freshPage.locator('[data-field="recommendation"]').inputValue()).includes('Synthetic'), 'Invalid restore leaves writing unchanged');
    await go(freshPage, 0); await freshPage.locator('[data-source="prelab"]').click();
    await freshPage.locator('#source-file').setInputFiles({ name: 'wrong.zip', mimeType: 'application/zip', buffer: Buffer.from(f.main) });
    await freshPage.locator('#toast').filter({ hasText: 'pre-lab ZIP' }).waitFor();
    check(await freshPage.locator('[data-original="prelab"]').count() === 1, 'Wrong source type leaves prior source intact');
    // JSON recovery, identity, keyboard, and responsive behavior in an independent mobile context.
    const phone = await make({ viewport: { width: 390, height: 844 } }), mobile = await phone.newPage(); await mobile.goto(url); await ready(mobile);
    await restore(mobile, json);
    await go(mobile, 0); await mobile.screenshot({ path: path.join(output, 'phone-imports.png'), fullPage: true });
    for (const n of [1, 2, 3, 4]) {
      await go(mobile, n);
      check(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Phone section ${n + 1} has no page overflow`);
    }
    await mobile.locator('#menu-button').focus(); await mobile.keyboard.press('Enter');
    await mobile.keyboard.press('Escape'); check(await mobile.locator('#menu-button').evaluate(el => el === document.activeElement), 'Keyboard closes navigation and returns focus');
    const denied = await make(); await denied.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { get() { throw new Error('unavailable'); } }); });
    const failure = await denied.newPage(); await failure.goto(url); await ready(failure);
    check((await failure.locator('#save-status').innerText()).includes('unavailable'), 'Unavailable browser storage explained');
    await source(failure, 'main', f.main); await source(failure, 'prelab', f.prelab);
    await failure.locator('[data-field="name"]').fill('Storage failure session');
    const recovered = JSON.parse((await download(failure, 'export')).toString());
    check(recovered.record.fields.name === 'Storage failure session' && recovered.files.length === 2, 'Storage failure still permits full source-and-answer download');
    const corruptContext = await make(), corrupt = await corruptContext.newPage();
    await corrupt.goto(url); await ready(corrupt); await action(corrupt, 'save');
    await corrupt.waitForFunction(() => document.querySelector('#save-status').textContent.includes('work saved'));
    await corrupt.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('electronics-noise-filtering-post-lab-files-v1', 1);
      request.onsuccess = () => {
        const db = request.result, transaction = db.transaction('workbooks', 'readwrite');
        transaction.objectStore('workbooks').put({ record: { schemaVersion: 99, original: 'keep me' }, sources: {} }, 'electronics-noise-filtering-post-lab-v1');
        transaction.oncomplete = () => { db.close(); resolve(); }; transaction.onerror = () => reject(transaction.error);
      };
    }));
    await corrupt.reload(); await ready(corrupt);
    check((await corrupt.locator('#save-status').innerText()).includes('could not be opened'), 'Malformed stored record pauses saving');
    await corrupt.locator('[data-field="name"]').fill('Session still usable');
    const recoveryWait = corrupt.waitForEvent('download'); await action(corrupt, 'recover');
    const recoveryFile = await recoveryWait;
    const recoveryData = JSON.parse((await fs.readFile(await recoveryFile.path())).toString());
    check(recoveryData.record.original === 'keep me', 'Unreadable saved record remains downloadable');
    await page.evaluate(() => { window.__otherUnchanged = ['electronics-noise-filtering-main-lab-v4', '2145427-W12-prelab-20261026-impl-v1', 'electronics-555-main-lab-v3'].every(k => localStorage.getItem(k) === 'unchanged-sentinel'); });
    check(await page.evaluate(() => window.__otherUnchanged), 'Existing workbook namespaces unchanged');
    await go(page, 0); await page.screenshot({ path: path.join(output, 'desktop-imports.png'), fullPage: true });
    await action(page, 'new'); await page.locator('#cancel-new').click(); check(await page.locator('[data-original="main"]').count() === 1, 'Cancelled new-workbook action keeps sources');
    await action(page, 'new'); await page.locator('#confirm-new').click(); check(await page.locator('[data-original="main"]').count() === 0, 'New workbook resets only post-lab');
    await page.goto(base + '/noise-and-filtering'); check(await page.locator('a[href="/worksheets/noise-filtering-post-lab.html"]').count() > 0, 'Topic links post-lab document');
    await page.goto(base + '/resources'); check(await page.locator('a[href="/worksheets/noise-filtering-post-lab.html"]').count() > 0, 'Resources link post-lab document');
    check(errors.length === 0, `No runtime errors: ${errors.join(', ')}`);
    console.log(`${checks} Noise post-lab browser checks passed.`);
  } finally { for (const c of contexts) await c.close(); await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
