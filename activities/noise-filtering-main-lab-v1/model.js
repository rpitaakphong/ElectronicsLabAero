export const ACTIVITY = '2145427-w12-noise-filtering-main-lab';
export const VERSION = 1;
export const STORAGE_KEY = 'electronics-noise-filtering-main-lab-v1';
export const DATABASE = 'electronics-noise-filtering-main-lab-files-v1';
export const PRELAB = '/courses/2145427/week12/prelab/v1.0.0/START_HERE.html';
export const DOWNLOAD_BASE = '/courses/2145427/week12/main-lab/v1.0.0/';
export const SCREENS = ['Preparation', 'Sensor baseline', 'Analog filtering', 'Digital filtering', 'Save lab data'];
export const GROUP_FIELDS = {
  groupId: 'Group ID', student1Name: 'Student 1 name', student1Id: 'Student 1 ID',
  student2Name: 'Student 2 name (optional)', student2Id: 'Student 2 ID (optional)',
};
export const SETUP_FIELDS = {
  board: 'UNO R4 variant (Minima or WiFi)', sketch: 'Sketch version', reference: 'Measured supply/reference voltage (V)',
  nominalRate: 'Nominal sampling rate (samples/s)', actualRate: 'Measured sampling rate (samples/s)',
  scope: 'Oscilloscope model / bench', generator: 'Function generator model / bench', probe: 'Probe attenuation, coupling and input impedance',
  inventory: 'Actual resistors, capacitors and component tolerances',
  noiseLimit: 'Instructor noise RMS limit (V, optional)', responseLimit: 'Instructor response-time limit (ms, optional)',
  eventLimit: 'Instructor event requirement (optional; include metric and units)',
  notes: 'Equipment checks, issues or instructor changes',
};
export const NOTES = {
  usefulSignal: 'Intended light change and unwanted variation', selectedDivider: 'Selected divider resistance (Ω)',
  dividerReason: 'Reason for the divider choice', illumination: 'LED/LDR spacing and ambient illumination',
  pulse: 'Actual optical pulse duration (ms)', baselineNotes: 'Baseline observations and limitations',
  analogNotes: 'Analog observations, changes and limitations', digitalNotes: 'Digital observations, changes and limitations',
  cascade: 'Optional RC + digital cascade: configuration, capture IDs and observations',
};
const columns = (...pairs) => pairs.map(([id, label]) => ({ id, label }));
export const TABLES = {
  divider: { title: 'Divider range and steady noise', page: 1, rows: [['r10', 'Approximately 10 kΩ'], ['r40', 'Approximately 40 kΩ']], columns: columns(
    ['resistance', 'Actual resistance (Ω)'], ['dark', 'Dark level (V)'], ['light', 'Light level (V)'], ['span', 'Voltage span (V)'],
    ['codes', 'ADC code span'], ['noise', 'Steady noise RMS (V)'], ['notes', 'Clipping / notes']) },
  analog: { title: 'Sensor-chain measurements', page: 2, rows: [['bypass', 'Bypass'], ['rca', 'RC A'], ['rcb', 'RC B']], columns: columns(
    ['resistance', 'Filter resistance (Ω; bypass: 0)'], ['capacitance', 'Capacitance (µF; bypass: 0)'], ['noise', 'Steady noise RMS (V)'],
    ['stepBase', 'Step baseline (V)'], ['stepFinal', 'Step final level (V)'], ['edge', 'Input-edge time (ms)'], ['cross90', '90% crossing time (ms)'],
    ['pulseBase', 'Pulse baseline (V)'], ['pulsePeak', 'Pulse peak (V)'], ['evidence', 'Capture IDs / notes']) },
  rc: { title: 'Controlled electrical RC step', page: 2, rows: [['rca', 'RC A'], ['rcb', 'RC B']], columns: columns(
    ['tauPred', 'Predicted time constant (ms)'], ['fcPred', 'Predicted cutoff (Hz)'], ['tauMeasured', 'Measured 63.2% time (ms)'],
    ['rise', 'Measured 10–90% rise time (ms)'], ['source', 'Generator source/load settings'], ['notes', 'Evidence / limitations']) },
  digital: { title: 'Digital filters on identical samples', page: 3, rows: [['raw', 'RAW'], ['ma5', 'MA short (start: 5 samples)'], ['ma21', 'MA long (start: 21 samples)'], ['ema20', 'EMA faster (start: 0.20)'], ['ema04', 'EMA slower (start: 0.04)']], columns: columns(
    ['setting', 'Actual setting'], ['noise', 'Steady noise RMS (V)'], ['stepBase', 'Step baseline (V)'], ['stepFinal', 'Step final level (V)'],
    ['cross90', '90% crossing timestamp (ms)'], ['pulseBase', 'Pulse baseline (V)'], ['pulsePeak', 'Pulse peak (V)'], ['evidence', 'Common capture IDs / notes']) },
  snr: { title: 'Required SNR recordings for individual analysis', page: 2, rows: [['raw', 'Bypass: RAW / MA / EMA'], ['rca', 'RC A'], ['rcb', 'RC B']], columns: columns(
    ['frequency', 'Measured sine frequency (Hz)'], ['amplitude', 'Measured input amplitude (Vpp)'], ['offset', 'DC offset (V)'],
    ['rate', 'Actual sampling rate (samples/s)'], ['duration', 'Recorded duration (s)'], ['count', 'Sample count'],
    ['settings', 'Actual filter settings'], ['notes', 'Capture ID / clipping / limitations']) },
};
const capture = (id, label, page, kind = 'csv', mode = 'steady') => ({ id, label, page, kind, mode });
export const CAPTURES = [
  capture('baseline10', '10 kΩ divider: steady illuminated', 1), capture('baseline40', '40 kΩ divider: steady illuminated', 1),
  capture('baseline_step', 'Selected divider: light step', 1, 'csv', 'step'), capture('baseline_pulse', 'Selected divider: light pulse', 1, 'csv', 'pulse'),
  ...['rca', 'rcb'].flatMap((r) => [capture(`${r}_steady`, `${r.toUpperCase()}: steady illuminated`, 2), capture(`${r}_step`, `${r.toUpperCase()}: light step`, 2, 'csv', 'step'), capture(`${r}_pulse`, `${r.toUpperCase()}: light pulse`, 2, 'csv', 'pulse'), capture(`${r}_electrical`, `${r.toUpperCase()}: controlled electrical step`, 2, 'image', 'external')]),
  capture('snr_raw', 'SNR: bypass sine (also digital reference)', 2, 'both', 'external'), capture('snr_rca', 'SNR: RC A sine', 2, 'both', 'external'), capture('snr_rcb', 'SNR: RC B sine', 2, 'both', 'external'),
  capture('digital_steady', 'Digital comparison: steady illuminated', 3), capture('digital_step', 'Digital comparison: light step', 3, 'csv', 'step'), capture('digital_pulse', 'Digital comparison: light pulse', 3, 'csv', 'pulse'),
  capture('cascade', 'Optional combined RC + digital run', 3, 'optional', 'external'),
];
export const CAPTURE_FIELDS = {
  runId: 'Sketch run ID / scope capture ID', source: 'Source, illumination and circuit configuration', rate: 'Actual sample rate (samples/s)',
  windowStart: 'Analysis window start (s)', windowEnd: 'Analysis window end (s)', stimulus: 'Stimulus timing / pulse width / frequency',
  settings: 'Filter settings, warm-up and reference voltage', timing: 'Clipping count, missed slots, maximum lateness / gaps',
  notes: 'Measurement method, unavailable results or limitations',
};
export const EXPERIMENTS = ['baseline', 'analog', 'digital'];
export const PREDICTION_FIELDS = { configuration: 'Actual configuration and settings', prediction: 'Predicted behavior', reason: 'Reason and assumptions / uncertainty' };
export const fieldLabels = {
  ...Object.fromEntries(Object.entries(GROUP_FIELDS).map(([k, v]) => [`group.${k}`, v])),
  ...Object.fromEntries(Object.entries(SETUP_FIELDS).map(([k, v]) => [`setup.${k}`, v])),
  ...Object.fromEntries(Object.entries(NOTES).map(([k, v]) => [`notes.${k}`, v])),
  ...Object.fromEntries(Object.entries(TABLES).flatMap(([id, t]) => t.rows.flatMap(([r, name]) => t.columns.map((c) => [`${id}.${r}.${c.id}`, `${name}: ${c.label}`])))),
  ...Object.fromEntries(CAPTURES.flatMap((c) => Object.entries(CAPTURE_FIELDS).map(([k, label]) => [`capture.${c.id}.${k}`, `${c.label}: ${label}`]))),
  ...Object.fromEntries(EXPERIMENTS.flatMap((e) => Object.entries(PREDICTION_FIELDS).map(([k, label]) => [`prediction.${e}.${k}`, `${e}: ${label}`]))),
};
export const SLOT_IDS = CAPTURES.flatMap((c) => [`${c.id}.image`, `${c.id}.csv`]);
export const MAX_TEXT = 4000;
export const MAX_RECORD = 4 * 1024 * 1024;
export function createRecord() {
  const at = new Date().toISOString();
  return { activityId: ACTIVITY, schemaVersion: VERSION, recordId: crypto.randomUUID(), createdAt: at, updatedAt: at, current: 0,
    fileSlots: [], fields: Object.fromEntries(Object.keys(fieldLabels).map((key) => [key, ''])),
    originals: Object.fromEntries(EXPERIMENTS.map((e) => [e, null])) };
}
const object = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
function exactKeys(value, keys) { return object(value) && Object.keys(value).length === keys.length && keys.every((k) => Object.hasOwn(value, k)); }
const validDate = (x) => typeof x === 'string' && x.length < 50 && Number.isFinite(Date.parse(x));
export function validateRecord(value) {
  if (!object(value) || value.activityId !== ACTIVITY || value.schemaVersion !== VERSION) throw new Error('Choose a Noise and Filtering main-lab v1 backup. Pre-lab and 555 files belong in their own worksheets.');
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(value.recordId) || !validDate(value.createdAt) || !validDate(value.updatedAt) || !Number.isInteger(value.current) || value.current < 0 || value.current > 4) throw new Error('Invalid workbook identity, dates or page.');
  if (!exactKeys(value.fields, Object.keys(fieldLabels)) || Object.values(value.fields).some((v) => typeof v !== 'string' || v.length > MAX_TEXT)) throw new Error('Invalid or oversized answer fields.');
  if (!exactKeys(value.originals, EXPERIMENTS)) throw new Error('Invalid preserved predictions.');
  if (!Array.isArray(value.fileSlots) || value.fileSlots.some((slot) => !SLOT_IDS.includes(slot)) || new Set(value.fileSlots).size !== value.fileSlots.length) throw new Error('Invalid attachment inventory.');
  for (const p of Object.values(value.originals)) {
    if (p === null) continue;
    if (!exactKeys(p, ['at', ...Object.keys(PREDICTION_FIELDS)]) || !validDate(p.at) || Object.keys(PREDICTION_FIELDS).some((k) => typeof p[k] !== 'string' || !p[k].trim() || p[k].length > MAX_TEXT)) throw new Error('Invalid preserved prediction.');
  }
  if (JSON.stringify(value).length > MAX_RECORD) throw new Error('Answer record is too large.');
  // Retain only the documented v1 shape; no unrelated activity data or executable values.
  return structuredClone({ activityId: ACTIVITY, schemaVersion: VERSION, recordId: value.recordId, createdAt: value.createdAt, updatedAt: value.updatedAt, current: value.current, fileSlots: value.fileSlots, fields: value.fields, originals: value.originals });
}
export function updateField(record, key, value) {
  if (!Object.hasOwn(fieldLabels, key) || typeof value !== 'string' || value.length > MAX_TEXT) throw new Error('This answer cannot be saved.');
  record.fields[key] = value;
  record.updatedAt = new Date().toISOString();
}
export function preserve(record, experiment) {
  if (!EXPERIMENTS.includes(experiment) || record.originals[experiment]) throw new Error('This original prediction is already preserved or unavailable.');
  const data = Object.fromEntries(Object.keys(PREDICTION_FIELDS).map((k) => [k, record.fields[`prediction.${experiment}.${k}`]]));
  if (Object.values(data).some((v) => !v.trim())) throw new Error('Enter the configuration, prediction, and reasoning or uncertainty first.');
  record.originals[experiment] = { at: new Date().toISOString(), ...data };
  record.updatedAt = new Date().toISOString();
}
export function identityIssues(record) {
  const f = record.fields, issues = [];
  if (!f['group.groupId'].trim()) issues.push('Enter Group ID.');
  if (!f['group.student1Name'].trim() || !f['group.student1Id'].trim()) issues.push('Complete Student 1 name and ID.');
  const name2 = f['group.student2Name'].trim(), id2 = f['group.student2Id'].trim();
  if (Boolean(name2) !== Boolean(id2)) issues.push('Complete both Student 2 fields or leave both blank.');
  if (id2 && id2 === f['group.student1Id'].trim()) issues.push('The two student IDs must differ.');
  return issues;
}
export function completeness(record, files = {}) {
  const issues = [...identityIssues(record)];
  const apparatus = ['board', 'sketch', 'reference', 'nominalRate', 'actualRate', 'scope', 'generator', 'probe', 'inventory'];
  const missingApparatus = apparatus.filter((k) => !record.fields[`setup.${k}`].trim());
  if (missingApparatus.length) issues.push(`Apparatus: record ${missingApparatus.map((k) => SETUP_FIELDS[k]).join(', ')}.`);
  const conditions = ['usefulSignal', 'selectedDivider', 'dividerReason', 'illumination', 'pulse'];
  if (conditions.some((k) => !record.fields[`notes.${k}`].trim())) issues.push('Record the useful signal, selected divider and reason, illumination arrangement, and actual pulse duration.');
  for (const e of EXPERIMENTS) if (!record.originals[e]) issues.push(`Preserve the ${e} bench prediction.`);
  for (const [id, table] of Object.entries(TABLES)) {
    const missing = table.rows.filter(([r]) => table.columns.some((c) => c.id !== 'notes' && c.id !== 'evidence' && !record.fields[`${id}.${r}.${c.id}`].trim()));
    if (missing.length) issues.push(`${table.title}: complete ${missing.map(([, label]) => label).join(', ')} (or explain unavailable results in each field).`);
  }
  for (const c of CAPTURES.filter((c) => c.kind !== 'optional')) {
    if ((c.kind === 'csv' || c.kind === 'both') && !files[`${c.id}.csv`]) issues.push(`${c.label}: attach CSV evidence.`);
    if ((c.kind === 'image' || c.kind === 'both') && !files[`${c.id}.image`]) issues.push(`${c.label}: attach a scope image.`);
    const metadata = ['runId', 'source', 'rate', 'windowStart', 'windowEnd', 'stimulus', 'settings', 'timing'];
    const missing = metadata.filter((k) => !record.fields[`capture.${c.id}.${k}`].trim());
    if (missing.length) issues.push(`${c.label}: record ${missing.map((k) => CAPTURE_FIELDS[k]).join(', ')} (or explain limitations).`);
  }
  return issues;
}
export function filename(record) {
  const f = record.fields;
  return ['2145427_W12_MAIN_LAB', f['group.groupId'] || 'DRAFT', f['group.student1Id'], f['group.student2Id']].filter(Boolean).join('_').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 180);
}
