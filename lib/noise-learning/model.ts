/** Independent educational models. No workbook, acquisition or storage dependencies. */
export type Wave = 'steady' | 'step' | 'pulse' | 'sine';
export type Noise = 'random' | 'periodic' | 'drift';
export type Method = 'raw' | 'rc' | 'ma' | 'ema';
export type Family = 'lowpass' | 'highpass' | 'bandpass' | 'notch';
export interface Settings {
  wave: Wave;
  noise: Noise;
  amplitude: number;
  noiseRms: number;
  frequency: number;
  noiseFrequency: number;
  pulseWidth: number;
  rate: number;
  resistance: number;
  capacitance: number;
  window: number;
  alpha: number;
  seed: number;
}
export const DURATION = 2,
  EDGE = 0.5,
  BASELINE = 1.65;
export const METHODS: Method[] = ['raw', 'rc', 'ma', 'ema'];
export const LABELS: Record<Method, string> = {
  raw: 'RAW',
  rc: 'RC low-pass',
  ma: 'Moving average',
  ema: 'Exponential average',
};
export const COLORS: Record<Method | 'clean' | 'noise', string> = {
  raw: '#93a5bd',
  rc: '#66dac0',
  ma: '#f2c66d',
  ema: '#be9af6',
  clean: '#dfeaf4',
  noise: '#f6919d',
};
export const defaults = (): Settings => ({
  wave: 'pulse',
  noise: 'random',
  amplitude: 0.8,
  noiseRms: 0.12,
  frequency: 4,
  noiseFrequency: 70,
  pulseWidth: 0.08,
  rate: 500,
  resistance: 10000,
  capacitance: 2e-6,
  window: 15,
  alpha: 0.12,
  seed: 42,
});
export function validate(s: Settings): Settings {
  const bounds: Partial<Record<keyof Settings, [number, number]>> = {
    amplitude: [0, 1.5],
    noiseRms: [0, 0.5],
    frequency: [0.5, 80],
    noiseFrequency: [0.2, 200],
    pulseWidth: [0.01, 0.5],
    rate: [25, 2000],
    resistance: [1000, 100000],
    capacitance: [1e-8, 1e-5],
    window: [1, 101],
    alpha: [0.01, 1],
    seed: [1, 1e9],
  };
  if (
    !['steady', 'step', 'pulse', 'sine'].includes(s.wave) ||
    !['random', 'periodic', 'drift'].includes(s.noise)
  )
    throw new Error('Choose an available signal and disturbance.');
  for (const [key, [lo, hi]] of Object.entries(bounds)) {
    const v = s[key as keyof Settings];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi)
      throw new Error(`Invalid ${key}.`);
  }
  if (![s.window, s.rate, s.seed].every(Number.isInteger))
    throw new Error(
      'Sample counts, rate and noise seed must be whole numbers.',
    );
  return { ...s };
}
type Complex = { re: number; im: number };
export function response(method: Method, f: number, s: Settings): Complex {
  if (method === 'raw') return { re: 1, im: 0 };
  if (method === 'rc') {
    const w = 2 * Math.PI * f * s.resistance * s.capacitance;
    return { re: 1 / (1 + w * w), im: -w / (1 + w * w) };
  }
  const w = (2 * Math.PI * f) / s.rate;
  if (method === 'ma') {
    let re = 0,
      im = 0;
    for (let i = 0; i < s.window; i++) {
      re += Math.cos(w * i);
      im -= Math.sin(w * i);
    }
    return { re: re / s.window, im: im / s.window };
  }
  const a = 1 - (1 - s.alpha) * Math.cos(w),
    b = (1 - s.alpha) * Math.sin(w),
    d = a * a + b * b;
  return { re: (s.alpha * a) / d, im: (-s.alpha * b) / d };
}
export const magnitude = (h: Complex) => Math.hypot(h.re, h.im);
export function familyGain(kind: Family, f: number, corner: number): number {
  const r = f / corner;
  if (kind === 'lowpass') return 1 / Math.hypot(1, r);
  if (kind === 'highpass') return r / Math.hypot(1, r);
  if (kind === 'bandpass')
    return (2 * r) / Math.hypot(1, 2 * r) / Math.hypot(1, r / 2);
  return Math.abs(1 - r * r) / Math.hypot(1 - r * r, r / 3);
}
function rng(seed: number) {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}
export type Tone = { f: number; amp: number; phase: number };
export function noiseTones(s: Settings): Tone[] {
  if (!s.noiseRms) return [];
  if (s.noise !== 'random')
    return [
      {
        f: s.noise === 'drift' ? 0.6 : s.noiseFrequency,
        amp: s.noiseRms * Math.SQRT2,
        phase: 0.37,
      },
    ];
  // A reproducible, continuous, band-limited random-phase signal; never resampled white noise.
  const random = rng(s.seed);
  return Array.from({ length: 32 }, (_, i) => ({
    f: 8 + ((i + random()) * 182) / 32,
    amp: s.noiseRms * Math.sqrt(2 / 32),
    phase: 2 * Math.PI * random(),
  }));
}
export function useful(t: number, s: Settings): number {
  if (s.wave === 'steady') return 0;
  if (s.wave === 'sine')
    return s.amplitude * Math.sin(2 * Math.PI * s.frequency * t);
  return t + 1e-12 >= EDGE &&
    (s.wave === 'step' || t < EDGE + s.pulseWidth - 1e-12)
    ? s.amplitude
    : 0;
}
export function rawAt(t: number, s: Settings): number {
  return (
    BASELINE +
    useful(t, s) +
    noiseTones(s).reduce(
      (sum, tone) =>
        sum + tone.amp * Math.sin(2 * Math.PI * tone.f * t + tone.phase),
      0,
    )
  );
}
export function rcStep(t: number, tau: number): number {
  return t < 0 ? 0 : -Math.expm1(-t / tau);
}
function digitalStep(
  k: number,
  start: number,
  method: 'ma' | 'ema',
  s: Settings,
): number {
  const n = k - start + 1;
  if (n <= 0) return 0;
  return method === 'ma' ? Math.min(1, n / s.window) : 1 - (1 - s.alpha) ** n;
}
function usefulOutput(
  t: number,
  k: number,
  method: Method,
  s: Settings,
): number {
  if (method === 'raw') return useful(t, s);
  if (s.wave === 'steady') return 0;
  if (s.wave === 'sine') {
    const h = response(method, s.frequency, s),
      a = 2 * Math.PI * s.frequency * t;
    return s.amplitude * (h.re * Math.sin(a) + h.im * Math.cos(a));
  }
  if (method === 'rc') {
    const tau = s.resistance * s.capacitance;
    return (
      s.amplitude *
      (rcStep(t - EDGE, tau) -
        (s.wave === 'pulse' ? rcStep(t - EDGE - s.pulseWidth, tau) : 0))
    );
  }
  const start = Math.ceil(EDGE * s.rate - 1e-10),
    end = Math.ceil((EDGE + s.pulseWidth) * s.rate - 1e-10);
  return (
    s.amplitude *
    (digitalStep(k, start, method, s) -
      (s.wave === 'pulse' ? digitalStep(k, end, method, s) : 0))
  );
}
export function rms(values: number[], removeMean = false): number {
  if (!values.length) return 0;
  const mean = removeMean
    ? values.reduce((a, b) => a + b, 0) / values.length
    : 0;
  return Math.sqrt(
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length,
  );
}
export type Trace = { values: number[]; clean: number[]; noise: number[] };
export type Metric = {
  noise: number;
  delay: number | null;
  pulse: number | null;
  signal: number | null;
  snr: number | null;
};
export type Result = {
  settings: Settings;
  times: number[];
  traces: Record<Method, Trace>;
  metrics: Record<Method, Metric>;
  previousEma: number;
  warnings: string[];
};
export function simulate(input: Settings): Result {
  const s = validate(input),
    times = Array.from({ length: DURATION * s.rate + 1 }, (_, i) => i / s.rate),
    tones = noiseTones(s);
  const traces = {} as Record<Method, Trace>,
    metrics = {} as Record<Method, Metric>;
  for (const method of METHODS) {
    const filtered = tones.map((t) => ({ ...t, h: response(method, t.f, s) }));
    const noiseAt = (t: number) =>
      filtered.reduce((sum, tone) => {
        const a = 2 * Math.PI * tone.f * t + tone.phase;
        return (
          sum + tone.amp * (tone.h.re * Math.sin(a) + tone.h.im * Math.cos(a))
        );
      }, 0);
    const clean = times.map((t, k) => BASELINE + usefulOutput(t, k, method, s)),
      noise = times.map(noiseAt),
      values = clean.map((v, i) => v + noise[i]);
    traces[method] = { values, clean, noise };
    const steady = times.flatMap((t, i) =>
        t >= 0.1 && t <= 0.4 ? [noise[i]] : [],
      ),
      noiseRms = rms(s.wave === 'sine' ? noise : steady, true);
    const cross =
      s.wave === 'step' && s.amplitude > 0
        ? times.findIndex(
            (t, i) =>
              t >= EDGE && clean[i] - BASELINE >= s.amplitude * 0.9 - 1e-10,
          )
        : -1;
    const signal =
      s.wave === 'sine'
        ? rms(
            clean.map((v) => v - BASELINE),
            true,
          )
        : null;
    metrics[method] = {
      noise: noiseRms,
      delay: cross < 0 ? null : (times[cross] - EDGE) * 1000,
      pulse:
        s.wave === 'pulse' && s.amplitude > 0
          ? (100 * Math.max(...clean.map((v) => v - BASELINE))) / s.amplitude
          : null,
      signal,
      snr:
        signal && noiseRms > 1e-12 ? 20 * Math.log10(signal / noiseRms) : null,
    };
  }
  const at = -1 / s.rate,
    h = response('ema', s.frequency, s);
  const initialUseful =
    s.wave === 'sine'
      ? s.amplitude *
        (h.re * Math.sin(2 * Math.PI * s.frequency * at) +
          h.im * Math.cos(2 * Math.PI * s.frequency * at))
      : 0;
  const previousEma =
    BASELINE +
    initialUseful +
    tones.reduce((sum, tone) => {
      const r = response('ema', tone.f, s),
        a = 2 * Math.PI * tone.f * at + tone.phase;
      return sum + tone.amp * (r.re * Math.sin(a) + r.im * Math.cos(a));
    }, 0);
  const maxNoise =
    s.noise === 'random' ? 190 : s.noise === 'drift' ? 0.6 : s.noiseFrequency;
  const warnings = [];
  if (
    Math.max(
      s.wave === 'sine' ? s.frequency : 0,
      maxNoise * (s.noiseRms > 0 ? 1 : 0),
    ) >=
    s.rate / 2
  )
    warnings.push(
      'Some input frequencies reach or exceed half the sampling rate. RAW, MA and EMA may contain aliases; use the sampling section to inspect why.',
    );
  if (s.wave === 'pulse' && s.pulseWidth * s.rate < 2)
    warnings.push(
      'The pulse spans fewer than two sampling intervals. Its captured height depends strongly on sample timing.',
    );
  return { settings: s, times, traces, metrics, previousEma, warnings };
}
export function aliasFrequency(f: number, rate: number): number {
  return Math.abs(f - Math.round(f / rate) * rate);
}
export function quantize(v: number, bits: number, reference = 3.3): number {
  const max = 2 ** bits - 1;
  return (
    (Math.round((Math.min(reference, Math.max(0, v)) / reference) * max) *
      reference) /
    max
  );
}
export interface SamplingSettings {
  frequency: number;
  rate: number;
  bits: number;
  amplitude: number;
  analog: boolean;
  digital: boolean;
}
export function sampleDemo(s: SamplingSettings) {
  if (
    !Number.isFinite(s.frequency) ||
    s.frequency < 1 ||
    s.frequency > 180 ||
    ![20, 40, 80, 160, 320, 640].includes(s.rate) ||
    !Number.isInteger(s.bits) ||
    s.bits < 2 ||
    s.bits > 12 ||
    s.amplitude < 0 ||
    s.amplitude > 3 ||
    !Number.isFinite(s.amplitude)
  )
    throw new Error('Invalid sampling settings.');
  const model = { ...defaults(), rate: s.rate },
    h = s.analog ? response('rc', s.frequency, model) : { re: 1, im: 0 };
  const inputAt = (t: number) =>
    BASELINE + s.amplitude * Math.sin(2 * Math.PI * s.frequency * t);
  const analogAt = (t: number) =>
    BASELINE +
    s.amplitude *
      (h.re * Math.sin(2 * Math.PI * s.frequency * t) +
        h.im * Math.cos(2 * Math.PI * s.frequency * t));
  const times = Array.from(
      { length: Math.floor(s.rate * 0.5) + 1 },
      (_, i) => i / s.rate,
    ),
    input = times.map(analogAt),
    adc = input.map((v) => quantize(v, s.bits));
  let old = BASELINE;
  const digital = adc.map((v) => (old = 0.2 * v + 0.8 * old));
  return {
    times,
    input,
    adc,
    digital,
    denseTimes: Array.from({ length: 1001 }, (_, i) => i / 2000),
    inputAt,
    analogAt,
    alias: aliasFrequency(s.frequency, s.rate),
    clipped: input.filter((v) => v < 0 || v > 3.3).length,
    error: rms(adc.map((v, i) => v - input[i])),
    gain: magnitude(h),
  };
}
