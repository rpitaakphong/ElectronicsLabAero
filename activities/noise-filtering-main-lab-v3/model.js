export const ACTIVITY = '2145427-w12-noise-filtering-main-lab';
export const VERSION = 3;
export const STORAGE_KEY = 'electronics-noise-filtering-main-lab-v3';
export const DATABASE = 'electronics-noise-filtering-main-lab-files-v3';
export const LEGACY = '/worksheets/noise-filtering-main-lab-v1.html';
export const LEGACY_SINE = '/worksheets/noise-filtering-main-lab-v2.html';
export const DOWNLOAD_BASE = '/courses/2145427/week12/main-lab/v3.0.0/';
export const SCREENS = ['Repair the noisy signal source', 'Investigate the spectrum', 'Design and build the RC filter', 'Add digital filtering', 'Save lab files'];
export const ALLOWANCES = ['20 minutes', '35 minutes', '65 minutes', '40 minutes', '10 minutes'];
export const TONES = [120, 150, 180];
export const GROUP_FIELDS = {
  groupId: 'Group ID', student1Name: 'Student 1 name (required)', student1Id: 'Student 1 ID (optional)',
  student2Name: 'Student 2 name (optional)', student2Id: 'Student 2 ID (optional)',
  student3Name: 'Student 3 name (optional)', student3Id: 'Student 3 ID (optional)',
};
export const SETUP_FIELDS = {
  board: 'UNO R4 variant (Minima or WiFi)', core: 'Arduino IDE / UNO R4 core version',
  reference: 'Measured supply / ADC and DAC reference (V)', scope: 'Oscilloscope model / bench',
  probes: 'Probe attenuation, coupling and input impedance', inventory: 'Available resistors, capacitors and tolerances',
  timing: 'Status: actual DAC / ADC rates, missed deadlines, overruns and clipping',
};
export const DEBUG_FIELDS = {
  error: 'Compiler error you observed (key lines)', explanation: 'Your explanation of the cause',
  ai: 'AI tool and summary of the help / prompt used (no full transcript needed)',
  fix: 'What you changed and why', verification: 'How you checked that the code compiles, uploads and produces the expected signal',
};
export const SCOPE_FIELDS = {
  procedure: 'FFT procedure you discovered, including resources used',
  settings: 'FFT source, window, record length, actual sample rate, frequency span and scales',
  resolution: 'How record duration / window affected pulse harmonics and interference identification',
  units: 'Amplitude units and convention used consistently (for example V RMS or dBV RMS)',
  observations: 'Clean versus noisy spectrum: pulse harmonics, added interference and unexpected components',
  comparison: 'Clean / noisy source commands, transition cycles discarded, matched scope settings and capture IDs',
};
export const DESIGN_FIELDS = {
  type: 'Chosen filter type: low-pass or high-pass', reason: 'Why this filter reduces interference while keeping the commands and short pulses clear',
  cutoff: 'Chosen cutoff frequency (Hz) and justification', resistanceNominal: 'Nominal R (Ω)',
  capacitanceNominal: 'Nominal C (nF)', predictedUseful: 'Predicted effects on long / short pulse height, width, edges and delay',
  predictedNoise: 'Predicted effects on 120, 150 and 180 Hz',
  resistanceActual: 'Actual R (Ω), tolerance / measurement method', capacitanceActual: 'Actual C (nF), tolerance / measurement method',
  actualCutoff: 'Cutoff calculated from actual components (Hz)',
  review: 'Instructor wiring review / different-topology approval',
  corrections: 'Later changes to your design and why you made them', observations: 'What you measured: pulse changes, interference reduction and measurement limits',
};
export const DIGITAL_FIELDS = {
  maWindow: 'Chosen MA window length (samples)', emaAlpha: 'Chosen EMA coefficient',
  initialization: 'Filter initialization and settling used', integration: 'How you added the example code, what you changed and any AI help used',
  verification: 'How you checked that MA and EMA each use the same A1 readings',
  observations: 'Compare RC, RC_MA and RC_EMA: useful information, interference and delay',
  trials: 'Parameter trials: explain why your chosen MA / EMA settings balance ripple, short-event loss and delay',
  limitations: 'What you could and could not measure from the live plot',
};
const columns = (...pairs) => pairs.map(([id, label]) => ({ id, label }));
export const TABLES = {
  spectrum: { title: 'Interference-frequency bins: input / RC comparison', page: 2,
    rows: TONES.map((f) => [String(f), `${f} Hz · interference-frequency bin`]),
    columns: columns(['measuredFrequency', 'Measured frequency (Hz)'], ['clean', 'Clean source bin amplitude'], ['input', 'Noisy input bin amplitude'],
      ['output', 'Noisy RC output bin amplitude'], ['predictedGain', 'Predicted amplitude ratio'],
      ['measuredGain', 'Measured amplitude ratio'], ['attenuation', 'Attenuation (dB; state sign)'], ['notes', 'Supporting files / notes']) },
  pulses: { title: 'Long and short pulse measurements', page: 2,
    rows: [['clean', 'Clean source'], ['baseline', 'Noisy source'], ['filteredClean', 'Clean RC output'], ['filtered', 'Noisy RC output']],
    columns: columns(['longHeight', 'Long-pulse height above baseline (V)'], ['shortHeight', 'Short-pulse height above baseline (V)'],
      ['shortWidth', 'Short-pulse width (ms; state threshold)'], ['delay', 'Event delay (ms; state reference / threshold)'],
      ['ripple', 'Steady-window ripple RMS (V; state window)'], ['notes', 'Capture IDs / method / limits']) },
  digital: { title: 'Parameter trials after the same physical RC', page: 3,
    rows: [['maShort', 'MA · short window'], ['maLong', 'MA · long window'], ['maChosen', 'MA · chosen setting'],
      ['emaFast', 'EMA · larger coefficient'], ['emaSlow', 'EMA · smaller coefficient'], ['emaChosen', 'EMA · chosen setting']],
    columns: columns(['setting', 'Actual setting and sample rate'], ['amplitude', 'Long / short pulse heights and width changes'],
      ['interference', 'Steady ripple / smoothing observed'], ['delay', 'Event delay observed and method'], ['notes', 'Reasons for your choice / supporting files / notes']) },
};
const capture = (id, label, page, kind) => ({ id, label, page, kind });
export const CAPTURES = [
  capture('clean', 'Clean reference: source FFT and pulse waveform', 1, 'both'),
  capture('baseline', 'Noisy baseline: source FFT and waveform', 1, 'both'),
  capture('filteredClean', 'Clean physical RC output: pulse waveform', 2, 'csv'),
  capture('filtered', 'Noisy physical RC: output FFT and waveform', 2, 'both'),
  capture('digital', 'Live Serial Plotter: RC / RC_MA / RC_EMA', 3, 'image'),
  ...[1, 2, 3, 4].map((n) => capture(`extra${n}`, `Extra files ${n}`, 4, 'optional')),
];
export const CAPTURE_FIELDS = {
  runId: 'Recording label / filenames', source: 'Signal source, measurement point and circuit setup',
  rate: 'Actual scope sampling rate (samples/s); digital plot: ADC rate',
  window: 'Recording duration, sample count and analysis window',
  settings: 'Scope / filter settings; amplitude units and voltage reference',
  notes: 'Timing, clipping, missing values and measurement limitations',
};
export const CODE_FIELDS = { generator: 'Repaired generator sketch (.ino)', digital: 'Final digital-filter sketch (.ino)' };
export const EXPERIMENTS = ['generator', 'design', 'digital'];
export const SAVED_COPY_LABELS = { generator: 'Original working code', design: 'Initial RC design', digital: 'Final filter code' };
export const PRESERVE_FIELDS = {
  generator: ['code.generator', ...Object.keys(DEBUG_FIELDS).map((k) => `debug.${k}`)],
  design: ['type', 'reason', 'cutoff', 'resistanceNominal', 'capacitanceNominal', 'predictedUseful', 'predictedNoise'].map((k) => `design.${k}`),
  digital: ['code.digital', 'digital.maWindow', 'digital.emaAlpha', 'digital.initialization', 'digital.integration', 'digital.verification'],
};
export const fieldLabels = {
  ...Object.fromEntries(Object.entries(GROUP_FIELDS).map(([k, v]) => [`group.${k}`, v])),
  ...Object.fromEntries(Object.entries(SETUP_FIELDS).map(([k, v]) => [`setup.${k}`, v])),
  ...Object.fromEntries(Object.entries(DEBUG_FIELDS).map(([k, v]) => [`debug.${k}`, v])),
  ...Object.fromEntries(Object.entries(SCOPE_FIELDS).map(([k, v]) => [`scope.${k}`, v])),
  ...Object.fromEntries(Object.entries(DESIGN_FIELDS).map(([k, v]) => [`design.${k}`, v])),
  ...Object.fromEntries(Object.entries(DIGITAL_FIELDS).map(([k, v]) => [`digital.${k}`, v])),
  ...Object.fromEntries(Object.entries(CODE_FIELDS).map(([k, v]) => [`code.${k}`, v])),
  ...Object.fromEntries(Object.entries(TABLES).flatMap(([id, t]) => t.rows.flatMap(([r, name]) => t.columns.map((c) => [`${id}.${r}.${c.id}`, `${name}: ${c.label}`])))),
  ...Object.fromEntries(CAPTURES.flatMap((c) => Object.entries(CAPTURE_FIELDS).map(([k, label]) => [`capture.${c.id}.${k}`, `${c.label}: ${label}`]))),
};
export const SLOT_IDS = CAPTURES.flatMap((c) => [`${c.id}.image`, `${c.id}.csv`]);
export const MAX_TEXT = 4000;
export const MAX_CODE = 128 * 1024;
export const MAX_RECORD = 2 * 1024 * 1024;
const byteLength = (v) => new TextEncoder().encode(v).length;
const validText = (key, v) => typeof v === 'string' && (key.startsWith('code.') ? byteLength(v) <= MAX_CODE : v.length <= MAX_TEXT);
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
  if (value?.activityId === ACTIVITY && value.schemaVersion === 1) throw new Error(`This is a legacy LDR v1 record. Restore it at ${LEGACY}; it has not been replaced.`);
  if (value?.activityId === ACTIVITY && value.schemaVersion === 2) throw new Error(`This is a previous sine-wave v2 record. Restore it at ${LEGACY_SINE}; it is kept separate from pulse measurements.`);
  if (!object(value) || value.activityId !== ACTIVITY || value.schemaVersion !== VERSION) throw new Error('Choose a Noise and Filtering aircraft pulse main-lab v3 backup. Pre-lab and 555 files belong in their own worksheets.');
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(value.recordId) || !validDate(value.createdAt) || !validDate(value.updatedAt) || !Number.isInteger(value.current) || value.current < 0 || value.current > 4) throw new Error('Invalid workbook identity, dates or page.');
  const fields = value.fields;
  if (!exactKeys(fields, Object.keys(fieldLabels)) || Object.entries(fields).some(([k, v]) => !validText(k, v))) throw new Error('Invalid or oversized answer / code fields.');
  if (!exactKeys(value.originals, EXPERIMENTS)) throw new Error('The saved copies in this file could not be read.');
  if (!Array.isArray(value.fileSlots) || value.fileSlots.some((slot) => !SLOT_IDS.includes(slot)) || new Set(value.fileSlots).size !== value.fileSlots.length) throw new Error('Invalid attachment inventory.');
  for (const e of EXPERIMENTS) {
    const p = value.originals[e];
    if (p === null) continue;
    if (!exactKeys(p, ['at', 'fields']) || !validDate(p.at) || !exactKeys(p.fields, PRESERVE_FIELDS[e]) || Object.entries(p.fields).some(([k, v]) => !validText(k, v) || !v.trim())) throw new Error('A saved copy in this file is incomplete or could not be read.');
  }
  if (byteLength(JSON.stringify(value)) > MAX_RECORD) throw new Error('Answer record is too large.');
  return structuredClone({ activityId: ACTIVITY, schemaVersion: VERSION, recordId: value.recordId, createdAt: value.createdAt, updatedAt: value.updatedAt, current: value.current, fileSlots: value.fileSlots, fields, originals: value.originals });
}
export function updateField(record, key, value) {
  if (!Object.hasOwn(fieldLabels, key) || !validText(key, value)) throw new Error(key.startsWith('code.') ? 'Code exceeds 128 KiB; keep a separate source backup.' : 'This answer cannot be saved.');
  record.fields[key] = value; record.updatedAt = new Date().toISOString();
}
export function preserve(record, experiment) {
  if (!EXPERIMENTS.includes(experiment) || record.originals[experiment]) throw new Error('This copy has already been saved or is not available.');
  const fields = Object.fromEntries(PRESERVE_FIELDS[experiment].map((key) => [key, record.fields[key]]));
  if (Object.values(fields).some((v) => !v.trim())) throw new Error('Complete the code or design and its explanation before saving this copy. You can still continue and download an unfinished workbook.');
  record.originals[experiment] = { at: new Date().toISOString(), fields }; record.updatedAt = new Date().toISOString();
}
export function identityIssues(record) {
  const f = record.fields, issues = [];
  if (!f['group.groupId'].trim()) issues.push('Enter Group ID.');
  if (!f['group.student1Name'].trim()) issues.push('Enter Student 1 name. Student 2 and Student 3 are optional.');
  const ids = [1, 2, 3].map((n) => f[`group.student${n}Id`].trim()).filter(Boolean);
  if (new Set(ids).size !== ids.length) issues.push('Supplied student IDs must differ.');
  return issues;
}
export function completeness(record, files = {}) {
  const issues = [...identityIssues(record)];
  const sectionNames = { setup: 'Equipment', debug: 'Code repair', scope: 'Oscilloscope and FFT', digital: 'Digital filters' };
  for (const prefix of ['setup', 'debug', 'scope', 'digital']) {
    const missing = Object.keys(fieldLabels).filter((k) => k.startsWith(`${prefix}.`) && !record.fields[k].trim());
    if (missing.length) issues.push(`${sectionNames[prefix]}: complete ${missing.map((k) => fieldLabels[k]).join('; ')} (or explain unavailable results).`);
  }
  const missingDesign = Object.keys(DESIGN_FIELDS).filter((k) => k !== 'corrections' && !record.fields[`design.${k}`].trim());
  if (missingDesign.length) issues.push(`RC design: complete ${missingDesign.map((k) => DESIGN_FIELDS[k]).join('; ')}.`);
  for (const e of EXPERIMENTS) if (!record.originals[e]) issues.push(`Save ${SAVED_COPY_LABELS[e][0].toLowerCase()}${SAVED_COPY_LABELS[e].slice(1)}.`);
  for (const [id, table] of Object.entries(TABLES)) {
    const missing = table.rows.filter(([r]) => table.columns.some((c) => c.id !== 'notes' && !record.fields[`${id}.${r}.${c.id}`].trim()));
    if (missing.length) issues.push(`${table.title}: complete ${missing.map(([, label]) => label).join(', ')} (or explain measurement limits).`);
  }
  for (const c of CAPTURES.filter((c) => c.kind !== 'optional')) {
    if (['both', 'csv'].includes(c.kind) && !files[`${c.id}.csv`]) issues.push(`${c.label}: attach the scope CSV file.`);
    if (['both', 'image'].includes(c.kind) && !files[`${c.id}.image`]) issues.push(`${c.label}: attach a screenshot.`);
    const missing = Object.keys(CAPTURE_FIELDS).filter((k) => !record.fields[`capture.${c.id}.${k}`].trim());
    if (missing.length) issues.push(`${c.label}: record ${missing.map((k) => CAPTURE_FIELDS[k]).join('; ')} (or explain limitations).`);
  }
  return issues;
}
export function filename(record) {
  const f = record.fields;
  return ['2145427_W12_AIRCRAFT_PULSES_V3', f['group.groupId'] || 'DRAFT', ...[1, 2, 3].map((n) => f[`group.student${n}Id`])].filter(Boolean).join('_').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 180);
}
export function codeEntries(record, legacyNames = false) {
  const entries = {};
  for (const e of ['generator', 'digital']) {
    if (record.fields[`code.${e}`]) entries[`code/${e}_current/${e}_current.ino`] = record.fields[`code.${e}`];
    const original = record.originals[e]?.fields[`code.${e}`];
    const suffix = legacyNames ? 'preserved' : 'saved';
    if (original) entries[`code/${e}_${suffix}/${e}_${suffix}.ino`] = original;
  }
  return entries;
}
