import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(
  await readFile(
    new URL(
      '../activities/noise-filtering-prelab/release-manifest.json',
      import.meta.url,
    ),
    'utf8',
  ),
);

export async function verifyNoisePrelab(output = 'public') {
  const directory = path.join(root, output, manifest.publicPath);
  const actual = await readdir(directory, { withFileTypes: true });
  const expectedNames = manifest.files.map((file) => file.name).sort();
  if (
    actual.some((entry) => !entry.isFile()) ||
    JSON.stringify(actual.map((entry) => entry.name).sort()) !==
      JSON.stringify(expectedNames)
  ) {
    throw new Error(
      'Noise pre-lab must contain exactly the three student release files.',
    );
  }
  for (const file of manifest.files) {
    const bytes = await readFile(path.join(directory, file.name));
    if (
      bytes.length !== file.bytes ||
      createHash('sha256').update(bytes).digest('hex') !== file.sha256
    ) {
      throw new Error(`Noise pre-lab release integrity failed: ${file.name}`);
    }
  }
  const privateNames = new Set([
    'prelab-adapter.mjs',
    'INSTRUCTOR_INTEGRATION_GUIDE.md',
    'DATA_CONTRACT.md',
    'FIELD_MAPPING.csv',
    'prelab-evidence.schema.json',
    'workspace-backup.schema.json',
    'release-manifest.json',
  ]);
  const entries = await readdir(path.join(root, output), {
    recursive: true,
    withFileTypes: true,
  });
  if (
    entries.some(
      (entry) =>
        entry.isFile() &&
        (privateNames.has(entry.name) ||
          entry.name.endsWith('.synthetic.json') ||
          entry.name.includes('INSTRUCTOR_HANDOFF')),
    )
  ) {
    throw new Error('Instructor-only pre-lab material must not be published.');
  }
  return expectedNames;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const output = process.argv[2] || 'public';
  await verifyNoisePrelab(output);
  console.log(
    `Verified Noise and Filtering student presentation release in ${output}.`,
  );
}
