import { build } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { zipSync, strToU8 } from 'fflate';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(path.join(root, 'public/worksheets'), { recursive: true });
async function workbook(directory, filename) {
  const source = path.join(root, 'activities', directory);
  const result = await build({ configFile: false, root, logLevel: 'warn', build: {
    write: false, minify: false, cssCodeSplit: false,
    lib: { entry: path.join(source, 'app.js'), name: 'NoiseMainLab', formats: ['iife'] },
  } });
  const bundle = Array.isArray(result) ? result[0] : result;
  const js = bundle.output.filter((o) => o.type === 'chunk').map((o) => o.code).join('\n');
  const css = bundle.output.filter((o) => o.type === 'asset' && o.fileName.endsWith('.css')).map((o) => String(o.source)).join('\n');
  if (!js || !css) throw new Error('Missing workbook output.');
  let html = (await readFile(path.join(source, 'index.html'), 'utf8'))
    .replace('/* WORKBOOK_JS */', () => js.replaceAll('</script', '<\\/script'))
    .replace('/* WORKBOOK_CSS */', () => css.replaceAll('</style', '<\\/style'));
  if (directory === 'noise-filtering-main-lab') {
    for (const [marker, filename] of [
      ['__NOISE_MAIN_LAB_FFT_ILLUSTRATION__', 'fft-signal-spectrum.jpeg'],
      ['__NOISE_MAIN_LAB_FFT_COMPARISON__', 'fft-input-output-comparison.jpeg'],
      ['__NOISE_MAIN_LAB_DIGITAL_ILLUSTRATION__', 'digital-filter-smoothing.jpeg'],
    ]) {
      const image = await readFile(path.join(source, 'figures', filename));
      if (!html.includes(marker)) throw new Error(`Missing illustration slot for ${filename}.`);
      html = html.replaceAll(marker, `data:image/jpeg;base64,${image.toString('base64')}`);
    }
  }
  if (/<script\b[^>]*src=/i.test(html) || /<link\b[^>]*href="(?!data:)/i.test(html) || /@import\b|url\(https?:/i.test(css)) throw new Error('Workbook has external runtime assets.');
  await writeFile(path.join(root, 'public/worksheets', filename), html);
}
await workbook('noise-filtering-main-lab-v1', 'noise-filtering-main-lab-v1.html');
await workbook('noise-filtering-main-lab-v2', 'noise-filtering-main-lab-v2.html');
await workbook('noise-filtering-main-lab-v3', 'noise-filtering-main-lab-v3.html');
await workbook('noise-filtering-main-lab', 'noise-filtering-main-lab.html');

const legacy = path.join(root, 'public/courses/2145427/week12/main-lab/v1.0.0');
await mkdir(legacy, { recursive: true });
const legacyEntries = {};
for (const file of ['noise_filtering_main_lab.ino', 'acquisition.h']) legacyEntries[`noise_filtering_main_lab/${file}`] = new Uint8Array(await readFile(path.join(root, 'activities/noise-filtering-main-lab-v1/arduino/noise_filtering_main_lab', file)));
await writeFile(path.join(legacy, 'noise_filtering_main_lab.zip'), zipSync(legacyEntries, { level: 0 }));
await writeFile(path.join(legacy, 'CAPTURE_GUIDE.txt'), await readFile(path.join(root, 'activities/noise-filtering-main-lab-v1/CAPTURE_GUIDE.txt')));

for (const [directory, version] of [['noise-filtering-main-lab-v2', 'v2.0.0'], ['noise-filtering-main-lab-v3', 'v3.0.0']]) {
  const downloads = path.join(root, 'public/courses/2145427/week12/main-lab', version);
  await mkdir(downloads, { recursive: true });
  const { sketchSources } = await import(`../activities/${directory}/package-source.mjs`);
  const { FILTER_EXAMPLE } = await import(`../activities/${directory}/filter-examples.js`);
  const { starter } = await sketchSources();
  await writeFile(path.join(downloads, 'aircraft_signal_starter.zip'), zipSync({ 'aircraft_signal_starter/aircraft_signal_starter.ino': strToU8(starter) }, { level: 0 }));
  await writeFile(path.join(downloads, 'CAPTURE_GUIDE.txt'), await readFile(path.join(root, 'activities', directory, 'CAPTURE_GUIDE.txt')));
  await writeFile(path.join(downloads, 'FILTER_EXAMPLES.txt'), FILTER_EXAMPLE);
}
const current = path.join(root, 'public/courses/2145427/week12/main-lab/v4.0.0');
await mkdir(current, { recursive: true });
const { sketchSources } = await import('../activities/noise-filtering-main-lab/package-source.mjs');
const { source } = await sketchSources();
await writeFile(path.join(current, 'aircraft_pulse_source.zip'), zipSync({ 'aircraft_pulse_source/aircraft_pulse_source.ino': strToU8(source) }, { level: 0 }));
await writeFile(path.join(current, 'LAB_GUIDE.txt'), await readFile(path.join(root, 'activities/noise-filtering-main-lab/LAB_GUIDE.txt')));
console.log('Packaged seven-section v4 workbook and source-only sketch; older v1/v2/v3 worksheets remain available.');
