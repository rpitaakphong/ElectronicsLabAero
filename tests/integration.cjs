const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const origin = process.env.APP_URL || 'http://127.0.0.1:3000';
const output = path.resolve('output/playwright/opamp-integration');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1512, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const frame = page.frameLocator('iframe');
    const ready = async () => {
      await frame.locator('#breadboardCanvas').waitFor();
      await page.waitForFunction(() => {
        const iframe = document.querySelector('iframe');
        return iframe && Math.abs(iframe.clientHeight - iframe.contentDocument.body.getBoundingClientRect().height) < 2;
      });
    };
    const frameHeight = () => page.locator('iframe').evaluate(el => el.clientHeight);
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('gds1202b-lab')));

    await page.goto(origin);
    await page.getByRole('link', { name: 'Open Operational Amplifier topic' }).click();
    await page.waitForURL('**/operational-amplifier');
    await page.getByRole('link', { name: 'Start learning' }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Start learning' }).count(), 1);
    await page.screenshot({ path: path.join(output, 'topic-desktop.png') });
    await page.getByRole('link', { name: 'Start learning' }).click();
    await page.waitForFunction(() => document.title === 'Op-Amp Interactive Learning | Electronics Lab');
    await page.getByRole('radio', { name: /Buffer/ }).click();
    await page.getByRole('link', { name: 'Operational Amplifier', exact: true }).click();
    await page.getByRole('link', { name: 'Open simulator' }).click();
    await ready();
    assert.equal(await page.title(), 'Op-Amp Lab Simulator | Electronics Lab');
    assert.equal(await frame.locator('.lab-brand').isVisible(), false);
    assert.equal(await frame.locator('.lab-intro').isVisible(), false);
    assert(await frame.locator('#resetAllBtn').isVisible());
    await frame.locator('#challengeMode').check();
    await frame.locator('#challengeMode').uncheck();
    await page.goBack();
    await page.waitForURL('**/operational-amplifier');
    await page.goForward();
    await ready();
    await page.reload();
    await ready();

    // Expand and shrink without leaving a blank area or introducing inner page scrolling.
    const expanded = await frameHeight();
    await frame.locator('#pinGuide summary').focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(height => document.querySelector('iframe').clientHeight < height - 100, expanded);
    const collapsed = await frameHeight();
    await page.keyboard.press('Enter');
    await page.waitForFunction(height => document.querySelector('iframe').clientHeight > height + 100, collapsed);

    // Editor selection, values, undo, and Save/Recall operate across iframe navigation.
    const resistor = await frame.locator('#componentList option').filter({ hasText: 'resistor' }).first().getAttribute('value');
    await frame.locator('#componentList').selectOption(resistor);
    await frame.locator('#editValue').fill('22000');
    await frame.locator('#editValue').press('Tab');
    await frame.locator('#frequencyInput').fill('2000');
    await frame.locator('#frequencyInput').press('Tab');
    await frame.locator('#saveLabBtn').click();
    const snapshot = await saved();
    assert.equal(snapshot.pinoutVersion, 2);
    assert.equal(snapshot.state.components.find(c => c.id === resistor).value, 22000);
    assert.equal(snapshot.state.generator.frequency, 2000);
    const toast = await frame.locator('#toast').boundingBox();
    assert(toast.y >= 0 && toast.y + toast.height <= 1000, 'save feedback must be in the parent viewport');
    await frame.locator('#componentList').selectOption(resistor);
    await frame.locator('#deleteSelected').click();
    assert.equal(await frame.locator(`#componentList option[value="${resistor}"]`).count(), 0);
    await frame.locator('#undoBtn').click();
    assert.equal(await frame.locator(`#componentList option[value="${resistor}"]`).count(), 1);
    await page.getByRole('link', { name: 'Operational Amplifier', exact: true }).click();
    await page.getByRole('link', { name: 'Start learning' }).click();
    await page.getByRole('button', { name: 'Reset lab' }).click();
    assert.deepEqual(await saved(), snapshot, 'learning tool must not modify saved simulator data');
    await page.getByRole('link', { name: 'Operational Amplifier', exact: true }).click();
    await page.getByRole('link', { name: 'Open simulator' }).click();
    await ready();
    await frame.locator('#recallLabBtn').click();
    await frame.locator('#componentList').selectOption(resistor);
    assert.equal(await frame.locator('#editValue').inputValue(), '22000');
    assert.equal(await frame.locator('#frequencyInput').inputValue(), '2000');
    // Generator keyboard knob and scope controls remain reachable through the embed.
    await frame.locator('[data-sfg-knob=frequency]').press('ArrowUp');
    assert(Number(await frame.locator('#frequencyInput').inputValue()) > 2000);
    await frame.locator('[data-action=runStop]').click();
    await frame.locator('[data-action=runStop]').click();

    for (const width of [1512, 1024, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(origin + '/operational-amplifier');
      await page.screenshot({ path: path.join(output, `topic-${width}.png`), fullPage: true });
      await page.getByRole('link', { name: 'Open simulator' }).click();
      await ready();
      if (width === 390) assert.equal(await frame.locator('#pinGuide').evaluate(el => el.open), false);
      for (const preset of ['follower', 'inverting', 'noninverting', 'lowpass', 'integrator']) {
        await frame.locator('#presetSelect').selectOption(preset);
        await frame.locator('#loadPresetBtn').click();
        await ready();
        assert.equal(await frame.locator('#circuitStatus').textContent(), 'Circuit electrically runnable');
        const metrics = await page.evaluate(() => {
          const iframe = document.querySelector('iframe'), doc = iframe.contentDocument;
          return { outerOverflow: document.documentElement.scrollWidth > innerWidth, innerOverflow: doc.documentElement.scrollWidth > iframe.clientWidth, verticalOverflow: doc.documentElement.scrollHeight - iframe.clientHeight, frameWidth: iframe.clientWidth, width: innerWidth };
        });
        assert.equal(metrics.outerOverflow, false); assert.equal(metrics.innerOverflow, false);
        assert(metrics.verticalOverflow <= 1); assert.equal(metrics.frameWidth, metrics.width);
        await frame.locator('.breadboard-wrap').screenshot({ path: path.join(output, `board-${width}-${preset}.png`) });
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(output, `simulator-${width}.png`) });
      // Main page scrollbar, not a hidden inner document, owns ordinary scrolling.
      await page.mouse.move(width / 2, 700); await page.mouse.wheel(0, 400);
      await page.waitForFunction(() => window.scrollY > 0);
      assert.equal(await frame.locator('html').evaluate(() => window.scrollY), 0);
    }

    // Browser download is the actual packaged artifact; it must open without HTTP requests.
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('link', { name: /Download offline simulator/ }).click();
    const download = await downloadEvent;
    const offlinePath = path.join(output, download.suggestedFilename());
    await download.saveAs(offlinePath);
    const offline = await browser.newPage(), requests = [];
    offline.on('pageerror', error => errors.push(error.message));
    offline.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    await offline.goto('file://' + offlinePath);
    assert(await offline.locator('.lab-brand img').isVisible());
    await offline.locator('#presetSelect').selectOption('follower');
    await offline.locator('#loadPresetBtn').click();
    assert.equal(await offline.locator('#circuitStatus').textContent(), 'Circuit electrically runnable');
    assert.deepEqual(requests, []);
    await page.goto(origin + '/simulators/opamp/index.html');
    assert(await page.locator('.lab-brand img').isVisible());
    assert.equal(await page.title(), 'Op-Amp Lab Simulator');

    // Direct application URLs also work with a production SPA fallback.
    for (const route of ['/operational-amplifier', '/operational-amplifier/learn', '/operational-amplifier/simulator']) {
      await page.goto(origin + route); await page.reload();
      assert.equal(await page.getByRole('heading', { name: 'Page not found' }).count(), 0);
    }
    assert.deepEqual(errors, []);
    console.log('PASS: topic navigation, deep links/history, iframe resize/scroll, keyboard, editor/undo, isolated saves, instruments, 15 responsive presets, actual offline download');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
