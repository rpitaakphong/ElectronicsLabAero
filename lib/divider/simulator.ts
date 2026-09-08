export const CONFIGURATIONS = [
  'basic',
  'loaded',
  'potentiometer',
  'sensor',
] as const;
export type Configuration = (typeof CONFIGURATIONS)[number];
/** Resistance in ohms, voltage in volts; position is the fraction above ground. */
export interface DividerConfig {
  configuration: Configuration;
  vin: number;
  r1: number;
  r2: number;
  load: number;
  pot: number;
  position: number;
  potLoaded: boolean;
  sensor: number;
  fixed: number;
  sensorPosition: 'upper' | 'lower';
}
export const defaults = (): DividerConfig => ({
  configuration: 'basic',
  vin: 5,
  r1: 10000,
  r2: 10000,
  load: 10000,
  pot: 10000,
  position: 0.5,
  potLoaded: false,
  sensor: 10000,
  fixed: 10000,
  sensorPosition: 'lower',
});
export function validate(c: DividerConfig): DividerConfig {
  if (
    !CONFIGURATIONS.includes(c.configuration) ||
    !['upper', 'lower'].includes(c.sensorPosition) ||
    typeof c.potLoaded !== 'boolean'
  )
    throw new Error('Choose a valid configuration.');
  for (const key of [
    'vin',
    'r1',
    'r2',
    'load',
    'pot',
    'position',
    'sensor',
    'fixed',
  ] as const) {
    const [min, max] =
      key === 'vin' ? [0, 24] : key === 'position' ? [0, 1] : [100, 1e6];
    if (!Number.isFinite(c[key]) || c[key] < min || c[key] > max)
      throw new Error(`${key} must be between ${min} and ${max}.`);
  }
  return { ...c };
}
export function simulate(input: DividerConfig) {
  const c = validate(input);
  let upper = c.r1,
    lower = c.r2;
  if (c.configuration === 'potentiometer') {
    upper = c.pot * (1 - c.position);
    lower = c.pot * c.position;
  }
  if (c.configuration === 'sensor') {
    upper = c.sensorPosition === 'upper' ? c.sensor : c.fixed;
    lower = c.sensorPosition === 'lower' ? c.sensor : c.fixed;
  }
  const loaded =
    c.configuration === 'loaded' ||
    (c.configuration === 'potentiometer' && c.potLoaded);
  const effectiveLower = loaded ? (lower * c.load) / (lower + c.load) : lower;
  const ratio = effectiveLower / (upper + effectiveLower);
  const output = c.vin * ratio;
  const unloaded = (c.vin * lower) / (upper + lower);
  // At a grounded wiper the lower segment is an ideal wire: it carries source current.
  const sourceCurrent = c.vin / (upper + effectiveLower);
  const loadCurrent = loaded ? output / c.load : 0;
  const lowerCurrent = sourceCurrent - loadCurrent;
  return {
    upper,
    lower,
    loaded,
    effectiveLower,
    ratio,
    output,
    unloaded,
    sourceCurrent,
    lowerCurrent,
    loadCurrent,
    upperDrop: c.vin - output,
    lowerDrop: output,
    upperPower: sourceCurrent ** 2 * upper,
    lowerPower: lowerCurrent ** 2 * lower,
    loadPower: loadCurrent * output,
    loadingError:
      unloaded === 0 ? null : (100 * (unloaded - output)) / unloaded,
  };
}
export type DividerResult = ReturnType<typeof simulate>;
export function sweepAxis(c: DividerConfig) {
  const key =
    c.configuration === 'potentiometer'
      ? 'position'
      : c.configuration === 'sensor'
        ? 'sensor'
        : c.configuration === 'loaded'
          ? 'load'
          : 'r2';
  return {
    key,
    label:
      key === 'position'
        ? 'Wiper position (%)'
        : key === 'sensor'
          ? 'Sensor resistance (Ω)'
          : key === 'load'
            ? 'Load resistance (Ω)'
            : 'Lower resistance R2 (Ω)',
    log: key !== 'position',
    current: c[key],
  } as const;
}
export function sweep(c: DividerConfig) {
  const axis = sweepAxis(c);
  const xs = Array.from({ length: 101 }, (_, i) =>
    axis.log ? 10 ** (2 + (4 * i) / 100) : i / 100,
  );
  xs.push(axis.current);
  return [...new Set(xs)]
    .sort((a, b) => a - b)
    .map((x) => {
      const r = simulate({ ...c, [axis.key]: x });
      return { x, output: r.output, unloaded: r.unloaded };
    });
}
export function eng(n: number, unit: string) {
  const abs = Math.abs(n);
  const [scale, prefix] =
    abs >= 1e6
      ? [1e6, 'M']
      : abs >= 1e3
        ? [1e3, 'k']
        : abs > 0 && abs < 1e-3
          ? [1e-6, 'µ']
          : abs > 0 && abs < 1
            ? [1e-3, 'm']
            : [1, ''];
  return `${Number((n / scale).toPrecision(4))} ${prefix}${unit}`;
}
