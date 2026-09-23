import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import {
  CONFIGURATIONS,
  EXAMPLE_DEFAULTS,
  UAV_PHASES,
  toneSpectrum,
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
    highpass: [0.9721344, 0.0414334, 0.1031199],
    bandpass: [0.8333283, 0.124451, 0.1567123],
  };
  for (const kind of CONFIGURATIONS) {
    c.kind = kind;
    const result = simulate(c);
    assert.equal(result.isExample, true);
    assert.equal(
      result.exampleWindow,
      kind === 'highpass' ? 'overview' : 'detail',
    );
    assert.equal(result.isUav, kind === 'highpass');
    assert.equal(result.selected.frequency, EXAMPLE_DEFAULTS[kind].frequency);
    assert.equal(result.tones[0].role, 'useful');
    assert.equal(
      result.tones[0].label,
      kind === 'highpass' ? 'Motor vibration' : 'Useful signal',
    );
    assert.equal(result.tones[0].amplitude, 1);
    assert.equal(result.tones.length, expected[kind].length);
    result.tones.forEach((tone, i) => {
      near(tone.response.gain, expected[kind][i], 1e-7);
      near(tone.outputAmplitude, tone.amplitude * tone.response.gain);
    });
    if (kind !== 'highpass') {
      assert.equal(result.samples[0].input, 0);
      assert.equal(result.samples[0].desired, 0);
    }
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
          const phase = 2 * Math.PI * tone.frequency * sample.time + tone.phase,
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
          result.tones
            .filter((tone) => tone.role === 'useful')
            .reduce(
              (sum, tone) =>
                sum +
                tone.amplitude *
                  Math.sin(
                    2 * Math.PI * tone.frequency * sample.time + tone.phase,
                  ),
              0,
            ),
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
      const expected = mixed.tones
        .filter((tone) => tone.role === 'interference')
        .reduce((sum, tone) => {
          const [re, im] = impedanceResponse(
              kind,
              c.circuits[kind],
              tone.frequency,
            ),
            phase = 2 * Math.PI * tone.frequency * sample.time + tone.phase;
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
  for (const kind of ['lowpass', 'bandpass'] as const) {
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
    highpass: [0.02, 1],
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
      assert.equal(result.isUav, false);
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
      assert.equal(step.isUav, false);
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

test('UAV default circuit meets the vibration retention and movement rejection objectives', () => {
  const c = defaults();
  c.kind = 'highpass';
  const result = simulate(c);
  near(result.cutoffs[0], 48.22877063390768);
  near(result.slowTau, 0.0033);
  assert.equal(result.selected.frequency, 200);
  assert.deepEqual(
    result.tones.map((tone) => tone.marker),
    ['V', 'M1', 'M2'],
  );
  assert(result.tones[0].response.gain >= 0.95);
  assert(result.tones[1].response.gain < 0.05);
  assert(result.tones[2].response.gain < 0.15);
  // Raising cutoff to 482 Hz demonstrates the cost of stronger movement rejection.
  c.circuits.highpass.r1 = 3300;
  const raised = simulate(c);
  assert(raised.tones[0].response.gain < 0.4);
  assert(raised.tones[1].response.gain < result.tones[1].response.gain);
});

test('UAV fixed phases and actual voltages match the breadboard source', () => {
  const context: {
    RcSignals?: {
      describe(input: unknown): {
        tones: { frequency: number; amplitude: number; phase: number }[];
      };
    };
  } = {};
  runInNewContext(
    readFileSync(
      new URL('../vendor/opamp-lab-simulator/rc-signals.js', import.meta.url),
      'utf8',
    ),
    context,
  );
  const c = defaults();
  c.kind = 'highpass';
  for (const strength of [0, 50, 100, 200]) {
    c.examples.highpass.strength = strength;
    const result = simulate(c);
    const source = context.RcSignals!.describe({
      mode: 'uav',
      enabled: true,
      noiseEnabled: true,
      noiseStrength: strength,
    });
    assert.deepEqual(
      result.tones.map(({ frequency, amplitude, phase }) => ({
        frequency,
        amplitude,
        phase,
      })),
      Array.from(source.tones, ({ frequency, amplitude, phase }) => ({
        frequency,
        amplitude,
        phase,
      })),
    );
    for (const sample of result.samples.filter((_, i) => i % 17 === 0)) {
      const expectedInput = source.tones.reduce(
        (sum, tone) =>
          sum +
          tone.amplitude *
            Math.sin(2 * Math.PI * tone.frequency * sample.time + tone.phase),
        0,
      );
      near(sample.input, expectedInput, 1e-12);
    }
    c.circuits.highpass.r1 = 44000;
    assert.deepEqual(
      simulate(c).tones.map((tone) => tone.phase),
      result.tones.map((tone) => tone.phase),
    );
    c.examples.highpass.window = 'detail';
    assert.deepEqual(
      simulate(c).tones.map((tone) => tone.phase),
      result.tones.map((tone) => tone.phase),
    );
  }
  c.examples.highpass.input = 'clean';
  const clean = simulate(c);
  assert.equal(clean.tones.length, 1);
  near(clean.samples[0].input, Math.sin(UAV_PHASES[0]));
  c.examples.highpass.frequency = 350;
  c.examples.highpass.amplitude = 2;
  const edited = simulate(c);
  assert.equal(edited.selected.frequency, 350);
  near(edited.samples[0].input, 2 * Math.sin(UAV_PHASES[0]));
});

test('coincident UAV components combine their phases and cannot be separated by the filter', () => {
  const c = defaults();
  c.kind = 'highpass';
  c.examples.highpass.interferenceFrequencies = [200, 200];
  const result = simulate(c),
    spectrum = toneSpectrum(result.tones),
    re = result.tones.reduce(
      (sum, tone) => sum + tone.amplitude * Math.cos(tone.phase),
      0,
    ),
    im = result.tones.reduce(
      (sum, tone) => sum + tone.amplitude * Math.sin(tone.phase),
      0,
    );
  assert.equal(spectrum.length, 1);
  near(spectrum[0].input, Math.hypot(re, im));
  near(spectrum[0].output, spectrum[0].input * result.selected.gain);
  assert(spectrum[0].input < 1.9);
  for (const tone of result.tones) {
    near(tone.response.gain, result.selected.gain);
    near(tone.response.phase, result.selected.phase);
  }
  for (const sample of result.samples) {
    const phase = 2 * Math.PI * 200 * sample.time;
    near(sample.input, re * Math.sin(phase) + im * Math.cos(phase));
  }
  const tone = result.tones[0];
  const cancelled = toneSpectrum([
    tone,
    { ...tone, phase: tone.phase + Math.PI },
  ]);
  near(cancelled[0].input, 0);
  near(cancelled[0].output, 0);
});

test('UAV observation windows resolve motor vibration and two movement periods', () => {
  const c = defaults();
  c.kind = 'highpass';
  const overview = simulate(c);
  near(overview.requestedDuration, 1);
  assert.equal(overview.windowLimited, false);
  assert(overview.samples[1].time <= 1 / (200 * 32));
  c.examples.highpass.window = 'detail';
  near(simulate(c).duration, 0.02);
  c.examples.highpass.window = 'overview';
  c.examples.highpass.interferenceFrequencies[0] = 0.1;
  const long = simulate(c);
  assert.equal(long.requestedDuration, 20);
  assert.equal(long.windowLimited, true);
  assert.equal(long.samples.length, 32769);
  near(long.duration, 5.12);
  near(long.samples[1].time, 1 / (200 * 32));
  c.examples.highpass.strength = 0;
  near(simulate(c).duration, 0.02);
});
