/* Isolated synthetic learning checks. No production or student records are touched. */
const playwright = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const origin = process.env.APP_URL || 'http://127.0.0.1:4182';
const route = '/noise-and-filtering/learn';
const output = path.resolve('output/playwright/noise-learning');
const results = [];
function check(name, value) {
  assert(value, name);
  results.push(name);
}
(async () => {
  await fs.mkdir(output, { recursive: true });
  for (const engine of (process.env.BROWSERS || 'chromium').split(',')) {
    const browser = await playwright[engine].launch();
    try {
      const context = await browser.newContext({
          viewport: { width: 1512, height: 1100 },
        }),
        page = await context.newPage(),
        errors = [],
        requests = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('request', (r) => requests.push(r.url()));
      await page.addInitScript(() => {
        for (const key of [
          '2145427-W12-prelab-20261026-impl-v1',
          'electronics-noise-filtering-main-lab-v1',
          'electronics-555-main-lab-v3',
          'noise-filtering-wiring-v1',
        ])
          localStorage.setItem(key, 'UNCHANGED-SENTINEL');
        window.storageReads = [];
        window.storageWrites = [];
        const get = Storage.prototype.getItem,
          set = Storage.prototype.setItem;
        Storage.prototype.getItem = function (key) {
          window.storageReads.push(key);
          return get.call(this, key);
        };
        Storage.prototype.setItem = function (key, value) {
          window.storageWrites.push(key);
          return set.call(this, key, value);
        };
      });
      const go = async (i) => {
        await page.locator('.nf-lessons button').nth(i).click();
        await page.locator('#nf-lesson-title').waitFor();
      };
      const field = (name) =>
        page.getByRole('spinbutton', { name, exact: true });
      const fill = async (name, value) => {
        await field(name).fill(String(value));
        await field(name).press('Tab');
      };
      const graph = (name) =>
        page.locator(`path[data-series="${name}"]`).first().getAttribute('d');
      await page.goto(origin + route);
      await page.locator('.nf-lessons button').last().waitFor();
      check(
        `${engine}: direct route and metadata`,
        (await page.locator('h1').innerText()) ===
          'Noise and Filtering Interactive Learning' &&
          (await page.title()) ===
            'Noise and Filtering Interactive Learning | Electronics Lab',
      );
      check(
        'Seven learning sections',
        (await page.locator('.nf-lessons button').count()) === 7,
      );
      check(
        'Learning content has no workbook/assessment links',
        (await page
          .locator(
            'main a[href*="prelab"], main a[href*="worksheets"], main input[type="file"]',
          )
          .count()) === 0,
      );
      const initial = await graph('RAW');
      await page
        .getByRole('checkbox', { name: 'Show disturbance alone' })
        .check();
      check(
        'Disturbance layer can be revealed',
        (await page
          .locator('path[data-series="Disturbance alone (zero-centred)"]')
          .count()) === 1,
      );
      await page
        .getByRole('checkbox', { name: 'Show disturbance alone' })
        .uncheck();
      await page.getByRole('button', { name: 'Generate new noise' }).click();
      check(
        'Explicit new noise changes input',
        (await graph('RAW')) !== initial,
      );
      await page
        .getByRole('combobox', { name: 'Useful signal', exact: true })
        .selectOption('step');
      await page
        .getByRole('combobox', { name: 'Measurement window' })
        .selectOption('event');
      const rmsPanel = page
        .getByRole('heading', { name: 'What does RMS measure?' })
        .locator('..');
      const rms = await rmsPanel.locator('dd').allTextContents();
      check(
        'Window across a real change includes signal variation',
        parseFloat(rms[1]) > parseFloat(rms[2]),
      );
      await page
        .getByRole('combobox', { name: 'Disturbance', exact: true })
        .selectOption('periodic');
      check(
        'Interference frequency control available',
        await field('Interference frequency').isVisible(),
      );
      await page
        .getByRole('combobox', { name: 'Disturbance', exact: true })
        .selectOption('drift');
      check(
        'Drift explained as a fixed slow tone',
        await page
          .locator('.nf-theory')
          .innerText()
          .then((t) => t.includes('0.6 Hz')),
      );
      await go(1);
      await page
        .getByRole('combobox', { name: 'Filter family' })
        .selectOption('notch');
      await fill('Test tone frequency', 10);
      check(
        'Notch rejects its centre tone',
        await page
          .locator('.nf-observation')
          .innerText()
          .then((t) => t.includes('0.0%')),
      );
      await go(0);
      await go(1);
      check(
        'Frequency-family settings retained',
        (await page
          .getByRole('combobox', { name: 'Filter family' })
          .inputValue()) === 'notch',
      );
      await go(2);
      const rawBefore = await graph('RAW'),
        rcBefore = await graph('RC low-pass');
      const before = Number(
        await page.locator('[data-method="rc"] td').nth(1).innerText(),
      );
      await fill('Capacitance', 4);
      const after = Number(
        await page.locator('[data-method="rc"] td').nth(1).innerText(),
      );
      check('Capacitance increases step delay', after > before);
      check(
        'Filter edit leaves RAW input unchanged',
        (await graph('RAW')) === rawBefore,
      );
      check('RC output changes', (await graph('RC low-pass')) !== rcBefore);
      await page
        .getByRole('combobox', { name: 'Useful signal', exact: true })
        .selectOption('pulse');
      await fill('Pulse width', 20);
      check(
        'Short pulse is attenuated',
        Number(await page.locator('[data-method="rc"] td').nth(1).innerText()) <
          100,
      );
      const paused = await page.getByLabel('Cursor timestamp').innerText();
      await page
        .getByRole('button', { name: 'Next sample', exact: true })
        .click();
      check(
        'Next sample advances cursor',
        (await page.getByLabel('Cursor timestamp').innerText()) !== paused,
      );
      await page.getByRole('button', { name: 'Play', exact: true }).click();
      await page.waitForFunction(
        () =>
          document
            .querySelector('[aria-label="Cursor timestamp"]')
            .textContent.startsWith('0.702') ||
          document.querySelector('[aria-label="Cursor timestamp"]')
            .textContent !== '0.652 s · sample 326',
      );
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      check(
        'Play/Pause works',
        await page
          .getByRole('button', { name: 'Play', exact: true })
          .isVisible(),
      );
      await go(3);
      await fill('Window length', 31);
      await page
        .getByText('Inspect every sample in this window', { exact: true })
        .click();
      check(
        'Complete MA window inspection',
        (await page.locator('.nf-sample-list span').count()) === 31,
      );
      await go(2);
      await go(3);
      check(
        'MA settings retained across sections',
        (await field('Window length').inputValue()) === '31',
      );
      await page.getByRole('button', { name: 'Reset this section' }).click();
      check(
        'Section reset restores MA defaults',
        (await field('Window length').inputValue()) === '15',
      );
      // Keyboard slider editing and negative-time history remain usable at the start.
      await page
        .getByRole('slider', { name: 'Window length', exact: true })
        .focus();
      await page.keyboard.press('ArrowRight');
      check(
        'Filter slider supports keyboard arrows',
        (await field('Window length').inputValue()) === '16',
      );
      await page.getByRole('slider', { name: 'Cursor time' }).fill('0');
      check(
        'MA shows settled prehistory at time zero',
        (await page
          .locator('svg[aria-label*="equally weighted samples"]')
          .count()) === 1,
      );
      await go(4);
      await fill('EMA coefficient', 1);
      check(
        'EMA coefficient one follows RAW exactly',
        (await graph('RAW')) === (await graph('Exponential average')),
      );
      await fill('EMA coefficient', 0.03);
      check(
        'Smaller EMA coefficient changes output',
        (await graph('RAW')) !== (await graph('Exponential average')),
      );
      check(
        'EMA update is typeset',
        (await page
          .locator('[aria-label="Current EMA calculation"] math')
          .count()) === 1,
      );
      await go(5);
      check(
        'Aliasing example explains 60 to 20 Hz',
        await page
          .locator('.nf-observation')
          .innerText()
          .then((t) => t.includes('60 Hz') && t.includes('20 Hz')),
      );
      const adc = await graph('ADC samples');
      await page
        .getByRole('checkbox', { name: 'Enable digital EMA after ADC' })
        .check();
      check(
        'Digital switch preserves ADC samples',
        (await graph('ADC samples')) === adc,
      );
      await fill('Source amplitude', 3);
      check(
        'Overrange produces clipping',
        await page
          .getByText('Clipped samples', { exact: true })
          .locator('..')
          .locator('dd')
          .innerText()
          .then((t) => parseInt(t) > 0),
      );
      await page
        .getByRole('checkbox', { name: 'Enable analog RC before ADC' })
        .check();
      check(
        'Analog filter changes samples before ADC',
        (await graph('ADC samples')) !== adc,
      );
      await go(4);
      await go(5);
      check(
        'Sampling settings retained',
        (await field('Source amplitude').inputValue()) === '3' &&
          (await page
            .getByRole('checkbox', { name: 'Enable analog RC before ADC' })
            .isChecked()),
      );
      await page.getByRole('button', { name: 'Reset sampling' }).click();
      check(
        'Sampling reset restores defaults',
        (await field('Source amplitude').inputValue()) === '1',
      );
      await go(6);
      check(
        'Comparison includes all paths',
        (await page.locator('tbody tr[data-method]').count()) === 4,
      );
      await page
        .getByRole('combobox', { name: 'Useful signal', exact: true })
        .selectOption('sine');
      check(
        'SNR is available for sine scenario',
        await page.getByRole('columnheader', { name: 'SNR (dB)' }).isVisible(),
      );
      await fill('Disturbance RMS setting', 0);
      check(
        'Zero disturbance gives undefined SNR',
        (await page.locator('[data-method="rc"] td').last().innerText()) ===
          'Undefined',
      );
      await page.getByRole('button', { name: 'Reset this section' }).click();
      for (const width of [1512, 768, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        for (let i = 0; i < 7; i++) {
          await go(i);
          await page.locator('.nf-theory').scrollIntoViewIfNeeded();
          check(
            `${engine}: section ${i + 1} typeset at ${width}`,
            (await page.locator('.nf-theory math').count()) > 0 &&
              (await page.locator('.katex-error').count()) === 0,
          );
          check(
            `${engine}: section ${i + 1} page fits ${width}`,
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          );
          check(
            `${engine}: section ${i + 1} plots contain finite coordinates`,
            await page
              .locator('.nf-plot path[data-series]')
              .evaluateAll((els) =>
                els.every((e) => !/(NaN|Infinity)/.test(e.getAttribute('d'))),
              ),
          );
          // Equations scroll within their own region; they must not force the page wider.
          check(
            `${engine}: section ${i + 1} equations contained`,
            await page.locator('[role="math"]').evaluateAll((els) =>
              els.every((e) => {
                const r = e.getBoundingClientRect();
                return r.left >= -1 && r.right <= innerWidth + 1;
              }),
            ),
          );
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({
            path: path.join(output, `${engine}-${width}-${i + 1}.png`),
            fullPage: true,
          });
        }
      }
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await go(2);
      check(
        'Reduced motion disables playback',
        await page
          .getByRole('button', { name: 'Play', exact: true })
          .isDisabled(),
      );
      const t = await page.getByLabel('Cursor timestamp').innerText();
      await page
        .getByRole('button', { name: 'Next sample', exact: true })
        .click();
      check(
        'Reduced motion supports manual stepping',
        (await page.getByLabel('Cursor timestamp').innerText()) !== t,
      );
      check(
        'No learning storage reads or writes',
        await page.evaluate(
          () =>
            window.storageReads.length === 0 &&
            window.storageWrites.length === 0,
        ),
      );
      await page.setViewportSize({ width: 1512, height: 1000 });
      await page.getByRole('button', { name: 'Topics', exact: true }).click();
      check(
        'Desktop menu includes learning',
        (await page
          .getByRole('navigation', { name: 'Topic shortcuts' })
          .locator(`a[href="${route}"]`)
          .count()) === 1,
      );
      await page.keyboard.press('Escape');
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole('button', { name: 'Open navigation menu' }).click();
      check(
        'Mobile menu includes learning',
        (await page
          .getByRole('navigation', { name: 'Mobile navigation' })
          .locator(`a[href="${route}"]`)
          .count()) === 1,
      );
      await page.keyboard.press('Escape');
      await page.goto(origin + '/noise-and-filtering');
      await page.getByRole('link', { name: /Start learning/ }).click();
      await page.waitForURL('**' + route);
      await page.goBack();
      check(
        'Back returns to topic',
        (await page.locator('h1').innerText()) === 'Noise and Filtering',
      );
      await page.goForward();
      await page.waitForURL('**' + route);
      await page.reload();
      check(
        'Direct reload keeps learning route',
        (await page.locator('h1').innerText()) ===
          'Noise and Filtering Interactive Learning',
      );
      await page.goto(origin + '/resources');
      check(
        'Resources link',
        (await page
          .getByRole('link', {
            name: 'Explore Noise and Filtering',
            exact: true,
          })
          .getAttribute('href')) === route,
      );
      check(
        'No external runtime requests',
        requests.every((u) => u.startsWith(origin) || u.startsWith('data:')),
      );
      check('No runtime errors', errors.length === 0);
      assert.deepEqual(errors, []);
      await context.close();
      console.log(
        `${engine}: learning interactions, mathematics, responsive layouts and independence passed.`,
      );
    } finally {
      await browser.close();
    }
  }
  await fs.writeFile(
    path.join(
      output,
      `results-${(process.env.BROWSERS || 'chromium').replaceAll(',', '-')}.json`,
    ),
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify({ passed: results.length, output }));
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
