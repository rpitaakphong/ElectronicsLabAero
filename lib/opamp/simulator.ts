/** All physical values use SI units (Hz, ohms, farads, volts, seconds).
 * This is an educational behavioral model, not a device/SPICE model.
 */
export const CIRCUITS = [
  'comparator',
  'buffer',
  'noninverting',
  'inverting',
  'summing',
  'lowpass',
] as const;
export type Circuit = (typeof CIRCUITS)[number];
export type Waveform = 'sine' | 'square' | 'triangle';
export interface Source {
  waveform: Waveform;
  amplitude: number;
  frequency: number;
  offset: number;
  phase: number;
}
export interface Config {
  circuit: Circuit;
  source: Source;
  second: Source;
  components: {
    rin: number;
    rf: number;
    rg: number;
    r2: number;
    capacitance: number;
    reference: number;
    supplyNegative: number;
    supplyPositive: number;
  };
}
export interface Sample {
  time: number;
  input: number;
  second: number;
  output: number;
}
export interface Simulation {
  samples: Sample[];
  duration: number;
  metrics: {
    gain: number | null;
    secondGain: number | null;
    cutoff: number | null;
    inputVpp: number;
    outputVpp: number;
    outputMin: number;
    outputMax: number;
    measuredGain: number | null;
    clipped: boolean;
  };
}
export interface SimulationOptions {
  duration?: number;
  steps?: number;
}
export const DEFAULT_CONFIG: Config = {
  circuit: 'comparator',
  source: {
    waveform: 'sine',
    amplitude: 0.5,
    frequency: 1000,
    offset: 0,
    phase: 0,
  },
  second: {
    waveform: 'sine',
    amplitude: 0.5,
    frequency: 1000,
    offset: 0,
    phase: 0,
  },
  components: {
    rin: 10000,
    rf: 20000,
    rg: 10000,
    r2: 10000,
    capacitance: 10e-9,
    reference: 0,
    supplyNegative: -5,
    supplyPositive: 5,
  },
};
export const cloneDefault = (): Config => structuredClone(DEFAULT_CONFIG);
export function clamp(v: number, low: number, high: number) {
  return Math.min(high, Math.max(low, v));
}
function bounded(
  v: unknown,
  low: number,
  high: number,
  name: string,
): asserts v is number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < low || v > high)
    throw new Error(`${name} must be between ${low} and ${high}.`);
}
function record(
  v: unknown,
  name: string,
): asserts v is Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v))
    throw new Error(`${name} must be an object.`);
}
export function validateConfig(value: unknown): Config {
  record(value, 'Configuration');
  if (!CIRCUITS.includes(value.circuit as Circuit))
    throw new Error('Unknown circuit.');
  for (const name of ['source', 'second'] as const) {
    const s = value[name];
    record(s, name);
    if (!['sine', 'square', 'triangle'].includes(s.waveform as string))
      throw new Error('Unknown waveform.');
    bounded(s.amplitude, 0, 10, `${name} amplitude`);
    bounded(s.frequency, 1, 1e6, `${name} frequency`);
    bounded(s.offset, -10, 10, `${name} offset`);
    bounded(s.phase, -180, 180, `${name} phase`);
  }
  const c = value.components;
  record(c, 'Components');
  if ('outputLow' in c || 'outputHigh' in c)
    throw new Error(
      'Comparator output levels were replaced by supplyNegative and supplyPositive.',
    );
  for (const name of ['rin', 'rf', 'rg', 'r2'])
    bounded(c[name], 1000, 100000, name);
  bounded(c.capacitance, 1e-10, 1e-5, 'Capacitance');
  bounded(c.reference, -10, 10, 'Reference');
  bounded(c.supplyNegative, -15, 15, 'V− supply rail');
  bounded(c.supplyPositive, -15, 15, 'V+ supply rail');
  if (c.supplyPositive - c.supplyNegative < 0.1 - 1e-9)
    throw new Error('V+ supply rail must be at least 0.1 V above V−.');
  // Reconstruct only supported fields; do not retain arbitrary tool payloads.
  const source = (s: Record<string, unknown>): Source => ({
    waveform: s.waveform as Waveform,
    amplitude: s.amplitude as number,
    frequency: s.frequency as number,
    offset: s.offset as number,
    phase: s.phase as number,
  });
  return {
    circuit: value.circuit as Circuit,
    source: source(value.source as Record<string, unknown>),
    second: source(value.second as Record<string, unknown>),
    components: {
      rin: c.rin as number,
      rf: c.rf as number,
      rg: c.rg as number,
      r2: c.r2 as number,
      capacitance: c.capacitance,
      reference: c.reference,
      supplyNegative: c.supplyNegative,
      supplyPositive: c.supplyPositive,
    },
  };
}
export function waveform(shape: Waveform, cycles: number) {
  const q = ((cycles % 1) + 1) % 1;
  if (shape === 'square') return q < 0.5 ? 1 : -1;
  if (shape === 'triangle') return 1 - 4 * Math.abs(((q + 0.25) % 1) - 0.5);
  return Math.sin(2 * Math.PI * q);
}
export function sourceAt(s: Source, t: number) {
  return (
    s.offset +
    s.amplitude * waveform(s.waveform, t * s.frequency + s.phase / 360)
  );
}
export function characteristics(c: Config) {
  const p = c.components;
  const gain =
    c.circuit === 'comparator'
      ? null
      : c.circuit === 'buffer'
        ? 1
        : c.circuit === 'noninverting'
          ? 1 + p.rf / p.rg
          : -p.rf / p.rin;
  const secondGain = c.circuit === 'summing' ? -p.rf / p.r2 : null;
  return {
    gain,
    secondGain,
    cutoff:
      c.circuit === 'lowpass' ? 1 / (2 * Math.PI * p.rf * p.capacitance) : null,
  };
}
/** Periodic steady-state first-order filtering. Sines are analytic. Other
 * waveforms use an exact zero-order-hold recurrence on a 4096-point period.
 * Solving y(T)=y(0) avoids arbitrarily long RC startup transients.
 */
function filteredSource(s: Source, taus: number[]): (t: number) => number {
  if (!taus.length) return (t) => sourceAt(s, t);
  if (s.waveform === 'sine') {
    let a = s.amplitude,
      phase = (s.phase * Math.PI) / 180;
    for (const tau of taus) {
      const w = 2 * Math.PI * s.frequency * tau;
      a /= Math.hypot(1, w);
      phase -= Math.atan(w);
    }
    return (t) =>
      s.offset + a * Math.sin(2 * Math.PI * s.frequency * t + phase);
  }
  const n = 4096,
    dt = 1 / (s.frequency * n);
  let data = Float64Array.from(
    { length: n },
    (_, i) => s.amplitude * waveform(s.waveform, i / n),
  );
  for (const [stage, tau] of taus.entries()) {
    const k = -Math.expm1(-dt / tau),
      periodK = -Math.expm1(-1 / (s.frequency * tau));
    let end = 0;
    // Midpoint forcing improves ramp accuracy. Sample square before filtering.
    const forcing = (i: number) =>
      stage === 0
        ? s.amplitude * waveform(s.waveform, (i + 0.5) / n)
        : (data[i] + data[(i + 1) % n]) / 2;
    for (let i = 0; i < n; i++) end += k * (forcing(i) - end);
    let y = end / periodK;
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      out[i] = y;
      y += k * (forcing(i) - y);
    }
    data = out;
  }
  return (t) => {
    const q = ((((t * s.frequency + s.phase / 360) % 1) + 1) % 1) * n;
    const i = Math.floor(q);
    return s.offset + data[i] + (data[(i + 1) % n] - data[i]) * (q - i);
  };
}
function signalModel(c: Config): (t: number) => number {
  const { gain, secondGain } = characteristics(c);
  if (c.circuit === 'comparator')
    return (t) =>
      sourceAt(c.source, t) >= c.components.reference
        ? c.components.supplyPositive
        : c.components.supplyNegative;
  const taus: number[] = [];
  if (c.circuit === 'lowpass')
    taus.push(c.components.rf * c.components.capacitance);
  const first = filteredSource(c.source, taus),
    second = filteredSource(c.second, []);
  return (t) =>
    c.circuit === 'buffer'
      ? first(t)
      : c.components.reference +
        gain! * (first(t) - c.components.reference) +
        (secondGain ?? 0) * (second(t) - c.components.reference);
}
export function simulate(
  input: Config,
  {
    duration: requestedDuration,
    steps: requestedSteps,
  }: SimulationOptions = {},
): Simulation {
  const c = validateConfig(input),
    ch = characteristics(c);
  const maxF = Math.max(
    c.source.frequency,
    c.circuit === 'summing' ? c.second.frequency : 0,
  );
  const duration = requestedDuration ?? 4 / maxF,
    steps = requestedSteps ?? 4096;
  if (!Number.isFinite(duration) || duration <= 0)
    throw new Error('Simulation duration must be positive.');
  if (!Number.isInteger(steps) || steps < 64 || steps > 65536)
    throw new Error('Simulation steps must be an integer from 64 to 65536.');
  const dt = duration / steps;
  const outputAt = signalModel(c);
  const samples: Sample[] = [];
  let clipped = false;
  for (let i = 0; i <= steps; i++) {
    const t = i * dt,
      requestedOutput = outputAt(t),
      output =
        c.circuit === 'comparator'
          ? requestedOutput
          : clamp(
              requestedOutput,
              c.components.supplyNegative,
              c.components.supplyPositive,
            );
    if (output !== requestedOutput) clipped = true;
    samples.push({
      time: t,
      input: sourceAt(c.source, t),
      second: sourceAt(c.second, t),
      output,
    });
  }
  let inputMin = Infinity,
    inputMax = -Infinity,
    outputMin = Infinity,
    outputMax = -Infinity;
  for (const s of samples) {
    inputMin = Math.min(inputMin, s.input);
    inputMax = Math.max(inputMax, s.input);
    outputMin = Math.min(outputMin, s.output);
    outputMax = Math.max(outputMax, s.output);
  }
  const inputVpp = inputMax - inputMin,
    outputVpp = outputMax - outputMin;
  return {
    samples,
    duration,
    metrics: {
      ...ch,
      inputVpp,
      outputVpp,
      outputMin,
      outputMax,
      measuredGain:
        inputVpp > 1e-9 && !['summing', 'comparator'].includes(c.circuit)
          ? outputVpp / inputVpp
          : null,
      clipped,
    },
  };
}
export function engineering(value: number, unit = '', digits = 3): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) < 1e-15) return `0${unit ? ' ' + unit : ''}`;
  const exponent = clamp(
    Math.floor(Math.log10(Math.abs(value)) / 3) * 3,
    -12,
    9,
  );
  const prefixes: Record<number, string> = {
    '-12': 'p',
    '-9': 'n',
    '-6': 'µ',
    '-3': 'm',
    0: '',
    3: 'k',
    6: 'M',
    9: 'G',
  };
  const number = Number((value / 10 ** exponent).toPrecision(digits));
  return `${number}${unit ? ' ' : ''}${prefixes[exponent]}${unit}`;
}
