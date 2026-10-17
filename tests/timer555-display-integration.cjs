const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const origin = process.env.APP_URL || 'http://127.0.0.1:3001';
const output = path.resolve('output/playwright/timer555');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    headless: process.env.HEADED !== '1',
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1512, height: 1000 },
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const field = (name) => page.getByRole('spinbutton', { name, exact: true });
    const set = async (name, value) => {
      await field(name).fill(value);
      await field(name).press('Tab');
    };
    const positiveWidth = () =>
      page
        .locator('.timer-waveforms path')
        .first()
        .evaluate((element) => {
          const points = [
            ...element.getAttribute('d').matchAll(/[ML]([\d.-]+),([\d.-]+)/g),
          ].map((match) => [Number(match[1]), Number(match[2])]);
          let rise = null;
          for (let i = 1; i < points.length; i++) {
            if (points[i - 1][1] > 83 && points[i][1] < 83) rise = points[i][0];
            if (rise !== null && points[i - 1][1] < 83 && points[i][1] > 83)
              return points[i][0] - rise;
          }
          throw new Error('No complete HIGH pulse in the fixed window');
        });
    await page.goto(origin + '/555-timer/learn');
    await set('Playback rate', '40');
    await page.waitForTimeout(2200);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    const firstWidth = await positiveWidth();
    await page
      .locator('.timer-waveforms')
      .screenshot({ path: path.join(output, 'fixed-scale-1uF.png') });
    await set('Timing capacitor C', '2');
    assert.equal(await field('Time span').inputValue(), '50');
    assert.equal(await field('Playback rate').inputValue(), '40');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.waitForTimeout(3200);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    const secondWidth = await positiveWidth();
    assert(
      Math.abs(secondWidth / firstWidth - 2) < 0.02,
      `${firstWidth} px versus ${secondWidth} px`,
    );
    await page
      .locator('.timer-waveforms')
      .screenshot({ path: path.join(output, 'fixed-scale-2uF.png') });
    const frozenClock = await page
      .locator('.timer-waveforms svg text')
      .last()
      .textContent();
    // Exercise the physical track and the keyboard slider, not only numeric entries.
    const spanTrack = page.getByRole('group', {
      name: 'Time span',
      exact: true,
    });
    const bounds = await spanTrack.boundingBox();
    await spanTrack.click({
      position: { x: bounds.width * 0.6, y: bounds.height / 2 },
    });
    assert.notEqual(await field('Time span').inputValue(), '50');
    const rateSlider = page.getByRole('slider', {
      name: 'Playback rate',
      exact: true,
    });
    await rateSlider.focus();
    await rateSlider.press('ArrowRight');
    assert(parseFloat(await field('Playback rate').inputValue()) > 40);
    assert.equal(
      await page.locator('.timer-waveforms svg text').last().textContent(),
      frozenClock,
    );
    await set('Time span', '100');
    await set('Timing capacitor C', '10');
    assert.equal(await field('Time span').inputValue(), '100');
    await page.getByText('Fixed span · 100 ms', { exact: true }).waitFor();
    for (const width of [1512, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `overflow at ${width}`,
      );
      await page.locator('.timer-view-controls').screenshot({
        path: path.join(output, `fixed-scale-controls-${width}.png`),
      });
    }
    await page.getByRole('button', { name: /Monostable one-shot/ }).click();
    assert.equal(await field('Time span').inputValue(), '5000');
    assert.equal(await field('Playback rate').inputValue(), '500');
    await set('Timing capacitor C', '20');
    assert.equal(await field('Time span').inputValue(), '5000');
    assert.equal(await field('Playback rate').inputValue(), '500');
    await page.getByRole('button', { name: 'Reset lab', exact: true }).click();
    await set('Timing capacitor C', '0.001');
    await page
      .getByText(/Too many pulses.*reduce the time span/i)
      .waitFor({ timeout: 5000 });
    assert.equal(await field('Time span').inputValue(), '50');
    await set('Time span', '0.05');
    await page
      .getByText(/Too many pulses.*reduce the time span/i)
      .waitFor({ state: 'hidden' });
    assert(
      await page.locator('.timer-waveforms path').first().getAttribute('d'),
    );
    assert.deepEqual(errors, []);
    console.log(
      `PASS: fixed-scale HIGH pulse width ${firstWidth.toFixed(2)} → ${secondWidth.toFixed(2)} px when C doubles; pointer/keyboard sliders, paused edits, component-independent scales, mode/reset defaults, four widths, and crowded-view recovery`,
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
