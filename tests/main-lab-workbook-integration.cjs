/* Test fixtures below are synthetic software-QA data, never student defaults. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const output = path.resolve('output/playwright/main-lab');
const url = `${process.env.APP_URL || 'http://127.0.0.1:4174'}/worksheets/555-main-lab.html`;
const key = 'electronics-555-main-lab-v3';

(async () => {
  await fs.mkdir(output, { recursive: true });
  const { createRecord, preservePrediction } =
    await import('../activities/555-main-lab/model.js');
  const browser = await chromium.launch({
    headless: process.env.HEADED !== '1',
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1512, height: 1000 },

      acceptDownloads: true,
    });
    const page = await context.newPage();
    const errors = [],
      network = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => {
      if (/^https?:/.test(request.url())) network.push(request.url());
    });
    await page.goto(url);
    const go = async (index) => {
      if (
        await page
          .getByRole('button', {
            name: 'Open activity navigation',
            exact: true,
          })
          .isVisible()
      )
        await page
          .getByRole('button', {
            name: 'Open activity navigation',
            exact: true,
          })
          .click();
      await page.locator(`#steps [data-step="${index}"]`).click();
    };
    const fill = async (field, value) => {
      const input = page.locator(`[data-field="${field}"]`);
      const tag = await input.evaluate((el) => el.tagName);
      if (tag === 'SELECT') await input.selectOption(value);
      else await input.fill(value);
    };
    const exportRecord = async () => {
      await go(4);
      const pending = page.waitForEvent('download');
      await page
        .getByRole('button', { name: 'Download answers (JSON)', exact: true })
        .click();
      const download = await pending;
      const destination = path.join(output, download.suggestedFilename());
      await download.saveAs(destination);
      return {
        data: JSON.parse(await fs.readFile(destination, 'utf8')).record,
        destination,
      };
    };
    const attach = async (slot) => {
      await page.locator(`[data-image-file="${slot}"]`).setInputFiles({
        name: 'scope.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDV8AAAAASUVORK5CYII=',
          'base64',
        ),
      });
      await page.locator(`[data-upload="${slot}"]`).click();
      await page
        .locator(`[data-attachment="${slot}"] .image-status`)
        .filter({ hasText: 'Attached locally' })
        .waitFor();
    };
    await fill('group.id', 'QA-GROUP');
    await fill('group.student1.name', 'Test student A');
    await fill('group.student1.id', '000001');
    await fill('group.student2.name', 'Test student B');
    await fill('group.student2.id', '000002');
    await page.locator('[data-field="setup.safety.orientation"]').check();
    assert.equal(await page.locator('#steps [data-step]').count(), 5);
    // The empty Lab 2 panel must be compact too, before numerical limits exist.
    await go(2);
    const specifications = await page
      .locator('.goal-body > .display-equation')
      .evaluateAll((boxes) =>
        boxes.map((box) => ({
          height: box.getBoundingClientRect().height,
          font: parseFloat(
            getComputedStyle(box.querySelector('math')).fontSize,
          ),
          padding: parseFloat(getComputedStyle(box).paddingTop),
        })),
      );
    assert.equal(specifications.length, 1);
    assert(
      specifications.every(
        (box) => box.font === 16 && box.padding === 8 && box.height < 60,
      ),
      `oversized specification equations: ${JSON.stringify(specifications)}`,
    );
    assert.equal(
      await page.locator('.goal-header h2').innerText(),
      'Lab Objective',
    );
    assert.equal(await page.locator('#screen-count').innerText(), 'Lab 2 of 3');
    assert.match(
      await page.locator('.goal-panel').innerText(),
      /HIGH time about twice the LOW time/,
    );
    assert.equal(
      await page.locator('[data-field="configs.A1.design.capacitor"]').count(),
      0,
    );
    assert.equal(
      await page.locator('[data-design-feedback="A1"] .parameter-grid').count(),
      0,
    );
    assert.match(
      await page.locator('[data-fixed-capacitor]').innerText(),
      /First record your timing capacitor in Lab 1/,
    );
    await page
      .getByRole('button', {
        name: 'Go to Lab 1 measured frequency',
        exact: true,
      })
      .click();
    assert.equal(
      await page
        .locator('[data-preserve="A0"]')
        .evaluate((el) => el === document.activeElement),
      true,
    );
    assert.match(
      await page.locator('#toast').innerText(),
      /Save your Lab 1 initial design/,
    );
    assert.equal(
      await page.locator('.goal-header h2').innerText(),
      'Lab Objective',
    );
    assert.equal(
      await page.locator('.signal-illustration svg[role="img"]').count(),
      1,
    );
    assert.match(
      await page.locator('.goal-panel').innerText(),
      /main objective of this lab task/,
    );
    assert.match(
      await page.locator('.signal-illustration figcaption').innerText(),
      /not to scale/,
    );
    assert.equal(
      await page.locator('#main .formula-sheet .display-equation').count(),
      5,
    );
    assert.equal(
      await page.locator('#main .formula-sheet .equation-grid').count(),
      1,
    );
    assert.doesNotMatch(
      await page.locator('#main .formula-sheet').evaluate((el) => el.outerHTML),
      /One kiloohm|One microfarad|R2 is approximately the LOW time|R1 is approximately the HIGH time/,
    );
    assert(
      await page
        .locator('[data-field="configs.A0.measurement.high"]')
        .isDisabled(),
    );
    assert.equal(
      await page
        .locator('[data-field="configs.A0.design.r1a"]')
        .evaluate((el) => el.tagName),
      'INPUT',
    );
    assert.equal(
      await page.locator('[data-field="configs.A0.design.r1a"]').inputValue(),
      '',
    );
    assert.equal(
      await page
        .locator(
          '[data-field="configs.A0.design.r1b"], [data-field="configs.A0.design.r2b"]',
        )
        .count(),
      0,
    );
    assert.equal(await page.locator('#screen-count').innerText(), 'Lab 1 of 3');
    assert.equal(
      await page.locator('[data-design-feedback="A0"] .parameter-grid').count(),
      0,
    );
    for (const [k, v] of Object.entries({
      r1a: '10',
      r2a: '66',
      capacitor: '10',
    }))
      await fill(`configs.A0.design.${k}`, v);
    assert.equal(
      await page.locator('[data-design-feedback="A0"] .parameter-grid').count(),
      0,
    );
    assert.match(
      await page
        .locator('[data-design-feedback="A0"] .design-status')
        .innerText(),
      /Timing values entered/,
    );
    for (const [k, v] of Object.entries({
      high: '.5268',
      low: '.4575',
      period: '.9843',
      frequency: '1.016',
      duty: '53.52',
    }))
      await fill(`configs.A0.prediction.${k}`, v);
    await page
      .getByRole('button', {
        name: 'Save initial design and predictions for Lab 1',
      })
      .click();
    await fill('configs.A0.prediction.high', '.5269');
    assert.match(
      await page.locator('#main h1').innerText(),
      /Lab 1 - Astable Circuit Design/,
    );
    assert(
      await page
        .locator('[data-field="configs.A0.measurement.high"]')
        .isEnabled(),
    );
    for (const [k, v] of Object.entries({
      high: '.531',
      low: '.462',
      period: '.993',
      frequency: '1.007',
      duty: '53.47',
      outHigh: '3.8',
      outLow: '0.1',
      capHigh: '3.35',
      capLow: '1.66',
      supply: '5',
      notes: 'Synthetic test reading, not bench evidence.',
    }))
      await fill(`configs.A0.measurement.${k}`, v);
    await attach('A0');
    for (const [id, step, predictions, measurements] of [
      [
        'A1',
        2,
        {
          high: '.5961',
          low: '.2981',
          period: '.8942',
          frequency: '1.118',
          duty: '66.67',
        },
        {
          high: '.6',
          low: '.3',
          period: '.9',
          frequency: '1.111',
          duty: '66.67',
        },
      ],
      [
        'M0',
        3,
        { pulse: '.726' },
        {
          pulse: '.741',
          triggerLow: '0',
          triggerHigh: '5',
          triggerWidth: '.08',
          triggerPeriod: '3',
        },
      ],
    ]) {
      await go(step);
      if (id === 'M0') {
        assert.equal(
          await page.locator('#screen-count').innerText(),
          'Lab 3 of 3',
        );
        assert.equal(
          await page.locator('.goal-header h2').innerText(),
          'Lab Objective',
        );
        const objective = await page.locator('.goal-body').innerText();
        assert.match(objective, /instead of oscillating continuously/);
        assert.match(
          objective,
          /Choose a timing resistance R and timing capacitor C/,
        );
        assert.match(objective, /not for as long as you hold the button/);
        assert.match(objective, /\(Screenshot 3\)/);
        assert.equal(await page.locator('.monostable-waveforms').count(), 1);
        assert.equal(
          await page
            .locator('[data-field="configs.M0.design.capacitor"]')
            .evaluate((el) => el.tagName),
          'INPUT',
        );
        assert.match(
          await page
            .locator('label[for="field-configs-M0-prediction-pulse"]')
            .innerText(),
          /tW/,
        );
        assert.equal(
          await page
            .locator(
              '[data-field="configs.M0.measurement.capHigh"], [data-field="configs.M0.measurement.capLow"], [data-field^="conversion."], [data-field^="handoff."]',
            )
            .count(),
          0,
        );
      }
      if (id === 'A1') {
        assert.match(
          await page.locator('.goal-reference').innerText(),
          /1\.007/,
        );
        assert.equal(
          await page.locator('.goal-body > .display-equation').count(),
          2,
        );
        assert.match(
          await page.locator('[data-fixed-capacitor]').innerText(),
          /10.*µF/s,
        );
        await page
          .getByRole('button', {
            name: 'Go to Lab 1 measured frequency',
            exact: true,
          })
          .click();
        assert.equal(
          await page
            .locator('[data-field="configs.A0.measurement.frequency"]')
            .evaluate((el) => el === document.activeElement),
          true,
        );
        await go(2);
        await page
          .getByRole('button', { name: 'View Lab 1 equations', exact: true })
          .click();
        assert.equal(await page.locator('#dialog .formula-sheet').count(), 1);
        assert.equal(
          await page
            .locator('#dialog .formula-sheet .display-equation')
            .count(),
          5,
        );
        assert.doesNotMatch(
          await page
            .locator('#dialog .formula-sheet')
            .evaluate((el) => el.outerHTML),
          /One kiloohm|One microfarad|R2 is approximately the LOW time|R1 is approximately the HIGH time/,
        );
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#main .formula-sheet').count(), 0);
        assert.match(await page.locator('#main h1').innerText(), /Lab 2/);
      }
      const designs = {
        A1: { r1a: '43', r2a: '43' },
        M0: { r1a: '66', capacitor: '10' },
      };
      for (const [k, v] of Object.entries(designs[id]))
        await fill(`configs.${id}.design.${k}`, v);
      if (id === 'A1') {
        assert.equal(
          await page
            .locator('[data-design-feedback="A1"] .parameter-grid')
            .count(),
          0,
        );
        assert.match(
          await page
            .locator('[data-design-feedback="A1"] .design-status')
            .innerText(),
          /Timing values entered/,
        );
      }
      for (const [k, v] of Object.entries(predictions))
        await fill(`configs.${id}.prediction.${k}`, v);
      if (id === 'M0') {
        await fill('configs.M0.design.capacitor', '0');
        await page
          .getByRole('button', {
            name: 'Save initial design and predictions for Lab 3',
          })
          .click();
        await page
          .getByText(/Enter a timing capacitance greater than zero/)
          .first()
          .waitFor();
        assert(
          await page
            .locator('[data-field="configs.M0.measurement.pulse"]')
            .isDisabled(),
        );
        await fill('configs.M0.design.capacitor', '10.00');
      }
      await page
        .getByRole('button', {
          name: `Save initial design and predictions for ${id === 'A1' ? 'Lab 2' : 'Lab 3'}`,
        })
        .click();
      assert.equal(
        await page.locator('#main h1').innerText(),
        id === 'A1'
          ? 'Lab 2 - Astable Circuit Modification'
          : 'Lab 3 - Monostable Circuit Design',
      );
      assert(
        await page
          .locator(
            `[data-field="configs.${id}.measurement.${id === 'A1' ? 'high' : 'pulse'}"]`,
          )
          .isEnabled(),
      );
      for (const [k, v] of Object.entries(measurements))
        await fill(`configs.${id}.measurement.${k}`, v);
      const evidence = id === 'M0' ? ['M0trigger'] : [id];
      for (const e of evidence) {
        await attach(e);
      }
    }
    await go(4);
    assert.match(await page.locator('.stats').innerText(), /3\/3/);
    assert.doesNotMatch(await page.locator('.stats').innerText(), /4\/4/);
    assert.equal(
      await page.locator('.stats > div:nth-child(2) strong').innerText(),
      '3/3',
    );
    assert.equal(await page.locator('[data-field^="analysis."]').count(), 0);
    const exported = await exportRecord();
    assert.equal(exported.data.group.id, 'QA-GROUP');
    assert.equal(exported.data.setup.safety.orientation, true);
    assert.equal(exported.data.schemaVersion, 3);
    assert.equal(exported.data.configs.A0.original.prediction.high, '.5268');
    assert.equal(exported.data.configs.A0.prediction.high, '.5269');
    assert.equal(exported.data.configs.A0.original.prediction.reason, '');
    assert.equal(exported.data.configs.A0.original.prediction.sketch, '');
    assert.equal(exported.data.configs.A0.design.r2a, '66');
    assert.equal(exported.data.configs.A0.design.r2b, '');
    assert.equal(exported.data.evidence.A0.annotation, '');
    assert.equal(exported.data.configs.M1.original, null);
    assert.deepEqual(exported.data.configs.A1.original.reference, {
      frequency: '1.007',
      capacitor: '10',
    });
    assert.equal(exported.data.configs.A1.design.capacitor, '10');
    assert.equal(exported.data.configs.A1.original.design.capacitor, '10');
    assert.equal(exported.data.configs.M1.design.capacitor, '');
    assert.equal(exported.data.configs.A1.measurement.pulse, '');
    await page.reload();
    await go(0);
    assert.equal(
      await page.locator('[data-field="group.id"]').inputValue(),
      'QA-GROUP',
    );
    // Import preview, cancellation, replacement, and hostile text rendering.
    const incoming = createRecord();
    incoming.group.id = 'IMPORTED';
    incoming.group.student1.name = '<img src=x onerror="window.injected=1">';
    const fixture = path.join(output, 'import-fixture.json');
    await fs.writeFile(fixture, JSON.stringify(incoming));
    await page.locator('#import-file').setInputFiles(fixture);
    await page.getByRole('dialog').waitFor();
    assert.equal(await page.locator('#dialog img').count(), 0);
    await page
      .getByRole('button', { name: 'Keep current answers', exact: true })
      .click();
    assert.equal(
      await page.locator('[data-field="group.id"]').inputValue(),
      'QA-GROUP',
    );
    await page.locator('#import-file').setInputFiles(fixture);
    await page
      .getByRole('button', { name: 'Load these answers', exact: true })
      .click();
    assert.equal(
      await page.locator('[data-field="group.id"]').inputValue(),
      'IMPORTED',
    );
    const invalid = path.join(output, 'invalid-fixture.json');
    await fs.writeFile(
      invalid,
      JSON.stringify({ ...incoming, schemaVersion: 1 }),
    );
    await page.locator('#import-file').setInputFiles(invalid);
    await page
      .getByText(
        /Could not load this backup. This backup belongs to the earlier lab/,
      )
      .waitFor();
    assert.equal(
      await page.locator('[data-field="group.id"]').inputValue(),
      'IMPORTED',
    );
    await fs.writeFile(invalid, '{"schemaVersion":999}');
    await page.locator('#import-file').setInputFiles(invalid);
    await page.getByText(/Could not load this backup/).waitFor();
    assert.equal(
      await page.locator('[data-field="group.id"]').inputValue(),
      'IMPORTED',
    );
    // Restore the completed test fixture through the public import control.
    await page.locator('#import-file').setInputFiles(exported.destination);
    await page
      .getByRole('button', { name: 'Load these answers', exact: true })
      .click();
    // Import an original eleven-page v2 backup, including retired answers.
    const legacyV2 = structuredClone(exported.data);
    legacyV2.schemaVersion = 2;
    legacyV2.group = {
      id: exported.data.group.id,
      members: 'Test student A\nTest student B',
    };
    delete legacyV2.legacyMembers;
    legacyV2.visited = Array.from({ length: 11 }, (_, i) => i);
    for (const [id, design] of Object.entries({
      A0: { r1a: '10', r1b: '', r2a: '33', r2b: '33' },
      A1: { r1a: '33', r1b: '10', r2a: '33', r2b: '10' },
      M0: { r1a: '33', r1b: '33' },
    })) {
      Object.assign(legacyV2.configs[id].design, design);
      Object.assign(legacyV2.configs[id].original.design, design);
    }
    legacyV2.configs.A0.prediction.reason =
      legacyV2.configs.A0.original.prediction.reason =
        'Historical calculation notes';
    legacyV2.configs.A0.prediction.sketch =
      legacyV2.configs.A0.original.prediction.sketch =
        'Historical sketch filename';
    Object.assign(legacyV2.configs.A0.measurement, {
      timebase: 'Historical timebase',
      voltsPerDiv: 'Historical voltage scales',
      probe: 'Historical probe setting',
    });
    legacyV2.evidence.A0.annotation = 'Historical screenshot description';
    legacyV2.conversion.pin2 = 'Historical connection plan';
    legacyV2.conversion.checked = true;
    legacyV2.handoff.notes = 'Historical bench note';
    legacyV2.evidence.M0capacitor.filename = 'historical-capacitor.png';
    legacyV2.configs.M0.measurement.capHigh = '3.25';
    Object.assign(legacyV2.configs.M1.design, { r1a: '33', capacitor: '10' });
    legacyV2.configs.M1.prediction.pulse = '.363';
    preservePrediction(legacyV2, 'M1');
    legacyV2.configs.M1.measurement.pulse = '.370';
    legacyV2.evidence.M1.filename = 'retired-only.png';
    const oldFile = path.join(output, 'old-eleven-page-v2.json');
    await fs.writeFile(oldFile, JSON.stringify(legacyV2));
    await page.locator('#import-file').setInputFiles(oldFile);
    await page
      .getByRole('button', { name: 'Load these answers', exact: true })
      .click();
    assert.equal(await page.locator('#steps [data-step]').count(), 5);
    assert.equal(
      await page
        .locator('#steps .step-number')
        .allTextContents()
        .then((xs) => xs.filter((x) => x === '✓').length),
      4,
    );
    await go(1);
    assert.equal(
      await page.locator('[data-field="configs.A0.design.r2a"]').inputValue(),
      '66',
    );
    const oldRoundtrip = await exportRecord();
    assert.deepEqual(oldRoundtrip.data.configs.A0, legacyV2.configs.A0);
    assert.deepEqual(oldRoundtrip.data.configs.A1, legacyV2.configs.A1);
    assert.deepEqual(oldRoundtrip.data.evidence.A0, legacyV2.evidence.A0);
    assert.deepEqual(oldRoundtrip.data.configs.M1, legacyV2.configs.M1);
    assert.deepEqual(oldRoundtrip.data.evidence.M1, legacyV2.evidence.M1);
    assert.deepEqual(oldRoundtrip.data.visited, legacyV2.visited);
    assert.equal(
      await page
        .locator('[data-field^="configs.M1"], [data-field^="evidence.M1"]')
        .count(),
      0,
    );
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const width of [1512, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await go(0);
      assert.equal(await page.locator('#main table').count(), 0);
      assert.doesNotMatch(
        await page.locator('body').innerText(),
        /Two hours at the bench|110 min core|\d+\s*(?:–|-)\s*\d+\s*min/i,
      );
      const sizing = await page.locator('.diagram-pins svg').evaluate((svg) => {
        const current = svg.getBoundingClientRect();
        const root = parseFloat(
          getComputedStyle(document.documentElement).fontSize,
        );
        const title = parseFloat(
          getComputedStyle(document.querySelector('.trail strong')).fontSize,
        );
        return {
          width: current.width,
          ratio: current.width / current.height,
          fontIncrease: title - root * (innerWidth <= 560 ? 0.84 : 0.9),
        };
      });
      assert(
        sizing.width >= 340 && sizing.width <= 650,
        `pin width at ${width}: ${JSON.stringify(sizing)}`,
      );
      assert(
        Math.abs(sizing.ratio - 800 / 570) < 0.005,
        `pin height at ${width}: ${JSON.stringify(sizing)}`,
      );
      assert(
        Math.abs(sizing.fontIncrease - 5) < 0.01,
        `title font at ${width}`,
      );
      await page.locator('.diagram-pins').screenshot({
        path: path.join(output, `compact-pin-guide-${width}.png`),
      });
      for (let i = 0; i < 5; i++) {
        await go(i);
        assert.equal(await page.locator('#main p math').count(), 0);
        assert.equal(
          await page.locator('#main .goal-panel').count(),
          i >= 1 && i <= 3 ? 1 : 0,
        );
        if (i === 1 || i === 2)
          assert.equal(
            await page
              .locator('#main [data-design-feedback] .parameter-grid')
              .count(),
            0,
          );
        if (i >= 1 && i <= 3) {
          assert.equal(
            await page.locator('.goal-header h2').innerText(),
            'Lab Objective',
          );
          const deliverables = page.locator(
            '.goal-body .objective-deliverables',
          );
          assert.equal(await deliverables.count(), 1);
          assert.equal(
            await deliverables.locator('h3').innerText(),
            'Key deliverable',
          );
          assert.equal(await deliverables.locator('li').count(), 4);
          const content = await deliverables.innerText();
          assert.match(content, new RegExp(`\\(Screenshot ${i}\\)`));
          assert.match(content, /one screenshot per lab \(three total\)/);
          assert.match(content, /JSON is a backup/);
          assert.doesNotMatch(
            await deliverables.locator('li').nth(1).innerText(),
            /\(s\)|\(Hz\)|\(%\)/,
          );
          if (i === 2)
            assert.equal(
              await page
                .locator('[data-fixed-capacitor] > p')
                .first()
                .innerText(),
              'Keep the same physical timing capacitor that you used in Lab 1.',
            );
          assert.doesNotMatch(content, /CH1|CH2|probe|pin [1-8]/);
          assert.equal(await page.locator('#main .evidence input').count(), 1);
          assert(
            await deliverables.evaluate((el) => {
              const following = el.parentElement.querySelector(
                '.signal-illustration, .monostable-waveforms, .goal-reference',
              );
              return (
                !!following &&
                !!(
                  el.compareDocumentPosition(following) &
                  Node.DOCUMENT_POSITION_FOLLOWING
                )
              );
            }),
          );
        } else
          assert.equal(
            await page.locator('.objective-deliverables').count(),
            0,
          );
        if (i === 3) {
          assert.equal(await page.locator('.monostable-schematic').count(), 0);
          assert.equal(await page.locator('.conversion-schematic').count(), 2);
          assert.equal(await page.locator('.monostable-waveforms').count(), 1);
          assert.equal(
            await page
              .locator(
                '.scope-setup, .power-connections, .capture-steps, [data-expand="scope-setup"], [data-expand="unchanged-connections"]',
              )
              .count(),
            0,
          );
          assert.doesNotMatch(
            await page.locator('#main').innerText(),
            /Keep these connections unchanged|Oscilloscope setup and capture|Connect the two channels|CH1|CH2/,
          );
          assert.equal(
            await page
              .locator(
                '[data-conversion-mode="monostable"] [data-component="r2"]',
              )
              .count(),
            0,
          );
          for (const svg of await page
            .locator('.monostable-waveforms, .conversion-schematic')
            .all()) {
            assert(await svg.isVisible());
            const clippedLabels = await svg.evaluate((el) =>
              [...el.querySelectorAll('text')]
                .filter((t) => {
                  const b = t.getBBox(),
                    v = el.viewBox.baseVal;
                  return (
                    b.x < v.x ||
                    b.y < v.y ||
                    b.x + b.width > v.x + v.width ||
                    b.y + b.height > v.y + v.height
                  );
                })
                .map((t) => t.textContent),
            );
            assert.deepEqual(
              clippedLabels,
              [],
              `clipped schematic labels at ${width}`,
            );
          }
        }
        assert.doesNotMatch(
          await page.locator('#main').innerText(),
          /\bTask [123]\b/,
        );
        assert.doesNotMatch(
          await page.locator('#main').innerText(),
          /\b(?:A0|A1|M0|M1)\b|shorter pulse/i,
        );
        assert.equal(
          await page
            .locator(
              '#main [data-field$=".r1b"], #main [data-field$=".r2b"], #main [data-field$=".prediction.reason"], #main [data-field$=".prediction.sketch"], #main [data-field$=".measurement.timebase"], #main [data-field$=".measurement.voltsPerDiv"], #main [data-field$=".measurement.probe"], #main [data-field$=".annotation"]',
            )
            .count(),
          0,
        );
        for (const formula of await page.locator('#main math').all()) {
          if (!(await formula.isVisible())) continue; // Preserved snapshots live in closed disclosures.
          const bounds = await formula.boundingBox();
          assert(
            bounds && bounds.height >= 7 && bounds.width > 10,
            `math did not render on screen ${i} at ${width}: ${JSON.stringify(bounds)}`,
          );
          const size = await formula.evaluate((math) =>
            parseFloat(getComputedStyle(math).fontSize),
          );
          assert.equal(
            size,
            16,
            `compact equation text on page ${i} at ${width}`,
          );
        }
        if (i === 1) {
          const diagram = page.locator('.astable-schematic');
          assert(
            await diagram.evaluate(
              (svg) =>
                svg.getBoundingClientRect().width >= 444 &&
                svg.getBoundingClientRect().width <= 660,
            ),
          );
          assert.equal(
            await diagram.locator('[data-chip-layout="dip8-top"]').count(),
            1,
          );
          assert.equal(await diagram.locator('[data-open-pin="5"]').count(), 1);
          assert.equal(
            await diagram.locator('[data-component="control-bypass"]').count(),
            0,
          );
        }
        assert.equal(
          await page.locator('#menu-button').getAttribute('aria-expanded'),
          'false',
        );
        assert(
          await page
            .locator('#main h1')
            .evaluate(
              (el) =>
                el.getBoundingClientRect().top >=
                document.querySelector('.topbar').getBoundingClientRect()
                  .bottom,
            ),
          `heading obscured on screen ${i} at ${width}`,
        );
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          `screen ${i} overflow at ${width}`,
        );
        if ([0, 1, 2, 3, 4].includes(i))
          await page.screenshot({
            path: path.join(output, `screen-${i}-${width}.png`),
          });
        if (i >= 1 && i <= 3 && [1512, 390].includes(width)) {
          await page.locator('#toast').waitFor({ state: 'hidden' });
          await page.locator('.objective-deliverables').screenshot({
            path: path.join(output, `deliverables-lab-${i}-${width}.png`),
            style: '.topbar, footer, #toast { visibility: hidden !important; }',
          });
        }
      }
    }
    await go(1);
    await page
      .getByRole('button', { name: 'Enlarge diagram', exact: true })
      .click();
    await page.getByRole('dialog').waitFor();
    assert(await page.locator('.expanded-diagram svg').isVisible());
    assert.equal(
      await page
        .locator('.expanded-diagram svg')
        .evaluate((svg) => svg.getBoundingClientRect().width),
      1100,
    );
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert(
      await page
        .getByRole('button', { name: 'Enlarge diagram', exact: true })
        .evaluate((el) => el === document.activeElement),
    );
    await go(3);
    for (const [kind, title, svgClass, expectedWidth] of [
      [
        'monostable-waveforms',
        'Example oscilloscope signals',
        'monostable-waveforms',
        900,
      ],
      [
        'conversion-astable',
        'Before conversion · Astable timing connections',
        'conversion-schematic',
        1100,
      ],
      [
        'conversion-monostable',
        'After conversion · Monostable timing connections',
        'conversion-schematic',
        1100,
      ],
    ]) {
      const opener = page.locator(`[data-expand="${kind}"]`);
      await opener.click();
      await page.getByRole('dialog').waitFor();
      assert.equal(await page.locator('#dialog-title').innerText(), title);
      assert.equal(await page.locator(`#dialog .${svgClass}`).count(), 1);
      assert.equal(
        await page
          .locator('.expanded-diagram svg')
          .evaluate((svg) => svg.getBoundingClientRect().width),
        expectedWidth,
      );
      await page.keyboard.press('Escape');
      assert(await opener.evaluate((el) => el === document.activeElement));
    }
    // Mobile navigation traps focus and restores the opener.
    await page
      .getByRole('button', { name: 'Open activity navigation', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Close activity navigation', exact: true })
      .focus();
    await page.keyboard.press('Shift+Tab');
    assert.equal(
      await page.evaluate(() => document.activeElement.dataset.step),
      '4',
    );
    await page.keyboard.press('Tab');
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      'close-navigation',
    );
    await page.keyboard.press('Escape');
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      'menu-button',
    );
    await go(0);
    await fill('group.student1.id', '000001');
    await fill('group.student2.id', '000002');
    // Render the actual print action without blocking on a platform print dialog.
    await page.setViewportSize({ width: 1024, height: 1000 });
    await go(4);
    await page.evaluate(() => {
      window.print = () => {
        window.dispatchEvent(new Event('beforeprint'));
        window.printRequested = true;
      };
    });
    await page
      .getByRole('button', { name: 'Print or save report as PDF', exact: true })
      .click();
    await page.waitForFunction(() => window.printRequested === true);
    await page.emulateMedia({ media: 'print' });
    assert(await page.locator('#report').isVisible());
    assert.equal(await page.locator('#workbook').isVisible(), false);
    const printed = await page.locator('#report').innerText();
    for (const text of [
      '.5268',
      '.5269',
      'Screenshot_3_Lab_3.png',
      'Not recorded',
      'Lab 3 - Monostable Circuit Design',
    ])
      assert(printed.includes(text), `missing print data ${text}`);
    assert(!printed.includes('retired-only.png'));
    assert.equal(
      await page.locator('#report .goal-panel, #report .formula-sheet').count(),
      0,
    );
    assert.equal(
      await page
        .locator('#report .monostable-schematic, #report .conversion-schematic')
        .count(),
      0,
    );
    assert.equal(
      await page
        .locator(
          '#report .monostable-waveforms, #report .scope-setup, #report .power-connections',
        )
        .count(),
      0,
    );
    assert.doesNotMatch(printed, /Screenshot 4|Checks before leaving the lab/);
    for (const text of [
      'Historical connection plan',
      'Historical bench note',
      'historical-capacitor.png',
    ])
      assert(printed.includes(text));
    assert.equal(await page.locator('#report .report-config').count(), 3);
    await page.screenshot({
      path: path.join(output, 'print-layout.png'),
      fullPage: true,
    });
    await page.pdf({
      path: path.join(output, 'sample-group-report.pdf'),
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });
    assert(
      network.every((request) => request.startsWith('http://127.0.0.1:4174/')),
    );
    assert.deepEqual(errors, []);
    await context.close();
    // Storage denial: edits, export and navigation still work without claiming save success.
    const denied = await browser.newContext({});
    await denied.addInitScript(() => {
      Storage.prototype.getItem = () => {
        throw new Error('blocked');
      };
      Storage.prototype.setItem = () => {
        throw new Error('blocked');
      };
    });
    const deniedPage = await denied.newPage();
    await deniedPage.goto(url);
    await deniedPage
      .getByRole('textbox', { name: 'Group ID', exact: true })
      .fill('UNSAVED');
    await deniedPage
      .getByRole('button', { name: 'Save and load', exact: true })
      .click();
    const failedDownload = deniedPage.waitForEvent('download');
    await deniedPage
      .getByRole('button', { name: 'Download answers (JSON)', exact: true })
      .click();
    assert((await failedDownload).suggestedFilename().includes('UNSAVED'));
    assert.match(
      await deniedPage.locator('#save-status').innerText(),
      /paused|could not be saved/i,
    );
    deniedPage.on('dialog', (d) => d.accept());
    await denied.close();
    // Invalid stored data is retained until explicit replacement, and can be recovered.
    const corrupt = await browser.newContext({});
    await corrupt.addInitScript((storageKey) => {
      localStorage.setItem(storageKey, '{broken local record');
    }, key);
    const corruptPage = await corrupt.newPage();
    await corruptPage.goto(url);
    await corruptPage
      .getByRole('textbox', { name: 'Group ID', exact: true })
      .fill('NEW-IN-MEMORY');
    await corruptPage.waitForTimeout(700);
    assert.equal(
      await corruptPage.evaluate(
        (storageKey) => localStorage.getItem(storageKey),
        key,
      ),
      '{broken local record',
    );
    await corruptPage
      .getByRole('button', { name: 'Save and load', exact: true })
      .click();
    const recovery = corruptPage.waitForEvent('download');
    await corruptPage
      .getByRole('button', {
        name: 'Download the saved file that could not be opened',
      })
      .click();
    assert((await recovery).suggestedFilename().endsWith('.txt'));
    corruptPage.on('dialog', (d) => d.accept());
    await corrupt.close();
    // Previous activity data remains separate and can be downloaded unchanged.
    const legacy = await browser.newContext({ acceptDownloads: true });
    const originalLegacy = JSON.stringify({
      activityId: '555-main-lab',
      schemaVersion: 1,
      group: { id: 'EARLIER' },
    });
    await legacy.addInitScript(
      (raw) => localStorage.setItem('electronics-555-main-lab-v1', raw),
      originalLegacy,
    );
    const legacyPage = await legacy.newPage();
    await legacyPage.goto(url);
    assert.match(
      await legacyPage.locator('#main').innerText(),
      /Answers from the earlier lab were found/,
    );
    await legacyPage
      .getByRole('textbox', { name: 'Group ID', exact: true })
      .fill('NEW-V2');
    await legacyPage.waitForTimeout(700);
    assert.equal(
      await legacyPage.evaluate(() =>
        localStorage.getItem('electronics-555-main-lab-v1'),
      ),
      originalLegacy,
    );
    await legacyPage
      .getByRole('button', { name: 'Save and load', exact: true })
      .click();
    const legacyDownload = legacyPage.waitForEvent('download');
    await legacyPage
      .getByRole('button', {
        name: 'Download answers from the earlier lab',
        exact: true,
      })
      .click();
    const recovered = await legacyDownload;
    const legacyFile = path.join(output, 'legacy-recovery.json');
    await recovered.saveAs(legacyFile);
    assert.equal(await fs.readFile(legacyFile, 'utf8'), originalLegacy);
    await legacy.close();
    console.log(
      'PASS: hosted Vercel worksheet; five pages and three single-page tasks; preserved predictions and A1 reference; safe JSON/legacy recovery; 20 responsive pages with display MathML; keyboard/dialog focus; full report/PDF; storage failures; no network or simulator.',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
