import { getTopic, NOISE_PRELAB } from '@/lib/catalog';
import { TopicBreadcrumbs } from './TopicBreadcrumbs';
import { TopicArt } from './TopicArt';

export function NoiseFilteringTopic() {
  const topic = getTopic('noise-filtering');
  return (
    <main id="main-content" tabIndex={-1} className="lab-shell">
      <TopicBreadcrumbs />
      <div className="intro topics-intro">
        <span className="eyebrow">WEEK 12 · INDIVIDUAL PREPARATION</span>
        <h1>{topic.title}</h1>
        <p>
          Keep the useful signal. Reduce unwanted variation. Explain the
          tradeoff between smoother data and the events you need to detect.
        </p>
      </div>
      <div className="topic-grid">
        <article className="panel topic-card">
          <div className="topic-art">
            <span className="eyebrow">PREPARE &amp; PREDICT</span>
            <TopicArt noise />
          </div>
          <div className="topic-card-body">
            <h2>Pre-lab</h2>
            <p>
              Work through noise, SNR, analog RC filtering, moving averages and
              exponential smoothing. Complete ten screens at your own pace
              before class on Monday, 26 October 2026. Allow about 45–60
              minutes. No hardware is needed.
            </p>
            <a className="open-lab" href={NOISE_PRELAB.workbook}>
              Open pre-lab <span aria-hidden="true">↗</span>
            </a>
            <p className="small-muted">
              Opens the complete workbook in this tab. Work saves locally in
              your browser; download backups regularly.
            </p>
            <p className="small-muted">
              Optional AI help includes the full coach prompt inside the
              pre-lab, after you preserve a prediction. Show it, copy it or
              select the text manually; no separate file is needed.
            </p>
            <a className="topic-link" href={NOISE_PRELAB.instructions} download>
              Download student instructions
            </a>
            <br />
            <a className="topic-link" href={NOISE_PRELAB.coach} download>
              Download optional AI coach instructions
            </a>
          </div>
        </article>
        <section
          className="panel resource-guide"
          aria-labelledby="prelab-workflow-title"
        >
          <span className="eyebrow">YOUR WORK → YOUR EVIDENCE</span>
          <h2 id="prelab-workflow-title">Complete it. Keep your ZIP.</h2>
          <ol className="prelab-steps">
            <li>
              Enter your name and student ID, then work through the teaching
              screens and hand calculations.
            </li>
            <li>
              Preserve each first prediction before viewing comparisons or
              getting optional help. Record revisions separately.
            </li>
            <li>
              Close AI for the independent check, then complete your reflection
              and review your record.
            </li>
            <li>
              Finalize and download your evidence ZIP. Check that the download
              exists, keep it and bring it to class.
            </li>
          </ol>
          <h3>Save now, continue later</h3>
          <p>
            Use Save JSON backup while you work. To resume, open the pre-lab and
            choose Restore backup with that JSON file. If you have the final
            ZIP, extract <code>workspace_backup.json</code> first; Restore
            backup accepts JSON, not ZIP. A finalized record stays locked after
            restoring.
          </p>
          <p>
            Keep the complete final ZIP for the future individual post-lab. It
            contains your evidence JSON, readable report and workspace backup.
            Changing browser or device requires your backup file. Use one
            workbook tab at a time.
          </p>
          <p>
            Downloading is not submission. Follow the separately published
            assignment for the deadline, destination and required file. All
            examples here are simulated; your instructor supplies the actual
            measurement procedures.
          </p>
        </section>
      </div>
    </main>
  );
}
