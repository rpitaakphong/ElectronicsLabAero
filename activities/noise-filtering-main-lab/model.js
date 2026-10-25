export const ACTIVITY = '2145427-w12-noise-filtering-main-lab';
export const VERSION = 4;
export const STORAGE_KEY = 'electronics-noise-filtering-main-lab-v4';
export const DATABASE = 'electronics-noise-filtering-main-lab-files-v4';
export const LEGACY = '/worksheets/noise-filtering-main-lab-v1.html';
export const LEGACY_SINE = '/worksheets/noise-filtering-main-lab-v2.html';
export const LEGACY_PULSE = '/worksheets/noise-filtering-main-lab-v3.html';
export const DOWNLOAD_BASE = '/courses/2145427/week12/main-lab/v4.0.0/';
export const SCREENS = ['Investigate the Signal', 'Frequency Spectrum Analysis', 'Noise Filter Design', 'Filter Construction and Validation', 'Filtered Signal Analysis', 'Digital Filter Design', 'Save Lab Files'];
export const ALLOWANCES = ['15 minutes', '25 minutes', '25 minutes', '30 minutes', '25 minutes', '45 minutes', '5 minutes'];
export const GROUP_FIELDS = {
  groupId: 'Group ID', student1Name: 'Student 1 name (required)', student1Id: 'Student 1 ID (optional)',
  student2Name: 'Student 2 name (optional)', student2Id: 'Student 2 ID (optional)',
  student3Name: 'Student 3 name (optional)', student3Id: 'Student 3 ID (optional)',
};
export const SETUP_FIELDS = {
  board: 'UNO R4 variant (Minima or WiFi)',
};
// Keep earlier v4 answers readable in backups without showing or requiring these fields.
const RETIRED_SETUP_FIELDS = {
  core: 'Arduino IDE / UNO R4 core version',
  reference: 'Measured supply / voltage reference (V)', scope: 'Oscilloscope model / bench',
  probes: 'Probe attenuation, coupling and input impedance', inventory: 'Available resistors, capacitors and tolerances',
};
export const SOURCE_FIELDS = {
  verification: 'How you checked the upload and A0 output on the oscilloscope',
  observations: 'Measured baseline, long / short pulse levels and widths, repetition period and clipping checks',
};
// Earlier FFT questionnaire answers remain in backups, outside the current task.
const RETIRED_SCOPE_FIELDS = {
  procedure: 'FFT and peak-reading procedure you discovered, including resources used',
  settings: 'FFT source, window, record length, actual sample rate, frequency span and scales',
  resolution: 'How recording duration and window affect separation of nearby frequency peaks',
  units: 'Amplitude units and convention (Linear RMS or dBV RMS)',
  observations: 'How you identified the added interference; pulse harmonics and other measurement limitations',
};
export const DESIGN_FIELDS = {
  type: 'Chosen filter type: low-pass or high-pass', reason: 'Why this filter suits the interference and useful pulses',
  cutoff: 'Chosen cutoff frequency (Hz) and justification', resistanceNominal: 'Nominal R (Ω)',
  capacitanceNominal: 'Nominal C (nF)',
  predictedUseful: 'Predicted effects on long / short pulse height, width, edges and delay',
};
// Retain the v4 saved-copy shape, but no longer require or display this answer.
const RETIRED_DESIGN_FIELDS = { calculations: 'Your R/C calculation, including unit conversions' };
const optionalSavedField = (key) => key === 'design.calculations' || key.startsWith('predictions.');
export const BUILD_FIELDS = {
  resistanceActual: 'Actual R (Ω)', capacitanceActual: 'Actual C (nF)',
  actualCutoff: 'Cutoff calculated from actual R and C (Hz)',
};
export const PULSE_COMPARISON_FIELDS = {
  observations: 'Your pulse comparison and measurements',
};
// Keep earlier construction notes in backups without displaying or requiring them.
const RETIRED_BUILD_FIELDS = {
  review: 'Instructor wiring check / different-topology approval',
  construction: 'Connections used and how you checked the circuit', corrections: 'Changes to your design and why (or no changes)',
};
export const ANALYSIS_FIELDS = {
  procedure: 'How you found and read the input/output FFT peaks',
  matched: 'How you matched FFT settings, amplitude units and circuit conditions',
  interpretation: 'Compare measured attenuation with predictions and changes to useful pulses',
  limitations: 'Unresolved peaks, noise floor, pulse harmonics, leakage or other limits',
};
// Retain the original Arduino answers and saved copies without reinterpreting them.
const LEGACY_DIGITAL_FIELDS = {
  maWindow: 'Chosen MA window length (samples)', emaAlpha: 'Chosen EMA coefficient', rate: 'ADC sampling rate and how you checked it (samples/s)',
  initialization: 'Filter initialization and settling used', integration: 'How you added sampling, MA, EMA and plotting; changes and AI help used',
  verification: 'How you checked that both filters use the same A1 samples and A0 keeps generating',
  timing: 'Checks for missed sampling intervals, clipping and serial output falling behind',
  observations: 'Compare RC, RC_MA and RC_EMA: pulse shape, interference and delay',
  limitations: 'What you could and could not measure from the live plot',
};
export const DIGITAL_FIELDS = {
  program: 'Program used (Excel, MATLAB, Python or another program)',
  maWindow: 'Chosen MA window length (samples)', emaAlpha: 'Chosen EMA coefficient',
  integration: 'How you imported the CSV and implemented MA, EMA and plotting; resources and AI help used',
  observations: 'Compare RC, MA and EMA: pulse shape, interference and delay',
  limitations: 'What was difficult to judge from your graphs, and why? For example, a small delay or the short-pulse height. If nothing was unclear, write “None.”',
};
// Keep retired processing answers in backups without requiring them.
const RETIRED_PROCESSING_FIELDS = {
  verification: 'How you checked that MA and EMA independently use the same original RC samples',
  timing: 'Checks for missing or uneven time steps, units and clipped samples',
  rate: 'CSV sample interval (s), sample rate (samples/s), duration (s) and how you checked them',
  initialization: 'MA history, EMA initialization and settling interval used',
};
const columns = (...pairs) => pairs.map(([id, label]) => ({ id, label }));
const noiseFrequencies = () => [1, 2, 3].map((n) => [String(n), `Noise frequency ${n}`]);
export const TABLES = {
  discovery: { title: 'Identify the noise frequencies', rowHeading: 'Noise frequency', page: 1, rows: noiseFrequencies(),
    columns: columns(['frequency', 'Measured frequency (Hz)'], ['amplitude', 'Input FFT amplitude'], ['units', 'Amplitude units'], ['reason', 'Why you identified this frequency as noise']) },
  spectrum: { title: 'Attenuation at the identified interference frequencies', rowHeading: 'Noise frequency', page: 4, rows: noiseFrequencies(),
    columns: columns(['frequency', 'Measured frequency (Hz)'], ['input', 'CH1 input FFT amplitude'], ['output', 'CH2 output FFT amplitude'], ['units', 'Matching amplitude units'],
      ['predicted', 'Predicted attenuation (dB)'], ['attenuation', 'Measured attenuation (dB)'], ['calculation', 'Your calculation']) },

};
// Retain these keys for existing v4 backups, outside the active tables and checklist.
const RETIRED_TABLES = {
  digital: { title: 'Compare digital-filter settings after the same RC', rowHeading: 'Filter setting', page: 5,
    rows: [['maShort', 'MA · 5 samples'], ['maLong', 'MA · 51 samples'], ['maChosen', 'MA · chosen setting'],
      ['emaFast', 'EMA · coefficient 0.40'], ['emaSlow', 'EMA · coefficient 0.02'], ['emaChosen', 'EMA · chosen setting']],
    columns: columns(['setting', 'Actual setting and sample rate'], ['amplitude', 'Long / short pulse changes'],
      ['interference', 'Remaining ripple / smoothing'], ['delay', 'Delay observed and method'], ['notes', 'Choice / figure / limits']) },
  pulses: { title: 'Compare the useful pulses', page: 3, rows: [['input', 'CH1 · before RC'], ['output', 'CH2 · after RC']],
    columns: columns(['longHeight', 'Long-pulse height above baseline (V)'], ['shortHeight', 'Short-pulse height above baseline (V)'],
      ['shortWidth', 'Short-pulse width (ms; state threshold)'], ['delay', 'Delay relative to CH1 (ms; state threshold)'], ['notes', 'Method / screenshot / limits']) },
  predictions: { title: 'Predict attenuation at your identified frequencies', page: 2, rows: noiseFrequencies(),
    columns: columns(['frequency', 'Frequency from your FFT (Hz)'], ['ratio', 'Predicted output / input amplitude ratio'], ['attenuation', 'Predicted attenuation (dB)'], ['calculation', 'Calculation / assumptions']) },
};
const capture = (id, label, page, kind = 'image') => ({ id, label, page, kind });
export const CAPTURES = [
  capture('source', 'Initial A0 waveform', 0), capture('spectrum', 'Initial input FFT', 1),
  capture('comparison', 'CH1 input and CH2 RC output on the same screen', 3),
  capture('breadboard', 'Breadboard photo (optional)', 3, 'optional'),
  capture('fftComparison', 'CH1 input and CH2 RC output FFT in one image', 4),
  capture('maTrials', 'MA figure: windows 5, 51 and your chosen setting', 5),
  capture('emaTrials', 'EMA figure: coefficients 0.4, 0.02 and your chosen setting', 5),
  ...[1, 2, 3, 4].map((n) => capture(`extra${n}`, `Extra image ${n}`, 6, 'optional')),
];
// Keep earlier two-image backups readable without requiring two uploads now.
export const FILTER_FIGURE_IDS = ['maTrials', 'emaTrials'];
export const IMAGE_ONLY_CAPTURE_IDS = ['spectrum', ...FILTER_FIGURE_IDS];
export const LEGACY_CAPTURES = [capture('digital', 'Earlier RC / MA / EMA figure', 5, 'optional'), capture('inputFFT', 'Earlier CH1 input FFT', 4, 'optional'), capture('outputFFT', 'Earlier CH2 output FFT', 4, 'optional')];
export const ALL_CAPTURES = [...CAPTURES, ...LEGACY_CAPTURES];
export const CAPTURE_FIELDS = {
  runId: 'Image label / filename', source: 'Measured node, channel and circuit conditions',
  settings: 'Visible scales, sampling / window settings, units and filter settings', notes: 'What the image shows and any measurement limits',
};
export const CODE_FIELDS = { generator: 'Source sketch uploaded (.ino)', digital: 'Earlier Arduino digital-filter sketch (.ino)', processing: 'MA and EMA spreadsheet formulas or code' };
export const EXPERIMENTS = ['generator', 'design', 'digital'];
// Earlier design/digital copies remain readable; only the initial source copy is required now.
export const ACTIVE_SAVED_COPIES = ['generator'];
export const SAVED_COPY_LABELS = { generator: 'Initial source code', design: 'Initial RC design', digital: 'Final filter code' };
export const PRESERVE_FIELDS = {
  generator: ['code.generator', 'source.verification'],
  design: [...Object.keys({ ...DESIGN_FIELDS, ...RETIRED_DESIGN_FIELDS }).map((k) => `design.${k}`), ...RETIRED_TABLES.predictions.rows.flatMap(([r]) => RETIRED_TABLES.predictions.columns.map((c) => `predictions.${r}.${c.id}`))],
  digital: ['code.digital', 'digital.maWindow', 'digital.emaAlpha', 'digital.rate', 'digital.initialization', 'digital.integration', 'digital.verification'],
};
export const FIELD_SECTIONS = { setup: SETUP_FIELDS, source: SOURCE_FIELDS, design: DESIGN_FIELDS, build: { ...BUILD_FIELDS, ...PULSE_COMPARISON_FIELDS }, analysis: ANALYSIS_FIELDS, processing: DIGITAL_FIELDS };
export const fieldLabels = {
  ...Object.fromEntries(Object.entries(GROUP_FIELDS).map(([k, v]) => [`group.${k}`, v])),
  ...Object.fromEntries(Object.entries(FIELD_SECTIONS).flatMap(([prefix, labels]) => Object.entries(labels).map(([k, v]) => [`${prefix}.${k}`, v]))),
  ...Object.fromEntries(Object.entries(RETIRED_PROCESSING_FIELDS).map(([k, v]) => [`processing.${k}`, v])),
  ...Object.fromEntries(Object.entries(RETIRED_SCOPE_FIELDS).map(([k, v]) => [`scope.${k}`, v])),
  ...Object.fromEntries(Object.entries(RETIRED_SETUP_FIELDS).map(([k, v]) => [`setup.${k}`, v])),
  ...Object.fromEntries(Object.entries(RETIRED_DESIGN_FIELDS).map(([k, v]) => [`design.${k}`, v])),
  ...Object.fromEntries(Object.entries(RETIRED_BUILD_FIELDS).map(([k, v]) => [`build.${k}`, v])),
  ...Object.fromEntries(Object.entries(LEGACY_DIGITAL_FIELDS).map(([k, v]) => [`digital.${k}`, v])),
  ...Object.fromEntries(Object.entries(CODE_FIELDS).map(([k, v]) => [`code.${k}`, v])),
  // Keep removed attenuation notes in existing records and backups.
  ...Object.fromEntries(noiseFrequencies().map(([id, label]) => [`spectrum.${id}.notes`, `${label}: Screenshots / limits`])),
  ...Object.fromEntries(Object.entries({ ...TABLES, ...RETIRED_TABLES }).flatMap(([id, t]) => t.rows.flatMap(([r, name]) => t.columns.map((c) => [`${id}.${r}.${c.id}`, `${name}: ${c.label}`])))),
  ...Object.fromEntries(ALL_CAPTURES.flatMap((c) => Object.entries(CAPTURE_FIELDS).map(([k, label]) => [`capture.${c.id}.${k}`, `${c.label}: ${label}`]))),
};
// Only these additions may be absent in an earlier v4 record. All older keys
// remain mandatory so a damaged backup is not mistaken for an older workbook.
const newFieldDefaults = Object.fromEntries(Object.keys(fieldLabels).filter((key) => key.startsWith('processing.') || key === 'code.processing' || key.startsWith('capture.fftComparison.') || FILTER_FIGURE_IDS.some(id => key.startsWith(`capture.${id}.`))).map((key) => [key, '']));
export const SLOT_IDS = ALL_CAPTURES.map((c) => `${c.id}.image`);
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
  if (value?.activityId === ACTIVITY && value.schemaVersion === 3) throw new Error(`This is a five-section pulse v3 record. Restore it at ${LEGACY_PULSE}; it has not been replaced.`);
  if (!object(value) || value.activityId !== ACTIVITY || value.schemaVersion !== VERSION) throw new Error('Choose a Noise and Filtering aircraft pulse main-lab v4 backup. Pre-lab and 555 files belong in their own worksheets.');
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(value.recordId) || !validDate(value.createdAt) || !validDate(value.updatedAt) || !Number.isInteger(value.current) || value.current < 0 || value.current >= SCREENS.length) throw new Error('Invalid workbook identity, dates or page.');
  const fields = object(value.fields) ? { ...newFieldDefaults, ...value.fields } : value.fields;
  if (!exactKeys(fields, Object.keys(fieldLabels)) || Object.entries(fields).some(([k, v]) => !validText(k, v))) throw new Error('Invalid or oversized answer / code fields.');
  if (!exactKeys(value.originals, EXPERIMENTS)) throw new Error('The saved copies in this file could not be read.');
  if (!Array.isArray(value.fileSlots) || value.fileSlots.some((slot) => !SLOT_IDS.includes(slot)) || new Set(value.fileSlots).size !== value.fileSlots.length) throw new Error('Invalid attachment inventory.');
  for (const e of EXPERIMENTS) {
    const p = value.originals[e];
    if (p === null) continue;
    if (!exactKeys(p, ['at', 'fields']) || !validDate(p.at) || !exactKeys(p.fields, PRESERVE_FIELDS[e]) || Object.entries(p.fields).some(([k, v]) => !validText(k, v) || (!optionalSavedField(k) && !v.trim()))) throw new Error('A saved copy in this file is incomplete or could not be read.');
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
  if (Object.entries(fields).some(([k, v]) => !optionalSavedField(k) && !v.trim())) throw new Error('Complete the code or design and its explanation before saving this copy. You can still continue and download an unfinished workbook.');
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
  for (const [prefix, labels] of Object.entries(FIELD_SECTIONS)) {
    const missing = Object.keys(labels).filter((k) => !record.fields[`${prefix}.${k}`].trim());
    if (missing.length) issues.push(`Complete ${missing.map((k) => labels[k]).join('; ')} (or explain unavailable results).`);
  }
  for (const e of ACTIVE_SAVED_COPIES) if (!record.originals[e]) issues.push(`Save ${SAVED_COPY_LABELS[e][0].toLowerCase()}${SAVED_COPY_LABELS[e].slice(1)}.`);
  if (!record.fields['code.processing'].trim()) issues.push('Record your MA and EMA spreadsheet formulas or code.');
  for (const [id, table] of Object.entries(TABLES)) {
    const missing = table.rows.filter(([r]) => table.columns.some((c) => c.id !== 'notes' && !record.fields[`${id}.${r}.${c.id}`].trim()));
    if (missing.length) issues.push(`${table.title}: complete ${missing.map(([, label]) => label).join(', ')} (or explain measurement limits).`);
  }
  for (const c of CAPTURES.filter((c) => c.kind !== 'optional')) {
    if (c.kind === 'image' && !files[`${c.id}.image`]) issues.push(`${c.label}: attach ${FILTER_FIGURE_IDS.includes(c.id) ? 'your comparison figure' : 'a screenshot'}.`);
    if (IMAGE_ONLY_CAPTURE_IDS.includes(c.id)) continue;
    const missing = Object.keys(CAPTURE_FIELDS).filter((k) => !record.fields[`capture.${c.id}.${k}`].trim());
    if (missing.length) issues.push(`${c.label}: record ${missing.map((k) => CAPTURE_FIELDS[k]).join('; ')} (or explain limitations).`);
  }
  return issues;
}
export function filename(record) {
  const f = record.fields;
  return ['2145427_W12_AIRCRAFT_PULSES_V4', f['group.groupId'] || 'DRAFT', ...[1, 2, 3].map((n) => f[`group.student${n}Id`])].filter(Boolean).join('_').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 180);
}
export function codeEntries(record, legacyNames = false) {
  const entries = {};
  for (const e of ['generator', 'digital']) {
    if (record.fields[`code.${e}`]) entries[`code/${e}_current/${e}_current.ino`] = record.fields[`code.${e}`];
    const original = record.originals[e]?.fields[`code.${e}`];
    const suffix = legacyNames ? 'preserved' : 'saved';
    if (original) entries[`code/${e}_${suffix}/${e}_${suffix}.ino`] = original;
  }
  if (record.fields['code.processing']) entries['code/MA_EMA_formulas_or_code.txt'] = record.fields['code.processing'];
  return entries;
}
