import { useEffect, useRef, useState } from 'react';
import { SENSOR_CALIBRATION } from '@/lib/catalog';

type WorksheetWindow = Window & {
  sensorCalibrationHost?: { ready: () => boolean };
};

export function SensorCalibrationWorkspace({
  kind,
}: {
  kind: 'main' | 'post';
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const detachReady = useRef<() => void>(() => {});
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const title =
    kind === 'main'
      ? 'Sensor Calibration Group Main Lab'
      : 'Sensor Calibration Individual Post-Lab';
  const documentPath =
    kind === 'main'
      ? SENSOR_CALIBRATION.mainWorksheet
      : SENSOR_CALIBRATION.postWorksheet;
  useEffect(() => () => detachReady.current(), []);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="calibration-workspace"
      data-status={status}
      aria-busy={status === 'loading'}
    >
      <h1 className="sr-only">{title}</h1>
      {status === 'loading' && (
        <p className="calibration-frame-status" role="status">
          Opening worksheet…
        </p>
      )}
      {status === 'error' && (
        <p className="calibration-frame-status" role="alert">
          The worksheet could not open.{' '}
          <a href={documentPath}>Open the worksheet directly</a>.
        </p>
      )}
      <iframe
        ref={frame}
        title={`${title} workspace`}
        className="calibration-workspace-frame"
        src={`${documentPath}?embed=1`}
        hidden={status === 'error'}
        onError={() => setStatus('error')}
        onLoad={() => {
          detachReady.current();
          const doc = frame.current?.contentDocument;
          const win = frame.current?.contentWindow as WorksheetWindow | null;
          if (doc?.body.dataset.kind !== kind || !win?.sensorCalibrationHost) {
            setStatus('error');
            return;
          }
          if (win.sensorCalibrationHost.ready()) setStatus('ready');
          else {
            const loaded = () => setStatus('ready');
            win.addEventListener('sensor-calibration-ready', loaded, {
              once: true,
            });
            detachReady.current = () =>
              win.removeEventListener('sensor-calibration-ready', loaded);
          }
        }}
      />
    </main>
  );
}
