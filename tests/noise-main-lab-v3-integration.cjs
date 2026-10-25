/* Isolated synthetic student journey. No hardware measurements or external writes. */
const playwright = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { unzipSync } = require('fflate');
const { pathToFileURL } = require('node:url');
const origin = process.env.APP_URL || 'http://127.0.0.1:4184';
const url = origin + '/worksheets/noise-filtering-main-lab-v3.html';
const output = path.resolve('output/playwright/noise-main-lab-v3');
const key = 'electronics-noise-filtering-main-lab-v3';
const otherKeys = ['electronics-noise-filtering-main-lab-v2', 'electronics-noise-filtering-main-lab-v1', '2145427-W12-prelab-20261026-impl-v1', 'electronics-555-main-lab-v3'];
const results = [];
function check(name, condition) { assert(condition, name); results.push(name); }
async function ready(page) { await page.waitForFunction(() => !document.querySelector('#workbook').inert); }
async function go(page, n) {
  if (await page.locator('#menu-button').isVisible()) await page.locator('#menu-button').click();
  await page.locator(`#steps [data-step="${n}"]`).click();
  assert.equal(await page.locator('#screen-count').innerText(), `${n + 1} / 5`);
  await page.waitForFunction(() => !document.querySelector('.frame').inert);
  if (await page.locator('#menu-button').isVisible()) await page.waitForFunction(() => document.querySelector('#sidebar').getBoundingClientRect().right <= 1);
}
async function action(page, name) {
  if (!(await page.locator('#save-menu').isVisible())) await page.locator('#save-menu-button').click();
  await page.locator(`#save-menu [data-action="${name}"]`).click();
}
async function download(page, name) {
  const waiting = page.waitForEvent('download'); await action(page, name);
  const file = await waiting; return { bytes: await fs.readFile(await file.path()), name: file.suggestedFilename() };
}
async function upload(page, slot, bytes, name) {
  await page.locator(`#capture-${slot.split('.')[0]}`).evaluate((el) => { el.open = true; });
  await page.locator(`[data-file="${slot}"]`).setInputFiles({ name, mimeType: slot.endsWith('.csv') ? 'text/csv' : 'image/png', buffer: bytes });
  await page.locator(`[data-upload="${slot}"]`).click();
  await page.locator(`[data-attachment="${slot}"] .image-status`).filter({ hasText: 'Attached locally' }).waitFor();
}
async function fillRemaining(page) {
  await page.locator('#main [data-field]').evaluateAll((els) => els.forEach((el) => {
    if (!el.value && !el.dataset.field.startsWith('code.') && !/^group\.student(?:[23]|[123]Id)/.test(el.dataset.field)) {
      el.value = el.dataset.field.includes('rate') ? '1000' : el.dataset.field.includes('maWindow') ? '5' : el.dataset.field.includes('emaAlpha') ? '0.40' : 'SYNTHETIC — test entry, not a hardware result';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }));
}
async function stored(page) { return page.evaluate((k) => localStorage.getItem(k), key); }
async function importData(page, bytes, confirm = true, extension = 'zip') {
  await page.locator('#import-file').setInputFiles({ name: `synthetic.${extension}`, mimeType: 'application/octet-stream', buffer: bytes });
  await page.locator('#confirm-import').waitFor();
  assert((await page.locator('#dialog-body').innerText()).includes('Synthetic Third Student'), 'Import preview includes the third member');
  await page.locator(confirm ? '#confirm-import' : '#cancel-import').click();
}
(async () => {
  await fs.mkdir(output, { recursive: true });
  const { sketchSources } = await import(pathToFileURL(path.resolve('activities/noise-filtering-main-lab-v3/package-source.mjs')));
  const sources = await sketchSources();
  const generator = sources.repaired + '\n// </textarea><script>window.__CODE_EXECUTED = true</script> & `literal`\n//' + 'large-code-test '.repeat(5000);
  const csv = Buffer.from('Format,Scope waveform\r\nSource,CH1\r\nSampleRate,2500\r\nTime,Voltage\r\n0,2\r\n0.0004,2.1\r\n');
  for (const engine of (process.env.BROWSERS || 'chromium,firefox,webkit').split(',')) {
    const browser = await playwright[engine].launch({ headless: true }), contexts = [], profiles = [];
    const context = async (init) => {
      let c;
      // WebKit private contexts reject Blob persistence. Use isolated regular
      // profiles for normal-saving acceptance; denied storage is tested below.
      if (engine === 'webkit') {
        const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'aircraft-webkit-')); profiles.push(profile);
        c = await playwright.webkit.launchPersistentContext(profile, { headless: true, viewport: { width: 1512, height: 1000 }, acceptDownloads: true });
      } else c = await browser.newContext({ viewport: { width: 1512, height: 1000 }, acceptDownloads: true });
      if (init) await c.addInitScript(init); contexts.push(c); return c;
    };
    try {
      const c = await context(), page = await c.newPage(), errors = [], external = [];
      page.on('pageerror', (e) => errors.push(e.message)); page.on('dialog', (d) => d.accept());
      page.on('request', (r) => { if (!r.url().startsWith(origin) && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) external.push(r.url()); });
      await page.goto(url); await ready(page);
      await page.evaluate((keys) => keys.forEach((k) => localStorage.setItem(k, 'UNRELATED-SENTINEL')), otherKeys);
      const png = Buffer.from(await page.evaluate(() => {
        const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 340;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#153b43'; ctx.fillRect(0, 0, 1000, 340);
        ctx.fillStyle = '#fff'; ctx.font = '22px sans-serif'; ctx.fillText('SYNTHETIC TEST IMAGE — not measured', 30, 40);
        ctx.strokeStyle = '#92d6bc'; ctx.beginPath();
        for (let x=20;x<980;x++) { const y=185+60*Math.sin(x*.08)+12*Math.sin(x*.23); if(x===20)ctx.moveTo(x,y);else ctx.lineTo(x,y); }
        ctx.stroke(); return Array.from(Uint8Array.from(atob(canvas.toDataURL().split(',')[1]), (v) => v.charCodeAt(0)));
      }));
      const draft = JSON.parse((await download(page, 'export')).bytes);
      check(`${engine}: incomplete pulse v3 backup available`, draft.backupVersion === 3 && draft.attachments.length === 0);
      await page.locator('[data-field="group.groupId"]').fill('SYNTHETIC-AIRCRAFT');
      await page.locator('[data-field="group.student1Name"]').fill('Synthetic Student');
      check(`${engine}: exactly one required member name`, await page.locator('[data-field^="group.student"][required]').count() === 1);
      await fillRemaining(page); await page.locator('[data-field="code.generator"]').fill(generator);
      await page.locator('[data-preserve="generator"]').click();
      await page.locator('#preserved-generator').waitFor();
      check(`${engine}: code over 64 KiB accepted`, JSON.parse(await stored(page)).originals.generator.fields['code.generator'] === generator);
      await page.evaluate(()=>{window.singleMemberPrinted=false;window.print=()=>{window.singleMemberPrinted=true;};});
      await action(page,'print');await page.waitForFunction(()=>window.singleMemberPrinted);
      check(`${engine}: one name without IDs can print`, !(await page.locator('#report').innerText()).includes('Student 2') && !(await page.locator('#report').innerText()).includes('Student 3'));
      await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
      await page.locator('[data-field="code.generator"]').fill(generator + '\n// later correction');
      await page.screenshot({ path: path.join(output, `desktop-source-${engine}.png`) });
      await go(page, 1); await fillRemaining(page);
      await page.locator('[data-field="scope.procedure"]').fill('Literal <img src=x onerror="window.__CODE_EXECUTED=true"> and `quotes`');
      await upload(page, 'clean.image', png, 'original-clean-fft.png'); await upload(page, 'clean.csv', csv, 'original-clean.csv');
      await upload(page, 'baseline.image', png, 'original-baseline-fft.png'); await upload(page, 'baseline.csv', csv, 'original-baseline.csv');
      await go(page, 2); await fillRemaining(page);
      await page.locator('[data-preserve="design"]').click(); await page.locator('#preserved-design').waitFor();
      await page.locator('[data-field="design.cutoff"]').fill('Correction: SYNTHETIC 100 Hz');
      await upload(page, 'filteredClean.csv', csv, 'original-clean-rc.csv');
      await upload(page, 'filtered.image', png, 'original-filtered-fft.png'); await upload(page, 'filtered.csv', csv, 'original-filtered.csv');
      await go(page, 3); await fillRemaining(page); await page.locator('[data-field="code.digital"]').fill(sources.digital);
      await page.locator('[data-preserve="digital"]').click(); await page.locator('#preserved-digital').waitFor();
      await upload(page, 'digital.image', png, 'original-live-plot.png');
      await go(page, 4);
      check(`${engine}: required evidence complete`, (await page.locator('#main').innerText()).includes('required answers and files are here'));
      await go(page, 0);
      await page.locator('[data-field="group.student2Name"]').fill('Synthetic Second Student');
      await page.locator('[data-field="group.student3Name"]').fill('Synthetic Third Student');
      await go(page, 4);
      await upload(page, 'extra1.csv', csv, 'original-supplement.csv');
      const json = await download(page, 'export'), zipDownload = await download(page, 'zip'), backup = JSON.parse(json.bytes), zip = unzipSync(zipDownload.bytes);
      check(`${engine}: JSON equals ZIP backup`, JSON.stringify(backup) === JSON.stringify(JSON.parse(Buffer.from(zip['main_lab_backup.json']))));
      check(`${engine}: generator original stays frozen`, backup.record.originals.generator.fields['code.generator'] === generator && backup.record.fields['code.generator'].endsWith('// later correction'));
      check(`${engine}: original RC design stays frozen`, backup.record.originals.design.fields['design.cutoff'] !== backup.record.fields['design.cutoff']);
      for (const a of backup.attachments) {
        const expected = a.slot.endsWith('.csv') ? csv : png;
        assert.deepEqual(Buffer.from(a.data, 'base64'), expected);
        assert.deepEqual(Buffer.from(zip[(a.slot.endsWith('.csv') ? 'data/' : 'screenshots/') + a.filename]), expected);
      }
      check(`${engine}: all nine attachment bytes intact`, backup.attachments.length === 9);
      check(`${engine}: code folder contains literal original source`, Buffer.from(zip['code/generator_saved/generator_saved.ino']).toString() === generator);
      check(`${engine}: final digital sketch retained`, Buffer.from(zip['code/digital_saved/digital_saved.ino']).toString() === sources.digital);
      check(`${engine}: three member names export without IDs`, backup.record.fields['group.student3Name'] === 'Synthetic Third Student' && [1,2,3].every((n)=>backup.record.fields[`group.student${n}Id`]===''));
      check(`${engine}: learner code never executes`, await page.evaluate(() => window.__CODE_EXECUTED === undefined));
      await fs.writeFile(path.join(output, `synthetic-aircraft-${engine}.zip`), zipDownload.bytes);
      await fs.writeFile(path.join(output, `synthetic-aircraft-${engine}.json`), json.bytes);
      await action(page, 'save'); await page.waitForFunction(() => document.querySelector('#save-status').textContent.startsWith('Answers saved'));
      await page.reload(); await ready(page);
      check(`${engine}: reload retains files`, JSON.parse((await download(page, 'export')).bytes).attachments.length === 9);
      const before = await stored(page); await importData(page, zipDownload.bytes, false);
      check(`${engine}: cancelled import leaves answers unchanged`, before === await stored(page));
      await action(page, 'new'); await page.locator('#cancel-new').click(); check(`${engine}: cancelled reset leaves answers unchanged`, before === await stored(page));
      for (const [name, data, message] of [
        ['bad.json', '{bad', /readable/], ['wrong.json', '{"format":"555-main-lab-backup"}', /Choose a Noise/],
        ['sine.json', '{"format":"noise-filtering-main-lab-backup","backupVersion":2}', /previous sine-wave v2/],
        ['legacy.json', '{"format":"noise-filtering-main-lab-backup","backupVersion":1}', /legacy LDR/],
      ]) {
        await page.locator('#import-file').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(data) });
        await page.locator('#toast').filter({ hasText: message }).waitFor(); assert.equal(before, await stored(page));
      }
      check(`${engine}: malformed, wrong activity and legacy imports protected`, true);
      const fresh = await context(), restored = await fresh.newPage(); restored.on('dialog', (d) => d.accept());
      await restored.goto(url); await ready(restored); await importData(restored, zipDownload.bytes);
      const restoredBackup = JSON.parse((await download(restored, 'export')).bytes);
      check(`${engine}: clean-context ZIP restore`, restoredBackup.attachments.length === 9 && restoredBackup.record.fields['code.digital'] === sources.digital);
      await importData(restored, json.bytes, true, 'json');
      check(`${engine}: clean-context JSON restore`, JSON.parse(await stored(restored)).originals.generator.fields['code.generator'] === generator);
      check(`${engine}: third member restored`, JSON.parse(await stored(restored)).fields['group.student3Name'] === 'Synthetic Third Student');
      await go(page, 0);
      check(`${engine}: unrelated storage preserved`, await page.evaluate((keys) => keys.every((k) => localStorage.getItem(k) === 'UNRELATED-SENTINEL'), otherKeys));
      const waiting = page.waitForEvent('download'); await page.locator('[data-download-code="generator"]').click();
      check(`${engine}: individual code download intact`, (await fs.readFile(await (await waiting).path(), 'utf8')) === generator + '\n// later correction');
      await go(page, 1); const beforeInvalid = await stored(page);
      await page.locator('#capture-baseline').evaluate((el) => { el.open = true; });
      await page.locator('[data-file="baseline.csv"]').setInputFiles({ name:'invalid.csv', mimeType:'text/csv', buffer:Buffer.from([0,1,2]) });
      await page.locator('[data-upload="baseline.csv"]').click(); await page.locator('#toast').filter({hasText:/binary|control/}).waitFor();
      check(`${engine}: invalid file cannot replace original`, beforeInvalid === await stored(page));
      await page.evaluate(()=>window.scrollTo(0,0));
      await page.screenshot({ path: path.join(output, `desktop-spectrum-${engine}.png`) });
      await page.setViewportSize({ width: 390, height: 844 });
      for(let i=0;i<5;i++) {
        await go(page,i); check(`${engine}: page ${i+1} uses plain language`, !/\b(?:preserv\w*|evidence|artifacts?)\b/i.test(await page.locator('#main').innerText())); check(`${engine}: phone page ${i+1} no overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        check(`${engine}: page ${i+1} equations have readable bounds`, await page.locator('#main math').evaluateAll((els)=>els.every((el)=>el.getBoundingClientRect().height>12 && el.getBoundingClientRect().height<140)));
      }
      await go(page, 2); await page.screenshot({path:path.join(output, `phone-rc-${engine}.png`)});
      await go(page, 1); await page.screenshot({path:path.join(output, `phone-spectrum-${engine}.png`)});
      await page.locator('#menu-button').click(); await page.keyboard.press('Escape');
      check(`${engine}: keyboard menu restores focus`, await page.locator('#menu-button').evaluate((el) => document.activeElement === el));
      await page.setViewportSize({ width:1512,height:1000 });
      await go(page, 0);
      await page.locator('[data-field="group.student2Name"]').fill('Synthetic Second Student');
      await page.evaluate(() => { window.printCalled=false; window.print=()=>{window.dispatchEvent(new Event('beforeprint'));window.printCalled=true;}; });
      await action(page,'print'); await page.waitForFunction(()=>window.printCalled);
      check(`${engine}: print has typeset mathematics`, await page.locator('#report math').count()>=10);
      check(`${engine}: all three members appear in report without IDs`, (await page.locator('#report').innerText()).includes('Synthetic Second Student') && (await page.locator('#report').innerText()).includes('Synthetic Third Student'));
      check(`${engine}: report screenshots decoded`, await page.locator('#report img').evaluateAll((els)=>els.every((img)=>img.complete&&img.naturalWidth>0)));
      await page.emulateMedia({media:'print'}); check(`${engine}: print excludes controls`, !(await page.locator('#workbook').isVisible()));
      await page.screenshot({path:path.join(output, `report-${engine}.png`)}); await page.emulateMedia({media:'screen'});
      check(`${engine}: no runtime network dependencies`, external.length===0);
      check(`${engine}: no browser errors`, errors.length===0);
      const deniedContext=await context(()=>{
        Storage.prototype.setItem=()=>{throw new DOMException('Synthetic denied storage','QuotaExceededError');};
        Object.defineProperty(window,'indexedDB',{get:()=>{throw new Error('Synthetic unavailable');}});
      });
      const denied=await deniedContext.newPage(); denied.on('dialog',(d)=>d.accept()); await denied.goto(url); await ready(denied);
      await denied.locator('[data-field="group.groupId"]').fill('UNSAVED-SESSION');
      check(`${engine}: storage failure gives backup guidance`, (await denied.locator('#save-status').innerText()).includes('download JSON or ZIP now'));
      await go(denied,1); await upload(denied,'baseline.csv',csv,'original.csv');
      const unsaved=JSON.parse((await download(denied,'export')).bytes);
      check(`${engine}: storage failure preserves session export`,unsaved.record.fields['group.groupId']==='UNSAVED-SESSION'&&unsaved.attachments.length===1);
      if (engine === 'chromium') {
        const savingContext=await context(()=>{
          const original=IDBDatabase.prototype.transaction;
          IDBDatabase.prototype.transaction=function(...args){
            const transaction=original.apply(this,args);
            if(args[1]==='readwrite')Object.defineProperty(transaction,'oncomplete',{set(fn){transaction.addEventListener('complete',(e)=>setTimeout(()=>fn.call(transaction,e),500));}});
            return transaction;
          };
        });
        const saving=await savingContext.newPage();await saving.goto(url);await ready(saving);await go(saving,1);
        await upload(saving,'clean.csv',csv,'pending.csv');
        check('Pending evidence save warns before leaving',await saving.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;}));
        await saving.waitForFunction(()=>document.querySelector('#save-status').textContent.startsWith('Answers saved'));
        check('Completed evidence save releases navigation warning',await saving.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return !event.defaultPrevented;}));
        const corruptContext=await context();
        await corruptContext.addInitScript((k)=>localStorage.setItem(k,'{unreadable-v3'),key);
        const corrupt=await corruptContext.newPage();corrupt.on('dialog',(d)=>d.accept());await corrupt.goto(url);await ready(corrupt);
        await corrupt.locator('[data-field="group.groupId"]').fill('TEMPORARY');await action(corrupt,'save');
        check('Unreadable v3 record stays protected',await stored(corrupt)==='{unreadable-v3');
        const raw=await download(corrupt,'recover');check('Unreadable v3 record recoverable',raw.bytes.toString()==='{unreadable-v3');
        await action(corrupt,'new');await corrupt.locator('#confirm-new').click();
        check('Explicit reset exits v3 protective pause',JSON.parse(await stored(corrupt)).fields['group.groupId']==='');
        const missingContext=await context();
        await missingContext.addInitScript(([k,r])=>localStorage.setItem(k,JSON.stringify(r)),[key,backup.record]);
        const missing=await missingContext.newPage();missing.on('dialog',(d)=>d.accept());await missing.goto(url);await ready(missing);
        const protectedRecord=await stored(missing);await action(missing,'save');
        check('Missing v3 evidence protects original inventory',await stored(missing)===protectedRecord);
      }
      console.log(`${engine}: aircraft student journey, files, code, layouts and failure recovery passed.`);
    } finally { for(const c of contexts)await c.close(); await browser.close(); for(const profile of profiles)await fs.rm(profile,{recursive:true,force:true}); }
  }
  await fs.writeFile(path.join(output,`results-${(process.env.BROWSERS || 'chromium,firefox,webkit').replaceAll(',', '-')}.json`),JSON.stringify(results,null,2));
  console.log(`${results.length} aircraft main-lab browser checks passed.`);
})().catch((e)=>{console.error(e);process.exitCode=1;});
