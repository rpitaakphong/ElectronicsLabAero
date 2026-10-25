import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, SkipForward, Shuffle } from 'lucide-react';
import { Field } from '@/components/lab/controls';
import { Button } from '@/components/ui/button';
import { MathExpression } from '@/components/lab/math-expression';
import {
  EmaDrawing,
  FamilyDrawing,
  LearningPlot,
  RcDrawing,
  WindowDrawing,
  type Series,
} from '@/components/noise/visuals';
import {
  COLORS,
  DURATION,
  LABELS,
  METHODS,
  defaults,
  magnitude,
  response,
  sampleDemo,
  simulate,
  rawAt,
  rms,
  type SamplingSettings,
  type Result,
  type Family,
  type Method,
  type Noise,
  type Settings,
  type Wave,
} from '@/lib/noise-learning/model';
import { LESSONS, SYMBOLS, type Lesson } from '@/lib/noise-learning/content';
import { TopicBreadcrumbs } from './TopicBreadcrumbs';
const initial = (id: Lesson): Settings => ({
  ...defaults(),
  wave:
    id === 'signal'
      ? 'steady'
      : id === 'rc'
        ? 'step'
        : id === 'ema'
          ? 'step'
          : 'pulse',
  noise: id === 'rc' ? 'periodic' : 'random',
});
const fmt = (n: number, digits = 3) => Number(n.toPrecision(digits)).toString();
function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="nf-select">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}
const samplingDefaults = (): SamplingSettings => ({
  frequency: 60,
  rate: 80,
  bits: 6,
  amplitude: 1,
  analog: false,
  digital: false,
});
function Sampling({
  s,
  set,
}: {
  s: SamplingSettings;
  set: (s: SamplingSettings) => void;
}) {
  const result = useMemo(() => sampleDemo(s), [s]);
  const points: Series[] = [
    { name: 'ADC samples', color: COLORS.ma, values: result.adc, dots: true },
  ];
  if (s.digital)
    points.push({
      name: 'EMA after ADC',
      color: COLORS.ema,
      values: result.digital,
    });
  return (
    <div className="nf-workbench">
      <div className="nf-results">
        <div className="nf-chain" aria-label="Signal processing order">
          <span>Continuous source</span>
          <b>→</b>
          <span className={s.analog ? 'active' : ''}>Analog RC</span>
          <b>→</b>
          <span>ADC</span>
          <b>→</b>
          <span className={s.digital ? 'active' : ''}>Digital EMA</span>
        </div>
        <LearningPlot
          title="Before sampling · continuous waveform"
          times={result.denseTimes}
          series={[
            {
              name: 'Continuous source',
              color: COLORS.raw,
              values: result.denseTimes.map(result.inputAt),
            },
            ...(s.analog
              ? [
                  {
                    name: 'Analog RC output',
                    color: COLORS.rc,
                    values: result.denseTimes.map(result.analogAt),
                  },
                ]
              : []),
          ]}
          yBounds={[-1.5, 4.8]}
        />
        <LearningPlot
          title="After sampling · only these instants are observed"
          times={result.times}
          series={points}
          yBounds={[-1.5, 4.8]}
        />
        <dl className="nf-metrics">
          <div>
            <dt>Folded tone frequency</dt>
            <dd>{fmt(result.alias)} Hz</dd>
          </div>
          <div>
            <dt>ADC level spacing</dt>
            <dd>{fmt(3.3 / (2 ** s.bits - 1))} V</dd>
          </div>
          <div>
            <dt>Clipped samples</dt>
            <dd>
              {result.clipped} / {result.adc.length}
            </dd>
          </div>
          <div>
            <dt>ADC error RMS</dt>
            <dd>{fmt(result.error)} V</dd>
          </div>
        </dl>
        <p className="nf-observation" role="status">
          {s.frequency >= s.rate / 2
            ? `The ${s.frequency} Hz source folds to ${fmt(result.alias)} Hz at this sampling rate. At the Nyquist boundary, phase can also make samples ambiguous.`
            : 'This source is below half the sampling rate. Increase the source frequency or reduce the sampling rate to explore aliasing.'}{' '}
          {s.analog
            ? `The analog RC retains ${fmt(result.gain * 100)}% of the tone amplitude before sampling.`
            : ''}{' '}
          {s.digital
            ? 'The digital EMA smooths the already captured sequence; it does not recover the original continuous frequency.'
            : ''}
        </p>
        <p className="small-muted">
          Lines between ADC points are visual guides. The analogue source can
          leave the 0–3.3 V range; only the ADC clips. Error RMS includes
          clipping when present.
        </p>
        <details className="nf-details">
          <summary>Worked alias calculation</summary>
          <MathExpression
            tex={`f_a=\\left|${s.frequency}-${Math.round(s.frequency / s.rate)}\\times ${s.rate}\\right|=${fmt(result.alias)}\\;\\mathrm{Hz}`}
            label="Calculated folded frequency"
          />
        </details>
      </div>
      <aside className="panel nf-controls">
        <h3>Sampling controls</h3>
        <Field
          label="Source frequency"
          value={s.frequency}
          min={1}
          max={180}
          unit="Hz"
          onChange={(frequency) => set({ ...s, frequency })}
        />
        <Select
          label="Sampling rate"
          value={String(s.rate)}
          options={[20, 40, 80, 160, 320, 640].map(
            (n) => [String(n), `${n} samples/s`] as const,
          )}
          onChange={(rate) => set({ ...s, rate: Number(rate) })}
        />
        <Field
          label="ADC resolution"
          value={s.bits}
          min={2}
          max={12}
          unit="bits"
          onChange={(bits) => set({ ...s, bits: Math.round(bits) })}
        />
        <Field
          label="Source amplitude"
          value={s.amplitude}
          min={0}
          max={3}
          step={0.1}
          unit="V peak"
          onChange={(amplitude) => set({ ...s, amplitude })}
        />
        <label className="nf-check">
          <input
            type="checkbox"
            checked={s.analog}
            onChange={(e) => set({ ...s, analog: e.target.checked })}
          />
          Enable analog RC before ADC
        </label>
        <label className="nf-check">
          <input
            type="checkbox"
            checked={s.digital}
            onChange={(e) => set({ ...s, digital: e.target.checked })}
          />
          Enable digital EMA after ADC
        </label>
        <Button
          variant="outline"
          onClick={() =>
            set({
              frequency: 60,
              rate: 80,
              bits: 6,
              amplitude: 1,
              analog: false,
              digital: false,
            })
          }
        >
          Reset sampling
        </Button>
        <p className="small-muted">
          DC baseline: 1.65 V. ADC range: 0–3.3 V. Analog time constant: 20 ms.
          EMA coefficient: 0.20.
        </p>
      </aside>
    </div>
  );
}
interface FamilySettings {
  kind: Family;
  corner: number;
  frequency: number;
}
function Families({
  s,
  set,
}: {
  s: FamilySettings;
  set: (s: FamilySettings) => void;
}) {
  const { kind, corner, frequency } = s;
  const setKind = (kind: Family) => set({ ...s, kind }),
    setCorner = (corner: number) => set({ ...s, corner }),
    setFrequency = (frequency: number) => set({ ...s, frequency });
  return (
    <div className="nf-workbench">
      <div className="nf-results">
        <FamilyDrawing kind={kind} corner={corner} frequency={frequency} />
      </div>
      <aside className="panel nf-controls">
        <h3>Frequency selection</h3>
        <Select
          label="Filter family"
          value={kind}
          options={['lowpass', 'highpass', 'bandpass', 'notch'].map(
            (v, i) =>
              [v, ['Low-pass', 'High-pass', 'Band-pass', 'Notch'][i]] as const,
          )}
          onChange={(v) => setKind(v as Family)}
        />
        <Field
          label="Corner / centre frequency"
          value={corner}
          min={1}
          max={80}
          step={0.5}
          unit="Hz"
          log
          onChange={setCorner}
        />
        <Field
          label="Test tone frequency"
          value={frequency}
          min={0.2}
          max={80}
          step={0.2}
          unit="Hz"
          log
          onChange={setFrequency}
        />
        <p className="small-muted">
          Band-pass corners are half and twice the centre setting. The notch
          quality factor is 3. These are illustrative magnitude responses.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            set({ kind: 'lowpass', corner: 10, frequency: 5 });
          }}
        >
          Reset frequency selection
        </Button>
      </aside>
    </div>
  );
}
function WindowMeasurement({
  result,
  event,
}: {
  result: Result;
  event: boolean;
}) {
  const start = event ? 0.4 : 0.1,
    end = event ? 1 : 0.4,
    indices = result.times.flatMap((t, i) =>
      t >= start && t <= end ? [i] : [],
    ),
    raw = indices.map((i) => result.traces.raw.values[i]),
    noise = indices.map((i) => result.traces.raw.noise[i]);
  return (
    <dl className="nf-metrics">
      <div>
        <dt>Total voltage RMS</dt>
        <dd>{fmt(rms(raw), 4)} V</dd>
      </div>
      <div>
        <dt>Mean-removed record variation</dt>
        <dd>{fmt(rms(raw, true), 4)} V</dd>
      </div>
      <div>
        <dt>Known disturbance RMS</dt>
        <dd>{fmt(rms(noise, true), 4)} V</dd>
      </div>
      <div>
        <dt>Samples in window</dt>
        <dd>{indices.length}</dd>
      </div>
    </dl>
  );
}
export default function NoiseFilteringLab() {
  const [active, setActive] = useState<Lesson>('signal');
  const [sampling, setSampling] = useState(samplingDefaults),
    [family, setFamily] = useState<FamilySettings>({
      kind: 'lowpass',
      corner: 10,
      frequency: 5,
    }),
    [analysisWindow, setAnalysisWindow] = useState('steady');
  const presented = useRef(false);
  useEffect(() => {
    if (!presented.current) {
      presented.current = true;
      return;
    }
    const scheduled = requestAnimationFrame(() => {
      const title = document.getElementById('nf-lesson-title');
      title?.focus({ preventScroll: true });
      title?.closest('section')?.scrollIntoView?.({ block: 'start' });
    });
    return () => cancelAnimationFrame(scheduled);
  }, [active]);
  const [settings, setSettings] = useState(
    () =>
      Object.fromEntries(LESSONS.map((l) => [l.id, initial(l.id)])) as Record<
        Lesson,
        Settings
      >,
  );
  const [time, setTime] = useState(0.65),
    [playing, setPlaying] = useState(false),
    [clean, setClean] = useState(true),
    [disturbance, setDisturbance] = useState(false),
    [reduced, setReduced] = useState(false);
  const lesson = LESSONS.find((l) => l.id === active)!,
    s = settings[active],
    result = useMemo(() => simulate(s), [s]);
  const k = Math.min(result.times.length - 1, Math.round(time * s.rate)),
    cursor = result.times[k];
  const change = (patch: Partial<Settings>) =>
    setSettings((old) => ({ ...old, [active]: { ...old[active], ...patch } }));
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      setReduced(media.matches);
      if (media.matches) setPlaying(false);
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () => setTime((t) => (t >= DURATION ? 0 : Math.min(DURATION, t + 0.025))),
      80,
    );
    return () => clearInterval(timer);
  }, [playing]);
  const select = (id: Lesson) => {
    setPlaying(false);
    setActive(id);
    setTime(0.65);
  };
  const reset = () => {
    setPlaying(false);
    change(initial(active));
    setTime(0.65);
    setClean(true);
    setDisturbance(false);
  };
  const method: Method =
    active === 'rc' ? 'rc' : active === 'ma' ? 'ma' : 'ema';
  const shown: Method[] =
    active === 'compare'
      ? METHODS
      : active === 'signal'
        ? ['raw']
        : ['raw', method];
  const series: Series[] = shown.map((m) => ({
    name: LABELS[m],
    color: COLORS[m],
    values: result.traces[m].values,
  }));
  if (clean)
    series.unshift({
      name: 'Useful reference + baseline',
      color: COLORS.clean,
      values: result.traces.raw.clean,
      dash: true,
    });
  if (disturbance)
    series.push({
      name: 'Disturbance alone (zero-centred)',
      color: COLORS.noise,
      values: result.traces.raw.noise,
    });
  const frequencyPoints = Array.from(
    { length: 181 },
    (_, i) => 0.1 * 10 ** ((i / 180) * Math.log10(s.rate / 2 / 0.1)),
  );
  const windowSamples = Array.from({ length: s.window }, (_, i) => {
    const idx = k - s.window + 1 + i;
    if (idx >= 0) return result.traces.raw.values[idx];
    return rawAt(idx / s.rate, s);
  });
  const newest = result.traces.raw.values[k],
    previous = k ? result.traces.ema.values[k - 1] : result.previousEma;
  const idx = LESSONS.findIndex((l) => l.id === active);
  return (
    <main id="main-content" tabIndex={-1} className="lab-shell nf-page">
      <TopicBreadcrumbs />
      <div className="intro nf-intro">
        <div>
          <span className="eyebrow">EXPLORE · ADJUST · UNDERSTAND</span>
          <h1>Noise and Filtering Interactive Learning</h1>
          <p>
            Discover how filters change a signal—and what smoothing can cost.
          </p>
        </div>
        <span className="nf-free-tag">Explore at your own pace</span>
      </div>
      <nav className="nf-lessons" aria-label="Learning sections">
        {LESSONS.map((l, i) => (
          <button
            key={l.id}
            aria-current={active === l.id ? 'step' : undefined}
            onClick={() => select(l.id)}
          >
            <span>{String(i + 1).padStart(2, '0')}</span>
            <strong>{l.title}</strong>
            <small>{l.short}</small>
          </button>
        ))}
      </nav>
      <section
        className="panel nf-lesson-intro"
        aria-labelledby="nf-lesson-title"
      >
        <span className="eyebrow">
          CONCEPT {idx + 1} OF {LESSONS.length}
        </span>
        <h2 id="nf-lesson-title" tabIndex={-1}>
          {lesson.title}
        </h2>
        <p>{lesson.description}</p>
      </section>
      {active === 'families' ? (
        <Families s={family} set={setFamily} />
      ) : active === 'sampling' ? (
        <Sampling s={sampling} set={setSampling} />
      ) : (
        <>
          <div className="nf-workbench">
            <div className="nf-results">
              <section className="panel nf-chart-panel">
                <div className="section-heading">
                  <h3>
                    {active === 'compare'
                      ? 'Compare the same input'
                      : 'Explore the waveform'}
                  </h3>
                  <span className="pill">Synthetic signal</span>
                </div>
                <LearningPlot
                  title="Input and output · common time and voltage axes"
                  times={result.times}
                  series={series}
                  cursor={cursor}
                />
                <div className="nf-playback">
                  <Button
                    variant="outline"
                    onClick={() => setPlaying(!playing)}
                    disabled={reduced}
                  >
                    <span aria-hidden="true">
                      {playing ? <Pause size={15} /> : <Play size={15} />}
                    </span>
                    {playing ? 'Pause' : 'Play'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPlaying(false);
                      setTime(Math.min(DURATION, cursor + 1 / s.rate));
                    }}
                  >
                    <SkipForward size={15} aria-hidden="true" />
                    Next sample
                  </Button>
                  <label>
                    Cursor time
                    <input
                      aria-label="Cursor time"
                      type="range"
                      min="0"
                      max={DURATION}
                      step={1 / s.rate}
                      value={cursor}
                      onChange={(e) => {
                        setPlaying(false);
                        setTime(Number(e.target.value));
                      }}
                    />
                  </label>
                  <output aria-label="Cursor timestamp">
                    {cursor.toFixed(3)} s · sample {k}
                  </output>
                </div>
                {reduced && (
                  <p className="small-muted">
                    Reduced motion is enabled. Use Next sample or move the
                    cursor to explore each update.
                  </p>
                )}
                <div className="nf-toggles">
                  <label className="nf-check">
                    <input
                      type="checkbox"
                      checked={clean}
                      onChange={(e) => setClean(e.target.checked)}
                    />
                    Show useful reference
                  </label>
                  <label className="nf-check">
                    <input
                      type="checkbox"
                      checked={disturbance}
                      onChange={(e) => setDisturbance(e.target.checked)}
                    />
                    Show disturbance alone
                  </label>
                </div>
                <p className="small-muted">
                  The vertical cursor drives the mechanism views below. Events
                  start at 0.5 s. Moving a filter control keeps the input record
                  fixed.
                </p>
              </section>
              {active === 'signal' && (
                <section className="panel">
                  <h3>What does RMS measure?</h3>
                  <Select
                    label="Measurement window"
                    value={analysisWindow}
                    options={[
                      ['steady', 'Steady: 0.1–0.4 s'],
                      ['event', 'Across the change: 0.4–1.0 s'],
                    ]}
                    onChange={setAnalysisWindow}
                  />
                  <WindowMeasurement
                    result={result}
                    event={analysisWindow === 'event'}
                  />
                  <p className="small-muted">
                    Choose a Step or Pulse, then compare windows. Total voltage
                    RMS includes the baseline. Removing the mean still counts a
                    real signal change as variation; it estimates noise only
                    when the useful signal is steady.
                  </p>
                  <MathExpression
                    tex={String.raw`x_{\mathrm{RMS}}=\sqrt{\frac{1}{M}\sum_k x_k^2},\quad \sigma_x=\sqrt{\frac{1}{M}\sum_k(x_k-\bar{x})^2}`}
                    label="Total RMS and mean-removed RMS variation"
                  />
                </section>
              )}
              {active === 'rc' && (
                <section className="panel">
                  <h3>Inside the RC filter</h3>
                  <RcDrawing
                    voltage={result.traces.rc.values[k]}
                    fraction={result.traces.rc.values[k] / 3.3}
                  />
                  <dl className="nf-metrics">
                    <div>
                      <dt>Time constant</dt>
                      <dd>{fmt(s.resistance * s.capacitance * 1000)} ms</dd>
                    </div>
                    <div>
                      <dt>Cutoff frequency</dt>
                      <dd>
                        {fmt(1 / (2 * Math.PI * s.resistance * s.capacitance))}{' '}
                        Hz
                      </dd>
                    </div>
                  </dl>
                </section>
              )}
              {active === 'ma' && (
                <section className="panel">
                  <h3>Samples in the current window</h3>
                  <>
                    <WindowDrawing samples={windowSamples} />
                    <MathExpression
                      tex={`y[${k}]=\\frac{${fmt(
                        windowSamples.reduce((a, b) => a + b, 0),
                        6,
                      )}}{${s.window}}=${fmt(result.traces.ma.values[k], 6)}\\;\\mathrm{V}`}
                      label="Current moving-average calculation"
                    />
                    <details className="nf-details">
                      <summary>Inspect every sample in this window</summary>
                      <div className="nf-sample-list">
                        {windowSamples.map((v, i) => (
                          <span key={i}>
                            Sample {k - s.window + 1 + i}: {v!.toFixed(4)} V
                          </span>
                        ))}
                      </div>
                    </details>
                  </>
                  <p className="nf-observation">
                    Nominal averaging duration:{' '}
                    {fmt((s.window / s.rate) * 1000)} ms. Its group delay is{' '}
                    {fmt(((s.window - 1) / (2 * s.rate)) * 1000)} ms; threshold
                    response time can differ.
                  </p>
                </section>
              )}
              {active === 'ema' && (
                <section className="panel">
                  <h3>One update at the cursor</h3>
                  <EmaDrawing
                    alpha={s.alpha}
                    newest={newest}
                    previous={previous}
                    output={result.traces.ema.values[k]}
                  />
                  <MathExpression
                    tex={`y[${k}]=${fmt(s.alpha)}\\times ${fmt(newest, 6)}+${fmt(1 - s.alpha)}\\times ${fmt(previous, 6)}=${fmt(result.traces.ema.values[k], 6)}\\;\\mathrm{V}`}
                    label="Current EMA calculation"
                  />
                  <div
                    className="nf-weight-strip"
                    aria-label="Weights for newest and previous output"
                  >
                    <span
                      style={{
                        width: `${s.alpha * 100}%`,
                        background: COLORS.ma,
                      }}
                    />
                    <span style={{ flex: 1, background: COLORS.ema }} />
                  </div>
                  <p className="small-muted">
                    Gold: new-sample weight. Purple: previous-output weight. The
                    previous output carries a fading history of older samples.
                  </p>
                </section>
              )}
              <section className="panel">
                <h3>
                  {active === 'compare'
                    ? 'Compare the costs'
                    : 'Measurements for this record'}
                </h3>
                <div className="nf-table-wrap">
                  <table className="nf-table">
                    <thead>
                      <tr>
                        <th>Path</th>
                        <th>Noise RMS (V)</th>
                        {s.wave === 'step' && <th>Step to 90% (ms)</th>}
                        {s.wave === 'pulse' && <th>Pulse retained (%)</th>}
                        {s.wave === 'sine' && (
                          <>
                            <th>Useful RMS (V)</th>
                            <th>SNR (dB)</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((m) => {
                        const metric = result.metrics[m];
                        return (
                          <tr key={m} data-method={m}>
                            <th>
                              <span
                                className="nf-dot"
                                style={{ background: COLORS[m] }}
                              />
                              {LABELS[m]}
                            </th>
                            <td>{fmt(metric.noise, 4)}</td>
                            {s.wave === 'step' && (
                              <td>
                                {metric.delay === null
                                  ? 'Not reached / no step'
                                  : fmt(metric.delay, 4)}
                              </td>
                            )}
                            {s.wave === 'pulse' && (
                              <td>
                                {metric.pulse === null
                                  ? 'No pulse'
                                  : fmt(metric.pulse, 4)}
                              </td>
                            )}
                            {s.wave === 'sine' && (
                              <>
                                <td>{fmt(metric.signal ?? 0, 4)}</td>
                                <td>
                                  {metric.snr === null
                                    ? 'Undefined'
                                    : metric.snr.toFixed(1)}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="small-muted">
                  {s.wave === 'sine'
                    ? 'RMS uses the full 0–2 s record. Useful sine and disturbance are known, filtered separately and mean-removed. SNR is undefined when either component has zero measured RMS.'
                    : 'Noise RMS uses the same steady 0.1–0.4 s window, with its mean removed. Timing and pulse height use the known noise-free output; a real noisy peak is not used.'}{' '}
                  All paths are observed at the selected sampling rate. A late
                  response may lie outside this two-second record.
                </p>
              </section>
              {result.warnings.map((w) => (
                <p className="nf-warning" role="status" key={w}>
                  {w}
                </p>
              ))}
              {active !== 'signal' && (
                <section className="panel">
                  <LearningPlot
                    title="Amplitude response of the selected filters"
                    times={frequencyPoints}
                    series={shown
                      .filter((m) => m !== 'raw')
                      .map((m) => ({
                        name: LABELS[m],
                        color: COLORS[m],
                        values: frequencyPoints.map((f) =>
                          magnitude(response(m, f, s)),
                        ),
                      }))}
                    xLabel="Frequency (Hz, logarithmic)"
                    yLabel="Amplitude ratio"
                    logX
                    yBounds={[0, 1.1]}
                  />
                  <p className="small-muted">
                    Digital responses are shown only up to half the sampling
                    rate. MA dips and lobes explain why rejection of a
                    particular tone can change non-monotonically with window
                    length.
                  </p>
                </section>
              )}
            </div>
            <aside className="panel nf-controls">
              <h3>Try a change</h3>
              <Select
                label="Useful signal"
                value={s.wave}
                options={[
                  ['steady', 'Steady level'],
                  ['step', 'Step change'],
                  ['pulse', 'Brief pulse'],
                  ['sine', 'Sine wave'],
                ]}
                onChange={(wave) => change({ wave: wave as Wave })}
              />
              {s.wave !== 'steady' && (
                <Field
                  label="Useful amplitude"
                  value={s.amplitude}
                  min={0}
                  max={1.5}
                  step={0.05}
                  unit="V"
                  onChange={(amplitude) => change({ amplitude })}
                />
              )}{' '}
              {s.wave === 'sine' && (
                <Field
                  label="Useful frequency"
                  value={s.frequency}
                  min={0.5}
                  max={80}
                  step={0.5}
                  unit="Hz"
                  onChange={(frequency) => change({ frequency })}
                />
              )}{' '}
              {s.wave === 'pulse' && (
                <Field
                  label="Pulse width"
                  value={s.pulseWidth}
                  min={0.01}
                  max={0.5}
                  scale={0.001}
                  step={5}
                  unit="ms"
                  onChange={(pulseWidth) => change({ pulseWidth })}
                />
              )}
              <Select
                label="Disturbance"
                value={s.noise}
                options={[
                  ['random', 'Band-limited random noise'],
                  ['periodic', 'Periodic interference'],
                  ['drift', 'Slow drift'],
                ]}
                onChange={(noise) => change({ noise: noise as Noise })}
              />
              <Field
                label="Disturbance RMS setting"
                value={s.noiseRms}
                min={0}
                max={0.5}
                step={0.01}
                unit="V"
                onChange={(noiseRms) => change({ noiseRms })}
              />
              {s.noise === 'periodic' && (
                <Field
                  label="Interference frequency"
                  value={s.noiseFrequency}
                  min={0.2}
                  max={200}
                  step={0.2}
                  unit="Hz"
                  onChange={(noiseFrequency) => change({ noiseFrequency })}
                />
              )}
              <Button
                variant="outline"
                disabled={s.noise !== 'random'}
                onClick={() => change({ seed: s.seed >= 1e9 ? 1 : s.seed + 1 })}
              >
                <Shuffle size={15} aria-hidden="true" />
                Generate new noise
              </Button>
              {(active === 'rc' || active === 'compare') && (
                <>
                  <h4>RC low-pass</h4>
                  <Field
                    label="Resistance"
                    value={s.resistance}
                    min={1000}
                    max={100000}
                    scale={1000}
                    unit="kΩ"
                    step={0.5}
                    log
                    onChange={(resistance) => change({ resistance })}
                  />
                  <Field
                    label="Capacitance"
                    value={s.capacitance}
                    min={1e-8}
                    max={1e-5}
                    scale={1e-6}
                    unit="µF"
                    step={0.01}
                    log
                    onChange={(capacitance) => change({ capacitance })}
                  />
                </>
              )}
              {(active === 'ma' || active === 'compare') && (
                <>
                  <h4>Moving average</h4>
                  <Field
                    label="Window length"
                    value={s.window}
                    min={1}
                    max={101}
                    unit="samples"
                    onChange={(window) =>
                      change({ window: Math.round(window) })
                    }
                  />
                </>
              )}
              {(active === 'ema' || active === 'compare') && (
                <>
                  <h4>Exponential average</h4>
                  <Field
                    label="EMA coefficient"
                    value={s.alpha}
                    min={0.01}
                    max={1}
                    step={0.01}
                    onChange={(alpha) => change({ alpha })}
                  />
                </>
              )}
              <details className="nf-details">
                <summary>Sampling and model settings</summary>
                <Field
                  label="Observation sampling rate"
                  value={s.rate}
                  min={25}
                  max={2000}
                  step={25}
                  unit="samples/s"
                  onChange={(rate) => change({ rate: Math.round(rate) })}
                />
                <p className="small-muted">
                  RC acts continuously before observation. MA and EMA act on the
                  identical RAW samples. No ADC quantization or clipping is
                  applied in this view; explore those in Sampling and
                  limitations.
                </p>
              </details>
              <Button variant="outline" onClick={reset}>
                <RotateCcw size={15} aria-hidden="true" />
                Reset this section
              </Button>
              <p className="small-muted">
                Section settings stay while you explore this page. Refreshing
                restores defaults. Nothing is submitted or graded.
              </p>
            </aside>
          </div>
        </>
      )}
      <div className="nf-theory-grid">
        <section className="panel nf-theory">
          <span className="eyebrow">THE RELATIONSHIPS</span>
          <h3>Read the mathematics</h3>
          {lesson.equations.map(([tex, label]) => (
            <MathExpression key={tex} tex={tex} label={label} />
          ))}
          <dl className="nf-symbols">
            {SYMBOLS[active].map(([tex, meaning]) => (
              <div key={tex}>
                <dt>
                  <MathExpression tex={tex} label={meaning} inline />
                </dt>
                <dd>{meaning}</dd>
              </div>
            ))}
          </dl>
          <p>{lesson.note}</p>
        </section>
        <section className="panel nf-try">
          <span className="eyebrow">TRY → OBSERVE → EXPLAIN</span>
          <h3>A question to explore</h3>
          <p>{lesson.try}</p>
          <details className="nf-details" key={active}>
            <summary>Show an explanation</summary>
            <p>{lesson.explanation}</p>
          </details>
          <p className="small-muted">
            Change one parameter, describe what you notice, then try a different
            signal. These are open exploration prompts.
          </p>
        </section>
      </div>
      <nav
        className="nf-section-navigation"
        aria-label="Previous and next concept"
      >
        <Button
          variant="outline"
          disabled={idx === 0}
          onClick={() => select(LESSONS[idx - 1].id)}
        >
          ← Previous concept
        </Button>
        <span>
          {idx + 1} / {LESSONS.length}
        </span>
        <Button
          variant="outline"
          disabled={idx === LESSONS.length - 1}
          onClick={() => select(LESSONS[idx + 1].id)}
        >
          Next concept →
        </Button>
      </nav>
      <details className="panel nf-details nf-reading">
        <summary>Further reading and model boundaries</summary>
        <p>
          These ideal teaching examples illustrate mechanisms. They do not
          predict a particular physical sensor, breadboard or ADC. Useful
          bandwidth, noise spectrum, loading and hardware limitations determine
          a real design.
        </p>
        <ul>
          <li>
            <a
              href="https://www.dspguide.com/ch15.htm"
              target="_blank"
              rel="noopener noreferrer"
            >
              Steven W. Smith · Moving Average Filters
            </a>
          </li>
          <li>
            <a
              href="https://www.dspguide.com/ch19.htm"
              target="_blank"
              rel="noopener noreferrer"
            >
              Steven W. Smith · Recursive Filters
            </a>
          </li>
          <li>
            <a
              href="https://www.analog.com/en/resources/analog-dialogue/articles/practical-filter-design-precision-adcs.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              Analog Devices · Analog and digital filtering around an ADC
            </a>
          </li>
          <li>
            <a
              href="https://www.analog.com/en/resources/app-notes/an-835.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              Analog Devices · SNR and distortion definitions
            </a>
          </li>
        </ul>
      </details>
    </main>
  );
}
