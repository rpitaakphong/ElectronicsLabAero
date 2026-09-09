import { useEffect, useRef, useState } from 'react';
import { getTopic, getTool, type TopicId } from '@/lib/catalog';
import { TopicBreadcrumbs } from './TopicBreadcrumbs';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

export function SimulatorWorkspace({ lab }: { lab: TopicId }) {
  const topic = getTopic(lab);
  const title = getTool(lab, 'simulator').title;
  const simulatorUrl = topic.simulator.url;
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
      const headerHeight =
        document.querySelector('.site-header')?.getBoundingClientRect()
          .height ?? 0;
      doc.documentElement.style.setProperty(
        '--host-header-height',
        `${headerHeight}px`,
      );
      doc.documentElement.style.setProperty(
        '--host-viewport-height',
        `${Math.max(0, window.innerHeight - headerHeight)}px`,
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
    window.addEventListener('app-header-resize', schedule);
    window.addEventListener('scroll', schedule, { passive: true });
    detach.current = () => {
      observer.disconnect();
      cancelAnimationFrame(pending);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('app-header-resize', schedule);
      window.removeEventListener('scroll', schedule);
    };
    update();
    setStatus('ready');
  }

  return (
    <main id="main-content" tabIndex={-1} className="simulator-page">
      <div className="lab-shell simulator-heading">
        <TopicBreadcrumbs />
        <div className="intro simulator-intro">
          <div>
            <h1>{title}</h1>
            <p>{topic.simulator.description}</p>
          </div>
          <div className="simulator-actions">
            <Button
              variant="ghost"
              disabled={status !== 'ready'}
              onClick={() =>
                frame.current?.contentDocument
                  ?.querySelector<HTMLButtonElement>('#resetAllBtn')
                  ?.click()
              }
            >
              <RotateCcw size={15} aria-hidden="true" />
              Reset lab
            </Button>
            <a className="topic-link" href={topic.simulator.download} download>
              Download offline simulator ↓
            </a>
          </div>
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
        title={`${title} workspace`}
        src={`${simulatorUrl}?embed=1`}
        onLoad={connectFrame}
        onError={() => setStatus('error')}
        hidden={status === 'error'}
      />
    </main>
  );
}
