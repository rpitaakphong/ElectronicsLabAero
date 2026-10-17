const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  unlockPresets,
} = require('../vendor/opamp-lab-simulator/tests/preset-helpers.cjs');
const origin = process.env.APP_URL || 'http://127.0.0.1:3001';
const output = path.resolve('output/playwright/timer555');
fs.mkdirSync(output, { recursive: true });
const near = (actual, expected, tolerance = 0.01) =>
  assert.ok(
    Number.isFinite(actual) && Math.abs(actual / expected - 1) < tolerance,
    `${actual} versus ${expected}`,
  );

(async () => {
  const browser = await chromium.launch({
    headless: process.env.HEADED !== '1',
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1512, height: 1000 },
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // Test-only access to the actual scope pipeline; no hooks in the product.
    await page.route('**/app.js', (route) =>
      route.fulfill({
        contentType: 'text/javascript',
        body: fs
          .readFileSync('vendor/opamp-lab-simulator/app.js', 'utf8')
          .replace(
            '  // Initial state',
            `window.labTest={state,get scope(){return scope},timerRuntime,averageAcquisition,measurementResult,makeDisplayFrame,drawScope};\n  // Initial state`,
          ),
      }),
    );
    // Both local call-to-action and header links must leave a playing lesson.
    for (const width of [1512, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(origin + '/555-timer/learn');
      await page
        .getByRole('spinbutton', { name: 'Playback rate', exact: true })
        .fill('40');
      await page
        .getByRole('spinbutton', { name: 'Playback rate', exact: true })
        .press('Tab');
      await page.waitForTimeout(200);
      await page
        .getByRole('link', { name: 'Build this circuit on the breadboard →' })
        .click();
      await page
        .getByRole('heading', { name: '555 Timer Lab Simulator', exact: true })
        .waitFor({ timeout: 3000 });
      assert.equal(
        await page.title(),
        '555 Timer Lab Simulator | Electronics Lab',
      );
    }
    await page.setViewportSize({ width: 1512, height: 1000 });
    const frame = page.frameLocator('iframe');
    await frame.locator('#breadboardCanvas').waitFor();
    await unlockPresets(frame, 'astable');
    await page.waitForTimeout(150);
    const runtime = page
      .frames()
      .find((f) => f.url().includes('/simulators/timer555/'));
    const deterministic = await runtime.evaluate(() => {
      const lab = window.labTest,
        scope = lab.scope;
      const s = lab.timerRuntime.session;
      s.advance(12);
      scope.acquire.mode = 'Average';
      scope.acquire.average = 16;
      const rows = [];
      // Deliberately asynchronous captures reproduce the original phase-smearing bug.
      for (const source of ['CH1', 'CH2']) {
        scope.trigger.source = source;
        for (const slope of ['Rising', 'Falling']) {
          scope.trigger.slope = slope;
          for (let i = 0; i < 20; i++) {
            const end = 5 + i * 0.12;
            const sim = s.record(end - s.period * 6, end, 2400);
            sim.window = 0.05;
            const result = lab.averageAcquisition(sim);
            lab.state.sim.last = result;
            const display = lab.makeDisplayFrame(result);
            rows.push(
              Object.fromEntries(
                ['Frequency', 'Duty Cycle', 'Pk-Pk', '+Width'].map((name) => [
                  name,
                  lab.measurementResult({ name, source: 'CH1' }, display).value,
                ]),
              ),
            );
          }
        }
      }
      scope.trigger.source = 'CH1';
      scope.trigger.slope = 'Rising';
      return { period: s.period, rows };
    });
    for (const row of deterministic.rows) {
      near(row.Frequency, 1 / deterministic.period);
      near(row['Duty Cycle'], (100 * 11) / 21, 0.002);
      near(row['Pk-Pk'], 3.7);
      near(row['+Width'], Math.LN2 * 11000 * 1e-6);
    }
    // Exercise the same fix through the visible instrument controls.
    await frame.locator('#loadPresetBtn').click();
    await page.waitForTimeout(300);
    await frame.locator('[data-action="autoset"]').click();
    await frame.locator('[data-action="runStop"]').click();
    await frame.locator('[data-action="acquire"]').click();
    await frame
      .getByRole('button', { name: 'Mode Sample', exact: true })
      .click();
    await frame.getByRole('button', { name: 'Average', exact: true }).click();
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(150);
      const frequency = await frame
        .locator('#measurementRows tr')
        .filter({ hasText: 'Frequency' })
        .locator('td')
        .nth(2)
        .innerText();
      near(parseFloat(frequency), 68.7);
    }
    await frame
      .locator('#scopeCanvas')
      .screenshot({ path: path.join(output, 'fixed-average-scope.png') });

    await frame.locator('#loadPresetBtn').click();
    const timingIds = await runtime.evaluate(() => {
      const resistors = window.labTest.state.components.filter(
        (c) => c.type === 'resistor',
      );
      return [resistors.find((c) => c.value === 1000).id, resistors.at(-1).id];
    });
    for (const [id, value] of [
      [timingIds[0], '1M'],
      [timingIds[1], '1k'],
    ]) {
      await frame.locator('#componentList').selectOption(id);
      await frame.locator('#editValue').fill(value);
      await frame.locator('#editValue').dispatchEvent('change');
    }
    await page.waitForTimeout(4000);
    await frame.locator('[data-action="autoset"]').click();
    await frame.locator('[data-action="runStop"]').click();
    await frame.locator('#measureType').selectOption('-Width');
    await frame.locator('#addMeasureBtn').click();
    const measurements = [];
    for (let i = 0; i < 16; i++) {
      await page.waitForTimeout(150);
      measurements.push(
        await runtime.evaluate(() => {
          const lab = window.labTest,
            display = lab.makeDisplayFrame(lab.state.sim.last);
          const row = Object.fromEntries(
            ['Frequency', 'Duty Cycle', '-Width', 'Mean', 'RMS'].map((name) => [
              name,
              lab.measurementResult({ name, source: 'CH1' }, display).value,
            ]),
          );
          // Full-record mean depends on the window's partial cycles and startup.
          // Independently integrate that exact window rather than assuming a cycle mean.
          const { t, c1 } = display.record,
            duration = t.at(-1) - t[0];
          row.expectedMean =
            c1
              .slice(1)
              .reduce(
                (sum, v, i) => sum + ((c1[i] + v) / 2) * (t[i + 1] - t[i]),
                0,
              ) / duration;
          row.expectedRMS = Math.sqrt(
            c1
              .slice(1)
              .reduce(
                (sum, v, i) =>
                  sum + ((c1[i] ** 2 + v ** 2) / 2) * (t[i + 1] - t[i]),
                0,
              ) / duration,
          );
          return row;
        }),
      );
    }
    for (const row of measurements) {
      near(row.Frequency, 1 / (Math.LN2 * 1002000 * 1e-6));
      near(row['Duty Cycle'], (100 * 1001) / 1002, 0.0001);
      near(row['-Width'], Math.LN2 * 0.001);
      near(row.Mean, row.expectedMean, 1e-10);
      near(row.RMS, row.expectedRMS, 1e-10);
    }
    await frame
      .locator('#scopeCanvas')
      .screenshot({ path: path.join(output, 'fixed-narrow-pulse-scope.png') });
    const narrowAverages = await runtime.evaluate(() => {
      const lab = window.labTest,
        s = lab.timerRuntime.session;
      s.advance(s.time + 20);
      lab.scope.acquire.mode = 'Average';
      lab.scope.acquire.average = 16;
      const results = [];
      for (let i = 0; i < 24; i++) {
        const end = s.period * (20 + i * 0.123);
        const sim = s.record(end - s.period * 6, end, 2400);
        sim.window = 2;
        lab.state.sim.last = lab.averageAcquisition(sim);
        const display = lab.makeDisplayFrame(lab.state.sim.last);
        results.push(
          Object.fromEntries(
            ['Frequency', 'Duty Cycle', '-Width', 'Pk-Pk'].map((name) => [
              name,
              lab.measurementResult({ name, source: 'CH1' }, display).value,
            ]),
          ),
        );
      }
      return results;
    });
    for (const row of narrowAverages) {
      near(row.Frequency, 1 / (Math.LN2 * 1002000 * 1e-6));
      near(row['Duty Cycle'], (100 * 1001) / 1002, 0.0001);
      near(row['-Width'], Math.LN2 * 0.001);
      near(row['Pk-Pk'], 3.7);
    }
    const bandwidth = await runtime.evaluate(() => {
      const lab = window.labTest;
      lab.scope.ch1.bwLimit = '20MHz';
      const display = lab.makeDisplayFrame(lab.state.sim.last);
      return Object.fromEntries(
        ['Frequency', 'Duty Cycle', '-Width'].map((name) => [
          name,
          lab.measurementResult({ name, source: 'CH1' }, display).value,
        ]),
      );
    });
    near(bandwidth.Frequency, 1 / (Math.LN2 * 1002000 * 1e-6));
    near(bandwidth['Duty Cycle'], (100 * 1001) / 1002, 0.0001);
    near(bandwidth['-Width'], Math.LN2 * 0.001);
    // The learning renderer also retains subpixel pulses in its path.
    await page.goto(origin + '/555-timer/learn');
    await page
      .getByRole('spinbutton', { name: 'R1', exact: true })
      .fill('1000');
    await page
      .getByRole('spinbutton', { name: 'R1', exact: true })
      .press('Tab');
    await page.getByRole('spinbutton', { name: 'R2', exact: true }).fill('1');
    await page
      .getByRole('spinbutton', { name: 'R2', exact: true })
      .press('Tab');
    await page
      .getByRole('spinbutton', { name: 'Time span', exact: true })
      .fill('2000');
    await page
      .getByRole('spinbutton', { name: 'Time span', exact: true })
      .press('Tab');
    await page
      .getByRole('spinbutton', { name: 'Playback rate', exact: true })
      .fill('1500');
    await page
      .getByRole('spinbutton', { name: 'Playback rate', exact: true })
      .press('Tab');
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    const outputY = await page
      .locator('.timer-waveforms svg path')
      .first()
      .getAttribute('d');
    assert(
      outputY.includes(',106.76'),
      'output path must include the LOW level',
    );
    await page.locator('.timer-waveforms').screenshot({
      path: path.join(output, 'fixed-learning-narrow-pulse.png'),
    });
    assert.deepEqual(errors, []);
    console.log(
      'PASS: playing-lesson navigation, trigger-aligned averages on both channels/slopes, live Average UI, narrow-pulse timing/mean/RMS, and edge-preserving lesson plots',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
