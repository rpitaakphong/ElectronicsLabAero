const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  unlockPresets,
} = require('../vendor/opamp-lab-simulator/tests/preset-helpers.cjs');
const origin = process.env.APP_URL || 'http://127.0.0.1:3000';
const output = path.resolve('output/playwright/rc-uav');
const storageKey = 'rc-filter-v1-lab';
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1512, height: 1100 },
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('dialog', (dialog) => dialog.accept());
    // Use the established test-only instrumentation pattern. No product hooks.
    await page.route('**/app.js', (route) =>
      route.fulfill({
        contentType: 'text/javascript',
        body: fs
          .readFileSync('vendor/opamp-lab-simulator/app.js', 'utf8')
          .replace(
            '  // Initial state',
            `
  window.labTest={state,get scope(){return scope},get beforeAutoset(){return beforeAutoset},get acquisitionVersion(){return acquisitionVersion},get stats(){return [...measurementStats]},loadPreset,restoreLab,boardSnapshot,channelProcessed,measurementResult,makeDisplayFrame,currentRecord,simulateAndRender,syncInputs,drawScope};
  // Initial state`,
          ),
      }),
    );
    await page.goto(origin + '/simulators/rc-filter/index.html');
    await unlockPresets(page, 'uav-highpass');
    const settle = () => page.waitForTimeout(60);
    const load = async (preset = 'uav-highpass') => {
      await page.selectOption('#presetSelect', preset);
      await page.click('#loadPresetBtn');
      await settle();
    };
    const source = async (mode) => {
      await page.selectOption('#rcInputSignal', mode);
      await settle();
    };
    const autoset = async () => {
      await page.click('[data-action="autoset"]');
      await settle();
    };
    const snapshot = () =>
      page.evaluate(() =>
        JSON.parse(
          JSON.stringify({
            board: JSON.parse(labTest.boardSnapshot()),
            scope: labTest.scope,
            beforeAutoset: labTest.beforeAutoset,
            challenge: labTest.state.challenge,
            acquisitionVersion: labTest.acquisitionVersion,
            stats: labTest.stats,
            simError: labTest.state.sim.error,
            sim: labTest.state.sim.last && {
              signalMode: labTest.state.sim.last.signalMode,
              mixed: labTest.state.sim.last.mixed,
              window: labTest.state.sim.last.window,
              dt: labTest.state.sim.last.dt,
            },
          }),
        ),
      );
    const save = async () => {
      await page.click('#saveLabBtn');
      return page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)),
        storageKey,
      );
    };
    const setScope = async (changes) => {
      await page.evaluate((changes) => {
        for (const [key, value] of Object.entries(changes)) {
          if (value && typeof value === 'object')
            Object.assign(labTest.scope[key], value);
          else labTest.scope[key] = value;
        }
        labTest.simulateAndRender();
      }, changes);
    };
    const value = (name, channel = 'CH1') =>
      page.evaluate(
        ({ name, channel }) =>
          labTest.measurementResult(
            { name, source: channel, source2: 'CH2' },
            labTest.makeDisplayFrame(labTest.currentRecord()),
          ),
        { name, channel },
      );
    const fit = async (expectedTimeDiv, channels = ['ch1', 'ch2']) => {
      const result = await page.evaluate(
        (channels) => ({
          timeDiv: labTest.scope.horizontal.timeDiv,
          running: labTest.scope.running,
          singleArmed: labTest.scope.singleArmed,
          position: labTest.scope.horizontal.position,
          zoom: labTest.scope.horizontal.zoom,
          trigger: labTest.scope.trigger,
          visible: labTest.makeDisplayFrame(labTest.currentRecord())?.visible,
          channels: channels.map((name) => {
            const sim = labTest.currentRecord(),
              ch = labTest.scope[name];
            const samples = labTest.channelProcessed(
              sim.traces[name],
              ch,
              sim.dt,
            );
            const min = Math.min(...samples),
              max = Math.max(...samples);
            return {
              name,
              min,
              max,
              divisions: (max - min) / ch.voltsDiv,
              center: (min + max) / 2 / ch.voltsDiv - ch.position,
            };
          }),
        }),
        channels,
      );
      assert.equal(result.timeDiv, expectedTimeDiv);
      assert.equal(result.running, true);
      assert.equal(result.singleArmed, false);
      assert.equal(result.position, 0);
      assert.equal(result.zoom, false);
      assert.equal(result.trigger.mode, 'Auto');
      assert.equal(result.trigger.slope, 'Rising');
      assert.equal(result.visible, true);
      for (const channel of result.channels) {
        assert.ok(channel.max - channel.min > 0, JSON.stringify(channel));
        assert.ok(channel.divisions <= 6.001, JSON.stringify(channel));
        assert.ok(channel.divisions >= 2.3, JSON.stringify(channel));
        assert.ok(Math.abs(channel.center) < 1e-8, JSON.stringify(channel));
      }
    };
    const failedAutoset = async (reason) => {
      const before = await snapshot();
      await autoset();
      assert.deepEqual(
        await snapshot(),
        before,
        `Failed Autoset changed settings, acquisition, counters or Undo: ${reason}`,
      );
    };
    const undo = async () => {
      // Autoset exposes Undo on the first bottom softkey.
      await page.locator('[data-soft-bottom="0"]').click();
      await settle();
    };
    await settle();
    let saved = await save();
    assert.equal(saved.state.rcInput.mode, 'uav');
    assert.equal(saved.scope.horizontal.timeDiv, 0.0002);
    assert.equal(
      saved.state.components.find((part) => part.type === 'resistor').value,
      33000,
    );
    assert.equal(
      saved.state.components.find((part) => part.type === 'capacitor').value,
      100e-9,
    );
    assert.match(await page.locator('#rcSignalGuide').textContent(), /Autoset/);
    await page.selectOption('#schematicSelect', 'uav-highpass');
    assert.match(
      await page.locator('#schematicDiagram').textContent(),
      /100 nF/,
    );
    assert.match(
      await page.locator('#schematicDiagram').textContent(),
      /33 kΩ/,
    );
    const beforeFirstAutoset = await snapshot();
    await autoset();
    await fit(0.1);
    const firstAutoset = await snapshot();
    assert.deepEqual(firstAutoset.board, beforeFirstAutoset.board);
    assert.equal(
      firstAutoset.acquisitionVersion,
      beforeFirstAutoset.acquisitionVersion + 1,
    );
    assert.equal(
      firstAutoset.scope.actionCount,
      beforeFirstAutoset.scope.actionCount + 1,
    );
    assert.equal(
      firstAutoset.challenge.actions,
      beforeFirstAutoset.challenge.actions + 1,
    );
    assert.match((await value('Frequency')).reason, /Mixed signal/);
    assert.ok((await value('RMS')).value > 0);
    console.log(
      'PASS: UAV preset load → Autoset produces two fitted traces from 200 µs/div',
    );

    // Noise-off/zero strength acquire the useful 200 Hz sine and restore timing measurements.
    await page.uncheck('#rcNoiseEnabled');
    await settle();
    await autoset();
    await fit(0.002);
    assert.ok(Math.abs((await value('Frequency')).value - 200) < 0.1);
    await page.check('#rcNoiseEnabled');
    await page.fill('#rcNoiseStrength', '0');
    await page.locator('#rcNoiseStrength').press('Tab');
    await settle();
    await autoset();
    await fit(0.002);
    assert.ok(Math.abs((await value('Frequency')).value - 200) < 0.1);

    // Fresh Autoset must recover even when the last acquisition exceeded the budget.
    await load();
    await setScope({ horizontal: { timeDiv: 1, position: 2, zoom: false } });
    assert.match((await snapshot()).simError, /cannot resolve|24,000/i);
    await autoset();
    await fit(0.1);
    assert.equal((await snapshot()).simError, null);

    // Stop freezes the old record; a source change must still Autoset the CURRENT circuit.
    await page.click('[data-action="runStop"]');
    assert.equal((await snapshot()).scope.running, false);
    await source('sensor');
    const stopped = await snapshot();
    assert.equal(stopped.scope.frozenRecord.signalMode, 'uav');
    assert.equal(stopped.board.rcInput.mode, 'sensor');
    await autoset();
    await fit(0.002);
    assert.equal((await snapshot()).scope.frozenRecord.signalMode, 'sensor');
    await undo();
    const restored = await snapshot();
    assert.equal(restored.scope.running, false);
    assert.deepEqual(restored.scope.frozenRecord, stopped.scope.frozenRecord);
    assert.deepEqual(restored.scope.frozenFrame, stopped.scope.frozenFrame);
    assert.deepEqual(restored.scope.horizontal, stopped.scope.horizontal);
    assert.deepEqual(restored.scope.ch1, stopped.scope.ch1);
    assert.deepEqual(restored.scope.ch2, stopped.scope.ch2);
    assert.deepEqual(restored.board, stopped.board);

    // Single acquisition and an armed but untriggered capture must also recover.
    await load();
    await autoset();
    await page.click('[data-action="single"]');
    await settle();
    assert.equal((await snapshot()).scope.running, false);
    await autoset();
    await fit(0.1);
    await setScope({ trigger: { mode: 'Normal', level: 100 } });
    await page.click('[data-action="single"]');
    await settle();
    assert.equal((await snapshot()).scope.singleArmed, true);
    await autoset();
    await fit(0.1);

    // Probe factors, inversion and AC coupling survive, and fit the indicated voltage.
    await setScope({
      ch1: { probe: 10, invert: true, coupling: 'AC' },
      ch2: { probe: 10, invert: true, coupling: 'DC' },
      horizontal: { position: 4, zoom: true },
    });
    const altered = await snapshot();
    await autoset();
    await fit(0.1);
    const fitted = await snapshot();
    for (const name of ['ch1', 'ch2']) {
      for (const key of ['probe', 'invert', 'coupling', 'enabled'])
        assert.equal(fitted.scope[name][key], altered.scope[name][key]);
    }
    assert.deepEqual(fitted.board, altered.board);

    // A disconnected CH1 does not prevent valid CH2 from setting the trigger.
    await load();
    await page.selectOption('#componentList', 'ch1tip');
    await page.click('#deleteSelected');
    await settle();
    const disconnected = await snapshot();
    await autoset();
    await fit(0.1, ['ch2']);
    assert.equal((await snapshot()).scope.trigger.source, 'CH2');
    assert.deepEqual((await snapshot()).scope.ch1, disconnected.scope.ch1);

    // GND-coupled and disabled channels are excluded and remain untouched.
    await load();
    await setScope({ ch1: { coupling: 'GND', voltsDiv: 0.002, position: 2 } });
    const grounded = await snapshot();
    await autoset();
    await fit(0.1, ['ch2']);
    assert.equal((await snapshot()).scope.trigger.source, 'CH2');
    assert.deepEqual((await snapshot()).scope.ch1, grounded.scope.ch1);
    await setScope({ ch1: { coupling: 'DC', enabled: false } });
    const disabled = await snapshot();
    await autoset();
    await fit(0.1, ['ch2']);
    assert.deepEqual((await snapshot()).scope.ch1, disabled.scope.ch1);

    // Every unsuccessful attempt is atomic, including existing Undo and counters.
    await setScope({ measure: { statistics: true } });
    await page.uncheck('#rcSignalEnabled');
    await settle();
    await failedAutoset('synthetic output off');
    await page.check('#rcSignalEnabled');
    await settle();
    await setScope({
      ch1: { enabled: true, coupling: 'GND' },
      ch2: { coupling: 'GND' },
    });
    await failedAutoset('both channels at GND');
    await load();
    for (const lead of ['ch1tip', 'ch2tip']) {
      await page.selectOption('#componentList', lead);
      await page.click('#deleteSelected');
    }
    await settle();
    await failedAutoset('both probe tips disconnected');
    await load();
    await page.evaluate(() => {
      labTest.state.probes.ch1.tip = 'T:30';
      labTest.state.probes.ch2.tip = 'B:30';
      labTest.simulateAndRender();
    });
    await failedAutoset('both tips on floating nets');
    await load();
    await page.evaluate(() => {
      labTest.state.probes.ch1.tip = labTest.state.probes.ch1.gnd;
      labTest.state.probes.ch2.tip = labTest.state.probes.ch2.gnd;
      labTest.simulateAndRender();
    });
    await failedAutoset('probe tips on common ground');
    await load();
    await page.evaluate(() => {
      labTest.state.components.find((part) => part.type === 'capacitor').value =
        1e-10;
      labTest.state.components.find((part) => part.type === 'resistor').value =
        100;
      labTest.state.probes.ch1.tip = labTest.state.probes.ch2.tip;
      labTest.simulateAndRender();
    });
    await failedAutoset('valid channels below the 10 mV signal threshold');

    await load();
    await setScope({ powered: false });
    await failedAutoset('scope power off');
    console.log(
      'PASS: unsupported capture recovery, Stop/Single, probe settings, invalid channels and atomic failures',
    );

    // Legacy EEG saves expose their old source only while that source is loaded.
    await load();
    saved = await save();
    saved.state.rcInput.mode = 'eeg';
    await page.evaluate((saved) => labTest.restoreLab(saved), saved);
    await settle();
    assert.equal(await page.locator('#rcInputSignal').inputValue(), 'eeg');
    assert.match(
      await page.locator('#rcInputSignal option[value="eeg"]').textContent(),
      /Legacy EEG/,
    );
    await autoset();
    await fit(1);
    await page.uncheck('#rcNoiseEnabled');
    await settle();
    await autoset();
    await fit(0.2);
    await source('uav');
    assert.equal(
      await page.locator('#rcInputSignal option[value="eeg"]').count(),
      0,
    );

    // Instructor custom export round-trips through the existing validated recall path.
    await load();
    await autoset();
    await page.fill('#rcNoiseStrength', '130');
    await page.locator('#rcNoiseStrength').press('Tab');
    await settle();
    const customSnapshot = await save();
    await page.locator('.preset-manager summary').click();
    await page.fill('#newPresetName', 'UAV movement comparison');
    await page.click('#createPresetBtn');
    const customId = await page.locator('#presetSelect').inputValue();
    const downloadPromise = page.waitForEvent('download');
    await page.click('#exportPresetsBtn');
    const download = await downloadPromise;
    const exportFile = path.join(output, download.suggestedFilename());
    await download.saveAs(exportFile);
    const exported = JSON.parse(fs.readFileSync(exportFile, 'utf8'));
    const custom = exported.presets.find((item) => item.id === customId);
    assert.deepEqual(custom.preset, customSnapshot);
    await load('blank');
    await page.evaluate(
      ({ key, preset }) => localStorage.setItem(key, JSON.stringify(preset)),
      { key: storageKey, preset: custom.preset },
    );
    await page.click('#recallLabBtn');
    await settle();
    assert.deepEqual(await save(), customSnapshot);
    await page.reload();
    await unlockPresets(page, customId);
    await settle();
    assert.deepEqual(await save(), customSnapshot);
    assert.deepEqual(errors, []);
    console.log(
      'PASS: legacy EEG Autoset, UAV custom preset export and recall round-trip',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
