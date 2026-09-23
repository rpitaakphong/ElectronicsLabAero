/** Passive RC learning model. SI units; an ideal source and optional output load. */
export const CONFIGURATIONS = ['lowpass', 'highpass', 'bandpass'] as const;
export type RcKind = (typeof CONFIGURATIONS)[number];
export type Waveform = 'sine' | 'square' | 'triangle';
export type RcInputMode = 'clean' | 'interference' | 'custom';
/** Repeatable phases for the conditioned UAV sensor, shared with RcSignals. */
export const UAV_PHASES: readonly number[] = (() => {
  let seed = 0x55415631;
  return Array.from({ length: 3 }, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed / 4294967296) * 2 * Math.PI;
  });
})();
export interface RcExampleSettings {
  input: RcInputMode;
  frequency: number;
  amplitude: number;
  strength: number;
  interferenceFrequencies: number[];
  window: 'detail' | 'overview';
}
export const EXAMPLE_DEFAULTS: Record<
  RcKind,
  {
    frequency: number;
    interference: { label: string; frequency: number; amplitude: number }[];
  }
> = {
  lowpass: {
    frequency: 200,
    interference: [
      { label: 'Fast interference', frequency: 10000, amplitude: 0.35 },
    ],
  },
  highpass: {
    frequency: 200,
    interference: [
      { label: 'Aircraft movement', frequency: 2, amplitude: 0.6 },
      { label: 'Additional movement', frequency: 5, amplitude: 0.3 },
    ],
  },
  bandpass: {
    frequency: 500,
    interference: [
      { label: 'Slow drift', frequency: 20, amplitude: 0.6 },
      { label: 'Fast interference', frequency: 10000, amplitude: 0.35 },
    ],
  },
};
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
  examples: Record<RcKind, RcExampleSettings>;
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
  desired?: number;
}
export interface RcTone {
  id: string;
  label: string;
  role: 'useful' | 'interference';
  frequency: number;
  amplitude: number;
  /** Input sine phase in radians, relative to the fixed signal epoch. */
  phase: number;
  marker?: string;
}
export interface RcToneResult extends RcTone {
  response: RcFrequencyPoint;
  outputAmplitude: number;
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
  isExample: boolean;
  isUav: boolean;
  tones: RcToneResult[];
  requestedDuration: number;
  windowLimited: boolean;
  exampleWindow: RcExampleSettings['window'] | null;
}
export const defaults = (): RcFilterConfig => ({
  kind: 'lowpass',
  circuits: Object.fromEntries(
    CONFIGURATIONS.map((kind) => [
      kind,
      {
        r1: kind === 'highpass' ? 33000 : 10000,
        c1: kind === 'lowpass' ? 10e-9 : 100e-9,
        r2: 10000,
        c2: 10e-9,
        loaded: false,
        load: 10000,
      },
    ]),
  ) as Record<RcKind, RcComponents>,
  examples: Object.fromEntries(
    CONFIGURATIONS.map((kind) => [
      kind,
      {
        input: 'interference',
        frequency: EXAMPLE_DEFAULTS[kind].frequency,
        amplitude: 1,
        strength: 100,
        interferenceFrequencies: EXAMPLE_DEFAULTS[kind].interference.map(
          (tone) => tone.frequency,
        ),
        window: kind === 'highpass' ? 'overview' : 'detail',
      },
    ]),
  ) as Record<RcKind, RcExampleSettings>,
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
  for (const kind of CONFIGURATIONS) {
    const p = c.circuits[kind],
      example = c.examples?.[kind];
    if (!p || !example)
      throw new Error(
        'Include circuit and signal settings for every RC category.',
      );
    for (const k of ['r1', 'r2', 'load'] as const)
      bounded(p[k], 100, 1e6, 'Resistance (Ω)');
    for (const k of ['c1', 'c2'] as const)
      bounded(p[k], 1e-10, 1e-5, 'Capacitance (F)');
    if (typeof p.loaded !== 'boolean')
      throw new Error('Choose whether a load is connected.');
    if (
      !['clean', 'interference', 'custom'].includes(example.input) ||
      !['detail', 'overview'].includes(example.window)
    )
      throw new Error('Choose a valid input signal and waveform window.');
    bounded(example.frequency, 0.1, 1e6, 'Useful-signal frequency (Hz)');
    bounded(example.amplitude, 0, 5, 'Useful-signal amplitude (V peak)');
    bounded(example.strength, 0, 200, 'Interference strength (%)');
    if (
      !Array.isArray(example.interferenceFrequencies) ||
      example.interferenceFrequencies.length !==
        EXAMPLE_DEFAULTS[kind].interference.length
    )
      throw new Error(
        'Include the interference frequencies for this RC category.',
      );
    for (const frequency of example.interferenceFrequencies)
      bounded(frequency, 0.1, 1e6, 'Interference frequency (Hz)');
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
  const example = c.examples[c.kind],
    isExample = c.view === 'periodic' && example.input !== 'custom',
    isUav = isExample && c.kind === 'highpass',
    selectedFrequency = isExample ? example.frequency : c.source.frequency,
    slowTau = Math.max(...h.modes.map((m) => m.tau));
  const toneDefinitions: RcTone[] = isExample
    ? [
        {
          id: 'useful',
          label: isUav ? 'Motor vibration' : 'Useful signal',
          role: 'useful',
          frequency: example.frequency,
          amplitude: example.amplitude,
          phase: isUav ? UAV_PHASES[0] : 0,
          ...(isUav ? { marker: 'V' } : {}),
        },
        ...(example.input === 'interference' && example.strength > 0
          ? EXAMPLE_DEFAULTS[c.kind].interference.map((tone, i) => ({
              id: `interference-${i}`,
              label: tone.label,
              role: 'interference' as const,
              frequency: example.interferenceFrequencies[i],
              amplitude: (tone.amplitude * example.strength) / 100,
              phase: isUav ? UAV_PHASES[i + 1] : 0,
              ...(isUav ? { marker: `M${i + 1}` } : {}),
            }))
          : []),
      ]
    : [];
  const tones = toneDefinitions.map((tone) => {
    const point = response(h, tone.frequency);
    return {
      ...tone,
      response: point,
      outputAmplitude: tone.amplitude * point.gain,
    };
  });
  const requestedDuration =
    c.view === 'step'
      ? 8 * slowTau
      : isExample
        ? Math.max(
            4 / example.frequency,
            ...(example.window === 'overview'
              ? tones
                  .filter(
                    (tone) =>
                      tone.role === 'interference' && tone.amplitude > 0,
                  )
                  .map((tone) => (isUav ? 2 : 1) / tone.frequency)
              : []),
          )
        : 4 / c.source.frequency;
  // Bound the window, not the sample rate: a large frequency ratio must never
  // silently alias a faster tone into an apparent slow signal.
  const fastestActive = Math.max(
      0,
      ...tones
        .filter((tone) => tone.amplitude > 0)
        .map((tone) => tone.frequency),
    ),
    requiredIntervals = requestedDuration * fastestActive * 32,
    windowLimited = isExample && requiredIntervals > 32768,
    duration = windowLimited ? 32768 / (32 * fastestActive) : requestedDuration,
    intervals = isExample
      ? windowLimited
        ? 32768
        : Math.max(1000, Math.ceil(requiredIntervals))
      : 1000;
  const markedFrequencies = [
    selectedFrequency,
    ...tones.map((tone) => tone.frequency),
  ];
  const sweepPadding = isUav ? 10 : 100,
    lo = Math.log10(Math.min(...cutoffs, ...markedFrequencies) / sweepPadding),
    hi = Math.log10(Math.max(...cutoffs, ...markedFrequencies) * sweepPadding);
  const frequencies = [
    ...Array.from(
      { length: 241 },
      (_, i) => 10 ** (lo + ((hi - lo) * i) / 240),
    ),
    ...cutoffs,
    ...markedFrequencies,
    ...(peakFrequency ? [peakFrequency] : []),
  ].sort((a, b) => a - b);
  const samples: RcSample[] = Array.from({ length: intervals + 1 }, (_, i) => {
    const time = (duration * i) / intervals;
    if (isExample) {
      const desired = tones
        .filter((tone) => tone.role === 'useful')
        .reduce(
          (sum, tone) =>
            sum +
            tone.amplitude *
              Math.sin(2 * Math.PI * tone.frequency * time + tone.phase),
          0,
        );
      return {
        time,
        desired,
        input: tones.reduce(
          (sum, tone) =>
            sum +
            tone.amplitude *
              Math.sin(2 * Math.PI * tone.frequency * time + tone.phase),
          0,
        ),
        output: tones.reduce(
          (sum, tone) =>
            sum +
            tone.outputAmplitude *
              Math.sin(
                2 * Math.PI * tone.frequency * time +
                  tone.phase +
                  (tone.response.phase * Math.PI) / 180,
              ),
          0,
        ),
      };
    }
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
    selected: response(h, selectedFrequency),
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
    requestedDuration,
    isExample,
    isUav,
    tones,
    windowLimited,
    exampleWindow: isExample ? example.window : null,
  };
}

/** Add coincident sine components as phasors, so their relative phases matter. */
export function toneSpectrum(tones: readonly RcToneResult[]) {
  const bins = new Map<
    number,
    { inputRe: number; inputIm: number; outputRe: number; outputIm: number }
  >();
  for (const tone of tones) {
    const bin = bins.get(tone.frequency) ?? {
      inputRe: 0,
      inputIm: 0,
      outputRe: 0,
      outputIm: 0,
    };
    const outputPhase = tone.phase + (tone.response.phase * Math.PI) / 180;
    bin.inputRe += tone.amplitude * Math.cos(tone.phase);
    bin.inputIm += tone.amplitude * Math.sin(tone.phase);
    bin.outputRe += tone.outputAmplitude * Math.cos(outputPhase);
    bin.outputIm += tone.outputAmplitude * Math.sin(outputPhase);
    bins.set(tone.frequency, bin);
  }
  return [...bins]
    .map(([frequency, bin]) => ({
      frequency,
      input: Math.hypot(bin.inputRe, bin.inputIm),
      output: Math.hypot(bin.outputRe, bin.outputIm),
    }))
    .sort((a, b) => a.frequency - b.frequency);
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
