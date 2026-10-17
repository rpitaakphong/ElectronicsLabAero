/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- The two labeled horizontal scroll regions need keyboard focus for arrow-key scrolling. */
import { memo } from 'react';
import {
  engineering as eng,
  type TimerConfig,
  type TimerSession,
} from '@/lib/timer555/simulator';
import '../../vendor/opamp-lab-simulator/timer555-visuals.js';
declare global {
  var Timer555Visuals: {
    guide(): string;
    schematic(config: TimerConfig, high?: boolean | null): string;
  };
}
export const TimerSchematic = memo(function TimerSchematic({
  config,
  high,
}: {
  config: TimerConfig;
  high?: boolean;
}) {
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="NE555 circuit schematic; scroll sideways on small screens"
      className="timer-schematic"
      dangerouslySetInnerHTML={{
        __html: globalThis.Timer555Visuals.schematic(config, high),
      }}
    />
  );
});
export const TimerPinGuide = memo(function TimerPinGuide() {
  return (
    <div
      className="timer-pin-guide"
      dangerouslySetInnerHTML={{ __html: globalThis.Timer555Visuals.guide() }}
    />
  );
});
export const TimerWaveforms = memo(function TimerWaveforms({
  session,
  window,
  revision,
}: {
  session: TimerSession;
  window: number;
  revision: number;
}) {
  const end = Math.max(session.time, window),
    start = Math.max(0, session.time - window),
    actualEnd = session.time;
  const width = 940,
    left = 60,
    right = 920,
    top = 30,
    laneHeight = 100;
  const vcc = session.values.VPLUS ?? 5;
  const x = (t: number) => left + ((t - start) / window) * (right - left);
  const rows = [
    { key: 'OUT', name: 'Output · pin 3', color: '#f1d63a' },
    { key: 'CAP', name: 'Capacitor · pin 6', color: '#63b9ff' },
    { key: 'TRIG', name: 'Trigger · pin 2', color: '#d5a2f1' },
  ];
  // Sample the netlist once per frame, sharing the same edge-aware timestamps
  // across all three lanes instead of resampling each voltage separately.
  let points: ReturnType<TimerSession['trace']> = [];
  let warning = '';
  if (session.period && (actualEnd - start) / session.period > 500) {
    warning =
      'Too many pulses to show individually; reduce the time span to zoom in.';
  } else if (actualEnd > start) {
    try {
      points = session.trace(start, actualEnd, 800);
    } catch (error) {
      warning = (error as Error).message;
    }
  }
  return (
    <section
      className="panel timer-waveforms"
      aria-labelledby="timer-traces-title"
      data-revision={revision}
    >
      <div className="section-heading">
        <h2 id="timer-traces-title">Timing waveforms</h2>
        <span className="pill">Fixed span · {eng(window, 's')}</span>
      </div>
      {warning && (
        <p className="timer-trace-warning" role="status">
          {warning}
        </p>
      )}
      <div
        className="timer-trace-scroll"
        tabIndex={0}
        role="region"
        aria-label="Timing waveforms; scroll sideways on small screens"
      >
        <svg
          viewBox={`0 0 ${width} 390`}
          role="img"
          aria-label="Output, timing capacitor, and trigger voltages against simulated time. Dashed lines mark the capacitor switching thresholds."
        >
          {rows.map((row, j) => {
            const y = (v: number) => top + j * laneHeight + 78 - (v / vcc) * 62;
            const path = points.length
              ? points
                  .map(
                    (point, i) =>
                      `${i ? 'L' : 'M'}${x(point.t).toFixed(4)},${y(point.values[session.net.r(row.key)] ?? 0).toFixed(2)}`,
                  )
                  .join(' ')
              : '';
            return (
              <g key={row.key}>
                <text
                  x={left}
                  y={top + j * laneHeight}
                  fill={row.color}
                  fontSize="13"
                >
                  {row.name}
                </text>
                {[0, 1, 2, 3, 4].map((i) => (
                  <line
                    key={i}
                    x1={left + ((right - left) * i) / 4}
                    x2={left + ((right - left) * i) / 4}
                    y1={top + j * laneHeight + 8}
                    y2={top + j * laneHeight + 80}
                    stroke="var(--border)"
                  />
                ))}
                <line
                  x1={left}
                  x2={right}
                  y1={y(0)}
                  y2={y(0)}
                  stroke="var(--border)"
                />
                <text
                  x={left - 8}
                  y={y(0) + 4}
                  fill="var(--muted-foreground)"
                  fontSize="11"
                  textAnchor="end"
                >
                  0 V
                </text>
                <text
                  x={left - 8}
                  y={y(vcc) + 4}
                  fill="var(--muted-foreground)"
                  fontSize="11"
                  textAnchor="end"
                >
                  {vcc} V
                </text>
                {j === 1 &&
                  [1 / 3, 2 / 3].map((f) => (
                    <g key={f}>
                      <line
                        x1={left}
                        x2={right}
                        y1={y(vcc * f)}
                        y2={y(vcc * f)}
                        stroke="#7c9ba8"
                        strokeDasharray="5 5"
                      />
                      <text
                        x={right - 5}
                        y={y(vcc * f) - 4}
                        fill="#91b3c1"
                        textAnchor="end"
                        fontSize="11"
                      >
                        {f < 0.5 ? '⅓' : '⅔'} VCC
                      </text>
                    </g>
                  ))}
                <path d={path} fill="none" stroke={row.color} strokeWidth="2" />
              </g>
            );
          })}
          {[0, 1, 2, 3, 4].map((i) => (
            <text
              key={i}
              x={left + ((right - left) * i) / 4}
              y="355"
              fill="var(--muted-foreground)"
              fontSize="12"
              textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}
            >
              {eng(start + (window * i) / 4, 's')}
            </text>
          ))}
          <text
            x="490"
            y="382"
            fill="var(--muted-foreground)"
            fontSize="12"
            textAnchor="middle"
          >
            Simulated time · current {eng(actualEnd, 's')}
            {end === window && actualEnd === 0
              ? ' · press Trigger pulse to begin'
              : ''}
          </text>
        </svg>
      </div>
      <p className="small-muted">
        Yellow: output. Blue: capacitor. Purple: trigger. The first astable
        charging interval after power-up is longer than its steady-state high
        time.
      </p>
    </section>
  );
});
