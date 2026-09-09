const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const origin = process.env.APP_URL || 'http://127.0.0.1:3000';
const output = path.resolve('output/playwright/divider-integration');
const key = 'voltage-divider-v1-lab';
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1512, height: 1100 },
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const frame = () => page.frameLocator('iframe');
    const ready = async () => {
      await frame().locator('#meterReading').waitFor();
      await page.waitForFunction(() => {
        const f = document.querySelector('iframe');
        return (
          Math.abs(
            f.clientHeight -
              f.contentDocument.body.getBoundingClientRect().height,
          ) < 2
        );
      });
    };
    const unlock = async () => {
      await frame().locator('#presetAccess summary').click();
      await frame().locator('#presetPassword').fill('wrong');
      await frame().locator('#presetUnlockForm button').click();
      assert.equal(
        await frame().locator('#presetUnlockError').isVisible(),
        true,
      );
      await frame().locator('#presetPassword').fill('aero1234');
      await frame().locator('#presetUnlockForm button').click();
    };
    const load = async (name) => {
      await frame().locator('#presetSelect').selectOption(name);
      await frame().locator('#loadPresetBtn').click();
    };
    const reading = () => frame().locator('#meterReading').textContent();
    const save = async () => {
      await frame().locator('#saveLabBtn').click();
      return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
    };
    const select = (id) => frame().locator('#componentList').selectOption(id);
    const hole = async (row, col) => {
      const canvas = frame().locator('#breadboardCanvas');
      await canvas.scrollIntoViewIfNeeded();
      const box = await canvas.boundingBox();
      const rows = {
        VPLUS: 70,
        GND_TOP: 110,
        A: 180,
        B: 210,
        C: 240,
        D: 270,
        E: 300,
        F: 350,
        G: 380,
        H: 410,
        I: 440,
        J: 470,
        GND_BOTTOM: 510,
        VMINUS: 550,
      };
      return {
        x: box.x + ((155 + (col - 1) * 30) * box.width) / 1180,
        y: box.y + (rows[row] * box.height) / 620,
      };
    };
    const tap = async (row, col) => {
      const p = await hole(row, col);
      await page.mouse.click(p.x, p.y);
    };
    const tool = (name) => frame().locator(`[data-tool="${name}"]`).click();

    await page.goto(origin);
    await page.getByRole('link', { name: 'Browse topics', exact: true }).click();
    await page
      .getByRole('link', { name: 'Open Voltage Divider topic' })
      .click();
    await page.getByRole('link', { name: /Start learning/ }).click();
    await page.getByRole('radio', { name: /Loaded divider/ }).click();
    await page
      .getByRole('link', { name: 'Voltage Divider', exact: true })
      .click();
    await page.getByRole('link', { name: /Open simulator/ }).click();
    await ready();
    assert.equal(await frame().locator('#componentList option').count(), 1);
    assert.equal(await frame().locator('#dcOutput').isChecked(), false);
    assert.equal(
      await frame()
        .locator('.scope-section,.generator-section,[data-tool="opamp"]')
        .count(),
      0,
    );
    const blank = await save();
    await frame().locator('#schematicSelect').selectOption('potentiometer');
    assert.deepEqual(await save(), blank);
    await unlock();
    assert.deepEqual(await save(), blank);

    for (const [name, expected] of [
      ['basic', '2.5V'],
      ['loaded', '1.667V'],
      ['potentiometer', '2.5V'],
      ['sensor', '2.5V'],
    ]) {
      await load(name);
      assert.equal(await reading(), expected);
    }
    await load('basic');
    const original = await save();
    // Probes measure across the upper resistor without grounding the midpoint.
    await tool('meterRed');
    await tap('C', 6);
    await tool('meterBlack');
    await tap('D', 12);
    assert.equal(await reading(), '2.5V');
    // Insert the ammeter between the top resistor and the supply strip.
    await select(
      original.state.components.find((c) => c.type === 'resistor').id,
    );
    await frame().locator('#moveA').click();
    await tap('A', 8);
    await tool('meterRed');
    await tap('C', 6);
    await tool('meterBlack');
    await tap('C', 8);
    await frame().locator('#meterMode').selectOption('current');
    assert.equal(await reading(), '250µA');
    // A direct ammeter across the source is a fault, including stale-reading cleanup.
    await tool('meterBlack');
    await tap('B', 20);
    assert.equal(await reading(), '—');
    assert.match(
      await frame().locator('#meterMessage').textContent(),
      /shorts the supply/,
    );
    await frame().locator('#meterMode').selectOption('resistance');
    assert.equal(await reading(), '—');
    assert.match(await frame().locator('#meterMessage').textContent(), /OFF/);
    await load('loaded');
    await frame().locator('#dcOutput').uncheck();
    await frame().locator('#meterMode').selectOption('resistance');
    assert.equal(await reading(), '5kΩ');

    await load('potentiometer');
    let snapshot = await save();
    const pot = snapshot.state.components.find(
      (c) => c.type === 'potentiometer',
    );
    await select(pot.id);
    await frame().locator('#editWiper').fill('100');
    await frame().locator('#editWiper').dispatchEvent('change');
    assert.equal(await reading(), '5V');
    await frame().locator('#editWiper').fill('0');
    await frame().locator('#editWiper').dispatchEvent('change');
    assert.equal(await reading(), '0V');
    await frame().locator('#undoBtn').click();
    assert.equal(await reading(), '5V');
    await select(pot.id);
    await frame().locator('#moveW').click();
    await tap('D', 12);
    snapshot = await save();
    assert.deepEqual(
      snapshot.state.components.find((c) => c.id === pot.id).wHole,
      { row: 'D', col: 12 },
    );
    // Move the entire three-terminal component and undo all terminal changes together.
    await frame().locator('#nudgeRight').click();
    let moved = await save();
    for (const end of ['a', 'b', 'w'])
      assert.equal(
        moved.state.components.find((c) => c.id === pot.id)[end + 'Hole'].col,
        snapshot.state.components.find((c) => c.id === pot.id)[end + 'Hole']
          .col + 1,
      );
    await frame().locator('#undoBtn').click();
    assert.deepEqual(await save(), snapshot);

    await load('sensor');
    snapshot = await save();
    const sensor = snapshot.state.components.find(
      (c) => c.variant === 'sensor',
    );
    await select(sensor.id);
    await frame().locator('#editValue').fill('100k');
    await frame().locator('#editValue').press('Tab');
    assert.equal(await reading(), '4.545V');
    await frame().locator('#editValue').fill('99');
    await frame().locator('#editValue').press('Tab');
    assert.equal(await reading(), '4.545V');
    snapshot = await save();
    await page.evaluate(() =>
      localStorage.setItem(
        'gds1202b-lab',
        JSON.stringify({ sentinel: 'opamp save' }),
      ),
    );
    await page.reload();
    await ready();
    assert.equal(await frame().locator('#componentList option').count(), 1);
    assert.equal(await frame().locator('#presetAccess').isVisible(), true);
    await frame().locator('#recallLabBtn').click();
    assert.equal(await reading(), '4.545V');
    assert.deepEqual(await save(), snapshot);
    assert.deepEqual(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem('gds1202b-lab')),
      ),
      { sentinel: 'opamp save' },
    );
    await page.evaluate(
      (key) => localStorage.setItem(key, '{"lab":"opamp","version":1}'),
      key,
    );
    await frame().locator('#recallLabBtn').click();
    assert.equal(await reading(), '4.545V');
    await page.getByRole('button', { name: 'Reset lab', exact: true }).click();
    // A partially placed potentiometer is canceled as one gesture.
    await tool('potentiometer');
    await tap('A', 6);
    await tap('A', 15);
    await page.keyboard.press('Escape');
    assert.equal(await frame().locator('#componentList option').count(), 1);
    await tool('potentiometer');
    await tap('A', 6);
    await tap('A', 15);
    await tap('C', 10);
    assert.equal(await frame().locator('#componentList option').count(), 2);
    snapshot = await save();
    assert.equal(snapshot.state.components[0].w, 'T:10');
    await tool('resistor');
    await tap('A', 6);
    assert.match(await frame().locator('#toast').textContent(), /occupied/);
    await page.keyboard.press('Escape');
    await select(snapshot.state.components[0].id);
    await frame().locator('#breadboardCanvas').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal((await save()).state.components[0].wHole.col, 11);

    await unlock();
    // Custom presets, overrides and blank startup stay independent of saved examples.
    await load('basic');
    await frame().locator('.preset-manager > summary').click();
    await frame().locator('#newPresetName').fill('My divider');
    await frame().locator('#createPresetBtn').click();
    const custom = await frame().locator('#presetSelect').inputValue();
    assert.match(custom, /^custom-/);
    await load('blank');
    await frame().locator('#recallLabBtn').click();
    await frame().locator('#savePresetBtn').click();
    await page.reload();
    await ready();
    assert.equal(await frame().locator('#componentList option').count(), 1);
    await unlock();
    await load(custom);
    assert.equal(await reading(), '2.5V');

    for (const width of [1512, 1024, 390]) {
      await page.setViewportSize({ width, height: 1100 });
      for (const name of ['basic', 'loaded', 'potentiometer', 'sensor']) {
        await load(name);
        await ready();
        await frame()
          .locator('.breadboard-wrap')
          .screenshot({
            path: path.join(output, `board-${width}-${name}.png`),
          });
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        assert.equal(
          await frame()
            .locator('html')
            .evaluate((el) => el.scrollWidth > innerWidth),
          false,
        );
      }
      await page.waitForFunction(
        () =>
          !document
            .querySelector('iframe')
            .contentDocument.querySelector('#toast')
            .classList.contains('show'),
      );
      await frame()
        .locator('.breadboard-wrap')
        .screenshot({ path: path.join(output, `board-${width}.png`) });
      await page.screenshot({
        path: path.join(output, `simulator-${width}.png`),
        fullPage: true,
      });
    }
    // Download is the actual artifact, opened without network dependencies.
    const downloaded = page.waitForEvent('download');
    await page.getByRole('link', { name: /Download offline/ }).click();
    const download = await downloaded,
      offlinePath = path.join(output, download.suggestedFilename());
    await download.saveAs(offlinePath);
    const offline = await browser.newPage(),
      requests = [];
    offline.on('pageerror', (e) => errors.push(e.message));
    offline.on('request', (r) => {
      if (/^https?:/.test(r.url())) requests.push(r.url());
    });
    await offline.goto('file://' + offlinePath);
    assert.equal(await offline.locator('#componentList option').count(), 1);
    await offline.locator('#presetAccess summary').click();
    await offline.locator('#presetPassword').fill('aero1234');
    await offline.locator('#presetUnlockForm button').click();
    await offline.locator('#presetSelect').selectOption('loaded');
    await offline.locator('#loadPresetBtn').click();
    assert.equal(
      await offline.locator('#meterReading').textContent(),
      '1.667V',
    );
    assert.deepEqual(requests, []);
    for (const route of [
      '/voltage-divider',
      '/voltage-divider/learn',
      '/voltage-divider/simulator',
    ]) {
      await page.goto(origin + route);
      await page.reload();
      assert.equal(
        await page.getByRole('heading', { name: 'Page not found' }).count(),
        0,
      );
    }
    await page.goBack();
    await page.goForward();
    await ready();
    assert.deepEqual(errors, []);
    console.log(
      'PASS: divider wiring, V/A/Ω, four presets, faults, wiper/sensor edits, history, occupancy, persistence isolation, locking, responsive routes, and offline download',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
