import type { RcFilterConfig, RcResult } from '@/lib/rc/simulator';
import { engineering as eng } from '@/lib/rc/simulator';
import { useWidth } from '@/components/lab/schematic';
import { INFO } from '@/lib/rc/content';
export function RcSchematic({ config }: { config: RcFilterConfig }) {
  const p = config.circuits[config.kind],
    band = config.kind === 'bandpass',
    high = config.kind !== 'lowpass';
  const part = (
    x: number,
    y: number,
    capacitor: boolean,
    label: string,
    horizontal = false,
  ) => (
    <g transform={`translate(${x} ${y})`}>
      <g transform={horizontal ? 'rotate(-90)' : undefined}>
        {capacitor ? (
          <path d="M0 -40V-7M-19 -7H19M-19 7H19M0 7V40" />
        ) : (
          <path d="M0 -40V-26H-12V26H12V-26H0M0 26V40" />
        )}
      </g>
      <text
        x={horizontal ? 0 : 24}
        y={horizontal ? -25 : 5}
        textAnchor={horizontal ? 'middle' : 'start'}
      >
        {label}
      </text>
    </g>
  );
  return (
    <svg
      className="rc-schematic"
      viewBox="0 0 760 300"
      role="img"
      aria-label={`${INFO[config.kind].name} circuit${p.loaded ? ' with output load' : ''}`}
    >
      <g fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M70 100V65H180M260 65H340V105M70 180V250H680M340 185V250" />
        <circle cx="70" cy="140" r="40" />
        <path d="M48 140Q59 118 70 140T92 140M52 263H88M58 270H82M65 277H75" />
        {part(
          220,
          65,
          high,
          `${high ? 'C1' : 'R1'} · ${eng(high ? p.c1 : p.r1, high ? 'F' : 'Ω')}`,
          true,
        )}
        {part(
          340,
          145,
          !high,
          `${high ? 'R1' : 'C1'} · ${eng(high ? p.r1 : p.c1, high ? 'Ω' : 'F')}`,
        )}
        {band ? (
          <>
            <path d="M340 65H440M520 65H570V105M570 185V250M570 65H690" />
            {part(480, 65, false, `R2 · ${eng(p.r2, 'Ω')}`, true)}
            {part(570, 145, true, `C2 · ${eng(p.c2, 'F')}`)}
          </>
        ) : (
          <path d="M340 65H690" />
        )}
        {p.loaded && (
          <>
            <path d="M680 65V105M680 185V250" />
            {part(680, 145, false, `RL`)}
          </>
        )}
        <circle cx="690" cy="65" r="4" fill="currentColor" />
      </g>
      <g fill="currentColor">
        <text x="35" y="205">
          Vin
        </text>
        <text x="685" y="45">
          Vout
        </text>
        {p.loaded && (
          <text x="595" y="225">
            RL = {eng(p.load, 'Ω')}
          </text>
        )}
      </g>
    </svg>
  );
}
const H = 215,
  L = 72,
  R = 24,
  T = 22,
  B = 45;
function Plot({
  points,
  xMin,
  xMax,
  yMin,
  yMax,
  logX = false,
  xUnit,
  yUnit,
  label,
  markers = [],
}: {
  points: { x: number; y: number }[][];
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  logX?: boolean;
  xUnit: string;
  yUnit: string;
  label: string;
  markers?: { x: number; label: string; selected?: boolean }[];
}) {
  const { ref, width } = useWidth();
  const W = Math.max(320, width || 760);
  const transform = (x: number) => (logX ? Math.log10(Math.max(x, 1e-30)) : x),
    min = transform(xMin),
    span = transform(xMax) - min;
  const x = (v: number) => L + ((transform(v) - min) / span) * (W - L - R),
    y = (v: number) => T + ((yMax - v) / (yMax - yMin)) * (H - T - B);
  return (
    <div ref={ref}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="rc-plot"
        role="img"
        aria-label={label}
      >
        {Array.from({ length: 5 }, (_, i) => {
          const v = yMin + ((yMax - yMin) * i) / 4;
          return (
            <g key={`y${i}`}>
              <path className="rc-grid" d={`M${L} ${y(v)}H${W - R}`} />
              <text x={L - 12} y={y(v) + 4} textAnchor="end">
                {Number(v.toPrecision(3))}
              </text>
            </g>
          );
        })}
        {Array.from({ length: 5 }, (_, i) => {
          const v = logX
            ? 10 ** (min + (span * i) / 4)
            : xMin + ((xMax - xMin) * i) / 4;
          return (
            <g key={`x${i}`}>
              <path className="rc-grid" d={`M${x(v)} ${T}V${H - B}`} />
              <text x={x(v)} y={H - 22} textAnchor="middle">
                {eng(v, xUnit)}
              </text>
            </g>
          );
        })}
        <text x="12" y="14">
          {yUnit}
        </text>
        {markers.map((m, i) => (
          <g key={i}>
            <path
              className={m.selected ? 'rc-marker selected' : 'rc-marker'}
              d={`M${x(m.x)} ${T}V${H - B}`}
            />
            <title>
              {m.label}: {eng(m.x, 'Hz')}
            </title>
          </g>
        ))}
        {points.map((series, i) => (
          <path
            key={i}
            className={`rc-trace trace-${i}`}
            d={series
              .map(
                (p, j) =>
                  `${j ? 'L' : 'M'}${x(p.x).toFixed(2)},${y(Math.max(yMin, Math.min(yMax, p.y))).toFixed(2)}`,
              )
              .join(' ')}
          />
        ))}
      </svg>
    </div>
  );
}
export function RcFrequencyPlots({ result }: { result: RcResult }) {
  const markers = [
    ...result.cutoffs.map((x) => ({ x, label: 'Half-power frequency' })),
    {
      x: result.selected.frequency,
      label: 'Selected frequency',
      selected: true,
    },
  ];
  const min = result.sweep[0].frequency,
    max = result.sweep.at(-1)!.frequency;
  return (
    <section className="panel rc-frequency">
      <div className="section-heading">
        <h2>Frequency response</h2>
        <span className="pill">Sinusoidal transfer function</span>
      </div>
      <Plot
        points={[result.sweep.map((p) => ({ x: p.frequency, y: p.db }))]}
        xMin={min}
        xMax={max}
        yMin={Math.floor(Math.min(...result.sweep.map((p) => p.db)) / 20) * 20}
        yMax={0}
        logX
        xUnit="Hz"
        yUnit="dB"
        label="Gain in decibels versus logarithmic frequency"
        markers={markers}
      />
      <Plot
        points={[result.sweep.map((p) => ({ x: p.frequency, y: p.phase }))]}
        xMin={min}
        xMax={max}
        yMin={-90}
        yMax={90}
        logX
        xUnit="Hz"
        yUnit="°"
        label="Output phase relative to input versus logarithmic frequency"
        markers={markers}
      />
      <p className="rc-caption">
        At {eng(result.selected.frequency, 'Hz')}:{' '}
        {result.selected.db.toFixed(2)} dB · {result.selected.phase.toFixed(1)}
        °. Teal: selected frequency. Dashed: −3 dB relative to passband or peak.
      </p>
    </section>
  );
}
export function RcTimePlot({
  result,
  step,
}: {
  result: RcResult;
  step: boolean;
}) {
  const ys = result.samples.flatMap((p) => [p.input, p.output]),
    min = Math.min(0, ...ys),
    max = Math.max(0, ...ys),
    pad = Math.max(0.1, (max - min) * 0.12);
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>{step ? 'Step response' : 'Input and output'}</h2>
        <span className="small-muted">Vin · teal / Vout · amber</span>
      </div>
      <Plot
        points={['input', 'output'].map((key) =>
          result.samples.map((p) => ({
            x: p.time,
            y: p[key as 'input' | 'output'],
          })),
        )}
        xMin={0}
        xMax={result.duration}
        yMin={min - pad}
        yMax={max + pad}
        xUnit="s"
        yUnit="V"
        label={
          step
            ? 'RC response to a positive voltage step'
            : 'Four periods of input and steady-state output'
        }
      />
      <p className="rc-caption">
        {step
          ? 'Initially uncharged capacitors. Eight times the slowest circuit time constant.'
          : 'Periodic steady state over four cycles. Frequency plots describe sine-wave gain and phase, even when the input waveform is square or triangle.'}
      </p>
    </section>
  );
}
