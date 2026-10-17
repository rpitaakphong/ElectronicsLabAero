export const INFO = {
  astable: {
    name: 'Astable oscillator',
    description:
      'A repeating output with no external trigger. The capacitor charges through R1 and R2, then discharges through R2 and pin 7. The comparators switch the latch at one-third and two-thirds of the supply.',
    equation: 't_H=\\ln(2)(R_1+R_2)C,\\quad t_L=\\ln(2)R_2C',
    secondEquation:
      'f=\\frac{1}{t_H+t_L},\\qquad D=\\frac{R_1+R_2}{R_1+2R_2}\\times100\\%',
    experiments: [
      'Double C. Predict the new frequency before checking the waveform. What happens to duty cycle?',
      'Increase R2 while keeping R1 fixed. Compare high time and low time. Why does duty cycle approach 50%?',
      'Change the supply from 5 V to 9 V. Compare the threshold voltages, output amplitude, and period.',
    ],
    application:
      'Generate periodic sensor-test pulses for a UAV ground-test rig. Change R1, R2, and C to choose the repetition rate.',
  },
  monostable: {
    name: 'Monostable one-shot',
    description:
      'A low trigger starts one output pulse. The capacitor charges through R until it reaches two-thirds of the supply, then pin 7 discharges it. A held-low trigger overrides the threshold comparator, so its duration matters.',
    equation: 't_P=\\ln(3)RC\\approx1.1RC',
    secondEquation: 'V_C(t)=V_{CC}\\left(1-e^{-t/(RC)}\\right)',
    experiments: [
      'Trigger a pulse, then double R or C and trigger again. Compare the measured width with 1.1RC.',
      'Hold the trigger low longer than the predicted pulse. Release it. Why is this not the same as a brief trigger?',
      'Reset during a pulse. Watch the output go low and the capacitor discharge. Does a second brief trigger during an active pulse restart its timing?',
    ],
    application:
      'Stretch a short sensor event into a visible timed response. A single pulse has a width, but no repeating frequency or duty cycle.',
  },
} as const;
