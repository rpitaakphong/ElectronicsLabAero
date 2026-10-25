export const ACTIVITY = 'noise-filtering-post-lab';
export const VERSION = 1;
export const STORAGE_KEY = 'electronics-noise-filtering-post-lab-v1';
export const DATABASE = 'electronics-noise-filtering-post-lab-files-v1';
export const SCREENS = ['Load Your Lab Files', 'Evaluate the RC Filter', 'Evaluate the Useful Pulses', 'Evaluate MA and EMA', 'Recommend, Reflect and Save'];
export const LABELS = {
  name: 'Your name (required)', studentId: 'Student ID (optional)',
  cutoff: 'Calculated cutoff (Hz)', rcCalculation: 'Your cutoff calculation, including unit conversions',
  rcDiscussion: 'Your RC results, comparison and measurement limits', rcReflection: 'What your RC measurements tell you about your pre-lab prediction',
  pulses: 'Your pulse comparison and measurements',
  digitalTrials: 'Your comparison of MA and EMA parameter trials', digitalTiming: 'Your explanation of sampling, initialization and timing checks',
  digitalChoice: 'Your chosen digital settings and reasons', digitalReflection: 'What your digital-filter results tell you about your pre-lab prediction',
  recommendation: 'Your recommended RC and digital-filter combination', tradeoff: 'The tradeoffs behind your recommendation',
  improvement: 'One improvement to the experiment and how you would test it', reflection: 'What you would change about your original predictions, and why',
  ...Object.fromEntries([1, 2, 3].flatMap(n => [['predicted', 'Theoretical attenuation (dB)'], ['measured', 'Your calculated attenuation (dB)'], ['working', 'Your calculation and comparison']].map(([id, label]) => [`noise${n}.${id}`, `Noise frequency ${n}: ${label}`]))),
};
export const MAX_TEXT = 12000;
export function createRecord() {
  const now = new Date().toISOString();
  return { activityId: ACTIVITY, schemaVersion: VERSION, recordId: crypto.randomUUID(), createdAt: now, updatedAt: now, current: 0,
    fields: Object.fromEntries(Object.keys(LABELS).map(k => [k, ''])), sources: { main: null, prelab: null }, identityConfirmed: false, needsReview: false };
}
const exact = (a, b) => a && typeof a === 'object' && !Array.isArray(a) && Object.keys(a).sort().join('|') === Object.keys(b).sort().join('|');
export function validateRecord(value) {
  const blank = createRecord();
  if (!exact(value, blank) || value.activityId !== ACTIVITY || value.schemaVersion !== VERSION ||
      typeof value.recordId !== 'string' || !value.recordId || value.recordId.length > 100 ||
      ![value.createdAt, value.updatedAt].every(t => typeof t === 'string' && Number.isFinite(Date.parse(t))) ||
      !Number.isInteger(value.current) || value.current < 0 || value.current >= SCREENS.length ||
      typeof value.identityConfirmed !== 'boolean' || typeof value.needsReview !== 'boolean' ||
      !exact(value.fields, blank.fields) || Object.values(value.fields).some(v => typeof v !== 'string' || v.length > MAX_TEXT) ||
      !exact(value.sources, blank.sources)) throw new Error('This is not a supported Noise and Filtering individual post-lab record.');
  for (const source of Object.values(value.sources)) if (source !== null && (!exact(source, { name: '' }) || typeof source.name !== 'string' || !source.name || source.name.length > 255)) throw new Error('Invalid source filename.');
  return structuredClone(value);
}
export function updateField(record, key, value) {
  if (!Object.hasOwn(LABELS, key) || typeof value !== 'string' || value.length > MAX_TEXT) throw new Error('Answer is too long or is not a supported field.');
  record.fields[key] = value;
  if (key === 'name' || key === 'studentId') record.identityConfirmed = false;
  record.updatedAt = new Date().toISOString();
}
export function withSource(record, kind, parsed, name) {
  const next = validateRecord(record);
  if (!['main', 'prelab'].includes(kind)) throw new Error('Unknown source type.');
  if (next.sources[kind]) next.needsReview = true;
  next.sources[kind] = { name };
  next.identityConfirmed = false;
  if (kind === 'prelab' && !record.sources.prelab) {
    if (!next.fields.name.trim()) next.fields.name = parsed.student.name;
    if (!next.fields.studentId.trim()) next.fields.studentId = parsed.student.id;
  }
  next.updatedAt = new Date().toISOString();
  return validateRecord(next);
}
export function missingWork(record) {
  const missing = [];
  if (!record.sources.main) missing.push('Load your group main-lab ZIP.');
  if (!record.sources.prelab) missing.push('Load your own pre-lab ZIP.');
  if (!record.identityConfirmed) missing.push('Confirm your name and the two source files.');
  if (record.needsReview) missing.push('Review your answers after replacing a source file.');
  for (const [key, label] of Object.entries(LABELS)) if (key !== 'studentId' && !record.fields[key].trim()) missing.push(label);
  return missing;
}
export function filename(record) {
  return `noise_filtering_post_lab_${(record.fields.studentId || record.fields.name || 'unfinished').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)}`;
}
