export const VERSION = 1;
export const DISTANCES = [10, 15, 20, 30, 40, 50];
export const MAIN_PAGES = [
  'Connect the sensor and check the readings',
  'Estimate how closely you can position and measure the target',
  'Measure the six distances in three separate runs',
  'Plot echo time against distance and fit a straight line',
  'Use your calibration to check two new distances',
  'Test whether the sensor can detect a small movement',
  'Save your group’s measurements for the post-lab',
];
export const POST_PAGES = [
  'Open your group’s measurements and enter your details',
  'Calculate the average and spread of the readings',
  'Fit the calibration line and calculate its sensitivity',
  'Calculate and explain the offset, linearity and repeatability results',
  'Compare calculated distances with ruler measurements',
  'Estimate how each measurement limitation affects your result',
  'Calculate the uncertainty in the distance you report',
  'Decide whether the readings show a real movement',
  'Write your conclusion and save your report',
];
export const MAIN_FIELDS = {
  groupId: 'Enter your group ID.', labDate: 'Enter the date of the lab.',
  ...Object.fromEntries([1, 2, 3].flatMap(n => [[`member${n}Name`, `Enter student ${n}’s name.`], [`member${n}Id`, `Enter student ${n}’s ID.`]])),
  board: 'Name the Arduino board you used.', sensor: 'Name the sensor model and note any identifying marks.', ruler: 'Describe the ruler or measuring tape you used.',
  graduation: 'Enter the spacing between the smallest ruler marks (mm).', accuracy: 'Write the manufacturer’s stated ruler accuracy, or write “not available”.',
  origin: 'Describe the point on the sensor from which you measured each distance.', alignment: 'Explain how you held the target and kept it perpendicular to the sensor.',
  environment: 'Describe any changes in the room or setup. Include temperature only if you measured it.',
  timing: 'State the timing function, Arduino board-core version and published timing limits you found.', code: 'Paste the Arduino code you actually uploaded.',
  setupNotes: 'Describe the readings you saw and how you handled missing echoes.',
  provisionalEquation: 'Write your fitted equation and include the units.', provisionalWorking: 'Show the formulas or code you used to fit the line, and state your assumptions.', provisionalSensitivity: 'Enter the slope of your fitted line (µs/cm).',
  movement: 'Describe how far you intended to move the target and how you set its position.', movementNotes: 'Describe what changed when you moved the target and when you returned it.',
  smoothing: 'Describe the optional filter comparison, including settings and observations, or write “not performed”.',
};
export const POST_FIELDS = {
  name: 'Enter your name.', studentId: 'Enter your student ID.',
  repeats: 'Compare the spread within each set of readings and the differences among the three runs.',
  repeatWorking: 'Show your mean and standard-deviation calculations. Explain which readings you treated as independent.',
  intercept: 'Enter the fitted intercept a₀ (µs).', slope: 'Enter the fitted sensitivity a₁ (µs/cm).', uIntercept: 'Enter the standard uncertainty u(a₀) (µs).',
  uSlope: 'Enter the standard uncertainty u(a₁) (µs/cm).', covariance: 'Enter the covariance cov(a₀,a₁) (µs²/cm).', inverse: 'Enter the inverse conversion factor 1/a₁ (cm/µs).',
  fitWorking: 'Show the formulas or code you used to fit the line and estimate its parameter uncertainties.',
  fitAssumptions: 'Explain your fitting assumptions, any differences among runs, the residual pattern and the tested distance range.',
  nominalSensitivity: 'Calculate S₀ using the assumed sound speed of 340 m/s (µs/cm).', sensitivityDeviation: 'Calculate the signed slope difference as a percentage of S₀ (%).',
  sensitivityDiscussion: 'Explain what your slope means and why it might differ from the value calculated using 340 m/s.',
  outputSpan: 'Calculate the fitted output span rₒ (µs).', offsetPercent: 'Calculate 100|a₀|/rₒ (%FSO).', maxResidual: 'Find the largest absolute residual of the mean echo times (µs).',
  linearityPercent: 'Express the largest absolute residual as a percentage of rₒ (%FSO).', repeatability: 'State your repeatability measure, its units and how you calculated it.',
  repeatabilityPercent: 'Express your repeatability measure as a percentage of rₒ (%FSO).',
  errorWorking: 'Show your offset, linearity and repeatability calculations. State the conventions you used.',
  errorDiscussion: 'Explain the offset, sensitivity, linearity and repeatability results, including effects you could not separate.',
  validationDiscussion: 'Explain the direction and size of the errors at the two new distances. State where you have tested the calibration.',
  validationWorking: 'Show how you converted the new echo times to distance and calculated signed error.',
  budgetDiscussion: 'Explain your distributions and shared effects. State which quantities you could not estimate and how you avoided counting the same effect twice.',
  propagationPoint: 'Choose one of the two new distances. State whether you will report one reading or an average.',
  propagationTime: 'Enter the echo time used in this calculation (µs).', uTime: 'Enter the standard uncertainty of this echo time (µs).',
  conditionalU: 'Calculate the standard distance uncertainty from the regression formula (cm).',
  referencePropagation: 'Explain how you included ruler uncertainty, the distance starting point and any other corrections.',
  combinedU: 'Enter the combined standard distance uncertainty u꜀ (cm).',
  propagationWorking: 'Show your uncertainty calculation, including covariance, units and assumptions.',
  expandedU: 'If used, enter the expanded uncertainty U (cm).', coverage: 'If used, state the coverage factor k and explain how you chose it.',
  judgement: 'Do the readings show that the target moved? Compare the averages, their uncertainty and the placement limits.',
  judgementWorking: 'Show your calculations for the initial, moved and returned target positions.',
  smoothingDiscussion: 'Explain the optional filter’s effect on variation and response time, or write “not performed”.',
  conclusion: 'Report a distance with uncertainty and units. State the tested range, the largest limitation and one improvement you could test.',
  help: 'State which software, AI tools or other help you used.',
  ...Object.fromEntries([1, 2, 3].flatMap(run => DISTANCES.flatMap(d => [[`summary.r${run}d${d}.mean`, `Enter the mean for Run ${run} at ${d} cm (µs).`], [`summary.r${run}d${d}.sd`, `Enter the sample standard deviation for Run ${run} at ${d} cm (µs).`]]))),
  ...Object.fromEntries([25, 45].flatMap(d => [['mean', 'Enter the mean echo time (µs).'], ['sd', 'Enter the sample standard deviation (µs).'], ['distance', 'Calculate the distance using your fitted line (cm).'], ['error', 'Calculate the signed error (cm).'], ['direction', 'Explain whether the calculated distance is too high or too low.']].map(([key, label]) => [`validation.${d}.${key}`, `At ${d} cm: ${label}`]))),
};
export const SOURCES = [
  ['graduation', 'How far apart are the smallest ruler marks?'], ['accuracy', 'What accuracy does the ruler manufacturer state?'],
  ['origin', 'How well can you locate the starting point for every distance?'], ['placement', 'How closely can you place the target at a ruler mark?'],
  ['timing', 'What limits the accuracy of the echo-time measurement?'], ['alignment', 'How well can you keep the target correctly aligned?'],
  ['environment', 'What changed in the room or setup while you took readings?'], ['other', 'What other measurement limits did you notice?'],
];
export const BUDGET_SOURCES = [
  ['repeat', 'How much do repeated echo readings vary?'], ['runs', 'How much do the three runs differ?'],
  ['reference', 'How do the ruler and distance starting point affect the result?'], ['timing', 'How do timing limitations affect the result?'],
  ['fit', 'How uncertain are the fitted line and its parameters?'], ['other', 'What other limitations affect the result?'],
];
export const REFERENCE_KEYS = ['status', 'value', 'units', 'distribution', 'scope', 'source', 'justification'];
export const BUDGET_KEYS = ['status', 'estimate', 'units', 'distribution', 'standard', 'coefficient', 'contribution', 'scope', 'accounted', 'justification'];
export const ATTACHMENTS = {
  main: { setup: 'Add a photograph showing the sensor, target, ruler and distance starting point.', calibration: 'Add the calibration graph you made in class.', movement: 'Add a graph or image from the small-movement test (optional).', smoothing: 'Add your raw and smoothed distance graph (optional).' },
  post: { calibration: 'Add your calibration graph.', residuals: 'Add your residual plot.', working: 'Add an image of additional calculations or an uncertainty graph (optional).', movement: 'Add your graph of the small-movement readings (optional).', smoothing: 'Add your raw and smoothed distance graph (optional).' },
};
export const pages = kind => kind === 'main' ? MAIN_PAGES : POST_PAGES;
export const labels = kind => kind === 'main' ? MAIN_FIELDS : POST_FIELDS;
export const namespace = kind => `electronics-sensor-calibration-${kind}-v1`;
export const activity = kind => `2145427-sensor-calibration-${kind}`;
const blankFields = keys => Object.fromEntries(keys.map(k => [k, '']));
function measurement(id, label, nominal) {
  return { id, label, nominal, reference: '', placement: '', mean: '', sd: '', notes: '', readings: Array.from({ length: 6 }, (_, i) => ({ id: i + 1, value: '', status: 'included', reason: '' })) };
}
export function createRecord(kind) {
  if (!['main', 'post'].includes(kind)) throw new Error('Unknown worksheet.');
  const now = new Date().toISOString();
  const fields = blankFields(Object.keys(labels(kind)));
  if (kind === 'main') fields.board = 'Arduino UNO R4 WiFi';
  return { activityId: activity(kind), schemaVersion: VERSION, recordId: crypto.randomUUID(), createdAt: now, updatedAt: now, current: 0, fields,
    measurements: kind === 'main' ? [
      ...[1, 2, 3].flatMap(run => DISTANCES.map(d => measurement(`r${run}d${d}`, `Run ${run} · ${d} cm`, d))),
      ...[25, 45].map(d => measurement(`v${d}`, `Validation · ${d} cm`, d)),
      ...[['before', 30], ['moved', 30.5], ['return', 30]].map(([name, d]) => measurement(`small-${name}`, `Small movement · ${name}`, d)),
    ] : [],
    uncertainty: Object.fromEntries((kind === 'main' ? SOURCES : BUDGET_SOURCES).map(([id]) => [id, blankFields(kind === 'main' ? REFERENCE_KEYS : BUDGET_KEYS)])),
    needsReview: false };
}
const exact = (a, b) => a && typeof a === 'object' && !Array.isArray(a) && Object.keys(a).sort().join('|') === Object.keys(b).sort().join('|');
const textValues = obj => Object.values(obj).every(v => typeof v === 'string' && v.length <= 16000);
export function validateRecord(value, kind) {
  const blank = createRecord(kind);
  if (!exact(value, blank) || value.activityId !== activity(kind) || value.schemaVersion !== VERSION ||
    typeof value.recordId !== 'string' || !value.recordId || value.recordId.length > 100 ||
    ![value.createdAt, value.updatedAt].every(t => typeof t === 'string' && Number.isFinite(Date.parse(t))) ||
    !Number.isInteger(value.current) || value.current < 0 || value.current >= pages(kind).length ||
    !exact(value.fields, blank.fields) || !textValues(value.fields) || typeof value.needsReview !== 'boolean' ||
    !Array.isArray(value.measurements) || value.measurements.length !== blank.measurements.length ||
    !exact(value.uncertainty, blank.uncertainty)) throw new Error('This is not a supported Sensor Calibration worksheet record.');
  for (let i = 0; i < blank.measurements.length; i++) {
    const row = value.measurements[i], expected = blank.measurements[i];
    if (!exact(row, expected) || row.id !== expected.id || row.label !== expected.label || row.nominal !== expected.nominal ||
      !textValues(Object.fromEntries(['reference', 'placement', 'mean', 'sd', 'notes'].map(k => [k, row[k]]))) ||
      !Array.isArray(row.readings) || row.readings.length < 6 || row.readings.length > 100) throw new Error('Invalid measurement table.');
    row.readings.forEach((reading, j) => {
      if (!exact(reading, expected.readings[0]) || reading.id !== j + 1 || typeof reading.value !== 'string' || reading.value.length > 16000 ||
        typeof reading.reason !== 'string' || reading.reason.length > 16000 || !['included', 'timeout', 'excluded'].includes(reading.status)) throw new Error('Invalid measurement attempt.');
    });
  }
  for (const id of Object.keys(blank.uncertainty)) if (!exact(value.uncertainty[id], blank.uncertainty[id]) || !textValues(value.uncertainty[id])) throw new Error('Invalid uncertainty record.');
  if (new TextEncoder().encode(JSON.stringify(value)).length > 8 * 1024 * 1024) throw new Error('Worksheet text exceeds 8 MiB.');
  return structuredClone(value);
}
export function numericIssue(value, positive = false) {
  if (!value.trim()) return '';
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim()) && Number.isFinite(Number(value)) && (!positive || Number(value) > 0)
    ? '' : positive ? 'Enter a positive finite number. Your original text is kept in the draft.' : 'Enter a finite number without units. Your original text is kept in the draft.';
}
export function readingIssue(reading) {
  if (reading.status === 'timeout') return reading.reason.trim() ? '' : 'Describe what happened when no echo was returned. Leave this attempt out of the calculations.';
  if (reading.status === 'excluded') return reading.reason.trim() ? '' : 'Explain why you excluded this attempt, and keep the original value.';
  return numericIssue(reading.value, true);
}
export function addAttempt(record, rowId) {
  const row = record.measurements.find(r => r.id === rowId);
  if (!row || row.readings.length >= 100) throw new Error('A set can contain at most 100 recorded attempts.');
  row.readings.push({ id: row.readings.length + 1, value: '', status: 'included', reason: '' });
}
// Parse quoted CSV or TSV without evaluating formulas or coercing student text.
export function parseRectangle(text) {
  const delimiter = text.includes('\t') ? '\t' : ',';
  const rows = [[]]; let cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted || !cell) quoted = !quoted;
      else cell += c;
    } else if (!quoted && c === delimiter) { rows.at(-1).push(cell); cell = ''; }
    else if (!quoted && (c === '\n' || c === '\r')) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      rows.at(-1).push(cell); rows.push([]); cell = '';
    } else cell += c;
  }
  if (quoted) throw new Error('The pasted rectangle has an unclosed quote.');
  rows.at(-1).push(cell);
  if (/[\r\n]$/.test(text) && rows.at(-1).length === 1 && rows.at(-1)[0] === '') rows.pop();
  if (!rows.length || rows.some(r => r.length !== rows[0].length || r.some(v => v.length > 16000))) throw new Error('Paste a rectangular selection of echo-time cells.');
  return rows;
}
export function pasteReadings(record, rowId, start, text) {
  const grid = parseRectangle(text), index = record.measurements.findIndex(r => r.id === rowId);
  if (index < 0 || !Number.isInteger(start) || start < 0 || start > 5) throw new Error('Select one of the six planned echo-time cells.');
  const group = rowId.startsWith('r') ? rowId.slice(0, 2) : rowId.startsWith('v') ? 'v' : 'small';
  const rows = record.measurements.slice(index, index + grid.length);
  if (rows.length !== grid.length || start + grid[0].length > 6 || rows.some(r => (r.id.startsWith('r') ? r.id.slice(0, 2) : r.id.startsWith('v') ? 'v' : 'small') !== group)) throw new Error('The rectangle extends beyond this table or its six planned readings. No cells were changed.');
  grid.forEach((values, i) => values.forEach((v, j) => { rows[i].readings[start + j].value = v; }));
}
function csvCell(value) {
  let s = String(value);
  // Spreadsheet software must not execute text pasted into a measurement field.
  if (/^[\s]*[=+\-@]/.test(s) && numericIssue(s) !== '') s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
}
const csvLine = values => values.map(csvCell).join(',');
export function rawCSV(record) {
  return '\uFEFF' + [csvLine(['set', 'nominal_cm', 'reference_cm', 'placement_limits', 'attempt', 'echo_us_raw', 'status', 'exclusion_or_failure_reason', 'student_mean_us', 'student_sample_sd_us', 'notes']),
    ...record.measurements.flatMap(row => row.readings.map(r => csvLine([row.label, row.nominal, row.reference, row.placement, r.id, r.value, r.status, r.reason, row.mean, row.sd, row.notes])))].join('\r\n');
}
export function uncertaintyCSV(record, kind = 'main') {
  const keys = kind === 'main' ? REFERENCE_KEYS : BUDGET_KEYS;
  return '\uFEFF' + [csvLine(['source', ...keys]), ...Object.entries(record.uncertainty).map(([id, values]) => csvLine([id, ...keys.map(k => values[k])]))].join('\r\n');
}
export function draftIssues(record, kind, hasSource = false) {
  const issues = [];
  if (kind === 'main') {
    if (!record.fields.groupId.trim()) issues.push('Add your group ID.');
    if (!record.fields.member1Name.trim()) issues.push('Add at least one group member.');
    for (const n of [1, 2, 3]) if (!!record.fields[`member${n}Name`].trim() !== !!record.fields[`member${n}Id`].trim()) issues.push(`Complete both name and ID for student ${n}.`);
    for (const row of record.measurements) {
      if (!row.reference.trim() || numericIssue(row.reference, true)) issues.push(`${row.label}: enter a valid distance read on the ruler.`);
      const valid = row.readings.filter(r => r.status === 'included' && r.value.trim() && !numericIssue(r.value, true));
      if (valid.length < 6) issues.push(`${row.label}: you have ${valid.length} valid readings. Add further attempts to reach six where possible.`);
      if (row.readings.some(r => readingIssue(r))) issues.push(`${row.label}: check the messages beside the attempts.`);
    }
    if (!record.fields.origin.trim()) issues.push('Describe the point on the sensor from which you measured distance.');
    if (!record.fields.graduation.trim()) issues.push('Enter the spacing between the smallest ruler marks.');
    if (!record.fields.code.trim()) issues.push('Paste the Arduino code you actually uploaded.');
  } else {
    if (!hasSource) issues.push('Load your group Sensor Calibration backup.');
    if (!record.fields.name.trim() || !record.fields.studentId.trim()) issues.push('Add your name and student ID.');
    for (const key of ['repeats', 'fitWorking', 'slope', 'uSlope', 'covariance', 'errorDiscussion', 'validationDiscussion', 'budgetDiscussion', 'combinedU', 'propagationWorking', 'judgement', 'conclusion', 'help']) if (!record.fields[key].trim()) issues.push(`Answer this question: ${POST_FIELDS[key]}`);
    if (record.needsReview) issues.push('Check your calculations and answers against the replacement group file.');
  }
  return issues;
}
