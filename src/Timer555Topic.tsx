import { Link } from 'react-router-dom';
import { getTopic, getTool } from '@/lib/catalog';
import { TopicBreadcrumbs } from './TopicBreadcrumbs';
import { TopicArt } from './TopicArt';
export function Timer555Topic() {
  const topic = getTopic('timer555');
  return (
    <main id="main-content" tabIndex={-1} className="lab-shell">
      <TopicBreadcrumbs />
      <div className="intro topics-intro">
        <span className="eyebrow">TIMING · OSCILLATION · TRIGGERED PULSES</span>
        <h1>{topic.title}</h1>
        <p>
          Turn capacitor charging into a clock or a timed response. Explore the
          behavior, then wire and measure an NE555 yourself.
        </p>
      </div>
      <div className="topic-grid">
        {(['learn', 'simulator'] as const).map((kind) => (
          <article className="panel topic-card" key={kind}>
            <div className="topic-art">
              <span className="eyebrow">
                {kind === 'learn' ? 'PREDICT & EXPLORE' : 'BUILD & MEASURE'}
              </span>
              <TopicArt timer />
            </div>
            <div className="topic-card-body">
              <h2>{getTool('timer555', kind).label}</h2>
              <p>
                {kind === 'learn'
                  ? 'Change R and C, compare predicted and measured timing, and watch the capacitor cross its thresholds in astable and monostable modes.'
                  : 'Construct an NE555 circuit on a blank breadboard. Connect power, operate a pushbutton, and measure with the function generator and oscilloscope.'}
              </p>
              <Link className="open-lab" to={getTool('timer555', kind).path}>
                {kind === 'learn' ? 'Start learning' : 'Open simulator'}
                <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </article>
        ))}
        <article className="panel topic-card">
          <div className="topic-art">
            <span className="eyebrow">RECORD YOUR EXPERIMENT</span>
            <TopicArt timer />
          </div>
          <div className="topic-card-body">
            <h2>Main Lab Worksheet</h2>
            <p>
              Work in a group of one or two to record all three labs, attach
              scope images locally, and download the shared data for your
              individual post-lab.
            </p>
            <Link
              reloadDocument
              className="open-lab"
              to="/worksheets/555-main-lab.html"
            >
              Open worksheet <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </article>
        <article className="panel topic-card">
          <div className="topic-art">
            <span className="eyebrow">DISCUSS & CONCLUDE</span>
            <TopicArt timer />
          </div>
          <div className="topic-card-body">
            <h2>Individual Post-Lab</h2>
            <p>
              Import your own pre-lab and the group’s main-lab data. Write your
              own analysis and conclusions, then download your complete report.
            </p>
            <Link
              reloadDocument
              className="open-lab"
              to="/worksheets/555-post-lab.html"
            >
              Open individual post-lab <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </article>
      </div>
    </main>
  );
}
