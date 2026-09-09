import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { SITE_PAGES } from '@/lib/catalog';
import { TopicArt } from './TopicArt';

export function Welcome() {
  return (
    <main id="main-content" tabIndex={-1} className="lab-shell welcome-page">
      <section className="welcome-hero" aria-labelledby="welcome-title">
        <div className="welcome-copy">
          <span className="eyebrow">THE INTERACTIVE LEARNING LAB</span>
          <h1 id="welcome-title">
            Learn electronics by building and measuring circuits.
          </h1>
          <p>
            Interactive lessons and practical simulators for aerospace
            engineering students. Connect the theory to a circuit you can build,
            change, and understand.
          </p>
          <div className="welcome-actions">
            <Link className="primary-link" to={SITE_PAGES.topics.path}>
              Browse topics
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
          <p className="welcome-note">
            Explore at your own pace. Learn by experimenting.
          </p>
        </div>
        <div className="welcome-visual" aria-hidden="true">
          <div className="welcome-visual-top">
            <span className="live-dot" />
            <span>FROM THEORY TO THE BENCH</span>
            <span className="visual-code">01 / DC</span>
          </div>
          <div className="hero-circuit">
            <TopicArt divider />
          </div>
          <div className="hero-readouts">
            <div>
              <span>Input</span>
              <strong>
                5.0 <small>V</small>
              </strong>
            </div>
            <div>
              <span>Divider ratio</span>
              <strong>½</strong>
            </div>
            <div>
              <span>Output</span>
              <strong>
                2.5 <small>V</small>
              </strong>
            </div>
          </div>
          <div className="hero-example-caption">
            Equal resistors. Half the voltage.
            <span>What changes with a load? ↗</span>
          </div>
        </div>
      </section>
    </main>
  );
}
