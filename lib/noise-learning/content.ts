export const LESSONS = [
  {
    id: 'signal',
    title: 'Signal and noise',
    short: 'Find the useful signal',
    description:
      'A measurement can contain a useful change, a steady baseline and unwanted variation. Reveal each layer, then decide which changes matter.',
    try: 'Keep the useful signal fixed. Compare random noise, periodic interference and slow drift. Could the slow drift be useful for a different task?',
    explanation:
      'Noise depends on the measurement goal. A filter cannot recognise meaning: useful and unwanted changes that occupy the same frequencies are difficult to separate.',
    equations: [
      [
        'x(t)=b+s(t)+n(t)',
        'Measured signal equals baseline plus useful signal plus disturbance',
      ],
      [
        'n_{\\mathrm{RMS}}=\\sqrt{\\frac{1}{M}\\sum_{k=0}^{M-1}(n_k-\\bar n)^2}',
        'Mean-removed RMS variation',
      ],
    ],
    note: 'Random noise here is a repeatable sum of 32 random-phase tones from 8 to 190 Hz. Periodic interference is a single tone; drift is a slow 0.6 Hz tone. The displayed RMS is measured over the stated window.',
  },
  {
    id: 'families',
    title: 'What filters do',
    short: 'Explore frequency selection',
    description:
      'Low-pass, high-pass, band-pass and notch describe which frequencies are retained or reduced. Sweep one tone through the response to hear the idea with your eyes.',
    try: 'Place the input tone below, near and above the corner or centre frequency. Which family would retain a slow trend? Which would reject one interfering tone?',
    explanation:
      'A real response has a transition region. Moving a boundary changes the useful components as well as the unwanted ones. “Cutoff” does not mean everything above it disappears.',
    equations: [
      [
        '|H(f)|=\\frac{A_{\\mathrm{out}}(f)}{A_{\\mathrm{in}}(f)}',
        'Amplitude response is output amplitude divided by input amplitude',
      ],
    ],
    note: 'These illustrations show magnitude only. Low/high-pass use first-order responses; band-pass combines buffered first-order high/low-pass stages; the second-order notch has quality factor 3. No physical component network is implied for the latter two.',
  },
  {
    id: 'rc',
    title: 'Analog RC low-pass',
    short: 'Watch a capacitor respond',
    description:
      'A series resistor and capacitor to ground make the capacitor voltage respond gradually. Increase resistance or capacitance and inspect both smoothing and response time.',
    try: 'Choose Step and double the capacitance. Then choose Pulse and shorten its width. Watch the peak and the time needed to reach the new level.',
    explanation:
      'Larger resistance or capacitance increases the time constant and lowers the cutoff. A short event may finish before the capacitor reaches its full height. The actual output keeps its attenuation and delay.',
    equations: [
      [
        '\\tau=RC,\\qquad f_c=\\frac{1}{2\\pi RC}',
        'RC time constant and cutoff frequency',
      ],
      [
        '\\tau\\frac{dv_{\\mathrm{out}}}{dt}+v_{\\mathrm{out}}=v_{\\mathrm{in}}',
        'Ideal first-order RC differential equation',
      ],
      [
        'v_{\\mathrm{out}}(t)=V_0+\\Delta V\\left(1-e^{-t/\\tau}\\right),\\quad t\\ge0',
        'Capacitor response after a step',
      ],
      [
        '|H(f)|=\\frac{1}{\\sqrt{1+(f/f_c)^2}}',
        'RC low-pass amplitude response',
      ],
    ],
    note: 'Ideal voltage source, unloaded output and ideal components. Periodic components are settled before the record; steps and pulses begin at 0.5 s. Time in the step equation is elapsed time since the input edge. RC is evaluated as a continuous-time filter and sampled only for plotting.',
  },
  {
    id: 'ma',
    title: 'Moving average',
    short: 'Slide a window across samples',
    description:
      'A trailing moving average gives equal weight to the newest sample and a fixed number of earlier samples. Advance the cursor to see a sample enter and an old sample leave.',
    try: 'Compare a short and a long window on the same pulse. Then change sampling rate: the same number of samples now covers a different amount of time.',
    explanation:
      'Longer windows often reduce variation but spread a change over more samples. Their frequency response has dips and lobes; increasing the window does not guarantee better rejection at every particular frequency.',
    equations: [
      [
        'y[k]=\\frac{1}{N}\\sum_{i=0}^{N-1}x[k-i]',
        'Trailing N-sample moving average',
      ],
      [
        'T_w=\\frac{N}{f_s},\\qquad d=\\frac{N-1}{2f_s}',
        'Window duration and moving-average group delay',
      ],
    ],
    note: 'The window is causal: it uses current and past samples. Samples before the visible record come from the same settled synthetic signal, avoiding artificial startup zeros. Nominal averaging duration counts N sampling intervals; the timestamps of the first and last samples span one fewer interval. Group delay is not the same as the time to reach a step threshold.',
  },
  {
    id: 'ema',
    title: 'Exponential moving average',
    short: 'Balance new input and memory',
    description:
      'Each output combines the newest sample with the previous output. The coefficient controls how much new information replaces the accumulated history.',
    try: 'Move the coefficient close to 1, then close to 0. Compare the newest-sample contribution, the step response and the pulse height.',
    explanation:
      'A larger coefficient follows the newest samples more closely. A smaller coefficient gives history more weight and usually produces a slower, smoother response. Sampling rate also changes the time represented by each update.',
    equations: [
      [
        'y[k]=\\alpha x[k]+(1-\\alpha)y[k-1],\\quad 0<\\alpha\\le1',
        'Exponential moving-average recurrence',
      ],
      [
        'w_i=\\alpha(1-\\alpha)^i',
        'Exponentially decaying weights on past samples',
      ],
      [
        'd_{\\mathrm{low\\ frequency}}\\approx\\frac{1-\\alpha}{\\alpha f_s}',
        'EMA delay near zero frequency',
      ],
    ],
    note: 'The comparison uses the exact settled response to the synthetic periodic components. Step/pulse history begins at the baseline. The highlighted update uses the actual previous output, not a fresh initial value.',
  },
  {
    id: 'sampling',
    title: 'Sampling and limitations',
    short: 'See what the ADC keeps',
    description:
      'The ADC observes selected instants and rounds voltage to available levels. Explore sample spacing, ambiguous frequencies, quantization and clipping.',
    try: 'Set the source to 60 Hz and sampling to 80 samples/s. Inspect the lower-frequency pattern. Switch the analog filter on, then the digital EMA, and compare where each acts.',
    explanation:
      'Different continuous frequencies can produce the same sampled sequence. A filter before sampling can attenuate out-of-band content. After sampling, a digital smoother cannot generally identify which source frequency created an alias. Clipping also loses information.',
    equations: [
      [
        't_k=\\frac{k}{f_s},\\qquad f_{\\mathrm{Nyquist}}=\\frac{f_s}{2}',
        'Sample instants and Nyquist frequency',
      ],
      [
        'f_a=|f-m f_s|,\\qquad m=\\operatorname{round}(f/f_s)',
        'Tone frequency folded into the first Nyquist zone',
      ],
      [
        '\\Delta V=\\frac{V_{\\mathrm{ref}}}{2^B-1}',
        'Quantizer level spacing for the displayed endpoint-inclusive model',
      ],
    ],
    note: 'A 3.3 V, endpoint-inclusive ideal quantizer is used here. Its error includes clipping when present. Optional analog RC uses a 20 ms time constant; optional digital EMA uses coefficient 0.20 and starts at the baseline. One RC stage has gradual attenuation and does not certify anti-alias protection.',
  },
  {
    id: 'compare',
    title: 'Compare and choose',
    short: 'Keep the information you need',
    description:
      'Put the same synthetic input through RC, moving average and exponential averaging. Judge noise reduction alongside response time, event height and useful-signal attenuation.',
    try: 'Find settings that make the steady trace smooth. Keep those settings and switch to a short pulse. Then try a sine: does the useful signal survive?',
    explanation:
      'The preferred filter depends on the event or bandwidth you need. A smooth output can hide a brief event, arrive too late or attenuate the useful sine. There is no universal winning setting.',
    equations: [
      [
        '\\mathrm{SNR}_{\\mathrm{dB}}=20\\log_{10}\\left(\\frac{s_{\\mathrm{RMS}}}{n_{\\mathrm{RMS}}}\\right)',
        'Signal-to-noise ratio in decibels',
      ],
    ],
    note: 'These synthetic signal and disturbance components are known and filtered separately before RMS/SNR calculation. DC is excluded. SNR is shown only for the sine scenario; it is not inferred by subtracting a delayed output from an unfiltered reference. Harmonic distortion is distinct from noise-only SNR.',
  },
] as const;
export type Lesson = (typeof LESSONS)[number]['id'];

/** Visible symbol key; equations remain readable without prior course material. */
export const SYMBOLS: Record<Lesson, readonly (readonly [string, string])[]> = {
  signal: [
    ['x', 'Measured voltage'],
    ['b', 'Steady baseline'],
    ['s', 'Useful component'],
    ['n', 'Disturbance'],
    ['M', 'Samples in the analysis window'],
  ],
  families: [
    ['H', 'Filter response'],
    ['f', 'Frequency in hertz'],
    ['A', 'Sine-wave amplitude'],
  ],
  rc: [
    ['R', 'Resistance in ohms'],
    ['C', 'Capacitance in farads'],
    ['\\tau', 'Time constant in seconds'],
    ['f_c', 'Cutoff frequency in hertz'],
    ['V_0', 'Initial voltage'],
    ['\\Delta V', 'Size of the input step'],
  ],
  ma: [
    ['x[k]', 'Current input sample'],
    ['y[k]', 'Current output sample'],
    ['N', 'Number of equally weighted samples'],
    ['f_s', 'Samples per second'],
    ['d', 'Group delay in seconds'],
  ],
  ema: [
    ['x[k]', 'Newest input sample'],
    ['y[k-1]', 'Previous output'],
    ['\\alpha', 'Weight given to the newest sample'],
    ['w_i', 'Weight on an input from i updates ago'],
    ['f_s', 'Samples per second'],
  ],
  sampling: [
    ['f_s', 'Sampling rate'],
    ['f', 'Continuous source frequency'],
    ['f_a', 'Folded tone frequency'],
    ['B', 'ADC resolution in bits'],
    ['V_{\\mathrm{ref}}', 'Full-scale reference voltage'],
  ],
  compare: [
    ['s_{\\mathrm{RMS}}', 'RMS of the useful sine after filtering'],
    [
      'n_{\\mathrm{RMS}}',
      'Mean-removed RMS of the disturbance after filtering',
    ],
    ['\\mathrm{dB}', 'Decibels: a logarithmic ratio'],
  ],
};
