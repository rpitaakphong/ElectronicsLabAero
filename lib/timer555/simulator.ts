import '../../vendor/opamp-lab-simulator/engine.js';
import '../../vendor/opamp-lab-simulator/timer555-engine.js';
import type {
  TimerConfig,
  TimerSession,
  TimerPrediction,
} from '../../vendor/opamp-lab-simulator/timer555-engine';
export type { TimerConfig, TimerSession, TimerPrediction };
export const timer555 = globalThis.Timer555Engine;
export const defaults = (
  mode: TimerConfig['mode'] = 'astable',
): TimerConfig => ({
  mode,
  r1: mode === 'astable' ? 1000 : 100000,
  r2: 10000,
  c: mode === 'astable' ? 1e-6 : 10e-6,
  vcc: 5,
});
export function validate(config: TimerConfig): TimerConfig {
  if (
    !['astable', 'monostable'].includes(config.mode) ||
    !Number.isFinite(config.vcc) ||
    config.vcc < 5 ||
    config.vcc > 15 ||
    ![config.r1, config.r2].every(
      (v) => Number.isFinite(v) && v >= 1000 && v <= 1e6,
    ) ||
    !Number.isFinite(config.c) ||
    config.c < 1e-9 ||
    config.c > 100e-6
  )
    throw new Error(
      'Use 1 kΩ–1 MΩ resistors, 1 nF–100 µF timing capacitors, and a 5–15 V supply.',
    );
  return { ...config };
}
export const createSession = (config: TimerConfig) =>
  timer555.create(timer555.canonical(validate(config)));
export function engineering(value: number | null, unit = ''): string {
  if (value === null || !Number.isFinite(value)) return '—';
  const magnitude = Math.abs(value);
  const [scale, prefix] = (
    [
      [1e6, 'M'],
      [1e3, 'k'],
      [1, ''],
      [1e-3, 'm'],
      [1e-6, 'µ'],
      [1e-9, 'n'],
    ] as const
  ).find(([s]) => magnitude >= s) ?? [1, ''];
  return `${Number((value / scale).toPrecision(4))} ${prefix}${unit}`.trim();
}
export function measuredTiming(session: TimerSession) {
  const events = session.events.filter((event) => event.type === 'output');
  const high = events.flatMap((event, i) =>
    event.high && events[i + 1]?.high === false
      ? [events[i + 1].time - event.time]
      : [],
  );
  const rises = events.filter((event) => event.high).map((event) => event.time);
  const period = rises.length >= 3 ? rises.at(-1)! - rises.at(-2)! : null;
  const width = high.at(-1) ?? null;
  return {
    high: width,
    period,
    frequency: period ? 1 / period : null,
    duty: period && width ? (100 * width) / period : null,
  };
}
