import { getTopic, getTool } from '@/lib/catalog';
import { Link } from 'react-router-dom';
import { TopicArt } from './TopicArt';
import { TopicBreadcrumbs } from './TopicBreadcrumbs';

export function DividerTopic() {
  const topic = getTopic('voltage-divider');
  return (
    <main id="main-content" tabIndex={-1} className="lab-shell">
      <TopicBreadcrumbs />
      <div className="intro topics-intro">
        <span className="eyebrow">RESISTANCE → VOLTAGE</span>
        <h1>{topic.title}</h1>
        <p>
          Explore how resistors share voltage, then build a circuit and measure
          it yourself.
        </p>
      </div>
      <div className="topic-grid">
        <article className="panel topic-card">
          <div className="topic-art">
            <span className="eyebrow">EXPLORE THE CONCEPTS</span>
            <TopicArt divider />
          </div>
          <div className="topic-card-body">
            <span className="small-muted">
              4 configurations · Equations &amp; response curves
            </span>
            <h2>Interactive Learning</h2>
            <p>
              Change resistances, connect a load, or move a wiper. See the
              circuit, equations, and measurements update together.
            </p>
            <Link
              className="open-lab"
              to={getTool('voltage-divider', 'learn').path}
            >
              Start learning <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </article>
        <article className="panel topic-card">
          <div className="topic-art">
            <span className="eyebrow">BUILD &amp; MEASURE</span>
            <svg viewBox="0 0 420 180" aria-hidden="true">
              <g fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="35" y="25" width="230" height="135" rx="10" />
                <path d="M50 45H250M50 140H250" />
                {[70, 90, 110, 125].map((y) =>
                  Array.from({ length: 12 }, (_, i) => (
                    <circle
                      key={`${y}-${i}`}
                      cx={55 + i * 17}
                      cy={y}
                      r="2"
                      opacity=".5"
                    />
                  )),
                )}
                <path d="M90 45V70H120M160 70H200V140M145 90H285V80H310" />
                <rect x="120" y="63" width="40" height="14" />
                <rect x="300" y="45" width="90" height="95" rx="8" />
                <rect x="310" y="60" width="70" height="35" />
                <text
                  x="345"
                  y="82"
                  textAnchor="middle"
                  fill="currentColor"
                  stroke="none"
                  fontSize="16"
                >
                  2.5 V
                </text>
                <circle cx="345" cy="118" r="12" />
              </g>
            </svg>
          </div>
          <div className="topic-card-body">
            <span className="small-muted">
              4 configurations · Breadboard &amp; multimeter
            </span>
            <h2>Voltage Divider Lab Simulator</h2>
            <p>
              Wire resistors on the breadboard, connect a DC supply, and use the
              multimeter to measure voltage, current, and resistance.
            </p>
            <Link
              className="open-lab"
              to={getTool('voltage-divider', 'simulator').path}
            >
              Open simulator <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </article>
      </div>
    </main>
  );
}
