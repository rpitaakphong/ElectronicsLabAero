const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const origin = process.env.APP_URL || 'http://127.0.0.1:3000';
const output = path.resolve('output/playwright/rc-uav');
const storageKey = 'rc-filter-v1-lab';
const screenshotStyle =
  '.site-header, .skip-link { visibility: hidden !important; }';
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
    const frame = () => page.frameLocator('iframe');
    const source = () => frame().locator('#rcInputSignal');
    const save = async () => {
      await frame().locator('#saveLabBtn').click();
      return page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)),
        storageKey,
      );
    };
    const store = (snapshot) =>
      page.evaluate(
        ({ key, value }) => {
          localStorage.setItem(key, JSON.stringify(value));
        },
        { key: storageKey, value: snapshot },
      );
    const unchangedInstruments = (actual, expected) => {
      const { rcInput: _actualInput, ...actualBoard } = actual.state;
      const { rcInput: _expectedInput, ...expectedBoard } = expected.state;
      assert.deepEqual(
        actualBoard,
        expectedBoard,
        'Source selection must preserve the wired circuit and generator',
      );
      assert.deepEqual(
        actual.scope,
        expected.scope,
        'Source selection must preserve scope settings',
      );
    };
    const edit = async (id, value) => {
      await frame()
        .locator('#' + id)
        .fill(String(value));
      await frame()
        .locator('#' + id)
        .press('Tab');
    };
    const knob = async (name, steps) => {
      const control = frame().locator(`[data-knob="${name}"]`);
      for (let i = 0; i < Math.abs(steps); i++) {
        await control.press(steps > 0 ? 'ArrowRight' : 'ArrowLeft');
      }
    };
    const load = async (preset) => {
      await frame().locator('#presetSelect').selectOption(preset);
      await frame().locator('#loadPresetBtn').click();
    };
    const assertMeasurements = async () => {
      // Circuit edits debounce acquisition by 20 ms; allow that acquisition to finish.
      await page.waitForTimeout(50);
      const diagnostics = await frame()
        .locator('#simReadout, #circuitWarnings')
        .allTextContents();
      const measurements = await frame()
        .locator('#measurementRows tr')
        .evaluateAll((rows) =>
          rows.map((row) =>
            Array.from(row.querySelectorAll('td'), (cell) => cell.textContent),
          ),
        );
      for (const channel of ['CH1', 'CH2']) {
        const row = measurements.find(
          (row) => row[0] === channel && row[1] === 'Pk-Pk',
        );
        assert.ok(
          row && Number.isFinite(parseFloat(row[2])) && parseFloat(row[2]) > 0,
          `Expected a measured ${channel} waveform: ${JSON.stringify({ measurements, diagnostics, errors })}`,
        );
      }
    };
    const measurement = async (name) => {
      await page.waitForTimeout(50);
      const rows = await frame()
        .locator('#measurementRows tr')
        .evaluateAll((rows) =>
          rows.map((row) =>
            Array.from(row.querySelectorAll('td'), (cell) => cell.textContent),
          ),
        );
      const row = rows.find((row) => row[1] === name);
      assert.ok(row, `Missing ${name} measurement`);
      return { value: row[2], details: row[3] };
    };
    const addMeasurement = async (name) => {
      await frame().locator('#measureSource').selectOption('CH1');
      await frame().locator('#measureType').selectOption(name);
      await frame().locator('#addMeasureBtn').click();
    };
    const assertMixedMeasurement = async (name) => {
      const result = await measurement(name);
      assert.equal(result.value, '—');
      assert.match(result.details, /Mixed signal/);
    };
    const captureState = async () => {
      await page.waitForTimeout(50);
      await frame().locator('[data-action="saveRecall"]').click();
      await frame().locator('[data-soft-bottom="0"]').click();
      return page.evaluate(() => {
        const panel = JSON.parse(localStorage.getItem('rc-filter-v1-panel'));
        return {
          running: panel.running,
          singleArmed: panel.singleArmed,
          mixed: panel.frozenRecord?.mixed,
          signalMode: panel.frozenRecord?.signalMode,
          samples: panel.frozenRecord?.traces?.t?.length || 0,
        };
      });
    };

    await page.goto(origin + '/rc-filter/simulator');
    await source().waitFor();
    assert.deepEqual(await source().locator('option').allTextContents(), [
      'Function generator',
      'UAV vibration + aircraft movement',
      'Sensor + high-frequency noise',
    ]);
    assert.equal(
      await frame()
        .locator('#presetSelect option[value="highpass"]')
        .evaluate((option) => option.disabled),
      true,
    );
    assert.equal(
      await frame().locator('#rcSyntheticControls').isVisible(),
      false,
    );
    const initial = await save();
    assert.equal(initial.version, 2);
    assert.deepEqual(initial.state.rcInput, {
      mode: 'generator',
      enabled: true,
      noiseEnabled: true,
      noiseStrength: 100,
    });

    // Synthetic sources are student controls, independent of the preset password.
    await source().selectOption('uav');
    assert.equal(
      await frame().locator('#rcSyntheticControls').isVisible(),
      true,
    );
    assert.equal(await frame().locator('#rcSourceNotice').isVisible(), true);
    assert.match(
      await frame().locator('#rcSignalGuide').textContent(),
      /conditioned|200 Hz/,
    );
    assert.equal(
      await frame()
        .locator('#presetSelect option[value="highpass"]')
        .evaluate((option) => option.disabled),
      true,
    );
    unchangedInstruments(await save(), initial);
    assert.equal(
      await frame()
        .locator('#rcGeneratorControls input, #rcGeneratorControls select')
        .evaluateAll((controls) =>
          controls.every((control) => control.disabled),
        ),
      true,
    );
    assert.equal(
      await frame()
        .locator('[data-sfg-key], [data-sfg-pull]')
        .evaluateAll((controls) =>
          controls.every((control) => control.disabled),
        ),
      true,
    );
    assert.equal(
      await frame()
        .locator('[data-sfg-knob]')
        .evaluateAll((controls) =>
          controls.every(
            (control) => control.getAttribute('aria-disabled') === 'true',
          ),
        ),
      true,
    );
    for (const id of ['sfgMainConnector', 'sfgGroundConnector']) {
      assert.equal(
        await frame()
          .locator('#' + id)
          .isEnabled(),
        true,
      );
    }
    assert.equal(await frame().locator('#sfgTtlConnector').isDisabled(), true);
    await frame().locator('[data-sfg-knob="frequency"]').press('ArrowUp');
    unchangedInstruments(await save(), initial);
    await frame().locator('#rcNoiseEnabled').uncheck();
    assert.equal((await save()).state.rcInput.noiseEnabled, false);
    assert.match(
      await frame().locator('#rcSignalGuide').textContent(),
      /clean|noise (?:is )?off/i,
    );
    await frame().locator('#rcNoiseEnabled').check();
    await edit('rcNoiseStrength', 0);
    assert.equal((await save()).state.rcInput.noiseStrength, 0);
    assert.match(
      await frame().locator('#rcSignalGuide').textContent(),
      /clean|noise (?:is )?off/i,
    );
    await edit('rcNoiseStrength', 150);
    await frame().locator('#rcSignalEnabled').uncheck();
    assert.equal((await save()).state.rcInput.enabled, false);
    assert.match(
      await frame().locator('#rcSignalGuide').textContent(),
      /output (?:is )?off/i,
    );
    await frame().locator('#rcSignalEnabled').check();
    await source().selectOption('sensor');
    const sensor = await save();
    assert.deepEqual(sensor.state.rcInput, {
      mode: 'sensor',
      enabled: true,
      noiseEnabled: true,
      noiseStrength: 150,
    });
    unchangedInstruments(sensor, initial);
    await source().selectOption('generator');
    unchangedInstruments(await save(), initial);
    assert.equal(await frame().locator('#rcSourceNotice').isVisible(), false);
    assert.equal(await frame().locator('#frequencyInput').isEnabled(), true);
    assert.equal(
      await frame().locator('[data-sfg-key="WAVE"]').isEnabled(),
      true,
    );

    await frame().locator('#presetAccess summary').click();
    await frame().locator('#presetPassword').fill('aero1234');
    await frame().locator('#presetUnlockForm button').click();
    await load('uav-highpass');
    let wired = await save();
    for (const component of wired.state.components) {
      await frame().locator('#componentList').selectOption(component.id);
      await edit('editValue', component.type === 'capacitor' ? '100n' : '33k');
    }
    // Manually obtain the suggested UAV overview. Source switching does not Autoset.
    await source().selectOption('generator');
    await edit('frequencyInput', 432);
    await knob('timeScale', 8);
    wired = await save();
    assert.equal(wired.scope.ch1.voltsDiv, 0.5);
    assert.equal(wired.scope.ch2.voltsDiv, 0.5);
    assert.equal(wired.scope.horizontal.timeDiv, 0.1);
    await source().selectOption('uav');
    const uav = await save();
    unchangedInstruments(uav, wired);
    await assertMeasurements();
    for (const name of ['RMS', 'Cycle RMS', 'Phase'])
      await addMeasurement(name);
    for (const name of ['Frequency', 'Cycle RMS', 'Phase'])
      await assertMixedMeasurement(name);
    assert.ok(parseFloat((await measurement('RMS')).value) > 0);

    // Version 2 recalls the chosen source; a version-1 save migrates to generator mode.
    await edit('rcNoiseStrength', 125);
    const savedUav = await save();
    await page.reload();
    await source().waitFor();
    assert.equal(await source().inputValue(), 'generator');
    await frame().locator('#recallLabBtn').click();
    assert.deepEqual(await save(), savedUav);
    const legacy = structuredClone(savedUav);
    legacy.version = 1;
    delete legacy.state.rcInput;
    await store(legacy);
    await frame().locator('#recallLabBtn').click();
    const migrated = await save();
    assert.equal(migrated.version, 2);
    assert.equal(migrated.state.rcInput.mode, 'generator');
    unchangedInstruments(migrated, savedUav);
    await store(savedUav);
    await frame().locator('#recallLabBtn').click();
    const invalid = structuredClone(savedUav);
    invalid.state.rcInput.noiseStrength = 201;
    await store(invalid);
    await frame().locator('#recallLabBtn').click();
    assert.deepEqual(await save(), savedUav);

    // Existing version-2 EEG experiments remain loadable, without advertising
    // a medical example among the normal student source choices.
    const savedLegacyEeg = structuredClone(savedUav);
    savedLegacyEeg.state.rcInput.mode = 'eeg';
    savedLegacyEeg.scope.horizontal.timeDiv = 1;
    await store(savedLegacyEeg);
    await frame().locator('#recallLabBtn').click();
    assert.equal(await source().inputValue(), 'eeg');
    assert.match(
      await source().locator('option[value="eeg"]').textContent(),
      /Legacy EEG/,
    );
    assert.equal((await save()).state.rcInput.mode, 'eeg');
    await store(savedUav);
    await frame().locator('#recallLabBtn').click();
    assert.equal(await source().inputValue(), 'uav');
    assert.equal(await source().locator('option[value="eeg"]').count(), 0);

    // Restore the default movement strength for four responsive views.
    await edit('rcNoiseStrength', 100);
    for (const width of [1512, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 1100 });
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
      await frame()
        .locator('.rc-input-source')
        .screenshot({
          path: path.join(output, `uav-source-${width}.png`),
          style: screenshotStyle,
        });
      await frame()
        .locator('.scope-chassis')
        .screenshot({
          path: path.join(output, `uav-scope-${width}.png`),
          style: screenshotStyle,
        });
    }
    await page.setViewportSize({ width: 1512, height: 1100 });
    await knob('timeScale', -5);
    assert.equal((await save()).scope.horizontal.timeDiv, 0.002);
    await assertMeasurements();
    await frame()
      .locator('.scope-chassis')
      .screenshot({
        path: path.join(output, 'uav-detail.png'),
        style: screenshotStyle,
      });

    // A separately wired low-pass example uses a manually selected sensor window.
    await frame().locator('#presetAccess summary').click();
    await frame().locator('#presetPassword').fill('aero1234');
    await frame().locator('#presetUnlockForm button').click();
    await load('lowpass');
    await knob('timeScale', 3);
    const sensorView = await save();
    assert.equal(sensorView.scope.horizontal.timeDiv, 0.002);
    await source().selectOption('sensor');
    unchangedInstruments(await save(), sensorView);
    await assertMeasurements();
    await frame()
      .locator('.scope-chassis')
      .screenshot({
        path: path.join(output, 'sensor-scope.png'),
        style: screenshotStyle,
      });

    await assertMixedMeasurement('Frequency');
    await frame().locator('[data-action="runStop"]').click();
    const stopped = await captureState();
    assert.equal(stopped.running, false);
    assert.equal(stopped.mixed, true);
    assert.equal(stopped.signalMode, 'sensor');
    await source().selectOption('generator');
    await assertMixedMeasurement('Frequency');
    assert.deepEqual(await captureState(), stopped);
    await frame().locator('[data-action="runStop"]').click();
    const resumedFrequency = (await measurement('Frequency')).value;
    assert.ok(
      Math.abs(
        parseFloat(resumedFrequency) *
          (/kHz/.test(resumedFrequency) ? 1000 : 1) -
          1000,
      ) < 1,
    );
    await source().selectOption('sensor');
    await frame().locator('[data-action="single"]').click();
    const single = await captureState();
    assert.equal(single.running, false);
    assert.equal(single.singleArmed, false);
    assert.equal(single.mixed, true);
    await frame().locator('#rcNoiseEnabled').uncheck();
    await assertMixedMeasurement('Frequency');
    assert.deepEqual(await captureState(), single);
    await frame().locator('[data-action="runStop"]').click();
    assert.ok(
      Math.abs(parseFloat((await measurement('Frequency')).value) - 200) < 1,
    );
    await frame().locator('#rcNoiseEnabled').check();
    // The dense sensor noise must report insufficient resolution instead of aliasing.
    await knob('timeScale', 1);
    assert.equal((await save()).scope.horizontal.timeDiv, 0.005);
    assert.match(
      await frame().locator('#circuitWarnings').textContent(),
      /cannot resolve|24,000 samples/i,
    );
    assert.equal((await captureState()).samples, 0);
    assert.equal((await measurement('Pk-Pk')).value, '—');
    await frame().locator('[data-action="runStop"]').click();
    assert.equal((await captureState()).samples, 0);
    assert.equal((await measurement('Pk-Pk')).value, '—');
    await frame().locator('[data-action="runStop"]').click();
    await knob('timeScale', -1);
    await assertMeasurements();
    await assertMixedMeasurement('Frequency');
    await frame().locator('#componentList').selectOption('ch2tip');
    await frame().locator('#deleteSelected').click();
    await page.waitForTimeout(50);
    await frame().locator('[data-action="single"]').click();
    assert.equal((await captureState()).running, false);
    const disconnected = await frame()
      .locator('#measurementRows tr')
      .evaluateAll((rows) =>
        rows.map((row) =>
          Array.from(row.querySelectorAll('td'), (cell) => cell.textContent),
        ),
      );
    const ch2 = disconnected.find(
      (row) => row[0] === 'CH2' && row[1] === 'Pk-Pk',
    );
    assert.equal(ch2[2], '—');
    assert.match(ch2[3], /disconnect/i);

    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('link', { name: /Download offline/ }).click();
    const download = await downloadEvent;
    assert.equal(
      download.suggestedFilename(),
      'rc_filter_sim_single_file.html',
    );
    const filename = path.join(output, download.suggestedFilename());
    await download.saveAs(filename);
    const offline = await browser.newPage();
    const network = [];
    offline.on('request', (request) => {
      if (/^https?:/.test(request.url())) network.push(request.url());
    });
    offline.on('pageerror', (error) => errors.push(error.message));
    await offline.goto(pathToFileURL(filename).href);
    await offline.locator('#rcInputSignal').selectOption('uav');
    assert.equal(
      await offline.locator('#rcSyntheticControls').isVisible(),
      true,
    );
    assert.match(
      await offline.locator('#rcSignalGuide').textContent(),
      /conditioned|200 Hz/,
    );
    await offline.locator('#rcNoiseEnabled').uncheck();
    await offline.locator('#saveLabBtn').click();
    const offlineState = await offline.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      storageKey,
    );
    assert.equal(offlineState.version, 2);
    assert.deepEqual(offlineState.state.rcInput, {
      mode: 'uav',
      enabled: true,
      noiseEnabled: false,
      noiseStrength: 100,
    });
    await offline.locator('#presetAccess summary').click();
    await offline.locator('#presetPassword').fill('aero1234');
    await offline.locator('#presetUnlockForm button').click();
    await offline.locator('#presetSelect').selectOption('uav-highpass');
    await offline.locator('#loadPresetBtn').click();
    await offline.locator('[data-action="autoset"]').click();
    await offline.waitForTimeout(60);
    await offline.locator('#saveLabBtn').click();
    const offlineFitted = await offline.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      storageKey,
    );
    assert.equal(offlineFitted.scope.horizontal.timeDiv, 0.1);
    assert.equal(offlineFitted.state.rcInput.mode, 'uav');
    const offlineMeasurements = await offline
      .locator('#measurementRows tr')
      .evaluateAll((rows) =>
        rows.map((row) =>
          [...row.querySelectorAll('td')].map((cell) => cell.textContent),
        ),
      );
    for (const channel of ['CH1', 'CH2']) {
      const row = offlineMeasurements.find(
        (row) => row[0] === channel && row[1] === 'Pk-Pk',
      );
      assert.ok(
        row && parseFloat(row[2]) > 0,
        JSON.stringify(offlineMeasurements),
      );
    }
    assert.deepEqual(network, []);
    assert.deepEqual(errors, []);
    console.log(
      'PASS: student-accessible synthetic sources, retained wiring and instrument settings, noise/output controls, generator lock, manual scope views, v2/legacy saves, four viewport widths, and offline package',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
