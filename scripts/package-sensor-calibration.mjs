import { build } from 'vite';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'activities/sensor-calibration');
const built = await build({
  configFile: false,
  root,
  logLevel: 'warn',
  build: {
    write: false,
    minify: false,
    cssCodeSplit: false,
    lib: {
      entry: path.join(source, 'app.js'),
      name: 'SensorCalibration',
      formats: ['iife'],
    },
  },
});
const bundle = Array.isArray(built) ? built[0] : built;
const js = bundle.output
  .filter((o) => o.type === 'chunk')
  .map((o) => o.code)
  .join('\n');
const css = bundle.output
  .filter((o) => o.type === 'asset' && o.fileName.endsWith('.css'))
  .map((o) => String(o.source))
  .join('\n');
if (!js || !css || /@import\b|url\(https?:/i.test(css))
  throw new Error('Missing or external worksheet runtime assets.');
const template = await readFile(path.join(source, 'index.html'), 'utf8');
await mkdir(path.join(root, 'public/worksheets'), { recursive: true });
for (const [kind, title] of [
  ['main', 'Group Main Lab'],
  ['post', 'Individual Post-Lab'],
]) {
  const html = template
    .replaceAll('WORKBOOK_KIND', kind)
    .replaceAll('WORKBOOK_TITLE', title)
    .replace('/* WORKBOOK_JS */', () => js.replaceAll('</script', '<\\/script'))
    .replace('/* WORKBOOK_CSS */', () =>
      css.replaceAll('</style', '<\\/style'),
    );
  if (
    /<script\b[^>]*src=/i.test(html) ||
    /<link\b[^>]*href="(?!data:)/i.test(html)
  )
    throw new Error('Worksheet is not self-contained.');
  await writeFile(
    path.join(root, `public/worksheets/sensor-calibration-${kind}-lab.html`),
    html,
  );
}
// Remove the old supplied program from generated student downloads.
await rm(
  path.join(
    root,
    'public/courses/2145427/sensor-calibration/v1.0.0/ultrasonic_echo.zip',
  ),
  { force: true },
);
console.log(
  'Packaged version-two Sensor Calibration group and individual worksheets.',
);
