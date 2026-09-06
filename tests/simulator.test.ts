import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cloneDefault,
  simulate,
  characteristics,
  validateConfig,
  waveform,
  type Circuit,
} from '../lib/opamp/simulator';
import { createLabTools } from '../lib/opamp/browser-tools';
function close(a: number, b: number, tol = 1e-6) {
  assert.ok(Math.abs(a - b) <= tol, `${a} should be within ${tol} of ${b}`);
}

test('inverting amplifier has exact gain and opposite polarity', () => {
  const c = cloneDefault();
  c.circuit = 'inverting';
  const r = simulate(c);
  close(r.metrics.gain!, -2);
  close(r.metrics.outputVpp, 2);
  for (const s of r.samples) close(s.output, -2 * s.input);
});
test('supports a fixed oscilloscope time window without changing the default window', () => {
  const c = cloneDefault();
  c.source.frequency = 2000;
  const natural = simulate(c);
  const fixed = simulate(c, { duration: 0.004, steps: 8191 });
  close(natural.duration, 0.002);
  close(fixed.duration, 0.004);
  assert.equal(fixed.samples.length, 8192);
  close(fixed.samples.at(-1)!.time, 0.004);
});
test('non-inverting gain and reference offset use the feedback reference', () => {
  const c = cloneDefault();
  c.circuit = 'noninverting';
  c.source.offset = 2.5;
  c.components.reference = 2.5;
  const r = simulate(c);
  close(r.metrics.gain!, 3);
  close(r.metrics.outputMin, 1);
  close(r.metrics.outputMax, 4);
});
test('inverting reference bias has the correct sign and DC term', () => {
  const c = cloneDefault();
  c.circuit = 'inverting';
  c.source.offset = 2;
  c.source.amplitude = 0;
  c.components.reference = 1;
  const r = simulate(c);
  close(r.metrics.outputMin, -1);
  close(r.metrics.outputVpp, 0);
  assert.equal(r.metrics.measuredGain, null);
});
test('buffer follows sine, triangle and square, regardless of resistor/reference values', () => {
  for (const shape of ['sine', 'triangle', 'square'] as const) {
    const c = cloneDefault();
    c.circuit = 'buffer';
    c.source.waveform = shape;
    c.source.offset = 1;
    c.components.reference = -5;
    for (const s of simulate(c).samples) close(s.output, s.input);
  }
});
test('triangle has the same zero crossing and positive direction as sine', () => {
  close(waveform('triangle', 0), 0);
  close(waveform('triangle', 0.25), 1);
  close(waveform('triangle', 0.5), 0);
  close(waveform('triangle', 0.75), -1);
});
test('summing weights, cancellation and reference equation', () => {
  const c = cloneDefault();
  c.circuit = 'summing';
  let r = simulate(c);
  close(r.metrics.outputVpp, 4);
  c.second.phase = 180;
  r = simulate(c);
  assert.ok(r.metrics.outputVpp < 1e-10);
  c.components.r2 = 20000;
  c.components.reference = 1;
  c.source.offset = 0.5;
  c.second.offset = 0.2;
  r = simulate(c);
  for (const s of r.samples)
    close(s.output, 1 - 2 * (s.input - 1) - (s.second - 1));
});
test('low-pass cutoff is -3 dB relative to DC gain', () => {
  const c = cloneDefault();
  c.circuit = 'lowpass';
  c.source.frequency = characteristics(c).cutoff!;
  const r = simulate(c);
  close(r.metrics.measuredGain!, 2 / Math.sqrt(2), 1e-5);
  c.source.frequency = 1;
  close(simulate(c).metrics.measuredGain!, 2, 0.0001);
});
test('filter preserves DC bias and square/triangle periodic symmetry', () => {
  for (const shape of ['square', 'triangle'] as const) {
    const c = cloneDefault();
    c.circuit = 'lowpass';
    c.source.waveform = shape;
    c.source.offset = 2.5;
    c.components.reference = 2.5;
    const r = simulate(c);
    close(r.metrics.outputMin + r.metrics.outputMax, 5, 0.001);
    const half = 512;
    for (let i = 0; i < 1024 - half; i++)
      close(r.samples[i].output + r.samples[i + half].output, 5, 0.002);
    assert.ok(r.metrics.outputVpp < 2);
  }
});
test('comparator uses >= threshold and separate high/low levels', () => {
  const c = cloneDefault();
  c.circuit = 'comparator';
  c.components.reference = 0.2;
  for (const s of simulate(c).samples)
    assert.equal(s.output, s.input >= 0.2 ? 5 : -5);
  c.source.amplitude = 0;
  c.source.offset = 0.2;
  assert.equal(simulate(c).metrics.outputMin, 5);
  c.components.reference = 1;
  assert.equal(simulate(c).metrics.outputMax, -5);
  c.components.outputLow = -2;
  c.components.outputHigh = 3;
  c.source.amplitude = 0.5;
  c.source.offset = 0;
  c.components.reference = 0.2;
  const custom = simulate(c);
  assert.equal(custom.metrics.outputMin, -2);
  assert.equal(custom.metrics.outputMax, 3);
});
test('extreme filter/time constants stay finite and settle near the reference', () => {
  const c = cloneDefault();
  c.circuit = 'lowpass';
  c.components.rf = 100000;
  c.components.capacitance = 1e-5;
  c.source.frequency = 1e6;
  c.source.waveform = 'square';
  c.components.reference = 1;
  c.source.offset = 1;
  const r = simulate(c);
  assert.ok(r.samples.every((s) => Number.isFinite(s.output)));
  close(r.metrics.outputMax, 1, 0.001);
  close(r.metrics.outputMin, 1, 0.001);
});
test('all circuits handle zero amplitude and parameter extremes without NaN', () => {
  for (const circuit of [
    'inverting',
    'noninverting',
    'buffer',
    'summing',
    'lowpass',
    'comparator',
  ] as Circuit[]) {
    for (const amplitude of [0, 10]) {
      const c = cloneDefault();
      c.circuit = circuit;
      c.source.amplitude = amplitude;
      c.source.frequency = 1e6;
      c.components.rf = 100000;
      c.components.rin = 1000;
      const r = simulate(c);
      assert.ok(r.samples.every((s) => Number.isFinite(s.output)));
    }
  }
});
test('invalid numeric inputs and comparator levels are rejected atomically', () => {
  for (const n of [NaN, Infinity, -1, 0]) {
    const c = cloneDefault();
    c.components.rin = n;
    assert.throws(() => validateConfig(c));
  }
  const c = cloneDefault();
  c.components.outputLow = 5;
  c.components.outputHigh = 5;
  assert.throws(() => validateConfig(c), /LOW output/);
  assert.throws(() => validateConfig({}));
});
test('browser tools share state and validate before mutating', () => {
  let config = cloneDefault(),
    result = simulate(config);
  const tools = createLabTools(
    () => ({ config, result }),
    (c) => {
      config = c;
      result = simulate(c);
    },
  );
  assert.equal(tools[0].annotations.readOnlyHint, true);
  assert.equal(tools[1].annotations.readOnlyHint, false);
  const next = cloneDefault();
  next.circuit = 'buffer';
  const response = tools[1].execute(next) as {
    config: typeof config;
    metrics: typeof result.metrics;
  };
  assert.equal(response.config.circuit, 'buffer');
  assert.equal(response.metrics.gain, 1);
  const invalid = cloneDefault();
  invalid.source.frequency = NaN;
  assert.throws(() => tools[1].execute(invalid));
  assert.equal(config.circuit, 'buffer');
});
