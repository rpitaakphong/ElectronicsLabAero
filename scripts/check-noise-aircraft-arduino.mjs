import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { sketchSources } from '../activities/noise-filtering-main-lab/package-source.mjs';

const cli = process.env.ARDUINO_CLI || '/private/tmp/noise-arduino-tools/arduino-cli';
const output = path.resolve('output/noise-aircraft-arduino');
const sources = await sketchSources(), results = [];
await mkdir(output, { recursive: true });
for (const [kind, source] of Object.entries(sources)) {
  const directory = path.join(output, kind);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `${kind}.ino`), source);
  for (const board of ['minima', 'unor4wifi']) {
    const args = ['compile', '--fqbn', `arduino:renesas_uno:${board}`, '--build-path', path.join(output, `build-${kind}-${board}`), directory];
    const result = await new Promise((resolve, reject) => {
      const child = spawn(cli, args, { env: { ...process.env,
        ARDUINO_DIRECTORIES_DATA: process.env.ARDUINO_DIRECTORIES_DATA || '/private/tmp/noise-arduino-tools/data',
        ARDUINO_DIRECTORIES_DOWNLOADS: process.env.ARDUINO_DIRECTORIES_DOWNLOADS || '/private/tmp/noise-arduino-tools/downloads',
      } });
      let text = '';
      child.stdout.on('data', (v) => { text += v; }); child.stderr.on('data', (v) => { text += v; });
      child.on('error', reject); child.on('close', (code) => resolve({ code, text }));
    });
    await writeFile(path.join(output, `${kind}-${board}.log`), result.text);
    const errors = result.text.split('\n').filter((line) => /\berror:/.test(line));
    const expectedFailure = kind === 'source';
    const expected = expectedFailure
      ? result.code !== null && result.code !== 0 && errors.length === 1
        && errors.every((line) => line.includes('startSignalGenrator') && /not declared|undeclared/.test(line))
      : result.code === 0;
    results.push({ kind, board, passed: expected, expectedFailure, exitCode: result.code, errors, summary: result.text.split('\n').filter((s) => /Sketch uses|Global variables/.test(s)) });
    console.log(`${kind} / ${board}: ${expected ? 'PASS' : 'FAIL'}${expectedFailure ? ' (expected deliberate compilation error)' : ''}`);
    if (!expected) { console.error(result.text); process.exitCode = 1; }
    else for (const line of results.at(-1).summary) console.log(line);
  }
}
await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
