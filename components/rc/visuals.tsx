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
  B = 45;
type Marker = {
  x: number;
  label: string;
  selected?: boolean;
  role?: 'useful' | 'interference';
  annotation?: string;
};
function Plot({
  points,
  traceClasses = [],
  seriesLabels = [],
  stems = false,
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
  traceClasses?: string[];
  seriesLabels?: string[];
  stems?: boolean;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  logX?: boolean;
  xUnit: string;
  yUnit: string;
  label: string;
  markers?: Marker[];
}) {
  const { ref, width } = useWidth();
  const W = Math.max(320, width || 760);
  const transform = (x: number) => (logX ? Math.log10(Math.max(x, 1e-30)) : x),
    min = transform(xMin),
    span = transform(xMax) - min;
  const x = (v: number) => L + ((transform(v) - min) / span) * (W - L - R);
  // Stack nearby labels, and combine coincident tones, without moving their markers.
  const annotations: { x: number; text: string; row: number }[] = [];
  for (const marker of markers
    .filter((m) => m.annotation)
    .sort((a, b) => a.x - b.x)) {
    const position = x(marker.x);
    const same = annotations.find((a) => Math.abs(a.x - position) < 0.1);
    if (same) {
      same.text += ` / ${marker.annotation}`;
      continue;
    }
    let row = 0;
    while (
      annotations.some((a) => a.row === row && Math.abs(a.x - position) < 65)
    )
      row++;
    annotations.push({ x: position, text: marker.annotation!, row });
  }
  const T = 22 + annotations.reduce((max, a) => Math.max(max, a.row * 15), 0);
  const y = (v: number) => T + ((yMax - v) / (yMax - yMin)) * (H - T - B);
  return (
    <div ref={ref}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="rc-plot"
        role="img"
        aria-label={label}
      >
        {Array.from({ length: 5 }, (_, i) => {
          const raw = yMin + ((yMax - yMin) * i) / 4;
          const v =
            Math.abs(raw) < 1e-12 * Math.max(1, Math.abs(yMin), Math.abs(yMax))
              ? 0
              : raw;
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
              className={`rc-marker${m.selected ? ' selected' : ''}${m.role ? ` marker-${m.role}` : ''}`}
              d={`M${x(m.x)} ${T}V${H - B}`}
            />
            <title>
              {m.label}: {eng(m.x, 'Hz')}
            </title>
          </g>
        ))}
        {annotations.map((a, i) => (
          <text
            className="rc-marker-label"
            key={i}
            x={a.x}
            y={14 + a.row * 15}
            textAnchor="middle"
          >
            {a.text}
          </text>
        ))}
        {points.map((series, i) => (
          <g key={i} data-series={seriesLabels[i]}>
            <title>{seriesLabels[i]}</title>
            <path
              className={`rc-trace trace-${i} ${traceClasses[i] ?? ''}`}
              d={series
                .map((p, j) =>
                  stems
                    ? `M${x(p.x).toFixed(2)},${y(0).toFixed(2)}L${x(p.x).toFixed(2)},${y(p.y).toFixed(2)}`
                    : `${j ? 'L' : 'M'}${x(p.x).toFixed(2)},${y(Math.max(yMin, Math.min(yMax, p.y))).toFixed(2)}`,
                )
                .join(' ')}
            />
            {stems &&
              series.map((p, j) => (
                <g
                  key={j}
                  className={`rc-spectrum-point ${traceClasses[i] ?? ''}`}
                >
                  {i === 0 ? (
                    <circle cx={x(p.x)} cy={y(p.y)} r="5" />
                  ) : (
                    <path
                      d={`M${x(p.x)} ${y(p.y) - 3.5}l3.5 3.5-3.5 3.5-3.5-3.5Z`}
                    />
                  )}
                  <title>
                    {seriesLabels[i]} · {eng(p.x, 'Hz')}: {eng(p.y, 'V peak')}
                  </title>
                </g>
              ))}
          </g>
        ))}
      </svg>
    </div>
  );
}
export function RcFrequencyPlots({ result }: { result: RcResult }) {
  const toneMarkers: Marker[] = result.tones.map((tone, index) => ({
    x: tone.frequency,
    label: tone.label,
    selected: tone.role === 'useful',
    role: tone.role,
    annotation: tone.role === 'useful' ? 'U' : `I${index}`,
  }));
  const markers: Marker[] = [
    ...result.cutoffs.map((x) => ({ x, label: 'Half-power frequency' })),
    ...(result.isExample
      ? toneMarkers
      : [
          {
            x: result.selected.frequency,
            label: 'Selected frequency',
            selected: true,
          },
        ]),
  ];
  const spectralComponents = new Map<
    number,
    { frequency: number; input: number; output: number }
  >();
  for (const tone of result.tones) {
    const entry = spectralComponents.get(tone.frequency) ?? {
      frequency: tone.frequency,
      input: 0,
      output: 0,
    };
    entry.input += tone.amplitude;
    entry.output += tone.outputAmplitude;
    spectralComponents.set(tone.frequency, entry);
  }
  const spectrum = [...spectralComponents.values()].sort(
    (a, b) => a.frequency - b.frequency,
  );
  const min = result.sweep[0].frequency,
    max = result.sweep.at(-1)!.frequency;
  return (
    <section className="panel rc-frequency">
      <div className="section-heading">
        <h2>Frequency response</h2>
        <span className="pill">Input → output</span>
      </div>
      {result.isExample && (
        <ul className="rc-marker-legend" aria-label="Frequency markers">
          {toneMarkers.map((marker, index) => (
            <li key={index}>
              <span className={`rc-frequency-key marker-${marker.role}`}>
                {marker.annotation}
              </span>
              <span>
                {marker.label} · {eng(marker.x, 'Hz')}
              </span>
            </li>
          ))}
        </ul>
      )}
      {result.isExample && (
        <div className="rc-spectrum">
          <h3>Input and output amplitudes</h3>
          <ul
            className="rc-signal-legend"
            aria-label="Frequency amplitude traces"
          >
            <li>
              <span className="rc-line-key signal-input" />
              Input signal
            </li>
            <li>
              <span className="rc-line-key signal-output" />
              Filtered output
            </li>
          </ul>
          <Plot
            points={[
              spectrum.map((p) => ({ x: p.frequency, y: p.input })),
              spectrum.map((p) => ({ x: p.frequency, y: p.output })),
            ]}
            traceClasses={['signal-input', 'signal-output']}
            seriesLabels={['Input amplitude', 'Output amplitude']}
            stems
            xMin={min}
            xMax={max}
            yMin={0}
            yMax={
              Math.max(
                0.1,
                ...spectrum.map((p) => Math.max(p.input, p.output)),
              ) * 1.15
            }
            logX
            xUnit="Hz"
            yUnit="V peak"
            label="Input and output signal amplitudes versus logarithmic frequency"
            markers={toneMarkers}
          />
          <p className="rc-caption">
            Each peak shows a frequency in the signal. Teal circles mark input
            amplitude; amber diamonds mark output amplitude. Compare their
            heights to see what the filter removes. Coincident tones are
            combined.
          </p>
        </div>
      )}
      <h3 className="rc-response-subheading">Filter gain and phase</h3>
      <ul className="rc-signal-legend" aria-label="Filter response traces">
        <li>
          <span className="rc-line-key signal-input" />
          Input reference · 0 dB / 0°
        </li>
        <li>
          <span className="rc-line-key signal-output" />
          Output relative to input
        </li>
      </ul>
      <Plot
        points={[
          [
            { x: min, y: 0 },
            { x: max, y: 0 },
          ],
          result.sweep.map((p) => ({ x: p.frequency, y: p.db })),
        ]}
        traceClasses={['signal-input', 'signal-output']}
        seriesLabels={['Input gain reference', 'Output gain']}
        xMin={min}
        xMax={max}
        yMin={
          Math.floor(
            result.sweep.reduce((min, p) => Math.min(min, p.db), 0) / 20,
          ) * 20
        }
        yMax={3}
        logX
        xUnit="Hz"
        yUnit="dB"
        label="Input reference and output gain in decibels versus logarithmic frequency"
        markers={markers}
      />
      <Plot
        points={[
          [
            { x: min, y: 0 },
            { x: max, y: 0 },
          ],
          result.sweep.map((p) => ({ x: p.frequency, y: p.phase })),
        ]}
        traceClasses={['signal-input', 'signal-output']}
        seriesLabels={['Input phase reference', 'Output phase']}
        xMin={min}
        xMax={max}
        yMin={-90}
        yMax={90}
        logX
        xUnit="Hz"
        yUnit="°"
        label="Input reference and output phase versus logarithmic frequency"
        markers={markers}
      />
      <p className="rc-caption">
        {result.isExample ? 'Useful frequency' : 'At'}{' '}
        {eng(result.selected.frequency, 'Hz')}: {result.selected.db.toFixed(2)}{' '}
        dB · {result.selected.phase.toFixed(1)}°.{' '}
        {result.isExample
          ? 'U: useful signal. I: interference.'
          : 'Teal: selected frequency.'}{' '}
        Gray dashed: −3 dB relative to passband or peak. The input reference is
        0 dB and 0°; the output curves show the filter’s gain and phase, rather
        than signal amplitudes.
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
  const example = result.isExample && !step;
  const [min, max] = result.samples.reduce(
    ([min, max], p) => [
      Math.min(min, p.input, p.output, p.desired ?? 0),
      Math.max(max, p.input, p.output, p.desired ?? 0),
    ],
    [0, 0],
  );
  const pad = Math.max(0.1, (max - min) * 0.12);
  const series = example
    ? (['desired', 'input', 'output'] as const)
    : (['input', 'output'] as const);
  return (
    <section className="panel rc-time-panel">
      <div className="section-heading">
        <h2>
          {step
            ? 'Step response'
            : example
              ? 'Filtering comparison'
              : 'Input and output'}
        </h2>
        {!example && (
          <span className="small-muted">Vin · teal / Vout · amber</span>
        )}
      </div>
      {example && (
        <ul className="rc-signal-legend" aria-label="Waveform traces">
          <li>
            <span className="rc-line-key signal-desired" />
            Desired signal
          </li>
          <li>
            <span className="rc-line-key signal-input" />
            Measured input
          </li>
          <li>
            <span className="rc-line-key signal-output" />
            Filtered output
          </li>
        </ul>
      )}
      <Plot
        points={series.map((key) =>
          result.samples.map((p) => ({ x: p.time, y: p[key] ?? 0 })),
        )}
        traceClasses={
          example ? ['signal-desired', 'signal-input', 'signal-output'] : []
        }
        xMin={0}
        xMax={result.duration}
        yMin={min - pad}
        yMax={max + pad}
        xUnit="s"
        yUnit="V"
        label={
          step
            ? 'RC response to a positive voltage step'
            : example
              ? 'Desired signal, measured input, and actual filtered output on common time and voltage axes'
              : 'Four periods of input and steady-state output'
        }
      />
      {result.windowLimited && (
        <p className="rc-window-notice" role="status">
          Showing {eng(result.duration, 's')} of the requested{' '}
          {eng(result.requestedDuration, 's')}. This frequency combination
          cannot be resolved over the requested span within the sampling budget.{' '}
          The window is shortened to preserve the fastest tone. Bring the signal
          frequencies closer together to see the full span.
        </p>
      )}
      <p className="rc-caption">
        {step
          ? 'Initially uncharged capacitors. Eight times the slowest circuit time constant.'
          : example
            ? `${result.exampleWindow === 'overview' ? 'Long overview includes at least one cycle of the slowest active interference tone, when the sampling budget allows.' : 'Signal detail requests four periods of the useful signal.'} The output retains its actual attenuation and phase shift; the desired signal is a reference, not a corrected output.`
            : 'Periodic steady state over four cycles. Frequency plots describe sine-wave gain and phase, even when the input waveform is square or triangle.'}
      </p>
      {example && (
        <div className="rc-tone-table-container">
          <table className="rc-tone-table">
            <caption>Signal components</caption>
            <thead>
              <tr>
                <th scope="col">Tone</th>
                <th scope="col">Frequency</th>
                <th scope="col">
                  Input
                  <br />
                  <span>V peak</span>
                </th>
                <th scope="col">
                  Output
                  <br />
                  <span>V peak</span>
                </th>
                <th scope="col">
                  Gain
                  <br />
                  <span>dB</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {result.tones.map((tone) => (
                <tr key={tone.id}>
                  <th scope="row">{tone.label}</th>
                  <td>{eng(tone.frequency, 'Hz')}</td>
                  <td>{Number(tone.amplitude.toPrecision(4))}</td>
                  <td>{Number(tone.outputAmplitude.toPrecision(4))}</td>
                  <td>{tone.response.db.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="rc-tone-note">
            Theoretical gain applies to each sine wave separately. A mixed
            signal does not have one Vpp gain.
          </p>
        </div>
      )}
    </section>
  );
}
