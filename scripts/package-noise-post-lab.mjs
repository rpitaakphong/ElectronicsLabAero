import { build } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'activities/noise-filtering-post-lab');
const result = await build({ configFile: false, root, logLevel: 'warn', build: {
  write: false, minify: false, cssCodeSplit: false,
  lib: { entry: path.join(source, 'app.js'), name: 'NoisePostLab', formats: ['iife'] },
} });
const bundle = Array.isArray(result) ? result[0] : result;
const js = bundle.output.filter(o => o.type === 'chunk').map(o => o.code).join('\n');
const css = bundle.output.filter(o => o.type === 'asset' && o.fileName.endsWith('.css')).map(o => String(o.source)).join('\n');
if (!js || !css) throw new Error('Missing workbook output.');
const html = (await readFile(path.join(source, 'index.html'), 'utf8'))
  .replace('/* WORKBOOK_JS */', () => js.replaceAll('</script', '<\\/script'))
  .replace('/* WORKBOOK_CSS */', () => css.replaceAll('</style', '<\\/style'));
if (/<script\b[^>]*src=/i.test(html) || /<link\b[^>]*href="(?!data:)/i.test(html) || /@import\b|url\(https?:/i.test(css)) throw new Error('Workbook has external runtime assets.');
await mkdir(path.join(root, 'public/worksheets'), { recursive: true });
await writeFile(path.join(root, 'public/worksheets/noise-filtering-post-lab.html'), html);
console.log('Packaged separate Noise and Filtering individual post-lab workbook.');
