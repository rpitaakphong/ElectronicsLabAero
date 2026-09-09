import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Field, Choice } from '@/components/lab/controls';
import { MathExpression } from '@/components/lab/math-expression';
import { DividerSchematic, DividerGraph } from '@/components/divider/visuals';
import {
  CONFIGURATIONS,
  defaults,
  simulate,
  validate,
  eng,
  type DividerConfig,
  type Configuration,
} from '@/lib/divider/simulator';
import { INFO } from '@/lib/divider/content';
import { TopicBreadcrumbs } from './TopicBreadcrumbs';
export default function DividerLab() {
  const [config, setConfig] = useState(defaults),
    [error, setError] = useState('');
  const result = useMemo(() => simulate(config), [config]),
    info = INFO[config.configuration];
  const change = (patch: Partial<DividerConfig>) => {
    try {
      setConfig(validate({ ...config, ...patch }));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Check the values.');
    }
  };
  const resistance = (
    key: 'r1' | 'r2' | 'load' | 'pot' | 'fixed' | 'sensor',
    label: string,
  ) => (
    <Field
      key={key}
      label={label}
      value={config[key]}
      min={100}
      max={1e6}
      scale={1000}
      unit="kΩ"
      step={0.1}
      log
      onChange={(v) => change({ [key]: v })}
    />
  );
  const metrics = [
    ['Output voltage', eng(result.output, 'V')],
    ['Divider ratio', `${Number(result.ratio.toPrecision(4))} V/V`],
    ['Source current', eng(result.sourceCurrent, 'A')],
    ['Upper resistor power', eng(result.upperPower, 'W')],
    ['Lower resistor power', eng(result.lowerPower, 'W')],
    ...(result.loaded
      ? [
          ['Unloaded output', eng(result.unloaded, 'V')],
          ['Lower branch current', eng(result.lowerCurrent, 'A')],
          ['Load current', eng(result.loadCurrent, 'A')],
          ['Load power', eng(result.loadPower, 'W')],
          [
            'Loading error',
            result.loadingError === null
              ? 'Unavailable (zero reference)'
              : `${Number(result.loadingError.toPrecision(4))}%`,
          ],
        ]
      : []),
  ];
  const upper = Number((result.upper / 1000).toPrecision(5)),
    lower = Number((result.effectiveLower / 1000).toPrecision(5));
  return (
    <main id="main-content" tabIndex={-1} className="lab-shell divider-lab">
      <TopicBreadcrumbs />
      <div className="intro page-heading">
        <div>
          <span className="eyebrow">RESISTANCE → VOLTAGE</span>
          <h1>Interactive Learning</h1>
          <p>
            Change the circuit. Follow the current. Discover what sets the
            output.
          </p>
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
        aria-label="Divider configuration"
        value={config.configuration}
        onValueChange={(v) => change({ configuration: v as Configuration })}
        className="circuit-picker divider-picker"
      >
        {CONFIGURATIONS.map((c, i) => (
          <label
            key={c}
            className={`circuit-choice ${config.configuration === c ? 'selected' : ''}`}
          >
            <RadioGroupItem value={c} />
            <span className="circuit-number">0{i + 1}</span>
            <span>{INFO[c].name}</span>
          </label>
        ))}
      </RadioGroup>
      <section className="panel divider-circuit">
        <div className="section-heading">
          <h2>{info.name}</h2>
          <span className="pill">
            {result.loaded ? 'Load connected' : 'Unloaded output'}
          </span>
        </div>
        <div className="divider-circuit-body">
          <DividerSchematic config={config} result={result} />
          <div className="divider-theory">
            <p>{info.description}</p>
            <div className="equation-block">
              <MathExpression
                tex={
                  result.loaded
                    ? 'R_{eff}=R_{lower}\\parallel R_L=\\frac{R_{lower}R_L}{R_{lower}+R_L}'
                    : 'V_{out}=V_{in}\\frac{R_{lower}}{R_{upper}+R_{lower}}'
                }
                label={
                  result.loaded
                    ? 'Effective lower resistance equals lower resistance in parallel with the load'
                    : 'Output equals input times lower resistance divided by total resistance'
                }
              />
              {result.loaded && (
                <MathExpression
                  tex="V_{out}=V_{in}\\frac{R_{eff}}{R_{upper}+R_{eff}}"
                  label="Loaded output uses the effective lower resistance"
                />
              )}
              {config.configuration === 'potentiometer' && (
                <MathExpression
                  tex="R_{upper}=(1-p)R_T,\\quad R_{lower}=pR_T"
                  label="Upper track equals one minus position times total resistance; lower track equals position times total resistance"
                />
              )}
              <MathExpression
                tex={`V_{out}=${config.vin}\\,\\mathrm{V}\\times\\frac{${lower}}{${upper}+${lower}}=${Number(result.output.toPrecision(4))}\\,\\mathrm{V}`}
                label={`Output = ${config.vin} V × ${lower} / (${upper} + ${lower}) = ${Number(result.output.toPrecision(4))} V; resistance values in kilo-ohms`}
              />
              <p className="equation-note">
                Resistance values substituted in kΩ. Output is measured relative
                to ground.
                {config.configuration === 'potentiometer'
                  ? ' Position p runs from 0 at ground to 1 at the supply.'
                  : ''}
              </p>
            </div>
            <div className="application-note">
              <span className="eyebrow">WHEN TO USE IT</span>
              <p>{info.use}</p>
            </div>
          </div>
        </div>
      </section>
      <div className="divider-workbench">
        <div className="divider-results">
          <DividerGraph config={config} result={result} />
          <section className="panel">
            <div className="section-heading">
              <h2>Measurements</h2>
              <span className="small-muted">At the current setting</span>
            </div>
            <dl className="divider-metrics">
              {metrics.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
        <aside className="panel divider-controls">
          <div className="section-heading">
            <h2>Parameters</h2>
            <span className="small-muted">Drag or type a value</span>
          </div>
          <div className="divider-fields">
            <Field
              label="Input voltage"
              value={config.vin}
              min={0}
              max={24}
              step={0.1}
              unit="V"
              onChange={(v) => change({ vin: v })}
            />
            {(config.configuration === 'basic' ||
              config.configuration === 'loaded') && (
              <>
                {resistance('r1', 'Upper resistance R1')}
                {resistance('r2', 'Lower resistance R2')}
              </>
            )}
            {config.configuration === 'potentiometer' && (
              <>
                {resistance('pot', 'Total track resistance')}
                <Field
                  label="Wiper position"
                  value={config.position}
                  min={0}
                  max={1}
                  scale={0.01}
                  unit="%"
                  step={1}
                  onChange={(v) => change({ position: v })}
                />
                <Choice
                  label="Output load"
                  value={config.potLoaded ? 'connected' : 'disconnected'}
                  options={[
                    { value: 'disconnected', label: 'Disconnected' },
                    { value: 'connected', label: 'Connected' },
                  ]}
                  onChange={(v) => change({ potLoaded: v === 'connected' })}
                />
              </>
            )}
            {config.configuration === 'sensor' && (
              <>
                {resistance('fixed', 'Fixed resistance')}
                {resistance('sensor', 'Sensor resistance')}
                <Choice
                  label="Sensor position"
                  value={config.sensorPosition}
                  options={[
                    { value: 'lower', label: 'Below output (lower leg)' },
                    { value: 'upper', label: 'Above output (upper leg)' },
                  ]}
                  onChange={(v) =>
                    change({ sensorPosition: v as 'upper' | 'lower' })
                  }
                />
              </>
            )}
            {result.loaded && resistance('load', 'Load resistance RL')}
            {error && <p role="alert">{error}</p>}
          </div>
        </aside>
      </div>
      <section className="panel divider-experiments">
        <div className="section-heading">
          <h2>Try this</h2>
          <span className="small-muted">Predict → change → observe</span>
        </div>
        <div className="experiment-grid" key={config.configuration}>
          {info.experiments.map((experiment, i) => (
            <article key={experiment.title}>
              <span className="eyebrow">EXPERIMENT 0{i + 1}</span>
              <h3>{experiment.title}</h3>
              <p>{experiment.steps}</p>
              <details>
                <summary>Why does this happen?</summary>
                <p>{experiment.explanation}</p>
              </details>
            </article>
          ))}
        </div>
      </section>
      <footer className="divider-footer">
        Model: ideal DC supply, ideal resistors, and an ideal voltage
        measurement. No component tolerances, source resistance, or
        sensor-specific response are included.
      </footer>
    </main>
  );
}
