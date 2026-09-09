import type { RcKind } from './simulator';
export const INFO: Record<
  RcKind,
  { name: string; description: string; equation: string; experiments: string[] }
> = {
  lowpass: {
    name: 'Low-pass filter',
    description:
      'Take the output across the capacitor. Slow changes pass through; rapid changes are attenuated as the capacitor offers an easier path to the return. Output lags input.',
    equation:
      'H(s)=\\frac{K}{1+s\\tau},\\quad K=\\frac{R\\parallel R_L}{R},\\quad \\tau=(R\\parallel R_L)C',
    experiments: [
      'Double R or C. Predict how the cutoff and charging time change.',
      'Select a square wave well above cutoff. The rounded output approaches an integral of the input.',
      'Connect a load equal to R. Explain both the lower passband gain and the higher cutoff.',
    ],
  },
  highpass: {
    name: 'High-pass filter',
    description:
      'Take the output across the resistor. The capacitor blocks a steady input but passes changes. Output leads input; a step produces a pulse that decays toward zero.',
    equation: 'H(s)=\\frac{s\\tau}{1+s\\tau},\\quad \\tau=(R\\parallel R_L)C',
    experiments: [
      'Switch to step response. What remains after several time constants?',
      'Select a square wave well below cutoff. Short output pulses approximate differentiation.',
      'Add an input offset. Compare the input and output average voltages.',
    ],
  },
  bandpass: {
    name: 'Band-pass filter',
    description:
      'Cascade a high-pass stage and a low-pass stage. Low and high frequencies are attenuated. Because there is no buffer, the second stage loads the first: the complete response differs from multiplying isolated filters.',
    equation: 'H(s)=\\frac{n_1s}{1+a s+b s^2}',
    experiments: [
      'Move the two isolated-stage corner frequencies closer together. Does the peak remain near unity?',
      'Change R2 and C2 inversely to keep their isolated corner fixed. Observe the effect of interstage loading.',
      'Add an output load. Compare the peak gain and the two half-power frequencies.',
    ],
  },
};
