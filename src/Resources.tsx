import { Link } from 'react-router-dom';
import { ArrowDownToLine, ArrowRight } from 'lucide-react';
import {
  NOISE_PRELAB,
  NOISE_MAIN_LAB,
  NOISE_POST_LAB,
  RESOURCES,
  SITE_PAGES,
} from '@/lib/catalog';
import { TopicBreadcrumbs } from './TopicBreadcrumbs';

export function Resources() {
  const guides = RESOURCES.filter((resource) => resource.kind === 'guide');
  const downloads = RESOURCES.filter(
    (resource) => resource.kind === 'download',
  );
  return (
    <main id="main-content" tabIndex={-1} className="lab-shell resources-page">
      <TopicBreadcrumbs />
      <div className="intro catalog-intro">
        <span className="eyebrow">SUPPORT FOR YOUR EXPERIMENTS</span>
        <h1>Resources</h1>
        <p>Get oriented, keep your work, and take a simulator with you.</p>
      </div>
      <nav className="resource-sections" aria-label="Resource sections">
        {guides.map((guide) => (
          <Link to={guide.href} key={guide.id}>
            {guide.title}
          </Link>
        ))}
        <Link to="/resources#offline-simulators">Offline simulators</Link>
        <a href={NOISE_PRELAB.workbook}>Noise and Filtering Pre-lab</a>
        <a href={NOISE_MAIN_LAB.workbook}>Noise and Filtering Main Lab</a>
        <a href={NOISE_POST_LAB.workbook}>Noise and Filtering Individual Post-Lab</a>
        <Link to="/noise-and-filtering/learn">
          Noise and Filtering Interactive Learning
        </Link>
        <Link reloadDocument to="/worksheets/555-main-lab.html">
          555 Main Lab Worksheet
        </Link>
        <Link reloadDocument to="/worksheets/555-post-lab.html">
          555 Individual Post-Lab
        </Link>
      </nav>
      <div className="resource-guide-grid">
        {guides.map((guide, i) => (
          <section
            className="panel resource-guide"
            id={guide.id}
            tabIndex={-1}
            aria-labelledby={`${guide.id}-title`}
            key={guide.id}
          >
            <span className="eyebrow">GUIDE 0{i + 1}</span>
            <h2 id={`${guide.id}-title`}>{guide.title}</h2>
            <p className="resource-lede">{guide.description}</p>
            {guide.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {guide.id === 'getting-started' && (
              <Link className="topic-link" to={SITE_PAGES.topics.path}>
                Choose a topic
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )}
          </section>
        ))}
      </div>
      <section
        className="panel resource-guide"
        aria-labelledby="noise-learning-title"
      >
        <span className="eyebrow">EXPLORE THE CONCEPTS</span>
        <h2 id="noise-learning-title">
          Noise and Filtering Interactive Learning
        </h2>
        <p>
          Learn how RC, moving averages and exponential averaging change a
          signal. Explore frequency selection, sampling, noise reduction, delay
          and keeping useful events using independent synthetic demonstrations and
          typeset mathematics.
        </p>
        <Link className="topic-link" to="/noise-and-filtering/learn">
          Explore Noise and Filtering
        </Link>
      </section>
      <section
        className="panel resource-guide"
        aria-labelledby="noise-prelab-title"
      >
        <span className="eyebrow">WEEK 12 · INDIVIDUAL PREPARATION</span>
        <h2 id="noise-prelab-title">Noise and Filtering Pre-lab</h2>
        <p>
          Complete the individual workbook, save your first predictions, then
          finalize and download your final ZIP. Keep the complete ZIP for the
          individual post-lab. Save JSON backups while you work; to recover from a
          ZIP, extract workspace_backup.json and restore that file. Downloads
          stay on your device and are not submissions.
        </p>
        <p>
          The full optional AI coach prompt is available inside the pre-lab
          after you save your first prediction, with show, copy and manual-copy
          controls. The coach instructions download below is an optional
          reference.
        </p>
        <a className="topic-link" href={NOISE_PRELAB.workbook}>
          Open pre-lab <ArrowRight size={16} aria-hidden="true" />
        </a>
        <p>
          <Link className="topic-link" to="/noise-and-filtering">
            Preparation and recovery guide
          </Link>
          {' · '}
          <a className="topic-link" href={NOISE_PRELAB.instructions} download>
            Student instructions
          </a>
          {' · '}
          <a className="topic-link" href={NOISE_PRELAB.coach} download>
            Optional AI coach instructions
          </a>
        </p>
      </section>
      <section
        className="panel resource-guide"
        aria-labelledby="noise-main-title"
      >
        <span className="eyebrow">WEEK 12 · GROUP MEASUREMENTS</span>
        <h2 id="noise-main-title">Noise and Filtering Main Lab</h2>
        <p>
          Follow seven sections: investigate the noisy pulse signal, discover
          its spectrum, design and build an RC filter, measure attenuation,
          write your own MA/EMA code, and save your lab files. The working source
          sketch generates A0 output only. Save measurements, code and screenshots
          in the group ZIP for later individual work.
        </p>
        <a className="topic-link" href={NOISE_MAIN_LAB.workbook}>
          Open Noise and Filtering main lab
        </a>
        <p>
          <a href={NOISE_MAIN_LAB.sketch} download>
            Download UNO R4 signal-source sketch
          </a>
          {' · '}
          <a href={NOISE_MAIN_LAB.guide} download>
            Download wiring and measurement guide
          </a>
        </p>
      </section>

      <section className="panel resource-guide" aria-labelledby="noise-post-title">
        <span className="eyebrow">WEEK 12 · INDIVIDUAL ANALYSIS</span>
        <h2 id="noise-post-title">Noise and Filtering Individual Post-Lab</h2>
        <p>Load your group main-lab ZIP and your personal pre-lab ZIP. Use the saved measurements and screenshots to calculate attenuation, evaluate pulse changes and digital filters, and write your own conclusions.</p>
        <a className="topic-link" href={NOISE_POST_LAB.workbook}>Open Noise and Filtering individual post-lab</a>
      </section>

      <section
        className="panel resource-guide"
        aria-labelledby="worksheet-title"
      >
        <span className="eyebrow">WORKSHEET</span>
        <h2 id="worksheet-title">555 Main Lab Worksheet</h2>
        <p>
          Complete the three labs in a group of one or two. Answers and attached
          images stay in your browser; download a backup to keep them or move to
          another computer.
        </p>
        <Link
          reloadDocument
          className="topic-link"
          to="/worksheets/555-main-lab.html"
        >
          Open worksheet <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>
      <section className="panel resource-guide" aria-labelledby="postlab-title">
        <span className="eyebrow">INDIVIDUAL WORKSHEET</span>
        <h2 id="postlab-title">555 Individual Post-Lab</h2>
        <p>
          Import your own finalized pre-lab and the group’s main-lab ZIP. Review
          the evidence, write your own analysis and conclusions, and download
          your report. Work stays in your browser.
        </p>
        <Link
          reloadDocument
          className="topic-link"
          to="/worksheets/555-post-lab.html"
        >
          Open individual post-lab <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>
      <section
        id="offline-simulators"
        tabIndex={-1}
        className="offline-section"
        aria-labelledby="offline-title"
      >
        <span className="eyebrow">TAKE THE LAB WITH YOU</span>
        <h2 id="offline-title">Offline simulators</h2>
        <p className="small-muted">
          Save an HTML file, then open it in your browser. The complete
          workbench is included.
        </p>
        <div className="offline-grid">
          {downloads.map((resource) => (
            <article className="panel offline-card" key={resource.id}>
              <ArrowDownToLine size={24} aria-hidden="true" />
              <h3>{resource.title}</h3>
              <p>{resource.description}</p>
              <a
                className="secondary-link"
                href={resource.href}
                download
                aria-label={`Download ${resource.title}`}
              >
                Download HTML
                <ArrowDownToLine size={16} aria-hidden="true" />
              </a>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
