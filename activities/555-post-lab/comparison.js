import { esc, paper, definitionList } from '../555-main-lab/views.js';
import {
  createRecord,
  number,
  designReference,
} from '../555-main-lab/model.js';
import { CALCULATION_KEYS, numericAnswerIssue } from './calculations.js';
import { LAB1_TIMING_TARGETS } from '../555-main-lab/scientific.js';

const quantities = {
  high: ['HIGH time t_H', 's'],
  low: ['LOW time t_L', 's'],
  period: ['Period T', 's'],
  frequency: ['Frequency f', 'Hz'],
  duty: ['Duty cycle D_H', '%'],
  pulse: ['Pulse duration t_W', 's'],
};
const labNames = {
  A0: 'Lab 1 · Astable',
  A1: 'Lab 2 · Modified astable',
  M0: 'Lab 3 · Monostable',
};
const notation = (text) =>
  text.replace(/([tDf])_(Lab[12]|[HLW])/g, '<var>$1<sub>$2</sub></var>');
const value = (text, unit = '') =>
  number(text) === null
    ? 'Not recorded'
    : `${esc(text)}${unit ? ` ${unit}` : ''}`;
function answer(record, id, key, label, unit, unavailable, print) {
  const text = record.calculations[id][key],
    issue = numericAnswerIssue(text);
  if (print)
    return `<span class="student-answer">${text.trim() ? esc(text) : 'Not entered'}${text.trim() && unit ? ` ${unit}` : ''}</span>${issue ? '<p class="small">Unfinished numeric entry</p>' : ''}${unavailable ? `<p class="small missing">${esc(unavailable)}</p>` : ''}`;
  const fieldId = `answer-${id}-${key}`;
  return `<label class="sr-only" for="${fieldId}">${labNames[id]}: ${label}${unit ? ` (${unit})` : ''}</label><div class="numeric-answer"><input id="${fieldId}" type="text" inputmode="decimal" maxlength="4000" data-field="calculations.${id}.${key}" data-calculation-answer aria-invalid="${!!issue}" aria-describedby="${fieldId}-error${unavailable ? ` ${fieldId}-missing` : ''}" value="${esc(text)}">${unit ? `<span>${unit}</span>` : ''}</div><p id="${fieldId}-error" class="small missing" aria-live="polite" ${issue ? '' : 'hidden'}>${issue}</p>${unavailable ? `<p id="${fieldId}-missing" class="small missing">${esc(unavailable)} Leave blank and explain if unavailable.</p>` : ''}`;
}
function missing(predicted, measured, divide = true) {
  if (number(predicted) === null || number(measured) === null)
    return 'Calculation unavailable: a reference value is not recorded.';
  if (divide && number(predicted) === 0)
    return 'Calculation unavailable: the denominator is zero.';
  return '';
}
function targets(main, id) {
  if (id === 'A0') return `Targets: ${LAB1_TIMING_TARGETS.frequencyMin} ≤ f ≤ ${LAB1_TIMING_TARGETS.frequencyMax} Hz; approximately equal HIGH and LOW times, t_H ≈ t_L. Aim for 50% HIGH duty cycle; accepted measured range: ${LAB1_TIMING_TARGETS.dutyMin}–${LAB1_TIMING_TARGETS.dutyMax}%.`;
  if (id === 'M0')
    return 'Targets: 0.55 ≤ t_W ≤ 0.95 s; one pulse per brief button press. Check output voltage levels and switch response.';
  const frozen = designReference(main, 'A1').frequency,
    current = main.configs.A0.measurement.frequency;
  return `Targets: 1.8 ≤ t_H/t_L ≤ 2.2; frequency within 80–120% of the Lab 1 reference. Lab 2 saved reference: ${value(frozen, 'Hz')}.${number(frozen) !== number(current) ? ` This differs from the current imported Lab 1 frequency: ${value(current, 'Hz')}. Use the current imported measurements for the frequency ratio below.` : ''}`;
}
export function comparisonSection(record, print = false) {
  const main = record.sources.main || createRecord();
  const panels = Object.entries(CALCULATION_KEYS)
    .map(([id, keys]) => {
      const config = main.configs[id];
      const rows = keys
        .filter((key) => quantities[key])
        .map((key) => {
          const [label, unit] = quantities[key],
            p = config.prediction[key],
            m = config.measurement[key];
          return `<tr><th scope="row">${notation(label)}</th><td data-label="Predicted">${value(p, unit)}</td><td data-label="Measured">${value(m, unit)}</td><td data-label="Your calculated difference">${answer(record, id, key, `${label} difference`, key === 'duty' ? 'pp' : '%', missing(p, m, key !== 'duty'), print)}</td></tr>`;
        })
        .join('');
      const ratios =
        id === 'A1'
          ? `<div class="calculation-ratios">${[
              [
                'highLowRatio',
                'Measured t_H/t_L',
                config.measurement.high,
                config.measurement.low,
              ],
              [
                'frequencyRatio',
                'Measured f_Lab2/f_Lab1',
                config.measurement.frequency,
                main.configs.A0.measurement.frequency,
              ],
            ]
              .map(
                ([key, label, numerator, denominator]) =>
                  `<div><h4>${notation(label)}</h4>${answer(record, id, key, label, '', missing(denominator, numerator), print)}</div>`,
              )
              .join('')}</div>`
          : '';
      const explanation = record.calculations[id].explanation;
      return `<section class="calculation-panel"><h3>${labNames[id]}</h3><p class="calculation-target">${notation(targets(main, id))}</p><table class="calculation-table"><thead><tr><th>Quantity</th><th>Predicted</th><th>Measured</th><th>Your calculated difference</th></tr></thead><tbody>${rows}</tbody></table>${ratios}<div class="calculation-explanation">${print ? `<h4>Briefly explain whether this lab met its objectives, using your results.</h4><p class="prewrap">${esc(explanation.trim() ? explanation : 'Not entered')}</p>` : `<label for="explanation-${id}">Briefly explain whether this lab met its objectives, using your results.</label><p class="small muted" id="explanation-${id}-hint">One or two sentences.</p><textarea id="explanation-${id}" rows="3" maxlength="4000" aria-describedby="explanation-${id}-hint" data-field="calculations.${id}.explanation">${esc(explanation)}</textarea>`}</div></section>`;
    })
    .join('');
  return paper(
    '1 · Compare predicted values and measured results',
    `<p>Calculate on paper or with a calculator. Enter only your final answers below, then briefly explain the results for each lab.</p><p class="small muted">References are the imported main-lab predictions and measurements for the same physical circuit, not hypothetical pre-lab scenarios. Shared voltage targets: supply 5 V; output HIGH ≥ 3.0 V and ≤ supply; output LOW ≤ 0.5 V.</p>${panels}${print ? '' : legacyComparison(record)}`,
  );
}
export function legacyComparison(record, print = false) {
  const legacy = {
    workings: record.analysis.workings,
    comparison: record.analysis.comparison,
  };
  if (!Object.values(legacy).some((text) => text.trim())) return '';
  const content =
    '<p>Preserved from an earlier individual worksheet. These answers have not been converted into numeric entries.</p>' +
    definitionList(legacy, {
      workings: 'Earlier calculation working',
      comparison: 'Earlier comparison explanation',
    });
  return print
    ? paper(
        'Earlier individual comparison writing · recovery appendix',
        content,
      )
    : `<details class="reference legacy-comparison"><summary>Earlier individual comparison writing (recovery)</summary>${content}</details>`;
}
