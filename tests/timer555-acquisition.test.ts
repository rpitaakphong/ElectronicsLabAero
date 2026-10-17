import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createSession, defaults } from '../lib/timer555/simulator';

// Exercise the actual shared scope measurements, not a second timing formula.
const app = readFileSync('vendor/opamp-lab-simulator/app.js', 'utf8');
const scopeContext = vm.createContext({});
vm.runInContext(
  `const lerp=(a,b,f)=>a+(b-a)*f;
   const scope={measure:{highLow:'Auto',midRef:50,lowRef:10,highRef:90}};
   const measureGroups={Delay:[]};` +
    app.slice(
      app.indexOf('  function crossings('),
      app.indexOf('  function currentRecord('),
    ),
  scopeContext,
);
const measure = scopeContext.measurement as (
  values: number[],
  times: number[],
  name: string,
  other?: null,
  settings?: undefined,
  timeWeighted?: boolean,
) => number;
const near = (actual: number, expected: number, tolerance = 0.01) =>
  assert.ok(
    Number.isFinite(actual) && Math.abs(actual / expected - 1) < tolerance,
    `${actual} versus ${expected}`,
  );

test('555 scope preserves narrow pulses at every acquisition phase', () => {
  const config = { ...defaults(), r1: 1e6, r2: 1000 };
  const s = createSession(config);
  s.advance(20);
  const period = s.period!;
  for (const count of [800, 2400, 6000]) {
    for (const phase of [0, 0.0003, 0.0009, 0.0015, 0.0021, 0.123, 0.75]) {
      const end = period * (20 + phase);
      const { traces } = s.record(end - period * 6, end, count);
      near(measure(traces.ch1, traces.t, 'Frequency'), 1 / period);
      near(measure(traces.ch1, traces.t, '-Width'), Math.LN2 * 1000 * config.c);
      near(
        measure(traces.ch1, traces.t, 'Duty Cycle'),
        (100 * (config.r1 + config.r2)) / (config.r1 + 2 * config.r2),
        0.0001,
      );
      assert(traces.t.every((t, i) => i === 0 || t > traces.t[i - 1]));
      assert(
        traces.t.length < count + 100,
        'edges must not require a huge record',
      );
    }
  }
});

test('555 transient records retain short one-shots and reset/trigger edges', () => {
  const s = createSession({ ...defaults('monostable'), r1: 1000, c: 1e-6 });
  s.advance(0.1);
  s.setButton('S1', true);
  s.scheduleButton('S1', false, 0.10001);
  s.advance(0.2);
  const { traces } = s.record(0, 0.2, 800);
  near(measure(traces.ch1, traces.t, '+Width'), Math.log(3) * 0.001);
  assert(Number.isNaN(measure(traces.ch1, traces.t, 'Frequency')));
});

test('scope duty uses a matching complete cycle, never an unrelated width', () => {
  const t = [0, 1, 1.01, 4, 4.01, 5, 5.01, 5.5, 5.51, 6, 6.01];
  const v = [0, 0, 5, 5, 0, 0, 5, 5, 0, 0, 5];
  const duty = measure(v, t, 'Duty Cycle');
  assert(duty >= 0 && duty <= 100, `impossible duty ${duty}`);
});

test('555 edge-aware mean and RMS are weighted by time, not number of edge points', () => {
  const s = createSession({ ...defaults(), r1: 1e6, r2: 1000 });
  s.advance(20);
  const { traces } = s.record(s.period! * 10, s.period! * 16, 800);
  const duty = 1001 / 1002;
  near(
    measure(traces.ch1, traces.t, 'Mean', null, undefined, true),
    0.1 + 3.7 * duty,
    0.0001,
  );
  near(
    measure(traces.ch1, traces.t, 'RMS', null, undefined, true),
    Math.sqrt(3.8 ** 2 * duty + 0.1 ** 2 * (1 - duty)),
    0.0001,
  );
});

test('555 scope timing agrees with independent equations across 240 lab combinations', () => {
  const resistance = [1000, 10000, 100000, 1e6];
  const capacitance = [1e-9, 100e-9, 1e-6, 100e-6];
  for (const vcc of [5, 9, 15]) {
    for (const r1 of resistance) {
      for (const c of capacitance) {
        for (const r2 of resistance) {
          const period = Math.LN2 * (r1 + 2 * r2) * c;
          const s = createSession({ mode: 'astable', r1, r2, c, vcc });
          s.advance(period * 7);
          const { traces } = s.record(period * 3, period * 7, 800);
          near(measure(traces.ch1, traces.t, 'Frequency'), 1 / period);
          near(
            measure(traces.ch1, traces.t, '+Width'),
            Math.LN2 * (r1 + r2) * c,
          );
          near(measure(traces.ch1, traces.t, '-Width'), Math.LN2 * r2 * c);
        }
        const pulse = Math.log(3) * r1 * c;
        const s = createSession({ mode: 'monostable', r1, r2: 10000, c, vcc });
        s.advance(pulse * 0.2);
        s.setButton('S1', true);
        s.scheduleButton('S1', false, pulse * 0.25);
        s.advance(pulse * 2);
        const { traces } = s.record(0, pulse * 2, 800);
        near(measure(traces.ch1, traces.t, '+Width'), pulse);
      }
    }
  }
});
