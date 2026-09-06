import { engineering as eng, type Circuit, type Config } from './simulator';
export const CIRCUIT_INFO: Record<
  Circuit,
  {
    name: string;
    short: string;
    tag: string;
    description: string;
    use: string;
    input: string;
  }
> = {
  inverting: {
    name: 'Inverting amplifier',
    short: 'Inverting',
    tag: 'Amplify & invert',
    description:
      'The signal enters through a resistor connected to the − input. The output moves in the opposite direction: a positive input produces a negative output, and vice versa. The ratio between Rf and Rin sets how much larger or smaller the output becomes.',
    use: 'Use it when you need to flip a signal and control its size, or prepare it to be combined with other signals.',
    input:
      'The source sees approximately Rin. Current flows through Rin and Rf, while almost none enters the op-amp input.',
  },
  noninverting: {
    name: 'Non-inverting amplifier',
    short: 'Non-inverting',
    tag: 'Amplify & preserve',
    description:
      'The signal enters the + input, so the output moves in the same direction. A positive input produces a positive output, and the feedback resistors decide how much larger it becomes.',
    use: 'Use it to make a sensor, audio, or other voltage signal larger without flipping the waveform upside down.',
    input:
      'Very high input impedance. The signal enters the + input directly, so the source supplies almost no input current.',
  },
  buffer: {
    name: 'Voltage follower',
    short: 'Buffer',
    tag: 'Follow & isolate',
    description:
      'Think of a buffer as a helper that copies a message and delivers it for you. The output voltage is the same as the input, so the two traces sit directly on top of each other. The op-amp supplies the current needed by the next circuit, allowing a delicate sensor to keep its original voltage.',
    use: 'Use it between a sensor or delicate signal source and a circuit that needs more current.',
    input:
      'Very high input impedance and low output impedance. Load-current limits are outside this model; the ideal trace demonstrates voltage following.',
  },
  summing: {
    name: 'Summing amplifier',
    short: 'Summing',
    tag: 'Combine & weight',
    description:
      'Two signals enter through separate resistors, and the op-amp combines them into one output. Each input resistor controls how strongly its signal affects the result. The combined output is flipped, and opposite signals can partly or completely cancel each other.',
    use: 'Use it to mix audio, combine sensor or control voltages, or add and cancel signals.',
    input:
      'Input 1 sees approximately Rin; input 2 sees approximately R₂. Matching resistors give matching weights.',
  },
  lowpass: {
    name: 'Inverting low-pass filter',
    short: 'Low-pass',
    tag: 'Filter & smooth',
    description:
      'The resistor and capacitor let slow signal changes pass while reducing fast changes. Above the cutoff frequency, the output becomes smaller and sharp corners become rounded. The circuit also flips the output upside down.',
    use: 'Use it to smooth a noisy signal or remove unwanted high-frequency detail before measuring or processing it.',
    input:
      'The source sees approximately Rin. Rf sets the low-frequency gain; Rf and C together set the cutoff frequency.',
  },
  comparator: {
    name: 'Comparator',
    short: 'Comparator',
    tag: 'Compare & switch',
    description:
      'With no feedback path, the op-amp acts like a yes-or-no switch. When the input rises above the reference voltage, the output jumps HIGH; when it falls below, the output jumps LOW. If the input repeatedly crosses the reference, the output looks like a square wave with flat tops.',
    use: 'Use it to detect when a signal passes a chosen voltage, such as switching an alarm or digital input on and off. For real circuits, a dedicated comparator chip is usually the better choice.',
    input:
      'The two inputs compare voltages. There is no resistor-set linear gain and no virtual short between + and −.',
  },
};
export interface MathLine {
  tex: string;
  label: string;
}
export interface CircuitEquation {
  symbolic: MathLine[];
  numeric: MathLine[];
  supporting?: MathLine[];
  note: string;
}

const number = (v: number) => Number(v.toPrecision(4)).toString();
/** The UI controls provide finite, validated values; units here are fixed. */
function quantity(v: number, unit: 'V' | 'Hz') {
  const formatted = eng(v, unit);
  const [magnitude, prefixedUnit] = formatted.split(' ');
  const units = prefixedUnit.replace('µ', '\\mu ');
  return `${magnitude}\\,\\mathrm{${units}}`;
}
const resistor = (v: number) => `${number(v / 1000)}\\,\\mathrm{k}\\Omega`;

export function equation(c: Config): CircuitEquation {
  const p = c.components,
    ratio = p.rf / p.rin,
    n = 1 + p.rf / p.rg,
    offset = eng(p.reference, 'V');
  if (c.circuit === 'buffer')
    return {
      symbolic: [
        {
          tex: String.raw`V_{\mathrm{out}} = V_{\mathrm{in}}`,
          label: 'Output voltage equals input voltage',
        },
      ],
      numeric: [
        {
          tex: String.raw`A_v = +1\,\mathrm{V/V}`,
          label: 'Voltage gain = +1 V/V',
        },
      ],
      note: 'The feedback wire connects output directly to the − input.',
    };
  if (c.circuit === 'comparator')
    return {
      symbolic: [
        {
          tex: String.raw`V_{\mathrm{out}} = \begin{cases} V_{\mathrm{H}}, & V_{\mathrm{in}} \geq V_{\mathrm{ref}} \\ V_{\mathrm{L}}, & V_{\mathrm{in}} < V_{\mathrm{ref}} \end{cases}`,
          label:
            'Output is high when input is at or above the reference, and low otherwise',
        },
      ],
      numeric: [
        {
          tex: String.raw`V_{\mathrm{ref}} = ${quantity(p.reference, 'V')}`,
          label: `Threshold = ${offset}`,
        },
        {
          tex: String.raw`V_{\mathrm{H}} = ${quantity(p.outputHigh, 'V')},\quad V_{\mathrm{L}} = ${quantity(p.outputLow, 'V')}`,
          label: `High output = ${eng(p.outputHigh, 'V')}, low output = ${eng(p.outputLow, 'V')}`,
        },
      ],
      note: 'The output switches instantly between the selected HIGH and LOW levels.',
    };
  if (c.circuit === 'noninverting')
    return {
      symbolic: [
        {
          tex: String.raw`V_{\mathrm{out}} = V_{\mathrm{ref}} + A_v\left(V_{\mathrm{in}}-V_{\mathrm{ref}}\right)`,
          label:
            'Output voltage equals reference plus gain times the difference between input and reference',
        },
        {
          tex: String.raw`A_v = 1 + \frac{R_f}{R_g}`,
          label:
            'Non-inverting gain equals one plus feedback resistance divided by divider resistance',
        },
      ],
      numeric: [
        {
          tex: String.raw`A_v = 1 + \frac{${resistor(p.rf)}}{${resistor(p.rg)}} = +${number(n)}\,\mathrm{V/V}`,
          label: `Gain = 1 + ${eng(p.rf, 'Ω')} / ${eng(p.rg, 'Ω')} = +${number(n)} V/V`,
        },
      ],
      note: `The input’s difference from ${offset} is multiplied by ${number(n)}.`,
    };
  if (c.circuit === 'summing')
    return {
      symbolic: [
        {
          tex: String.raw`V_{\mathrm{out}} = V_{\mathrm{ref}} - \frac{R_f}{R_{\mathrm{in}}}\left(V_1-V_{\mathrm{ref}}\right) - \frac{R_f}{R_2}\left(V_2-V_{\mathrm{ref}}\right)`,
          label:
            'Output equals reference minus the weighted differences of both inputs from reference',
        },
      ],
      numeric: [
        {
          tex: String.raw`A_1 = -\frac{${resistor(p.rf)}}{${resistor(p.rin)}} = -${number(ratio)}`,
          label: `Input 1 weight = −${number(ratio)} V/V`,
        },
        {
          tex: String.raw`A_2 = -\frac{${resistor(p.rf)}}{${resistor(p.r2)}} = -${number(p.rf / p.r2)}`,
          label: `Input 2 weight = −${number(p.rf / p.r2)} V/V`,
        },
      ],
      note: 'The dimensionless weights act on each input’s difference from the reference.',
    };
  if (c.circuit === 'lowpass') {
    const cutoff = 1 / (2 * Math.PI * p.rf * p.capacitance);
    return {
      symbolic: [
        {
          tex: String.raw`A_0 = -\frac{R_f}{R_{\mathrm{in}}}`,
          label:
            'Low-frequency gain equals minus feedback resistance divided by input resistance',
        },
        {
          tex: String.raw`f_c = \frac{1}{2\pi R_f C}`,
          label:
            'Cutoff frequency equals one divided by two pi times feedback resistance times capacitance',
        },
      ],
      numeric: [
        {
          tex: String.raw`A_0 = -${number(ratio)}\,\mathrm{V/V}`,
          label: `DC gain = −${number(ratio)} V/V`,
        },
        {
          tex: String.raw`f_c = ${quantity(cutoff, 'Hz')}`,
          label: `Cutoff = ${eng(cutoff, 'Hz')}`,
        },
      ],
      supporting: [
        {
          tex: String.raw`\left|A_v(f)\right| = \frac{\left|A_0\right|}{\sqrt{1+\left(\frac{f}{f_c}\right)^2}}`,
          label:
            'Sine-wave gain magnitude equals the magnitude of DC gain divided by the square root of one plus frequency over cutoff squared',
        },
        {
          tex: String.raw`V_{\mathrm{out,DC}} = V_{\mathrm{ref}} + A_0\left(V_{\mathrm{in,DC}}-V_{\mathrm{ref}}\right)`,
          label:
            'DC output equals reference plus DC gain times the input DC offset relative to reference',
        },
      ],
      note: 'The capacitor reduces sine-wave gain as frequency increases. DC offsets follow the second relationship.',
    };
  }
  return {
    symbolic: [
      {
        tex: String.raw`V_{\mathrm{out}} = V_{\mathrm{ref}} - \frac{R_f}{R_{\mathrm{in}}}\left(V_{\mathrm{in}}-V_{\mathrm{ref}}\right)`,
        label:
          'Output voltage equals reference minus feedback resistance over input resistance times the difference between input and reference',
      },
    ],
    numeric: [
      {
        tex: String.raw`A_v = -\frac{${resistor(p.rf)}}{${resistor(p.rin)}} = -${number(ratio)}\,\mathrm{V/V}`,
        label: `Gain = −${eng(p.rf, 'Ω')} / ${eng(p.rin, 'Ω')} = −${number(ratio)} V/V`,
      },
    ],
    note: `The output moves in the opposite direction around the ${offset} reference.`,
  };
}
