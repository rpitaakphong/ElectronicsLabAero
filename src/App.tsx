import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  Activity,
  ChevronDown,
  Info,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field, SourceControls } from '@/components/lab/controls';
import { Schematic } from '@/components/lab/schematic';
import { Oscilloscope } from '@/components/lab/oscilloscope';
import { MathExpression } from '@/components/lab/math-expression';
import {
  CIRCUITS,
  cloneDefault,
  simulate,
  validateConfig,
  type Config,
  type Circuit,
} from '@/lib/opamp/simulator';
import { CIRCUIT_INFO, equation } from '@/lib/opamp/content';
import { createLabTools, type LabContext } from '@/lib/opamp/browser-tools';

export default function App() {
  const [config, setConfig] = useState<Config>(cloneDefault),
    [error, setError] = useState(''),
    [paramTab, setParamTab] = useState('signal');
  const result = useMemo(() => simulate(config), [config]),
    info = CIRCUIT_INFO[config.circuit],
    formula = equation(config);
  const current = useRef({ config, result });
  useEffect(() => {
    current.current = { config, result };
  }, [config, result]);
  const apply = (next: Config) => {
    try {
      setConfig(validateConfig(next));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Check the parameter values.');
    }
  };
  useEffect(() => {
    const context = (document as Document & { modelContext?: LabContext })
      .modelContext;
    if (!context?.registerTool) return;
    const abort = new AbortController();
    for (const tool of createLabTools(
      () => current.current,
      (c) =>
        flushSync(() => {
          setConfig(c);
          setError('');
        }),
    )) {
      try {
        Promise.resolve(
          context.registerTool(tool, { signal: abort.signal }),
        ).catch((e) =>
          console.warn('Optional op-amp browser tool unavailable', e),
        );
      } catch (e) {
        console.warn('Optional op-amp browser tool unavailable', e);
      }
    }
    return () => abort.abort();
  }, []);
  const setComponent = (key: keyof Config['components'], value: number) =>
    apply({ ...config, components: { ...config.components, [key]: value } });
  const reset = () => {
    apply(cloneDefault());
    setParamTab('signal');
  };
  const p = config.components,
    isComp = config.circuit === 'comparator';
  return (
    <main className="lab-shell">
      <header className="masthead">
        <div className="brand">
          <span
            className="brand-logo"
            role="img"
            aria-label="Chulalongkorn University"
          />
          <span className="brand-divider" />
          <strong>Electronics Lab For Aerospace Engineering</strong>
        </div>
        <div className="header-actions">
          <span className="local-label">
            <span className="local-dot" /> LOCAL LAB
          </span>
          <Button variant="ghost" onClick={reset}>
            <RotateCcw size={15} />
            Reset lab
          </Button>
        </div>
      </header>
      <div className="intro">
        <div>
          <h1>Operational Amplifier</h1>
          <p>
            Play with settings and parameters, then observe and learn what
            happens.
          </p>
        </div>
      </div>
      <RadioGroup
        aria-label="Circuit configuration"
        value={config.circuit}
        onValueChange={(v) => apply({ ...config, circuit: v as Circuit })}
        className="circuit-picker"
      >
        {CIRCUITS.map((c, i) => (
          <label
            key={c}
            className={`circuit-choice ${config.circuit === c ? 'selected' : ''}`}
          >
            <RadioGroupItem value={c} />
            <span className="circuit-number">0{i + 1}</span>
            <span>{CIRCUIT_INFO[c].short}</span>
          </label>
        ))}
      </RadioGroup>
      <div className="workspace-stack">
        <section className="panel schematic-panel">
          <div className="section-heading">
            <div className="heading-group">
              <span className="section-index">01</span>
              <div>
                <h2>{info.name}</h2>
                <span className="small-muted">{info.tag}</span>
              </div>
            </div>
            <span className="pill">
              {isComp ? 'Open loop' : 'Negative feedback'}
            </span>
          </div>
          <Schematic config={config} />
          <div className="circuit-explanation">
            <p>{info.description}</p>
            <div className="equation-block">
              <div className="equation-symbolic">
                {formula.symbolic.map((line) => (
                  <MathExpression key={line.tex} {...line} />
                ))}
              </div>
              <div className="equation-numeric">
                {formula.numeric.map((line) => (
                  <MathExpression key={line.tex} {...line} />
                ))}
              </div>
              {formula.supporting && (
                <div className="equation-supporting">
                  {formula.supporting.map((line) => (
                    <MathExpression key={line.tex} {...line} />
                  ))}
                </div>
              )}
              <p className="equation-note">{formula.note}</p>
            </div>
            <section className="application-note">
              <span className="eyebrow">WHEN TO USE IT</span>
              <p>{info.use}</p>
              <span className="small-muted">
                Different configurations of the same basic op-amp.
              </span>
            </section>
          </div>
        </section>
        <div className="instrument-grid">
          <Oscilloscope config={config} metrics={result.metrics} />
          <aside className="control-column">
            <section className="panel controls-panel">
              <div className="section-heading">
                <div className="heading-group">
                  <SlidersHorizontal size={16} />
                  <h2>Parameters</h2>
                </div>
              </div>
              <Tabs
                value={paramTab}
                onValueChange={(v) => setParamTab(String(v))}
                className="parameter-tabs"
              >
                <TabsList className="w-full">
                  <TabsTrigger value="signal">Signal</TabsTrigger>
                  <TabsTrigger value="circuit">Circuit</TabsTrigger>
                </TabsList>
                <TabsContent value="signal">
                  <div className="tab-inner">
                    <div className="control-section-title">
                      <span className="trace-swatch input" />
                      <h3>Input 1</h3>
                    </div>
                    <SourceControls
                      source={config.source}
                      label="Input 1"
                      onChange={(source) => apply({ ...config, source })}
                    />
                    {config.circuit === 'summing' && (
                      <>
                        <hr />
                        <div className="control-section-title">
                          <span className="trace-swatch second" />
                          <h3>Input 2</h3>
                        </div>
                        <SourceControls
                          source={config.second}
                          label="Input 2"
                          onChange={(second) => apply({ ...config, second })}
                        />
                      </>
                    )}
                    <p className="control-hint">
                      Amplitude is measured from the DC offset to the peak.
                      Peak-to-peak voltage is twice the amplitude.
                    </p>
                  </div>
                </TabsContent>
                <TabsContent value="circuit">
                  <div className="tab-inner">
                    <h3>Components & reference</h3>
                    {!['buffer', 'comparator'].includes(config.circuit) && (
                      <>
                        <Field
                          label="Feedback Rf"
                          value={p.rf}
                          min={1000}
                          max={100000}
                          step={1}
                          scale={1000}
                          unit="kΩ"
                          onChange={(v) => setComponent('rf', v)}
                        />
                        {config.circuit === 'noninverting' ? (
                          <Field
                            label="Divider Rg"
                            value={p.rg}
                            min={1000}
                            max={100000}
                            step={1}
                            scale={1000}
                            unit="kΩ"
                            onChange={(v) => setComponent('rg', v)}
                          />
                        ) : (
                          <Field
                            label="Input Rin"
                            value={p.rin}
                            min={1000}
                            max={100000}
                            step={1}
                            scale={1000}
                            unit="kΩ"
                            onChange={(v) => setComponent('rin', v)}
                          />
                        )}
                        {config.circuit === 'summing' && (
                          <Field
                            label="Input 2 R₂"
                            value={p.r2}
                            min={1000}
                            max={100000}
                            step={1}
                            scale={1000}
                            unit="kΩ"
                            onChange={(v) => setComponent('r2', v)}
                          />
                        )}
                        {config.circuit === 'lowpass' && (
                          <Field
                            label="Feedback capacitor C"
                            value={p.capacitance}
                            min={1e-10}
                            max={1e-5}
                            step={0.1}
                            scale={1e-9}
                            log
                            unit="nF"
                            onChange={(v) => setComponent('capacitance', v)}
                          />
                        )}
                      </>
                    )}
                    {config.circuit !== 'buffer' ? (
                      <Field
                        label={isComp ? 'Threshold Vref' : 'Reference Vref'}
                        value={p.reference}
                        min={-10}
                        max={10}
                        step={0.1}
                        unit="V"
                        onChange={(v) => setComponent('reference', v)}
                      />
                    ) : (
                      <p className="control-hint">
                        The feedback is a direct wire. No gain-setting resistors
                        or reference are needed.
                      </p>
                    )}
                    {isComp && (
                      <>
                        <Field
                          label="Output LOW"
                          value={p.outputLow}
                          min={-15}
                          max={p.outputHigh - 0.1}
                          step={0.1}
                          unit="V"
                          onChange={(v) => setComponent('outputLow', v)}
                        />
                        <Field
                          label="Output HIGH"
                          value={p.outputHigh}
                          min={p.outputLow + 0.1}
                          max={15}
                          step={0.1}
                          unit="V"
                          onChange={(v) => setComponent('outputHigh', v)}
                        />
                      </>
                    )}
                    <div className="input-note">
                      <Info size={16} />
                      <p>{info.input}</p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
              {error && (
                <p role="alert" className="config-error">
                  {error}
                </p>
              )}
            </section>
          </aside>
        </div>
      </div>
      <details className="model-note">
        <summary>
          <Info size={17} />
          What this model includes
          <ChevronDown size={16} />
        </summary>
        <div>
          <p>
            <strong>A generic ideal teaching model.</strong> It assumes infinite
            op-amp input impedance, zero output impedance, and unlimited speed
            and output swing. The low-pass circuit still includes the response
            of its external resistor and capacitor.
          </p>
          <p>
            The filter’s steady periodic response is calculated before plotting.
            The scope uses a fixed 4 ms time window; measured waveform values
            use four cycles of the fastest input.
          </p>
          <p>
            Noise, input bias current, source loading, common-mode restrictions,
            output-current limits, bandwidth, slew rate, clipping, stability,
            hysteresis, and overload recovery are not simulated. The comparator
            switches instantly and goes HIGH at equality by convention.
          </p>
          <p className="model-sources">
            Learn more:{' '}
            <a
              href="https://www.analog.com/en/resources/analog-dialogue/studentzone/studentzone-may-2019.html"
              target="_blank"
              rel="noreferrer"
            >
              Basic op-amp configurations
            </a>
            <a
              href="https://www.ti.com/lit/an/sboa293a/sboa293a.pdf"
              target="_blank"
              rel="noreferrer"
            >
              TI low-pass design
            </a>
            <a
              href="https://www.analog.com/media/en/technical-documentation/application-notes/an-849.pdf"
              target="_blank"
              rel="noreferrer"
            >
              Op-amps as comparators
            </a>
          </p>
        </div>
      </details>
      <footer className="lab-footer">
        <span>
          <Activity size={15} />
          Op-Amp Lab
        </span>
      </footer>
    </main>
  );
}
