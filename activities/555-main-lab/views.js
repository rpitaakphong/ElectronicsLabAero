import {
  SCREENS,
  SAFETY,
  PREDICTION_FIELDS,
  MEASUREMENT_FIELDS,
  number,
  comparisonRows,
  progress,
  MAX_TEXT_LENGTH,
  REQUIRED_IDS,
  REQUIRED_CAPTURES,
  resistance,
  designIssues,
  designReference,
  designForEntry,
  TASKS,
  taskLabel,
  groupStudents,
  identityIssues,
} from './model.js';
import { n, v, op, row, frac, unit, math, valueLine, range, timingEquations, analysisEquations } from './scientific.js';
import { astableSchematic, dip8PinGuide, conversionSchematic, monostableWaveforms } from './diagrams.js';

export const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
const get = (record, path) =>
  path.split('.').reduce((obj, key) => obj[key], record);
const valueText = (value) =>
  String(value).trim()
    ? esc(value)
    : '<span class="missing">Not recorded</span>';
const fmt = (value) =>
  !Number.isFinite(value) ? '—' : Number(value.toPrecision(4)).toString();
export const field = (record, path, label, options = {}) => {
  const {
    area = false,
    unit = '',
    hint = '',
    numeric = false,
    positive = false,
    disabled = false,
    value = get(record, path),
    maxLength = MAX_TEXT_LENGTH,
  } = options;
  const id = `field-${path.replaceAll('.', '-')}`;
  const attributes = `id="${id}" data-field="${path}" ${numeric ? 'inputmode="decimal" data-numeric="true"' : ''} ${positive ? 'data-positive="true"' : ''} ${disabled ? 'disabled' : ''} maxlength="${maxLength}" ${hint ? `aria-describedby="${id}-hint"` : ''}`;
  return `<div class="field"><label for="${id}">${label}${unit ? ` <span class="unit">(${unit})</span>` : ''}</label>${area ? `<textarea ${attributes} rows="3">${esc(value)}</textarea>` : `<input ${attributes} type="text" value="${esc(value)}" autocomplete="off">`}${hint ? `<small id="${id}-hint">${hint}</small>` : ''}</div>`;
};
const check = (record, path, label) =>
  `<label class="check"><input type="checkbox" data-field="${path}" ${get(record, path) ? 'checked' : ''}><span>${label}</span></label>`;
export const box = (title, text, type = '') =>
  `<div class="callout ${type}"><strong>${title}</strong><p>${text}</p></div>`;
export const paper = (title, content, subtitle = '') =>
  `<section class="paper"><div class="section-heading"><h2>${title}</h2>${subtitle ? `<span class="chip">${subtitle}</span>` : ''}</div>${content}</section>`;
const fields = (content) => `<div class="fields">${content}</div>`;
const timingKeys = (id) =>
  id.startsWith('A')
    ? ['high', 'low', 'period', 'frequency', 'duty']
    : ['pulse'];
const quantityLabel = (key, label) => key === 'pulse' ? 'Output pulse duration <var>t<sub>W</sub></var>' : label;
const measurementLabel = (id, key) => key === 'capLow'
  ? id.startsWith('A') ? 'Capacitor voltage just before the output changes HIGH' : 'Capacitor voltage before pressing the switch'
  : MEASUREMENT_FIELDS[key][0];
export function designSummary(id, d, keys = ['r1', 'r2', 'capacitor']) {
  const res = (prefix, sub) => {
    const total = resistance(d, prefix);
    return math(row(v('R', sub), op('='), total === null ? '<mtext>not selected</mtext>' : row(d[`${prefix}b`] ? row(op('('), n(d[`${prefix}a`]), op('+'), n(d[`${prefix}b`]), op(')'), unit('kΩ'), op('=')) : '', n(Number(total.toPrecision(6))), unit('kΩ'))), `Selected timing resistance ${sub || ''}`);
  };
  return `<div class="parameter-grid">${keys.includes('r1') ? res('r1', id.startsWith('A') ? '1' : '') : ''}${id.startsWith('A') && keys.includes('r2') ? res('r2', '2') : ''}${keys.includes('capacitor') ? d.capacitor ? valueLine('C', '', d.capacitor, 'µF') : math(row(v('C'), op('='), '<mtext>not selected</mtext>'), 'Timing capacitor not selected') : ''}</div>`;
}
export function designStatus(id, d) {
  const issues = designIssues(id, d).map((issue) => id === 'A1' && issue === 'Enter a timing capacitance greater than zero, in µF.' ? 'Record the timing capacitor in Lab 1; Lab 2 must use that same capacitor.' : issue);
  return `<p class="design-status ${issues.length ? 'muted' : 'ready'}">${issues.length ? esc(issues.join(' ')) : 'Timing values entered. Check component suitability and your predicted output against the lab requirements.'}</p>`;
}
export function designFeedback(id, d) {
  return (id.startsWith('A') ? '' : designSummary(id, d)) + designStatus(id, d);
}
function targetExpressions(record, id) {
  if (id === 'A0') return range('0.8', 'f', '', '1.3', 'Hz');
  if (id === 'M0') return range('0.55', 't', 'W', '0.95', 's');
  const base = number(designReference(record, id).frequency);
  return '<h3>Make the HIGH time about twice the LOW time</h3><p>The HIGH time (<var>t<sub>H</sub></var>) is how long the output stays HIGH in one cycle. The LOW time (<var>t<sub>L</sub></var>) is how long it stays LOW. Divide the HIGH time by the LOW time: the result must be between 1.8 and 2.2, close to a ratio of 2.</p>'
    + math(row(n('1.8'), op('≤'), frac(v('t', 'H'), v('t', 'L')), op('≤'), n('2.2')), 'HIGH to LOW time ratio from 1.8 to 2.2')
    + '<h3>Keep the frequency close to Lab 1</h3><p>The Lab 2 output frequency must stay within ±20% of the frequency you measured in Lab 1. That means 80% to 120% of your Lab 1 reading.</p>'
    + (base !== null && base > 0
      ? range(fmt(base * .8), 'f', 'Lab 2', fmt(base * 1.2), 'Hz')
      : '<p class="small muted">Your numerical frequency limits will appear here after you enter the Lab 1 measurement.</p>');
}
function astableSignalIllustration() {
  return `<figure class="signal-illustration"><h3>Intended output signal</h3><svg viewBox="0 0 480 150" role="img" aria-label="Illustration of the intended 555 astable output: repeating HIGH and LOW pulses over time. One cycle contains one HIGH interval and one LOW interval. No specific duty cycle or voltage level is prescribed."><g fill="none" stroke="#c8d9d6" stroke-width="1.5"><path d="M62 30V116H470"/><path d="M62 42H470M62 96H470" stroke-dasharray="3 5"/></g><path d="M72 96V42H144V96H192V42H264V96H312V42H384V96H432V42H468" fill="none" stroke="#087f85" stroke-width="2.5" stroke-linejoin="round"/><path d="M72 25V20H192V25" fill="none" stroke="#59717a" stroke-width="1.5"/><g fill="#365861" font-family="system-ui,sans-serif" font-size="16"><text x="8" y="47">HIGH</text><text x="8" y="101">LOW</text><text x="132" y="14" text-anchor="middle">One cycle</text><text x="468" y="141" text-anchor="end">Time →</text></g></svg><figcaption>Illustration only, not to scale. The HIGH and LOW times need not be equal; calculate them for your selected components.</figcaption></figure>`;
}
function objectiveDeliverables(id) {
  const symbols = { high: '<var>t<sub>H</sub></var>', low: '<var>t<sub>L</sub></var>', period: '<var>T</var>', frequency: '<var>f</var>', duty: '<var>D<sub>H</sub></var>', pulse: '<var>t<sub>W</sub></var>' };
  const labels = { high: 'HIGH time', low: 'LOW time', period: 'Period', frequency: 'Frequency', duty: 'Duty cycle', pulse: 'Pulse duration' };
  const timing = timingKeys(id).map((key) => `${labels[key]} ${symbols[key]}`).join('; ');
  const screenshot = {
    A0: 'Output and timing-capacitor voltage over two steady cycles. Show <var>f</var> or <var>T</var> (Screenshot 1).',
    A1: 'Modified output and timing-capacitor voltage over two steady cycles. Show <var>t<sub>H</sub></var> (Screenshot 2).',
    M0: 'Brief trigger input and complete output pulse, including its return LOW. Show <var>t<sub>W</sub></var> (Screenshot 3).',
  }[id];
  const mono = id === 'M0';
  const voltages = mono
    ? 'Supply; output HIGH/LOW; trigger HIGH/LOW (V).'
    : 'Supply; output HIGH/LOW; capacitor just before both output transitions (V).';
  const components = mono ? 'Measured <var>R</var> (kΩ)' : 'Measured total <var>R<sub>1</sub></var> and <var>R<sub>2</sub></var> (kΩ)';
  return `<div class="objective-deliverables" data-lab-deliverables="${id}"><h3>Key deliverable</h3><ul>
    <li><strong>Screenshot:</strong> ${screenshot}</li>
    <li><strong>Timing readings:</strong> ${timing}${mono ? '; trigger LOW duration; time between presses (not the output period)' : ''}.</li>
    <li><strong>Voltage readings:</strong> ${voltages}</li>
    <li><strong>Component readings:</strong> ${components}; <var>C</var> (µF), if measurable. Do not use marked values as measurements.</li>
    </ul><p>Use readable scales and timing readouts or cursors. Enter readings and method below; explain any missing readings. Choose your image, then click Upload to attach it locally.</p><p>Submit the report and <strong>one screenshot per lab (three total)</strong>. JSON is a backup; Download lab files (ZIP) includes that backup and your images.</p></div>`;
}
function goalPanel(record, id) {
  const ref = designReference(record, id);
  const title = 'Lab Objective';
  const note = id === 'A0' ? '<p>The main objective of this lab task is to design a repeating pulse signal using a 555 timer in its astable configuration. The generated signal must have a frequency within the following range:</p>' : id === 'M0' ? '<p>The objective of Lab 3 is to convert your 555 astable circuit into a monostable circuit. In simple words, design a circuit that produces one HIGH output pulse when you press a button, instead of oscillating continuously. Use a normally-open momentary pushbutton: press and release it briefly. The output stays LOW between pulses.</p><p>Your output pulse must meet this requirement:</p>' : '<p>The objective of Lab 2 is to modify your Lab 1 astable circuit to meet both timing requirements below. Change either or both timing resistances, R1 and R2, but keep the same physical timing capacitor used in Lab 1.</p>';
  const description = id === 'A0' ? '<p>Your job is to select a suitable combination of timing resistors and a timing capacitor yourself. Use the astable circuit connections shown below, calculate the expected output, then build and measure the circuit to check whether it meets this requirement.</p>' : id === 'M0' ? '<p>Choose a timing resistance R and timing capacitor C yourself. Predict the pulse duration and save your initial design before building. The pulse duration (<var>t<sub>W</sub></var>) runs from the output’s rising edge to its falling edge, not for as long as you hold the button.</p><p>Wire with the power off. Check the connections before switching on to test.</p>' : '';
  const illustration = id === 'A0' ? astableSignalIllustration() : id === 'M0' ? waveformGuide() : '';
  const reference = id === 'A1' ? `<div class="goal-reference"><strong>Measured frequency from Lab 1</strong>${number(ref.frequency) > 0 ? valueLine('f', 'Lab 1, meas', ref.frequency, 'Hz') : '<p>No Lab 1 frequency has been entered yet.</p>'}<p>Enter this reading on the Lab 1 page, under <strong>Measured results → Frequency (Hz)</strong>. Save the Lab 1 initial design and predictions first to enable its measurement fields.</p><button data-go-task1-frequency>Go to Lab 1 measured frequency</button><small>${record.configs.A1.original ? 'The frequency limits and capacitor reference were fixed when you saved the initial Lab 2 design. Later Lab 1 corrections do not change them.' : 'Saving the initial Lab 2 design will keep a copy of this frequency and the Lab 1 timing-capacitor value, so later Lab 1 corrections will not change your original Lab 2 requirements.'}</small></div>` : '';
  return `<section class="goal-panel" aria-label="${taskLabel(id)} ${title.toLowerCase()}"><div class="goal-header"><span class="goal-id" aria-hidden="true">${TASKS[id].number}</span><h2>${title}</h2></div><div class="goal-body">${note}${targetExpressions(record, id)}${description}${objectiveDeliverables(id)}${illustration}${reference}</div></section>`;
}
function voltageGoals() {
  return `<section class="voltage-goals"><h3>Supply voltage and output-voltage specifications</h3><div class="parameter-grid">${valueLine('V', 'CC', '5', 'V')}${math(row(n('3.0'), unit('V'), op('≤'), v('V', 'OH'), op('≤'), v('V', 'CC')), 'HIGH output at least 3.0 volts and not above supply')}${math(row(v('V', 'OL'), op('≤'), n('0.5'), unit('V')), 'LOW output no more than 0.5 volts')}</div><p>Measure the voltage on the flat part of each HIGH and LOW interval. Use high-impedance oscilloscope inputs and disconnect LEDs, buzzers, and other loads. The timing resistors and capacitor control the timing of the output signal. They do not set the output-voltage levels. Record any output voltage outside the specified limits.</p></section>`;
}
function kit() {
  return `<p>Check that your group has an NE555 timer, breadboard, regulated power supply, oscilloscope, digital multimeter (DMM), and normally-open momentary switch. You may use a function generator or the simulator for additional checks, but neither is required.</p><h3>Choose your timing components</h3><p>Select timing resistance and capacitance values to meet the lab requirements. This worksheet has no prescribed timing-value list or component-quantity limit. If you combine components, enter the equivalent timing value and identify the parts in your explanation. Check their ratings and polarity: a positive numerical value does not establish electrical suitability.</p><h3>Supply capacitor and Lab 3 pull-up</h3><p>Use a 100 nF supply capacitor between VCC and GND, close to the IC, to reduce supply noise. Lab 3 also needs a 10 kΩ pull-up for its pushbutton trigger. Leave pin 5 CONT open; no control capacitor is used. Select the timing resistors and timing capacitor separately for each design.</p><div class="parameter-grid">${valueLine('R', 'pull-up', '10', 'kΩ')}${valueLine('C', 'supply', '100', 'nF')}</div>`;
}

export const schematic = astableSchematic;
export const pinGuide = dip8PinGuide;
function diagram(svg, title, kind) {
  return `<figure class="diagram${kind === 'pins' ? ' diagram-pins' : kind === 'monostable' ? ' diagram-monostable' : ''}"><div class="diagram-scroll" tabindex="0" role="region" aria-label="${title}">${svg}</div><figcaption>${title}<button class="small" data-expand="${kind}">Enlarge diagram</button></figcaption></figure>`;
}
function visualFigure(svg, title, kind, caption) {
  return `<figure class="lab-visual"><h3>${title}</h3><div class="diagram-scroll" tabindex="0" role="region" aria-label="${title}">${svg}</div><figcaption>${caption}</figcaption><button class="small" data-expand="${kind}">Enlarge ${title.toLowerCase()}</button></figure>`;
}
function waveformGuide() {
  return visualFigure(monostableWaveforms(), 'Example oscilloscope signals', 'monostable-waveforms', 'Illustration only, not measured data or a prescribed scale. TRIG returns HIGH before OUT falls. Measure t<sub>W</sub> at the output’s mid-level crossings. The traces are vertically offset for clarity.');
}
function monostableCircuitGuide() {
  const compare = (mode, title, caption) => `<figure class="conversion-card"><h3>${title}</h3><div class="diagram-scroll" tabindex="0" role="region" aria-label="${title} timing connections">${conversionSchematic(mode)}</div><figcaption>${caption}</figcaption><button class="small" data-expand="conversion-${mode}">Enlarge ${mode} comparison</button></figure>`;
  return paper('Circuit Schematic - Transforming Astable Circuit to Monostable Circuit', '<p>Rewire with the power off and the timing capacitor discharged. Orange dashed highlights show what to remove; teal highlights show what to add. Both diagrams use the DIP-8 top view, with the notch at the top. Matching power and ground labels are connected.</p>'
      + `<div class="conversion-grid">${compare('astable', 'Before · Astable', 'Repeats by itself. Highlight 1 is the shared trigger connection; highlight 2 is R2.')}${compare('monostable', 'After · Monostable', 'Waits for a brief button press. The timing node uses pins 6/7; pin 2 receives the separate switch trigger.')}</div>`
      + '<ol class="conversion-steps"><li><strong>Separate pin 2</strong> from the timing node.</li><li><strong>Replace R2 with a wire.</strong> Pins 6/7 now share the capacitor node. Select R and C for your pulse duration.</li><li><strong>Add the button and 10 kΩ pull-up</strong> at pin 2. S1 is normally open.</li></ol>'
      + '<p class="small muted">Reference: <a href="https://www.ti.com/lit/ds/symlink/ne555.pdf#page=11" target="_blank" rel="noopener">TI NE555 datasheet, Figures 6-2 and 6-3</a>.</p>');
}
function fixedCapacitor(record) {
  const config = record.configs.A1, ref = designReference(record, 'A1');
  const previous = config.design.capacitor;
  const mismatch = previous && previous !== ref.capacitor;
  return `<div class="callout" data-fixed-capacitor><strong>Timing capacitor C — unchanged from Lab 1</strong><p>Keep the same physical timing capacitor that you used in Lab 1.</p>${ref.capacitor ? valueLine('C', 'Lab 1', ref.capacitor, 'µF') : '<p>First record your timing capacitor in Lab 1 → Selected components.</p>'}<small>${config.original ? 'This required value was saved with your initial Lab 2 design.' : 'The value shown here is carried over automatically when you save your initial Lab 2 design.'}</small>${mismatch ? `<div class="callout warning"><strong>Earlier capacitor entry retained</strong>${valueLine('C', 'previously recorded', previous, 'µF')}<p>${config.original ? 'Your saved answers have not been changed. This recorded value differs from the required capacitor above. Keep the Lab 1 capacitor in the circuit and explain any earlier component changes in your component-choice explanation.' : 'This earlier draft entry is still kept in your backup. Saving the initial Lab 2 design will replace it with the Lab 1 capacitor shown above. Check your predicted values for that capacitor before saving.'}</p></div>` : ''}</div>`;
}
function designFields(record, id) {
  const d = designForEntry(record, id);
  const totalValue = (prefix) => d[`${prefix}b`].trim() && resistance(d, prefix) !== null ? fmt(resistance(d, prefix)) : d[`${prefix}a`];
  const total = (prefix, label) => field(record, `configs.${id}.design.${prefix}a`, label, { unit: 'kΩ', numeric: true, positive: true, value: totalValue(prefix) });
  const rationale = id === 'A0'
    ? 'State the output frequency you are aiming for. Explain why you chose R1, R2, and C, and how those values should give the intended HIGH and LOW times. If you combine components, identify the parts and their equivalent value. Explain your choices in words; calculation steps are not required.'
    : id === 'A1'
      ? 'Explain which resistance values you changed from Lab 1 and why. Describe how your choices should change the HIGH and LOW times while keeping the frequency within the allowed limits and the capacitor unchanged. Identify any combined components; calculation steps are not required.'
      : 'State the output pulse duration you are aiming for. Explain why you chose the timing resistance and capacitor, and how they should produce that pulse duration. Identify any combined components. Explain your choices in words; calculation steps are not required.';
  const capacitor = id === 'A1' ? fixedCapacitor(record) : field(record, `configs.${id}.design.capacitor`, 'Timing capacitor C', { unit: 'µF', numeric: true, positive: true, hint: 'Enter the timing capacitance you selected, in µF. Choose a value suitable for your design and check its rating and polarity.' });
  let content = `<div class="design-feedback" data-design-feedback="${id}" aria-live="polite">${designFeedback(id, d)}</div><p>Enter the total resistance you intend to use for each timing resistance, in kΩ. If you combine components, enter their equivalent value and identify the parts in your explanation below.</p>${fields(total('r1', id.startsWith('A') ? 'Total timing resistance R1' : 'Total timing resistance R') + (id.startsWith('A') ? total('r2', 'Total timing resistance R2') : ''))}${capacitor}${field(record, `configs.${id}.design.rationale`, 'Explain why you chose these component values', { area: true, hint: rationale })}`;
  content += `<details class="reference"><summary>Component measurements and tolerances</summary><p>Measure resistance before fitting the components, with the supply switched off. If your DMM can measure capacitance, record that reading too. Leave a measured value blank if you cannot obtain it and explain why below. Do not enter the component’s marked value as though you measured it.</p>${fields(field(record, `configs.${id}.design.measuredR1`, id.startsWith('A') ? 'Measured total R1' : 'Measured timing resistance R', { unit: 'kΩ', numeric: true }) + (id.startsWith('A') ? field(record, `configs.${id}.design.measuredR2`, 'Measured total R2', { unit: 'kΩ', numeric: true }) : '') + field(record, `configs.${id}.design.measuredC`, 'Measured capacitance C, if available', { unit: 'µF', numeric: true }))}${field(record, `configs.${id}.design.tolerance`, 'Component tolerances and any values you could not measure', { area: true, hint: 'Record the tolerance printed on the component or given in its documentation. State which values are unknown.' })}</details>`;
  return content;
}
function predictionPanel(record, id, showEquations = true) {
  const c = record.configs[id];
  const original = c.original;
  return paper(
    'Component values and predictions',
    `${showEquations ? timingEquations(id.startsWith('A')) : ''}<h3>Selected components</h3>${designFields(record, id)}<h3>Predicted Values</h3><p>Enter your predicted times in seconds. Save this design and its predicted values before entering the measured results below.</p>${fields(
      timingKeys(id)
        .map((key) =>
          field(
            record,
            `configs.${id}.prediction.${key}`,
            quantityLabel(key, PREDICTION_FIELDS[key][0]),
            { unit: PREDICTION_FIELDS[key][1], numeric: true },
          ),
        )
        .join(''),
    )}${original ? `${box('Initial design and predictions saved', 'If you change components after testing, explain which component values were used for the measurements and screenshots. You can view your initial design below.', 'success')}<details><summary>View your original design and predictions</summary>${predictionSummary(id, original)}</details>` : `<p class="small muted">Save your initial design and predicted values before building and measuring.</p><button class="primary" data-preserve="${id}" aria-label="Save initial design and predictions for ${taskLabel(id)}">Save initial design and predictions</button>`}`,
    original ? 'Initial version saved' : 'Before building',
  );
}
function evidenceFields(record, id, label) {
  return `<section class="evidence" data-attachment="${id}"><h3>${label}</h3><p class="small">Choose file → Upload. PNG, JPEG, BMP or WebP; up to 10 MiB. Images stay in this browser, not on a server.</p><label for="image-${id}">Choose screenshot file</label><div class="attachment-controls"><input id="image-${id}" type="file" data-image-file="${id}" accept="image/png,image/jpeg,image/bmp,image/webp,.png,.jpg,.jpeg,.bmp,.webp"><button data-upload="${id}" disabled>Upload</button><button data-remove-image="${id}" hidden>Remove</button></div><p class="image-status small" role="status">Image not attached${record.evidence[id].filename ? ` · Previously recorded: ${esc(record.evidence[id].filename)}` : ''}</p><div class="image-preview"></div></section>`;
}
function measurementPanel(record, id) {
  const mono = id.startsWith('M'),
    disabled = !record.configs[id].original;
  const keys = [
    ...timingKeys(id),
    'supply',
    'outHigh',
    'outLow',
    ...(!mono ? ['capHigh', 'capLow'] : []),
    ...(mono
      ? ['triggerHigh', 'triggerLow', 'triggerWidth', 'triggerPeriod']
      : []),
  ];
  return paper(
    'Measured results',
    `${disabled ? box('Save your predictions before entering measurements', 'Save your initial design and predictions in the section above. You can then enter measurements here without leaving this page.', 'warning') : '<p>Enter the readings you obtained from your breadboard circuit. If you could not obtain a reading, leave it blank and describe the problem below.</p>'}<fieldset ${disabled ? 'disabled' : ''}><legend class="sr-only">${taskLabel(id)} measured results</legend>${fields(keys.map((key) => field(record, `configs.${id}.measurement.${key}`, quantityLabel(key, measurementLabel(id, key)), { unit: MEASUREMENT_FIELDS[key][1], numeric: true })).join(''))}${field(record, `configs.${id}.measurement.method`, 'Describe how you measured the timing values', { area: true, hint: mono ? 'Measure t_W on the output waveform, between the rising and falling edges at mid-level. State whether you used cursors or an automatic pulse-width measurement.' : 'Look at the repeating output on CH1 (OUT). Measure HIGH time from a rising edge to the next falling edge, LOW time from that falling edge to the next rising edge, and period between two consecutive rising edges. Use the points halfway between the LOW and HIGH voltage levels. State whether you used time cursors or automatic measurements and which edges you compared.' })}${field(record, `configs.${id}.measurement.notes`, 'Unexpected results or measurements you could not obtain (if any)', { area: true, hint: 'Leave this blank if there were no problems. Otherwise, describe what happened and any checks you tried.' })}</fieldset><h3>Oscilloscope screenshots</h3>${id === 'M0' ? evidenceFields(record, 'M0trigger', 'Screenshot 3 · Trigger and output') : evidenceFields(record, id, `Screenshot ${id === 'A0' ? '1' : '2'} · ${mono ? 'Trigger and output' : 'Output and capacitor voltage'}`)}`,
    'Breadboard measurements',
  );
}
export function comparison(record) {
  const rows = comparisonRows(record);
  const a = number(record.configs.A0.measurement.frequency),
    b = number(record.configs.A1.measurement.frequency);
  return `<p>This table compares the predicted values and measured results you entered. A dash indicates that a value is missing or cannot be calculated. Duty-cycle differences are shown in percentage points (pp).</p><div class="table-scroll" tabindex="0" role="region" aria-label="Predicted values compared with measured results"><table><thead><tr><th>Circuit and quantity</th><th>Predicted values</th><th>Measured results</th><th>Difference</th></tr></thead><tbody>${rows.map((row) => `<tr><th scope="row">${taskLabel(row.id)} · ${quantityLabel(row.key, PREDICTION_FIELDS[row.key][0])} (${PREDICTION_FIELDS[row.key][1]})</th><td>${fmt(row.predicted)}</td><td>${fmt(row.measured)}</td><td>${fmt(row.difference)}${row.difference === null ? '' : row.key === 'duty' ? ' pp' : ' %'}</td></tr>`).join('')}</tbody></table></div>${math(row(v('k', 'frequency'), op('='), a !== null && a > 0 && b !== null && Number.isFinite(b / a) ? n(fmt(b / a)) : '<mtext>not available</mtext>'), 'Ratio of the measured Lab 2 frequency to the measured Lab 1 frequency')}`;
}
export function chart(record, ids, keys, title) {
  const groups = ids.flatMap((id) =>
    keys.map((key) => ({
      id,
      key,
      label: `${taskLabel(id)} ${key === 'pulse' ? 'pulse' : key === 'high' ? 'HIGH' : 'LOW'}`,
      p: number(record.configs[id].prediction[key]),
      m: number(record.configs[id].measurement[key]),
    })),
  );
  const values = groups.flatMap((g) => [g.p, g.m]).filter((n) => n !== null);
  if (!values.length)
    return `<p class="empty-chart">Enter predicted or measured times to display the ${title.toLowerCase()}. Missing values will not be shown as zero.</p>`;
  const peak = Math.max(...values, 0.001),
    max = Number.isFinite(peak * 1.15) ? peak * 1.15 : peak,
    step = 660 / groups.length;
  return `<figure class="chart"><svg viewBox="0 0 800 350" role="img" aria-label="${title}. Predicted values are teal and measured results are orange. All times are in seconds. Read the table for the numerical values."><g font-family="system-ui,sans-serif" fill="currentColor" font-size="14"><text x="70" y="25">${title} · s</text><path d="M70 50V270H755" fill="none" stroke="currentColor"/>${[0, 0.5, 1].map((t) => `<path d="M70 ${270 - 210 * t}H755" stroke="#dbe6e5"/><text x="60" y="${275 - 210 * t}" text-anchor="end">${fmt(t * max)}</text>`).join('')}${groups
    .map((g, i) => {
      const x = 95 + i * step,
        w = Math.min(38, step * 0.23);
      return (
        ['p', 'm']
          .map((key, j) => {
            const n = g[key],
              bx = x + j * (w + 8);
            return n === null
              ? `<text x="${bx + w / 2}" y="255" text-anchor="middle">—</text>`
              : `<rect x="${bx}" y="${270 - (n / max) * 210}" width="${w}" height="${(n / max) * 210}" rx="3" fill="${j ? '#b65b24' : '#087f85'}"/><text x="${bx + w / 2}" y="${Math.max(43, 261 - (n / max) * 210)}" text-anchor="middle" font-size="12">${fmt(n)}</text>`;
          })
          .join('') +
        `<text x="${x + w + 4}" y="295" text-anchor="middle">${g.label}</text>`
      );
    })
    .join(
      '',
    )}<rect x="220" y="323" width="14" height="14" fill="#087f85"/><text x="242" y="335">Predicted values</text><rect x="415" y="323" width="14" height="14" fill="#b65b24"/><text x="437" y="335">Measured results</text></g></svg><figcaption>${title}. Use this chart to compare the circuits you tested. The chart shows the values entered here, not a general relationship between component values and timing.</figcaption></figure>`;
}
function review(record, attachedSlots) {
  const p = progress(record, attachedSlots);
  return `<div class="stats"><div><strong>${p.preserved}/3</strong><span>Initial designs saved</span></div><div><strong>${p.captures}/${REQUIRED_CAPTURES.length}</strong><span>Images attached</span></div></div><p>Use this checklist to find sections you still need to complete. It checks whether answers have been entered, not whether they are correct. Check the screenshot files themselves before submitting. You can download your work even if some sections are incomplete.</p><ul class="review-list">${REQUIRED_IDS.map((id) => `<li><strong>${taskLabel(id)}</strong><span>${record.configs[id].original ? 'Initial design and predictions saved' : 'Initial design and predictions not yet saved'} · ${Object.values(record.configs[id].measurement).some((v) => v.trim()) ? 'Measured results section started' : 'Measured results not yet entered'}</span></li>`).join('')}</ul>`;
}
function preparation(record) {
  return box('Your work stays in this browser', 'Work on one computer, individually or in a group of two. This is your group’s data sheet; each student completes the post-lab separately. Answers and uploaded images stay in this browser, not on a server. Download lab files (ZIP) before leaving or changing computers. Keep a copy for each group member. Browser data can be cleared or lost.')
    + paper('Group details and equipment', `${fields(field(record, 'group.id', 'Group ID'))}${[record.group.student1, record.group.student2].map((_, i) => `<h3>Student ${i + 1}${i === 1 ? ' (optional)' : ''}</h3>${fields(field(record, `group.student${i + 1}.name`, `Student ${i + 1} name${i === 1 ? ' (optional)' : ''}`, { maxLength: 200 }) + field(record, `group.student${i + 1}.id`, `Student ${i + 1} ID${i === 1 ? ' (optional)' : ''}`, { maxLength: 40 }))}`).join('')}${record.legacyMembers || Object.values(record.analysis).some(value => value.trim()) ? `<details class="reference"><summary>Earlier group details and shared analysis (recovery only)</summary><p class="prewrap">${esc(record.legacyMembers)}</p>${definitionList(record.analysis, analysisLabels)}<p>These earlier answers are retained in backups, not assigned to either student’s individual report. Confirm the participating students’ names and IDs above.</p></details>` : ''}${fields(field(record, 'setup.supply', 'Power supply model or bench number, and current-limit setting') + field(record, 'setup.scope', 'Oscilloscope model or bench number') + field(record, 'setup.generator', 'Function generator model, if used') + field(record, 'setup.dmm', 'DMM model or bench number'))}${field(record, 'setup.notes', 'Record any missing components or equipment problems', { area: true })}<p>Save your initial design and predictions before building each circuit. You can correct your answers later; the original version will remain in your report.</p>`)
    + paper('Components and safety checks', kit() + voltageGoals() + Object.entries(SAFETY).map(([key, label]) => check(record, `setup.safety.${key}`, label)).join(''))
    + paper('NE555 pin connections', diagram(pinGuide(), 'NE555 viewed from above. Use the notch and dot to identify pin 1 before wiring.', 'pins'));
}
function optionalNotes(record) {
  return `<details class="reference"><summary>Optional simulator results or additional notes</summary><p>The simulator is optional. Record any simulator readings separately from your breadboard measurements.</p>${field(record, 'optional.tool', 'Simulator or other software used, if any')}${field(record, 'optional.simulation', 'Optional simulator results', { area: true })}${field(record, 'optional.extensions', 'Notes from any additional circuit tests', { area: true })}</details>`;
}
export function analysisForm(record) {
  return paper(
      '1 · Compare predicted values and measured results',
      `<p>For all three circuits, compare each measured result with the value calculated for the same components. If you corrected a calculation, state what you changed and why. In the equations below, the subscript “pred” refers to your calculated value and “meas” refers to your measurement.</p><ol><li>Calculate the percentage difference between each calculated and measured timing value. Keep the sign so that a positive value means the measured result was larger.</li><li>Calculate the difference in astable duty cycle in percentage points.</li><li>Calculate the ratio of the measured Lab 2 frequency to the measured Lab 1 frequency.</li><li>Calculate the HIGH-to-LOW time ratio for Lab 2 and compare all three required circuits with their design specifications.</li></ol>${analysisEquations()}${field(record, 'analysis.workings', 'Show your calculations for the differences and ratios', { area: true })}<details class="reference" open><summary>Table and charts of your predicted values and measured results</summary>${comparison(record)}${chart(record, ['A0', 'A1'], ['high', 'low'], 'Astable HIGH and LOW times')}${chart(record, ['M0'], ['pulse'], 'Monostable pulse duration')}</details>${field(record, 'analysis.comparison', 'Explain whether each circuit met its design specifications', { area: true, hint: 'For Lab 1, compare the frequency with the specified range. For Lab 2, compare the HIGH-to-LOW time ratio and frequency with their limits. For Lab 3, compare the pulse duration and output voltages with their limits and describe the response to the switch. Include measured values and screenshot filenames in your answer.' })}`,
    ) + paper(
        '2 · Explain your results',
        field(
          record,
          'analysis.paths',
          'Explain how the capacitor charges and discharges, and the role of each timing resistor',
          {
            area: true,
            hint: 'For Labs 1 and 2, use the capacitor-voltage and output waveforms to describe the current paths and switching voltages. For Lab 3, explain the charging and discharging paths from the schematic; no capacitor-voltage capture is required.',
          },
        ) +
          field(
            record,
            'analysis.conversion',
            'Why does the astable circuit produce pulses continuously, while the monostable circuit waits for the switch?',
            {
              area: true,
              hint: 'Explain the changes to pins 2, 6, and 7. Use the Lab 3 trigger/output screenshot to explain how a pulse starts. Use the schematic to explain the capacitor’s state before the press.',
            },
          ) +
          field(
            record,
            'analysis.timing',
            'Would a monostable using the astable circuit’s R1 and timing capacitor necessarily produce a pulse equal to the astable HIGH time? Explain.',
            {
              area: true,
              hint: 'Compare which resistors the capacitor charges through and its voltage at the start of charging in each circuit. Refer to the timing equations and your recorded waveforms.',
            },
          ),
      ) +
      paper(
        '3 · Explain differences between calculations and measurements',
        field(
          record,
          'analysis.uncertainty',
          'What could explain the differences in your results?',
          {
            area: true,
            hint: 'Separate marked component values, DMM readings, and values you could not measure. Discuss component tolerances and oscilloscope measurement limits. Where your recorded information allows it, estimate the size of at least one effect. Instead of writing only “human error,” identify the specific measurement or connection that may have affected the result.',
          },
        ) +
          field(
            record,
            'analysis.verification',
            'Describe one test you could use to check your explanation',
            {
              area: true,
              hint: 'State what you would change or measure and what result you would expect. Make clear whether you carried out this test or are proposing it for future work.',
            },
          ),
      ) +
      paper(
        '4 · Write your conclusions',
        field(
          record,
          'analysis.conclusionA',
          'What do you conclude about your two astable designs?',
          { area: true, hint: 'State whether Tasks 1 and 2 met their specifications. Support each conclusion with measured values, and explain any limits on what your tests show.' },
        ) +
          field(
            record,
            'analysis.conclusionM',
            'What do you conclude about your monostable design?',
            { area: true, hint: 'State whether the pulse duration, output voltages, and response to a brief switch press met the specifications.' },
          ) +
          field(
            record,
            'analysis.improvement',
            'Recommend one improvement and explain why it would help',
            {
              area: true,
              hint: 'Use your calculations or measurements to justify the recommendation. State whether you tested it on the breadboard, checked it only in the simulator, or have not tested it.',
            },
          ),
      ) + optionalNotes(record);
}
function saveLabData(record, attachedSlots) {
  return paper('Save the group’s lab data', review(record, attachedSlots)
    + box('Next: individual post-lab', 'Download lab files (ZIP) is the recommended transfer file. Each group member needs a copy of the ZIP, plus their own finalized pre-lab ZIP. Open the individual workspace in another tab and import both files. A PDF is for reading, not importing.')
    + '<div class="actions"><button class="primary" data-action="zip">Download lab files (ZIP)</button><button data-action="export">Download answers (JSON)</button><button data-action="print">Print or save report as PDF</button></div><p><a href="/worksheets/555-post-lab.html" target="_blank" rel="noopener">Open individual post-lab workspace ↗</a></p><p class="small muted">Downloads do not submit your work. Incomplete backups are allowed; finish the participating students’ details before using the file for post-lab work.</p>');
}
export function screen(record, index, attachedSlots = []) {
  const [title] = SCREENS[index];
  const intros = [
    'Enter Group ID and Student 1’s name and ID. Student 2 is optional; complete both fields or leave both blank. Then check the components, supply settings, and safety instructions before wiring the circuit.',
    'Design a 555 astable circuit using the available resistors and capacitors, then build it and measure its output.',
    'Continuing from Lab 1, modify your circuit so that the HIGH time is approximately twice the LOW time, while keeping the frequency within the limits shown below.',
    'Convert your astable circuit to a monostable circuit that produces one HIGH pulse after a brief switch press and release. After the pulse, the output should remain LOW until the next press.',
    'Download the group’s shared measurements and screenshots, then complete the post-lab individually.',
  ];
  const head = `<div class="screen-head"><span class="eyebrow">${index === 4 ? 'SAVE LAB DATA' : index === 0 ? 'PREPARATION' : 'MAIN LAB'}</span><h1>${title}</h1><p class="leadin">${intros[index]}</p></div>`;
  let body;
  if (index === 0) body = preparation(record);
  if (index === 1) body = goalPanel(record, 'A0')
    + paper('Astable circuit diagram', diagram(schematic(), 'DIP-8 top view, notch at the top. Use your calculated timing values and a 100 nF supply capacitor. Matching power and ground labels are connected; pin 5 CONT is left open.', 'schematic'))
    + predictionPanel(record, 'A0')
    + paper('Build and test the circuit', '<ol><li>With the supply switched off, assemble the circuit and check the connections against the diagram.</li><li>Connect CH1 to the output and CH2 to the timing capacitor. Connect both probe ground clips to circuit ground, then switch on the supply.</li><li>Wait until the waveform repeats consistently. Measure the HIGH and LOW times, period, frequency, duty cycle, and voltage levels. Do not use the first power-on interval.</li><li>Record the capacitor voltage at each output transition and save the output and capacitor waveforms together.</li></ol>')
    + measurementPanel(record, 'A0');
  if (index === 2) body = goalPanel(record, 'A1')
    + '<button data-reference="astable-equations">View Lab 1 equations</button>'
    + predictionPanel(record, 'A1', false)
    + paper('Modify and test the circuit', '<p>After saving your predictions, switch off the supply and discharge the capacitor before replacing the resistors. Keep the same capacitor and probe connections as Lab 1. Measure the modified output and capacitor waveforms, then compare the HIGH-to-LOW time ratio and frequency with the specifications above.</p>')
    + measurementPanel(record, 'A1');
  if (index === 3) body = goalPanel(record, 'M0') + monostableCircuitGuide() + predictionPanel(record, 'M0')
    + measurementPanel(record, 'M0');
  if (index === 4) body = saveLabData(record, attachedSlots);
  return head + body;
}
export function definitionList(object, labels = {}) {
  return `<dl>${Object.entries(object)
    .map(
      ([key, value]) =>
        `<div><dt>${esc(labels[key] || key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase())).replace(/\bt_W\b/g, '<var>t<sub>W</sub></var>')}</dt><dd class="prewrap">${typeof value === 'boolean' ? (value ? 'Checked' : 'Not checked') : valueText(value)}</dd></div>`,
    )
    .join('')}</dl>`;
}
function predictionSummary(id, original) {
  const notes = Object.fromEntries(
    Object.entries(original.design).filter(
      ([k, v]) => !['r1a', 'r1b', 'r2a', 'r2b', 'capacitor'].includes(k) && v.trim(),
    ),
  );
  return `<p><strong>Initial version saved (computer time):</strong> ${esc(original.at)}</p>${designSummary(id, original.design)}${predictionList(id, original.prediction)}${Object.keys(notes).length ? '<h4>Original component notes</h4>' + definitionList(notes, designLabels(id)) : '<p class="small">Original component notes: not recorded.</p>'}`;
}
const designLabels = (id) => ({
  measuredR1: id.startsWith('A')
    ? 'Measured total R1 (kΩ)'
    : 'Measured timing resistance R (kΩ)',
  measuredR2: 'Measured total R2 (kΩ)',
  measuredC: 'Measured C (µF)',
  tolerance: 'Component tolerances and values not measured',
  rationale: 'Reason for selecting these components',
});
const relevant = (object, keys) =>
  Object.fromEntries(
    Object.entries(object).filter(([k, v]) => keys.includes(k) || v.trim()),
  );
function predictionList(id, prediction) {
  return definitionList(
    relevant(prediction, timingKeys(id)),
    { ...Object.fromEntries(
      Object.entries(PREDICTION_FIELDS).map(([k, [l, u]]) => [
        k,
        `${l} (${u})`,
      ]),
    ), reason: 'Calculation steps and assumptions', sketch: 'Waveform sketch description or filename' },
  );
}
function measurementList(id, measurement) {
  const keys = [
    ...timingKeys(id),
    'supply',
    'outHigh',
    'outLow',
    ...(id.startsWith('A') ? ['capHigh', 'capLow'] : []),
    'method',
    'notes',
    ...(id.startsWith('M')
      ? ['triggerHigh', 'triggerLow', 'triggerWidth', 'triggerPeriod']
      : []),
  ];
  return definitionList(relevant(measurement, keys), {
    ...Object.fromEntries(
      Object.entries(MEASUREMENT_FIELDS).map(([k, [, u]]) => [
        k,
        `${id.startsWith('M') && ['capHigh', 'capLow'].includes(k) ? 'Previously recorded: ' : ''}${measurementLabel(id, k)} (${u})`,
      ]),
    ),
    timebase: 'Oscilloscope timebase and acquisition settings',
    voltsPerDiv: 'Voltage scales and coupling',
    probe: 'Probe attenuation setting',
    method: 'Measurement method',
    notes: 'Unexpected results or measurements not obtained',
  });
}
const predictionLabels = { ...Object.fromEntries(Object.entries(PREDICTION_FIELDS).map(([key, [label, units]]) => [key, `${label} (${units})`])), reason: 'Calculation steps and assumptions', sketch: 'Waveform sketch description or filename' };
const componentNoteKeys = (id) => ['measuredR1', ...(id.startsWith('A') ? ['measuredR2'] : []), 'measuredC', 'tolerance', 'rationale'];
function reportDesign(record, id) {
  const c = record.configs[id], initial = c.original;
  const base = initial || c;
  const notes = (design) => Object.fromEntries(componentNoteKeys(id).map((key) => [key, design[key]]));
  let html = `<h3>${initial ? 'Original design and predicted values' : 'Design and predicted values'}</h3>${initial ? `<p>Initial version saved: ${esc(initial.at)} (computer time)</p>` : '<p>The initial design has not been saved.</p>'}${designSummary(id, base.design)}${definitionList(notes(base.design), designLabels(id))}${predictionList(id, base.prediction)}`;
  if (!initial) return html;
  const changedComponents = [];
  if (['r1a', 'r1b'].some((key) => c.design[key] !== initial.design[key])) changedComponents.push('r1');
  if (id.startsWith('A') && ['r2a', 'r2b'].some((key) => c.design[key] !== initial.design[key])) changedComponents.push('r2');
  if (c.design.capacitor !== initial.design.capacitor) changedComponents.push('capacitor');
  const changedNotes = Object.fromEntries(componentNoteKeys(id).filter((key) => c.design[key] !== initial.design[key]).map((key) => [key, c.design[key]]));
  const changedPredictions = Object.fromEntries(Object.entries(c.prediction).filter(([key, value]) => value !== initial.prediction[key]));
  if (changedComponents.length || Object.keys(changedNotes).length || Object.keys(changedPredictions).length) {
    html += '<div class="report-corrections"><h3>Corrections and updated values</h3><p>Only changed answers are listed here. Unchanged values are recorded above.</p>';
    if (changedComponents.length) html += designSummary(id, c.design, changedComponents);
    if (Object.keys(changedNotes).length) html += definitionList(changedNotes, designLabels(id));
    if (Object.keys(changedPredictions).length) html += definitionList(changedPredictions, predictionLabels);
    html += '</div>';
  }
  return html;
}
const screenshotLabels = {
  A0: 'Screenshot 1 - Lab 1 output and capacitor voltage',
  A1: 'Screenshot 2 - Lab 2 output and capacitor voltage',
  M0trigger: 'Screenshot 3 - Lab 3 trigger and output',
};
function reportScreenshots(record, id, imageSources) {
  return (id === 'M0' ? ['M0trigger'] : [id]).map((key) => {
    const source = imageSources[key], evidence = record.evidence[key];
    // Only runtime-created local URLs are allowed, never filenames or remote URLs.
    const attached = typeof source === 'string' && source.startsWith('blob:');
    const image = attached
      ? `<figure class="report-image"><h3>${screenshotLabels[key]}</h3><img data-report-image="${key}" src="${esc(source)}" alt="${screenshotLabels[key]}" loading="eager"><figcaption>${esc(evidence.filename || 'Attached screenshot')}</figcaption></figure>`
      : `<h3>${screenshotLabels[key]}</h3>${definitionList({ filename: evidence.filename }, { filename: 'Oscilloscope screenshot filename' })}<p class="missing">Image not attached.</p>`;
    const notes = evidence.annotation.trim() ? definitionList({ annotation: evidence.annotation }, { annotation: 'Previously recorded screenshot description' }) : '';
    return `<div class="report-screenshot">${image}${notes}</div>`;
  }).join('');
}
const recordedOnly = (object) => Object.fromEntries(Object.entries(object).filter(([, value]) => typeof value === 'boolean' ? value : value.trim()));
function earlierNotes(record) {
  const conversion = recordedOnly(record.conversion), handoff = recordedOnly(record.handoff), capacitor = recordedOnly(record.evidence.M0capacitor);
  if (![conversion, handoff, capacitor].some((obj) => Object.keys(obj).length)) return '';
  return '<section><h2>Previously recorded notes</h2><p>These entries came from earlier workbook fields and are no longer required.</p>'
    + (Object.keys(conversion).length ? `<h3>Earlier connection notes</h3>${definitionList(conversion, { pin2: 'Pin 2 (TRIG)', pin6: 'Pin 6 (THRES)', pin7: 'Pin 7 (DISCH)', r2: 'Change to R2', reason: 'Why the circuit waits for the switch', checked: 'Connections checked before switching on' })}` : '')
    + (Object.keys(capacitor).length ? `<h3>Earlier Lab 3 capacitor capture (not required)</h3>${definitionList(capacitor, { filename: 'Previously recorded filename', annotation: 'Previously recorded screenshot description' })}` : '')
    + (Object.keys(handoff).length ? `<h3>Earlier bench notes</h3>${definitionList(handoff, { poweredDown: 'Supply switched off, capacitor discharged, and bench checked', evidenceChecked: 'Screenshot files and filenames checked', notes: 'Unfinished measurements or problems to follow up' })}` : '') + '</section>';
}
export const analysisLabels = {
  workings: 'Calculations for differences and ratios', comparison: 'Comparison with the design specifications', paths: 'Capacitor charging, discharging, and timing resistor functions', conversion: 'Why the astable repeats and the monostable waits for the switch', timing: 'Why the astable HIGH time and monostable pulse duration differ', uncertainty: 'Possible causes of differences between calculated and measured values', verification: 'Test to check the explanation', conclusionA: 'Conclusions about the astable circuits', conclusionM: 'Conclusions about the monostable circuit', improvement: 'Recommended improvement and whether it was tested',
};
const safetyReportLabels = {
  orientation: 'IC orientation and pin numbers',
  rails: 'Supply polarity, rails, and IC power connections',
  polarity: 'Timing capacitor rating and polarity',
  grounds: 'Common instrument and circuit ground',
  modifications: 'Power-off changes and safe capacitor discharge',
  probes: 'Probe settings and unloaded output',
};
export function report(record, imageSources = {}) {
  return `<header class="report-title"><p>Electronics Lab - Group data collection</p><h1>555 Timer Main Lab Data Report</h1>${identityIssues(record).length ? `<p class="report-warning">DRAFT - ${esc(identityIssues(record).join(" "))}</p>` : ""}${definitionList({id: record.group.id}, {id: "Group ID"})}${groupStudents(record).map((student,i) => `<h3>Student ${i+1}</h3>${definitionList(student,{name:"Name",id:"Student ID"})}`).join("")}<p>Workbook ID: ${esc(record.recordId)} - Version ${record.schemaVersion}<br>Created ${esc(record.createdAt)} - Updated ${esc(record.updatedAt)} (computer times)</p></header>
  <section><h2>Equipment and safety checks</h2>${definitionList(Object.fromEntries(Object.entries(record.setup).filter(([key]) => key !== 'safety')), { supply: 'Power supply and current-limit setting', scope: 'Oscilloscope', generator: 'Optional function generator', dmm: 'DMM', notes: 'Equipment problems' })}${definitionList(record.setup.safety, safetyReportLabels)}</section>
  <section class="report-specifications"><h2>Specification summary</h2><p>Shared conditions: regulated supply and high-impedance oscilloscope inputs, with other output loads disconnected.</p><div class="parameter-grid">${valueLine('V', 'CC', '5', 'V')}${math(row(n('3.0'), unit('V'), op('≤'), v('V', 'OH'), op('≤'), v('V', 'CC')), 'HIGH output at least 3.0 volts and not above supply')}${math(row(v('V', 'OL'), op('≤'), n('0.5'), unit('V')), 'LOW output no more than 0.5 volts')}</div><table><thead><tr><th>Lab</th><th>Required output</th></tr></thead><tbody>${REQUIRED_IDS.map((id) => `<tr><th>${TASKS[id].title}</th><td>${targetExpressions(record, id)}${id === 'A1' && number(designReference(record, id).frequency) > 0 ? valueLine('f', 'Lab 1, reference', designReference(record, id).frequency, 'Hz') : ''}${id === 'A1' ? '<p>Keep the Lab 1 timing capacitor.</p>' : id === 'M0' ? '<p>One pulse per brief switch press and release.</p>' : ''}</td></tr>`).join('')}</tbody></table></section>
  ${REQUIRED_IDS.map((id) => `<section class="report-config"><h2>${TASKS[id].title}</h2>${reportDesign(record, id)}<h3>Measured results</h3>${measurementList(id, record.configs[id].measurement)}${reportScreenshots(record, id, imageSources)}</section>`).join('')}
  ${earlierNotes(record)}${Object.values(record.optional).some((value) => value.trim()) ? `<section><h2>Optional notes</h2>${definitionList(record.optional, { tool: 'Simulator or software used', simulation: 'Simulator results', extensions: 'Notes from additional circuit tests' })}</section>` : ''}`;
}
