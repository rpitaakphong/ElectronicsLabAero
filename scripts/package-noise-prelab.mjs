import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import katex from 'katex';
import { EQUATIONS } from '../activities/noise-filtering-prelab/source/equations.mjs';

const source = new URL(
  '../activities/noise-filtering-prelab/source/',
  import.meta.url,
);
const publicFile = new URL(
  '../public/courses/2145427/week12/prelab/v1.0.0/START_HERE.html',
  import.meta.url,
);
const manifestFile = new URL(
  '../activities/noise-filtering-prelab/release-manifest.json',
  import.meta.url,
);

export function serializeInlineScript(value) {
  const escapes = {
    '<': '\\u003c',
    '>': '\\u003e',
    '&': '\\u0026',
    '\u2028': '\\u2028',
    '\u2029': '\\u2029',
  };
  return JSON.stringify(value).replace(
    /[<>&\u2028\u2029]/g,
    (character) => escapes[character],
  );
}

export async function buildNoisePrelab() {
  const load = (name) => readFile(new URL(name, source), 'utf8');
  const [shell, css, figures, content, app, coachResource] = await Promise.all([
    load('index.html'),
    load('styles.css'),
    load('figures.json'),
    load('lesson-content.js'),
    load('app.js'),
    readFile(new URL('LAB_AI_COACH.md', publicFile), 'utf8'),
  ]);
  const rendered = Object.fromEntries(
    Object.entries(EQUATIONS).map(([id, { label, tex }]) => {
      const mathml = katex.renderToString(tex, {
        displayMode: true,
        output: 'mathml',
        throwOnError: true,
        strict: 'error',
        trust: false,
      });
      return [id, { label, html: mathml }];
    }),
  );
  const js = `const COACH_RESOURCE=${serializeInlineScript(coachResource.replace(/\r\n?/g, '\n'))};\nconst EQUATIONS=${JSON.stringify(rendered)};\nconst FIGURES=${figures};\n${content}\n${app}`;
  return shell
    .replace('/* WORKBOOK_CSS */', () => css.replaceAll('</style', '<\\/style'))
    .replace('/* WORKBOOK_JS */', () =>
      js.replaceAll('</script', '<\\/script'),
    );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const html = await buildNoisePrelab();
  const bytes = Buffer.from(html);
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  const hash = createHash('sha256').update(bytes).digest('hex');
  const recorded = manifest.files.find(
    (file) => file.name === 'START_HERE.html',
  );
  if (process.argv.includes('--update-manifest')) {
    recorded.bytes = bytes.length;
    recorded.sha256 = hash;
    await writeFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
  } else if (recorded.bytes !== bytes.length || recorded.sha256 !== hash) {
    throw new Error(
      'Built pre-lab differs from its recorded presentation revision. Review the change and update its manifest explicitly.',
    );
  }
  await writeFile(publicFile, bytes);
  console.log(
    'Packaged Noise and Filtering pre-lab with offline MathML equations.',
  );
}
