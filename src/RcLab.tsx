import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Choice } from '@/components/lab/controls';
import { MathExpression } from '@/components/lab/math-expression';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  RcSchematic,
  RcFrequencyPlots,
  RcTimePlot,
} from '@/components/rc/visuals';
import {
  CONFIGURATIONS,
  defaults,
  simulate,
  validate,
  type RcFilterConfig,
  type RcKind,
  type RcComponents,
  type Waveform,
} from '@/lib/rc/simulator';
import { INFO } from '@/lib/rc/content';
import { engineering as eng } from '@/lib/rc/simulator';
import { TopicBreadcrumbs } from './TopicBreadcrumbs';
export default function RcLab() {
  const [config, setConfig] = useState(defaults),
    [error, setError] = useState('');
  const result = useMemo(() => simulate(config), [config]),
    p = config.circuits[config.kind],
    info = INFO[config.kind];
  const change = (patch: Partial<RcFilterConfig>) => {
    try {
      setConfig(validate({ ...config, ...patch }));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const components = (patch: Partial<RcComponents>) =>
    change({
      circuits: { ...config.circuits, [config.kind]: { ...p, ...patch } },
    });
  const source = (patch: Partial<RcFilterConfig['source']>) =>
    change({ source: { ...config.source, ...patch } });
  const part = (key: 'r1' | 'r2' | 'c1' | 'c2' | 'load', label: string) => {
    const capacitor = key.startsWith('c');
    return (
      <Field
        key={key}
        label={label}
        value={p[key]}
        min={capacitor ? 1e-10 : 100}
        max={capacitor ? 1e-5 : 1e6}
        scale={capacitor ? 1e-9 : 1000}
        unit={capacitor ? 'nF' : 'kΩ'}
        log
        step={0.1}
        onChange={(v) => components({ [key]: v })}
      />
    );
  };
  const metrics = [
    ['Gain at input frequency', `${result.selected.gain.toPrecision(4)} V/V`],
    ['Output phase', `${result.selected.phase.toFixed(1)}°`],
    ['Slowest time constant', eng(result.slowTau, 's')],
    ...(result.peakFrequency
      ? [
          ['Peak frequency', eng(result.peakFrequency, 'Hz')],
          ['Peak gain', `${result.peakGain.toPrecision(4)} V/V`],
          ['Bandwidth', eng(result.bandwidth!, 'Hz')],
        ]
      : [['Passband gain', `${result.peakGain.toPrecision(4)} V/V`]]),
    ...result.cutoffs.map((v, i) => [
      result.cutoffs.length === 1
        ? 'Cutoff frequency'
        : i
          ? 'Upper half-power'
          : 'Lower half-power',
      eng(v, 'Hz'),
    ]),
  ];
  return (
    <main id="main-content" tabIndex={-1} className="lab-shell rc-lab">
      <TopicBreadcrumbs />
      <div className="intro page-heading">
        <div>
          <span className="eyebrow">FREQUENCY → RESPONSE</span>
          <h1>Interactive Learning</h1>
          <p>Change a component. Predict the response. Follow the signal.</p>
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            setConfig(defaults());
            setError('');
          }}
        >
          <RotateCcw size={15} />
          Reset lab
        </Button>
      </div>
      <RadioGroup
        aria-label="RC filter configuration"
        value={config.kind}
        onValueChange={(v) => change({ kind: v as RcKind })}
        className="circuit-picker rc-picker"
      >
        {CONFIGURATIONS.map((kind, i) => (
          <label
            className={`circuit-choice ${kind === config.kind ? 'selected' : ''}`}
            key={kind}
          >
            <RadioGroupItem value={kind} />
            <span className="circuit-number">0{i + 1}</span>
            {INFO[kind].name}
          </label>
        ))}
      </RadioGroup>
      <section className="panel">
        <div className="section-heading">
          <h2>{info.name}</h2>
          <span className="pill">
            {p.loaded ? 'Output load connected' : 'Unloaded output'}
          </span>
        </div>
        <div className="rc-theory-grid">
          <RcSchematic config={config} />
          <div className="rc-theory">
            <p>{info.description}</p>
            <MathExpression tex={info.equation} label={info.description} />
            <p>
              {config.kind === 'bandpass'
                ? `Actual network: a = ${eng(result.transfer.a, 's')}, b = ${result.transfer.b.toPrecision(4)} s², n₁ = ${eng(result.transfer.n1, 's')}. Isolated stage corners: ${result.stageCorners.map((v) => eng(v, 'Hz')).join(' and ')}.`
                : 'Without a load, R_L → ∞, τ = RC and fc = 1/(2πRC). At cutoff, gain falls to 1/√2 (−3 dB) of the passband gain. One time constant takes capacitor charging 63.2% toward its final voltage; the remaining difference decays to 36.8%.'}
            </p>
          </div>
        </div>
      </section>
      {error && <p role="alert">{error}</p>}
      <div className="rc-workbench">
        <div className="rc-results">
          <dl className="divider-metrics">
            {metrics.map(([label, value]) => (
              <div className="metric-card" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <RcFrequencyPlots result={result} />
          <RcTimePlot result={result} step={config.view === 'step'} />
        </div>
        <aside className="panel rc-controls">
          <div className="section-heading">
            <h2>Parameters</h2>
          </div>
          <div className="rc-control-body">
            {part('r1', 'Resistance R1')}
            {part('c1', 'Capacitance C1')}
            {config.kind === 'bandpass' && (
              <>
                {part('r2', 'Resistance R2')}
                {part('c2', 'Capacitance C2')}
              </>
            )}
            <label className="rc-check">
              <input
                type="checkbox"
                checked={p.loaded}
                onChange={(e) => components({ loaded: e.target.checked })}
              />
              Connect output load
            </label>
            {p.loaded && part('load', 'Output load resistance')}
            <Choice
              label="Response view"
              value={config.view}
              options={[
                { value: 'periodic', label: 'Periodic waveform' },
                { value: 'step', label: 'Step response' },
              ]}
              onChange={(v) => change({ view: v as 'periodic' | 'step' })}
            />
            <Field
              label="Input frequency"
              value={config.source.frequency}
              min={0.1}
              max={1e6}
              unit="Hz"
              log
              step={0.1}
              onChange={(v) => source({ frequency: v })}
            />
            {config.view === 'step' ? (
              <Field
                label="Step voltage"
                value={config.stepVoltage}
                min={0}
                max={5}
                unit="V"
                step={0.1}
                onChange={(v) => change({ stepVoltage: v })}
              />
            ) : (
              <>
                <Choice
                  label="Input waveform"
                  value={config.source.waveform}
                  options={[
                    { value: 'sine', label: 'Sine' },
                    { value: 'square', label: 'Square' },
                    { value: 'triangle', label: 'Triangle' },
                  ]}
                  onChange={(v) => source({ waveform: v as Waveform })}
                />
                <Field
                  label="Input amplitude"
                  value={config.source.amplitude}
                  min={0}
                  max={5}
                  unit="V peak"
                  step={0.1}
                  onChange={(v) => source({ amplitude: v })}
                />
                <Field
                  label="Input offset"
                  value={config.source.offset}
                  min={-5}
                  max={5}
                  unit="V"
                  step={0.1}
                  onChange={(v) => source({ offset: v })}
                />
              </>
            )}
          </div>
        </aside>
      </div>
      <section className="rc-experiments">
        <h2>Predict, then experiment</h2>
        <div className="experiment-grid">
          {info.experiments.map((text, i) => (
            <article className="panel" key={text}>
              <span className="eyebrow">TRY 0{i + 1}</span>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <p className="divider-footer">
        Ideal source, ideal resistors and capacitors. The breadboard generator
        has 50 Ω source resistance: measure its actual output with CH1 and
        filter output with CH2. Gain = CH2 Vpp / CH1 Vpp. Phase here means
        output relative to input. No component tolerances, parasitics, or
        instrument loading are included in this learning model. Settings reset
        when you leave this tool.
      </p>
    </main>
  );
}
