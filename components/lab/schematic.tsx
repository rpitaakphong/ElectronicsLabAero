'use client';
import { useEffect, useRef, useState } from 'react';
import { engineering as eng, type Config } from '@/lib/opamp/simulator';
import { CIRCUIT_INFO } from '@/lib/opamp/content';
export function useWidth(initial = 760) {
  const ref = useRef<HTMLDivElement>(null),
    [width, setWidth] = useState(initial);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(280, entry.contentRect.width)),
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}
function Resistor({
  x1,
  x2,
  y,
  label,
}: {
  x1: number;
  x2: number;
  y: number;
  label: string;
}) {
  const mid = (x1 + x2) / 2,
    half = Math.min(26, (x2 - x1) * 0.25);
  return (
    <g>
      <path d={`M${x1} ${y}H${mid - half}M${mid + half} ${y}H${x2}`} />
      <rect x={mid - half} y={y - 7} width={half * 2} height={14} />
      <text x={mid} y={y - 19} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}
export function Schematic({ config: c }: { config: Config }) {
  const { ref, width: w } = useWidth(),
    p = c.components;
  const non = c.circuit === 'noninverting' || c.circuit === 'buffer',
    comparator = c.circuit === 'comparator';
  const left = 30,
    node = w * 0.39,
    amp = w * 0.56,
    tip = amp + Math.min(100, w * 0.2),
    out = w - 32;
  const refX = amp - 20;
  return (
    <div ref={ref} className="schematic-wrap">
      <svg
        viewBox={`0 0 ${w} 300`}
        style={{ height: 300 }}
        className="circuit-svg"
        role="img"
        aria-label={`${CIRCUIT_INFO[c.circuit].name}. Power supply rails: V minus ${eng(p.supplyNegative, 'V')}, V plus ${eng(p.supplyPositive, 'V')}. ${CIRCUIT_INFO[c.circuit].input}`}
      >
        <title>{CIRCUIT_INFO[c.circuit].name}</title>
        <defs>
          <pattern
            id="circuit-grid"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r=".8" fill="var(--border)" />
          </pattern>
        </defs>
        <rect width={w} height="300" fill="url(#circuit-grid)" />
        <g className="circuit-wires">
          <path className="opamp-body" d={`M${amp} 112V228L${tip} 170Z`} />
          <path d={`M${tip} 170H${out}`} />
          <circle className="node-dot output-dot" cx={out} cy={170} r={4} />
          <text x={out} y={153} textAnchor="end" className="signal-output">
            Vout
          </text>
          <text x={amp + 13} y={145}>
            {non || comparator ? '+' : '−'}
          </text>
          <text x={amp + 13} y={205}>
            {non || comparator ? '−' : '+'}
          </text>
          <text x={amp + 27} y={179} className="opamp-label">
            A
          </text>
          <path
            className="supply-pin"
            d={`M${amp + 44} 137V100M${amp + 44} 203V240`}
          />
          <text x={amp + 52} y={103} className="supply-label">
            V+ {eng(p.supplyPositive, 'V')}
          </text>
          <text x={amp + 52} y={244} className="supply-label">
            V− {eng(p.supplyNegative, 'V')}
          </text>
          {non || comparator ? (
            <>
              <path className="signal-input" d={`M${left} 140H${amp}`} />
              <text className="signal-input" x={left} y={121}>
                Vin
              </text>
            </>
          ) : (
            <>
              <Resistor
                x1={left}
                x2={node}
                y={140}
                label={`Rin ${eng(p.rin, 'Ω')}`}
              />
              <text className="signal-input" x={left} y={163}>
                V₁
              </text>
              <path d={`M${node} 140H${amp}`} />
              <circle cx={node} cy={140} r={3} className="node-dot" />
            </>
          )}
          {comparator ? (
            <>
              <path d={`M${left} 200H${amp}`} />
              <text x={left} y={225}>
                Vref {eng(p.reference, 'V')}
              </text>
            </>
          ) : non ? (
            <>
              <path d={`M${out - 15} 170V270H${node}V200H${amp}`} />
              <circle cx={out - 15} cy={170} r={3} className="node-dot" />
              {c.circuit === 'noninverting' && (
                <>
                  <path
                    className="erase-wire"
                    d={`M${node + 10} 270H${out - 25}`}
                  />
                  <Resistor
                    x1={node + 10}
                    x2={out - 25}
                    y={270}
                    label={`Rf ${eng(p.rf, 'Ω')}`}
                  />
                  <Resistor
                    x1={left}
                    x2={node}
                    y={200}
                    label={`Rg ${eng(p.rg, 'Ω')}`}
                  />
                  <text x={left} y={228}>
                    Vref {eng(p.reference, 'V')}
                  </text>
                  <circle cx={node} cy={200} r={3} className="node-dot" />
                </>
              )}
            </>
          ) : (
            <>
              <path d={`M${node} 140V80M${out - 15} 170V80`} />
              <Resistor
                x1={node}
                x2={out - 15}
                y={80}
                label={`Rf ${eng(p.rf, 'Ω')}`}
              />
              <circle cx={out - 15} cy={170} r={3} className="node-dot" />
              <path d={`M${refX} 255V200H${amp}`} />
              <text x={refX} y={278} textAnchor="middle">
                Vref {eng(p.reference, 'V')}
              </text>
              {c.circuit === 'lowpass' && (
                <>
                  <path
                    d={`M${node} 80V35H${(node + out - 15) / 2 - 5}M${(node + out - 15) / 2 + 5} 35H${out - 15}V80M${(node + out - 15) / 2 - 5} 25V45M${(node + out - 15) / 2 + 5} 25V45`}
                  />
                  <text x={(node + out - 15) / 2} y={17} textAnchor="middle">
                    C {eng(p.capacitance, 'F')}
                  </text>
                </>
              )}
              {c.circuit === 'summing' && (
                <>
                  <Resistor
                    x1={left}
                    x2={node}
                    y={240}
                    label={`R₂ ${eng(p.r2, 'Ω')}`}
                  />
                  <path d={`M${node} 240V140`} />
                  <text className="signal-second" x={left} y={265}>
                    V₂
                  </text>
                </>
              )}
            </>
          )}
        </g>
      </svg>
    </div>
  );
}
