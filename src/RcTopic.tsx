import { Link } from 'react-router-dom';
import { getTopic, getTool } from '@/lib/catalog';
import { TopicBreadcrumbs } from './TopicBreadcrumbs';
export function RcTopic() {
  const topic = getTopic('rc-filter');
  return (
    <main id="main-content" tabIndex={-1} className="lab-shell">
      <TopicBreadcrumbs />
      <div className="intro topics-intro">
        <span className="eyebrow">PASSIVE FILTERS · FREQUENCY & TIME</span>
        <h1>{topic.title}</h1>
        <p>
          Discover what passes through a filter—and what changes along the way.
        </p>
      </div>
      <div className="topic-grid">
        {(['learn', 'simulator'] as const).map((kind) => (
          <article className="panel topic-card" key={kind}>
            <div className="topic-card-body">
              <span className="eyebrow">
                {kind === 'learn' ? 'EXPLORE THE BEHAVIOR' : 'BUILD & MEASURE'}
              </span>
              <h2>{getTool('rc-filter', kind).label}</h2>
              <p>
                {kind === 'learn'
                  ? 'Explore low-pass, high-pass, and band-pass filters. Change R, C, and load while comparing gain, phase, waveforms, and charging.'
                  : 'Wire passive filters on a breadboard. Use the function generator and two-channel oscilloscope to measure their response.'}
              </p>
              <Link className="open-lab" to={getTool('rc-filter', kind).path}>
                {kind === 'learn' ? 'Start learning' : 'Open simulator'}
                <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
