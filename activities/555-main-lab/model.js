/* Workbook data only. No simulator, answer key, or correctness classifier. */
export const ACTIVITY = '555-main-lab';
export const VERSION = 3;
export const STORAGE_KEY = 'electronics-555-main-lab-v3';
export const PRIOR_STORAGE_KEY = 'electronics-555-main-lab-v2';
export const LEGACY_STORAGE_KEY = 'electronics-555-main-lab-v1';
export const MAX_TEXT_LENGTH = 4000;
export const MAX_RECORD_BYTES = 8 * 1024 * 1024;
export const IDS = ['A0', 'A1', 'M0', 'M1'];
export const REQUIRED_IDS = ['A0', 'A1', 'M0'];
export const REQUIRED_CAPTURES = ['A0', 'A1', 'M0trigger'];
export const RESISTORS = [1, 3.3, 4.7, 10, 33];
export const CAPACITORS = [1, 10];
export const TASKS = {
  A0: { number: 1, title: 'Lab 1 - Astable Circuit Design' },
  A1: { number: 2, title: 'Lab 2 - Astable Circuit Modification' },
  M0: { number: 3, title: 'Lab 3 - Monostable Circuit Design' },
};
export const taskLabel = (id) => TASKS[id] ? `Lab ${TASKS[id].number}` : 'Earlier optional activity';
export const SCREENS = [
  ['Before you begin', 'Equipment and safety'],
  [TASKS.A0.title, 'Design and test your circuit'],
  [TASKS.A1.title, 'Continue from Lab 1'],
  [TASKS.M0.title, 'Use a switch to trigger the pulse'],
  ['Save lab data', 'Download the pair’s data for individual post-lab work'],
];
// Version-2 backups retain the original eleven page codes. Navigation uses
// these groups, never the new page indexes, so old answers need no migration.
export const PAGE_HISTORY = [[0], [1, 2], [3], [4, 5, 7], [8, 9, 10]];
const HISTORY_LIMIT = 11;
export const visitedPages = (record) => PAGE_HISTORY.flatMap((codes, i) => codes.some((code) => record.visited.includes(code)) ? [i] : []);
export function markPageVisited(record, index) {
  const code = PAGE_HISTORY[index]?.[0];
  if (code === undefined) throw new Error('This page could not be found.');
  if (!record.visited.includes(code)) record.visited.push(code);
}
export const PREDICTION_FIELDS = {
  high: ['HIGH time', 's'],
  low: ['LOW time', 's'],
  period: ['Period', 's'],
  frequency: ['Frequency', 'Hz'],
  duty: ['HIGH duty cycle', '%'],
  pulse: ['Output pulse duration t_W', 's'],
};
export const MEASUREMENT_FIELDS = {
  ...PREDICTION_FIELDS,
  supply: ['Supply voltage', 'V'],
  outHigh: ['Output voltage when HIGH', 'V'],
  outLow: ['Output voltage when LOW', 'V'],
  capHigh: ['Capacitor voltage when charging ends', 'V'],
  capLow: ['Capacitor voltage when discharging ends or before triggering', 'V'],
  triggerHigh: ['Trigger HIGH level', 'V'],
  triggerLow: ['Trigger LOW level', 'V'],
  triggerWidth: ['Trigger LOW duration', 's'],
  triggerPeriod: ['Time between trigger events', 's'],
};
export const SAFETY = {
  orientation: 'Locate the notch and pin 1 on the IC. Check the pin numbers against the diagram before wiring.',
  rails:
    'Before switching on the supply, check its polarity, the breadboard power rails, and the IC power connections.',
  polarity:
    'Check the timing capacitor’s voltage rating. If it is polarized, connect its positive terminal to the timing node and its negative terminal to ground.',
  grounds:
    'Connect the supply negative terminal and all oscilloscope ground clips to circuit ground. If you use a function generator, connect its ground to the same point.',
  modifications:
    'Switch off the supply and discharge the capacitor through a suitable resistor before changing any connections. Do not measure resistance while the circuit is powered.',
  probes:
    'Use high-impedance oscilloscope inputs and match the probe settings to the oscilloscope settings. Disconnect LEDs, buzzers, and other output loads while checking the design specifications.',
};
const emptyStrings = (keys) => Object.fromEntries(keys.map((key) => [key, '']));
const prediction = () => ({
  ...emptyStrings(Object.keys(PREDICTION_FIELDS)),
  reason: '',
  sketch: '',
});
const measurement = () => ({
  ...emptyStrings(Object.keys(MEASUREMENT_FIELDS)),
  timebase: '',
  voltsPerDiv: '',
  probe: '',
  method: '',
  notes: '',
});
const design = () => ({
  r1a: '',
  r1b: '',
  r2a: '',
  r2b: '',
  capacitor: '',
  measuredR1: '',
  measuredR2: '',
  measuredC: '',
  tolerance: '',
  rationale: '',
});
export function createRecord() {
  const at = new Date().toISOString();
  return {
    activityId: ACTIVITY,
    schemaVersion: VERSION,
    recordId:
      globalThis.crypto?.randomUUID?.() ||
      `lab-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: at,
    updatedAt: at,
    group: { id: '', student1: { name: '', id: '' }, student2: { name: '', id: '' } },
    legacyMembers: '',
    setup: {
      supply: '',
      scope: '',
      generator: '',
      dmm: '',
      notes: '',
      safety: Object.fromEntries(
        Object.keys(SAFETY).map((key) => [key, false]),
      ),
    },
    configs: Object.fromEntries(
      IDS.map((id) => [
        id,
        {
          design: design(),
          prediction: prediction(),
          original: null,
          measurement: measurement(),
        },
      ]),
    ),
    conversion: {
      pin2: '',
      pin6: '',
      pin7: '',
      r2: '',
      reason: '',
      checked: false,
    },
    evidence: Object.fromEntries(
      ['A0', 'A1', 'M0trigger', 'M0capacitor', 'M1'].map((id) => [
        id,
        { filename: '', annotation: '' },
      ]),
    ),
    analysis: {
      workings: '',
      comparison: '',
      paths: '',
      conversion: '',
      timing: '',
      uncertainty: '',
      verification: '',
      conclusionA: '',
      conclusionM: '',
      improvement: '',
    },
    optional: { tool: '', simulation: '', extensions: '' },
    handoff: { poweredDown: false, evidenceChecked: false, notes: '' },
    visited: [0],
  };
}
export const clone = (value) => JSON.parse(JSON.stringify(value));
export function number(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
export const signedDeviation = (predicted, measured) => {
  const p = number(predicted),
    m = number(measured);
  const result = p !== null && p > 0 && m !== null ? ((m - p) / p) * 100 : null;
  return Number.isFinite(result) ? result : null;
};
export const resistance = (d, prefix) => {
  const first = number(d[`${prefix}a`]), second = d[`${prefix}b`].trim() ? number(d[`${prefix}b`]) : 0;
  const total = first !== null && first > 0 && second !== null ? first + second : null;
  return total !== null && Number.isFinite(total) ? total : null;
};
const resistorCombinations = RESISTORS.flatMap((first, i) => [[first], ...RESISTORS.slice(i).map((second) => [first, second])]);
const stockFits = (parts) => RESISTORS.every((value) => parts.filter((part) => part === value).length <= 2);
function resistanceParts(d, prefix) {
  if (d[`${prefix}b`].trim()) {
    const parts = [number(d[`${prefix}a`]), number(d[`${prefix}b`])];
    return parts.every((part) => RESISTORS.includes(part)) ? [parts] : [];
  }
  const total = resistance(d, prefix);
  return total === null ? [] : resistorCombinations.filter((parts) => Math.abs(parts.reduce((sum, part) => sum + part, 0) - total) < 1e-8);
}
export function designIssues(id, d) {
  const issues = [];
  const prefixes = id.startsWith('A') ? ['r1', 'r2'] : ['r1'];
  let combinations = [[]];
  for (const prefix of prefixes) {
    const label = id.startsWith('A') ? prefix.toUpperCase() : 'R';
    if (!(resistance(d, prefix) > 0)) {
      issues.push(`Enter a total resistance greater than zero for ${label}, in kΩ.`);
      continue;
    }
    const parts = resistanceParts(d, prefix);
    if (!parts.length) issues.push(`${label} cannot be made from one supplied resistor or two supplied resistors in series. Check the total resistance.`);
    combinations = combinations.flatMap((current) => parts.map((next) => [...current, ...next]));
  }
  if (!d.capacitor) issues.push('Select a timing capacitor.');
  else if (!CAPACITORS.includes(number(d.capacitor))) issues.push('Enter the value of one supplied timing capacitor: 1 or 10 µF.');
  if (!id.startsWith('A') && (d.r2a || d.r2b)) issues.push('Remove R2 from the component selection; the monostable circuit uses one timing resistance.');
  if (!issues.length && !combinations.some(stockFits)) issues.push('Only two resistors of each value are available. These totals need more than the supplied quantities; change one of the resistance values.');
  return issues;
}
export function designReference(record, id) {
  return id === 'A1'
    ? record.configs.A1.original?.reference || {
      frequency: record.configs.A0.measurement.frequency,
      capacitor: record.configs.A0.design.capacitor,
    }
    : { frequency: '', capacitor: '' };
}
// Preview the required capacitor without rewriting imported drafts on render.
// Previously saved designs stay intact, including any recorded corrections.
export function designForEntry(record, id) {
  const config = record.configs[id];
  return id === 'A1' && !config.original
    ? { ...config.design, capacitor: designReference(record, id).capacitor }
    : config.design;
}
export function preservePrediction(record, id) {
  const config = record.configs[id];
  if (!config) throw new Error('This circuit section could not be found. Reopen the workbook and try again.');
  if (config.original) return false;
  if (!Object.values(config.prediction).some((value) => value.trim()))
    throw new Error(
      'Enter your predicted values before saving your initial design.',
    );
  const reference = designReference(record, id);
  if (id === 'A1') {
    if (!record.configs.A0.original || !(number(reference.frequency) > 0))
      throw new Error('Measure the Lab 1 output frequency and enter a value greater than zero in Lab 1 → Measured results → Frequency (Hz) before saving the Lab 2 design.');
    if (!reference.capacitor)
      throw new Error('Record the timing capacitor used in Lab 1 before saving the Lab 2 design.');
  }
  const design = designForEntry(record, id);
  const issues = designIssues(id, design);
  if (issues.length) throw new Error(issues.join(' '));
  config.original = {
    at: new Date().toISOString(),
    design: clone(design),
    prediction: clone(config.prediction),
    reference: clone(reference),
  };
  // This explicit save adopts the capacitor displayed in the Lab 2 form.
  config.design.capacitor = design.capacitor;
  return true;
}
export function updateField(record, path, value) {
  const keys = path.split('.');
  if (
    keys.some((key) =>
      ['__proto__', 'prototype', 'constructor', 'original'].includes(key),
    )
  )
    throw new Error('The original design and calculations cannot be edited. Enter corrections in the current answer fields.');
  if (
    keys[0] === 'configs' &&
    keys[2] === 'measurement' &&
    !record.configs[keys[1]]?.original
  )
    throw new Error(
      'Save your initial design and predictions before entering measured results.',
    );
  let target = record;
  for (const key of keys.slice(0, -1)) {
    if (
      !Object.hasOwn(target, key) ||
      !target[key] ||
      typeof target[key] !== 'object'
    )
      throw new Error('This answer field could not be found. Reopen the workbook and try again.');
    target = target[key];
  }
  const key = keys.at(-1);
  if (
    !Object.hasOwn(target, key) ||
    typeof value !== typeof target[key] ||
    !['string', 'boolean'].includes(typeof value)
  )
    throw new Error('This answer could not be recorded. Check the value and try again.');
  if (typeof value === 'string' && value.length > MAX_TEXT_LENGTH)
    throw new Error('Please shorten this answer to 4,000 characters or fewer.');
  target[key] = value;
  // A typed value is the complete resistance. Keep imported series parts intact
  // until that total is explicitly edited; the saved original is never changed.
  if (keys[0] === 'configs' && keys[2] === 'design' && ['r1a', 'r2a'].includes(key)) target[key.replace('a', 'b')] = '';
  record.updatedAt = new Date().toISOString();
}
function checkShape(value, template, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('A section of this backup is missing or has an unreadable format. Try another backup file.');
  const expected = Object.keys(template);
  if (
    Object.keys(value).length !== expected.length ||
    !expected.every((key) => Object.hasOwn(value, key))
  )
    throw new Error('This backup has missing or unfamiliar answer fields. Select a backup downloaded from this workbook.');
  for (const key of expected) {
    if (key === 'original' || key === 'visited') continue;
    const current = value[key],
      sample = template[key];
    if (sample && typeof sample === 'object')
      checkShape(current, sample, `${path}.${key}`);
    else if (
      typeof current !== typeof sample ||
      (typeof current === 'string' && current.length > MAX_TEXT_LENGTH)
    )
      throw new Error('This backup contains an answer in an unreadable format or longer than the allowed limit. Try another backup file.');
  }
}
const validDate = (value) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));
export function validateRecord(value) {
  if (value?.activityId === ACTIVITY && value?.schemaVersion === 1)
    throw new Error('This backup belongs to the earlier lab. Open START_HERE-v1.html and load it there.');
  const template = createRecord();
  const previous = value?.activityId === ACTIVITY && value?.schemaVersion === 2;
  if (previous) {
    template.schemaVersion = 2;
    template.group = /** @type {any} */ ({ id: '', members: '' });
    delete template.legacyMembers;
  }
  checkShape(value, template, 'Record');
  if (value.activityId !== ACTIVITY || value.schemaVersion !== (previous ? 2 : VERSION))
    throw new Error('This backup is from a different activity or workbook version. Select a backup saved by this workbook.');
  if (!validDate(value.createdAt) || !validDate(value.updatedAt))
    throw new Error('The backup contains an unreadable save date. Try another backup file.');
  if (
    !Array.isArray(value.visited) ||
    value.visited.length > HISTORY_LIMIT ||
    new Set(value.visited).size !== value.visited.length ||
    value.visited.some(
      (n) => !Number.isInteger(n) || n < 0 || n >= HISTORY_LIMIT,
    )
  )
    throw new Error('The backup contains an invalid list of visited pages. Try another backup file.');
  for (const id of IDS) {
    const config = value.configs[id];
    const checkDesign = (d) => {
      // Typed Lab 3 capacitance drafts, like resistance drafts, must remain
      // exportable even mid-edit. Originals pass the stock checks below.
      if (id !== 'M0' && !['', ...CAPACITORS.map(String)].includes(d.capacitor))
        throw new Error(`${taskLabel(id)}: the backup lists a component that is not available in this lab.`);
    };
    checkDesign(config.design);
    if (config.original !== null) {
      checkShape(
        config.original,
        {
          at: '',
          design: template.configs[id].design,
          prediction: prediction(),
          reference: { frequency: '', capacitor: '' },
        },
        `${id}.original`,
      );
      if (
        !validDate(config.original.at) ||
        !Object.values(config.original.prediction).some((v) => v.trim())
      )
        throw new Error(`${taskLabel(id)}: the original predictions or their save date are missing or unreadable.`);
      checkDesign(config.original.design);
      if (designIssues(id, config.original.design).length)
        throw new Error(`${taskLabel(id)}: the original component selection is incomplete or exceeds the available resistor quantities.`);
      const ref = config.original.reference;
      if (id === 'A1') {
        if (!(number(ref.frequency) > 0) || !CAPACITORS.map(String).includes(ref.capacitor) || config.original.design.capacitor !== ref.capacitor || !value.configs.A0.original)
          throw new Error('Lab 2: the saved Lab 1 frequency or capacitor value is missing or inconsistent. Try another backup file.');
      } else if (ref.frequency || ref.capacitor)
        throw new Error(`${taskLabel(id)}: the backup includes reference values that do not belong to this circuit section.`);
    } else if (Object.values(config.measurement).some((v) => v.trim()))
      throw new Error(
        `${taskLabel(id)}: the backup includes measurements but no saved initial design and predictions.`,
      );
  }
  const result = clone(value);
  if (previous) {
    const names = result.group.members.split(/\r?\n/).map((name) => name.trim()).filter(Boolean);
    result.legacyMembers = result.group.members;
    result.group = { id: result.group.id, student1: { name: names.length === 2 ? names[0] : '', id: '' }, student2: { name: names.length === 2 ? names[1] : '', id: '' } };
    result.schemaVersion = VERSION;
  }
  return result;
}
export const pairStudents = (record) => [record.group.student1, record.group.student2];
export function identityIssues(record) {
  const issues = [];
  if (!record.group.id.trim()) issues.push('Enter the Group ID.');
  pairStudents(record).forEach((student, i) => {
    if (!student.name.trim()) issues.push(`Enter Student ${i + 1} name.`);
    if (!student.id.trim()) issues.push(`Enter Student ${i + 1} ID.`);
  });
  if (record.group.student1.id.trim() && record.group.student1.id.trim() === record.group.student2.id.trim()) issues.push('The two student IDs must be different.');
  return issues;
}
export function downloadStem(prefix, groupId, students) {
  const safe = (text, limit) => {
    const cleaned = text.trim().replace(/[^\p{L}\p{M}\p{N}_-]/gu, '_');
    const encoder = new TextEncoder();
    let name = '', bytes = 0;
    for (const character of cleaned) {
      const size = encoder.encode(character).length;
      if (bytes + size > limit) break;
      name += character; bytes += size;
    }
    return name || 'DRAFT';
  };
  return [prefix, safe(groupId, 24), ...students.flatMap((student) => [safe(student.name, 24), safe(student.id, 40)])].join('_');
}
export function parseRecord(text) {
  if (new TextEncoder().encode(text).length > MAX_RECORD_BYTES)
    throw new Error('The file is larger than the 8 MB limit. Select a smaller workbook backup.');
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('This file cannot be read as a JSON backup. Select the JSON file downloaded from this workbook.');
  }
  return validateRecord(value);
}
export function comparisonRows(record) {
  return REQUIRED_IDS.flatMap((id) =>
    (id.startsWith('A')
      ? ['high', 'low', 'period', 'frequency', 'duty']
      : ['pulse']
    ).map((key) => {
      const p = record.configs[id].prediction[key],
        m = record.configs[id].measurement[key];
      const pn = number(p),
        mn = number(m);
      return {
        id,
        key,
        predicted: pn,
        measured: mn,
        difference:
          key === 'duty'
            ? pn !== null && mn !== null
              ? mn - pn
              : null
            : signedDeviation(p, m),
      };
    }),
  );
}
export function progress(record, attachedSlots = []) {
  return {
    preserved: REQUIRED_IDS.filter((id) => record.configs[id].original).length,
    captures: REQUIRED_CAPTURES.filter(
      (id) => attachedSlots.includes(id),
    ).length,
    conclusions: ['conclusionA', 'conclusionM'].filter((key) =>
      record.analysis[key].trim(),
    ).length,
  };
}
