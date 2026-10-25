import { SCREENS, PRELAB, DOWNLOAD_BASE, GROUP_FIELDS, SETUP_FIELDS, NOTES, TABLES, CAPTURES, CAPTURE_FIELDS, PREDICTION_FIELDS, EXPERIMENTS, completeness, identityIssues } from './model.js';
import { EQUATIONS, circuit } from './scientific.js';
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const paper = (title, body) => `<section class="paper"><div class="section-heading"><h2>${title}</h2></div>${body}</section>`;
const steps = (items) => `<ol class="student-steps">${items.map((item) => `<li>${item}</li>`).join('')}</ol>`;
const callout = (text) => `<div class="callout">${text}</div>`;
export function field(record, key, label, area = false) {
  const id = `f-${key}`;
  return `<div class="field"><label for="${id}">${esc(label)}</label>${area ? `<textarea id="${id}" data-field="${key}" maxlength="4000" rows="3">${esc(record.fields[key])}</textarea>` : `<input type="text" id="${id}" data-field="${key}" maxlength="4000" value="${esc(record.fields[key])}">`}</div>`;
}
const groupFields = (record, prefix, entries) => `<div class="fields">${Object.entries(entries).map(([key, label]) => field(record, `${prefix}.${key}`, label)).join('')}</div>`;
const note = (record, key) => field(record, `notes.${key}`, NOTES[key], true);
const reference = (text) => callout(`<strong>Use your pre-lab knowledge.</strong> ${text} <a href="${PRELAB}" target="_blank" rel="noopener">Open pre-lab reference ↗</a>. Use its screen menu; keep your individual ZIP for the later post-lab.`);
function prediction(record, id) {
  const p = record.originals[id];
  return paper('Predict before measuring', `<p>Record a bench prediction for the actual apparatus. Preserve it before collecting results. Later corrections stay separate from this original.</p>${p ? `<div class="callout"><strong>Original preserved · ${esc(p.at)}</strong>${Object.entries(PREDICTION_FIELDS).map(([k, label]) => `<p><strong>${label}:</strong> <span class="prewrap">${esc(p[k])}</span></p>`).join('')}</div><h3>Current version / corrections</h3>` : ''}${Object.entries(PREDICTION_FIELDS).map(([k, label]) => field(record, `prediction.${id}.${k}`, label, true)).join('')}${p ? '<p class="small">Editing the current version never changes the original above.</p>' : `<button data-preserve="${id}">Preserve bench prediction</button>`}`);
}
function table(record, id) {
  const t = TABLES[id];
  return paper(t.title, `<p class="small muted">Enter measured or calculated values with the indicated units. If a value cannot be obtained, describe why in that field. Recording an answer is not a correctness check.</p><div class="table-scroll"><table class="measurement-table"><thead><tr><th scope="col">Configuration</th>${t.columns.map((c) => `<th scope="col">${c.label}</th>`).join('')}</tr></thead><tbody>${t.rows.map(([row, label]) => `<tr><th scope="row">${label}</th>${t.columns.map((c) => `<td data-label="${esc(c.label)}">${field(record, `${id}.${row}.${c.id}`, `${label}: ${c.label}`)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
}
function filePanel(slot, files, urls) {
  const f = files[slot], csv = slot.endsWith('.csv');
  return `<div class="attachment" data-attachment="${slot}"><label for="file-${slot}"><strong>${csv ? 'CSV recording (up to 5 MiB)' : 'Scope / plot image (up to 10 MiB)'}</strong></label><div class="attachment-controls"><input id="file-${slot}" data-file="${slot}" type="file" accept="${csv ? '.csv,text/csv' : '.png,.jpg,.jpeg,.bmp,.webp,image/png,image/jpeg,image/bmp,image/webp'}"><button data-upload="${slot}">Attach ${csv ? 'CSV' : 'image'}</button></div><p class="image-status">${f ? `Attached locally: ${esc(f.originalName)} → ${esc(f.filename)}` : 'No file attached.'}</p>${f ? `<div class="actions"><button data-download-file="${slot}">Download attached file</button><button data-remove="${slot}">Remove attachment</button></div>${!csv ? `<div class="image-preview"><img src="${urls[slot]}" alt="${esc(f.originalName)}"></div>` : '<p class="small">Original CSV preserved. This page does not interpret or execute its contents.</p>'}` : ''}</div>`;
}
function capturePanel(record, c, files, urls) {
  return `<details class="capture" id="capture-${c.id}"><summary>${c.label} <span class="chip">${files[`${c.id}.csv`] ? 'CSV ✓' : 'CSV —'} · ${files[`${c.id}.image`] ? 'Image ✓' : 'Image —'}</span></summary><p><strong>Mode:</strong> ${c.mode}. <strong>Evidence:</strong> ${c.kind === 'both' ? 'CSV and image required' : c.kind === 'optional' ? 'optional extension' : `${c.kind} required; other file optional`}.</p>${groupFields(record, `capture.${c.id}`, CAPTURE_FIELDS)}${filePanel(`${c.id}.csv`, files, urls)}${filePanel(`${c.id}.image`, files, urls)}</details>`;
}
const captures = (record, page, files, urls, snr = false) => paper(snr ? 'SNR capture files and conditions' : 'Capture details and evidence', `<p>Attach files on this computer, then download a backup. Use the same capture IDs in the measurement tables. Notes do not substitute for the required SNR recordings.</p>${CAPTURES.filter((c) => c.page === page && c.id.startsWith('snr_') === snr).map((c) => capturePanel(record, c, files, urls)).join('')}`);
function summary(record, files) {
  const issues = completeness(record, files);
  return `<p>Completeness checks help locate missing evidence; they do not grade the answers or prove valid measurements.</p>${issues.length ? `<ul class="review-list">${issues.map((issue) => `<li>${esc(issue)}</li>`).join('')}</ul>` : '<p class="callout">The listed fields and required files are present. Review their quality before handing off.</p>'}`;
}
export function screen(record, index, files = {}, urls = {}) {
  let body = '';
  if (index === 0) body = reference('The three experiments extend the preparation: identify useful signal, compare analog RC, then compare MA and EMA. SNR calculation and interpretation will be required in the individual post-lab.')
    + paper('Group and apparatus', `<p>Work in a group of one or two. Complete both fields for Student 2, or leave both blank. Allow about three hours including setup and saving.</p>${groupFields(record, 'group', GROUP_FIELDS)}${groupFields(record, 'setup', SETUP_FIELDS)}`)
    + paper('Get ready to acquire', steps([
      'Use an UNO R4 Minima or WiFi. In Arduino IDE, install/select the matching Arduino UNO R4 board and port.',
      `<a href="${DOWNLOAD_BASE}noise_filtering_main_lab.zip" download>Download the complete Arduino sketch (ZIP)</a>, extract it, then open <code>noise_filtering_main_lab.ino</code> in its folder. <a href="${DOWNLOAD_BASE}CAPTURE_GUIDE.txt" download>Download the capture guide</a>.`,
      'Measure the supply/reference voltage. Set it with the sketch’s ref command before recording; it is not measured automatically.',
      'Switch power and generator output off before changing wiring. Discharge capacitors through a resistor. Check polarized capacitors and the 1 kΩ LED current-limiting resistor.',
      'Connect UNO GND, generator return and both scope ground clips to the same circuit ground. Use high-impedance scope inputs and matching probe attenuation.',
      'For generator input, disconnect the sensor source and D9 from the driven node. Verify the actual input stays between 1 V and 3 V before connecting A0. Never join two outputs.',
    ])) + paper('Acquisition and evidence', `<p>The sketch warms up, records four seconds at nominal 500 samples/s, and transmits afterward. Keep the complete CSV block, including the metadata and end marker. Record actual timing and any missed slots. The plotter is a replay, not live acquisition.</p><p>Use <code>steady</code>, <code>dark</code>, <code>step</code>, <code>pulse</code>, or <code>external</code> in Serial Monitor. Use <code>csv</code> to repeat the last export, <code>plot</code> to replay the same samples, and <code>summary</code> for a steady-mode summary. Optical pulse default: 250 ms; change with <code>pulsems 250</code>.</p><p>The worksheet accepts manual readings and original files. It does not connect to Arduino or calculate SNR. Downloads stay on your device and are not submissions.</p>`);
  if (index === 1) body = reference('Screens 2–3: Where filters act and Measure variation. Identify the useful light change before trying to remove variation.')
    + paper('Build the baseline circuit', circuit('baseline') + steps([
      'Identify the intended light change and the unwanted variation. Fix the LED/LDR spacing and ambient lighting.',
      'Start without RC: the divider node goes directly to A0. Compare approximately 10 kΩ and 40 kΩ fixed resistance; record actual values.',
      'Use dark and steady modes to measure levels. Check clipping and calculate voltage/code span. Do not use dark-condition noise as illuminated-condition noise.',
      'At fixed illumination, wait for settling and record the steady run. Copy the mean-removed noise summary and retain the CSV.',
      'Select a divider for all subsequent optical comparisons. Preserve a prediction before the step/pulse runs. Record a step and pulse using that divider.',
    ])) + note(record, 'usefulSignal') + note(record, 'illumination') + prediction(record, 'baseline')
    + paper('Measure steady variation', EQUATIONS.mean + EQUATIONS.noise + '<p>Use the same settled window and units for comparisons. Exclude real steps and pulses from the noise window. Zero measured variation may reflect ADC resolution; it is not proof of noiseless hardware.</p>')
    + table(record, 'divider') + paper('Continue with one sensor setup', note(record, 'selectedDivider') + note(record, 'dividerReason') + note(record, 'pulse') + note(record, 'baselineNotes') + '<p>The light-step response includes LDR dynamics. Record timing relative to the actual D9 edge or the measured input; state which. A sample timestamp is not yet an elapsed response time.</p>')
    + captures(record, 1, files, urls);
  if (index === 2) body = reference('Screen 4: Worked RC. Screen 6: Prediction 1 / PRE-P01. Test the effects of capacitance on ripple, step response and a short event using your actual apparatus.')
    + prediction(record, 'analog') + paper('Compare bypass and two RC settings', circuit('analog') + steps([
      'Keep the selected divider, LED/LDR spacing, illumination and pulse duration fixed. Use bypass as the reference; record its capture IDs from Experiment 1.',
      'With power off, insert nominal 10 kΩ in series with A0 and 1 µF from A0 to ground (RC A). Record actual components; equivalent available values are allowed.',
      'Capture steady, step and pulse records. Probe CH1 at the divider node and CH2 at A0 to distinguish input changes from filtering effects.',
      'Repeat with 2.2 µF (RC B), keeping the other conditions fixed. Capture before changing the circuit again.',
      'For step timing, record baseline and settled final voltage, input-edge time and the first 90% crossing. For the pulse, record baseline and peak; identify the input/reference measurement in your notes.',
    ])) + table(record, 'analog')
    + paper('Isolate the RC response', circuit('generator') + EQUATIONS.rc + EQUATIONS.rise + steps([
      'Disconnect the sensor source. Connect generator MAIN through the chosen RC to A0, with CH1 at the filter input and CH2 at its output.',
      'Select a 1 Hz square wave. With A0 disconnected initially, adjust and verify the actual input levels at 1 V and 3 V. Then connect A0. Record source/load settings; a 50 Ω generator display may differ from high-impedance voltage.',
      'Measure 63.2% of the output change relative to the input edge, and the 10–90% rise interval. Repeat for both capacitors; retain scope images.',
    ]) + '<p>The simple equations assume an ideal source and negligible loading. The LDR divider adds source resistance and sensor dynamics; do not use its optical rise time as the isolated RC time constant. Compare predictions with actual components and state generator/probe loading.</p>')
    + table(record, 'rc') + paper('Collect the required SNR evidence', EQUATIONS.snr + steps([
      'Use a 5 Hz sine, verified at the input between 1 V and 3 V (2 Vpp, 2 V offset). Keep the generator and acquisition settings fixed across the three paths.',
      'Run external mode after settling: one bypass record, one RC A record and one RC B record. Attach each complete four-second CSV and a scope image showing the input/output conditions.',
      'Keep all raw samples. The bypass CSV also includes all four digital filters on those same samples, so it is the digital SNR reference for Experiment 3.',
    ]) + '<p>SNR is required in the later individual post-lab. Distinguish the useful sine, DC, harmonics and noise. Mean-removing a sine record does not make the remaining signal “noise.” If a residual includes distortion, label it accordingly rather than calling it noise-only SNR. Do not substitute covered/uncovered total-RMS subtraction.</p>')
    + '<p class="small">Measurement reference: <a href="https://www.analog.com/en/resources/app-notes/an-835.html" target="_blank" rel="noopener">Analog Devices AN-835: SNR and distortion definitions ↗</a>.</p>'
    + table(record, 'snr') + captures(record, 2, files, urls, true) + captures(record, 2, files, urls) + note(record, 'analogNotes');
  if (index === 3) body = reference('Screen 5: MA & EMA mechanism. Screen 7: Prediction 2 / PRE-P02. Screen 8: compare noise, response and event requirements together. Your bench record stays separate from the individual check.')
    + prediction(record, 'digital') + paper('Compare filters on the same samples', EQUATIONS.ma + EQUATIONS.ema + EQUATIONS.delay + '<p>EMA is also a first-order IIR. The delay formulas describe low-frequency delay, not the first 90% step crossing. Changing sample rate changes time represented by a window or coefficient.</p>' + steps([
      'Restore the selected LDR divider and bypass the RC. Never leave the generator connected to the same input as the sensor source.',
      'Record steady, step and pulse runs. Each capture computes RAW, MA short/long and EMA faster/slower from the same samples. Starting settings: MA 5 and 21; EMA 0.20 and 0.04; nominal 500 samples/s.',
      'Preserve the complete CSV before starting a new capture. Use plot to replay the same samples on common axes. Keep the same scale and time span in images.',
      'Use the same steady window for noise. For step and pulse measurements, record the common input-edge time, threshold method, baseline and final/peak levels in the capture details. Use timestamped rows for timing, not the replay speed.',
      'Use the bypass sine CSV from Experiment 2 for digital SNR analysis. Confirm it contains all five output columns and the settings; repeat the capture if it is missing.',
      'Record concise observations. An optional combined RC + digital run must identify both stages and use the separate cascade capture.',
    ]) + '<p>The pre-lab’s hypothetical settings and sampling rates are not bench specifications. No path is automatically best because it looks smoother. Keep the noise, delay and event evidence together.</p>')
    + table(record, 'digital') + captures(record, 3, files, urls) + note(record, 'digitalNotes') + note(record, 'cascade');
  if (index === 4) body = paper('Keep the group’s evidence', callout('Each member needs this group’s main-lab ZIP and their own finalized pre-lab ZIP for the future individual post-lab. Detailed SNR calculations and conclusions will be individual work.') + '<p>Check that the three controlled sine CSVs and scope images are present. Missing files must be collected while the apparatus is available.</p>' + summary(record, files) + '<div class="actions"><button class="primary" data-action="zip">Download lab files (ZIP)</button><button data-action="export">Download answers (JSON)</button><button data-action="print">Print or save report as PDF</button></div><p class="small">Incomplete backups are allowed. A PDF is readable evidence, not the restoration format. Restore the JSON or original ZIP in this worksheet. Downloads do not submit work.</p>');
  return `<div class="screen-head"><span class="eyebrow">WEEK 12 · GROUP MAIN LAB · ${index + 1} / 5</span><h1>${SCREENS[index]}</h1><p class="leadin">Keep useful changes. Measure unwanted variation. Preserve the evidence.</p></div>${body}`;
}
function entries(record, prefix, labels) {
  return `<dl>${Object.entries(labels).map(([k, label]) => `<div><dt>${esc(label)}</dt><dd class="prewrap">${esc(record.fields[`${prefix}.${k}`] || 'Not entered')}</dd></div>`).join('')}</dl>`;
}
export function report(record, files, urls) {
  const issues = completeness(record, files), group = { ...GROUP_FIELDS };
  if (!record.fields['group.student2Name'] && !record.fields['group.student2Id']) { delete group.student2Name; delete group.student2Id; }
  return `<header class="report-title"><h1>Noise and Filtering Main Lab</h1><p>2145427 · Group measurement evidence · v1</p>${identityIssues(record).length || issues.length ? '<p class="report-warning">DRAFT / INCOMPLETE EVIDENCE — review the checklist.</p>' : ''}${entries(record, 'group', group)}<p>Workbook ${esc(record.recordId)} · Created ${esc(record.createdAt)} · Updated ${esc(record.updatedAt)} (computer times)</p></header>
  <section><h2>Apparatus and conditions</h2>${entries(record, 'setup', SETUP_FIELDS)}</section>
  <section><h2>Measurement definitions</h2>${EQUATIONS.noise}${EQUATIONS.rc}${EQUATIONS.rise}${EQUATIONS.ma}${EQUATIONS.ema}${EQUATIONS.snr}<p>SNR analysis is required in the later individual post-lab. Sensor measurements and controlled electrical tests are separate. Digital outputs use the same raw samples; scope images and CSVs retain measurement context.</p></section>
  ${EXPERIMENTS.map((e) => `<section><h2>${e[0].toUpperCase() + e.slice(1)} bench prediction</h2>${record.originals[e] ? `<h3>Preserved original · ${esc(record.originals[e].at)}</h3><dl>${Object.entries(PREDICTION_FIELDS).map(([k, label]) => `<div><dt>${label}</dt><dd class="prewrap">${esc(record.originals[e][k])}</dd></div>`).join('')}</dl>` : '<p>Original not preserved.</p>'}<h3>Current version / corrections</h3>${entries(record, `prediction.${e}`, PREDICTION_FIELDS)}</section>`).join('')}
  ${Object.entries(TABLES).map(([id, t]) => `<section><h2>${t.title}</h2>${t.rows.map(([r, label]) => `<div class="report-row"><h3>${label}</h3>${entries(record, `${id}.${r}`, Object.fromEntries(t.columns.map((c) => [c.id, c.label])))}</div>`).join('')}</section>`).join('')}
  <section><h2>Observations and limitations</h2>${entries(record, 'notes', NOTES)}</section>
  ${CAPTURES.filter((c) => c.kind !== 'optional' || files[`${c.id}.csv`] || files[`${c.id}.image`] || record.fields[`capture.${c.id}.notes`]).map((c) => `<section><h2>${c.label}</h2>${entries(record, `capture.${c.id}`, CAPTURE_FIELDS)}<p>CSV: ${esc(files[`${c.id}.csv`]?.filename || 'Not attached')}</p>${files[`${c.id}.image`] ? `<figure class="report-image"><img src="${urls[`${c.id}.image`]}" alt="${esc(c.label)}"><figcaption>${esc(files[`${c.id}.image`].filename)} · Original: ${esc(files[`${c.id}.image`].originalName)}</figcaption></figure>` : '<p>Image not attached.</p>'}</section>`).join('')}
  <section><h2>Evidence checklist</h2>${summary(record, files)}<p>This report records entered observations; it is not a grade or proof of submission. Retain the original ZIP for future analysis.</p></section>`;
}
