'use client';
import { useMemo, useState } from 'react';
import { Crosshair } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Choice } from './controls';
import { useWidth } from './schematic';
import {
  engineering as eng,
  simulate,
  type Config,
  type Sample,
  type Simulation,
} from '@/lib/opamp/simulator';

const TIME_PER_DIVISION = 0.0005;
const HORIZONTAL_DIVISIONS = 8;
const TIME_WINDOW = TIME_PER_DIVISION * HORIZONTAL_DIVISIONS;
const SCOPE_SAMPLE_STEPS = 8191;

export function Oscilloscope({
  config,
  metrics,
}: {
  config: Config;
  metrics: Simulation['metrics'];
}) {
  const { ref, width: w } = useWidth(),
    [scale, setScale] = useState('auto'),
    [center, setCenter] = useState(0),
    [cursor, setCursor] = useState(0.0625);
  const scopeResult = useMemo(
    () =>
      simulate(config, {
        duration: TIME_WINDOW,
        steps: SCOPE_SAMPLE_STEPS,
      }),
    [config],
  );
  const sum = config.circuit === 'summing';
  const left = w < 440 ? 55 : 68,
    right = 22,
    top = 22,
    bottom = 44,
    height = 300,
    pw = w - left - right,
    ph = height - top - bottom;
  const [min, max] = useMemo(() => {
    if (scale !== 'auto')
      return [center - 4 * Number(scale), center + 4 * Number(scale)];
    const reference =
      config.circuit === 'comparator' ? config.components.reference : 0;
    let lo = Math.min(0, reference),
      hi = Math.max(0, reference);
    for (const s of scopeResult.samples) {
      lo = Math.min(lo, s.input, s.output, sum ? s.second : Infinity);
      hi = Math.max(hi, s.input, s.output, sum ? s.second : -Infinity);
    }
    const padding = Math.max((hi - lo) * 0.1, 0.1);
    lo -= padding;
    hi += padding;
    const raw = (hi - lo) / 6,
      pow = 10 ** Math.floor(Math.log10(raw)),
      step = [1, 2, 2.5, 5, 10].find((n) => n * pow >= raw)! * pow;
    return [Math.floor(lo / step) * step, Math.ceil(hi / step) * step];
  }, [
    scopeResult,
    scale,
    center,
    sum,
    config.circuit,
    config.components.reference,
  ]);
  const x = (t: number) => left + (t / scopeResult.duration) * pw,
    y = (v: number) => top + ((max - v) / (max - min)) * ph;
  const paths = useMemo(() => {
    const makePath = (key: keyof Omit<Sample, 'time'>) =>
      scopeResult.samples
        .map((sample, index) => {
          const px = left + (sample.time / scopeResult.duration) * pw;
          const py = top + ((max - sample[key]) / (max - min)) * ph;
          return `${index ? 'L' : 'M'}${px.toFixed(2)} ${py.toFixed(2)}`;
        })
        .join('');
    return {
      input: makePath('input'),
      output: makePath('output'),
      second: sum ? makePath('second') : '',
    };
  }, [scopeResult, left, pw, top, max, min, ph, sum]);
  const t = cursor * scopeResult.duration,
    position = cursor * (scopeResult.samples.length - 1),
    i = Math.min(Math.floor(position), scopeResult.samples.length - 2),
    u = position - i;
  const read = (key: keyof Omit<Sample, 'time'>) =>
    scopeResult.samples[i][key] +
    (scopeResult.samples[i + 1][key] - scopeResult.samples[i][key]) * u;
  const tickCount = HORIZONTAL_DIVISIONS,
    timeFactor =
      scopeResult.duration < 0.001 ? 1e6 : scopeResult.duration < 1 ? 1e3 : 1,
    timeUnit = timeFactor === 1e6 ? 'µs' : timeFactor === 1e3 ? 'ms' : 's';
  const outOfRange = scopeResult.samples.some(
    (s) =>
      s.output < min ||
      s.output > max ||
      s.input < min ||
      s.input > max ||
      (sum && (s.second < min || s.second > max)),
  );
  return (
    <section className="panel scope-panel">
      <div className="section-heading">
        <div className="heading-group">
          <span className="section-index">02</span>
          <h2>Oscilloscope</h2>
        </div>
        <span className="scope-live">
          <span /> 0.5 ms/div · LIVE RESPONSE
        </span>
      </div>
      <div className="scope-overview">
        <div className="scope-legend">
          {config.circuit === 'comparator' && (
            <span>
              <i className="trace-swatch reference" />
              Reference {eng(config.components.reference, 'V')}
            </span>
          )}
          <span>
            <i className="trace-swatch input" />
            Input 1
          </span>
          {sum && (
            <span>
              <i className="trace-swatch second" />
              Input 2
            </span>
          )}
          <span>
            <i className="trace-swatch output" />
            Output
          </span>
        </div>
        <div className="scope-metrics" aria-live="polite" aria-atomic="true">
          <div>
            <span>
              {config.circuit === 'summing'
                ? 'Input 1 weight'
                : config.circuit === 'lowpass'
                  ? 'DC gain · theoretical'
                  : 'Gain · theoretical'}
            </span>
            <strong>
              {metrics.gain === null
                ? 'Switching'
                : `${Number(metrics.gain.toPrecision(4)) > 0 ? '+' : ''}${Number(metrics.gain.toPrecision(4))}`}
              <small>{metrics.gain !== null ? 'V/V' : ''}</small>
            </strong>
          </div>
          <div>
            <span>Output swing · measured</span>
            <strong>
              {eng(metrics.outputVpp, 'V')}
              <small>peak to peak</small>
            </strong>
          </div>
          <div>
            <span>
              {metrics.cutoff ? 'Filter cutoff' : 'Output range · measured'}
            </span>
            <strong className="scope-metric-wide">
              {metrics.cutoff
                ? eng(metrics.cutoff, 'Hz')
                : `${eng(metrics.outputMin, 'V')} → ${eng(metrics.outputMax, 'V')}`}
            </strong>
          </div>
        </div>
      </div>
      <div ref={ref} className="scope-surface">
        <svg
          viewBox={`0 0 ${w} ${height}`}
          style={{ height }}
          className="scope-svg"
          role="img"
          aria-label={`Fixed 4 ms time window at 0.5 ms per division. Output ranges from ${eng(scopeResult.metrics.outputMin, 'V')} to ${eng(scopeResult.metrics.outputMax, 'V')}.`}
        >
          <defs>
            <clipPath id="scope-clip">
              <rect x={left} y={top} width={pw} height={ph} />
            </clipPath>
          </defs>
          {Array.from({ length: 9 }, (_, j) => {
            const v = min + ((max - min) * j) / 8;
            return (
              <g key={'y' + j}>
                <path
                  className={Math.abs(v) < 1e-10 ? 'scope-zero' : 'scope-grid'}
                  d={`M${left} ${y(v)}H${w - right}`}
                />
                {j % 2 === 0 && (
                  <text x={left - 10} y={y(v) + 4} textAnchor="end">
                    {Number(v.toPrecision(3))}
                  </text>
                )}
              </g>
            );
          })}
          {Array.from({ length: tickCount + 1 }, (_, j) => {
            const tx = left + (pw * j) / tickCount;
            return (
              <g key={'x' + j}>
                <path
                  className="scope-grid"
                  d={`M${tx} ${top}V${height - bottom}`}
                />
                <text
                  x={tx}
                  y={height - bottom + 21}
                  textAnchor={
                    j === 0 ? 'start' : j === tickCount ? 'end' : 'middle'
                  }
                >
                  {Number(
                    (
                      (scopeResult.duration * timeFactor * j) /
                      tickCount
                    ).toPrecision(3),
                  )}
                </text>
              </g>
            );
          })}
          <text x={16} y={17}>
            V
          </text>
          <text x={w - right} y={height - 4} textAnchor="end">
            Time ({timeUnit})
          </text>
          <g clipPath="url(#scope-clip)">
            {config.circuit === 'comparator' && (
              <path
                className="scope-reference"
                d={`M${left} ${y(config.components.reference)}H${w - right}`}
              />
            )}
            <path
              d={paths.input}
              className="trace input"
              style={{ strokeWidth: config.circuit === 'buffer' ? 3.5 : 2 }}
            />
            {sum && <path d={paths.second} className="trace second" />}
            <path
              d={paths.output}
              className="trace output"
              strokeDasharray={config.circuit === 'buffer' ? '7 5' : undefined}
            />
            <path
              d={`M${x(t)} ${top}V${height - bottom}`}
              className="cursor-line"
            />
            <circle
              cx={x(t)}
              cy={y(read('input'))}
              r={4}
              className="cursor-dot input"
            />
            <circle
              cx={x(t)}
              cy={y(read('output'))}
              r={4}
              className="cursor-dot output"
            />
            {sum && (
              <circle
                cx={x(t)}
                cy={y(read('second'))}
                r={4}
                className="cursor-dot second"
              />
            )}
          </g>
          <rect
            x={left}
            y={top}
            width={pw}
            height={ph}
            fill="transparent"
            style={{ touchAction: 'pan-y', cursor: 'crosshair' }}
            onPointerMove={(e) => {
              if (e.pointerType === 'mouse' || e.buttons) {
                const box =
                  e.currentTarget.ownerSVGElement!.getBoundingClientRect();
                setCursor(
                  Math.min(1, Math.max(0, (e.clientX - box.left - left) / pw)),
                );
              }
            }}
            onPointerDown={(e) => {
              const box =
                e.currentTarget.ownerSVGElement!.getBoundingClientRect();
              setCursor(
                Math.min(1, Math.max(0, (e.clientX - box.left - left) / pw)),
              );
            }}
          />
        </svg>
      </div>
      <div className="cursor-readout">
        <span>
          <Crosshair size={14} />
          {eng(t, 's')}
        </span>
        <span className="input-text">In {eng(read('input'), 'V')}</span>
        {sum && (
          <span className="second-text">In 2 {eng(read('second'), 'V')}</span>
        )}
        <span className="output-text">Out {eng(read('output'), 'V')}</span>
      </div>
      <div className="scope-controls">
        <div className="cursor-control">
          <label htmlFor="time-cursor">Time cursor</label>
          <Slider
            id="time-cursor"
            aria-label="Time cursor"
            aria-valuetext={eng(t, 's')}
            min={0}
            max={100}
            step={0.1}
            value={[cursor * 100]}
            onValueChange={(v) =>
              setCursor((Array.isArray(v) ? v[0] : v) / 100)
            }
          />
        </div>
        <Choice
          label="Vertical scale"
          value={scale}
          options={[
            { value: 'auto', label: 'Auto fit' },
            ...['0.1', '0.2', '0.5', '1', '2', '5', '10'].map((n) => ({
              value: n,
              label: `${n} V / div`,
            })),
          ]}
          onChange={setScale}
        />
        {scale !== 'auto' && (
          <div className="choice-field">
            <label htmlFor="scope-center">Center (V)</label>
            <Input
              id="scope-center"
              type="number"
              value={center}
              min={-1000}
              max={1000}
              step={0.5}
              onChange={(e) => {
                if (
                  e.target.value !== '' &&
                  Number.isFinite(e.target.valueAsNumber)
                )
                  setCenter(
                    Math.max(-1000, Math.min(1000, e.target.valueAsNumber)),
                  );
              }}
            />
          </div>
        )}
      </div>
      <div className="scope-caption">
        {outOfRange
          ? 'Some traces are outside the manual range. Choose Auto fit to see the full signal.'
          : 'Output follows the ideal circuit equation.'}{' '}
        Time scale is fixed at 0.5 ms/div.
      </div>
    </section>
  );
}
