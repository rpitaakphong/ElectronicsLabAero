const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const origin = process.env.APP_URL || 'http://127.0.0.1:3000';
const output = path.resolve('output/playwright/opamp-exam');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1512, height: 1000 },
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('dialog', (dialog) => dialog.accept());
    const frame = page.frameLocator('iframe');

    const ready = async () => {
      await frame.locator('#breadboardCanvas').waitFor();
      await page.waitForFunction(() => {
        const iframe = document.querySelector('iframe');
        return (
          iframe &&
          Math.abs(
            iframe.clientHeight -
              iframe.contentDocument.body.getBoundingClientRect().height,
          ) < 2
        );
      });
    };

    await page.goto(origin + '/exam/op-amp');
    await ready();
    assert.equal(
      await page.title(),
      'Op-Amp Construction Exam | Electronics Lab',
    );
    assert.equal(
      await page.locator('iframe').getAttribute('src'),
      '/simulators/opamp/index.html?embed=1&exam=1',
    );
    assert(
      await page
        .getByText(/Build the circuit shown on your exam paper/)
        .isVisible(),
    );
    assert.equal(
      await page
        .getByRole('link', { name: /Download offline simulator/ })
        .count(),
      0,
    );
    assert.equal(
      await page.locator('a[href="/exam/op-amp"]').count(),
      0,
      'the exam route must not be advertised as a navigation link',
    );

    assert(
      await frame
        .locator('html')
        .evaluate((element) => element.classList.contains('exam-mode')),
    );
    for (const selector of [
      '.app-header',
      '#saveLabBtn',
      '#recallLabBtn',
      '[data-action="saveRecall"]',
      '.challenge-score',
      '.learning-section',
    ]) {
      assert.equal(
        await frame.locator(selector).isVisible(),
        false,
        `${selector} must be hidden in exam mode`,
      );
    }

    assert(await frame.locator('.preset-controls').isVisible());
    assert(await frame.locator('#presetAccess').isVisible());
    assert.equal(await frame.locator('#presetSelect').inputValue(), 'blank');
    assert.equal(await frame.locator('#presetSelect').isDisabled(), false);
    assert.equal(
      await frame
        .locator('#presetSelect option[value="inverting"]')
        .evaluate((option) => option.disabled),
      true,
    );
    assert.equal(await frame.locator('.preset-manager').isVisible(), false);
    await frame.locator('#presetAccess summary').click();
    await frame.locator('#presetPassword').fill('incorrect');
    await frame.locator('#presetUnlockForm button').click();
    assert(await frame.locator('#presetUnlockError').isVisible());
    assert.equal(
      await frame
        .locator('#presetSelect option[value="inverting"]')
        .evaluate((option) => option.disabled),
      true,
    );
    await frame.locator('#presetPassword').fill('aero1234');
    await frame.locator('#presetUnlockForm button').click();
    assert.equal(await frame.locator('#presetAccess').isVisible(), false);
    assert.equal(
      await frame
        .locator('#presetSelect option[value="inverting"]')
        .evaluate((option) => option.disabled),
      false,
    );
    assert(await frame.locator('.preset-manager').isVisible());
    await frame.locator('#presetSelect').selectOption('inverting');
    await frame.locator('#loadPresetBtn').click();
    assert(
      (await frame.locator('#componentList option').count()) > 1,
      'an unlocked preset should load into the exam breadboard',
    );
    await page.reload();
    await ready();
    assert.equal(await frame.locator('#presetSelect').inputValue(), 'blank');
    assert.equal(await frame.locator('#componentList option').count(), 1);
    assert.equal(
      await frame
        .locator('#presetSelect option[value="inverting"]')
        .evaluate((option) => option.disabled),
      true,
    );
    assert(await frame.locator('#presetAccess').isVisible());

    assert(await frame.locator('#pinGuide').isVisible());
    assert.equal(
      await frame.locator('#pinGuide').evaluate((element) => element.open),
      true,
    );
    assert.equal(
      await frame.locator('#pinGuide > summary').getAttribute('aria-disabled'),
      'true',
    );
    assert.equal(
      await frame.locator('#pinGuide > summary').getAttribute('tabindex'),
      '-1',
    );
    assert.equal(await frame.locator('#pinGuide .guide-action').count(), 0);
    await frame
      .locator('#pinGuide > summary')
      .evaluate((element) => element.click());
    assert.equal(
      await frame.locator('#pinGuide').evaluate((element) => element.open),
      true,
    );
    await frame.locator('#pinGuide').evaluate((element) => {
      element.open = false;
    });
    await page.waitForFunction(() => {
      const guide = document
        .querySelector('iframe')
        ?.contentDocument?.querySelector('#pinGuide');
      return guide?.open === true;
    });
    assert.equal(await frame.locator('#schematicSelect option').count(), 5);
    assert(await frame.locator('#ua741Guides').isVisible());
    assert(await frame.locator('.generator-section').isVisible());
    assert(await frame.locator('.scope-section').isVisible());
    assert(await frame.locator('[data-tool="opamp"]').isVisible());
    assert(await frame.locator('[data-tool="wire"]').isVisible());
    assert(await frame.locator('[data-tool="resistor"]').isVisible());
    assert(await frame.locator('#vplusInput').isVisible());
    assert(await frame.locator('#vminusInput').isVisible());
    assert(
      await page
        .getByRole('button', { name: 'Reset lab', exact: true })
        .isVisible(),
    );
    assert.equal(await frame.locator('#componentList option').count(), 1);

    const canvas = frame.locator('#breadboardCanvas');
    const canvasBox = await canvas.boundingBox();
    const place = (x, y) =>
      canvas.click({
        position: {
          x: (x * canvasBox.width) / 1180,
          y: (y * canvasBox.height) / 620,
        },
      });
    await frame.locator('[data-tool="resistor"]').click();
    await place(184, 180);
    await place(312, 240);
    assert.equal(await frame.locator('#componentList option').count(), 2);
    await frame.locator('#undoBtn').click();
    assert.equal(await frame.locator('#componentList option').count(), 1);
    await frame.locator('#redoBtn').click();
    assert.equal(await frame.locator('#componentList option').count(), 2);
    await page.getByRole('button', { name: 'Reset lab', exact: true }).click();
    assert.equal(await frame.locator('#componentList option').count(), 1);

    for (const width of [1512, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(origin + '/exam/op-amp');
      await ready();
      assert.equal(
        await frame.locator('#pinGuide').evaluate((element) => element.open),
        true,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        ),
        false,
      );
      assert.equal(
        await frame
          .locator('html')
          .evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth,
          ),
        false,
      );
      const examReference = await frame
        .locator('.pin-guide-content')
        .boundingBox();
      await page.screenshot({
        path: path.join(output, `exam-${width}.png`),
        fullPage: true,
      });

      await page.goto(origin + '/operational-amplifier/simulator');
      await ready();
      await frame.locator('#pinGuide').evaluate((element) => {
        element.open = true;
      });
      const standardReference = await frame
        .locator('.pin-guide-content')
        .boundingBox();
      const heightRatio = examReference.height / standardReference.height;
      assert(
        heightRatio >= 0.77 && heightRatio <= 0.83,
        `exam reference height ratio at ${width}px was ${heightRatio}`,
      );
      assert(
        Math.abs(examReference.width - standardReference.width) <= 2,
        `exam reference width at ${width}px was ${examReference.width}px versus ${standardReference.width}px`,
      );
    }

    await page.goto(origin + '/exam/op-amp');
    await ready();
    await page.reload();
    await ready();
    assert.equal(await frame.locator('#componentList option').count(), 1);

    await page.goto(origin + '/operational-amplifier/simulator');
    await ready();
    assert.equal(
      await frame
        .locator('html')
        .evaluate((element) => element.classList.contains('exam-mode')),
      false,
    );
    assert(await frame.locator('.preset-controls').isVisible());
    assert(await frame.locator('#saveLabBtn').isVisible());
    assert(await frame.locator('#recallLabBtn').isVisible());
    assert(await frame.locator('#challengeMode').isVisible());
    assert(await frame.locator('[data-action="saveRecall"]').isVisible());
    assert(
      await page
        .getByRole('link', { name: /Download offline simulator/ })
        .isVisible(),
    );
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.reload();
    await ready();
    assert.equal(
      await frame.locator('#pinGuide').evaluate((element) => element.open),
      false,
    );
    await frame.locator('#pinGuide > summary').click();
    assert.equal(
      await frame.locator('#pinGuide').evaluate((element) => element.open),
      true,
    );
    await frame.locator('#pinGuide > summary').click();
    assert.equal(
      await frame.locator('#pinGuide').evaluate((element) => element.open),
      false,
    );

    assert.deepEqual(errors, []);
    console.log(
      'PASS: direct exam route, password-locked presets, blank construction, references, instruments, restricted controls, reset, responsive layouts, reload, and standard simulator regression',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
