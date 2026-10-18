import { Link } from 'react-router-dom';
import { ArrowDownToLine, ArrowRight } from 'lucide-react';
import { RESOURCES, SITE_PAGES } from '@/lib/catalog';
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
