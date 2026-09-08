const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.SIMULATOR_URL || 'http://127.0.0.1:3000/simulators/opamp/';
const fixture = JSON.parse(fs.readFileSync('tests/fixtures/legacy-pinout.json')).presets.inverting.snapshot;
const raw = JSON.stringify(fixture);

(async () => {
  const browser = await chromium.launch();
  try {
    const entries = [
      ['standalone', base + 'index.html'],
      ['embedded', new URL('/operational-amplifier/simulator', base).href],
      ['offline', 'file://' + path.resolve(process.env.SIMULATOR_OFFLINE_PATH || 'gds1202b_opamp_sim_single_file.html')],
    ];
    for (const [name, url] of entries) {
      const page = await browser.newPage({ viewport: { width: 1512, height: 1000 } });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(raw => {
        localStorage.setItem('gds1202b-preset-blank', raw);
        localStorage.setItem('gds1202b-preset-inverting', raw);
        localStorage.setItem('gds1202b-preset-custom-example', raw);
        localStorage.setItem('gds1202b-custom-presets', JSON.stringify([{ id: 'custom-example', name: 'Saved example' }]));
      }, raw);
      await page.goto(url);
      const ui = name === 'embedded' ? page.frameLocator('iframe') : page;
      await ui.locator('#presetSelect').waitFor();
      const storage = () => ui.locator('html').evaluate(() => JSON.stringify({ ...localStorage }));
      const startingStorage = await storage();
      const assertBlankLocked = async () => {
        // The parent can finish loading before a newly mounted iframe runs app.js.
        await ui.locator('#componentList option').first().waitFor({ state: 'attached' });
        assert.equal(await ui.locator('#presetSelect').inputValue(), 'blank');
        assert.equal(await ui.locator('#componentList option').count(), 1, `${name}: saved circuit leaked at startup`);
        assert.equal(await ui.locator('#presetSelect option:disabled').count(), 6);
        assert.equal(await ui.locator('.preset-manager').isVisible(), false);
        assert.equal(await ui.locator('#frequencyInput').inputValue(), '1000');
      };
      await assertBlankLocked();
      await ui.locator('#loadPresetBtn').click();
      await assertBlankLocked();
      assert.equal(await storage(), startingStorage, 'ignored saved originals must remain untouched');
      // Removing the visual disabled flag does not bypass the load guard.
      await ui.locator('#presetSelect').evaluate(el => {
        el.querySelector('[value=inverting]').disabled = false;
        el.value = 'inverting';
      });
      await ui.locator('#loadPresetBtn').click();
      assert.equal(await ui.locator('#componentList option').count(), 1);
      await ui.locator('#presetSelect').selectOption('blank');

      // Students can build and save/recall their own work while presets are locked.
      await ui.locator('[data-tool=resistor]').click();
      const canvas = ui.locator('#breadboardCanvas');
      for (const x of [215, 335]) {
        const box = await canvas.boundingBox();
        await canvas.click({ position: { x: x * box.width / 1180, y: 180 * box.height / 620 } });
      }
      await ui.locator('#saveLabBtn').click();
      const savedState = await ui.locator('html').evaluate(() => JSON.parse(localStorage.getItem('gds1202b-lab')).state);
      assert.equal(savedState.components.length, 1);
      await ui.locator('#loadPresetBtn').click(); await assertBlankLocked();
      await ui.locator('#recallLabBtn').click();
      assert.equal(await ui.locator('#componentList option').count(), 2);
      const beforeUnlock = await storage();
      const history = await ui.locator('#undoBtn,#redoBtn').evaluateAll(nodes => nodes.map(n => n.disabled));

      await ui.locator('#presetAccess summary').focus(); await page.keyboard.press('Enter');
      await ui.locator('#presetPassword').fill('wrong'); await ui.locator('#presetPassword').press('Enter');
      assert(await ui.locator('#presetUnlockError').isVisible());
      assert.equal(await ui.locator('#presetPassword').getAttribute('type'), 'password');
      assert.equal(await ui.locator('#presetPassword').getAttribute('aria-invalid'), 'true');
      assert.equal(await storage(), beforeUnlock);
      assert.equal(await ui.locator('#componentList option').count(), 2);
      await page.setViewportSize({ width: 390, height: 1000 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert(await ui.locator('html').evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await ui.locator('#presetPassword').fill('aero1234'); await ui.locator('#presetPassword').press('Enter');
      assert.equal(await ui.locator('#presetAccess').isVisible(), false);
      assert.equal(await ui.locator('#presetSelect option:disabled').count(), 0);
      assert.equal(await ui.locator('#presetPassword').inputValue(), '');
      assert.equal(await storage(), beforeUnlock, 'unlock must not write browser storage');
      assert.equal(await ui.locator('#componentList option').count(), 2, 'unlock must not load an answer');
      assert.deepEqual(await ui.locator('#undoBtn,#redoBtn').evaluateAll(nodes => nodes.map(n => n.disabled)), history);
      for (const preset of ['follower', 'inverting', 'noninverting', 'lowpass', 'integrator', 'custom-example', 'blank']) {
        await ui.locator('#presetSelect').selectOption(preset); await ui.locator('#loadPresetBtn').click();
        assert(await ui.locator('#componentList option').count() > 2, `${name}: ${preset} unavailable after unlock`);
      }
      await page.reload(); await ui.locator('#presetSelect').waitFor(); await assertBlankLocked();
      assert.equal(await ui.locator('html').evaluate(() => localStorage.getItem('gds1202b-preset-blank')), raw);
      assert.equal(await ui.locator('html').evaluate(() => localStorage.getItem('gds1202b-preset-inverting')), raw);
      assert.deepEqual(errors, []);
      console.log('PASS', name, 'blank startup, saved originals, password failure/success, no automatic answer, keyboard/mobile, own Save/Recall, per-visit relock');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
