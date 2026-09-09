const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const origin = process.env.APP_URL || 'http://127.0.0.1:3000';
const output = path.resolve('output/playwright/navigation');
fs.mkdirSync(output, { recursive: true });
const destinations = [
  ['/topics', 'Learning Topics'],
  ['/voltage-divider', 'Voltage Divider'],
  ['/voltage-divider/learn', 'Voltage Divider Interactive Learning'],
  ['/voltage-divider/simulator', 'Voltage Divider Lab Simulator'],
  ['/rc-filter', 'RC Filter'],
  ['/rc-filter/learn', 'RC Filter Interactive Learning'],
  ['/rc-filter/simulator', 'RC Filter Lab Simulator'],
  ['/operational-amplifier', 'Operational Amplifier'],
  ['/operational-amplifier/learn', 'Op-Amp Interactive Learning'],
  ['/operational-amplifier/simulator', 'Op-Amp Lab Simulator'],
];
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1512, height: 1000 },
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const mobile = () => page.viewportSize().width < 900;
    const trigger = () =>
      page.getByRole('button', {
        name: mobile() ? 'Open navigation menu' : 'Topics',
        exact: true,
      });
    const menu = () =>
      page.getByRole('navigation', {
        name: mobile() ? 'Mobile navigation' : 'Topic shortcuts',
      });
    const openMenu = async () => {
      await trigger().click();
      await menu().waitFor();
      await page.waitForFunction(() => {
        const popup = document.querySelector(
          '[data-slot="sheet-content"], [data-slot="popover-content"]',
        );
        return (
          popup &&
          getComputedStyle(popup).opacity === '1' &&
          !popup.hasAttribute('data-starting-style')
        );
      });
    };
    const closeMenu = async () => {
      await page.keyboard.press('Escape');
      await menu().waitFor({ state: 'hidden' });
      assert(
        await trigger().evaluate((el) => el === document.activeElement),
        'Escape restores trigger focus',
      );
    };
    const destinationReady = async (url, title) => {
      await page.waitForURL(origin + url);
      await page.waitForFunction(
        (title) => document.title === `${title} | Electronics Lab`,
        title,
      );
      assert.equal(await page.getByRole('main').count(), 1);
      assert.equal(await page.getByRole('banner').count(), 1);
      assert.equal(await page.locator('h1').count(), 1);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      if (url.endsWith('/simulator'))
        await page
          .frameLocator('iframe')
          .locator('#breadboardCanvas')
          .waitFor();
    };
    await page.goto(origin);
    await page.keyboard.press('Tab');
    assert.equal(await page.locator(':focus').textContent(), 'Skip to content');
    await page.keyboard.press('Enter');
    assert.equal(
      await page.locator(':focus').getAttribute('id'),
      'main-content',
    );
    await page
      .getByRole('navigation', { name: 'Main navigation', exact: true })
      .getByRole('link', { name: 'Resources', exact: true })
      .click();
    await page
      .getByRole('link', { name: 'Getting started', exact: true })
      .click();
    await page.waitForURL('**/resources#getting-started');
    await page.waitForFunction(
      () => document.activeElement.id === 'getting-started',
    );
    assert(
      await page
        .locator('#getting-started')
        .evaluate(
          (el) =>
            el.getBoundingClientRect().top >=
            document.querySelector('.site-header').getBoundingClientRect()
              .bottom,
        ),
    );
    await page.getByRole('link', { name: 'Electronics Lab home' }).click();
    await page
      .getByRole('link', { name: 'Browse topics', exact: true })
      .click();
    await page
      .getByRole('link', { name: 'Open Voltage Divider topic', exact: true })
      .click();
    await destinationReady('/voltage-divider', 'Voltage Divider');
    await page
      .getByRole('navigation', { name: 'Breadcrumb' })
      .getByRole('link', { name: 'Topics', exact: true })
      .click();
    const search = page.getByRole('searchbox', { name: 'Search topics' });
    await search.fill('  SENSOR ');
    assert.equal(await page.locator('.topic-card').count(), 1);
    assert(
      await page
        .getByRole('link', { name: 'Open Voltage Divider topic' })
        .isVisible(),
    );
    await page
      .getByRole('button', { name: 'Clear search', exact: true })
      .click();
    assert.equal(await page.locator('.topic-card').count(), 3);
    assert(await search.evaluate((el) => el === document.activeElement));
    await search.fill('no such circuit');
    assert(
      await page.getByRole('heading', { name: 'No topics found' }).isVisible(),
    );
    await page.getByRole('button', { name: 'Show all topics' }).click();
    assert.equal(await search.inputValue(), '');

    for (const width of [1512, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const [url, title] of [
        ['/', 'Welcome'],
        ['/topics', 'Learning Topics'],
        ['/resources', 'Resources'],
      ]) {
        await page.goto(origin + url);
        await destinationReady(url, title);
        await page.screenshot({
          path: path.join(
            output,
            `${title.toLowerCase().replaceAll(' ', '-')}-${width}.png`,
          ),
          fullPage: true,
        });
      }
      await openMenu();
      await page.screenshot({ path: path.join(output, `menu-${width}.png`) });
      if (mobile()) {
        for (let i = 0; i < 25; i++) {
          await page.keyboard.press('Tab');
          await page.waitForFunction(
            () =>
              document
                .querySelector('[data-slot="sheet-content"]')
                ?.contains(document.activeElement),
            undefined,
            { timeout: 2000 },
          );
        }
      }
      await closeMenu();
      if (mobile()) {
        await openMenu();
        await page.getByRole('button', { name: 'Close', exact: true }).click();
        await menu().waitFor({ state: 'hidden' });
        assert(await trigger().evaluate((el) => el === document.activeElement));
      }
      for (const [url, title] of destinations) {
        await openMenu();
        await menu().locator(`a[href="${url}"]`).click();
        await destinationReady(url, title);
        await menu().waitFor({ state: 'hidden' });
        await openMenu();
        assert.equal(await menu().locator('a[aria-current="page"]').count(), 1);
        assert.equal(
          await menu().locator('a[aria-current="page"]').getAttribute('href'),
          url,
        );
        await closeMenu();
        const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
        assert.deepEqual(
          await crumbs.locator('li').allTextContents(),
          url.split('/').length === 3
            ? [
                'Home',
                'Topics',
                url.includes('voltage-divider')
                  ? 'Voltage Divider'
                  : url.includes('rc-filter') ? 'RC Filter' : 'Operational Amplifier',
                url.endsWith('/learn') ? 'Interactive Learning' : 'Simulator',
              ]
            : url === '/topics'
              ? ['Home', 'Topics']
              : ['Home', 'Topics', title],
        );
      }
      for (const [url, label] of [
        ['/resources', 'Resources'],
        ['/', 'Home'],
      ]) {
        if (mobile()) await openMenu();
        await page
          .getByRole('navigation', {
            name: mobile() ? 'Mobile navigation' : 'Main navigation',
            exact: true,
          })
          .getByRole('link', { name: label, exact: true })
          .click();
        await destinationReady(url, url === '/' ? 'Welcome' : 'Resources');
        await menu().waitFor({ state: 'hidden' });
      }
      // Each lesson retains edits while navigation opens and dismisses.
      for (const [url, field, value] of [
        ['/voltage-divider/learn', 'Input voltage', '12'],
        ['/operational-amplifier/learn', 'Input 1 amplitude', '1.25'],
      ]) {
        await page.goto(origin + url);
        await page
          .getByRole('spinbutton', { name: field, exact: true })
          .fill(value);
        await page
          .getByRole('spinbutton', { name: field, exact: true })
          .press('Tab');
        await openMenu();
        await closeMenu();
        assert.equal(
          await page
            .getByRole('spinbutton', { name: field, exact: true })
            .inputValue(),
          value,
        );
      }
      // Unsaved circuit, supply, session unlock and iframe identity must survive either menu.
      await page.goto(origin + '/voltage-divider/simulator');
      const frame = page.frameLocator('iframe');
      await frame.locator('#breadboardCanvas').waitFor();
      await frame.locator('#presetAccess summary').click();
      await frame.locator('#presetPassword').fill('aero1234');
      await frame.locator('#presetUnlockForm button').click();
      await frame.locator('#presetSelect').selectOption('basic');
      await frame.locator('#loadPresetBtn').click();
      const resistor = await frame
        .locator('#componentList option')
        .filter({ hasText: 'resistor' })
        .first()
        .getAttribute('value');
      await frame.locator('#componentList').selectOption(resistor);
      await frame.locator('#editValue').fill('22000');
      await frame.locator('#editValue').press('Tab');
      await page.evaluate(() => {
        window.navigationTestFrame = document.querySelector('iframe');
        window.navigationTestDocument =
          window.navigationTestFrame.contentDocument;
      });
      const before = await frame.locator('#meterReading').textContent();
      await openMenu();
      await closeMenu();
      await openMenu();
      await menu().locator('a[href="/voltage-divider/simulator"]').click();
      await menu().waitFor({ state: 'hidden' });
      assert(
        await page.evaluate(
          () =>
            document.querySelector('iframe') === window.navigationTestFrame &&
            window.navigationTestFrame.contentDocument ===
              window.navigationTestDocument,
        ),
      );
      assert.equal(await frame.locator('#editValue').inputValue(), '22000');
      assert.equal(await frame.locator('#meterReading').textContent(), before);
      assert.equal(await frame.locator('#presetSelect').isDisabled(), false);
      await frame.locator('#saveLabBtn').click();
      const toast = await frame.locator('#toast').boundingBox();
      const header = await page.locator('.site-header').boundingBox();
      assert(
        toast.y >= header.height && toast.y + toast.height <= 1000,
        'feedback remains below sticky header and inside viewport',
      );
      await frame.locator('#dcVoltage').focus();
      const focused = await frame.locator('#dcVoltage').boundingBox();
      assert(
        focused.y >= header.height,
        'focused simulator controls clear the sticky header',
      );
      assert.equal((await page.locator('iframe').boundingBox()).width, width);
      assert.equal((await page.locator('.site-header').boundingBox()).y, 0);
      await page.screenshot({
        path: path.join(output, `simulator-sticky-${width}.png`),
      });
      await page.goto(origin + '/operational-amplifier/simulator');
      await frame.locator('#frequencyInput').fill('2000');
      await frame.locator('#frequencyInput').press('Tab');
      const opampDocument = await page
        .locator('iframe')
        .evaluateHandle((el) => el.contentDocument);
      await openMenu();
      await closeMenu();
      assert.equal(await frame.locator('#frequencyInput').inputValue(), '2000');
      assert(
        await page
          .locator('iframe')
          .evaluate((el, doc) => el.contentDocument === doc, opampDocument),
      );
      await opampDocument.dispose();
    }
    await page.goto(origin + '/resources');
    for (const name of [
      'Voltage Divider Lab Simulator',
      'RC Filter Lab Simulator',
      'Op-Amp Lab Simulator',
    ]) {
      const downloadEvent = page.waitForEvent('download');
      await page
        .getByRole('link', { name: `Download ${name}`, exact: true })
        .click();
      const download = await downloadEvent;
      assert.match(download.suggestedFilename(), /_single_file\.html$/);
      assert.equal(await download.failure(), null);
    }
    await page.goto(origin + '/voltage-divider/learn');
    await page
      .getByRole('navigation', { name: 'Breadcrumb' })
      .getByRole('link', { name: 'Topics', exact: true })
      .click();
    await page.goBack();
    await destinationReady(
      '/voltage-divider/learn',
      'Voltage Divider Interactive Learning',
    );
    await page.goForward();
    await destinationReady('/topics', 'Learning Topics');
    await page.reload();
    await destinationReady('/topics', 'Learning Topics');
    await page.goto(origin + '/not-a-route');
    assert(
      await page.getByRole('heading', { name: 'Page not found' }).isVisible(),
    );
    await page.getByRole('link', { name: /Go to all topics/ }).click();
    await destinationReady('/topics', 'Learning Topics');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openMenu();
    assert.equal(
      await page
        .locator('[data-slot="sheet-content"]')
        .evaluate((el) => getComputedStyle(el).transitionDuration),
      '0s',
    );
    await closeMenu();
    assert.deepEqual(errors, []);
    console.log(
      'PASS: welcome, search, resources, all menu destinations at four widths, exact active links, breadcrumbs, keyboard/focus, skip link, history/reload, unknown routes, reduced motion, lesson and iframe/circuit preservation, sticky controls and feedback',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
