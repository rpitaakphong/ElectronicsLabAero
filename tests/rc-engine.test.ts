import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url),
  { solve, prepare } = require('../vendor/opamp-lab-simulator/rc-engine.js');
const part = (
  type: string,
  a: string,
  b: string,
  value: number,
  id = type + Math.random(),
) => ({ id, type, a, b, value });
const board = () => ({
  components: [
    part('resistor', 'in', 'out', 10000),
    part('capacitor', 'out', 'g', 10e-9),
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
const run = (
  state: ReturnType<typeof board>,
  wave = (t: number) => Math.sin(2 * Math.PI * state.generator.frequency * t),
) =>
  solve(state, {
    sourceAt: (t: number, port: string) =>
      port === 'ttl'
        ? (t * state.generator.frequency) % 1 < 0.5
          ? 5
          : 0
        : wave(t),
  });
const peak = (r: any, ch = 'ch2') =>
  (Math.max(...r.traces[ch]) - Math.min(...r.traces[ch])) / 2;
test('wired RC includes source resistance, without changing CH2/CH1 filter gain', () => {
  const b = board(),
    r = run(b),
    w = 2 * Math.PI * 1000;
  assert(Math.abs(peak(r) - 1 / Math.hypot(1, w * 10050 * 1e-8)) < 0.003);
  assert(
    Math.abs(peak(r) / peak(r, 'ch1') - 1 / Math.hypot(1, w * 10000 * 1e-8)) <
      0.003,
  );
  assert(r.accuracy.periodSteps >= 512);
});
test('RC periodic measurements are independent of scope window', () => {
  const b = board(),
    sourceAt = (t: number) => Math.sin(2 * Math.PI * 1000 * t);
  const a = solve(b, { window: 0.002, sourceAt }),
    c = solve(b, { window: 0.008, sourceAt });
  assert(Math.abs(peak(a) - peak(c)) < 0.001);
  assert.equal(a.accuracy.periodSteps, c.accuracy.periodSteps);
});
test('parallel loads and unbuffered band-pass follow actual wiring', () => {
  const b = board();
  b.components.push(part('resistor', 'out', 'g', 10000));
  assert(
    Math.abs(
      peak(run(b)) - 0.5 / Math.hypot(1, 2 * Math.PI * 1000 * 5000 * 1e-8),
    ) < 0.006,
  );
  b.components = [
    part('capacitor', 'in', 'mid', 100e-9),
    part('resistor', 'mid', 'g', 10000),
    part('resistor', 'mid', 'out', 10000),
    part('capacitor', 'out', 'g', 10e-9),
  ];
  b.generator.frequency = 503.292121;
  const r = run(b);
  assert(Math.abs(peak(r) / peak(r, 'ch1') - 5 / 6) < 0.004);
});
test('missing and floating probes are undefined; inactive floating islands do not corrupt valid readings', () => {
  const b = board(),
    expected = peak(run(b));
  b.components.push(part('capacitor', 'float1', 'float2', 1e-9));
  assert.equal(peak(run(b)), expected);
  b.probes.ch2.tip = 'float1';
  assert.match(run(b).channelStatus.ch2, /floating/);
  b.probes.ch2.tip = null;
  assert.match(run(b).channelStatus.ch2, /disconnected/);
});
test('common grounds merge nets and MAIN shorts are finite through 50 ohms', () => {
  const b = board();
  b.probes.ch2.gnd = 'out';
  const r = run(b);
  assert.equal(peak(r), 0);
  assert(r.warnings.some((s: string) => s.includes('common')));
  b.probes.ch1.gnd = 'in';
  assert.equal(peak(run(b), 'ch1'), 0);
});
test('TTL ideal short faults clear the acquisition', () => {
  const b = board();
  b.generator.ttl = true;
  b.generator.ttlNode = 'g';
  assert.throws(() => run(b), /TTL.*shorted/);
});
test('no return and output-off do not inject an ideal generator', () => {
  const b = board();
  b.generator.groundNode = null;
  assert.equal(prepare(b).sources.length, 0);
  b.generator.groundNode = 'g';
  b.generator.output = false;
  assert.equal(prepare(b).sources.length, 0);
});
test('square and triangle acquisitions converge or explain resolution limits', () => {
  for (const shape of ['square', 'triangle']) {
    const b = board();
    const r = run(b, (t) =>
      shape === 'square'
        ? (t * 1000) % 1 < 0.5
          ? 1
          : -1
        : 4 * Math.abs(((t * 1000) % 1) - 0.5) - 1,
    );
    assert(r.accuracy.error < 0.003);
    assert(r.traces.ch2.every(Number.isFinite));
  }
});
