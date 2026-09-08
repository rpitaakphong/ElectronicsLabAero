import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaults,
  simulate,
  sweep,
  sweepAxis,
  validate,
  CONFIGURATIONS,
} from '../lib/divider/simulator';
function near(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
}
test('basic divider ratios, current, and scaling', () => {
  const c = defaults(),
    r = simulate(c);
  near(r.output, 2.5);
  near(r.sourceCurrent, 0.00025);
  near(simulate({ ...c, r2: 20000 }).output, 10 / 3);
  const scaled = simulate({ ...c, r1: 100000, r2: 100000 });
  near(scaled.output, r.output);
  near(scaled.sourceCurrent, r.sourceCurrent / 10);
});
test('loaded divider uses parallel resistance and conserves current and power', () => {
  const c = { ...defaults(), configuration: 'loaded' as const },
    r = simulate(c);
  near(r.effectiveLower, 5000);
  near(r.output, 5 / 3);
  near(r.loadingError!, 100 / 3);
  near(r.sourceCurrent, r.lowerCurrent + r.loadCurrent);
  near(c.vin * r.sourceCurrent, r.upperPower + r.lowerPower + r.loadPower);
  assert.ok(simulate({ ...c, load: 1e6 }).output > r.output);
});
test('potentiometer endpoint and midpoint behavior with and without loading', () => {
  for (const potLoaded of [false, true])
    for (const position of [0, 0.5, 1]) {
      const c = {
          ...defaults(),
          configuration: 'potentiometer' as const,
          position,
          potLoaded,
        },
        r = simulate(c);
      near(
        r.output,
        position === 0 ? 0 : position === 1 ? 5 : potLoaded ? 2 : 2.5,
      );
      near(c.vin * r.sourceCurrent, r.upperPower + r.lowerPower + r.loadPower);
      assert.ok(
        Object.values(r).every(
          (v) => typeof v !== 'number' || Number.isFinite(v),
        ),
      );
    }
});
test('sensor reversal produces complementary output voltages', () => {
  const c = { ...defaults(), configuration: 'sensor' as const, sensor: 100000 };
  const lower = simulate(c),
    upper = simulate({ ...c, sensorPosition: 'upper' });
  near(lower.output, 50 / 11);
  near(upper.output + lower.output, c.vin);
});
test('all configurations remain finite at limits and zero input', () => {
  for (const configuration of CONFIGURATIONS)
    for (const vin of [0, 24])
      for (const resistance of [100, 1e6]) {
        const r = simulate({
          ...defaults(),
          configuration,
          vin,
          r1: resistance,
          r2: resistance,
          load: resistance,
          sensor: resistance,
          fixed: resistance,
          pot: resistance,
          potLoaded: true,
        });
        assert.ok(
          Object.values(r).every(
            (v) => typeof v !== 'number' || Number.isFinite(v),
          ),
        );
        if (vin === 0) {
          near(r.output, 0);
          assert.equal(r.loadingError, null);
        }
      }
});
test('sweeps include the operating point and agree with direct calculation', () => {
  for (const configuration of CONFIGURATIONS) {
    const c = {
      ...defaults(),
      configuration,
      r2: 12345,
      load: 6789,
      position: 0.37,
      sensor: 45678,
      potLoaded: true,
    };
    const axis = sweepAxis(c),
      samples = sweep(c),
      current = samples.find((p) => p.x === axis.current)!;
    near(current.output, simulate(c).output);
    for (const p of samples)
      near(p.output, simulate({ ...c, [axis.key]: p.x }).output);
  }
});
test('rejects invalid configuration and nonfinite or out-of-range parameters', () => {
  for (const patch of [
    { vin: -1 },
    { vin: 25 },
    { r1: 0 },
    { load: Infinity },
    { sensor: NaN },
    { position: 1.1 },
  ])
    assert.throws(() => validate({ ...defaults(), ...patch }));
});
