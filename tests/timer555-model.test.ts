import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  timer555 as E,
  defaults,
  createSession,
  validate,
} from '../lib/timer555/simulator';
const near = (actual: number, expected: number, tolerance = 0.01) =>
  assert.ok(
    Math.abs(actual - expected) / expected < tolerance,
    `${actual} versus ${expected}`,
  );
test('555 control pin changes both comparator thresholds and actual oscillator timing', () => {
  const config = defaults(),
    board = E.canonical(config);
  board.components.push({
    id: 'Rcontrol',
    type: 'resistor',
    a: 'CONT',
    b: 'GND',
    value: 10000,
  });
  const s = E.create(board);
  s.advance(0.15);
  const expected =
    (Math.log(1.5) * (config.r1 + config.r2) + Math.LN2 * config.r2) * config.c;
  near(s.period!, expected);
  near(s.values[s.net.pins[5]], 2.5, 0.001);
});
test('555 output loading follows its drive resistance without changing the RC oscillator', () => {
  const board = E.canonical(defaults());
  board.components.push({
    id: 'Rload',
    type: 'resistor',
    a: 'OUT',
    b: 'GND',
    value: 1000,
  });
  const s = E.create(board);
  s.advance(0.15);
  const record = s.record(0.1, 0.15, 1000);
  near(Math.max(...record.traces.ch1), (3.8 * 1000) / 1050, 0.001);
  near(s.period!, Math.LN2 * 21000 * 1e-6);
});
test('555 external generator trigger uses the wired source and preserves one-shot duration', () => {
  const board = E.canonical(defaults('monostable'));
  Object.assign(board.generator, {
    powered: true,
    output: true,
    groundNode: 'GND',
    frequency: 0.5,
  });
  board.generatorNode = 'TRIG';
  const s = E.create(board, {
    sourceAt: (t) => (t % 2 >= 0.25 && t % 2 < 0.75 ? 0 : 5),
  });
  s.advance(1.8);
  const e = s.events.filter((e) => e.type === 'output');
  near(e[0].time, 0.25, 0.001);
  near(e[1].time - e[0].time, Math.log(3), 0.005);
});
test('555 incorrect timing wiring produces no imaginary preset waveform', () => {
  const board = E.canonical(defaults());
  board.components.find((c) => c.id === 'R2')!.b = 'OUT';
  const s = E.create(board);
  s.advance(0.2);
  assert.equal(s.period, null);
  assert.equal(
    s.events.filter((e) => e.type === 'output' && !e.high).length,
    0,
  );
});
test('555 astable netlist timing agrees with independent ln(2) equations across lab ranges', () => {
  for (const [r1, r2, c, vcc] of [
    [1000, 10000, 1e-6, 5],
    [1000, 47000, 10e-6, 9],
    [100000, 100000, 1e-9, 15],
    [1e6, 1e6, 100e-6, 5],
  ]) {
    const config = { ...defaults(), r1, r2, c, vcc },
      period = Math.LN2 * (r1 + 2 * r2) * c,
      s = createSession(config);
    s.advance(period * 7);
    assert.ok(s.period);
    near(s.period!, period);
    const e = s.events.filter((e) => e.type === 'output'),
      lastRise = e.findLastIndex((e) => e.high),
      fall = e[lastRise - 1],
      rise = e[lastRise - 2];
    near(fall.time - rise.time, Math.LN2 * (r1 + r2) * c);
    near(e[lastRise].time - fall.time, Math.LN2 * r2 * c);
    assert.ok(s.steps < 10000, 'autonomous periods should be cached');
  }
});
test('555 monostable pulse is ln(3)RC and does not run without a wired trigger', () => {
  const s = createSession(defaults('monostable'));
  s.advance(0.1);
  assert.equal(s.high, false);
  s.setButton('S1', true);
  s.scheduleButton('S1', false, 0.11);
  s.advance(1.5);
  const events = s.events.filter((e) => e.type === 'output');
  near(events[1].time - events[0].time, Math.log(3), 0.005);
  assert.equal(s.high, false);
});
test('555 held trigger holds output high, and release ends an elapsed one-shot', () => {
  const s = createSession(defaults('monostable'));
  s.advance(0.1);
  s.setButton('S1', true);
  s.advance(2);
  assert.equal(s.high, true);
  s.setButton('S1', false);
  assert.equal(s.high, false);
});
test('555 reset overrides trigger and discharges timing capacitor', () => {
  const s = createSession(defaults('monostable'));
  s.advance(0.01);
  s.setButton('S1', true);
  s.advance(0.3);
  s.setButton('Sreset', true);
  assert.equal(s.high, false);
  s.advance(0.4);
  assert.ok(s.values[s.net.pins[6]] < 0.01);
});
test('555 repeated trigger during a pulse does not restart the timing capacitor', () => {
  const s = createSession(defaults('monostable'));
  s.setButton('S1', true);
  s.scheduleButton('S1', false, 0.01);
  s.scheduleButton('S1', true, 0.5);
  s.scheduleButton('S1', false, 0.51);
  s.advance(1.5);
  const falls = s.events.filter((e) => e.type === 'output' && !e.high);
  near(falls[0].time, Math.log(3), 0.005);
});
test('555 acquired records and scope window changes do not advance or reset its clock', () => {
  const s = createSession(defaults());
  s.advance(0.2);
  const snapshot = { time: s.time, values: s.values, events: s.events };
  s.record(0.1, 0.2, 400);
  s.record(0.18, 0.2, 1200);
  assert.deepEqual(
    { time: s.time, values: s.values, events: s.events },
    snapshot,
  );
});
test('555 predictions reject invalid values and setting validation rejects non-finite input', () => {
  for (const patch of [{ vcc: NaN }, { c: 0 }, { r1: Infinity }, { vcc: 16 }])
    assert.throws(() => validate({ ...defaults(), ...patch }));
  assert.throws(() => E.predictions({ ...defaults(), c: -1 }));
});
test('555 behavior follows electrical wiring, not component IDs or order', () => {
  const config = defaults(),
    a = E.canonical(config),
    b = structuredClone(a);
  b.components.reverse();
  b.components.forEach((c, i) => (c.id = 'X' + i));
  const x = E.create(a),
    y = E.create(b);
  x.advance(0.15);
  y.advance(0.15);
  near(x.period!, y.period!, 1e-8);
});
test('555 missing power and floating inputs produce diagnostics rather than an oscillator', () => {
  const board = E.canonical(defaults());
  board.components.find((c) => c.type === 'timer555')!.pins![8] = 'FLOAT';
  const s = E.create(board);
  s.advance(0.1);
  assert.equal(s.high, false);
  assert.ok(s.net.warnings.some((w) => w.includes('pin 8')));
});
test('555 supply shorts and unsupported multiple timers fail explicitly', () => {
  const board = E.canonical(defaults());
  board.components.push({ id: 'Wshort', type: 'wire', a: 'VPLUS', b: 'GND' });
  assert.throws(() => E.create(board), /shorted/);
  const two = E.canonical(defaults());
  two.components.push({ ...two.components[0], id: 'U2' });
  assert.throws(() => E.create(two), /one NE555/);
});
