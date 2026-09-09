import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONFIGURATIONS,
  EXAMPLE_DEFAULTS,
  defaults,
  periodicAt,
  simulate,
  stepAt,
  validate,
  wave,
  type RcComponents,
  type RcKind,
} from '../lib/rc/simulator';

const near = (actual: number, expected: number, tolerance = 1e-10) =>
  assert(
    Math.abs(actual - expected) <= tolerance,
    `${actual} ≠ ${expected} (tolerance ${tolerance})`,
  );

type Complex = [number, number];
const add = (a: Complex, b: Complex): Complex => [a[0] + b[0], a[1] + b[1]];
const multiply = (a: Complex, b: Complex): Complex => [
  a[0] * b[0] - a[1] * b[1],
  a[0] * b[1] + a[1] * b[0],
];
const divide = (a: Complex, b: Complex): Complex => {
  const den = b[0] ** 2 + b[1] ** 2;
  return [(a[0] * b[0] + a[1] * b[1]) / den, (a[1] * b[0] - a[0] * b[1]) / den];
};
const parallel = (a: Complex, b: Complex) => divide(multiply(a, b), add(a, b));

/** Independent impedance-divider equations, including the load seen by stage 1. */
function impedanceResponse(kind: RcKind, c: RcComponents, f: number): Complex {
  const zc1: Complex = [0, -1 / (2 * Math.PI * f * c.c1)],
    r1: Complex = [c.r1, 0],
    rl: Complex = [c.load, 0];
  if (kind === 'lowpass') {
    const z = c.loaded ? parallel(zc1, rl) : zc1;
    return divide(z, add(r1, z));
  }
  if (kind === 'highpass') {
    const z = c.loaded ? parallel(r1, rl) : r1;
    return divide(z, add(zc1, z));
  }
  const zc2: Complex = [0, -1 / (2 * Math.PI * f * c.c2)],
    r2: Complex = [c.r2, 0],
    output = c.loaded ? parallel(zc2, rl) : zc2,
    secondStage = add(r2, output),
    firstStageLoad = parallel(r1, secondStage);
  return multiply(
    divide(firstStageLoad, add(zc1, firstStageLoad)),
    divide(output, secondStage),
  );
}

test('each RC category begins with its intended useful signal and interference', () => {
  const c = defaults();
  const expected = {
    lowpass: [0.9921966, 0.1571767],
    highpass: [0.9528905, 0.0314004],
    bandpass: [0.8333283, 0.124451, 0.1567123],
  };
  for (const kind of CONFIGURATIONS) {
    c.kind = kind;
    const result = simulate(c);
    assert.equal(result.isExample, true);
    assert.equal(result.exampleWindow, 'detail');
    assert.equal(result.selected.frequency, EXAMPLE_DEFAULTS[kind].frequency);
    assert.equal(result.tones[0].role, 'useful');
    assert.equal(result.tones[0].label, 'Useful signal');
    assert.equal(result.tones[0].amplitude, 1);
    assert.equal(result.tones.length, expected[kind].length);
    result.tones.forEach((tone, i) => {
      near(tone.response.gain, expected[kind][i], 1e-7);
      near(tone.outputAmplitude, tone.amplitude * tone.response.gain);
    });
    assert.equal(result.samples[0].input, 0);
    assert.equal(result.samples[0].desired, 0);
    const firstDefaults = defaults();
    firstDefaults.examples[kind].interferenceFrequencies[0] = 123;
    assert.notEqual(defaults().examples[kind].interferenceFrequencies[0], 123);
  }
});

test('mixed inputs and outputs match independent complex network equations', () => {
  for (const kind of CONFIGURATIONS)
    for (const loaded of [false, true]) {
      const c = defaults();
      c.kind = kind;
      Object.assign(c.circuits[kind], {
        loaded,
        load: 27000,
        r1: 12000,
        r2: 6800,
        c1: kind === 'bandpass' ? 220e-9 : 22e-9,
        c2: 33e-9,
      });
      c.examples[kind].strength = 135;
      const result = simulate(c);
      for (const tone of result.tones) {
        const [re, im] = impedanceResponse(
          kind,
          c.circuits[kind],
          tone.frequency,
        );
        near(tone.response.gain, Math.hypot(re, im));
        near(tone.response.phase, (Math.atan2(im, re) * 180) / Math.PI);
      }
      for (const sample of result.samples.filter((_, i) => i % 23 === 0)) {
        let input = 0,
          output = 0;
        for (const tone of result.tones) {
          const phase = 2 * Math.PI * tone.frequency * sample.time,
            [re, im] = impedanceResponse(
              kind,
              c.circuits[kind],
              tone.frequency,
            );
          input += tone.amplitude * Math.sin(phase);
          output +=
            tone.amplitude * (re * Math.sin(phase) + im * Math.cos(phase));
        }
        near(sample.input, input);
        near(sample.output, output, 1e-11);
        near(
          sample.desired!,
          Math.sin(2 * Math.PI * c.examples[kind].frequency * sample.time),
        );
      }
    }
});

test('zero-strength interference is identical to clean signal and omits inactive tones', () => {
  for (const kind of CONFIGURATIONS) {
    const c = defaults();
    c.kind = kind;
    c.examples[kind].strength = 0;
    c.examples[kind].window = 'overview';
    const disabled = simulate(c);
    c.examples[kind].input = 'clean';
    c.examples[kind].strength = 200;
    const clean = simulate(c);
    assert.deepEqual(clean.samples, disabled.samples);
    assert.deepEqual(clean.tones, disabled.tones);
    assert.equal(clean.tones.length, 1);
    assert(clean.samples.every((sample) => sample.desired === sample.input));
    near(clean.duration, 4 / c.examples[kind].frequency);
  }
});

test('zero useful amplitude preserves interference and zero inputs remain defined', () => {
  for (const kind of CONFIGURATIONS) {
    const c = defaults();
    c.kind = kind;
    c.examples[kind].amplitude = 0;
    c.examples[kind].window = 'overview';
    const mixed = simulate(c);
    assert.equal(mixed.tones[0].amplitude, 0);
    assert(mixed.samples.every((sample) => sample.desired === 0));
    assert(mixed.samples.some((sample) => Math.abs(sample.input) > 0.2));
    for (const sample of mixed.samples.filter((_, i) => i % 43 === 0)) {
      const expected = mixed.tones.slice(1).reduce((sum, tone) => {
        const [re, im] = impedanceResponse(
            kind,
            c.circuits[kind],
            tone.frequency,
          ),
          phase = 2 * Math.PI * tone.frequency * sample.time;
        return (
          sum + tone.amplitude * (re * Math.sin(phase) + im * Math.cos(phase))
        );
      }, 0);
      near(sample.output, expected, 1e-11);
    }
    c.examples[kind].strength = 0;
    const zero = simulate(c);
    assert.equal(zero.samples.length, 1001);
    assert(
      zero.samples.every((sample) => sample.input === 0 && sample.output === 0),
    );
  }
});

test('coincident useful and interference frequencies add with their actual attenuation and phase', () => {
  for (const kind of CONFIGURATIONS) {
    const c = defaults();
    c.kind = kind;
    c.examples[kind].interferenceFrequencies.fill(c.examples[kind].frequency);
    const result = simulate(c),
      amplitude = result.tones.reduce((sum, tone) => sum + tone.amplitude, 0),
      [re, im] = impedanceResponse(
        kind,
        c.circuits[kind],
        result.selected.frequency,
      );
    for (const sample of result.samples) {
      const phase = 2 * Math.PI * result.selected.frequency * sample.time;
      near(sample.input, amplitude * Math.sin(phase));
      near(
        sample.output,
        amplitude * (re * Math.sin(phase) + im * Math.cos(phase)),
      );
    }
    assert(
      result.tones.every((tone) => tone.response.gain === result.selected.gain),
    );
  }
});

test('detail and overview resolve fast interference and reveal slow drift', () => {
  const expectedDurations = {
    lowpass: [0.02, 0.02],
    highpass: [0.0008, 0.02],
    bandpass: [0.008, 0.05],
  };
  for (const kind of CONFIGURATIONS)
    for (const [i, window] of (['detail', 'overview'] as const).entries()) {
      const c = defaults();
      c.kind = kind;
      c.examples[kind].window = window;
      const result = simulate(c),
        fastest = Math.max(...result.tones.map((tone) => tone.frequency)),
        dt = result.duration / (result.samples.length - 1);
      near(result.requestedDuration, expectedDurations[kind][i]);
      assert.equal(result.duration, result.requestedDuration);
      assert.equal(result.windowLimited, false);
      assert.equal(result.exampleWindow, window);
      assert(result.samples.length >= 1001 && result.samples.length <= 32769);
      assert(dt <= (1 / (32 * fastest)) * (1 + 1e-12));
      near(result.samples.at(-1)!.time, result.duration);
    }
});

test('extreme frequency ratios shorten the window rather than undersampling', () => {
  const c = defaults();
  c.examples.lowpass.frequency = 0.1;
  c.examples.lowpass.interferenceFrequencies[0] = 1e6;
  const result = simulate(c);
  assert.equal(result.requestedDuration, 40);
  assert.equal(result.samples.length, 32769);
  assert.equal(result.windowLimited, true);
  near(result.duration, 32768 / (32 * 1e6));
  assert(result.duration < result.requestedDuration);
  near(result.samples[1].time, 1 / (32 * 1e6));
  for (const tone of result.tones) {
    assert(result.sweep.some((point) => point.frequency === tone.frequency));
    assert(result.sweep[0].frequency < tone.frequency);
    assert(result.sweep.at(-1)!.frequency > tone.frequency);
  }
  c.examples.lowpass.strength = 0;
  const clean = simulate(c);
  assert.equal(clean.windowLimited, false);
  assert.equal(clean.duration, 40);
  assert.equal(clean.samples.length, 1001);
  assert(clean.sweep.at(-1)!.frequency < 1e6);
});

test('example outputs and per-tone responses stay finite at component and signal extremes', () => {
  for (const kind of CONFIGURATIONS)
    for (const resistance of [100, 1e6])
      for (const capacitance of [1e-10, 1e-5])
        for (const frequency of [0.1, 1e6]) {
          const c = defaults();
          c.kind = kind;
          Object.assign(c.circuits[kind], {
            r1: resistance,
            r2: resistance,
            c1: capacitance,
            c2: capacitance,
            loaded: true,
            load: 100,
          });
          Object.assign(c.examples[kind], {
            frequency,
            amplitude: 5,
            strength: 200,
            window: 'overview',
          });
          c.examples[kind].interferenceFrequencies.fill(
            frequency === 0.1 ? 1e6 : 0.1,
          );
          const result = simulate(c);
          assert(
            result.samples.every(
              (sample) =>
                Number.isFinite(sample.output) &&
                Number.isFinite(sample.input) &&
                Number.isFinite(sample.desired),
            ),
          );
          assert(
            result.tones.every(
              (tone) =>
                Number.isFinite(tone.response.db) &&
                Number.isFinite(tone.response.phase) &&
                Number.isFinite(tone.outputAmplitude),
            ),
          );
          assert(
            result.sweep.every(
              (point) =>
                Number.isFinite(point.db) && Number.isFinite(point.phase),
            ),
          );
        }
});

test('custom waveforms and separate step response retain existing calculations', () => {
  for (const kind of CONFIGURATIONS)
    for (const waveform of ['sine', 'square', 'triangle'] as const) {
      const c = defaults();
      c.kind = kind;
      c.examples[kind].input = 'custom';
      Object.assign(c.source, {
        waveform,
        frequency: 730,
        amplitude: 1.3,
        offset: -0.4,
      });
      const result = simulate(c);
      assert.equal(result.isExample, false);
      assert.equal(result.exampleWindow, null);
      assert.deepEqual(result.tones, []);
      assert.equal(result.selected.frequency, 730);
      assert.equal(result.duration, 4 / 730);
      assert.equal(result.windowLimited, false);
      assert.equal(result.samples.length, 1001);
      for (const sample of result.samples) {
        assert.equal(sample.desired, undefined);
        near(sample.input, -0.4 + 1.3 * wave(waveform, sample.time * 730));
        near(sample.output, periodicAt(result.transfer, c.source, sample.time));
      }
      c.examples[kind].input = 'interference';
      c.view = 'step';
      c.stepVoltage = 2;
      const step = simulate(c);
      assert.equal(step.isExample, false);
      assert.equal(step.selected.frequency, 730);
      assert.deepEqual(step.tones, []);
      assert.equal(step.duration, 8 * step.slowTau);
      for (const sample of step.samples) {
        assert.equal(sample.desired, undefined);
        assert.equal(sample.input, 2);
        near(sample.output, stepAt(step.transfer, sample.time, 2));
      }
    }
});

test('all categories are validated without mutating or sharing example settings', () => {
  const c = defaults(),
    original = structuredClone(c),
    validated = validate(c);
  simulate(c);
  assert.deepEqual(c, original);
  assert.deepEqual(validated, original);
  validated.examples.lowpass.interferenceFrequencies[0] = 2000;
  assert.deepEqual(c, original);
  for (const kind of CONFIGURATIONS) {
    for (const patch of [
      { frequency: 0 },
      { frequency: Infinity },
      { amplitude: NaN },
      { amplitude: 6 },
      { strength: -1 },
      { strength: 201 },
      { interferenceFrequencies: [] },
      {
        interferenceFrequencies: [0, 10].slice(
          0,
          EXAMPLE_DEFAULTS[kind].interference.length,
        ),
      },
      { window: 'invalid' },
      { input: 'noise' },
    ]) {
      const invalid = defaults();
      Object.assign(invalid.examples[kind], patch);
      assert.throws(() => simulate(invalid));
    }
  }
});
