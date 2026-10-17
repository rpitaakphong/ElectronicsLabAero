const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const origin = process.env.APP_URL || 'http://127.0.0.1:3001';
const output = path.resolve('output/playwright/timer555');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
        viewport: { width: 1512, height: 1000 },
      }),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('dialog', (d) => d.accept());
    const frame = page.frameLocator('iframe');
    const ready = async () => {
      await frame.locator('#breadboardCanvas').waitFor();
      await page
        .getByRole('button', { name: 'Reset lab', exact: true })
        .waitFor();
    };
    const unlock = async () => {
      await frame.locator('#presetAccess summary').click();
      await frame.locator('#presetPassword').fill('wrong');
      await frame.locator('#presetUnlockForm button').click();
      assert(await frame.locator('#presetUnlockError').isVisible());
      await frame.locator('#presetPassword').fill('aero1234');
      await frame.locator('#presetUnlockForm button').click();
    };
    const load = async (name) => {
      await frame.locator('#presetSelect').selectOption(name);
      await frame.locator('#loadPresetBtn').click();
    };
    const measurement = async (name) =>
      frame
        .locator('#measurementRows tr')
        .filter({ hasText: name })
        .locator('td')
        .nth(2)
        .innerText();
    await page.goto(origin + '/555-timer');
    assert.equal(
      await page.getByRole('link', { name: 'Start learning' }).count(),
      1,
    );
    assert.equal(
      await page.getByRole('link', { name: 'Open simulator' }).count(),
      1,
    );
    await page.getByRole('link', { name: 'Start learning' }).click();
    await page.waitForURL('**/555-timer/learn');
    await page
      .getByRole('heading', { name: '555 Timer Interactive Learning' })
      .waitFor();
    await page.waitForFunction(
      () => {
        const row = [
          ...document.querySelectorAll('.timer-metric-table tbody tr'),
        ].find((r) => r.textContent.includes('Frequency'));
        return /68\./.test(row?.lastElementChild?.textContent || '');
      },
      {},
      { timeout: 12000 },
    );
    assert.equal(await page.locator('.timer-waveforms svg path').count(), 3);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.evaluate(() => {
      document.activeElement?.blur();
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: path.join(output, 'learning-astable-desktop.png'),
      fullPage: true,
    });
    await page.getByRole('button', { name: /Monostable one-shot/ }).click();
    await page
      .getByRole('button', { name: 'Trigger pulse', exact: true })
      .click();
    await page.waitForFunction(
      () => {
        const row = document.querySelector('.timer-metric-table tbody tr');
        return row?.lastElementChild?.textContent !== '—';
      },
      {},
      { timeout: 10000 },
    );
    assert.match(
      await page.locator('.timer-metric-table tbody tr').innerText(),
      /1\.09/,
    );
    await page.getByRole('checkbox', { name: 'Hold trigger low' }).check();
    await page.waitForTimeout(2500);
    assert.match(await page.locator('.timer-output-high').innerText(), /HIGH/);
    await page.getByRole('checkbox', { name: 'Hold trigger low' }).uncheck();
    await page.waitForFunction(
      () => !document.querySelector('.timer-output-high'),
    );
    await page.screenshot({
      path: path.join(output, 'learning-monostable-desktop.png'),
      fullPage: true,
    });
    for (const width of [1512, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `learning overflow at ${width}`,
      );
      await page.screenshot({
        path: path.join(output, `learning-${width}.png`),
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 1512, height: 1000 });
    await page.goto(origin + '/555-timer/simulator');
    await ready();
    assert.equal(await frame.locator('#componentList option').count(), 1);
    assert.equal(
      await frame
        .locator('#presetSelect option[value="astable"]')
        .evaluate((o) => o.disabled),
      true,
    );
    assert(await frame.locator('[data-tool="timer555"]').isVisible());
    assert(await frame.locator('[data-tool="pushbutton"]').isVisible());
    await unlock();
    await load('astable');
    await page.waitForFunction(
      () => {
        const d = document.querySelector('iframe').contentDocument;
        return /68\./.test(d.querySelector('#measurementRows').textContent);
      },
      {},
      { timeout: 10000 },
    );
    assert.match(await measurement('Frequency'), /68\./);
    assert.match(await measurement('Duty Cycle'), /52\./);
    await frame.locator('[data-action="autoset"]').click();
    assert.match(await frame.locator('#toast').innerText(), /fitted/);
    await frame.locator('#saveLabBtn').click();
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('timer555-v1-lab')),
    );
    assert.equal(saved.lab, 'timer555');
    assert.equal(saved.version, 1);
    assert.equal(
      saved.state.components.filter((c) => c.type === 'timer555').length,
      1,
    );
    // A board change must alter the actual oscillator, independently of the reference selection.
    const timingCap = saved.state.components.find(
      (c) => c.type === 'capacitor' && c.value === 1e-6,
    );
    await frame.locator('#componentList').selectOption(timingCap.id);
    await frame.locator('#editValue').fill('10u');
    await frame.locator('#editValue').dispatchEvent('change');
    await page.waitForTimeout(800);
    await frame.locator('[data-action="autoset"]').click();
    assert.match(
      await measurement('Frequency'),
      /6\.8/,
      'slow-frequency Autoset must support less than 20 Hz',
    );
    await frame.locator('#recallLabBtn').click();
    await page.waitForTimeout(400);
    await frame.locator('#saveLabBtn').click();
    assert.equal(
      await page.evaluate(
        (id) =>
          JSON.parse(
            localStorage.getItem('timer555-v1-lab'),
          ).state.components.find((c) => c.id === id).value,
        timingCap.id,
      ),
      1e-6,
    );
    const beforeInvalidRecall = await frame
      .locator('#componentList option')
      .allTextContents();
    await page.evaluate(
      (saved) =>
        localStorage.setItem(
          'timer555-v1-lab',
          JSON.stringify({ ...saved, version: 999 }),
        ),
      saved,
    );
    await frame.locator('#recallLabBtn').click();
    assert.match(await frame.locator('#toast').innerText(), /Cannot load lab/);
    assert.deepEqual(
      await frame.locator('#componentList option').allTextContents(),
      beforeInvalidRecall,
      'invalid recall must preserve construction',
    );
    await page.evaluate(
      (saved) => localStorage.setItem('timer555-v1-lab', JSON.stringify(saved)),
      saved,
    );
    assert.equal(
      await page.evaluate(() => localStorage.getItem('gds1202b-lab')),
      null,
      '555 saves must not write the op-amp namespace',
    );
    await load('monostable');
    await page.waitForTimeout(350);
    const buttonId = await frame
      .locator('#componentList option')
      .evaluateAll(
        (opts) => opts.find((o) => o.textContent.includes('pushbutton')).value,
      );
    await frame.locator('#componentList').selectOption(buttonId);
    await frame.locator('[data-action="single"]').click();
    assert(
      await frame
        .locator('[data-action="single"]')
        .evaluate((b) => b.classList.contains('active')),
    );
    await frame.locator('#timerPulseBtn').click();
    await page.waitForFunction(
      () => {
        const d = document.querySelector('iframe').contentDocument;
        return !d
          .querySelector('[data-action="single"]')
          .classList.contains('active');
      },
      {},
      { timeout: 10000 },
    );
    assert.match(await measurement('+Width'), /1\.09|1\.10/);
    assert.equal(await measurement('Frequency'), '—');
    const frozen = await frame
      .locator('#scopeCanvas')
      .evaluate((c) => c.toDataURL());
    const clockBefore = await frame.locator('#timerClock').innerText();
    await page.waitForTimeout(400);
    assert.notEqual(
      await frame.locator('#timerClock').innerText(),
      clockBefore,
      'circuit clock continues while scope is stopped',
    );
    assert.equal(
      await frame.locator('#scopeCanvas').evaluate((c) => c.toDataURL()),
      frozen,
      'stopped scope must retain its acquired record',
    );
    await frame.locator('[data-action="autoset"]').click();
    assert.match(
      await frame.locator('#toast').innerText(),
      /one-shot without retriggering/,
    );
    await page.screenshot({
      path: path.join(output, 'simulator-monostable-desktop.png'),
      fullPage: true,
    });
    // Arm again: the old pulse may not satisfy a new Single request.
    await frame.locator('[data-action="single"]').click();
    await page.waitForTimeout(300);
    assert(
      await frame
        .locator('[data-action="single"]')
        .evaluate((b) => b.classList.contains('active')),
    );
    await frame.locator('#timerPulseBtn').click();
    await page.waitForTimeout(3000);
    assert.equal(
      await frame
        .locator('[data-action="single"]')
        .evaluate((b) => b.classList.contains('active')),
      false,
    );
    for (const width of [1512, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `outer overflow at ${width}`,
      );
      assert.equal(
        await frame
          .locator('html')
          .evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
        `simulator overflow at ${width}`,
      );
      await page.screenshot({
        path: path.join(output, `simulator-${width}.png`),
        fullPage: true,
      });
    }
    await page.reload();
    await ready();
    assert.equal(await frame.locator('#componentList option').count(), 1);
    assert.equal(
      await frame
        .locator('#presetSelect option[value="astable"]')
        .evaluate((o) => o.disabled),
      true,
    );
    // Manual construction uses the shared editor, including occupancy and history.
    await page.setViewportSize({ width: 1512, height: 1000 });
    const canvas = frame.locator('#breadboardCanvas');
    const place = async (x, y) => {
      const box = await canvas.boundingBox();
      await canvas.click({
        position: { x: (x * box.width) / 1180, y: (y * box.height) / 620 },
      });
    };
    await frame.locator('[data-tool="timer555"]').click();
    await place(575, 300);
    assert.equal(await frame.locator('#componentList option').count(), 2);
    await frame.locator('[data-tool="resistor"]').click();
    await place(305, 180);
    await place(455, 180);
    assert.equal(await frame.locator('#componentList option').count(), 3);
    await frame.locator('#undoBtn').click();
    assert.equal(await frame.locator('#componentList option').count(), 2);
    await frame.locator('#redoBtn').click();
    assert.equal(await frame.locator('#componentList option').count(), 3);
    await frame.locator('[data-tool="wire"]').click();
    await place(215, 70);
    await place(215, 110);
    await page.waitForFunction(() =>
      document
        .querySelector('iframe')
        .contentDocument.querySelector('#circuitWarnings')
        .textContent.includes('shorted'),
    );
    await frame.locator('[data-action="single"]').click();
    assert.match(await frame.locator('#toast').innerText(), /shorted/);
    await frame.locator('#undoBtn').click();
    // Downloaded single-file edition must work without network access.
    const offline = await browser.newPage();
    offline.on('pageerror', (e) => errors.push(e.message));
    await offline.route('https://**', (route) => route.abort());
    await offline.goto(
      'file://' +
        path.resolve(
          'public/simulators/timer555/timer555_sim_single_file.html',
        ),
    );
    await offline.locator('#presetAccess summary').click();
    await offline.locator('#presetPassword').fill('aero1234');
    await offline.locator('#presetUnlockForm button').click();
    await offline.locator('#presetSelect').selectOption('astable');
    await offline.locator('#loadPresetBtn').click();
    await offline.waitForFunction(() =>
      /68\./.test(document.querySelector('#measurementRows').textContent),
    );
    await offline.close();
    assert.deepEqual(errors, []);
    console.log(
      'PASS: 555 learning, controls, timing, locked presets, actual breadboard construction, slow Autoset, one-shot Single, frozen scope, persistence, responsive layouts, and offline runtime',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
