import { getTopic, NOISE_PRELAB, NOISE_MAIN_LAB, NOISE_POST_LAB } from '@/lib/catalog';
import { Link } from 'react-router-dom';
import { TopicBreadcrumbs } from './TopicBreadcrumbs';
import { TopicArt } from './TopicArt';

export function NoiseFilteringTopic() {
  const topic = getTopic('noise-filtering');
  return (
    <main id="main-content" tabIndex={-1} className="lab-shell">
      <TopicBreadcrumbs />
      <div className="intro topics-intro">
        <span className="eyebrow">
          WEEK 12 · PREPARE, MEASURE &amp; KEEP YOUR LAB FILES
        </span>
        <h1>{topic.title}</h1>
        <p>
          Keep the useful signal. Reduce unwanted variation. Explain the
          tradeoff between smoother data and the events you need to detect.
        </p>
      </div>
      <div className="topic-grid">
        <article className="panel topic-card">
          <div className="topic-art">
            <span className="eyebrow">EXPLORE THE CONCEPTS</span>
            <TopicArt noise />
          </div>
          <div className="topic-card-body">
            <h2>Interactive Learning</h2>
            <p>
              Explore signal and noise, filter families, RC smoothing, moving
              averages, exponential averaging and sampling. Adjust parameters
              and compare what happens to the waveform.
            </p>
            <Link className="open-lab" to="/noise-and-filtering/learn">
              Start learning <span aria-hidden="true">→</span>
            </Link>
            <p className="small-muted">
              A standalone learning space with synthetic signals, worked
              mathematics and open exploration. No hardware or saved workbook is
              needed.
            </p>
          </div>
        </article>
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
              pre-lab, after you save your first prediction. Show it, copy it or
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
        <article className="panel topic-card">
          <div className="topic-art">
            <span className="eyebrow">BUILD &amp; MEASURE</span>
            <TopicArt noise />
          </div>
          <div className="topic-card-body">
            <h2>Main lab</h2>
            <p>
              Work in a group of up to three with an UNO R4 and oscilloscope.
              Upload the working pulse source, discover its FFT, design and
              build an RC filter, and measure attenuation. Export five seconds of
              the filtered signal and try moving-average and EMA settings in
              Excel, MATLAB, Python or another program. Submit separate MA and
              EMA comparison figures with labelled axes and legends.
            </p>
            <a className="open-lab" href={NOISE_MAIN_LAB.workbook}>
              Open main lab <span aria-hidden="true">↗</span>
            </a>
            <p className="small-muted">
              Answers and attached screenshots save in this browser. Each
              member keeps the group’s main-lab ZIP and their own pre-lab ZIP
              for the individual post-lab. Restore main-lab JSON or ZIP
              in the main worksheet. Downloads are not submissions.
            </p>
            <a className="topic-link" href={NOISE_MAIN_LAB.sketch} download>
              Download UNO R4 signal-source sketch
            </a>
            <br />
            <a className="topic-link" href={NOISE_MAIN_LAB.guide} download>
              Download wiring and measurement guide
            </a>
          </div>
        </article>

        <article className="panel topic-card">
          <div className="topic-art"><span className="eyebrow">EXPLAIN &amp; REFLECT</span><TopicArt noise /></div>
          <div className="topic-card-body">
            <h2>Individual post-lab</h2>
            <p>Load your group ZIP and your own pre-lab ZIP. Calculate attenuation, discuss useful pulse changes, compare MA and EMA settings, and justify your final design.</p>
            <a className="open-lab" href={NOISE_POST_LAB.workbook}>Open individual post-lab <span aria-hidden="true">↗</span></a>
            <p className="small-muted">Your individual answers save separately. Original group measurements and pre-lab predictions stay unchanged.</p>
          </div>
        </article>

        <section
          className="panel resource-guide"
          aria-labelledby="prelab-workflow-title"
        >
          <span className="eyebrow">COMPLETE YOUR WORK AND KEEP A COPY</span>
          <h2 id="prelab-workflow-title">Complete it. Keep your ZIP.</h2>
          <ol className="prelab-steps">
            <li>
              Enter your name and student ID, then work through the teaching
              screens and hand calculations.
            </li>
            <li>
              Save each first prediction before viewing comparisons or
              getting optional help. Record revisions separately.
            </li>
            <li>
              Close AI for the independent check, then complete your reflection
              and review your record.
            </li>
            <li>
              Finalize and download your final ZIP. Check that the download
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
            Keep the complete final ZIP for the individual post-lab. It
            contains your answers JSON, readable report and workspace backup.
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
