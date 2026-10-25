import { useId } from 'react';
import { useWidth } from '@/components/lab/schematic';
import {
  COLORS,
  BASELINE,
  familyGain,
  type Family,
} from '@/lib/noise-learning/model';
export type Series = {
  name: string;
  color: string;
  values: number[];
  dash?: boolean;
  dots?: boolean;
};
export function LearningPlot({
  times,
  series,
  title,
  cursor,
  xLabel = 'Time (s)',
  yLabel = 'Voltage (V)',
  logX = false,
  yBounds,
}: {
  times: number[];
  series: Series[];
  title: string;
  cursor?: number;
  xLabel?: string;
  yLabel?: string;
  logX?: boolean;
  yBounds?: [number, number];
}) {
  const { ref, width } = useWidth(),
    id = useId(),
    W = Math.max(280, width),
    H = 265,
    L = W < 420 ? 48 : 58,
    R = 18,
    T = 18,
    B = 44;
  let lo = Infinity,
    hi = -Infinity;
  for (const trace of series)
    for (const v of trace.values) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  if (!Number.isFinite(lo)) {
    lo = 0;
    hi = 1;
  }
  const padding = Math.max(0.1, (hi - lo) * 0.12),
    yMin = yBounds?.[0] ?? lo - padding,
    yMax = yBounds?.[1] ?? hi + padding;
  const transform = (x: number) => (logX ? Math.log10(x) : x),
    start = transform(times[0]),
    span = transform(times[times.length - 1]) - start;
  const x = (v: number) => L + ((transform(v) - start) / span) * (W - L - R),
    y = (v: number) => T + ((yMax - v) / (yMax - yMin)) * (H - T - B);
  const ticks = Array.from({ length: 5 }, (_, i) => i / 4);
  return (
    <figure className="nf-figure" ref={ref}>
      <figcaption>{title}</figcaption>
      <svg
        className="nf-plot"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Horizontal axis ${xLabel}; vertical axis ${yLabel}.`}
      >
        <defs>
          <clipPath id={id}>
            <rect x={L} y={T} width={W - L - R} height={H - T - B} />
          </clipPath>
        </defs>
        {ticks.map((t) => {
          const v = yMin + t * (yMax - yMin);
          return (
            <g key={`y${t}`}>
              <path className="nf-grid" d={`M${L} ${y(v)}H${W - R}`} />
              <text x={L - 8} y={y(v) + 4} textAnchor="end">
                {Number(v.toPrecision(3))}
              </text>
            </g>
          );
        })}
        {ticks.map((t) => {
          const tx = L + t * (W - L - R),
            v = logX
              ? 10 ** (start + t * span)
              : times[0] + t * (times.at(-1)! - times[0]);
          return (
            <g key={`x${t}`}>
              <path className="nf-grid" d={`M${tx} ${T}V${H - B}`} />
              <text x={tx} y={H - B + 20} textAnchor="middle">
                {Number(v.toPrecision(3))}
              </text>
            </g>
          );
        })}
        <g clipPath={`url(#${id})`}>
          {series.map((trace) => (
            <g key={trace.name}>
              <path
                data-series={trace.name}
                d={trace.values
                  .map(
                    (v, i) =>
                      `${i ? 'L' : 'M'}${x(times[i]).toFixed(2)},${y(v).toFixed(2)}`,
                  )
                  .join(' ')}
                fill="none"
                stroke={trace.color}
                strokeWidth="2"
                strokeDasharray={trace.dash ? '6 5' : undefined}
              />
              {trace.dots &&
                trace.values.map((v, i) => (
                  <circle
                    key={i}
                    cx={x(times[i])}
                    cy={y(v)}
                    r="3.5"
                    fill={trace.color}
                  />
                ))}
            </g>
          ))}
          {cursor !== undefined && (
            <path className="nf-cursor" d={`M${x(cursor)} ${T}V${H - B}`} />
          )}
        </g>
        <text x={L} y="12" className="nf-axis-label">
          {yLabel}
        </text>
        <text x={W - R} y={H - 4} textAnchor="end" className="nf-axis-label">
          {xLabel}
        </text>
      </svg>
      <ul className="nf-legend" aria-label={`${title} legend`}>
        {series.map((s) => (
          <li key={s.name}>
            <span
              style={{ background: s.color }}
              className={s.dash ? 'dashed' : ''}
            />
            {s.name}
          </li>
        ))}
      </ul>
    </figure>
  );
}
export function RcDrawing({
  voltage,
  fraction,
}: {
  voltage: number;
  fraction: number;
}) {
  return (
    <div className="nf-rc-visual">
      <svg
        viewBox="0 0 600 220"
        role="img"
        aria-label="Low-pass RC: input through series resistor to output; capacitor from output to ground."
      >
        <g fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M40 70H160M230 70H360V110M360 135V185H40M360 70H530" />
          <rect x="160" y="60" width="70" height="20" />
          <path d="M340 110H380M340 122H380M345 192H375M350 199H370" />
          <circle cx="360" cy="70" r="4" fill="currentColor" />
        </g>
        <g fill="currentColor" fontSize="16">
          <text x="40" y="48">
            Input
          </text>
          <text x="190" y="45" textAnchor="middle">
            R
          </text>
          <text x="400" y="120">
            C
          </text>
          <text x="470" y="48">
            Output
          </text>
          <text x="50" y="174">
            Common ground
          </text>
        </g>
        <rect
          x="465"
          y="95"
          width="75"
          height="90"
          rx="8"
          fill="#142733"
          stroke="#607b8d"
        />
        <rect
          x="470"
          y={180 - 80 * Math.max(0, Math.min(1, fraction))}
          width="65"
          height={80 * Math.max(0, Math.min(1, fraction))}
          rx="4"
          fill={COLORS.rc}
        />
        <text
          x="503"
          y="212"
          textAnchor="middle"
          fill="currentColor"
          fontSize="14"
        >
          {voltage.toFixed(3)} V
        </text>
      </svg>
      <p>
        Capacitor voltage at the cursor. The fill gauge uses a 0–3.3 V scale; it
        is a visual aid, not an ADC model.
      </p>
    </div>
  );
}
export function WindowDrawing({ samples }: { samples: number[] }) {
  const { ref, width } = useWidth(),
    W = Math.max(280, width),
    H = 150,
    spacing = (W - 24) / samples.length,
    scale = 40 / Math.max(0.1, ...samples.map((v) => Math.abs(v - BASELINE)));
  return (
    <div ref={ref}>
      <svg
        className="nf-window"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${samples.length} equally weighted samples in the trailing moving-average window, oldest at left and newest at right.`}
      >
        <path d={`M12 85H${W - 12}`} stroke="#577083" />
        <text x="12" y="18" fill="currentColor" fontSize="12">
          Oldest → newest · equal weights
        </text>
        {samples.map((v, i) => (
          <g key={i}>
            <rect
              x={12 + i * spacing + spacing * 0.12}
              y={85 - Math.max(0, v - BASELINE) * scale}
              width={spacing * 0.76}
              height={Math.abs(v - BASELINE) * scale}
              fill={i === samples.length - 1 ? COLORS.ma : '#657c91'}
            />
            {samples.length <= 9 && (
              <text
                x={12 + (i + 0.5) * spacing}
                y="133"
                textAnchor="middle"
                fill="currentColor"
                fontSize="11"
              >
                {v.toFixed(2)}
              </text>
            )}
          </g>
        ))}
        <text x="12" y="145" fill="currentColor" fontSize="12">
          Bars show deviation from the 1.65 V baseline.
        </text>
      </svg>
    </div>
  );
}
export function EmaDrawing({
  alpha,
  newest,
  previous,
  output,
}: {
  alpha: number;
  newest: number;
  previous: number;
  output: number;
}) {
  return (
    <div className="nf-ema-visual">
      <div style={{ borderColor: COLORS.raw }}>
        <span>Newest sample</span>
        <strong>{newest.toFixed(3)} V</strong>
        <small>{(alpha * 100).toFixed(0)}% weight</small>
      </div>
      <b aria-hidden="true">+</b>
      <div style={{ borderColor: COLORS.ema }}>
        <span>Previous output</span>
        <strong>{previous.toFixed(3)} V</strong>
        <small>{((1 - alpha) * 100).toFixed(0)}% weight</small>
      </div>
      <b aria-hidden="true">→</b>
      <div style={{ borderColor: COLORS.rc }}>
        <span>New output</span>
        <strong>{output.toFixed(3)} V</strong>
      </div>
    </div>
  );
}
export function FamilyDrawing({
  kind,
  corner,
  frequency,
}: {
  kind: Family;
  corner: number;
  frequency: number;
}) {
  const times = Array.from(
      { length: 241 },
      (_, i) => 0.1 * 10 ** ((i / 240) * Math.log10(2000)),
    ),
    gains = times.map((f) => familyGain(kind, f, corner));
  const gain = familyGain(kind, frequency, corner),
    t = Array.from({ length: 501 }, (_, i) => i / 500),
    input = t.map((t) => Math.sin(2 * Math.PI * frequency * t));
  return (
    <>
      <LearningPlot
        title="Frequency selection"
        times={times}
        series={[
          { name: 'Amplitude response', color: COLORS.rc, values: gains },
        ]}
        xLabel="Frequency (Hz, logarithmic)"
        yLabel="Amplitude ratio"
        logX
        yBounds={[0, 1.1]}
        cursor={frequency}
      />
      <LearningPlot
        title="One test tone · amplitude comparison"
        times={t}
        series={[
          { name: 'Input tone', color: COLORS.raw, values: input },
          {
            name: 'Output amplitude (phase omitted)',
            color: COLORS.rc,
            values: input.map((v) => v * gain),
          },
        ]}
        yBounds={[-1.2, 1.2]}
      />
      <p className="nf-observation">
        At {frequency.toFixed(1)} Hz, this response retains{' '}
        <strong>{(gain * 100).toFixed(1)}%</strong> of the input amplitude. The
        output illustration omits phase so you can focus on frequency selection.
      </p>
    </>
  );
}
export const centered = (v: number) => v - BASELINE;
