const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const origin = process.env.APP_URL || 'http://127.0.0.1:3000';
const output = path.resolve('output/playwright/rc-signals');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
        viewport: { width: 1512, height: 1100 },
      }),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const choose = async (label, value) => {
      await page.getByRole('combobox', { name: label, exact: true }).click();
      await page.getByRole('option', { name: value, exact: true }).click();
      await page.getByRole('listbox').waitFor({ state: 'hidden' });
    };
    const field = (name) => page.getByRole('spinbutton', { name, exact: true });
    const edit = async (name, value) => {
      await field(name).fill(String(value));
      await field(name).press('Tab');
    };
    const rows = () =>
      page
        .getByRole('table', { name: 'Signal components' })
        .locator('tbody tr');
    await page.goto(origin + '/rc-filter/learn');
    assert.equal(await field('Useful-signal frequency').inputValue(), '200');
    assert.equal(await rows().count(), 2);
    assert.equal(
      await page
        .getByRole('heading', { name: 'Predict, then experiment' })
        .count(),
      0,
    );
    assert.equal(
      await page
        .getByRole('img', {
          name: 'Input and output signal amplitudes versus logarithmic frequency',
        })
        .count(),
      1,
    );
    const originalR = await field('Resistance R1').inputValue();
    await edit('Useful-signal frequency', 300);
    await edit('Interference strength', 75);
    await page.getByText('Advanced signal settings', { exact: true }).click();
    await edit('Fast interference frequency', 12000);
    await page.getByRole('checkbox', { name: 'Connect output load' }).check();
    await choose('Input signal', 'Clean signal');
    assert.equal(await rows().count(), 1);
    await choose('Input signal', 'Signal with interference');
    assert.equal(await rows().count(), 2);
    await page.getByText('Advanced signal settings', { exact: true }).click();
    assert.equal(
      await field('Fast interference frequency').inputValue(),
      '12000',
    );
    assert.equal(await field('Interference strength').inputValue(), '75');
    assert.equal(await field('Resistance R1').inputValue(), originalR);
    assert.ok(
      await page
        .getByRole('checkbox', { name: 'Connect output load' })
        .isChecked(),
    );
    await page.getByRole('radio', { name: /High-pass/ }).click();
    assert.equal(await field('Useful-signal frequency').inputValue(), '5000');
    await choose('Waveform window', 'Long overview');
    assert.match(
      await page.locator('.rc-time-panel .rc-caption').textContent(),
      /Long overview/,
    );
    await page.getByRole('radio', { name: /Low-pass/ }).click();
    assert.equal(await field('Useful-signal frequency').inputValue(), '300');
    await page.getByRole('button', { name: 'Topics', exact: true }).click();
    await page.keyboard.press('Escape');
    assert.equal(await field('Useful-signal frequency').inputValue(), '300');
    await choose('Input signal', 'Custom waveform');
    await choose('Input waveform', 'Square');
    await edit('Input frequency', 1700);
    await edit('Input offset', 1);
    await page.getByRole('radio', { name: /Band-pass/ }).click();
    await choose('Input signal', 'Custom waveform');
    assert.equal(await field('Input frequency').inputValue(), '1700');
    assert.match(
      await page
        .getByRole('combobox', { name: 'Input waveform' })
        .textContent(),
      /Square/,
    );
    await choose('Input waveform', 'Triangle');
    assert.equal(
      await page.getByRole('heading', { name: 'Input and output' }).count(),
      1,
    );
    await choose('Response view', 'Step response');
    await edit('Step voltage', 3);
    assert.equal(
      await page.getByRole('heading', { name: 'Step response' }).count(),
      1,
    );
    await choose('Response view', 'Periodic waveform');
    assert.equal(await field('Input offset').inputValue(), '1');
    await page.getByRole('button', { name: 'Reset lab', exact: true }).click();
    for (const width of [1512, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 1100 });
      for (const [name, frequency, count] of [
        ['Low-pass', '200', 2],
        ['High-pass', '5000', 2],
        ['Band-pass', '500', 3],
      ]) {
        await page.getByRole('radio', { name: new RegExp(name) }).click();
        assert.equal(
          await field('Useful-signal frequency').inputValue(),
          frequency,
        );
        assert.equal(await rows().count(), count);
        await page
          .getByText('Advanced signal settings', { exact: true })
          .click();
        assert.equal(
          await page.locator('details.rc-advanced-signal[open]').count(),
          1,
        );
        await choose(
          'Waveform window',
          name === 'Low-pass' ? 'Signal detail' : 'Long overview',
        );
        const bounds = await page.locator('.rc-time-panel').boundingBox();
        assert.ok(bounds.width <= width);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        await page.locator('.rc-time-panel').screenshot({
          path: path.join(output, `comparison-${width}-${name}.png`),
        });
        if (name === 'Band-pass') {
          await page
            .locator('.rc-frequency')
            .screenshot({ path: path.join(output, `frequency-${width}.png`) });
          await page
            .locator('.rc-controls')
            .screenshot({ path: path.join(output, `controls-${width}.png`) });
        }
      }
      if (width === 390) {
        await page
          .getByRole('button', { name: 'Open navigation menu' })
          .click();
        await page.keyboard.press('Escape');
        assert.equal(
          await field('Useful-signal frequency').inputValue(),
          '500',
        );
      }
    }
    // An extreme ratio must shorten the window rather than alias the interference.
    await edit('Useful-signal frequency', 0.1);
    await edit('Fast interference frequency', 1e6);
    assert.match(
      await page.locator('.rc-window-notice').textContent(),
      /shortened/,
    );
    assert.equal(await rows().count(), 3);
    await page.getByRole('button', { name: 'Reset lab', exact: true }).click();
    assert.equal(await page.locator('.rc-window-notice').count(), 0);
    assert.equal(await field('Useful-signal frequency').inputValue(), '200');
    // Keyboard opening and dismissal of the signal selector preserves selected circuit settings.
    const input = page.getByRole('combobox', {
      name: 'Input signal',
      exact: true,
    });
    await input.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      (el) => el === document.activeElement,
      await input.elementHandle(),
      { timeout: 3000 },
    );
    await edit('Useful-signal frequency', 450);
    await page.getByRole('link', { name: 'RC Filter', exact: true }).click();
    await page.getByRole('link', { name: /Start learning/ }).click();
    assert.equal(await field('Useful-signal frequency').inputValue(), '200');
    await page.reload();
    assert.equal(await field('Interference strength').inputValue(), '100');
    assert.deepEqual(errors, []);
    console.log(
      'PASS: RC interference examples, per-category and shared custom state, controls, reference traces and tone tables, bounded windows, keyboard/navigation, reset/reload, and all four viewport widths',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
