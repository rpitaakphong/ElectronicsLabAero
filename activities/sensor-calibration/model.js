export const VERSION = 2;
export const MAIN_PAGES = [
  'Build and document your system.',
  'Plan your calibration.',
  'Collect three calibration runs.',
  'Plot and fit the calibration.',
  'Test your calibration.',
  'Test the target angle.',
  'Save your group’s work.',
];
export const POST_PAGES = [
  'Open your group’s files.',
  'Calculate means and standard deviations.',
  'Fit the line and calculate sensitivity.',
  'Calculate offset, linearity and repeatability.',
  'Check the distance errors.',
  'Prepare your uncertainty budget.',
  'Calculate combined uncertainty.',
  'Explain the angle test.',
  'Write and save your conclusion.',
];
export const MAIN_SUBTITLES = [
  'Circuit, program and group details',
  'Choose the variables and procedure',
  'Measure echo times with your group',
  'Upload data and fit the line',
  'Test two new positions against the ruler',
  'Compare three target orientations',
  'Keep a copy for each member',
];
export const POST_SUBTITLES = [
  'Open the original group measurements',
  'Compare variation within and between runs',
  'Find the slope and intercept',
  'Interpret the calibration errors',
  'Apply the original fitted equation',
  'List and justify significant sources',
  'Propagate inputs to a reported distance',
  'Compare the target orientations',
  'Report your result and save a backup',
];
export const POST_LEADINS = [
  'Review your group’s saved measurements before completing your own analysis.',
  'Separate variation within repeated readings from differences among the three runs.',
  'Use the calibration measurements to find the fitted line, sensitivity and coefficient uncertainties.',
  'Describe the offset, departures from the fitted line and spread of repeated readings.',
  'Check how well the original calibration predicts the two new distances.',
  'Identify and justify the uncertainty contributions before combining them.',
  'Use your uncertainty budget to report the uncertainty of one calibrated distance.',
  'Explain how tilting and returning the target affected the measurements.',
  'State what your measurements support and save your individual work.',
];
export const subtitles = (kind) =>
  kind === 'main' ? MAIN_SUBTITLES : POST_SUBTITLES;
export const MAIN_FIELDS = {
  groupId: 'Enter your group ID.',
  labDate: 'Enter the date of the lab.',
  ...Object.fromEntries(
    [1, 2, 3].flatMap((n) => [
      [`member${n}Name`, `Enter student ${n}’s name.`],
      [`member${n}Id`, `Enter student ${n}’s ID.`],
    ]),
  ),
  board: 'Name the Arduino board you used.',
  sensor: 'Name the sensor model and note its identifying marks.',
  ruler: 'Describe the ruler or measuring tape you used.',
  code: 'Paste the Arduino code you used.',
  setupNotes:
    'Explain how your circuit and program measure echo duration and handle a missing echo.',
  timing:
    'State your timing method, measurement interval, timeout, board-core version and any documented timing limits.',
  help: 'State which software, AI tools, documentation or other help you used to develop the system.',
  xVariable: 'What quantity will you use for x, and in what unit?',
  yVariable: 'What quantity will you use for y, and in what unit?',
  design: 'Write your calibration procedure.',
  origin:
    'Define the point on the sensor from which you measure distance and the point on the target you measure to.',
  graduation:
    'Enter the spacing between the smallest ruler marks and its units.',
  accuracy:
    'Record the stated ruler accuracy and its source, or write “not available”.',
  placement:
    'Estimate how closely you can position and read the target. State the bound, units and how you obtained it.',
  alignment:
    'Explain how you hold the target steady and perpendicular to the measurement direction.',
  environment:
    'Describe relevant changes in the room or setup. Include temperature only if you measured it.',
  runNotes:
    'Describe what happened in Runs 1, 2 and 3, including repositioning, failed echoes and changes to the procedure.',
  provisionalEquation: 'Write your fitted equation and include the units.',
  intercept: 'Enter the fitted intercept a₀ (µs).',
  slope: 'Enter the fitted sensitivity a₁ (µs/cm).',
  inverse: 'Enter the inverse conversion factor 1/a₁ (cm/µs).',
  uIntercept: 'Enter the initial standard uncertainty u(a₀) (µs).',
  uSlope: 'Enter the initial standard uncertainty u(a₁) (µs/cm).',
  covariance: 'Enter the slope–intercept covariance cov(a₀,a₁) (µs²/cm).',
  provisionalWorking:
    'Show your analysis code for the means, sample standard deviations and fitted line (if any).',
  validationPlan:
    'Describe your two test positions and how you measured and controlled the target position.',
  validationWorking:
    'Show the mean echo times, sample standard deviations, calculated distances and signed errors for both positions.',
  validationDiscussion:
    'Explain whether the system reads high or low at each position. Discuss the size of the errors alongside the scatter in your readings and your positioning limits.',
  anglePlan:
    'Define the target reference point. Describe how you controlled position while tilting, and state the measured angle or explain how you estimated it.',
  angleWorking:
    'Show the mean echo time, sample standard deviation, calculated distance and failed-echo count for each orientation.',
  angleDiscussion:
    'Explain what changed when you tilted the target and whether the earlier readings returned when you restored its orientation.',
  unfinished:
    'Describe any work you could not finish and any limitations your group needs to carry into the post-lab.',
};
export const POST_FIELDS = {
  name: 'Enter your name.',
  studentId: 'Enter your student ID.',
  repeatWorking:
    'Show the mean and sample standard deviation for every run-and-position set, including the number of readings used and your formulas or code.',
  repeats:
    'Compare variation within each set with differences among the three runs. Explain which readings you treated as independent.',
  intercept: 'Enter the fitted intercept a₀ (µs).',
  slope: 'Enter the fitted sensitivity a₁ (µs/cm).',
  uIntercept: 'Enter the standard uncertainty u(a₀) (µs).',
  uSlope: 'Enter the standard uncertainty u(a₁) (µs/cm).',
  covariance: 'Enter cov(a₀,a₁) (µs²/cm).',
  inverse: 'Enter 1/a₁ (cm/µs).',
  fitWorking:
    'Show your fitting formulas or code, including coefficient uncertainties and covariance.',
  fitAssumptions:
    'Explain your fitting assumptions, residual pattern, differences among runs and tested distance range.',
  nominalSensitivity:
    'Calculate nominal sensitivity S₀ for the assumed sound speed of 340 m/s (µs/cm).',
  sensitivityDeviation:
    'Calculate the signed sensitivity difference as a percentage of S₀ (%).',
  sensitivityDiscussion:
    'Explain the measured slope and why it may differ from the nominal value.',
  outputSpan: 'Calculate the fitted output span rₒ (µs).',
  offsetPercent: 'Calculate 100|a₀|/rₒ (%FSO).',
  maxResidual: 'Find the largest absolute mean-response residual (µs).',
  linearityPercent: 'Calculate 100 max|eᵢ|/rₒ (%FSO).',
  repeatability: 'State your repeatability measure, units and method.',
  repeatabilityPercent:
    'Express your chosen repeatability measure as a percentage of rₒ (%FSO).',
  errorWorking:
    'Show your offset, linearity and repeatability calculations and state your conventions.',
  errorDiscussion:
    'Explain these measures, the limits of interpreting the extrapolated intercept, and effects you could not separate.',
  validationWorking:
    'Show the means, sample standard deviations, calibrated distances and signed errors at both new positions.',
  validationDiscussion:
    'Explain the direction and size of the errors and their relation to your uncertainty estimates.',
  budgetDiscussion:
    'Justify your distributions, independent and shared effects, and any unquantified sources. Explain how you avoided counting the same effect twice.',
  propagationPoint:
    'Identify one new position and state whether you report one reading or an average.',
  propagationTime: 'Enter the echo-time input t (µs).',
  uTime: 'Enter its standard uncertainty uₜ (µs).',
  conditionalU:
    'Calculate the regression-conditional standard distance uncertainty (cm).',
  referencePropagation:
    'Explain how reference uncertainty, the distance starting point and other corrections enter your full model.',
  combinedU: 'Enter the combined standard uncertainty u꜀ (cm).',
  propagationWorking:
    'Show your propagation calculation, including covariance, units and assumptions.',
  expandedU: 'If used, enter expanded uncertainty U (cm).',
  coverage: 'If used, state and justify the coverage factor k.',
  angleWorking:
    'Show your comparison of perpendicular, tilted and returned readings, including scatter, calibrated distances, failed echoes and reference-position limits.',
  angleDiscussion:
    'Explain whether the original calibration remained useful after tilting, and what returning the target showed.',
  conclusion:
    'Report a distance with uncertainty and units, the supported range, the dominant limitation and one improvement you could test.',
  help: 'State which software, AI tools or other help you used.',
};
export const SOURCES = [
  ['graduation', 'How far apart are the smallest ruler marks?'],
  ['accuracy', 'What accuracy does the ruler manufacturer state?'],
  ['origin', 'How well can you locate the distance starting point?'],
  ['placement', 'How closely can you position and read the target?'],
  ['timing', 'What limits the echo-time measurement?'],
  ['alignment', 'How well can you control alignment?'],
  ['environment', 'What changed during the experiment?'],
  ['other', 'What other limits did you notice?'],
];
export const BUDGET_SOURCES = [
  ['repeat', 'How much do repeated readings vary?'],
  ['runs', 'How much do the three runs differ?'],
  ['reference', 'How do the ruler and starting point affect distance?'],
  ['timing', 'How do timing limitations affect distance?'],
  ['fit', 'How uncertain are the fitted line parameters?'],
  ['other', 'What other limitations affect the reported result?'],
];
export const REFERENCE_KEYS = [
  'status',
  'value',
  'units',
  'distribution',
  'scope',
  'source',
  'justification',
];
export const BUDGET_KEYS = [
  'status',
  'estimate',
  'units',
  'distribution',
  'standard',
  'coefficient',
  'contribution',
  'scope',
  'accounted',
  'justification',
];
// Slots are explicit so imported files cannot introduce executable content or arbitrary archive paths.
export const ATTACHMENTS = {
  main: {
    circuit: 'Upload a photograph of your actual connected circuit.',
    circuit2: 'Read a circuit photograph saved earlier.',
    circuit3: 'Read another circuit photograph saved earlier.',
    code: 'Read the Arduino file uploaded earlier.',
    calibrationData: 'Upload your calibration measurements as CSV.',
    calibration: 'Upload your calibration graph.',
    validationData: 'Upload your measurements at the two new distances as CSV.',
    validation: 'Add a graph of the distance checks if useful.',
    angleData:
      'Upload the perpendicular, tilted and returned measurements as CSV.',
    angle: 'Upload a graph comparing the three target orientations.',
  },
  post: {
    calibration: 'Upload your calibration graph.',
    residuals: 'Upload your residual plot.',
    working: 'Add an image of additional calculations if useful.',
    angle: 'Upload your comparison of the target orientations.',
  },
};
export const FILE_KINDS = {
  code: 'code',
  calibrationData: 'csv',
  validationData: 'csv',
  angleData: 'csv',
};
export const REQUIRED_FILES = {
  main: [
    'circuit',
    'calibrationData',
    'calibration',
    'validationData',
    'angleData',
    'angle',
  ],
  post: ['calibration', 'residuals', 'angle'],
};
export const pages = (kind) => (kind === 'main' ? MAIN_PAGES : POST_PAGES);
export const labels = (kind) => (kind === 'main' ? MAIN_FIELDS : POST_FIELDS);
export const namespace = (kind) => `electronics-sensor-calibration-${kind}-v2`;
export const activity = (kind) => `2145427-sensor-calibration-${kind}`;
export const prerequisites = (files, record) =>
  !!(
    record?.fields?.code?.trim() &&
    (files.circuit || files.circuit2 || files.circuit3)
  );
const blankFields = (keys) => Object.fromEntries(keys.map((k) => [k, '']));
export function createRecord(kind) {
  if (!['main', 'post'].includes(kind)) throw new Error('Unknown worksheet.');
  const now = new Date().toISOString();
  const fields = blankFields(Object.keys(labels(kind)));
  if (kind === 'main') fields.board = 'Arduino UNO R4 WiFi';
  return {
    activityId: activity(kind),
    schemaVersion: VERSION,
    recordId: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    current: 0,
    fields,
    uncertainty: Object.fromEntries(
      (kind === 'main' ? SOURCES : BUDGET_SOURCES).map(([id]) => [
        id,
        blankFields(kind === 'main' ? REFERENCE_KEYS : BUDGET_KEYS),
      ]),
    ),
    needsReview: false,
  };
}
const exact = (a, b) =>
  a &&
  typeof a === 'object' &&
  !Array.isArray(a) &&
  Object.keys(a).sort().join('|') === Object.keys(b).sort().join('|');
const textValues = (obj) =>
  Object.entries(obj).every(
    ([k, v]) =>
      typeof v === 'string' && v.length <= (k === 'code' ? 1048576 : 16000),
  );
export function validateRecord(value, kind) {
  // Keep earlier version-two saves readable without filling in student answers.
  if (kind === 'main' && value?.fields) {
    const fields = { ...value.fields };
    for (const key of ['code', 'xVariable', 'yVariable']) {
      if (!Object.hasOwn(fields, key)) fields[key] = '';
    }
    value = { ...value, fields };
  }
  const blank = createRecord(kind);
  if (
    !exact(value, blank) ||
    value.activityId !== activity(kind) ||
    value.schemaVersion !== VERSION ||
    typeof value.recordId !== 'string' ||
    !value.recordId ||
    value.recordId.length > 100 ||
    ![value.createdAt, value.updatedAt].every(
      (t) => typeof t === 'string' && Number.isFinite(Date.parse(t)),
    ) ||
    !Number.isInteger(value.current) ||
    value.current < 0 ||
    value.current >= pages(kind).length ||
    !exact(value.fields, blank.fields) ||
    !textValues(value.fields) ||
    !exact(value.uncertainty, blank.uncertainty) ||
    typeof value.needsReview !== 'boolean'
  )
    throw new Error(
      'This is not a supported version-two Sensor Calibration record.',
    );
  for (const id of Object.keys(blank.uncertainty))
    if (
      !exact(value.uncertainty[id], blank.uncertainty[id]) ||
      !textValues(value.uncertainty[id])
    )
      throw new Error('Invalid uncertainty record.');
  if (new TextEncoder().encode(JSON.stringify(value)).length > 8 * 1024 * 1024)
    throw new Error('Worksheet text exceeds 8 MiB.');
  return structuredClone(value);
}
export const NUMERIC_FIELDS = new Set([
  'intercept',
  'slope',
  'uIntercept',
  'uSlope',
  'covariance',
  'inverse',
  'nominalSensitivity',
  'sensitivityDeviation',
  'outputSpan',
  'offsetPercent',
  'maxResidual',
  'linearityPercent',
  'repeatabilityPercent',
  'propagationTime',
  'uTime',
  'conditionalU',
  'combinedU',
  'expandedU',
]);
export function numericIssue(value, positive = false) {
  if (!value.trim()) return '';
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim()) &&
    Number.isFinite(Number(value)) &&
    (!positive || Number(value) > 0)
    ? ''
    : positive
      ? 'Enter a positive finite number. Your original text is kept.'
      : 'Enter a finite number without units. Your original text is kept.';
}
export const CSV_HEADERS = [
  'trial',
  'condition',
  'reference distance (cm)',
  'echo time (us)',
  'note',
];
const LEGACY_CSV_HEADERS = [
  'run',
  'condition',
  'reference_distance_cm',
  'reading',
  'echo_time_us',
  'status',
  'notes',
];
// Read values as literal text; never evaluate spreadsheet formulas or coerce measurements.
export function parseCSV(input) {
  const text = input.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [],
    cell = '',
    quoted = false,
    closed = false;
  let cells = 0;
  const finishCell = () => {
    if (++cells > 1000000 || rows.length >= 100000)
      throw new Error(
        'The file is kept, but this CSV is too large for the preview. Split it into smaller files for inspection in your own software.',
      );
    row.push(cell);
    cell = '';
    closed = false;
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
    } else if (c === '"' && !cell && !closed) quoted = true;
    else if (c === ',') {
      finishCell();
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      finishCell();
      rows.push(row);
      row = [];
    } else {
      if (closed || c === '"')
        throw new Error(
          'Check the CSV quotation marks. Quote fields that contain commas, quotation marks or line breaks.',
        );
      cell += c;
    }
  }
  if (quoted) throw new Error('The CSV contains an unclosed quotation mark.');
  if (cell || row.length || closed) {
    finishCell();
    rows.push(row);
  }
  if (!rows.length) throw new Error('The CSV is empty.');
  return rows;
}
export function csvGuidance(text, slot = 'calibrationData') {
  let rows;
  try {
    rows = parseCSV(text);
  } catch (error) {
    return { rows: [], issues: [error.message] };
  }
  if (LEGACY_CSV_HEADERS.every((key) => rows[0].includes(key)))
    return legacyCSVGuidance(rows, slot);
  const normalize = (value) =>
    value.trim().toLowerCase().replaceAll('µ', 'u').replaceAll('μ', 'u');
  const header = rows[0].map(normalize),
    issues = [],
    trials = new Set();
  const aliases = {
    trial: ['trial', 'trail'],
    condition: ['condition'],
    'reference distance (cm)': [
      'reference distance (cm)',
      'reference_distance_cm',
    ],
    'echo time (us)': ['echo time (us)', 'echo_time_us'],
    note: ['note', 'notes'],
  };
  const columns = Object.fromEntries(
    CSV_HEADERS.map((key) => [
      key,
      header.findIndex((h) => aliases[key].includes(h)),
    ]),
  );
  const missing = CSV_HEADERS.filter((key) => columns[key] < 0);
  if (missing.length)
    issues.push(`Use these missing column headings: ${missing.join(', ')}.`);
  if (new Set(header).size !== header.length)
    issues.push('Give each column a unique heading.');
  if (rows.length === 1)
    issues.push('Add your measured attempts below the headings.');
  const add = (message) => {
    if (issues.length < 40) issues.push(message);
  };
  rows.slice(1).forEach((row, i) => {
    const line = i + 2;
    if (row.length !== header.length) {
      add(`Row ${line}: keep the same number of columns as the header.`);
      return;
    }
    if (missing.length) return;
    const get = (key) => row[columns[key]],
      echo = get('echo time (us)'),
      note = get('note').trim();
    trials.add(get('trial').trim());
    if (!get('trial').trim() || !get('condition').trim())
      add(`Row ${line}: label the trial and condition.`);
    if (
      !get('reference distance (cm)').trim() ||
      numericIssue(get('reference distance (cm)'), true)
    )
      add(`Row ${line}: give the actual ruler distance in cm.`);
    const excluded = /^excluded\b/i.test(note),
      failed = /^(?:no[ _-]*echo|timeout)\b/i.test(note);
    if (excluded && !note.replace(/^excluded\b\s*:?\s*/i, '').trim())
      add(`Row ${line}: explain the exclusion after “Excluded:” in note.`);
    if (failed && echo.trim())
      add(
        `Row ${line}: a missing echo has no valid duration. Leave the echo-time cell empty in your source CSV; your uploaded draft is kept.`,
      );
    else if (!echo.trim() && !note)
      add(`Row ${line}: explain the failed or missing echo in note.`);
    else if (!excluded && echo.trim() && numericIssue(echo, true))
      add(
        `Row ${line}: give a positive echo duration in us, or explain an excluded reading in note.`,
      );
  });
  if (
    slot === 'calibrationData' &&
    !missing.length &&
    (!['1', '2', '3'].every((value) => trials.has(value)) ||
      [...trials].some((value) => !['1', '2', '3'].includes(value)))
  )
    add(
      'Use trial labels 1, 2 and 3 for the three calibration runs. Repeat the trial number for readings from the same run.',
    );
  return { rows, issues };
}
function legacyCSVGuidance(rows, slot) {
  const header = rows[0],
    issues = [],
    missing = LEGACY_CSV_HEADERS.filter((h) => !header.includes(h));
  if (missing.length)
    issues.push(`Use these missing column headings: ${missing.join(', ')}.`);
  if (new Set(header).size !== header.length)
    issues.push('Give each column a unique heading.');
  if (rows.length === 1)
    issues.push('Add your measured attempts below the headings.');
  const col = (k) => header.indexOf(k),
    runs = new Set();
  const seen = new Set();
  const add = (s) => {
    if (issues.length < 40) issues.push(s);
  };
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    if (r.length !== header.length) {
      add(`Row ${line}: keep the same number of columns as the header.`);
      return;
    }
    if (missing.length) return;
    const get = (k) => r[col(k)],
      status = get('status'),
      echo = get('echo_time_us');
    runs.add(get('run'));
    const key = JSON.stringify(
      ['run', 'condition', 'reference_distance_cm', 'reading'].map(get),
    );
    if (seen.has(key))
      add(
        `Row ${line}: check this repeated run, condition, distance and reading label.`,
      );
    seen.add(key);
    if (!get('run') || !get('condition') || !get('reading'))
      add(`Row ${line}: label the run, condition and reading.`);
    if (
      !get('reference_distance_cm').trim() ||
      numericIssue(get('reference_distance_cm'), true)
    )
      add(`Row ${line}: give the actual ruler distance in cm.`);
    if (!['ok', 'no_echo', 'excluded'].includes(status))
      add(`Row ${line}: use ok, no_echo or excluded for status.`);
    if (status === 'ok' && (!echo.trim() || numericIssue(echo, true)))
      add(
        `Row ${line}: give a positive echo duration in µs for an ok measurement.`,
      );
    if (status === 'no_echo' && echo !== '')
      add(
        `Row ${line}: a missing echo has no valid duration. Keep this draft and correct the source CSV before replacing it.`,
      );
    if (['no_echo', 'excluded'].includes(status) && !get('notes').trim())
      add(`Row ${line}: explain the failed or excluded attempt in notes.`);
  });
  if (
    slot === 'calibrationData' &&
    !missing.length &&
    (!['1', '2', '3'].every((r) => runs.has(r)) ||
      [...runs].some((r) => !['1', '2', '3'].includes(r)))
  )
    add(
      'Label the three calibration runs 1, 2 and 3. Keep measurements from other investigations in their separate CSV files.',
    );
  return { rows, issues };
}
const csvCell = (v) => `"${String(v).replaceAll('"', '""')}"`;
export function uncertaintyCSV(record, kind = 'main') {
  const keys = kind === 'main' ? REFERENCE_KEYS : BUDGET_KEYS;
  const safe = (v) => (/^[\s]*[=+@-]/.test(v) && numericIssue(v) ? `'${v}` : v);
  return (
    '\uFEFF' +
    [
      ['source', ...keys],
      ...Object.entries(record.uncertainty).map(([id, v]) => [
        id,
        ...keys.map((k) => v[k]),
      ]),
    ]
      .map((r) => r.map((v) => csvCell(safe(String(v)))).join(','))
      .join('\r\n')
  );
}
export function draftIssues(record, kind, hasSource = false) {
  const required =
    kind === 'main'
      ? [
          'groupId',
          'member1Name',
          'member1Id',
          'code',
          'setupNotes',
          'timing',
          'xVariable',
          'yVariable',
          'design',
          'runNotes',
          'provisionalEquation',
          'slope',
          'intercept',
          'inverse',
          'validationPlan',
          'validationWorking',
          'validationDiscussion',
          'anglePlan',
          'angleWorking',
          'angleDiscussion',
        ]
      : [
          'name',
          'studentId',
          'repeatWorking',
          'repeats',
          'fitWorking',
          'fitAssumptions',
          'slope',
          'intercept',
          'uSlope',
          'uIntercept',
          'covariance',
          'inverse',
          'nominalSensitivity',
          'sensitivityDeviation',
          'sensitivityDiscussion',
          'outputSpan',
          'offsetPercent',
          'maxResidual',
          'linearityPercent',
          'repeatability',
          'repeatabilityPercent',
          'errorWorking',
          'errorDiscussion',
          'validationWorking',
          'validationDiscussion',
          'budgetDiscussion',
          'propagationPoint',
          'propagationTime',
          'uTime',
          'conditionalU',
          'combinedU',
          'referencePropagation',
          'propagationWorking',
          'angleWorking',
          'angleDiscussion',
          'conclusion',
          'help',
        ];
  const issues = required
    .filter((k) => !record.fields[k].trim())
    .map((k) => labels(kind)[k]);
  if (kind === 'post' && !hasSource)
    issues.unshift('Open your group’s version-two ZIP or JSON file.');
  if (kind === 'main')
    for (const n of [1, 2, 3])
      if (
        !!record.fields[`member${n}Name`].trim() !==
        !!record.fields[`member${n}Id`].trim()
      )
        issues.push(`Complete both the name and ID for student ${n}.`);
  if (record.needsReview)
    issues.push('Check your answers against the replacement group file.');
  return issues;
}
