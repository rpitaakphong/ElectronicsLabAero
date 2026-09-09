const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const origin = process.env.APP_URL || 'http://127.0.0.1:3000';
const output = path.resolve('output/playwright/rc-integration');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1512, height: 1100 },
    });
    page.on('dialog', (dialog) => dialog.accept());
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const frame = () => page.frameLocator('iframe');
    const ready = () => frame().locator('#scopeCanvas').waitFor();
    const save = async () => {
      await frame().locator('#saveLabBtn').click();
      return page.evaluate(() =>
        JSON.parse(localStorage.getItem('rc-filter-v1-lab')),
      );
    };
    const load = async (name) => {
      await frame().locator('#presetSelect').selectOption(name);
      await frame().locator('#loadPresetBtn').click();
    };
    const value = async (source, type = 'Pk-Pk') => {
      await page.waitForTimeout(100);
      const rows = await frame()
        .locator('#measurementRows tr')
        .evaluateAll((rows) =>
          rows.map((r) =>
            Array.from(r.querySelectorAll('td')).map((c) => c.textContent),
          ),
        );
      const row = rows.find((r) => r[0] === source && r[1] === type);
      assert.ok(row, JSON.stringify(rows));
      const text = row[2];
      const n = parseFloat(text);
      return {
        text,
        value: n * (/m[VAs]/.test(text) ? 0.001 : /µ/.test(text) ? 1e-6 : 1),
        details: row[3],
      };
    };
    await page.goto(origin + '/topics');
    await page.getByRole('link', { name: 'Open RC Filter topic' }).click();
    await page.getByRole('link', { name: /Start learning/ }).click();
    await page
      .getByRole('spinbutton', { name: 'Resistance R1', exact: true })
      .fill('20');
    await page
      .getByRole('spinbutton', { name: 'Resistance R1', exact: true })
      .press('Tab');
    await page.getByRole('radio', { name: /Band-pass/ }).click();
    await page.getByRole('checkbox', { name: 'Connect output load' }).check();
    for (const width of [1512, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 1100 });
      await page.screenshot({
        path: path.join(output, `learning-${width}.png`),
        fullPage: true,
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
    }
    await page.getByRole('radio', { name: /Low-pass/ }).click();
    assert.equal(
      await page
        .getByRole('spinbutton', { name: 'Resistance R1', exact: true })
        .inputValue(),
      '20',
    );
    await page.getByRole('button', { name: 'Reset lab', exact: true }).click();
    assert.equal(
      await page
        .getByRole('spinbutton', { name: 'Resistance R1', exact: true })
        .inputValue(),
      '10',
    );
    await page.getByRole('combobox', { name: 'Response view' }).click();
    await page
      .getByRole('option', { name: 'Step response', exact: true })
      .click();
    assert.equal(
      await page.getByRole('spinbutton', { name: 'Step voltage' }).inputValue(),
      '1',
    );
    await page.setViewportSize({ width: 1512, height: 1100 });
    await page.getByRole('link', { name: 'RC Filter', exact: true }).click();
    await page.getByRole('link', { name: /Open simulator/ }).click();
    await ready();
    assert.equal(await frame().locator('#componentList option').count(), 1);
    assert.equal(
      await frame()
        .locator('[data-tool="opamp"],#dcOutput,#meterMode,#challengeScore')
        .count(),
      0,
    );
    const blank = await save();
    assert.equal(blank.lab, 'rc-filter');
    assert.equal(blank.version, 1);
    assert.equal(blank.state.generator.output, false);
    assert.equal(blank.state.generator.frequency, 1000);
    await frame().locator('#schematicSelect').selectOption('bandpass');
    assert.deepEqual(await save(), blank);
    await frame().locator('#presetAccess summary').click();
    await frame().locator('#presetPassword').fill('aero1234');
    await frame().locator('#presetUnlockForm button').click();
    assert.deepEqual(await save(), blank);
    for (const [name, freq, gain] of [
      ['lowpass', 1591.55, Math.SQRT1_2],
      ['highpass', 1591.55, Math.SQRT1_2],
      ['bandpass', 503.29, 5 / 6],
    ]) {
      await load(name);
      await frame().locator('#frequencyInput').fill(String(freq));
      await frame().locator('#frequencyInput').press('Tab');
      await page.waitForTimeout(150);
      const ratio = (await value('CH2')).value / (await value('CH1')).value;
      assert.ok(
        Math.abs(ratio - gain) < 0.012,
        `${name}: ${ratio} ${JSON.stringify(await value('CH1'))} ${JSON.stringify(await value('CH2'))}`,
      );
    }
    await load('lowpass');
    await frame().locator('#frequencyInput').fill('1591.55');
    await frame().locator('#frequencyInput').press('Tab');
    await frame().locator('#measureSource').selectOption('CH2');
    await frame().locator('#measureSource2').selectOption('CH1');
    await frame().locator('#measureType').selectOption('Phase');
    await frame().locator('#addMeasureBtn').click();
    assert.ok(Math.abs((await value('CH2 → CH1', 'Phase')).value + 45) < 1);
    await frame().locator('#componentList').selectOption('ch2tip');
    await frame().locator('#deleteSelected').click();
    assert.equal((await value('CH2')).text, '—');
    await frame().locator('#undoBtn').click();
    assert.ok(Number.isFinite((await value('CH2')).value));
    await frame().locator('#measureSource').selectOption('Math');
    await frame().locator('#measureType').selectOption('Mean');
    await frame().locator('#addMeasureBtn').click();
    const snapshot = await save();
    await page.evaluate(() => {
      localStorage.setItem('gds1202b-lab', 'sentinel-opamp');
      localStorage.setItem('voltage-divider-v1-lab', 'sentinel-divider');
    });
    const element = await page.locator('iframe').elementHandle();
    await page.getByRole('button', { name: 'Topics', exact: true }).click();
    await page.keyboard.press('Escape');
    assert.equal(
      await element.evaluate((el) => el === document.querySelector('iframe')),
      true,
    );
    assert.deepEqual(await save(), snapshot);
    await page.reload();
    await ready();
    assert.equal(await frame().locator('#componentList option').count(), 1);
    await frame().locator('#recallLabBtn').click();
    assert.deepEqual(await save(), snapshot);
    assert.deepEqual(
      await page.evaluate(() => [
        localStorage.getItem('gds1202b-lab'),
        localStorage.getItem('voltage-divider-v1-lab'),
      ]),
      ['sentinel-opamp', 'sentinel-divider'],
    );
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('rc-filter-v1-lab'));
      s.state.components[0].value = 0;
      localStorage.setItem('rc-filter-v1-lab', JSON.stringify(s));
    });
    await frame().locator('#recallLabBtn').click();
    assert.deepEqual(await save(), snapshot);
    for (const width of [1512, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 1100 });
      await frame().locator('.breadboard-wrap').scrollIntoViewIfNeeded();
      await page.screenshot({
        path: path.join(output, `simulator-${width}.png`),
        fullPage: true,
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      assert.equal(
        await frame()
          .locator('html')
          .evaluate((el) => el.scrollWidth > innerWidth),
        false,
      );
    }
    await page.getByRole('button', { name: 'Reset lab', exact: true }).click();
    await page.waitForFunction(
      () =>
        document
          .querySelector('iframe')
          .contentDocument.querySelectorAll('#componentList option').length ===
        1,
    );
    assert.equal(await frame().locator('#componentList option').count(), 1);
    const tap = async (row, col) => {
      const canvas = frame().locator('#breadboardCanvas');
      await canvas.scrollIntoViewIfNeeded();
      const box = await canvas.boundingBox();
      await page.mouse.click(
        box.x + ((155 + (col - 1) * 30) * box.width) / 1180,
        box.y + ({ A: 180, B: 210, C: 240 }[row] * box.height) / 620,
      );
    };
    await frame().locator('[data-tool="capacitor"]').click();
    await tap('A', 6);
    await page.keyboard.press('Escape');
    assert.equal(await frame().locator('#componentList option').count(), 1);
    await frame().locator('[data-tool="capacitor"]').click();
    await tap('A', 6);
    await tap('A', 14);
    let placed = await save();
    assert.equal(placed.state.components[0].value, 1e-8);
    await frame().locator('[data-tool="resistor"]').click();
    await tap('A', 6);
    assert.match(await frame().locator('#toast').textContent(), /occupied/);
    await page.keyboard.press('Escape');
    await frame()
      .locator('#componentList')
      .selectOption(placed.state.components[0].id);
    await frame().locator('#moveA').click();
    await tap('B', 7);
    assert.equal((await save()).state.components[0].aHole.col, 7);
    await frame().locator('#undoBtn').click();
    assert.equal((await save()).state.components[0].aHole.col, 6);
    await frame().locator('#redoBtn').click();
    assert.equal((await save()).state.components[0].aHole.col, 7);
    const downloaded = page.waitForEvent('download');
    await page.getByRole('link', { name: /Download offline/ }).click();
    const download = await downloaded;
    assert.equal(
      download.suggestedFilename(),
      'rc_filter_sim_single_file.html',
    );
    const filename = path.join(output, download.suggestedFilename());
    await download.saveAs(filename);
    const offline = await browser.newPage(),
      requests = [];
    offline.on('request', (r) => {
      if (/^https?:/.test(r.url())) requests.push(r.url());
    });
    offline.on('pageerror', (e) => errors.push(e.message));
    await offline.goto('file://' + filename);
    await offline.locator('#scopeCanvas').waitFor();
    await offline.locator('#presetAccess summary').click();
    await offline.locator('#presetPassword').fill('aero1234');
    await offline.locator('#presetUnlockForm button').click();
    await offline.locator('#presetSelect').selectOption('bandpass');
    await offline.locator('#loadPresetBtn').click();
    assert.equal(
      (await offline.locator('#componentList option').count()) > 4,
      true,
    );
    assert.deepEqual(requests, []);
    for (const route of [
      '/rc-filter',
      '/rc-filter/learn',
      '/rc-filter/simulator',
    ]) {
      await page.goto(origin + route);
      await page.reload();
      assert.equal(
        await page.getByRole('heading', { name: 'Page not found' }).count(),
        0,
      );
    }
    await page.goBack();
    await page.goForward();
    await ready();
    assert.deepEqual(errors, []);
    console.log(
      'PASS: RC learning, three wired responses, disconnected readings, history, locking, Save/Recall validation and isolation, navigation preservation, four viewport widths, routes, and offline download',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
