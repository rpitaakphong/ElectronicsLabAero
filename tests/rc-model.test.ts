import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaults,
  transfer,
  response,
  simulate,
  stepAt,
  periodicAt,
  validate,
  CONFIGURATIONS,
} from '../lib/rc/simulator';
const near = (a: number, b: number, tol = 1e-9) =>
  assert(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
test('RC cutoff and phase agree with independent first-order equations', () => {
  const c = defaults();
  for (const kind of ['lowpass', 'highpass'] as const) {
    const h = transfer(kind, c.circuits[kind]),
      p = response(h, 1 / (2 * Math.PI * 10000 * 10e-9));
    near(p.gain, Math.SQRT1_2);
    near(p.phase, kind === 'lowpass' ? -45 : 45);
    near(h.a, 100e-6);
    near(stepAt(h, h.a), kind === 'lowpass' ? 1 - Math.exp(-1) : Math.exp(-1));
  }
});
test('loaded low-pass changes both gain and time constant', () => {
  const c = defaults();
  c.circuits.lowpass.loaded = true;
  const r = simulate(c);
  near(r.peakGain, 0.5);
  near(r.cutoffs[0], 3183.098861837907);
  near(r.slowTau, 50e-6);
  near(stepAt(r.transfer, 100 * r.slowTau), 0.5);
});
test('unbuffered band-pass includes interstage loading', () => {
  const c = defaults();
  c.kind = 'bandpass';
  const r = simulate(c);
  near(r.peakFrequency!, 503.2921210448704);
  near(r.peakGain, 5 / 6);
  for (const f of r.cutoffs)
    near(response(r.transfer, f).gain, r.peakGain / Math.sqrt(2));
  near(stepAt(r.transfer, 100 * r.slowTau), 0);
  near(response(r.transfer, 0).gain, 0);
  assert(response(r.transfer, 1e10).gain < 1e-6);
  c.circuits.bandpass.loaded = true;
  assert(simulate(c).peakGain < r.peakGain);
});
test('square and triangle periodic responses repeat without startup transients', () => {
  const c = defaults();
  for (const kind of CONFIGURATIONS)
    for (const waveform of ['sine', 'square', 'triangle'] as const) {
      const h = transfer(kind, c.circuits[kind]);
      c.source.waveform = waveform;
      for (const fraction of [0.1, 0.23, 0.6, 0.9])
        near(
          periodicAt(h, c.source, fraction / 1000),
          periodicAt(h, c.source, (fraction + 4) / 1000),
          1e-10,
        );
    }
});
test('DC offset passes low-pass and is rejected by high-pass and band-pass', () => {
  const c = defaults();
  c.source.amplitude = 0;
  c.source.offset = 3;
  for (const kind of CONFIGURATIONS)
    near(
      periodicAt(transfer(kind, c.circuits[kind]), c.source, 0),
      kind === 'lowpass' ? 3 : 0,
    );
});
test('waveforms satisfy the first-order differential equation', () => {
  const c = defaults(),
    h = transfer('lowpass', c.circuits.lowpass);
  for (const waveform of ['square', 'triangle'] as const) {
    c.source.waveform = waveform;
    const t = 0.00013,
      dt = 1e-9,
      y = periodicAt(h, c.source, t),
      derivative =
        (periodicAt(h, c.source, t + dt) - periodicAt(h, c.source, t - dt)) /
        (2 * dt);
    near(h.a * derivative + y, waveform === 'square' ? 1 : 0.52, 1e-6);
  }
});
test('extreme components and frequency produce finite learning results', () => {
  for (const kind of CONFIGURATIONS)
    for (const resistance of [100, 1e6])
      for (const capacitance of [1e-10, 1e-5])
        for (const frequency of [0.1, 1e6])
          for (const waveform of ['sine', 'square', 'triangle'] as const) {
            const c = defaults();
            c.kind = kind;
            c.examples[kind].input = 'custom';
            Object.assign(c.circuits[kind], {
              r1: resistance,
              r2: resistance,
              c1: capacitance,
              c2: capacitance,
              loaded: true,
            });
            Object.assign(c.source, { frequency, waveform });
            const r = simulate(c);
            assert(r.samples.every((s) => Number.isFinite(s.output)));
            assert(
              r.sweep.every(
                (p) => Number.isFinite(p.db) && Number.isFinite(p.phase),
              ),
            );
          }
});
test('RC parameters are validated before simulation', () => {
  const c = defaults();
  c.circuits.highpass.c1 = 0;
  assert.throws(() => validate(c));
  c.circuits.highpass.c1 = 1e-8;
  c.source.frequency = NaN;
  assert.throws(() => simulate(c));
});
