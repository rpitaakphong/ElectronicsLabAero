import { readFile } from 'node:fs/promises';
import { FILTER_EXAMPLE } from './filter-examples.js';

export async function sketchSources() {
  const base = new URL('./arduino/aircraft_signal/', import.meta.url);
  const [template, math] = await Promise.all([
    readFile(new URL('aircraft_signal.ino', base), 'utf8'),
    readFile(new URL('signal_math.h', base), 'utf8'),
  ]);
  const starter = template.replace('#include "signal_math.h"', math.replace('#pragma once\n', ''));
  const fault = 'timerOK = startSignalGenrator();';
  if (starter.split(fault).length !== 2) throw new Error('Expected exactly one deliberate compilation fault.');
  const repaired = starter.replace(fault, 'timerOK = startSignalGenerator();');
  const hook = 'void processSample(float measured, float &ma, float &ema) {\n  ma = measured;\n  ema = measured;\n}';
  if (!repaired.includes(hook)) throw new Error('Student integration hook changed; update the reference fixture.');
  const digital = repaired.replace('constexpr bool DIGITAL_FILTERS = false;', 'constexpr bool DIGITAL_FILTERS = true;').replace(hook, FILTER_EXAMPLE);
  return { starter, repaired, digital };
}
