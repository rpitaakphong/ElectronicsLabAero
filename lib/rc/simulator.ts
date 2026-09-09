/** Passive RC learning model. SI units; an ideal source and optional output load. */
export const CONFIGURATIONS = ['lowpass', 'highpass', 'bandpass'] as const;
export type RcKind = (typeof CONFIGURATIONS)[number];
export type Waveform = 'sine' | 'square' | 'triangle';
export interface RcComponents {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
  loaded: boolean;
  load: number;
}
export interface RcFilterConfig {
  kind: RcKind;
  circuits: Record<RcKind, RcComponents>;
  source: {
    waveform: Waveform;
    frequency: number;
    amplitude: number;
    offset: number;
  };
  view: 'periodic' | 'step';
  stepVoltage: number;
}
export interface RcTransfer {
  n0: number;
  n1: number;
  a: number;
  b: number;
  direct: number;
  modes: { gain: number; tau: number }[];
}
export interface RcFrequencyPoint {
  frequency: number;
  gain: number;
  db: number;
  phase: number;
}
export interface RcSample {
  time: number;
  input: number;
  output: number;
}
export interface RcResult {
  transfer: RcTransfer;
  selected: RcFrequencyPoint;
  sweep: RcFrequencyPoint[];
  samples: RcSample[];
  cutoffs: number[];
  peakFrequency: number | null;
  peakGain: number;
  bandwidth: number | null;
  slowTau: number;
  stageCorners: number[];
  duration: number;
}
export const defaults = (): RcFilterConfig => ({
  kind: 'lowpass',
  circuits: Object.fromEntries(
    CONFIGURATIONS.map((kind) => [
      kind,
      {
        r1: 10000,
        c1: kind === 'bandpass' ? 100e-9 : 10e-9,
        r2: 10000,
        c2: 10e-9,
        loaded: false,
        load: 10000,
      },
    ]),
  ) as Record<RcKind, RcComponents>,
  source: { waveform: 'sine', frequency: 1000, amplitude: 1, offset: 0 },
  view: 'periodic',
  stepVoltage: 1,
});
export function validate(c: RcFilterConfig): RcFilterConfig {
  if (
    !CONFIGURATIONS.includes(c.kind) ||
    !['periodic', 'step'].includes(c.view) ||
    !['sine', 'square', 'triangle'].includes(c.source.waveform)
  )
    throw new Error('Choose a valid RC configuration and waveform.');
  const bounded = (v: number, min: number, max: number, name: string) => {
    if (!Number.isFinite(v) || v < min || v > max)
      throw new Error(`${name} must be between ${min} and ${max}.`);
  };
  for (const p of Object.values(c.circuits)) {
    for (const k of ['r1', 'r2', 'load'] as const)
      bounded(p[k], 100, 1e6, 'Resistance (Ω)');
    for (const k of ['c1', 'c2'] as const)
      bounded(p[k], 1e-10, 1e-5, 'Capacitance (F)');
    if (typeof p.loaded !== 'boolean')
      throw new Error('Choose whether a load is connected.');
  }
  bounded(c.source.frequency, 0.1, 1e6, 'Frequency (Hz)');
  bounded(c.source.amplitude, 0, 5, 'Amplitude (V peak)');
  bounded(c.source.offset, -5, 5, 'Offset (V)');
  bounded(c.stepVoltage, 0, 5, 'Step voltage (V)');
  return structuredClone(c);
}
export function transfer(kind: RcKind, c: RcComponents): RcTransfer {
  const parallel = c.loaded ? (c.r1 * c.load) / (c.r1 + c.load) : c.r1;
  if (kind !== 'bandpass') {
    const tau = parallel * c.c1,
      gain = kind === 'lowpass' ? parallel / c.r1 : 1;
    return {
      n0: kind === 'lowpass' ? gain : 0,
      n1: kind === 'highpass' ? tau : 0,
      a: tau,
      b: 0,
      direct: kind === 'highpass' ? 1 : 0,
      modes: [{ gain: kind === 'lowpass' ? gain : -1, tau }],
    };
  }
  const g1 = 1 / c.r1,
    g2 = 1 / c.r2,
    gl = c.loaded ? 1 / c.load : 0,
    constant = g1 * g2 + g1 * gl + g2 * gl;
  const a = (c.c1 * (g2 + gl) + c.c2 * (g1 + g2)) / constant,
    b = (c.c1 * c.c2) / constant,
    n1 = (c.c1 * g2) / constant;
  const root = Math.sqrt(Math.max(0, a * a - 4 * b)),
    slow = (a + root) / 2,
    fast = (2 * b) / (a + root),
    gain = n1 / (fast - slow);
  return {
    n0: 0,
    n1,
    a,
    b,
    direct: 0,
    modes: [
      { gain, tau: slow },
      { gain: -gain, tau: fast },
    ],
  };
}
export function response(h: RcTransfer, frequency: number): RcFrequencyPoint {
  const w = 2 * Math.PI * frequency,
    dr = 1 - h.b * w * w,
    di = h.a * w,
    nr = h.n0,
    ni = h.n1 * w,
    den = dr * dr + di * di;
  const re = (nr * dr + ni * di) / den,
    im = (ni * dr - nr * di) / den,
    gain = Math.hypot(re, im);
  return {
    frequency,
    gain,
    db: gain > 0 ? 20 * Math.log10(gain) : -Infinity,
    phase: gain > 0 ? (Math.atan2(im, re) * 180) / Math.PI : 0,
  };
}
export function wave(shape: Waveform, phase: number) {
  const q = ((phase % 1) + 1) % 1;
  return shape === 'sine'
    ? Math.sin(2 * Math.PI * q)
    : shape === 'square'
      ? q < 0.5
        ? 1
        : -1
      : q < 0.25
        ? 4 * q
        : q < 0.75
          ? 2 - 4 * q
          : 4 * q - 4;
}
/** Exact periodic solution of tau*y' + y = waveform; no startup warm-up. */
export function filteredWave(
  shape: Waveform,
  t: number,
  frequency: number,
  tau: number,
) {
  const period = 1 / frequency,
    q = ((t % period) + period) % period;
  if (shape === 'sine') {
    const w = 2 * Math.PI * frequency * tau;
    return (
      (Math.sin(2 * Math.PI * frequency * t) -
        w * Math.cos(2 * Math.PI * frequency * t)) /
      (1 + w * w)
    );
  }
  if (shape === 'square') {
    const half = period / 2,
      y0 = -Math.tanh(half / (2 * tau));
    return q < half
      ? 1 + (y0 - 1) * Math.exp(-q / tau)
      : -1 + (1 - y0) * Math.exp(-(q - half) / tau);
  }
  const knots = [
    [0, 0],
    [period / 4, 1],
    [(3 * period) / 4, -1],
    [period, 0],
  ];
  const advance = (y: number, u: number, slope: number, dt: number) => {
    const one = -Math.expm1(-dt / tau);
    return y * (1 - one) + u * one + slope * (dt - tau * one);
  };
  let forcing = 0;
  for (let i = 0; i < 3; i++) {
    const [a, u] = knots[i],
      [b, v] = knots[i + 1];
    forcing = advance(forcing, u, (v - u) / (b - a), b - a);
  }
  let y = forcing / -Math.expm1(-period / tau);
  for (let i = 0; i < 3; i++) {
    const [a, u] = knots[i],
      [b, v] = knots[i + 1];
    y = advance(y, u, (v - u) / (b - a), Math.max(0, Math.min(q, b) - a));
    if (q <= b) break;
  }
  return y;
}
export function stepAt(h: RcTransfer, t: number, voltage = 1) {
  return (
    voltage *
    (h.direct +
      h.modes.reduce(
        (sum, m) => sum + m.gain * -Math.expm1(-Math.max(0, t) / m.tau),
        0,
      ))
  );
}
export function periodicAt(
  h: RcTransfer,
  source: RcFilterConfig['source'],
  t: number,
) {
  return (
    source.offset * h.n0 +
    source.amplitude *
      (h.direct * wave(source.waveform, t * source.frequency) +
        h.modes.reduce(
          (sum, m) =>
            sum +
            m.gain * filteredWave(source.waveform, t, source.frequency, m.tau),
          0,
        ))
  );
}
export function simulate(config: RcFilterConfig): RcResult {
  const c = validate(config),
    p = c.circuits[c.kind],
    h = transfer(c.kind, p),
    peakFrequency =
      c.kind === 'bandpass' ? 1 / (2 * Math.PI * Math.sqrt(h.b)) : null;
  const peakGain =
    peakFrequency === null ? (c.kind === 'lowpass' ? h.n0 : 1) : h.n1 / h.a;
  const cutoffs =
    peakFrequency === null
      ? [1 / (2 * Math.PI * h.a)]
      : [
          2 / (Math.sqrt(h.a * h.a + 4 * h.b) + h.a) / (2 * Math.PI),
          (Math.sqrt(h.a * h.a + 4 * h.b) + h.a) / (2 * h.b) / (2 * Math.PI),
        ];
  const slowTau = Math.max(...h.modes.map((m) => m.tau)),
    duration = c.view === 'step' ? 8 * slowTau : 4 / c.source.frequency;
  const lo = Math.log10(Math.min(...cutoffs, c.source.frequency) / 100),
    hi = Math.log10(Math.max(...cutoffs, c.source.frequency) * 100);
  const frequencies = [
    ...Array.from(
      { length: 241 },
      (_, i) => 10 ** (lo + ((hi - lo) * i) / 240),
    ),
    ...cutoffs,
    c.source.frequency,
    ...(peakFrequency ? [peakFrequency] : []),
  ].sort((a, b) => a - b);
  const samples = Array.from({ length: 1001 }, (_, i) => {
    const time = (duration * i) / 1000;
    return {
      time,
      input:
        c.view === 'step'
          ? c.stepVoltage
          : c.source.offset +
            c.source.amplitude *
              wave(c.source.waveform, time * c.source.frequency),
      output:
        c.view === 'step'
          ? stepAt(h, time, c.stepVoltage)
          : periodicAt(h, c.source, time),
    };
  });
  return {
    transfer: h,
    selected: response(h, c.source.frequency),
    sweep: frequencies.map((f) => response(h, f)),
    samples,
    cutoffs,
    peakFrequency,
    peakGain,
    bandwidth: peakFrequency ? cutoffs[1] - cutoffs[0] : null,
    slowTau,
    stageCorners: [
      1 / (2 * Math.PI * p.r1 * p.c1),
      ...(c.kind === 'bandpass' ? [1 / (2 * Math.PI * p.r2 * p.c2)] : []),
    ],
    duration,
  };
}

export function engineering(value: number, unit: string) {
  if (!Number.isFinite(value)) return '—';
  const scales: [number, string][] = [
    [1e9, 'G'],
    [1e6, 'M'],
    [1e3, 'k'],
    [1, ''],
    [1e-3, 'm'],
    [1e-6, 'µ'],
    [1e-9, 'n'],
    [1e-12, 'p'],
  ];
  const [scale, prefix] =
    value === 0
      ? scales[3]
      : (scales.find(([n]) => Math.abs(value) >= n) ?? scales.at(-1)!);
  return `${Number((value / scale).toPrecision(4))} ${prefix}${unit}`;
}
