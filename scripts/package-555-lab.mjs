import { build } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
for (const activity of ['555-main-lab', '555-post-lab']) {
  const source = path.join(root, 'activities', activity);
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
  let js = bundle.output
    .filter((item) => item.type === 'chunk')
    .map((item) => item.code)
    .join('\n');
  if (js.includes('__555_PUSHBUTTON_IMAGE_URL__')) {
    const image = await readFile(
      path.join(
        root,
        'activities/555-main-lab/assets/pushbutton-terminals.png',
      ),
    );
    js = js.replaceAll(
      '__555_PUSHBUTTON_IMAGE_URL__',
      `data:image/png;base64,${image.toString('base64')}`,
    );
  }
  const css = bundle.output
    .filter((item) => item.type === 'asset' && item.fileName.endsWith('.css'))
    .map((item) => String(item.source))
    .join('\n');
  if (!js || !css) throw new Error('Missing workbook runtime or stylesheet.');
  let html = await readFile(path.join(source, 'index.html'), 'utf8');
  html = html
    .replace('/* WORKBOOK_CSS */', () => css.replaceAll('</style', '<\\/style'))
    .replace('/* WORKBOOK_JS */', () =>
      js.replaceAll('</script', '<\\/script'),
    );
  if (
    /<script\b[^>]*src=/i.test(html) ||
    /<link\b[^>]*href="(?!data:)/i.test(html) ||
    /@import\b|url\(https?:/i.test(css)
  )
    throw new Error('The workbook must not need external assets.');
  const online = path.join(root, 'public/worksheets');
  await mkdir(online, { recursive: true });
  await writeFile(path.join(online, `${activity}.html`), html);
  console.log(`Packaged Vercel worksheet: ${activity}.html`);
}
