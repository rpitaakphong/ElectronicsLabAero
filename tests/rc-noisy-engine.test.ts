import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const signals = require('../vendor/opamp-lab-simulator/rc-signals.js');
const {
  solve,
  prepare,
} = require('../vendor/opamp-lab-simulator/rc-engine.js');
const board = (kind = 'highpass') => ({
  components:
    kind === 'highpass'
      ? [
          { id: 'C1', type: 'capacitor', a: 'in', b: 'out', value: 10e-6 },
          { id: 'R1', type: 'resistor', a: 'out', b: 'g', value: 33000 },
        ]
      : [
          { id: 'R1', type: 'resistor', a: 'in', b: 'out', value: 10000 },
          { id: 'C1', type: 'capacitor', a: 'out', b: 'g', value: 10e-9 },
        ],
  generatorNode: 'in',
  generator: {
    powered: true,
    output: true,
    ttl: false,
    termination: false,
    groundNode: 'g' as string | null,
    ttlNode: null as string | null,
    frequency: 1000,
  },
  probes: {
    ch1: { tip: 'in' as string | null, gnd: 'g' as string | null },
    ch2: { tip: 'out' as string | null, gnd: 'g' as string | null },
  },
});
const describe = (mode: string, extra = {}) =>
  signals.describe({ ...signals.defaults(), mode, ...extra });
const close = (actual: number, expected: number, tolerance = 1e-10) =>
  assert(
    Math.abs(actual - expected) <= tolerance,
    `${actual} differs from ${expected} by ${Math.abs(actual - expected)}`,
  );
const magnitude = (h: { re: number; im: number }) => Math.hypot(h.re, h.im);
const ratio = (
  a: { re: number; im: number },
  b: { re: number; im: number },
) => {
  const den = b.re * b.re + b.im * b.im;
  return {
    re: (a.re * b.re + a.im * b.im) / den,
    im: (a.im * b.re - a.re * b.im) / den,
  };
};
type Complex = { re: number; im: number };
const add = (a: Complex, b: Complex): Complex => ({
  re: a.re + b.re,
  im: a.im + b.im,
});
const multiply = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});
const parallel = (a: Complex, b: Complex): Complex =>
  ratio(multiply(a, b), add(a, b));
const resistor = (value: number): Complex => ({ re: value, im: 0 });
const capacitor = (frequency: number, value: number): Complex => ({
  re: 0,
  im: -1 / (2 * Math.PI * frequency * value),
});
const compareComplex = (actual: Complex, expected: Complex) => {
  close(actual.re, expected.re);
  close(actual.im, expected.im);
  close(magnitude(actual), magnitude(expected));
  close(Math.atan2(actual.im, actual.re), Math.atan2(expected.im, expected.re));
};

test('source settings validate and generate independent, repeatable descriptors', () => {
  assert.equal(signals.describe(signals.defaults()), null);
  const settings = { ...signals.defaults(), mode: 'eeg' };
  assert.deepEqual(signals.validate(settings), settings);
  assert.notEqual(signals.validate(settings), settings);
  const first = describe('eeg');
  assert.deepEqual(first, describe('eeg'));
  assert.deepEqual(
    first.tones.map((tone: any) => tone.frequency),
    [2, 6, 10, 20, 0.12, 0.28],
  );
  assert.deepEqual(
    first.tones.slice(0, 4).map((tone: any) => tone.amplitude),
    [0.04, 0.02, 0.015, 0.008],
  );
  first.tones[0].amplitude = 99;
  assert.equal(describe('eeg').tones[0].amplitude, 0.04);
  for (const input of [
    undefined,
    null,
    [],
    {},
    { mode: 'eeg' },
    { mode: 'invalid' },
    { ...settings, enabled: 1 },
    { ...settings, noiseEnabled: 'yes' },
    { ...settings, noiseStrength: -1 },
    { ...settings, noiseStrength: 201 },
    { ...settings, noiseStrength: NaN },
  ]) {
    assert.throws(() => signals.validate(input));
  }
});

test('noise level has the specified RMS and disabling it leaves useful tones untouched', () => {
  const signal = describe('sensor');
  const noise = signal.tones.filter((tone: any) => tone.role === 'noise');
  close(
    Math.sqrt(
      noise.reduce(
        (sum: number, tone: any) => sum + tone.amplitude ** 2 / 2,
        0,
      ),
    ),
    0.25,
  );
  assert.deepEqual(
    noise.map((tone: any) => tone.frequency),
    [5000, 6500, 8000, 10000, 12000, 14500, 17000, 20000],
  );
  for (const mode of ['sensor', 'uav', 'eeg']) {
    const useful = describe(mode).tones.filter(
      (tone: any) => tone.role === 'useful',
    );
    assert.deepEqual(describe(mode, { noiseEnabled: false }).tones, useful);
    assert.deepEqual(describe(mode, { noiseStrength: 0 }).tones, useful);
    const louder = describe(mode, { noiseStrength: 200 }).tones;
    describe(mode).tones.forEach((tone: any, i: number) =>
      close(
        louder[i].amplitude,
        tone.amplitude * (tone.role === 'noise' ? 2 : 1),
      ),
    );
  }
});

test('UAV source uses stable conditioned sensor voltages and source-aware Autoset hints', () => {
  const uav = describe('uav');
  assert.deepEqual(uav, describe('uav'));
  assert.deepEqual(
    uav.tones.map((tone: any) => tone.frequency),
    [200, 2, 5],
  );
  assert.deepEqual(
    uav.tones.map((tone: any) => tone.amplitude),
    [1, 0.6, 0.3],
  );
  assert.deepEqual(
    uav.tones.map((tone: any) => tone.role),
    ['useful', 'noise', 'noise'],
  );
  assert.equal(uav.maxFrequency, 200);
  assert.equal(uav.mixed, true);
  let seed = 0x55415631;
  for (const tone of uav.tones) {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    close(tone.phase, (2 * Math.PI * seed) / 4294967296);
  }
  for (const [mode, noisyHint, cleanHint] of [
    ['uav', 0.1, 0.002],
    ['sensor', 0.002, 0.002],
    ['eeg', 1, 0.2],
  ] as const) {
    assert.equal(describe(mode).autosetTimeDiv, noisyHint);
    assert.equal(
      describe(mode, { noiseEnabled: false }).autosetTimeDiv,
      cleanHint,
    );
    assert.equal(
      describe(mode, { noiseStrength: 0 }).autosetTimeDiv,
      cleanHint,
    );
  }
  const clean = describe('uav', { noiseEnabled: false, noiseStrength: 145 });
  assert.equal(clean.mixed, false);
  assert.equal(clean.frequency, 200);
  assert.deepEqual(clean.tones, [uav.tones[0]]);
  const off = describe('uav', { enabled: false });
  assert.equal(off.enabled, false);
  assert.equal(off.mixed, false);
  assert.equal(off.maxFrequency, 0);
});

test('UAV high-pass meets the learning goals with correct loaded and terminated gain and phase', () => {
  const corner = 1 / (2 * Math.PI * 33000 * 100e-9);
  close(corner, 48.228770633907685);
  for (const load of [null, 10000]) {
    for (const termination of [false, true]) {
      const state = board();
      state.components[0].value = 100e-9;
      state.generator.termination = termination;
      if (load !== null)
        state.components.push({
          id: 'RL',
          type: 'resistor',
          a: 'out',
          b: 'g',
          value: load,
        });
      const result = solve(state, { window: 1, signal: describe('uav') });
      for (const tone of result.toneResponses) {
        const zload =
          load === null
            ? resistor(33000)
            : parallel(resistor(33000), resistor(load));
        const zdut = add(capacitor(tone.frequency, 100e-9), zload);
        const zin = termination ? parallel(resistor(50), zdut) : zdut;
        const expectedCh1 = ratio(zin, add(resistor(50), zin));
        const expectedFilter = ratio(zload, zdut);
        compareComplex(tone.channels.ch1, expectedCh1);
        compareComplex(
          tone.channels.ch2,
          multiply(expectedCh1, expectedFilter),
        );
        compareComplex(
          ratio(tone.channels.ch2, tone.channels.ch1),
          expectedFilter,
        );
        if (load === null && !termination) {
          const gain = magnitude(expectedFilter);
          close(gain, tone.frequency / Math.hypot(tone.frequency, corner));
          close(
            Math.atan2(expectedFilter.im, expectedFilter.re),
            Math.atan(corner / tone.frequency),
          );
          if (tone.frequency === 200) {
            assert(gain > 0.95);
            close(gain, 0.9721344, 1e-7);
          }
          if (tone.frequency === 2) assert(gain < 0.05);
          if (tone.frequency === 5) assert(gain < 0.15);
        }
      }
      assert.equal(result.signalMode, 'uav');
      assert.equal(result.mixed, true);
      assert.equal(result.maxFrequency, 200);
      assert(result.accuracy.samplesPerFastestPeriod >= 32);
      assert(result.traces.t.length <= 24001);
      assert.equal(result.traces.t[(result.traces.t.length - 1) / 2], 0);
    }
  }
});

test('EEG phasors preserve brain rhythms, attenuate drift, and include source resistance', () => {
  const result = solve(board(), { window: 10, signal: describe('eeg') });
  const corner = 1 / (2 * Math.PI * 33000 * 10e-6);
  for (const tone of result.toneResponses) {
    const h = ratio(tone.channels.ch2, tone.channels.ch1);
    close(magnitude(h), tone.frequency / Math.hypot(tone.frequency, corner));
    close(Math.atan2(h.im, h.re), Math.atan(corner / tone.frequency));
    const reactance = 1 / (2 * Math.PI * tone.frequency * 10e-6);
    close(magnitude(tone.channels.ch2), 33000 / Math.hypot(33050, reactance));
  }
  const gain = (id: string) => {
    const tone = result.toneResponses.find((tone: any) => tone.id === id);
    return magnitude(ratio(tone.channels.ch2, tone.channels.ch1));
  };
  close(gain('delta'), 0.9721344, 1e-7);
  close(gain('movement'), 0.2414524, 1e-7);
  close(gain('electrode'), 0.5020845, 1e-7);
  assert(gain('movement') < 0.25 && gain('electrode') < 0.51);
  assert(['theta', 'alpha', 'beta'].every((id) => gain(id) > 0.996));
  assert.equal(result.maxFrequency, 20);
  assert.equal(result.mixed, true);
  assert.equal(result.signalMode, 'eeg');
  assert(result.accuracy.samplesPerFastestPeriod >= 32);
  assert(result.traces.t.length <= 24001);
  assert.equal(result.traces.t[(result.traces.t.length - 1) / 2], 0);
});

test('sensor high-frequency noise follows the actual low-pass network', () => {
  const result = solve(board('lowpass'), {
    window: 0.02,
    signal: describe('sensor'),
  });
  for (const tone of result.toneResponses) {
    const h = ratio(tone.channels.ch2, tone.channels.ch1);
    const wrc = 2 * Math.PI * tone.frequency * 10000 * 10e-9;
    close(magnitude(h), 1 / Math.hypot(1, wrc));
    close(Math.atan2(h.im, h.re), -Math.atan(wrc));
    close(
      magnitude(tone.channels.ch2),
      1 / Math.hypot(1, 2 * Math.PI * tone.frequency * 10050 * 10e-9),
    );
  }
  const useful = result.toneResponses.find(
    (tone: any) => tone.role === 'useful',
  );
  const noise = result.toneResponses.filter(
    (tone: any) => tone.role === 'noise',
  );
  close(
    magnitude(ratio(useful.channels.ch2, useful.channels.ch1)),
    0.9921966,
    1e-7,
  );
  const noise10k = noise.find((tone: any) => tone.frequency === 10000);
  close(
    magnitude(ratio(noise10k.channels.ch2, noise10k.channels.ch1)),
    0.1571767,
    1e-7,
  );
  // Compare long-term RMS at the physical input and output, accounting for
  // the 50-ohm source and all eight noise components rather than mixed Vpp.
  const noiseRms = (channel: 'ch1' | 'ch2') =>
    Math.sqrt(
      noise.reduce(
        (sum: number, tone: any) =>
          sum + magnitude(tone.phasors[channel]) ** 2 / 2,
        0,
      ),
    );
  const usefulRms = (channel: 'ch1' | 'ch2') =>
    magnitude(useful.phasors[channel]) / Math.SQRT2;
  const inputRatio = usefulRms('ch1') / noiseRms('ch1');
  const outputRatio = usefulRms('ch2') / noiseRms('ch2');
  assert(usefulRms('ch2') / usefulRms('ch1') > 0.99);
  assert(noiseRms('ch2') / noiseRms('ch1') < 0.19);
  assert(outputRatio / inputRatio > 5.2);
  assert.equal(result.maxFrequency, 20000);
  assert(result.dt * result.maxFrequency <= 1 / 32);
  assert(result.traces.t.length <= 24001);
});

test('parallel output loading gives the expected complex low-pass response at every tone', () => {
  const state = board('lowpass');
  state.components.push({
    id: 'RL',
    type: 'resistor',
    a: 'out',
    b: 'g',
    value: 10000,
  });
  const loaded = solve(state, { window: 0.02, signal: describe('sensor') });
  for (const tone of loaded.toneResponses) {
    const outputImpedance = parallel(
      resistor(10000),
      capacitor(tone.frequency, 10e-9),
    );
    const totalImpedance = add(resistor(10050), outputImpedance);
    const expectedCh1 = ratio(
      add(resistor(10000), outputImpedance),
      totalImpedance,
    );
    const expectedCh2 = ratio(outputImpedance, totalImpedance);
    compareComplex(tone.channels.ch1, expectedCh1);
    compareComplex(tone.channels.ch2, expectedCh2);
    compareComplex(
      ratio(tone.channels.ch2, tone.channels.ch1),
      ratio(expectedCh2, expectedCh1),
    );
  }
});

test('unbuffered cascade gain and phase match independent impedance dividers with optional load', () => {
  for (const mode of ['sensor', 'uav']) {
    for (const load of [null, 4700]) {
      const state = board('lowpass');
      const r1 = 12000,
        r2 = 6800,
        c1 = 220e-9,
        c2 = 12e-9;
      state.components = [
        { id: 'C1', type: 'capacitor', a: 'in', b: 'mid', value: c1 },
        { id: 'R1', type: 'resistor', a: 'mid', b: 'g', value: r1 },
        { id: 'R2', type: 'resistor', a: 'mid', b: 'out', value: r2 },
        { id: 'C2', type: 'capacitor', a: 'out', b: 'g', value: c2 },
      ];
      if (load !== null)
        state.components.push({
          id: 'RL',
          type: 'resistor',
          a: 'out',
          b: 'g',
          value: load,
        });
      const result = solve(state, {
        window: mode === 'uav' ? 1 : 0.02,
        signal: describe(mode),
      });
      assert.equal(result.toneResponses.length, mode === 'uav' ? 3 : 9);
      for (const tone of result.toneResponses) {
        // Reduce the ladder from its output using only series/parallel complex
        // impedances; this is independent of the runtime's MNA matrix solve.
        const zc2 = capacitor(tone.frequency, c2);
        const zout = load === null ? zc2 : parallel(zc2, resistor(load));
        const secondStage = add(resistor(r2), zout);
        const zmid = parallel(resistor(r1), secondStage);
        const zdut = add(capacitor(tone.frequency, c1), zmid);
        const total = add(resistor(50), zdut);
        const expectedCh1 = ratio(zdut, total);
        const expectedCh2 = multiply(
          ratio(zmid, total),
          ratio(zout, secondStage),
        );
        const expectedFilter = multiply(
          ratio(zmid, zdut),
          ratio(zout, secondStage),
        );
        compareComplex(tone.channels.ch1, expectedCh1);
        compareComplex(tone.channels.ch2, expectedCh2);
        compareComplex(
          ratio(tone.channels.ch2, tone.channels.ch1),
          expectedFilter,
        );
        assert(magnitude(tone.channels.ch1) < 1);
      }
    }
  }
});

test('mixed waveforms follow independent analytic sine responses without period wrapping', () => {
  const state = board();
  state.generator.frequency = 10;
  const signal = describe('eeg');
  const result = solve(state, { window: 10, signal });
  for (let i = 0; i < result.traces.t.length; i += 197) {
    const time = result.traces.t[i];
    const input = signal.tones.reduce(
      (sum: number, tone: any) =>
        sum +
        tone.amplitude *
          Math.sin(2 * Math.PI * tone.frequency * time + tone.phase),
      0,
    );
    const output = signal.tones.reduce((sum: number, tone: any) => {
      const x = 1 / (2 * Math.PI * tone.frequency * 10e-6);
      const gain = 33000 / Math.hypot(33050, x);
      return (
        sum +
        tone.amplitude *
          gain *
          Math.sin(
            2 * Math.PI * tone.frequency * time +
              tone.phase +
              Math.atan(x / 33050),
          )
      );
    }, 0);
    close(result.traces.gen[i], input);
    close(result.traces.ch2[i], output);
  }
});

test('record epochs and phasors are independent of scope timebase and SFG frequency', () => {
  const state = board();
  const small = solve(state, { window: 1, signal: describe('eeg') });
  state.generator.frequency = 1e6;
  const large = solve(state, { window: 10, signal: describe('eeg') });
  assert.deepEqual(small.toneResponses, large.toneResponses);
  for (const channel of ['gen', 'ch1', 'ch2']) {
    close(
      small.traces[channel][(small.traces.t.length - 1) / 2],
      large.traces[channel][(large.traces.t.length - 1) / 2],
    );
  }
  const changed = board();
  changed.components[1].value = 3300;
  const filtered = solve(changed, { window: 1, signal: describe('eeg') });
  assert.deepEqual(filtered.traces.gen, small.traces.gen);
  assert.notDeepEqual(filtered.traces.ch2, small.traces.ch2);
});

test('microvolt-scale signals retain exactly the same normalized response', () => {
  const amplified = describe('eeg');
  const raw = {
    ...amplified,
    tones: amplified.tones.map((tone: any) => ({
      ...tone,
      amplitude: tone.amplitude / 1000,
    })),
  };
  const a = solve(board(), { window: 1, signal: amplified });
  const b = solve(board(), { window: 1, signal: raw });
  for (const channel of ['gen', 'ch1', 'ch2']) {
    for (let i = 0; i < a.traces.t.length; i += 131)
      close(a.traces[channel][i], b.traces[channel][i] * 1000);
  }
});

test('synthetic enable is independent of SFG switches and never injects TTL', () => {
  const state = board();
  state.generator.powered = false;
  state.generator.output = false;
  state.generator.ttl = true;
  state.generator.ttlNode = 'g';
  const signal = describe('eeg');
  assert.equal(prepare(state, signal).sources.length, 1);
  const enabled = solve(state, { window: 1, signal });
  assert(enabled.traces.ch2.some((v: number) => Math.abs(v) > 0.001));
  assert(
    !enabled.warnings.some((warning: string) =>
      warning.includes('output is off'),
    ),
  );
  const disabled = solve(state, {
    window: 1,
    signal: { ...signal, enabled: false },
  });
  assert(disabled.traces.ch1.every((value: number) => value === 0));
  assert(disabled.traces.ch2.every((value: number) => value === 0));
  assert.equal(disabled.maxFrequency, 0);
  assert.equal(disabled.mixed, false);
  state.generator.groundNode = null;
  assert.equal(prepare(state, signal).sources.length, 0);
  assert(
    solve(state, { window: 1, signal }).traces.ch2.every(
      (value: number) => value === 0,
    ),
  );
});

test('synthetic response respects termination, disconnected probes, and common grounds', () => {
  const state = board();
  const signal = describe('eeg');
  const normal = solve(state, { window: 1, signal });
  state.generator.termination = true;
  const terminated = solve(state, { window: 1, signal });
  for (let i = 0; i < normal.toneResponses.length; i++) {
    assert(
      magnitude(terminated.toneResponses[i].channels.ch1) <
        magnitude(normal.toneResponses[i].channels.ch1),
    );
    const ratioA = ratio(
      normal.toneResponses[i].channels.ch2,
      normal.toneResponses[i].channels.ch1,
    );
    const ratioB = ratio(
      terminated.toneResponses[i].channels.ch2,
      terminated.toneResponses[i].channels.ch1,
    );
    close(ratioA.re, ratioB.re);
    close(ratioA.im, ratioB.im);
  }
  state.probes.ch2.tip = null;
  const missing = solve(state, { window: 1, signal });
  assert.match(missing.channelStatus.ch2, /disconnected/);
  assert(missing.traces.ch2.every((value: number) => value === 0));
  state.probes.ch2.tip = 'out';
  state.probes.ch2.gnd = 'out';
  const grounded = solve(state, { window: 1, signal });
  assert(
    grounded.warnings.some((warning: string) => warning.includes('common')),
  );
  assert(grounded.traces.ch2.every((value: number) => value === 0));
  state.probes.ch1.gnd = 'in';
  const shorted = solve(state, { window: 1, signal });
  assert(shorted.traces.ch1.every((value: number) => value === 0));
});

test('unsupported timebases and malformed tones fail explicitly instead of aliasing', () => {
  assert.throws(
    () => solve(board('lowpass'), { window: 0.05, signal: describe('sensor') }),
    /Reduce TIME\/DIV/,
  );
  assert.throws(
    () => solve(board(), { window: 100, signal: describe('eeg') }),
    /24,000/,
  );
  assert.throws(
    () => solve(board(), { window: 0, signal: describe('eeg') }),
    /positive/,
  );
  assert.throws(
    () =>
      solve(board(), {
        signal: {
          ...describe('eeg'),
          tones: [{ frequency: 0, amplitude: 1, phase: 0 }],
        },
      }),
    /invalid frequency components/,
  );
  assert.equal(
    solve(board('lowpass'), {
      window: 0.1,
      signal: describe('sensor', { noiseEnabled: false }),
    }).maxFrequency,
    200,
  );
});
