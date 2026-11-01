import { Link } from 'react-router-dom';
import { SENSOR_CALIBRATION } from '@/lib/catalog';
import { TopicBreadcrumbs } from './TopicBreadcrumbs';
import { TopicArt } from './TopicArt';

export function SensorCalibrationTopic() {
  return (
    <main id="main-content" tabIndex={-1} className="lab-shell">
      <TopicBreadcrumbs />
      <div className="intro topics-intro">
        <span className="eyebrow">
          Use a ruler to check the sensor’s distance readings.
        </span>
        <h1>Calibrate an ultrasonic distance sensor</h1>
        <p>
          Build an Arduino ultrasonic measurement system, calibrate echo time
          against ruler distance, estimate sensitivity and uncertainty, and
          investigate how target angle affects the readings.
        </p>
      </div>
      <div className="topic-grid">
        <article className="panel topic-card">
          <div className="topic-art">
            <span className="eyebrow">
              Take the measurements with your group.
            </span>
            <TopicArt calibration />
          </div>
          <div className="topic-card-body">
            <span className="eyebrow">
              Allow approximately three hours in class.
            </span>
            <h2>Build your system and design three calibration runs</h2>
            <p>
              Use an Arduino UNO R4 WiFi, HC-SR04 and ruler. Work out the
              connections and develop or generate your own code. Upload a
              circuit photograph and paste your Arduino code first.
            </p>
            <p>
              Choose and justify your distances and repetition counts. Upload
              your measurements as CSV and add your calibration graph. Check two
              new distances, then compare perpendicular, tilted and returned
              target orientations.
            </p>
            <a className="open-lab" href={SENSOR_CALIBRATION.main}>
              Open group main lab <span aria-hidden="true">↗</span>
            </a>
          </div>
        </article>
        <article className="panel topic-card">
          <div className="topic-art">
            <span className="eyebrow">
              Calculate and explain the results individually.
            </span>
            <TopicArt calibration />
          </div>
          <div className="topic-card-body">
            <span className="eyebrow">Complete this part after class.</span>
            <h2>Calculate distance, sensitivity and uncertainty</h2>
            <p>
              Open your group’s ZIP or JSON file and calculate the results in
              Excel, MATLAB, Python or another program. Enter your calculations,
              add your graphs and write your own explanations.
            </p>
            <p>
              Fit the calibration line, calculate its sensitivity and error
              measures, check the two new distances, and estimate the
              uncertainty in a distance you report. Explain how target angle
              affected the readings. The original group files stay read-only.
            </p>
            <a className="open-lab" href={SENSOR_CALIBRATION.post}>
              Open individual post-lab <span aria-hidden="true">↗</span>
            </a>
          </div>
        </article>
      </div>
      <section className="panel resource-guide">
        <h2>Use the prelab ideas with a different sensor</h2>
        <p>
          In this experiment, the ruler provides the reference distance and the
          Arduino measures ultrasonic echo duration. You will apply the prelab
          ideas about repeated readings, calibration, accuracy and uncertainty
          to pulse timing.
        </p>
        <p>
          Use one group worksheet on one computer and give every member a copy
          of the group ZIP. Each student then completes a separate post-lab.
          Download a backup before changing devices, and submit the finished
          work as instructed by your teacher.
        </p>
        <Link className="topic-link" to="/resources">
          Browse lab resources →
        </Link>
      </section>
    </main>
  );
}
