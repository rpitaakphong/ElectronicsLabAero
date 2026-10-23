const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const origin = process.env.APP_URL || 'http://127.0.0.1:4178';
const url = origin + '/courses/2145427/week12/prelab/v1.0.0/START_HERE.html';
const output = path.join(root, 'output/playwright/noise-prelab-math');
const results = [];

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    const requests = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => requests.push(request.url()));
    page.on('dialog', (dialog) => dialog.accept());
    await page.goto(url);
    const backup = JSON.parse(
      await fs.readFile(
        path.join(
          root,
          'activities/noise-filtering-prelab/examples/workspace-final.synthetic.json',
        ),
        'utf8',
      ),
    );
    const literalName =
      '<img src=x onerror="window.__studentMarkupExecuted=true">';
    backup.workspace.fields.studentName = literalName;
    await page.locator('#import-file').setInputFiles({
      name: 'synthetic-final.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backup)),
    });
    await page.waitForFunction(() =>
      document
        .querySelector('#notice')
        .textContent.includes('Validated backup restored'),
    );
    const overflow = [];
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (let screen = 0; screen < 10; screen++) {
        await page.locator(`[data-nav="${screen}"]`).click();
        await page.locator('#screens details').evaluateAll((items) =>
          items.forEach((item) => {
            item.open = true;
          }),
        );
        if (screen === 9) await page.locator('#review').click();
        const measurements = await page.evaluate(() => {
          const equations = [
            ...document.querySelectorAll('#screens .lesson-equation'),
          ];
          return {
            pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
            mathCount: equations.length,
            invalid: equations.filter(
              (element) => !element.querySelector('math[display="block"]'),
            ).length,
            legacy: document.querySelectorAll('#screens .math').length,
            scrolling: equations
              .filter(
                (element) => element.scrollWidth > element.clientWidth + 1,
              )
              .map((element) => element.dataset.equation),
            literalMarkup: document.querySelectorAll(
              '#screens .report-preview img',
            ).length,
          };
        });
        assert.equal(
          measurements.pageOverflow,
          false,
          `${width}px screen ${screen + 1}: page overflow`,
        );
        assert.equal(
          measurements.invalid,
          0,
          'Every equation is native display mathematics',
        );
        assert.equal(
          measurements.legacy,
          0,
          'No legacy text-style formula containers',
        );
        if ([1, 2, 3, 4, 5, 6, 7, 9].includes(screen))
          assert(measurements.mathCount > 0, 'Expected mathematical content');
        if (measurements.scrolling.length)
          overflow.push({
            width,
            screen: screen + 1,
            equations: measurements.scrolling,
          });
        if (screen === 9) {
          assert.equal(measurements.literalMarkup, 0);
          assert(
            (await page.locator('#review-text').textContent()).includes(
              literalName,
            ),
          );
        }
        results.push(
          `${width}px screen ${screen + 1}: equations rendered, no page overflow`,
        );
        if (
          [1440, 390].includes(width) &&
          [1, 2, 3, 4, 5, 6, 7, 9].includes(screen)
        ) {
          await page.screenshot({
            path: path.join(output, `screen-${screen + 1}-${width}.png`),
            fullPage: true,
          });
        }
      }
    }
    await page.locator('[data-nav="2"]').click();
    const fraction = page.locator('[data-equation="noiseRMS"] mfrac').first();
    const fractionBox = await fraction.boundingBox();
    assert(
      fractionBox && fractionBox.height > 22,
      'RMS fraction uses stacked mathematical layout',
    );
    assert.equal(
      await page.locator('[data-equation="noiseRMS"] msqrt').count(),
      1,
    );
    assert.equal(
      await page.locator('[data-equation="noiseRMS"] munderover').count(),
      1,
    );
    results.push('RMS renders a stacked fraction, square root and bounded sum');
    await page
      .locator('[data-equation="noiseRMS"]')
      .screenshot({ path: path.join(output, 'rms-equation.png') });
    await page.locator('[data-nav="3"]').click();
    await page
      .locator('[data-equation="rcTime"]')
      .screenshot({ path: path.join(output, 'rc-equation.png') });
    await page.locator('[data-nav="9"]').click();
    await page.evaluate(() => {
      window.print = () => {
        window.__printed = true;
      };
    });
    await page.locator('#print').click();
    assert(
      await page.evaluate(
        () =>
          window.__printed &&
          document.querySelectorAll('#print-report math').length > 0 &&
          !window.__studentMarkupExecuted,
      ),
    );
    assert.equal(await page.locator('#print-report img').count(), 0);
    await page.pdf({
      path: path.join(output, 'report.pdf'),
      format: 'A4',
      printBackground: true,
    });
    results.push(
      'Print report includes mathematical context and literal student responses',
    );
    assert.equal(errors.length, 0, errors.join('\n'));
    assert(
      requests.every(
        (request) => request === url || request.startsWith('blob:'),
      ),
      'No runtime rendering, font or network dependency',
    );
    await fs.writeFile(
      path.join(output, 'results.json'),
      JSON.stringify(
        {
          browser: await browser.version(),
          results,
          overflow,
          requests,
          errors,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ passed: results.length, overflow, output }));
  } finally {
    await browser.close();
  }
})().catch(async (error) => {
  await fs.writeFile(
    path.join(output, 'failure.json'),
    JSON.stringify({ results, error: error.stack }, null, 2),
  );
  console.error(error);
  process.exitCode = 1;
});
