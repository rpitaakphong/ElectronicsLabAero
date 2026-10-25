// Run against the built preview with the same Playwright environment as the other browser suites.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createHash } = require('node:crypto');
const { unzipSync, strFromU8 } = require('fflate');

const root = path.resolve(__dirname, '..');
const origin = process.env.APP_URL || 'http://127.0.0.1:4178';
const base = '/courses/2145427/week12/prelab/v1.0.0/';
const workbook = origin + base + 'START_HERE.html';
const key = '2145427-W12-prelab-20261026-impl-v1';
const output = path.join(root, 'output/playwright/noise-prelab');
const results = [];
const check = (name, condition) => {
  assert(condition, name);
  results.push(name);
};

(async () => {
  await fs.mkdir(output, { recursive: true });
  const adapter = await import(
    pathToFileURL(
      path.join(
        root,
        'activities/noise-filtering-prelab/integration/prelab-adapter.mjs',
      ),
    ).href
  );
  const fixture = async (name) =>
    JSON.parse(
      await fs.readFile(
        path.join(
          root,
          'activities/noise-filtering-prelab/examples',
          name + '.synthetic.json',
        ),
        'utf8',
      ),
    );
  const browser = await chromium.launch({
    headless: process.env.HEADED !== '1',
  });
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    // Simulate denied clipboard access without changing the OS clipboard.
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: () =>
            Promise.reject(new Error('Synthetic clipboard denial')),
        },
      });
    });
    const page = await context.newPage();
    const errors = [];
    const workbookRequests = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let accept = true;
    page.on('dialog', (dialog) =>
      accept ? dialog.accept() : dialog.dismiss(),
    );

    const download = async (selector, name) => {
      const pending = page.waitForEvent('download');
      await page.locator(selector).click();
      const file = await pending;
      await file.saveAs(path.join(output, name));
      check(
        name + ' downloaded',
        (await fs.stat(path.join(output, name))).size > 0,
      );
      return fs.readFile(path.join(output, name));
    };
    const go = async (screen) => {
      await page.locator(`[data-nav="${screen}"]`).click();
      await page.waitForFunction(
        (n) =>
          document
            .querySelector('.screen-index')
            .textContent.includes(`Screen ${n + 1} of 10`),
        screen,
      );
    };
    const stored = () => page.evaluate((k) => localStorage.getItem(k), key);
    const restore = (body) =>
      page.locator('#import-file').setInputFiles({
        name: 'synthetic-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(
          typeof body === 'string' ? body : JSON.stringify(body),
        ),
      });

    for (const width of [1512, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(origin + '/noise-and-filtering');
      check(
        'Topic heading ' + width,
        await page
          .getByRole('heading', { name: 'Noise and Filtering', exact: true })
          .isVisible(),
      );
      const main = page.getByRole('main');
      check(
        'Pre-lab and independent learning available ' + width,
        (await main.getByRole('link', { name: /Open pre-lab/ }).count()) ===
          1 &&
          (await main
            .locator('a[href$="/simulator"], iframe')
            .count()) === 0,
      );
      check(
        'Topic does not overflow ' + width,
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.screenshot({
        path: path.join(output, `topic-${width}.png`),
        fullPage: true,
      });
      await page
        .getByRole('button', {
          name: width < 900 ? 'Open navigation menu' : 'Topics',
          exact: true,
        })
        .click();
      const menu = page.getByRole('navigation', {
        name: width < 900 ? 'Mobile navigation' : 'Topic shortcuts',
      });
      const group = menu.locator('.nav-topic-group').filter({
        has: page.getByRole('link', {
          name: 'Noise and Filtering',
          exact: true,
        }),
      });
      check(
        'Menu exposes overview, learning, pre-lab, main lab and post-lab ' + width,
        (await group.locator('a').count()) === 5 &&
          (await group.locator('a[href="/worksheets/noise-filtering-post-lab.html"]').count()) === 1 &&
          (await group.locator(`a[href="${base}START_HERE.html"]`).count()) ===
            1,
      );
      await page.keyboard.press('Escape');
      await menu.waitFor({ state: 'hidden' });
    }

    await page.goto(origin + '/topics');
    await page.getByRole('searchbox').fill('noise');
    check(
      'Catalog finds independent topic',
      (await page.locator('.topic-card').count()) === 1,
    );
    await page
      .getByRole('link', { name: 'Open Noise and Filtering topic' })
      .click();
    await page.goBack();
    await page.waitForURL(origin + '/topics');
    await page.goForward();
    await page.waitForURL(origin + '/noise-and-filtering');
    await page.reload();
    check(
      'Topic history and reload work',
      await page
        .getByRole('heading', { name: 'Noise and Filtering', exact: true })
        .isVisible(),
    );
    await download(`a[href="${base}READ_ME_FIRST.md"]`, 'READ_ME_FIRST.md');
    await download(`a[href="${base}LAB_AI_COACH.md"]`, 'LAB_AI_COACH.md');
    const release = JSON.parse(
      await fs.readFile(
        path.join(
          root,
          'activities/noise-filtering-prelab/release-manifest.json',
        ),
        'utf8',
      ),
    );
    for (const file of release.files) {
      const response = await page.request.get(origin + base + file.name);
      const bytes = await response.body();
      check(
        'Served release hash ' + file.name,
        response.status() === 200 &&
          createHash('sha256').update(bytes).digest('hex') === file.sha256,
      );
      if (file.name.endsWith('.html'))
        check(
          'Workbook served as HTML',
          response.headers()['content-type'].includes('text/html'),
        );
    }
    page.on('request', (request) => workbookRequests.push(request.url()));
    await page.getByRole('link', { name: /Open pre-lab/ }).click();
    await page.waitForURL(workbook);
    await page.locator('#studentId').waitFor();
    check(
      'Workbook opens in same tab outside React shell',
      context.pages().length === 1 &&
        (await page.locator('.site-header').count()) === 0,
    );
    await page.evaluate(() => {
      localStorage.setItem(
        '2145427-555-prelab-workspace-0.2.0-DRAFT',
        '555-SENTINEL',
      );
      localStorage.setItem('electronics-555-main-lab-v3', 'MAIN-SENTINEL');
    });
    await page.locator('#studentId').fill('QA-W12-001');
    await page.locator('#studentName').fill('Synthetic Integration Student');
    await page.reload();
    check(
      'Local autosave survives reload',
      (await page.locator('#studentName').inputValue()) ===
        'Synthetic Integration Student',
    );
    for (let i = 0; i < 10; i++) {
      await go(i);
      check(
        'Screen ' + (i + 1) + ' renders',
        (await page.locator('h1').count()) === 1,
      );
    }
    await page.locator('#finalize').click();
    check(
      'Incomplete finalization blocked',
      (await page.locator('#notice').textContent()).includes(
        'Complete the missing',
      ),
    );
    await go(4);
    await page
      .locator('details')
      .first()
      .evaluate((element) => {
        element.open = true;
      });
    await page
      .locator('#maWork')
      .fill('Synthetic calculation uncertainty; no assessed solution.');
    await page
      .locator('#emaWork')
      .fill('Synthetic explanation uncertainty; no assessed solution.');

    for (const [n, screen] of [
      [1, 5],
      [2, 6],
    ]) {
      await go(screen);
      const p = 'p' + n;
      await page.locator(`[data-freeze="${p}"]`).click();
      check(
        p + ' empty original blocked',
        (await page.locator('#notice').textContent()).includes(
          'complete each first-attempt',
        ),
      );
      for (const field of ['first', 'reason', 'assumption', 'uncertainty']) {
        await page
          .locator('#' + p + field)
          .fill(`Synthetic ${p} ${field}: honest uncertainty.`);
      }
      accept = false;
      await page.locator(`[data-freeze="${p}"]`).click();
      check(
        p + ' preserve cancellation retains editing',
        (await page.locator('#' + p + 'first').count()) === 1,
      );
      accept = true;
      await page.locator(`[data-freeze="${p}"]`).click();
      check(
        p + ' original preserved',
        (await page.locator('#' + p + 'first').count()) === 0,
      );
      await page.locator(`[data-coach-copy="${p}"]`).click();
      await page.waitForFunction(
        (id) =>
          document
            .querySelector('#coach-status-' + id)
            .textContent.includes('Select and copy'),
        p,
      );
      const prompt = await page.locator('#prompt-' + p).inputValue();
      const resource = (
        await fs.readFile(
          path.join(root, 'public', base, 'LAB_AI_COACH.md'),
          'utf8',
        )
      ).replace(/\r\n?/g, '\n');
      check(
        p + ' safe coach fallback',
        prompt.startsWith(
          resource + '\n\n---\nCURRENT PRE-LAB COACHING REQUEST',
        ) &&
          prompt.includes('unrelated example') &&
          !prompt.includes('QA-W12-001') &&
          !prompt.includes('Synthetic Integration Student') &&
          !prompt.includes('Synthetic independent uncertainty') &&
          !prompt.includes(
            'A teammate reports total voltage RMS as noise RMS and proposes digital smoothing after an aliased ADC record.',
          ),
      );
      await page.locator('#' + p + 'help').fill('none');
      await page
        .locator('#' + p + 'revision')
        .fill('Synthetic revision; uncertainty retained.');
    }
    await go(7);
    await page
      .locator('#check1')
      .fill('Synthetic independent uncertainty one.');
    await page
      .locator('#check2')
      .fill('Synthetic independent uncertainty two.');
    await page.locator('[data-freeze="check"]').click();
    check(
      'Independent responses preserved',
      (await page.locator('#check1').count()) === 0,
    );
    await go(8);
    for (const field of [
      'aiUsed',
      'aiExposure',
      'claim',
      'verification',
      'limitation',
      'handoff',
    ]) {
      await page
        .locator('#' + field)
        .fill(
          field.startsWith('ai')
            ? 'none'
            : 'Synthetic ' + field + ': unresolved, no measured evidence.',
        );
    }
    const draft = adapter.parseWorkspaceBackup(
      (await download('#backup', 'draft.json')).toString(),
    );
    const originals = structuredClone(draft.workspace.frozen);
    await page.reload();
    check(
      'Originals and revisions survive reload',
      JSON.stringify(JSON.parse(await stored()).frozen) ===
        JSON.stringify(originals),
    );

    const invalid = [
      ['Malformed JSON', '{broken'],
      ['Oversized JSON', ' '.repeat(500001)],
      [
        'Identity conflict',
        {
          ...draft,
          workspace: {
            ...draft.workspace,
            fields: { ...draft.workspace.fields, studentId: 'OTHER-STUDENT' },
          },
        },
      ],
      [
        'Wrong activity',
        { ...draft, workspace: { ...draft.workspace, activity: '555-prelab' } },
      ],
      ['R3 rejected', { ...draft, version: 1 }],
      [
        'Incomplete final rejected',
        { ...draft, workspace: { ...draft.workspace, finalized: true } },
      ],
    ];
    for (const [name, body] of invalid) {
      const before = await stored();
      await restore(body);
      await page.waitForFunction(() =>
        document
          .querySelector('#notice')
          .textContent.includes('Restore rejected'),
      );
      check(name + ' without mutation', (await stored()) === before);
    }
    let before = await stored();
    accept = false;
    await restore(draft);
    // File.text() is asynchronous; wait for the dialog handler before comparing state.
    await page.waitForTimeout(100);
    check('Restore cancellation without mutation', (await stored()) === before);
    accept = true;
    await restore(draft);
    await page.waitForFunction(() =>
      document
        .querySelector('#notice')
        .textContent.includes('Validated backup restored'),
    );
    check(
      'Draft restore retains originals',
      JSON.stringify(JSON.parse(await stored()).frozen) ===
        JSON.stringify(originals),
    );

    await go(9);
    await page.locator('#review').click();
    check(
      'Review includes preserved and revised records',
      (await page.locator('#review-text').textContent()).includes(
        'Synthetic p1 first',
      ) &&
        (await page.locator('#review-text').textContent()).includes(
          'Synthetic revision',
        ),
    );
    for (const field of [
      'identityConfirm',
      'honestyConfirm',
      'independentConfirm',
    ])
      await page.locator('#' + field).check();
    const zip = unzipSync(await download('#finalize', 'final.zip'));
    check(
      'Final ZIP has exactly the agreed three files',
      JSON.stringify(Object.keys(zip).sort()) ===
        JSON.stringify([
          'prelab_evidence.json',
          'prelab_report.txt',
          'workspace_backup.json',
        ]),
    );
    for (const [name, bytes] of Object.entries(zip))
      await fs.writeFile(path.join(output, name), bytes);
    const evidence = adapter.parsePrelabEvidence(
      strFromU8(zip['prelab_evidence.json']),
    );
    const backup = adapter.parseWorkspaceBackup(
      strFromU8(zip['workspace_backup.json']),
    );
    check(
      'Export preserves original responses',
      JSON.stringify(evidence.originals) === JSON.stringify(originals),
    );
    check(
      'Export and workspace agree',
      JSON.stringify(evidence.responses) ===
        JSON.stringify(backup.workspace.fields) &&
        evidence.status === 'finalized',
    );
    check(
      'Report includes identity and original',
      strFromU8(zip['prelab_report.txt']).includes('QA-W12-001') &&
        strFromU8(zip['prelab_report.txt']).includes('Synthetic p1 first'),
    );
    const retry = unzipSync(await download('#zip', 'final-retry.zip'));
    check(
      'Repeat ZIP preserves evidence',
      strFromU8(retry['prelab_evidence.json']) ===
        strFromU8(zip['prelab_evidence.json']),
    );
    await page.evaluate(() => {
      window.print = () => {
        window.__printCalled = true;
      };
    });
    await page.locator('#print').click();
    check(
      'Print action renders evidence report',
      await page.evaluate(
        () =>
          window.__printCalled === true &&
          document
            .querySelector('#print-report')
            .textContent.includes('Synthetic p1 first'),
      ),
    );
    await page.pdf({
      path: path.join(output, 'report.pdf'),
      format: 'A4',
      printBackground: true,
    });
    await page.emulateMedia({ media: 'print' });
    await page.screenshot({
      path: path.join(output, 'report.png'),
      fullPage: true,
    });
    await page.emulateMedia({ media: 'screen' });
    await go(0);
    check(
      'Finalized identity locked',
      await page.locator('#studentId').isDisabled(),
    );
    await go(5);
    check(
      'Finalized revision locked',
      await page.locator('#p1revision').isDisabled(),
    );

    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (let i = 0; i < 10; i++) {
        await go(i);
        check(
          `Workbook overflow ${width}, screen ${i + 1}`,
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        );
        if ((width === 1440 || width === 390) && [0, 4, 5, 7, 9].includes(i)) {
          await page.screenshot({
            path: path.join(output, `workbook-${width}-${i + 1}.png`),
            fullPage: true,
          });
        }
      }
    }
    check(
      '555 workspaces untouched',
      await page.evaluate(
        () =>
          localStorage.getItem('2145427-555-prelab-workspace-0.2.0-DRAFT') ===
            '555-SENTINEL' &&
          localStorage.getItem('electronics-555-main-lab-v3') ===
            'MAIN-SENTINEL',
      ),
    );
    check(
      'Workbook has no network dependencies',
      workbookRequests.every(
        (url) => url === workbook || url.startsWith('blob:'),
      ),
    );

    const recovered = await browser.newContext({ acceptDownloads: true });
    const second = await recovered.newPage();
    second.on('dialog', (dialog) => dialog.accept());
    await second.goto(workbook);
    await second.locator('#import-file').setInputFiles({
      name: 'workspace_backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(zip['workspace_backup.json']),
    });
    await second.waitForFunction(() =>
      document
        .querySelector('#notice')
        .textContent.includes('Validated backup restored'),
    );
    await second.reload();
    await second.locator('[data-nav="0"]').click();
    check(
      'Final ZIP backup recovers in fresh browser context',
      (await second.locator('#studentId').inputValue()) === 'QA-W12-001' &&
        (await second.locator('#studentId').isDisabled()),
    );
    await recovered.close();

    const legacy = await browser.newContext();
    const third = await legacy.newPage();
    let acceptLegacy = false;
    third.on('dialog', (dialog) =>
      acceptLegacy ? dialog.accept() : dialog.dismiss(),
    );
    await third.goto(workbook);
    const r4 = await fixture('r4-compatible-workspace');
    const r4File = {
      name: 'r4.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(r4)),
    };
    await third.locator('#import-file').setInputFiles(r4File);
    await third.waitForTimeout(100);
    check(
      'R4 restore requires confirmation',
      (await third.locator('#studentId').inputValue()) === '',
    );
    acceptLegacy = true;
    await third.locator('#import-file').setInputFiles(r4File);
    await third.waitForFunction(() =>
      document
        .querySelector('#notice')
        .textContent.includes('Validated backup restored'),
    );
    const normalized = await third.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)),
      key,
    );
    check(
      'R4 restore normalizes package and retains original records',
      normalized.package === '2145427-W12-prelab-1.0.0' &&
        JSON.stringify(normalized.frozen) ===
          JSON.stringify(r4.workspace.frozen) &&
        normalized.created === r4.workspace.created,
    );
    await legacy.close();

    const denied = await browser.newContext({ acceptDownloads: true });
    await denied.addInitScript(() => {
      Storage.prototype.setItem = function () {
        throw new Error('Synthetic storage denial');
      };
    });
    const fourth = await denied.newPage();
    await fourth.goto(workbook);
    await fourth.locator('#studentId').fill('QA-STORAGE');
    check(
      'Storage failure keeps answer and shows backup guidance',
      (await fourth.locator('#notice').textContent()).includes(
        'save a JSON backup',
      ) && (await fourth.locator('#studentId').inputValue()) === 'QA-STORAGE',
    );
    const pending = fourth.waitForEvent('download');
    await fourth.locator('#backup').click();
    const rescued = await pending;
    await rescued.saveAs(path.join(output, 'storage-rescue.json'));
    check(
      'Storage failure still exports in-memory answer',
      adapter.parseWorkspaceBackup(
        await fs.readFile(path.join(output, 'storage-rescue.json'), 'utf8'),
      ).workspace.fields.studentId === 'QA-STORAGE',
    );
    await denied.close();

    check('No browser runtime errors', errors.length === 0);
    await fs.writeFile(
      path.join(output, 'results.json'),
      JSON.stringify(
        {
          browser: await browser.version(),
          origin,
          results,
          errors,
          workbookRequests,
        },
        null,
        2,
      ),
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
