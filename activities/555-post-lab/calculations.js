// Student answers only: never calculate or populate an expected answer here.
export const CALCULATION_KEYS = {
  A0: ['high', 'low', 'period', 'frequency', 'duty'],
  A1: [
    'high',
    'low',
    'period',
    'frequency',
    'duty',
    'highLowRatio',
    'frequencyRatio',
  ],
  M0: ['pulse'],
};
export const DISCUSSION_KEYS = [
  'paths',
  'conversion',
  'timing',
  'uncertainty',
  'verification',
  'conclusionA',
  'conclusionM',
  'improvement',
];
export function createCalculations() {
  return {
    A0: {
      high: '',
      low: '',
      period: '',
      frequency: '',
      duty: '',
      explanation: '',
    },
    A1: {
      high: '',
      low: '',
      period: '',
      frequency: '',
      duty: '',
      highLowRatio: '',
      frequencyRatio: '',
      explanation: '',
    },
    M0: { pulse: '', explanation: '' },
  };
}
export function numericAnswerIssue(text) {
  if (!text.trim()) return '';
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text.trim()) &&
    Number.isFinite(Number(text))
    ? ''
    : 'Enter a finite number without units. This draft entry is still saved.';
}
export function hasIndividualWriting(record) {
  return [
    ...Object.values(record.analysis),
    ...Object.values(record.optional),
    ...Object.values(record.calculations).flatMap((lab) => Object.values(lab)),
  ].some((value) => value.trim());
}
export function answerProgress(record) {
  const values = [
    ...DISCUSSION_KEYS.map((key) => record.analysis[key]),
    ...Object.values(record.calculations).flatMap((lab) => Object.values(lab)),
  ];
  return {
    started: values.filter((value) => value.trim()).length,
    total: values.length,
  };
}
export function updateIndividualField(record, path, value) {
  if (typeof value !== 'string' || value.length > 4000) return false;
  const keys = path.split('.');
  if (
    keys.length === 2 &&
    ((keys[0] === 'analysis' && DISCUSSION_KEYS.includes(keys[1])) ||
      (keys[0] === 'optional' && Object.hasOwn(record.optional, keys[1])))
  ) {
    record[keys[0]][keys[1]] = value;
    return true;
  }
  if (
    keys.length === 3 &&
    keys[0] === 'calculations' &&
    Object.hasOwn(CALCULATION_KEYS, keys[1]) &&
    [...CALCULATION_KEYS[keys[1]], 'explanation'].includes(keys[2])
  ) {
    record.calculations[keys[1]][keys[2]] = value;
    return true;
  }
  return false;
}
