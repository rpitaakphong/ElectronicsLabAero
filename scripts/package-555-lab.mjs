import { build } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'activities/555-main-lab');
const destination = path.join(root, 'output/555-main-lab');
const result = await build({
  configFile: false,
  root,
  logLevel: 'warn',
  build: {
    write: false,
    minify: false,
    cssCodeSplit: false,
    lib: {
      entry: path.join(source, 'app.js'),
      name: 'MainLabWorkbook',
      formats: ['iife'],
    },
  },
});
const bundle = Array.isArray(result) ? result[0] : result;
const js = bundle.output
  .filter((item) => item.type === 'chunk')
  .map((item) => item.code)
  .join('\n');
const css = bundle.output
  .filter((item) => item.type === 'asset' && item.fileName.endsWith('.css'))
  .map((item) => String(item.source))
  .join('\n');
if (!js || !css) throw new Error('Missing workbook runtime or stylesheet.');
let html = await readFile(path.join(source, 'index.html'), 'utf8');
html = html
  .replace('/* WORKBOOK_CSS */', () => css.replaceAll('</style', '<\\/style'))
  .replace('/* WORKBOOK_JS */', () => js.replaceAll('</script', '<\\/script'));
if (
  /<script\b[^>]*src=/i.test(html) ||
  /<link\b[^>]*href="(?!data:)/i.test(html) ||
  /@import\b|url\(https?:/i.test(css)
)
  throw new Error('The workbook must not need external assets.');
await mkdir(destination, { recursive: true });
await writeFile(path.join(destination, 'START_HERE.html'), html);
const online = path.join(root, 'public/worksheets');
await mkdir(online, { recursive: true });
await writeFile(path.join(online, '555-main-lab.html'), html);
console.log(
  'Packaged identical online and offline 555 main lab worksheets.',
);
