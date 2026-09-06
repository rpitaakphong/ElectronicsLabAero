import { validateConfig, type Config, type Simulation } from './simulator';
export interface LabTool {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown | Promise<unknown>;
}
export interface LabContext {
  registerTool: (
    tool: LabTool,
    options?: { signal?: AbortSignal },
  ) => void | Promise<void>;
}
const sourceSchema = {
  type: 'object',
  properties: {
    waveform: { type: 'string', enum: ['sine', 'square', 'triangle'] },
    amplitude: { type: 'number', minimum: 0, maximum: 10 },
    frequency: { type: 'number', minimum: 1, maximum: 1e6 },
    offset: { type: 'number', minimum: -10, maximum: 10 },
    phase: { type: 'number', minimum: -180, maximum: 180 },
  },
  required: ['waveform', 'amplitude', 'frequency', 'offset', 'phase'],
  additionalProperties: false,
};
export const CONFIG_SCHEMA = {
  type: 'object',
  properties: {
    circuit: {
      type: 'string',
      enum: [
        'inverting',
        'noninverting',
        'buffer',
        'summing',
        'lowpass',
        'comparator',
      ],
    },
    source: sourceSchema,
    second: sourceSchema,
    components: {
      type: 'object',
      properties: {
        rin: { type: 'number', minimum: 1000, maximum: 100000 },
        rf: { type: 'number', minimum: 1000, maximum: 100000 },
        rg: { type: 'number', minimum: 1000, maximum: 100000 },
        r2: { type: 'number', minimum: 1000, maximum: 100000 },
        capacitance: { type: 'number', minimum: 1e-10, maximum: 1e-5 },
        reference: { type: 'number', minimum: -10, maximum: 10 },
        outputLow: { type: 'number', minimum: -15, maximum: 15 },
        outputHigh: { type: 'number', minimum: -15, maximum: 15 },
      },
      required: [
        'rin',
        'rf',
        'rg',
        'r2',
        'capacitance',
        'reference',
        'outputLow',
        'outputHigh',
      ],
      additionalProperties: false,
    },
  },
  required: ['circuit', 'source', 'second', 'components'],
  additionalProperties: false,
};
export function createLabTools(
  read: () => { config: Config; result: Simulation },
  configure: (config: Config) => void,
): LabTool[] {
  const summary = () => {
    const s = read();
    return {
      config: s.config,
      metrics: s.result.metrics,
    };
  };
  return [
    {
      name: 'read_opamp_experiment',
      title: 'Read op-amp experiment',
      description:
        'Read the visible circuit configuration (SI units) and calculated waveform metrics.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: () => summary(),
    },
    {
      name: 'configure_opamp_experiment',
      title: 'Configure op-amp experiment',
      description:
        'Replace the visible experiment with a complete configuration. Read the current experiment first. Units: V, Hz, ohms, farads, and degrees. Updates the same controls, schematic, equation, and scope as the user interface.',
      inputSchema: CONFIG_SCHEMA,
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => {
        const config = validateConfig(input);
        configure(config);
        return summary();
      },
    },
  ];
}
