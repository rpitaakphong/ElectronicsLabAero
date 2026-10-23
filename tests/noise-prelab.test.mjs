import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  buildNoisePrelab,
  serializeInlineScript,
} from '../scripts/package-noise-prelab.mjs';
import {
  parseWorkspaceBackup,
  parsePrelabEvidence,
  toDashboardView,
} from '../activities/noise-filtering-prelab/integration/prelab-adapter.mjs';
import { verifyNoisePrelab } from '../scripts/check-noise-prelab.mjs';

const fixture = async (name) =>
  JSON.parse(
    await readFile(
      new URL(
        `../activities/noise-filtering-prelab/examples/${name}.synthetic.json`,
        import.meta.url,
      ),
      'utf8',
    ),
  );

test('public workbook is the verified three-file student presentation release', async () => {
  assert.deepEqual(await verifyNoisePrelab(), [
    'LAB_AI_COACH.md',
    'READ_ME_FIRST.md',
    'START_HERE.html',
  ]);
});

test('workbook is reproducible and embeds native mathematical structures without a runtime renderer', async () => {
  const html = await buildNoisePrelab();
  const published = await readFile(
    new URL(
      '../public/courses/2145427/week12/prelab/v1.0.0/START_HERE.html',
      import.meta.url,
    ),
    'utf8',
  );
  assert.equal(html, published);
  for (const tag of ['mfrac', 'msqrt', 'munderover', 'msup', 'msub'])
    assert.ok(html.includes('<' + tag + '>'), tag);
  assert.equal(/<script\b[^>]*src=/i.test(html), false);
  assert.equal(/<link\b[^>]*href="https?:/i.test(html), false);
  assert.equal(html.includes('<span class="math">'), false);
});

test('embedded coach context is the complete original student resource', async () => {
  const html = await buildNoisePrelab();
  const original = await readFile(
    new URL(
      '../public/courses/2145427/week12/prelab/v1.0.0/LAB_AI_COACH.md',
      import.meta.url,
    ),
    'utf8',
  );
  const serialized = html.match(
    /const COACH_RESOURCE=(.*);\nconst EQUATIONS=/,
  )?.[1];
  assert.ok(serialized, 'Coach resource is embedded once as serialized text');
  assert.equal(JSON.parse(serialized), original.replace(/\r\n?/g, '\n'));
});

test('coach-resource serialization cannot close the script or execute template markup', () => {
  const original =
    '</SCRIPT><script>window.injected = true</script> & "quotes" `backticks` ${expression}\n\u2028\u2029';
  const serialized = serializeInlineScript(original);
  assert.equal(JSON.parse(serialized), original);
  assert.equal(/[<>&\u2028\u2029]/.test(serialized), false);
});

test('typesetting preserves all plotted geometry and the upstream companion files', async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL(
        '../activities/noise-filtering-prelab/release-manifest.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const figures = JSON.parse(
    await readFile(
      new URL(
        '../activities/noise-filtering-prelab/source/figures.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  for (const [id, svg] of Object.entries(figures)) {
    const paths = [...svg.matchAll(/<path[^>]*>/g)]
      .map((match) => match[0])
      .join('\n');
    assert.equal(
      createHash('sha256').update(paths).digest('hex'),
      manifest.upstreamFigurePathHashes[id],
      id,
    );
    for (const [, text] of svg.matchAll(/<text\b[^>]*>(.*?)<\/text>/gs))
      assert.equal(/[=ατ]|1\/3/.test(text), false, id + ': raw formula label');
  }
  for (const file of manifest.upstreamFiles.filter(
    (item) => item.name !== 'START_HERE.html',
  )) {
    const bytes = await readFile(
      new URL(
        '../public/courses/2145427/week12/prelab/v1.0.0/' + file.name,
        import.meta.url,
      ),
    );
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
  }
});

test('supported draft, final and R4 backups retain their source identity and original records', async () => {
  for (const name of [
    'workspace-draft',
    'workspace-final',
    'r4-compatible-workspace',
  ]) {
    const backup = await fixture(name);
    const original = structuredClone(backup);
    assert.deepEqual(parseWorkspaceBackup(JSON.stringify(backup)), original);
    assert.deepEqual(backup, original);
  }
});

test('evidence preserves predictions and leaves later measurement and interpretation empty', async () => {
  const original = await fixture('prelab-evidence');
  const parsed = parsePrelabEvidence(JSON.stringify(original));
  const view = toDashboardView(parsed);
  assert.deepEqual(parsed, original);
  assert.equal(view.stage, 'prelab');
  assert.equal(view.status, 'finalized');
  assert.deepEqual(view.predictions[0].original, original.originals.p1);
  assert.equal(view.predictions[0].revision, original.responses.p1revision);
  assert.equal(view.measurementEvidence, null);
  assert.equal(view.postlabInterpretation, null);
});

test('contract rejects incompatible activities, malformed or oversized files and conflicting identity', async () => {
  const backup = await fixture('workspace-final');
  for (const mutate of [
    (b) => {
      b.version = 1;
    },
    (b) => {
      b.workspace.activity = '555-prelab';
    },
    (b) => {
      b.workspace.package = '2145427-W12-prelab-review-r3';
    },
    (b) => {
      b.workspace.fields.studentId = {};
    },
    (b) => {
      b.workspace.frozen.p1 = null;
    },
  ]) {
    const altered = structuredClone(backup);
    mutate(altered);
    assert.throws(() => parseWorkspaceBackup(JSON.stringify(altered)));
  }
  const evidence = await fixture('prelab-evidence');
  evidence.student.id = 'DIFFERENT-ID';
  assert.throws(
    () => parsePrelabEvidence(JSON.stringify(evidence)),
    /identity/,
  );
  assert.throws(() => parseWorkspaceBackup('{broken'));
  assert.throws(() => parseWorkspaceBackup(' '.repeat(500001)), /500 KB/);
});
