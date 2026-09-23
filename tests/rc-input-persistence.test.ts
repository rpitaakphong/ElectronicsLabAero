import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise the browser profile's validation boundary without a DOM or a circuit
// solver. Layout and scope validation are separate existing boundaries.
const context = vm.createContext({ structuredClone });
for (const name of ['rc-signals.js', 'rc.js']) {
  vm.runInContext(
    readFileSync(
      new URL(`../vendor/opamp-lab-simulator/${name}`, import.meta.url),
      'utf8',
    ),
    context,
    { filename: name },
  );
}
const profile = context.RcProfile;
const defaultInput = () => ({
  mode: 'generator',
  enabled: true,
  noiseEnabled: true,
  noiseStrength: 100,
});
const savedLab = () => ({
  lab: 'rc-filter',
  version: 2,
  state: {
    components: [],
    generatorNode: null,
    generator: {
      waveform: 'sine',
      frequency: 1000,
      amplitude: 1,
      offset: 0,
      duty: 50,
      powered: true,
      output: false,
      ttl: false,
      attenuated: false,
      dutyEnabled: false,
      offsetEnabled: false,
      termination: false,
      groundNode: null,
      ttlNode: null,
    },
    probes: {
      ch1: { tip: null, gnd: null },
      ch2: { tip: null, gnd: null },
    },
    leadHoles: {},
    rcInput: defaultInput(),
  },
  scope: {
    timebase: 0.001,
    running: false,
    singleArmed: true,
    frozenRecord: { stale: true },
    frozenFrame: { stale: true },
  },
});
const validate = (value: unknown) =>
  structuredClone(
    profile.validate(
      value,
      (board: unknown) => ({ board: structuredClone(board), relocated: 0 }),
      (scope: unknown) => assert.ok(scope && typeof scope === 'object'),
    ),
  );

test('RC version-2 recall preserves synthetic settings and generator state', () => {
  for (const mode of ['generator', 'uav', 'eeg', 'sensor']) {
    for (const noiseStrength of [0, 100, 200]) {
      const saved = savedLab();
      saved.state.rcInput = {
        mode,
        enabled: false,
        noiseEnabled: false,
        noiseStrength,
      };
      saved.state.generator.waveform = 'triangle';
      saved.state.generator.frequency = 12345;
      const before = structuredClone(saved);
      const result = validate(saved).envelope;
      assert.equal(result.lab, 'rc-filter');
      assert.equal(result.version, 2);
      assert.deepEqual(result.state.rcInput, saved.state.rcInput);
      assert.deepEqual(result.state.generator, saved.state.generator);
      assert.deepEqual(
        saved,
        before,
        'recall must not mutate the stored input',
      );
      assert.equal(result.scope.timebase, saved.scope.timebase);
      assert.equal(result.scope.running, true);
      assert.equal(result.scope.singleArmed, false);
      assert.equal(result.scope.frozenRecord, null);
      assert.equal(result.scope.frozenFrame, null);
      result.state.rcInput.noiseStrength = 42;
      assert.equal(saved.state.rcInput.noiseStrength, noiseStrength);
    }
  }
});

test('UAV instructor preset has a series capacitor and shared grounded shunt resistor', () => {
  const layout = structuredClone(profile.layout('uav-highpass'));
  assert.deepEqual(layout.parts, [
    ['capacitor', 'A:6', 'A:14', 100e-9],
    ['resistor', 'B:14', 'GND_TOP:14', 33000],
  ]);
  assert.deepEqual(layout.leads, {
    generator: 'C:6',
    gengnd: 'GND_TOP:5',
    ch1tip: 'B:6',
    ch1gnd: 'GND_TOP:6',
    ch2tip: 'C:14',
    ch2gnd: 'GND_TOP:7',
  });
});

test('RC version-1 recall normalizes to ordinary generator mode and version 2', () => {
  const saved = savedLab();
  saved.version = 1;
  Reflect.deleteProperty(saved.state, 'rcInput');
  const before = structuredClone(saved);
  const result = validate(saved).envelope;
  assert.equal(result.version, 2);
  assert.deepEqual(result.state.rcInput, defaultInput());
  assert.deepEqual(result.state.generator, saved.state.generator);
  assert.deepEqual(saved, before);
});

test('RC version-1 saves cannot opt into synthetic sources through an extra field', () => {
  const saved = savedLab();
  saved.version = 1;
  saved.state.rcInput = {
    mode: 'eeg',
    enabled: false,
    noiseEnabled: false,
    noiseStrength: 200,
  };
  assert.deepEqual(validate(saved).envelope.state.rcInput, defaultInput());
});

test('RC version-2 recall rejects invalid source settings before applying layout', () => {
  const invalidSettings: unknown[] = [
    undefined,
    null,
    [],
    {},
    { ...defaultInput(), mode: 'unknown' },
    { ...defaultInput(), mode: null },
    { ...defaultInput(), enabled: 1 },
    { ...defaultInput(), noiseEnabled: 'false' },
    { ...defaultInput(), noiseStrength: -1 },
    { ...defaultInput(), noiseStrength: 201 },
    { ...defaultInput(), noiseStrength: '100' },
    { ...defaultInput(), noiseStrength: NaN },
    { ...defaultInput(), noiseStrength: Infinity },
  ];
  for (const invalid of invalidSettings) {
    const saved = savedLab();
    Reflect.set(saved.state, 'rcInput', invalid);
    const before = structuredClone(saved);
    let layoutCalls = 0;
    assert.throws(() =>
      profile.validate(
        saved,
        (board: unknown) => {
          layoutCalls++;
          return { board };
        },
        () => {},
      ),
    );
    assert.equal(layoutCalls, 0);
    assert.deepEqual(saved, before);
  }
});

test('RC recall rejects unsupported versions and profiles', () => {
  for (const version of [0, 3, '2', null]) {
    assert.throws(() => validate({ ...savedLab(), version }));
  }
  assert.throws(() => validate({ ...savedLab(), lab: 'voltage-divider' }));
});
