import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'vendor/opamp-lab-simulator');
const packages = [
  {
    id: 'opamp',
    entry: 'index.html',
    offline: 'gds1202b_opamp_sim_single_file.html',
    scripts: [
      'embed.js',
      'profiles.js',
      'engine.js',
      'transient-engine.js',
      'sfg1013.js',
      'routing.js',
      'ua741.js',
      'presets.js',
      'app.js',
      'layout.js',
      'schematics.js',
    ],
  },
  {
    id: 'rc-filter',
    entry: 'rc.html',
    offline: 'rc_filter_sim_single_file.html',
    scripts: [
      'embed.js',
      'profiles.js',
      'engine.js',
      'transient-engine.js',
      'sfg1013.js',
      'routing.js',
      'rc-engine.js',
      'rc.js',
      'app.js',
      'layout.js',
    ],
  },
  {
    id: 'voltage-divider',
    entry: 'divider.html',
    offline: 'voltage_divider_sim_single_file.html',
    scripts: [
      'embed.js',
      'profiles.js',
      'engine.js',
      'dc-engine.js',
      'routing.js',
      'divider.js',
      'app.js',
      'layout.js',
    ],
  },
];
const read = (name) => readFile(path.join(source, name), 'utf8');
const dataUrl = async (name, mime) =>
  `data:${mime};base64,${(await readFile(path.join(source, 'assets', name))).toString('base64')}`;

for (const { id, entry, offline, scripts } of packages) {
  const destination = path.join(root, 'public/simulators', id);
  // Only runtime assets are published, never tests, tooling, or the upstream checkout.
  await mkdir(destination, { recursive: true });
  await rm(path.join(destination, 'assets'), { recursive: true, force: true });
  await cp(path.join(source, 'assets'), path.join(destination, 'assets'), {
    recursive: true,
  });
  await cp(path.join(source, entry), path.join(destination, 'index.html'));
  for (const name of ['styles.css', ...scripts]) {
    await cp(path.join(source, name), path.join(destination, name));
  }

  // Build the downloadable standalone from the same inputs, with no Python build dependency.
  let html = await read(entry);
  let css = await read('styles.css');
  for (const name of ['inter-400.woff2', 'inter-600.woff2']) {
    css = css.replaceAll(`assets/${name}`, await dataUrl(name, 'font/woff2'));
  }
  // Use callbacks so literal replacement tokens inside simulator source remain unchanged.
  html = html.replace(
    '<link rel="stylesheet" href="styles.css" />',
    () => `<style>\n${css}\n</style>`,
  );
  for (const name of scripts) {
    const code = await read(name);
    html = html.replace(
      `<script src="${name}"></script>`,
      () => `<script>\n${code}\n</script>`,
    );
  }
  for (const [name, mime] of [
    ['chula-logo.webp', 'image/webp'],
    ['favicon.svg', 'image/svg+xml'],
  ]) {
    html = html.replaceAll(`assets/${name}`, await dataUrl(name, mime));
  }
  const license = (await read('assets/Inter-LICENSE.txt')).replaceAll(
    '--',
    '—',
  );
  html = html.replace(
    '</head>',
    () => `<!-- Embedded Inter font license:\n${license}\n-->\n</head>`,
  );
  await writeFile(path.join(destination, offline), html);
  console.log(`Packaged ${id} simulator and offline HTML.`);
}
