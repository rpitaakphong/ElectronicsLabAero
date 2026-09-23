import type { RcKind } from './simulator';
export const INFO: Record<
  RcKind,
  {
    name: string;
    description: string;
    equation: string;
    experiments: string[];
    example: { title: string; objective: string; experiments: string[] };
  }
> = {
  lowpass: {
    name: 'Low-pass filter',
    example: {
      title: 'Clean a sensor signal',
      objective:
        'A useful sensor signal is mixed with fast electrical interference. Smooth the measured input while preserving the underlying signal.',
      experiments: [
        'Switch to Clean signal, then restore interference. Which changes in the measured input come from the unwanted tone?',
        'Increase R or C to lower the cutoff. Watch the fast ripple shrink, then notice when the useful signal also becomes weaker and more delayed.',
        'In Advanced signal settings, move the interference frequency onto the useful frequency. Can this filter remove one without affecting the other?',
      ],
    },
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
    example: {
      title: 'Monitor UAV motor vibration',
      objective:
        'Extract motor vibration from a conditioned accelerometer output so an engineer can monitor its amplitude without slow aircraft movement dominating the measurement.',
      experiments: [
        'Choose Long overview to reveal aircraft movement, then Signal detail to inspect the motor vibration. Compare the measured input with the filtered output.',
        'Reduce R or C to raise the cutoff. First reduce slow movement, then observe how a cutoff that is too high weakens useful motor vibration.',
        'Choose Custom waveform and add a DC offset, or open Step response. What does the high-pass filter retain after a steady input settles?',
      ],
    },
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
    example: {
      title: 'Isolate a vibration',
      objective:
        'Preserve a useful vibration between slow baseline drift and fast interference. Tune both stages to isolate the middle frequency region.',
      experiments: [
        'Compare Signal detail and Long overview. Identify the fast ripple and slow drift, then check which remains in the output.',
        'Adjust both RC stages to reduce unwanted frequencies. Narrow the passband too far and observe the useful signal shrinking too.',
        'Add an output load. Compare the useful-frequency gain and each unwanted tone: this unbuffered cascade does not recover the useful signal at full amplitude.',
      ],
    },
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
