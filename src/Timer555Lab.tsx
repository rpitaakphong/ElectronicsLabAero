import { startTransition, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/lab/controls';
import { MathExpression } from '@/components/lab/math-expression';
import {
  TimerPinGuide,
  TimerSchematic,
  TimerWaveforms,
} from '@/components/timer555/visuals';
import {
  createSession,
  defaults,
  engineering as eng,
  measuredTiming,
  timer555,
  type TimerConfig,
} from '@/lib/timer555/simulator';
import { INFO } from '@/lib/timer555/content';
import { TopicBreadcrumbs } from './TopicBreadcrumbs';

const VIEW_DEFAULTS = {
  astable: { timeSpan: 0.05, playbackRate: 0.01 },
  monostable: { timeSpan: 5, playbackRate: 0.5 },
};

export default function Timer555Lab() {
  const [config, setConfig] = useState(defaults),
    [playing, setPlaying] = useState(true),
    [timeSpan, setTimeSpan] = useState(VIEW_DEFAULTS.astable.timeSpan),
    [playbackRate, setPlaybackRate] = useState(
      VIEW_DEFAULTS.astable.playbackRate,
    ),
    [pulseFraction, setPulseFraction] = useState(0.05),
    [held, setHeld] = useState(false),
    [revision, setRevision] = useState(0),
    [error, setError] = useState('');
  const [initialSession] = useState(() => createSession(defaults()));
  const sessionRef = useRef(initialSession),
    lastFrame = useRef<number | null>(null);
  const predicted = timer555.predictions(config),
    info = INFO[config.mode];
  useEffect(() => {
    const s = createSession(config);
    sessionRef.current = s;
    lastFrame.current = null;
    setHeld(false);
    setError('');
    setRevision((v) => v + 1);
  }, [config]);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    lastFrame.current = null;
    const tick = (now: number) => {
      // Leave room for navigation to commit while the lesson is playing.
      // The clock still uses elapsed time, not the number of rendered frames.
      if (lastFrame.current !== null && now - lastFrame.current < 1000 / 30) {
        frame = requestAnimationFrame(tick);
        return;
      }
      const dt =
        lastFrame.current === null
          ? 0
          : Math.min((now - lastFrame.current) / 1000, 0.15);
      lastFrame.current = now;
      const s = sessionRef.current;
      try {
        // Playback is an absolute circuit-time / real-time ratio. Component
        // edits must never normalize away their effect on the visible timing.
        s.advance(s.time + dt * playbackRate);
        startTransition(() => setRevision((v) => v + 1));
      } catch (e) {
        setError((e as Error).message);
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, playbackRate, config]);
  const update = (patch: Partial<TimerConfig>) =>
    setConfig((v) => ({ ...v, ...patch }));
  const trigger = () => {
    const s = sessionRef.current;
    s.cancelButtonEvents('S1');
    s.setButton('S1', true);
    s.scheduleButton('S1', false, s.time + predicted.high * pulseFraction);
    setHeld(false);
    setPlaying(true);
    setRevision((v) => v + 1);
  };
  const measured = measuredTiming(sessionRef.current),
    high = sessionRef.current.high;
  const metrics = [
    ['High / pulse width', predicted.high, measured.high, 's'],
    ...(config.mode === 'astable'
      ? [
          [
            'Low time',
            predicted.low,
            measured.period && measured.high
              ? measured.period - measured.high
              : null,
            's',
          ],
          ['Frequency', predicted.frequency, measured.frequency, 'Hz'],
          ['Duty cycle', predicted.duty, measured.duty, '%'],
        ]
      : []),
  ] as [string, number | null, number | null, string][];
  return (
    <main id="main-content" tabIndex={-1} className="lab-shell timer-learning">
      <TopicBreadcrumbs />
      <div className="intro page-heading">
        <div>
          <span className="eyebrow">CHARGE → COMPARE → SWITCH</span>
          <h1>555 Timer Interactive Learning</h1>
          <p>
            Explore a repeating oscillator and a triggered pulse. Predict the
            timing, then watch the capacitor switch the output.
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            setConfig(defaults());
            setPlaying(true);
            setTimeSpan(VIEW_DEFAULTS.astable.timeSpan);
            setPlaybackRate(VIEW_DEFAULTS.astable.playbackRate);
            setPulseFraction(0.05);
          }}
        >
          <RotateCcw size={15} />
          Reset lab
        </Button>
      </div>
      <div
        className="timer-mode-picker"
        role="group"
        aria-label="555 operating mode"
      >
        {(['astable', 'monostable'] as const).map((mode, i) => (
          <button
            key={mode}
            aria-pressed={config.mode === mode}
            className={config.mode === mode ? 'selected' : ''}
            onClick={() => {
              setConfig(defaults(mode));
              setPlaying(mode === 'astable');
              setTimeSpan(VIEW_DEFAULTS[mode].timeSpan);
              setPlaybackRate(VIEW_DEFAULTS[mode].playbackRate);
            }}
          >
            <span>0{i + 1}</span>
            {INFO[mode].name}
            <small>
              {mode === 'astable'
                ? 'Continuous pulses'
                : 'One pulse per trigger'}
            </small>
          </button>
        ))}
      </div>
      <section className="panel">
        <div className="section-heading">
          <h2>{info.name}</h2>
          <span className={`pill ${high ? 'timer-output-high' : ''}`}>
            Output {high ? 'HIGH' : 'LOW'}
          </span>
        </div>
        <div className="timer-theory-grid">
          <TimerSchematic config={config} high={high} />
          <div>
            <p>{info.description}</p>
            <MathExpression tex={info.equation} label="Timing equation" />
            <MathExpression
              tex={info.secondEquation}
              label="Frequency, duty cycle, or capacitor charging equation"
            />
            <p className="timer-path-note">
              {high
                ? config.mode === 'astable'
                  ? 'Charging through R1 + R2. Pin 7 is open.'
                  : 'Charging through R. Pin 7 is open.'
                : 'Pin 7 discharges the timing capacitor.'}
            </p>
            <p className="small-muted">
              Predictions assume nominal components and default comparator
              thresholds. Measured values come from the shared circuit model.
            </p>
          </div>
        </div>
      </section>
      {error && <p role="alert">{error}</p>}
      <div className="timer-workbench">
        <div className="timer-results">
          <TimerWaveforms
            session={sessionRef.current}
            window={timeSpan}
            revision={revision}
          />
          <section className="panel">
            <div className="section-heading">
              <h2>Predict and measure</h2>
              <span className="small-muted">Simulated results</span>
            </div>
            <div className="timer-metric-table">
              <table>
                <thead>
                  <tr>
                    <th>Quantity</th>
                    <th>Predicted</th>
                    <th>Measured</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map(([label, p, m, u]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      <td>{eng(p, u)}</td>
                      <td>{eng(m, u)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small-muted">
              {config.mode === 'monostable'
                ? 'A one-shot has no repeating frequency or duty cycle. A completed output pulse is required to measure its width.'
                : 'Measurements use completed transitions after startup. Playback speed does not change circuit timing.'}
            </p>
          </section>
          <section className="panel">
            <h2>Try an experiment</h2>
            <ol className="timer-experiments">
              {info.experiments.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ol>
            <p className="timer-application">{info.application}</p>
            <Link className="topic-link" to="/555-timer/simulator">
              Build this circuit on the breadboard →
            </Link>
          </section>
        </div>
        <aside className="panel timer-parameters">
          <h2>Timing controls</h2>
          <Field
            label={config.mode === 'astable' ? 'R1' : 'Timing resistance R'}
            value={config.r1}
            min={1000}
            max={1e6}
            scale={1000}
            unit="kΩ"
            log
            onChange={(v) => update({ r1: v })}
          />
          {config.mode === 'astable' && (
            <Field
              label="R2"
              value={config.r2}
              min={1000}
              max={1e6}
              scale={1000}
              unit="kΩ"
              log
              onChange={(v) => update({ r2: v })}
            />
          )}
          <Field
            label="Timing capacitor C"
            value={config.c}
            min={1e-9}
            max={100e-6}
            scale={1e-6}
            unit="µF"
            log
            step={0.01}
            onChange={(v) => update({ c: v })}
          />
          <Field
            label="Supply voltage"
            value={config.vcc}
            min={5}
            max={15}
            unit="V"
            step={0.5}
            onChange={(v) => update({ vcc: v })}
          />
          <dl className="timer-thresholds">
            <div>
              <dt>Trigger threshold</dt>
              <dd>{eng(config.vcc / 3, 'V')}</dd>
            </div>
            <div>
              <dt>Upper threshold</dt>
              <dd>{eng((config.vcc * 2) / 3, 'V')}</dd>
            </div>
          </dl>
          <section
            className="timer-view-controls"
            aria-labelledby="timer-view-title"
          >
            <h3 id="timer-view-title">Fixed display scale</h3>
            <Field
              label="Time span"
              value={timeSpan}
              min={1e-6}
              max={1000}
              scale={1e-3}
              unit="ms"
              step={0.01}
              log
              onChange={setTimeSpan}
            />
            <Field
              label="Playback rate"
              value={playbackRate}
              min={1e-7}
              max={1000}
              scale={1e-3}
              unit="ms / real s"
              step={0.01}
              log
              onChange={setPlaybackRate}
            />
            <p className="small-muted">
              One real second advances {eng(playbackRate, 's')} of circuit time.
              These settings stay fixed when R or C changes.
            </p>
            <p className="small-muted">
              {config.mode === 'astable' ? 'One cycle' : 'Predicted pulse'}:{' '}
              {eng(predicted.period ?? predicted.high, 's')}. Adjust Time span
              to see more or fewer pulses; Playback rate only changes how fast
              the animation runs.
            </p>
          </section>
          <div className="timer-playback">
            <Button variant="secondary" onClick={() => setPlaying((v) => !v)}>
              {playing ? <Pause size={15} /> : <Play size={15} />}{' '}
              {playing ? 'Pause' : 'Play'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setConfig((v) => ({ ...v }))}
            >
              <RotateCcw size={15} />
              Restart timing
            </Button>
          </div>
          {config.mode === 'monostable' && (
            <div className="timer-trigger-controls">
              <h3>Trigger and reset</h3>
              <label className="timer-select-label">
                Trigger duration
                <select
                  value={pulseFraction}
                  onChange={(e) => setPulseFraction(Number(e.target.value))}
                >
                  <option value=".05">Brief · 5% of predicted width</option>
                  <option value=".5">50% of predicted width</option>
                  <option value="1.5">Long · 150% of predicted width</option>
                </select>
              </label>
              <Button onClick={trigger}>Trigger pulse</Button>
              <label className="timer-hold">
                <input
                  type="checkbox"
                  checked={held}
                  onChange={(e) => {
                    setHeld(e.target.checked);
                    sessionRef.current.cancelButtonEvents('S1');
                    sessionRef.current.setButton('S1', e.target.checked);
                    setPlaying(true);
                    setRevision((v) => v + 1);
                  }}
                />
                Hold trigger low
              </label>
              <Button
                variant="secondary"
                onClick={() => {
                  const s = sessionRef.current;
                  s.setButton('Sreset', true);
                  s.scheduleButton(
                    'Sreset',
                    false,
                    s.time + predicted.high * 0.01,
                  );
                  setPlaying(true);
                  setRevision((v) => v + 1);
                }}
              >
                Reset pulse
              </Button>
            </div>
          )}
        </aside>
      </div>
      <details className="panel timer-internals">
        <summary>Inside the NE555 · pin guide and model notes</summary>
        <div className="timer-internals-grid">
          <TimerPinGuide />
          <div>
            <h2>Two comparisons and one memory</h2>
            <div className="timer-block-diagram">
              <span>⅓ / ⅔ VCC divider</span>
              <span>Trigger / threshold comparators</span>
              <span>SR latch · reset has priority</span>
              <span>Output driver + discharge switch</span>
            </div>
            <p>
              The trigger comparator sets the latch; the threshold comparator
              clears it when the trigger is no longer low. Pin 4 resets the
              latch at any time. Pin 5 changes the comparison levels.
            </p>
            <p className="small-muted">
              Shared educational NE555 model: nominal divider and comparator
              thresholds, 1 Ω discharge switch, 50 Ω output drive with
              approximate high/low levels VCC − 1.2 V / 0.1 V. Component
              tolerances, temperature, switch bounce, and transistor-level
              behavior are not modeled. Results are simulated, not physical
              measurements.
            </p>
            <a
              className="topic-link"
              href="https://www.ti.com/lit/ds/symlink/ne555.pdf"
              target="_blank"
              rel="noreferrer"
            >
              NE555 manufacturer datasheet ↗
            </a>
          </div>
        </div>
      </details>
    </main>
  );
}
