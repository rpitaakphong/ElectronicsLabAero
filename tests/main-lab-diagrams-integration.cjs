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
      }
      assert.deepEqual(errors, []);
      console.log(
        `PASS ${engine}: DIP-8 pin guide and all circuit drawings, normal/enlarged, desktop/tablet/phone, unclipped non-overlapping labels, local scrolling`,
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
