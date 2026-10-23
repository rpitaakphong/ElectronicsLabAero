const math = (label, tex) => ({ label, tex });

// Authored mathematics only. Student responses are always rendered as literal text.
export const EQUATIONS = {
  alias: math(
    'Aliased cosine samples',
    String.raw`\begin{aligned}\cos\!\left(2\pi\frac{900}{1000}k\right)\\=\cos\!\left(2\pi\frac{100}{1000}k\right),\quad k\in\mathbb Z\end{aligned}`,
  ),
  nyquist: math(
    'Nyquist frequency',
    String.raw`f_{\mathrm N}=\frac{f_s}{2}=\frac{1000}{2}\,\mathrm{Hz}=500\,\mathrm{Hz}`,
  ),
  mean: math('Sample mean', String.raw`\bar{x}=\frac{1}{N}\sum_{i=1}^{N}x_i`),
  noiseRMS: math(
    'RMS variation about the mean',
    String.raw`n_{\mathrm{RMS}}=\sqrt{\frac{1}{N}\sum_{i=1}^{N}\left(x_i-\bar{x}\right)^2}`,
  ),
  workedRecord: math(
    'Worked voltage samples',
    String.raw`\{x_i\}=\{1.99,\;2.01,\;1.99,\;2.01\}\,\mathrm V`,
  ),
  workedMean: math(
    'Worked mean and RMS variation',
    String.raw`\bar{x}=2.00\,\mathrm V,\qquad n_{\mathrm{RMS}}=0.010\,\mathrm V`,
  ),
  snr: math(
    'Signal to noise ratio in decibels',
    String.raw`\mathrm{SNR}_{\mathrm{dB}}=20\log_{10}\!\left(\frac{s_{\mathrm{RMS}}}{n_{\mathrm{RMS}}}\right)`,
  ),
  snrExample: math(
    'Worked SNR example',
    String.raw`\mathrm{SNR}_{\mathrm{dB}}=20\log_{10}\!\left(\frac{0.20}{0.020}\right)=20\,\mathrm{dB}`,
  ),
  rcTime: math(
    'Worked RC time constant',
    String.raw`\begin{aligned}\tau&=RC\\&=(20\,000\,\Omega)(1.0\times10^{-6}\,\mathrm F)\\&=0.020\,\mathrm s=20\,\mathrm{ms}\end{aligned}`,
  ),
  rcCutoff: math(
    'Worked RC cutoff frequency',
    String.raw`f_c=\frac{1}{2\pi\tau}=7.96\,\mathrm{Hz}`,
  ),
  rcStep: math(
    'Fraction of a step reached after elapsed time',
    String.raw`\text{Step fraction}=1-e^{-\frac{\Delta t}{\tau}}`,
  ),
  rc90: math(
    'Time to reach ninety percent of a step',
    String.raw`t_{90}\approx2.30\tau\approx46\,\mathrm{ms}`,
  ),
  rcParameters: math(
    'Worked RC component values',
    String.raw`R=20\,\mathrm{k\Omega},\qquad C=1.0\,\mathrm{\mu F}`,
  ),
  rcGain: math(
    'RC sinusoidal amplitude ratio',
    String.raw`\left|H(f)\right|=\frac{1}{\sqrt{1+(2\pi f\tau)^2}}`,
  ),
  rcPhase: math(
    'RC sinusoidal phase shift',
    String.raw`\phi(f)=-\arctan(2\pi f\tau)`,
  ),
  ma: math(
    'Causal moving average',
    String.raw`y[k]=\frac{1}{N}\sum_{i=0}^{N-1}x[k-i]`,
  ),
  ema: math(
    'Exponential moving average',
    String.raw`\begin{aligned}y[k]&=\alpha x[k]\\&\quad+(1-\alpha)y[k-1]\end{aligned}`,
  ),
  maExample: math(
    'Worked five sample moving average',
    String.raw`y[k]=\frac{2+2+2+2+6}{5}\,\mathrm V=2.8\,\mathrm V`,
  ),
  emaExample: math(
    'Worked EMA sample updates',
    String.raw`\begin{aligned}\alpha&=0.25\\y[k]&=0.25(6)+0.75(2)\\&=3\,\mathrm V\\y[k+1]&=0.25(6)+0.75(3)\\&=3.75\,\mathrm V\end{aligned}`,
  ),
  handRate: math(
    'Hand calculation sampling rate',
    String.raw`f_s=100\,\mathrm{samples/s}`,
  ),
  handSamples: math(
    'Assigned input samples',
    String.raw`\begin{aligned}x[0]&=4\,\mathrm V\\x[1]&=7\,\mathrm V\\x[2]&=10\,\mathrm V\end{aligned}`,
  ),
  handMA: math(
    'Assigned moving average window and prehistory',
    String.raw`\begin{aligned}N&=3\\x[-2]&=x[-1]=4\,\mathrm V\end{aligned}`,
  ),
  handEMA: math(
    'Assigned EMA coefficient and initial output',
    String.raw`\alpha=0.40,\qquad y[-1]=4\,\mathrm V`,
  ),
  handOutputs: math(
    'Outputs to calculate independently',
    String.raw`y[0],\quad y[1],\quad y[2]`,
  ),
  comparisonRC: math(
    'Shared RC setting',
    String.raw`\mathrm{RC}:\quad\tau=20\,\mathrm{ms}`,
  ),
  comparisonMA: math(
    'Shared moving average setting',
    String.raw`\mathrm{MA}:\quad N=41`,
  ),
  comparisonEMA: math(
    'Shared EMA setting',
    String.raw`\mathrm{EMA}:\quad\alpha=\frac{1}{21}`,
  ),
  comparisonNoise: math(
    'Worked noise requirement',
    String.raw`n_{\mathrm{RMS}}\le0.015\,\mathrm V`,
  ),
  comparisonPulse: math(
    'Worked pulse height requirement',
    String.raw`\frac{A_{\mathrm{out}}}{A_{\mathrm{true}}}\ge80\%`,
  ),
  maDelay: math(
    'Moving average low frequency delay',
    String.raw`t_{\mathrm{MA}}=\frac{N-1}{2f_s}=20\,\mathrm{ms}`,
  ),
  emaDelay: math(
    'EMA low frequency delay',
    String.raw`t_{\mathrm{EMA}}=\frac{1-\alpha}{\alpha f_s}=20\,\mathrm{ms}`,
  ),
  rcExerciseA: math(
    'RC candidate A',
    String.raw`\mathrm A:\quad R=10\,\mathrm{k\Omega},\quad C=1\,\mathrm{\mu F}`,
  ),
  rcExerciseB: math(
    'RC candidate B',
    String.raw`\mathrm B:\quad R=10\,\mathrm{k\Omega},\quad C=3\,\mathrm{\mu F}`,
  ),
  emaExerciseA: math('EMA candidate A', String.raw`\mathrm A:\quad\alpha=0.20`),
  emaExerciseB: math('EMA candidate B', String.raw`\mathrm B:\quad\alpha=0.04`),
  sharedNoise: math(
    'Shared simulated two tone disturbance',
    String.raw`\begin{aligned}\frac{n(t)}{\mathrm V}={}&0.100\sin(2\pi\cdot65t)\\&+0.060\sin(2\pi\cdot110t+0.7)\end{aligned}`,
  ),
  transferNoise: math(
    'Independent transfer case disturbance',
    String.raw`\begin{aligned}\frac{n(t)}{\mathrm V}={}&0.08\sin(2\pi\cdot90t)\\&+0.04\sin(2\pi\cdot160t+0.3)\end{aligned}`,
  ),
  transferNoiseLimit: math(
    'Transfer case noise requirement',
    String.raw`n_{\mathrm{RMS}}\le0.020\,\mathrm V`,
  ),
  transferDelayLimit: math(
    'Transfer case step response requirement',
    String.raw`t_{90}\le20\,\mathrm{ms}`,
  ),
  transferPulseLimit: math(
    'Transfer case pulse height requirement',
    String.raw`\begin{aligned}\frac{A_{\mathrm{out}}}{A_{\mathrm{true}}}&\ge90\%\\A_{\mathrm{true}}&=0.4\,\mathrm V\end{aligned}`,
  ),
  choiceA: math(
    'Transfer candidate A EMA setting',
    String.raw`\mathrm A:\quad\mathrm{EMA},\quad\alpha=0.20`,
  ),
  choiceB: math(
    'Transfer candidate B EMA setting',
    String.raw`\mathrm B:\quad\mathrm{EMA},\quad\alpha=0.04`,
  ),
  choiceC: math(
    'Transfer candidate C moving average setting',
    String.raw`\mathrm C:\quad\mathrm{MA},\quad N=11`,
  ),
  diagramMA: math(
    'Equal weights in the three sample diagram',
    String.raw`N=3,\qquad w_i=\frac{1}{3}`,
  ),
};
