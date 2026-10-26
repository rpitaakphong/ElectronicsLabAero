import { readFile } from 'node:fs/promises';
import { FILTER_EXAMPLE } from './instructor/filter-examples.js';
export async function sketchSources() {
  const [repaired, template, math] = await Promise.all([
    readFile(new URL('./arduino/aircraft_signal/aircraft_signal.ino', import.meta.url), 'utf8'),
    readFile(new URL('./instructor/completed-template.ino', import.meta.url), 'utf8'),
    readFile(new URL('./arduino/aircraft_signal/signal_math.h', import.meta.url), 'utf8'),
  ]);
  // Keep the tested instructor source working; introduce one fault only in the student download.
  const startup = 'timerOK = startSignalGenerator();';
  if (repaired.split(startup).length !== 2) throw new Error('Expected exactly one generator startup call.');
  const source = repaired.replace(startup, 'timerOK = startSignalGenrator();');
  const hook = 'void processSample(float measured, float &ma, float &ema) {\n  ma = measured;\n  ema = measured;\n}';
  if (!template.includes(hook)) throw new Error('Private reference integration hook changed.');
  const digital = template.replace('#include "signal_math.h"', math.replace('#pragma once\n', ''))
    .replace('constexpr bool DIGITAL_FILTERS = false;', 'constexpr bool DIGITAL_FILTERS = true;').replace(hook, FILTER_EXAMPLE);
  return { source, repaired, digital };
}
