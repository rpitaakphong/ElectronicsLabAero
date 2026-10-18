/* Real-browser layout checks for worksheet-only DIP-8 vector drawings. */
const playwright = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const output = path.resolve('output/playwright/dip8-diagrams');
const host = process.env.APP_URL || 'http://127.0.0.1:4174';
const variants = [
  [0, 'pins', '.dip8-pin-guide'],
  [1, 'schematic', '.astable-schematic'],
  [3, 'conversion-astable', '[data-conversion-mode="astable"]'],
  [3, 'conversion-monostable', '[data-conversion-mode="monostable"]'],
];
async function inspect(svg, kind) {
  assert.equal(await svg.locator('[data-chip-layout="dip8-top"]').count(), 1);
  assert.equal(await svg.locator('[data-pin]').count(), 8);
  assert.equal(await svg.locator('[data-notch="top"]').count(), 1);
  assert.equal(await svg.locator('[data-pin1-dot]').count(), 1);
  if (kind !== 'pins') {
    assert.equal(
      await svg.locator('[data-component="control-bypass"]').count(),
      0,
    );
    assert.equal(
      await svg.locator('[data-component="supply-bypass"]').count(),
      1,
    );
    assert.equal(await svg.locator('[data-open-pin="5"]').count(), 1);
    assert.equal(
      await svg.locator('[data-component="trigger-pullup"]').count(),
      kind === 'conversion-monostable' ? 1 : 0,
    );
  }
  const layout = await svg.evaluate((el) => {
    const view = el.viewBox.baseVal;
    const labels = [...el.querySelectorAll('text')].map((text) => ({
      label: text.textContent,
      box: text.getBBox(),
    }));
    const clipped = labels
      .filter(
        ({ box: b }) =>
          b.x < view.x ||
          b.y < view.y ||
          b.x + b.width > view.x + view.width ||
          b.y + b.height > view.y + view.height,
      )
      .map((t) => t.label);
    const overlaps = [];
    for (let i = 0; i < labels.length; i++)
      for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i].box,
          b = labels[j].box;
        if (
          Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 &&
          Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1
        )
          overlaps.push([labels[i].label, labels[j].label]);
      }
    return { clipped, overlaps };
  });
  assert.deepEqual(
    layout,
    { clipped: [], overlaps: [] },
    `${kind} labels must fit without overlapping`,
  );
}
(async () => {
  await fs.mkdir(output, { recursive: true });
  for (const engine of ['chromium', 'firefox', 'webkit']) {
    const browser = await playwright[engine].launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(`${host}/worksheets/555-main-lab.html`);
      await page.locator('#main h1').waitFor();
      for (const width of [1448, 768, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const [step, kind, selector] of variants) {
          if (await page.locator('#menu-button').isVisible())
            await page.locator('#menu-button').click();
          await page.locator(`#steps [data-step="${step}"]`).click();
          if (
            (await page
              .locator('#menu-button')
              .getAttribute('aria-expanded')) === 'true'
          )
            await page.keyboard.press('Escape');
          const svg = page.locator(`#main ${selector}`);
          await inspect(svg, kind);
          if (kind === 'schematic') {
            const scale = await svg.evaluate((el) => {
              const current = el.getBoundingClientRect();
              const previousStyle = el.getAttribute('style');
              el.style.width = '100%';
              el.style.minWidth = '740px';
              el.style.maxWidth = '1100px';
              const original = el.getBoundingClientRect();
              if (previousStyle === null) el.removeAttribute('style');
              else el.setAttribute('style', previousStyle);
              return {
                width: current.width / original.width,
                height: current.height / original.height,
              };
            });
            assert(
              Math.abs(scale.width - 0.6) < 0.005 &&
                Math.abs(scale.height - 0.6) < 0.005,
              'Inline astable diagram must be 40% smaller in both dimensions',
            );
          }
          if (kind === 'conversion-astable') {
            const cards = await page
              .locator('.conversion-card')
              .evaluateAll((els) =>
                els.map((el) => {
                  const { x, y, width, height } = el.getBoundingClientRect();
                  return { x, y, width, height };
                }),
              );
            if (width > 1100) {
              assert(
                Math.abs(cards[0].y - cards[1].y) < 1,
                'Desktop comparisons must share one row',
              );
              assert(
                cards[1].x >= cards[0].x + cards[0].width,
                'Comparison cards must sit side by side',
              );
              assert(
                await svg
                  .locator('..')
                  .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
                'Desktop figures must fit their cards',
              );
            } else
              assert(
                cards[1].y >= cards[0].y + cards[0].height,
                'Narrow screens must stack the comparison cards',
              );
            await page.locator('.conversion-grid').screenshot({
              path: path.join(output, `${engine}-${width}-comparison-row.png`),
              animations: 'disabled',
              style:
                '.topbar, footer, #toast { visibility: hidden !important; }',
            });
          }
          assert(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
          );
          await svg.locator('..').screenshot({
            path: path.join(output, `${engine}-${width}-${kind}.png`),
            animations: 'disabled',
            style: '.topbar, footer, #toast { visibility: hidden !important; }',
          });
          const region = svg.locator('..');
          if (width === 390) {
            // Every pin remains reachable using the diagram's own horizontal scroll.
            await region.focus();
            await page.keyboard.press('ArrowRight');
            assert(await region.evaluate((el) => el.scrollLeft > 0));
            await region.evaluate((el) => (el.scrollLeft = el.scrollWidth));
            assert(await region.evaluate((el) => el.scrollLeft > 0));
          }
          await page.locator(`[data-expand="${kind}"]`).click();
          await page.locator('#dialog[open]').waitFor();
          const enlarged = page.locator(`#dialog ${selector}`);
          await inspect(enlarged, kind);
          assert.equal(
            await enlarged.evaluate((el) => el.getBoundingClientRect().width),
            kind === 'pins' ? 650 : 1100,
          );
          const enlargedRegion = page.locator('.expanded-diagram');
          if (width === 390) {
            await enlargedRegion.focus();
            await page.keyboard.press('ArrowRight');
            await page.waitForFunction(
              () => document.querySelector('.expanded-diagram').scrollLeft > 0,
            );
            await enlargedRegion.evaluate(
              (el) => (el.scrollLeft = el.scrollWidth),
            );
            assert(await enlargedRegion.evaluate((el) => el.scrollLeft > 0));
          }
          await enlargedRegion.evaluate(
            (el) => (el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2),
          );
          await page.locator('#dialog').screenshot({
            path: path.join(output, `${engine}-${width}-${kind}-enlarged.png`),
            animations: 'disabled',
          });
          await page.keyboard.press('Escape');
        }
        const guide = page.locator('.button-guide');
        const buttonImage = guide.locator('img');
        await buttonImage.scrollIntoViewIfNeeded();
        await buttonImage.evaluate((img) => img.decode());
        const imageInfo = await buttonImage.evaluate((img) => ({
          embedded: img.src.startsWith('data:image/png;base64,'),
          width: img.naturalWidth,
          height: img.naturalHeight,
          renderedWidth: img.getBoundingClientRect().width,
          containerWidth: img.parentElement.getBoundingClientRect().width,
          centered:
            Math.abs(
              (img.getBoundingClientRect().left +
                img.getBoundingClientRect().right) /
                2 -
                (img.parentElement.getBoundingClientRect().left +
                  img.parentElement.getBoundingClientRect().right) /
                  2,
            ) < 1,
          fits:
            img.getBoundingClientRect().width <=
            img.parentElement.getBoundingClientRect().width + 1,
          ratio:
            img.getBoundingClientRect().width /
            img.getBoundingClientRect().height,
        }));
        assert(imageInfo.embedded && imageInfo.fits);
        assert(imageInfo.centered);
        assert(
          Math.abs(
            imageInfo.renderedWidth - Math.min(450, imageInfo.containerWidth),
          ) < 1,
          'Inline button image must cap at 450 px and shrink to fit smaller containers',
        );
        assert.equal(imageInfo.width, 1380);
        assert.equal(imageInfo.height, 644);
        assert(Math.abs(imageInfo.ratio - 1380 / 644) < 0.01);
        await guide.screenshot({
          path: path.join(output, `${engine}-${width}-pushbutton.png`),
          animations: 'disabled',
          style: '.topbar, footer, #toast { visibility: hidden !important; }',
        });
        await guide.locator('[data-expand="pushbutton"]').click();
        const enlargedButton = page.locator('#dialog .pushbutton-image');
        await enlargedButton.evaluate((img) => img.decode());
        assert.equal(
          await enlargedButton.evaluate(
            (img) => img.getBoundingClientRect().width,
          ),
          1000,
        );
        assert.equal(
          await enlargedButton.getAttribute('src'),
          await buttonImage.getAttribute('src'),
        );
        await page.keyboard.press('Escape');
      }
      assert.deepEqual(errors, []);
      console.log(
        `PASS ${engine}: DIP-8 drawings and embedded pushbutton guide, normal/enlarged, desktop/tablet/phone, correct image bytes/aspect ratio, unclipped labels and local scrolling`,
      );
    } finally {
      await context.close();
      await browser.close();
    }
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
