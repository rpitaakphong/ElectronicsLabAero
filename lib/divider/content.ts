import type { Configuration } from './simulator';
export const INFO: Record<
  Configuration,
  {
    name: string;
    description: string;
    use: string;
    experiments: { title: string; steps: string; explanation: string }[];
  }
> = {
  basic: {
    name: 'Basic divider',
    description:
      'Two resistors share the supply voltage. Measure the output across the lower resistor: its share of the total resistance sets the output voltage.',
    use: 'Create a reference voltage or scale a signal for a high-impedance input.',
    experiments: [
      {
        title: 'Split the supply in half',
        steps:
          'Set Vin to 5 V and both resistors to 10 kΩ. Predict Vout, then change R2 to 20 kΩ.',
        explanation:
          'Equal resistors give 2.5 V. With R2 = 20 kΩ, the lower resistor receives two thirds of the supply: about 3.333 V.',
      },
      {
        title: 'Same ratio, different current',
        steps: 'At 5 V, compare R1 = R2 = 10 kΩ with R1 = R2 = 100 kΩ.',
        explanation:
          'Vout stays at 2.5 V, but source current falls from 250 µA to 25 µA. Total resistor power also falls by a factor of ten.',
      },
    ],
  },
  loaded: {
    name: 'Loaded divider',
    description:
      'A connected load draws current from the output. It sits in parallel with R2, reducing the effective lower resistance and the output voltage.',
    use: 'Explore why a voltage divider changes when connected to another circuit.',
    experiments: [
      {
        title: 'Connect a matching load',
        steps:
          'Set Vin to 5 V and R1, R2, and RL to 10 kΩ. Compare loaded and unloaded output.',
        explanation:
          'R2 ∥ RL is 5 kΩ. Output drops from 2.5 V to about 1.667 V: a 33.33% reduction. Current splits equally between R2 and RL.',
      },
      {
        title: 'Make loading smaller',
        steps:
          'Keep Vin = 5 V and R1 = R2 = 10 kΩ. Increase RL from 10 kΩ to 1 MΩ.',
        explanation:
          'A larger load resistance draws less current. At 1 MΩ the output is about 2.488 V, approaching the unloaded 2.5 V.',
      },
    ],
  },
  potentiometer: {
    name: 'Potentiometer',
    description:
      'The wiper splits one resistive track into upper and lower segments. Moving it changes the division ratio; a load bends the otherwise straight response.',
    use: 'Explore adjustable references and position sensing.',
    experiments: [
      {
        title: 'Travel from ground to supply',
        steps:
          'Use 5 V and a 10 kΩ track with the load disconnected. Try 0%, 50%, and 100% wiper positions.',
        explanation:
          'The output is 0 V, 2.5 V, and 5 V. The endpoints connect directly to ground and the ideal supply.',
      },
      {
        title: 'Load the wiper',
        steps:
          'At 5 V, set the track and RL to 10 kΩ and position to 50%. Connect the load, then move the wiper.',
        explanation:
          'The two segments are 5 kΩ each. Loading reduces the midpoint to 2 V and makes the response nonlinear. The endpoints remain 0 V and 5 V.',
      },
    ],
  },
  sensor: {
    name: 'Sensor divider',
    description:
      'A variable-resistance sensor and a fixed resistor turn resistance into voltage. Swapping their positions reverses the direction of the response.',
    use: 'Understand the resistance-to-voltage principle behind many sensor interfaces. Resistance is adjusted directly here; no particular sensor is assumed.',
    experiments: [
      {
        title: 'Increase the sensor resistance',
        steps:
          'Use 5 V, a 10 kΩ fixed resistor, and the sensor below the output. Increase the sensor from 10 kΩ to 100 kΩ.',
        explanation:
          'Output rises from 2.5 V to about 4.545 V. The sensor takes a larger share of the supply voltage.',
      },
      {
        title: 'Reverse the response',
        steps:
          'Keep the same values and move the sensor above the output. Compare the curve and current point.',
        explanation:
          'Output becomes about 0.455 V. Increasing an upper sensor resistance reduces output. At the same resistance, the two arrangements’ outputs add to Vin.',
      },
    ],
  },
};
