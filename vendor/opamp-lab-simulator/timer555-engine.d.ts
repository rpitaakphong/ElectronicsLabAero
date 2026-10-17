export interface TimerConfig {
  mode: 'astable' | 'monostable';
  r1: number;
  r2: number;
  c: number;
  vcc: number;
}
export interface TimerPart {
  id: string;
  type: string;
  a?: string;
  b?: string;
  value?: number;
  pins?: Record<number, string>;
  startCol?: number;
  aHole?: { row: string; col: number };
  bHole?: { row: string; col: number };
  color?: string;
}
export interface TimerCircuit {
  components: TimerPart[];
  supply: { plus: number; minus: number };
  generator: {
    output: boolean;
    ttl: boolean;
    powered?: boolean;
    groundNode?: string | null;
    ttlNode?: string | null;
    termination?: boolean;
  };
  generatorNode: string | null;
  probes: Record<'ch1' | 'ch2', { tip: string | null; gnd: string | null }>;
  leadHoles?: Record<string, { row: string; col: number }>;
}
export interface TimerPrediction {
  high: number;
  low: number | null;
  period: number | null;
  frequency: number | null;
  duty: number | null;
}
export interface TimerPoint {
  t: number;
  values: Record<string, number>;
  high: boolean;
}
export interface TimerEvent {
  time: number;
  type: 'switch' | 'output';
  id?: string;
  closed?: boolean;
  high?: boolean;
}
export interface TimerRecord {
  traces: { t: number[]; ch1: number[]; ch2: number[]; gen: number[] };
  dt: number;
  window: number;
  frequency: number;
  edgeAware: boolean;
  warnings: string[];
  channelStatus: Record<'ch1' | 'ch2', string | null>;
}
export interface TimerSession {
  cancelButtonEvents(id: string): void;
  advance(target: number): {
    time: number;
    high: boolean;
    values: Record<string, number>;
  };
  setButton(id: string, closed: boolean): void;
  scheduleButton(id: string, closed: boolean, time: number): void;
  record(start: number, end?: number, count?: number): TimerRecord;
  trace(start: number, end?: number, count?: number): TimerPoint[];
  sample(time: number): TimerPoint;
  readonly time: number;
  readonly high: boolean;
  readonly values: Record<string, number>;
  readonly events: TimerEvent[];
  readonly period: number | null;
  readonly steps: number;
  net: {
    r(n: string): string;
    pins: Record<number, string>;
    warnings: string[];
    channelStatus: Record<'ch1' | 'ch2', string | null>;
  };
}
declare global {
  var Timer555Engine: {
    predictions(config: TimerConfig): TimerPrediction;
    canonical(config: TimerConfig): TimerCircuit;
    create(
      state: TimerCircuit,
      options?: { sourceAt?: (time: number, port: string) => number },
    ): TimerSession;
    transition(
      high: boolean,
      input: {
        supply: number;
        reset: number;
        trigger: number;
        threshold: number;
        control: number;
      },
    ): boolean;
  };
}
