import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  defaults,
  simulate,
  type Configuration,
} from '../lib/divider/simulator';

const require = createRequire(import.meta.url);
const { solve } = require('../vendor/opamp-lab-simulator/dc-engine.js');
const resistor = (id: string, a: string, b: string, value = 10000) => ({
  id,
  type: 'resistor',
  a,
  b,
  value,
});
const board = () => ({
  components: [resistor('R1', 'in', 'out'), resistor('R2', 'out', 'return')],
  supply: { voltage: 5, enabled: true },
  leads: {
    supplyPositive: 'in',
    supplyNegative: 'return',
    meterRed: 'out',
    meterBlack: 'return',
  } as Record<string, string | null>,
  meter: { mode: 'voltage' },
});
const near = (actual: number, expected: number) =>
  assert.ok(
    Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)),
    `${actual} != ${expected}`,
  );

test('DC model matches the independent learning model across all four configurations', () => {
  for (const configuration of [
    'basic',
    'loaded',
    'potentiometer',
    'sensor',
  ] as Configuration[]) {
    for (const vin of [0, 5, 24])
      for (const resistance of [100, 10000, 1e6])
        for (const position of [0, 0.25, 0.5, 1])
          for (const sensorPosition of ['upper', 'lower'] as const) {
            const config = {
              ...defaults(),
              configuration,
              vin,
              r2: resistance,
              sensor: resistance,
              position,
              sensorPosition,
            };
            const b = board();
            b.supply.voltage = vin;
            let components: object[];
            if (configuration === 'potentiometer')
              components = [
                {
                  type: 'potentiometer',
                  id: 'P1',
                  a: 'in',
                  b: 'return',
                  w: 'out',
                  value: config.pot,
                  position,
                },
              ];
            else if (configuration === 'sensor')
              components = [
                resistor(
                  'R1',
                  'in',
                  'out',
                  sensorPosition === 'upper' ? resistance : config.fixed,
                ),
                resistor(
                  'R2',
                  'out',
                  'return',
                  sensorPosition === 'lower' ? resistance : config.fixed,
                ),
              ];
            else
              components = [
                resistor('R1', 'in', 'out', config.r1),
                resistor('R2', 'out', 'return', resistance),
              ];
            if (configuration === 'loaded')
              components.push(resistor('RL', 'out', 'return', config.load));
            const actual = solve({ ...b, components });
            assert.equal(actual.status, 'ok');
            near(actual.value, simulate(config).output);
            near(-actual.branchCurrents.supply, simulate(config).sourceCurrent);
          }
  }
});

test('loaded potentiometer and upper resistor voltage preserve floating probe behavior', () => {
  const b = board();
  const result = solve({
    ...b,
    components: [
      {
        type: 'potentiometer',
        id: 'P1',
        a: 'in',
        b: 'return',
        w: 'out',
        value: 10000,
        position: 0.5,
      },
      resistor('RL', 'out', 'return'),
    ],
  });
  near(result.value, 2);
  b.leads.meterRed = 'in';
  b.leads.meterBlack = 'out';
  near(solve(b).value, 2.5);
  b.leads.meterRed = 'out';
  b.leads.meterBlack = 'in';
  near(solve(b).value, -2.5);
});

test('ammeter inserted in series reads signed current without voltage burden', () => {
  const b = board();
  b.components[0].a = 'afterMeter';
  b.meter.mode = 'current';
  b.leads.meterRed = 'in';
  b.leads.meterBlack = 'afterMeter';
  near(solve(b).value, 0.00025);
  [b.leads.meterRed, b.leads.meterBlack] = [
    b.leads.meterBlack,
    b.leads.meterRed,
  ];
  near(solve(b).value, -0.00025);
});

test('resistance mode measures parallel paths, is polarity independent, and removes supply', () => {
  const b = board();
  b.supply.enabled = false;
  b.meter.mode = 'resistance';
  near(solve(b).value, 10000);
  b.components.push(resistor('RL', 'out', 'return'));
  near(solve(b).value, 5000);
  [b.leads.meterRed, b.leads.meterBlack] = [
    b.leads.meterBlack,
    b.leads.meterRed,
  ];
  near(solve(b).value, 5000);
  b.leads.meterRed = 'in';
  b.leads.meterBlack = 'return';
  near(solve(b).value, 15000);
  b.supply.enabled = true;
  assert.equal(solve(b).status, 'unavailable');
  assert.equal(solve(b).value, null);
  b.supply.voltage = 0;
  assert.equal(solve(b).status, 'unavailable');
});

test('separate floating islands never acquire artificial ground paths', () => {
  const b = board();
  b.components.push(resistor('RF', 'x', 'y'));
  b.leads.meterRed = 'x';
  b.leads.meterBlack = 'y';
  near(solve(b).value, 0);
  b.leads.meterBlack = 'return';
  assert.equal(solve(b).status, 'unavailable');
  b.meter.mode = 'current';
  near(solve(b).value, 0);
  b.meter.mode = 'resistance';
  b.supply.enabled = false;
  assert.equal(solve(b).status, 'open');
});

test('source shorts and same-net current have explicit nonnumeric results', () => {
  const b = board();
  b.meter.mode = 'current';
  b.leads.meterRed = 'in';
  assert.equal(solve(b).status, 'fault');
  assert.equal(solve(b).value, null);
  b.supply.voltage = 0;
  assert.equal(solve(b).status, 'unavailable');
  b.leads.meterBlack = 'in';
  assert.equal(solve(b).status, 'unavailable');
  b.meter.mode = 'voltage';
  near(solve(b).value, 0);
  b.supply.enabled = false;
  b.meter.mode = 'resistance';
  near(solve(b).value, 0);
});

test('an open supply return warns without invalidating a defined voltage', () => {
  const b = board();
  b.components[1].b = 'loose';
  const result = solve(b);
  assert.equal(result.status, 'ok');
  near(result.value, 5);
  assert.ok(
    result.warnings.some((message: string) =>
      message.includes('No closed return path'),
    ),
  );
});

test('wires and potentiometer endpoints can short the source', () => {
  const b = board();
  assert.equal(
    solve({
      ...b,
      components: [{ type: 'wire', id: 'W', a: 'in', b: 'return' }],
    }).status,
    'fault',
  );
  for (const position of [0, 1]) {
    const c = {
      type: 'potentiometer',
      id: 'P',
      a: 'in',
      b: 'return',
      w: position === 0 ? 'in' : 'return',
      position,
      value: 10000,
    };
    assert.equal(solve({ ...b, components: [c] }).status, 'fault');
  }
});

test('missing probes, missing return, output off, and mode changes do not keep stale values', () => {
  const b = board();
  near(solve(b).value, 2.5);
  b.leads.meterBlack = null;
  assert.equal(solve(b).value, null);
  b.meter.mode = 'resistance';
  b.supply.enabled = false;
  assert.equal(solve(b).status, 'open');
  b.leads.meterBlack = 'return';
  b.meter.mode = 'voltage';
  near(solve(b).value, 0);
  b.supply.enabled = true;
  b.leads.supplyNegative = null;
  near(solve(b).value, 0);
  b.leads.supplyNegative = 'return';
  near(solve(b).value, 2.5);
  b.meter.mode = 'current';
  near(solve(b).value, 0.0005);
  b.meter.mode = 'voltage';
  near(solve(b).value, 2.5);
});
