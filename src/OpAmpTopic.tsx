import { getTopic, getTool } from '@/lib/catalog';
import { Link } from 'react-router-dom';
import { TopicArt } from './TopicArt';
import { TopicBreadcrumbs } from './TopicBreadcrumbs';

function BreadboardArt() {
  return (
    <svg viewBox="0 0 420 180" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="50" y="25" width="320" height="135" rx="10" />
        <path opacity=".5" d="M65 45H355M65 140H355M65 92H355" />
        {[70, 85, 105, 120].map((y) =>
          Array.from({ length: 15 }, (_, i) => (
            <circle
              key={`${y}-${i}`}
              cx={70 + i * 20}
              cy={y}
              r="2"
              opacity=".5"
            />
          )),
        )}
        <path d="M110 45V70H170M250 120H310V140" />
        <rect
          x="175"
          y="78"
          width="70"
          height="30"
          rx="3"
          fill="var(--background)"
        />
        <text x="210" y="98" textAnchor="middle">
          UA741
        </text>
        {[185, 201, 217, 233].map((x) => (
          <path key={x} d={`M${x}70V78M${x}108V120`} />
        ))}
      </g>
    </svg>
  );
}

export function OpAmpTopic() {
  const topic = getTopic('opamp');
  return (
    <main id="main-content" tabIndex={-1} className="lab-shell">
      <TopicBreadcrumbs />
      <div className="intro topics-intro opamp-topic-intro">
        <span className="eyebrow">SIGNALS &amp; WAVEFORMS</span>
        <h1>{topic.title}</h1>
        <p>
          Explore how an op-amp works, then build a circuit and measure its
          signals.
        </p>
      </div>
      <div className="topic-grid">
        <article className="panel topic-card">
          <div className="topic-art">
            <span className="eyebrow">EXPLORE THE CONCEPTS</span>
            <TopicArt divider={false} />
          </div>
          <div className="topic-card-body">
            <span className="small-muted">
              6 configurations · Equations &amp; waveforms
            </span>
            <h2>Interactive Learning</h2>
            <p>
              Change circuit parameters and see how gain, filtering, and
              comparison shape the output. Connect the equations to a live
              waveform.
            </p>
            <Link className="open-lab" to={getTool('opamp', 'learn').path}>
              Start learning <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </article>
        <article className="panel topic-card">
          <div className="topic-art">
            <span className="eyebrow">BUILD &amp; MEASURE</span>
            <BreadboardArt />
          </div>
          <div className="topic-card-body">
            <span className="small-muted">
              5 presets · Breadboard &amp; instruments
            </span>
            <h2>Op-Amp Lab Simulator</h2>
            <p>
              Wire a UA741 circuit on the breadboard, connect the function
              generator, and measure the result with the oscilloscope.
            </p>
            <Link className="open-lab" to={getTool('opamp', 'simulator').path}>
              Open simulator <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </article>
      </div>
    </main>
  );
}
