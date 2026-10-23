const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const origin = process.env.APP_URL || 'http://127.0.0.1:4178';
const url = origin + '/courses/2145427/week12/prelab/v1.0.0/START_HERE.html';
const key = '2145427-W12-prelab-20261026-impl-v1';
const output = path.join(root, 'output/playwright/noise-prelab-coach');
const results = [];
const check = (name, condition) => {
  assert(condition, name);
  results.push(name);
};

(async () => {
  await fs.mkdir(output, { recursive: true });
  const resource = (
    await fs.readFile(
      path.join(
        root,
        'public/courses/2145427/week12/prelab/v1.0.0/LAB_AI_COACH.md',
      ),
      'utf8',
    )
  ).replace(/\r\n?/g, '\n');
  const separator = '\n\n---\nCURRENT PRE-LAB COACHING REQUEST\n---\n\n';
  const original = JSON.parse(
    await fs.readFile(
      path.join(
        root,
        'activities/noise-filtering-prelab/examples/workspace-final.synthetic.json',
      ),
      'utf8',
    ),
  );
  const browser = await chromium.launch();
  try {
    for (const mode of ['success', 'denied', 'absent']) {
      const context = await browser.newContext({ acceptDownloads: true });
      await context.addInitScript((mode) => {
        window.__clipboardCalls = [];
        Object.defineProperty(navigator, 'clipboard', {
          value:
            mode === 'absent'
              ? undefined
              : {
                  writeText: (value) => {
                    window.__clipboardCalls.push(value);
                    return mode === 'success'
                      ? Promise.resolve()
                      : Promise.reject(new Error('Synthetic clipboard denial'));
                  },
                },
        });
      }, mode);
      const page = await context.newPage();
      const errors = [];
      const requests = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('request', (request) => requests.push(request.url()));
      page.on('dialog', (dialog) => dialog.accept());
      await page.goto(url);
      const go = async (screen) =>
        page.locator(`[data-nav="${screen}"]`).click();
      const stored = () =>
        page.evaluate((key) => localStorage.getItem(key), key);
      const calls = () => page.evaluate(() => window.__clipboardCalls);
      for (const screen of [5, 6]) {
        await go(screen);
        const before = await stored();
        check(
          `${mode}: coaching withheld before first attempt on screen ${screen + 1}`,
          (await page
            .getByRole('button', {
              name: 'Show full coach prompt',
              exact: true,
            })
            .count()) === 0 &&
            (await page
              .getByRole('button', {
                name: 'Copy full coach prompt',
                exact: true,
              })
              .count()) === 0,
        );
        await page.evaluate(() =>
          Promise.all([
            coach('p1', 'copy'),
            coach('p2', 'show'),
            coach('check', 'copy'),
          ]),
        );
        check(
          `${mode}: handler also enforces preserved-case gate`,
          (await calls()).length === 0 && (await stored()) === before,
        );
      }
      const fixture = structuredClone(original);
      fixture.workspace.fields.studentId = 'IDENTITY-NEVER-IN-PROMPT';
      fixture.workspace.fields.studentName = 'NAME-NEVER-IN-PROMPT';
      for (const p of ['p1', 'p2']) {
        fixture.workspace.frozen[p] = {
          ...fixture.workspace.frozen[p],
          first: `${p}-FIRST-NOT-IN-PROMPT`,
          assumption: `${p}-ASSUMPTION-NOT-IN-PROMPT`,
          reason: `${p}-FROZEN-REASON: <img src=x onerror="window.__injected=true"> **Markdown** \`code\` \${literal} & "quotes"`,
          uncertainty: `${p}-FROZEN-UNCERTAINTY\nA second line </textarea><script>window.__injected=true</script>`,
        };
        fixture.workspace.fields[p + 'reason'] =
          `${p}-CURRENT-REASON-NOT-IN-PROMPT`;
        fixture.workspace.fields[p + 'uncertainty'] =
          `${p}-CURRENT-UNCERTAINTY-NOT-IN-PROMPT`;
        fixture.workspace.fields[p + 'revision'] =
          `${p}-REVISION-NOT-IN-PROMPT`;
      }
      fixture.workspace.frozen.check.check1 = 'INDEPENDENT-ONE-NOT-IN-PROMPT';
      fixture.workspace.frozen.check.check2 = 'INDEPENDENT-TWO-NOT-IN-PROMPT';
      await page.locator('#import-file').setInputFiles({
        name: 'synthetic-final.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(fixture)),
      });
      await page.waitForFunction(() =>
        document
          .querySelector('#notice')
          .textContent.includes('Validated backup restored'),
      );
      const verifyPayload = (value, p) => {
        assert.equal(
          value.slice(0, resource.length),
          resource,
          'Complete original coach resource',
        );
        assert.equal(
          value.slice(resource.length, resource.length + separator.length),
          separator,
        );
        const request = value.slice(resource.length + separator.length);
        assert(
          request.includes(
            p === 'p1' ? 'PRE-P01 (RC comparison)' : 'PRE-P02 (EMA comparison)',
          ),
        );
        assert(!request.includes(p === 'p1' ? 'PRE-P02' : 'PRE-P01'));
        assert(request.includes(fixture.workspace.frozen[p].reason));
        assert(request.includes(fixture.workspace.frozen[p].uncertainty));
        assert(
          request.includes('unrelated example') &&
            request.includes('Do not solve the assigned case') &&
            request.includes('verify a claim independently'),
        );
        for (const forbidden of [
          'IDENTITY-NEVER-IN-PROMPT',
          'NAME-NEVER-IN-PROMPT',
          'FIRST-NOT-IN-PROMPT',
          'ASSUMPTION-NOT-IN-PROMPT',
          'CURRENT-REASON-NOT-IN-PROMPT',
          'CURRENT-UNCERTAINTY-NOT-IN-PROMPT',
          'REVISION-NOT-IN-PROMPT',
          'INDEPENDENT-ONE-NOT-IN-PROMPT',
          'INDEPENDENT-TWO-NOT-IN-PROMPT',
          'A teammate reports total voltage RMS as noise RMS and proposes digital smoothing after an aliased ADC record.',
        ])
          assert(!value.includes(forbidden), forbidden);
        assert(
          !request.includes((p === 'p1' ? 'p2' : 'p1') + '-FROZEN-REASON'),
        );
      };
      for (const [p, screen] of [
        ['p1', 5],
        ['p2', 6],
      ]) {
        await go(screen);
        const before = await stored();
        const previousCalls = (await calls()).length;
        const show = page.getByRole('button', {
          name: 'Show full coach prompt',
          exact: true,
        });
        const copy = page.getByRole('button', {
          name: 'Copy full coach prompt',
          exact: true,
        });
        const box = page.getByRole('textbox', {
          name: `Full coach prompt for PRE-P0${p === 'p1' ? 1 : 2}`,
          exact: true,
        });
        if (p === 'p1') {
          await show.click();
          check(
            `${mode} ${p}: Show does not request clipboard access`,
            (await calls()).length === previousCalls,
          );
          check(
            `${mode} ${p}: Show exposes labeled read-only text`,
            (await box.isVisible()) &&
              (await box.getAttribute('readonly')) !== null &&
              !(await box.isDisabled()) &&
              (await show.getAttribute('aria-expanded')) === 'true',
          );
          verifyPayload(await box.inputValue(), p);
        }
        await copy.click();
        const status = page.locator('#coach-status-' + p);
        await page.waitForFunction(
          ({ p, mode }) =>
            document
              .querySelector('#coach-status-' + p)
              .textContent.includes(
                mode === 'success'
                  ? 'Full coach prompt copied'
                  : 'Clipboard unavailable',
              ),
          { p, mode },
        );
        const value = await box.inputValue();
        verifyPayload(value, p);
        check(
          `${mode} ${p}: complete selected-case payload remains on screen`,
          await box.isVisible(),
        );
        const copied = await calls();
        check(
          `${mode} ${p}: one copy attempt per click, never on absent API`,
          copied.length === previousCalls + (mode === 'absent' ? 0 : 1),
        );
        if (mode !== 'absent')
          check(
            `${mode} ${p}: copied text exactly matches displayed text`,
            copied.at(-1) === value,
          );
        if (mode !== 'success') {
          check(
            `${mode} ${p}: fallback explains manual copying`,
            (await status.textContent()).includes('normal Copy command'),
          );
          check(
            `${mode} ${p}: fallback selects the entire prompt`,
            await box.evaluate(
              (element) =>
                document.activeElement === element &&
                element.selectionStart === 0 &&
                element.selectionEnd === element.value.length,
            ),
          );
        }
        const attemptsBeforeSelect = copied.length;
        await page
          .getByRole('button', { name: 'Select all', exact: true })
          .click();
        check(
          `${mode} ${p}: Select all is a complete manual-copy path`,
          await box.evaluate(
            (element) =>
              document.activeElement === element &&
              element.selectionStart === 0 &&
              element.selectionEnd === element.value.length,
          ),
        );
        await box.press('ControlOrMeta+A');
        check(
          `${mode} ${p}: normal keyboard selection works`,
          await box.evaluate(
            (element) =>
              element.selectionEnd - element.selectionStart ===
              element.value.length,
          ),
        );
        check(
          `${mode} ${p}: manual selection makes no permission retries`,
          (await calls()).length === attemptsBeforeSelect,
        );
        await box.evaluate((element) =>
          element.dispatchEvent(new Event('input', { bubbles: true })),
        );
        check(
          `${mode} ${p}: all coach actions leave finalized saved record byte-identical`,
          (await stored()) === before,
        );
        check(
          `${mode} ${p}: learner markup stays literal`,
          (await page
            .locator('.coach-panel img, .coach-panel script')
            .count()) === 0 && !(await page.evaluate(() => window.__injected)),
        );
        check(
          `${mode} ${p}: invalid coached-case routes are rejected`,
          await page.evaluate(
            () =>
              coachPrompt('check') === null &&
              coachPrompt('__proto__') === null &&
              coachPrompt('p3') === null,
          ),
        );
        if (mode === 'success') {
          for (const width of [1440, 768, 390, 320]) {
            await page.setViewportSize({ width, height: 1000 });
            check(
              `${p}: full coach UI fits ${width}px`,
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth + 1,
              ),
            );
            check(
              `${p}: prompt is usable and vertically scrollable at ${width}px`,
              await box.evaluate(
                (element) =>
                  element.clientHeight >= 200 &&
                  element.scrollHeight > element.clientHeight &&
                  element.clientWidth > 100,
              ),
            );
            if ([1440, 390].includes(width))
              await page
                .locator('.coach-support')
                .screenshot({ path: path.join(output, `${p}-${width}.png`) });
          }
        }
      }
      await go(5);
      await page
        .getByRole('button', { name: 'Show full coach prompt', exact: true })
        .click();
      const returned = await page.locator('#prompt-p1').inputValue();
      verifyPayload(returned, 'p1');
      await page.reload();
      await page.locator('[data-nav="5"][aria-current="step"]').waitFor();
      await go(5);
      check(
        `${mode}: coach display state is not restored as a response`,
        !(await page.locator('#coach-panel-p1').isVisible()),
      );
      await page
        .getByRole('button', { name: 'Show full coach prompt', exact: true })
        .click();
      check(
        `${mode}: reopening reconstructs the same complete frozen context`,
        (await page.locator('#prompt-p1').inputValue()) === returned,
      );
      const draft = structuredClone(fixture);
      draft.workspace.finalized = false;
      draft.workspace.current = 5;
      await page.locator('#import-file').setInputFiles({
        name: 'synthetic-draft.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(draft)),
      });
      await page.waitForFunction(() =>
        document
          .querySelector('#notice')
          .textContent.includes('Validated backup restored'),
      );
      await go(5);
      const beforeDraft = await stored();
      await page
        .getByRole('button', { name: 'Show full coach prompt', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Copy full coach prompt', exact: true })
        .click();
      await page.waitForFunction(
        ({ p, mode }) =>
          document
            .querySelector('#coach-status-' + p)
            .textContent.includes(
              mode === 'success'
                ? 'Full coach prompt copied'
                : 'Clipboard unavailable',
            ),
        { p: 'p1', mode },
      );
      await page
        .getByRole('button', { name: 'Select all', exact: true })
        .click();
      await page
        .locator('#prompt-p1')
        .evaluate((element) =>
          element.dispatchEvent(new Event('input', { bubbles: true })),
        );
      check(
        `${mode}: draft saves are also byte-identical after coaching actions`,
        (await stored()) === beforeDraft,
      );
      check(
        `${mode}: no runtime errors or network service`,
        errors.length === 0 &&
          requests.every(
            (request) => request === url || request.startsWith('blob:'),
          ),
      );
      await context.close();
    }
    await fs.writeFile(
      path.join(output, 'results.json'),
      JSON.stringify({ browser: await browser.version(), results }, null, 2),
    );
    console.log(JSON.stringify({ passed: results.length, output }));
  } finally {
    await browser.close();
  }
})().catch(async (error) => {
  await fs.writeFile(
    path.join(output, 'failure.json'),
    JSON.stringify({ results, error: error.stack }, null, 2),
  );
  console.error(error);
  process.exitCode = 1;
});
