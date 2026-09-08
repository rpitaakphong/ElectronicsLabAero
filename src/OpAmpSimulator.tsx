import { useEffect, useRef, useState } from 'react';
import { TopicHeader } from './TopicHeader';
import { OpAmpBreadcrumbs } from './OpAmpBreadcrumbs';

const simulatorUrl = '/simulators/opamp/index.html';

export function OpAmpSimulator() {
  const frame = useRef<HTMLIFrameElement>(null);
  const detach = useRef<() => void>(() => {});
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  useEffect(() => () => detach.current(), []);

  function connectFrame() {
    detach.current();
    const iframe = frame.current;
    const doc = iframe?.contentDocument;
    if (!iframe || !doc?.querySelector('#breadboardCanvas')) {
      setStatus('error');
      return;
    }
    let pending = 0;
    const update = () => {
      pending = 0;
      // Embedded bodies have no viewport-based minimum, so disclosures can shrink too.
      const height = Math.ceil(doc.body.getBoundingClientRect().height);
      if (height > 0 && iframe.style.height !== `${height}px`)
        iframe.style.height = `${height}px`;
      const rect = iframe.getBoundingClientRect();
      doc.documentElement.style.setProperty(
        '--host-viewport-height',
        `${window.innerHeight}px`,
      );
      doc.documentElement.style.setProperty(
        '--host-visible-bottom',
        `${Math.max(0, Math.min(rect.height, window.innerHeight - rect.top))}px`,
      );
    };
    const schedule = () => {
      if (!pending) pending = requestAnimationFrame(update);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(doc.body);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, { passive: true });
    detach.current = () => {
      observer.disconnect();
      cancelAnimationFrame(pending);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule);
    };
    update();
    setStatus('ready');
  }

  return (
    <main className="simulator-page">
      <div className="lab-shell simulator-heading">
        <TopicHeader home />
        <OpAmpBreadcrumbs current="Op-Amp Lab Simulator" />
        <div className="intro simulator-intro">
          <div>
            <h1>Op-Amp Lab Simulator</h1>
            <p>
              Build your circuit. Connect the instruments. Explore the signal.
            </p>
          </div>
          <a
            className="topic-link"
            href="/simulators/opamp/gds1202b_opamp_sim_single_file.html"
            download
          >
            Download offline simulator ↓
          </a>
        </div>
        {status === 'loading' && <p role="status">Loading simulator…</p>}
        {status === 'error' && (
          <p role="alert">
            The simulator could not load.{' '}
            <a className="topic-link" href={simulatorUrl}>
              Open the standalone simulator
            </a>
          </p>
        )}
      </div>
      <iframe
        ref={frame}
        className="simulator-frame"
        title="Op-Amp Lab Simulator workspace"
        src={`${simulatorUrl}?embed=1`}
        onLoad={connectFrame}
        onError={() => setStatus('error')}
        hidden={status === 'error'}
      />
    </main>
  );
}
