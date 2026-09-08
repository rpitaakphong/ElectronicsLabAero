import { useId } from 'react';
import { useWidth } from '@/components/lab/schematic';
import {
  eng,
  sweep,
  sweepAxis,
  type DividerConfig,
  type DividerResult,
} from '@/lib/divider/simulator';
export function DividerSchematic({
  config: c,
  result: r,
}: {
  config: DividerConfig;
  result: DividerResult;
}) {
  const id = useId();
  const { ref, width } = useWidth();
  const compact = width < 500;
  const source = compact ? 38 : 95,
    leg = compact ? 142 : 280,
    load = compact ? 292 : 490,
    out = compact ? 330 : 540;
  const pot = c.configuration === 'potentiometer';
  const upperName = pot
    ? 'Upper track'
    : c.configuration === 'sensor'
      ? c.sensorPosition === 'upper'
        ? 'Sensor'
        : 'Fixed'
      : 'R1';
  const lowerName = pot
    ? 'Lower track'
    : c.configuration === 'sensor'
      ? c.sensorPosition === 'lower'
        ? 'Sensor'
        : 'Fixed'
      : 'R2';
  return (
    <div className="divider-diagram" ref={ref}>
      <svg
        viewBox={`0 0 ${compact ? 360 : 720} 360`}
        role="img"
        aria-label={`${c.configuration} circuit. ${upperName} ${eng(r.upper, 'Ω')} above output; ${lowerName} ${eng(r.lower, 'Ω')} below output. Output ${eng(r.output, 'V')}.${r.loaded ? ` Load ${eng(c.load, 'Ω')} connected across lower resistor.` : ''}`}
      >
        <defs>
          <marker
            id={id}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0 0L10 5L0 10Z" fill="currentColor" />
          </marker>
        </defs>
        <g fill="none" stroke="currentColor" strokeWidth="2">
          <path
            d={`M${source} 138V45H${leg}V85M${leg} 139V221M${leg} 275V315H${source}V202`}
          />
          <circle cx={source} cy="170" r="32" />
          <path
            d={`M${source - 9} 155H${source + 9}M${source} 146V164M${source - 9} 184H${source + 9}`}
          />
          <rect x={leg - 10} y="85" width="20" height="54" />
          <rect x={leg - 10} y="221" width="20" height="54" />
          <path
            d={`M${leg} 180H${out}M${leg} 315V330M${leg - 16} 330H${leg + 16}M${leg - 10} 337H${leg + 10}M${leg - 4} 344H${leg + 4}`}
          />
          {r.loaded && (
            <>
              <path d={`M${load} 180V221M${load} 275V315H${leg}`} />
              <rect x={load - 10} y="221" width="20" height="54" />
            </>
          )}
          {pot && (
            <path
              d={`M${leg + 62} 166L${leg + 15} 179`}
              markerEnd={`url(#${id})`}
            />
          )}
          <path
            d={`M${leg - 22} 58V112`}
            markerEnd={`url(#${id})`}
            className="signal-input"
          />
          <path
            d={`M${leg - 22} 219V272`}
            markerEnd={`url(#${id})`}
            className="signal-input"
          />
          {r.loaded && (
            <path
              d={`M${load - 22} 219V272`}
              markerEnd={`url(#${id})`}
              className="signal-output"
            />
          )}
        </g>
        <g fill="currentColor" fontSize={compact ? 12 : 15}>
          <text x={compact ? 9 : 48} y="227">
            Vin
          </text>
          <text x={compact ? 9 : 48} y="249">
            {eng(c.vin, 'V')}
          </text>
          <text x={leg + 30} y="106">
            {upperName} · {eng(r.upper, 'Ω')}
          </text>
          <text x={leg + 30} y="130" className="small-muted">
            ΔV = {eng(r.upperDrop, 'V')}
          </text>
          <text x={leg + 30} y="244">
            {lowerName}
          </text>
          <text x={leg + 30} y="266">
            {eng(r.lower, 'Ω')}
          </text>
          <text x={leg + 30} y="291">
            ΔV = {eng(r.lowerDrop, 'V')}
          </text>
          <text x={leg - 30} y="83" textAnchor="end" className="signal-input">
            I source
          </text>
          <text x={leg - 30} y="249" textAnchor="end" className="signal-input">
            I lower
          </text>
          {r.loaded && (
            <>
              <text
                x={compact ? 348 : 518}
                y={compact ? 299 : 241}
                textAnchor={compact ? 'end' : 'start'}
              >
                RL · {eng(c.load, 'Ω')}
              </text>
              <text
                x={compact ? load : 518}
                y={compact ? 210 : 267}
                textAnchor={compact ? 'middle' : 'start'}
                className="signal-output"
              >
                I load ↓
              </text>
            </>
          )}
          <text
            x={compact ? 267 : 550}
            y={compact ? 151 : 175}
            className="signal-output"
          >
            Vout
          </text>
          <text
            x={compact ? 267 : 550}
            y={compact ? 172 : 199}
            className="signal-output"
          >
            {eng(r.output, 'V')}
          </text>
        </g>
        <circle cx={leg} cy="180" r="5" fill="var(--output-text)" />
        <circle cx={out} cy="180" r="4" fill="var(--output-text)" />
      </svg>
    </div>
  );
}
export function DividerGraph({
  config: c,
  result: r,
}: {
  config: DividerConfig;
  result: DividerResult;
}) {
  const { ref, width } = useWidth();
  const graphWidth = width < 500 ? 400 : 680;
  const left = graphWidth === 400 ? 45 : 65,
    right = graphWidth - 35;
  const axis = sweepAxis(c),
    points = sweep(c),
    max = Math.max(c.vin, 1);
  const x = (v: number) =>
    left + (axis.log ? (Math.log10(v) - 2) / 4 : v) * (right - left);
  const y = (v: number) => 235 - (v / max) * 190;
  const path = (key: 'output' | 'unloaded') =>
    points.map((p, i) => `${i ? 'L' : 'M'}${x(p.x)},${y(p[key])}`).join(' ');
  const ticks = axis.log
    ? [100, 1000, 10000, 100000, 1000000]
    : [0, 0.25, 0.5, 0.75, 1];
  return (
    <section className="panel divider-graph" ref={ref}>
      <div className="section-heading">
        <h2>Output response</h2>
        <span className="pill">
          {axis.log ? 'Logarithmic resistance axis' : 'Linear position axis'}
        </span>
      </div>
      <div className="divider-legend">
        <span>━ Output</span>
        {r.loaded && <span className="unloaded-legend">┄ Unloaded</span>}
        <span>● Current setting</span>
      </div>
      <svg
        viewBox={`0 0 ${graphWidth} 305`}
        role="img"
        aria-label={`Output response. ${axis.label}. Current output ${eng(r.output, 'V')}${r.loaded ? `; unloaded ${eng(r.unloaded, 'V')}` : ''}.`}
      >
        <text x={left} y="21" fill="var(--muted-foreground)" fontSize="13">
          Vout (V)
        </text>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <path
              d={`M${left} ${y(t * max)}H${right}`}
              stroke="var(--border)"
            />
            <text
              x={left - 10}
              y={y(t * max) + 4}
              textAnchor="end"
              fill="var(--muted-foreground)"
              fontSize="12"
            >
              {Number((t * max).toPrecision(3))}
            </text>
          </g>
        ))}
        {ticks.map((t) => (
          <g key={t}>
            <path d={`M${x(t)} 45V235`} stroke="var(--border)" />
            <text
              x={x(t)}
              y="257"
              textAnchor="middle"
              fill="var(--muted-foreground)"
              fontSize="12"
            >
              {axis.log ? eng(t, '') : t * 100}
            </text>
          </g>
        ))}
        {r.loaded && (
          <path
            d={path('unloaded')}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2"
            strokeDasharray="6 5"
          />
        )}
        <path
          d={path('output')}
          fill="none"
          stroke="var(--output-text)"
          strokeWidth="3"
        />
        <path
          d={`M${x(axis.current)} 45V235`}
          stroke="var(--output-text)"
          strokeDasharray="3 5"
          opacity=".5"
        />
        <circle
          cx={x(axis.current)}
          cy={y(r.output)}
          r="6"
          fill="var(--output-text)"
          stroke="var(--card)"
          strokeWidth="2"
        />
        <text
          x={(left + right) / 2}
          y="290"
          textAnchor="middle"
          fill="var(--foreground)"
          fontSize="14"
        >
          {axis.label}
        </text>
      </svg>
      <p className="divider-caption">
        Sweep one parameter while all other settings stay fixed. Current
        setting:{' '}
        {axis.log
          ? eng(axis.current, 'Ω')
          : `${Number((axis.current * 100).toFixed(2))}%`}{' '}
        → {eng(r.output, 'V')}.
      </p>
    </section>
  );
}
