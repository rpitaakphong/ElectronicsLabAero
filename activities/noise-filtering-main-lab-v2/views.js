import { SCREENS, ALLOWANCES, LEGACY, DOWNLOAD_BASE, GROUP_FIELDS, SETUP_FIELDS, DEBUG_FIELDS, SCOPE_FIELDS, DESIGN_FIELDS, DIGITAL_FIELDS, TABLES, CAPTURES, CAPTURE_FIELDS, PRESERVE_FIELDS, fieldLabels, completeness, identityIssues, MAX_CODE } from './model.js';
import { EQUATIONS, circuit } from './scientific.js';
import { FILTER_EXAMPLE } from './filter-examples.js';
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const paper = (title, body) => `<section class="paper"><div class="section-heading"><h2>${title}</h2></div>${body}</section>`;
const steps = (items) => `<ol class="student-steps">${items.map((item) => `<li>${item}</li>`).join('')}</ol>`;
const callout = (text) => `<div class="callout">${text}</div>`;
export function field(record, key, label, area = false) {
  const id = `f-${key}`;
  return `<div class="field"><label for="${id}">${esc(label)}</label>${area ? `<textarea id="${id}" data-field="${key}" maxlength="4000" rows="3">${esc(record.fields[key])}</textarea>` : `<input type="text" id="${id}" data-field="${key}" ${key === 'group.student1Name' || key === 'group.groupId' ? 'required' : ''} maxlength="4000" value="${esc(record.fields[key])}">`}</div>`;
}
const fields = (record, prefix, labels, area = true) => `<div class="fields${area ? ' prose-fields' : ''}${prefix === 'group' ? ' group-fields' : ''}">${Object.entries(labels).map(([k, label]) => field(record, `${prefix}.${k}`, label, area)).join('')}</div>`;
function codeField(record, id) {
  return `<div class="field code-field"><label for="code-${id}">${id === 'generator' ? 'Repaired generator sketch (.ino)' : 'Final digital-filter sketch (.ino)'}</label><p class="small" id="code-help-${id}">Paste the complete, self-contained sketch you uploaded in Arduino IDE. Stored as literal text; this page does not compile or upload it. Limit: ${MAX_CODE / 1024} KiB.</p><textarea id="code-${id}" data-field="code.${id}" aria-describedby="code-help-${id}" spellcheck="false" autocapitalize="off" autocomplete="off" maxlength="${MAX_CODE}" rows="14" wrap="soft"></textarea><button data-download-code="${id}">Download this code (.ino)</button></div>`;
}
function preserved(record, id, label) {
  const p = record.originals[id];
  return p ? `<details class="preserved" id="preserved-${id}"><summary>${label} preserved · ${esc(p.at)}</summary><p>This records your submitted version, not automatic verification of its correctness. Later edits below remain separate.</p>${Object.entries(p.fields).map(([k, v]) => `<h3>${esc(fieldLabels[k])}</h3>${k.startsWith('code.') ? `<pre class="code-preview">${esc(v)}</pre>` : `<p class="prewrap">${esc(v)}</p>`}`).join('')}</details>` : `<p class="small">Preserve this version when the required fields are filled. You can continue or download a draft at any time.</p><button data-preserve="${id}">Preserve ${label.toLowerCase()}</button>`;
}
function table(record, id) {
  const t = TABLES[id];
  return paper(t.title, `<p class="small">Use consistent amplitude units and cite matching capture IDs. Explain unavailable values in the field; entries are not graded automatically.</p><div class="table-scroll"><table class="measurement-table"><thead><tr><th scope="col">Component / path</th>${t.columns.map((c) => `<th scope="col">${c.label}</th>`).join('')}</tr></thead><tbody>${t.rows.map(([row, label]) => `<tr><th scope="row">${label}</th>${t.columns.map((c) => `<td>${field(record, `${id}.${row}.${c.id}`, `${label}: ${c.label}`)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
}
function filePanel(slot, files, urls) {
  const f = files[slot], csv = slot.endsWith('.csv');
  return `<div class="attachment" data-attachment="${slot}"><label for="file-${slot}"><strong>${csv ? 'Waveform CSV (up to 5 MiB)' : 'Screenshot (up to 10 MiB)'}</strong></label><div class="attachment-controls"><input id="file-${slot}" data-file="${slot}" type="file" accept="${csv ? '.csv,text/csv' : '.png,.jpg,.jpeg,.bmp,.webp,image/png,image/jpeg,image/bmp,image/webp'}"><button data-upload="${slot}">Attach ${csv ? 'CSV' : 'image'}</button></div><p class="image-status">${f ? `Attached locally: ${esc(f.originalName)} → ${esc(f.filename)}` : 'No file attached.'}</p>${f ? `<div class="actions"><button data-download-file="${slot}">Download attached file</button><button data-remove="${slot}">Remove attachment</button></div>${!csv ? `<div class="image-preview"><img src="${urls[slot]}" alt="${esc(f.originalName)}"></div>` : '<p class="small">Original bytes retained. The worksheet does not analyze or execute CSV contents.</p>'}` : ''}</div>`;
}
function capturePanel(record, c, files, urls) {
  return `<details class="capture" id="capture-${c.id}"><summary>${c.label}<span class="chip">${files[`${c.id}.csv`] ? 'CSV ✓' : 'CSV —'} · ${files[`${c.id}.image`] ? 'Image ✓' : 'Image —'}</span></summary><p>${c.kind === 'both' ? 'Required: FFT screenshot and original scope waveform CSV.' : c.kind === 'optional' ? 'Optional: image, CSV or both.' : 'Required: live Serial Plotter screenshot. CSV is optional.'}</p>${fields(record, `capture.${c.id}`, CAPTURE_FIELDS)}${filePanel(`${c.id}.image`, files, urls)}${filePanel(`${c.id}.csv`, files, urls)}</details>`;
}
const captures = (record, page, files, urls) => paper(page === 4 ? 'Supplementary evidence (optional)' : 'Upload your evidence', `<p>Save the files yourself, then attach them here. Files stay on this device until you download a backup. All attachments together must fit within 32 MiB.</p>${CAPTURES.filter((c) => c.page === page).map((c) => capturePanel(record, c, files, urls)).join('')}`);
function summary(record, files) {
  const issues = completeness(record, files);
  return `<p>This checklist locates missing evidence. It does not grade your answers or certify measurements. Incomplete downloads remain available.</p>${issues.length ? `<ul class="review-list">${issues.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : '<p class="callout">The listed fields and required files are present. Review their quality before handing off.</p>'}`;
}
const waveform = () => EQUATIONS.useful + EQUATIONS.interference + EQUATIONS.source + '<p>Time is in seconds. Each useful tone is 0.20 V peak; each interference tone is 0.10 V peak. The 2 V DC offset keeps the designed waveform positive. These are lab-defined tones representing a receiver’s low-frequency output, rather than an aircraft RF carrier.</p>';
const safety = () => callout('<strong>Check before powering.</strong> A0 is the DAC output; A1 is the ADC input. Use common ground, compensated 10× probes and high-impedance scope inputs, with matching probe settings. Verify voltage remains within the board’s input range. Do not connect an external generator or another output to A0. Switch power off before changing wiring.');
export function screen(record, index, files = {}, urls = {}) {
  let body = '';
  if (index === 0) body = paper('Your mission', '<p>You are investigating interference in the low-frequency output of an aircraft communication receiver. Preserve 50, 55 and 70 Hz while reducing 120, 150 and 180 Hz. A smoother plot is only useful if the wanted information survives.</p><p>Work in a group of up to three. The five stages allow 170 minutes, with ten minutes reserved for recovery. Install Arduino IDE and UNO R4 board support before class.</p>')
    + paper('Group and apparatus', '<p>Enter your Group ID and Student 1’s name. Student 2 and Student 3 are optional. All student IDs are optional; a name alone is sufficient.</p>' + fields(record, 'group', GROUP_FIELDS, false) + fields(record, 'setup', SETUP_FIELDS))
    + paper('Repair, explain and verify', steps([
      `<a href="${DOWNLOAD_BASE}aircraft_signal_starter.zip" download>Download the Arduino starter ZIP</a>. Extract and open <code>aircraft_signal_starter.ino</code> in its folder; select UNO R4 Minima or WiFi and the matching port.`,
      'Attempt compilation. The starter has one deliberate compilation error. Copy the key diagnostic, explain the cause, and use your own AI tool to help repair it. Ask for an explanation and a minimal change; verify the suggestion yourself.',
      'Measure the board supply/reference voltage and enter it in REFERENCE_V in the sketch. Recompile and upload through Arduino IDE. Compile success alone does not establish a correct physical waveform.',
      'Use the baseline connections on the next page. Verify a changing output, plausible amplitude and offset, and no clipping. Run status in Serial Monitor and record timing diagnostics; plot resumes the live stream.',
      'Paste your complete repaired sketch below and preserve it with your explanation. Continue editing a separate copy for the digital stage.',
    ]) + `<p><a href="${DOWNLOAD_BASE}CAPTURE_GUIDE.txt" download>Download the wiring and evidence guide</a>. This workspace saves your code as evidence; it does not connect to or program the board.</p>` + fields(record, 'debug', DEBUG_FIELDS) + codeField(record, 'generator') + preserved(record, 'generator', 'Generator version'))
    + paper('Previous workbook', `<p>Have an LDR main-lab v1 backup? <a href="${LEGACY}" target="_blank" rel="noopener">Open the legacy LDR worksheet ↗</a>. Its answers and files use separate browser storage and remain restorable there.</p>`);
  if (index === 1) body = paper('Know the waveform', waveform())
    + paper('Connect and inspect', safety() + circuit('baseline') + steps([
      'Connect A0 to A1. Connect CH1 and CH2 tips to the same source node, with both probe grounds at UNO GND.',
      'Inspect the time waveform first. Record voltage range, offset and clipping. Distinguish the DC offset from the useful changing signal.',
      'Find out how to perform FFT analysis on the GDS-1202B. Use its manual, your AI tool or other reliable resources; record the procedure and settings you discover.',
      'Identify all six components, including the close 50 Hz and 55 Hz peaks. Explain how record duration, sample rate, window and display scale affect what you can distinguish.',
      'Manually save an FFT screenshot with readable frequency and amplitude scales, plus the original time-domain scope waveform as Detail CSV. Retain time and voltage information and the scope metadata.',
    ]) + '<p><a href="https://www.gwinstek.com/en-US/products/downloadSeriesDownNew/1679/133" target="_blank" rel="noopener">GDS-1000B manufacturer manual ↗</a>. The procedure is part of your investigation; no FFT button sequence is supplied here.</p>' + EQUATIONS.resolution + '<p>The equation describes native bin spacing for the samples actually used by the FFT. Windowing broadens peaks; display zoom alone does not add frequency resolution. Aim for a settled four-second waveform record when the instrument permits, and record what you actually obtained.</p>' + fields(record, 'scope', SCOPE_FIELDS))
    + captures(record, 1, files, urls);
  if (index === 2) body = paper('Design before building', '<p>Your design is your choice. Decide whether low-pass or high-pass behavior suits the useful and unwanted bands, justify a cutoff, and select available R/C values. Keep the source waveform unchanged across comparisons.</p>' + EQUATIONS.rc + EQUATIONS.lowpass + EQUATIONS.highpass + '<p>These ideal responses assume negligible source and load effects. One RC stage attenuates gradually. Assess useful-tone loss as well as interference reduction. Use approximately 47 kΩ and non-polar 22–100 nF stock as available; record equivalents. Keep at least 33 kΩ series resistance for the shown unbuffered DAC arrangement. Another topology or lower resistance needs instructor review.</p>'
      + fields(record, 'design', Object.fromEntries(Object.entries(DESIGN_FIELDS).slice(0, 7))) + preserved(record, 'design', 'Initial RC design'))
    + paper('Build and compare', safety() + '<details id="topology-reference"><summary>Connection reference for a proposed low-pass design</summary>' + circuit('filtered') + '</details>' + steps([
      'Preserve your initial design before measuring. Obtain a wiring check. Different topologies require instructor review of DAC loading, bias and ADC voltage range before power is applied.',
      'For the shown low-pass layout, connect A0 through your resistor to the output node; connect your capacitor from that node to GND and A1 to that node. CH1 stays before the filter; CH2 measures after it.',
      'Allow settling. Compare time waveforms and spectra using comparable settings and amplitude conventions. Check that the source itself has not changed under load.',
      'Manually save the filtered FFT screenshot and the original CH2 time-domain waveform as Detail CSV. Retain the baseline recording and label all runs and nodes.',
      'Measure all six tone amplitudes. Record predicted and measured attenuation, actual components and limitations. If you redesign, keep the first design and explain the correction.',
    ]) + fields(record, 'design', Object.fromEntries(Object.entries(DESIGN_FIELDS).slice(7))) + EQUATIONS.attenuation + '<p>For linear amplitudes use the same units and convention before calculating ratios. For dBV readings, input minus output gives positive attenuation directly; do not divide dBV values. A missing peak is a measurement limit, not evidence of infinite attenuation.</p>')
    + table(record, 'spectrum') + captures(record, 2, files, urls);
  if (index === 3) body = paper('Extend your repaired sketch', '<p>Keep the physical RC in place. RC is the measured A1 input; RC_MA and RC_EMA are two independent digital outputs computed from those same samples. They are computer traces, not additional physical Arduino analogue outputs.</p>' + EQUATIONS.ma + EQUATIONS.ema + '<p>The examples start with five MA samples and EMA coefficient 0.40 at 1,000 samples/s. Both initialize from their first valid input. Let startup transients settle before interpreting the plot. Choose and justify any changes; more smoothing can remove useful information.</p>'
      + `<details id="filter-examples"><summary>Working MA and EMA examples to integrate</summary><p>Insert the two classes and objects above the existing processSample function, then replace that function once. Keep the supplied timer, source and serial routines. Inspect every AI-proposed edit.</p><pre class="code-preview" tabindex="0" aria-label="Working MA and EMA example source">${esc(FILTER_EXAMPLE)}</pre><a href="${DOWNLOAD_BASE}FILTER_EXAMPLES.txt" download>Download the working examples</a></details>`
      + steps(['Start with a copy of your preserved, repaired generator sketch. Integrate the examples and compile/upload through Arduino IDE.',
        'Set DIGITAL_FILTERS to true after integrating the examples. Open Serial Plotter at 500,000 baud. Display RC, RC_MA and RC_EMA together, with a common vertical scale. Send plot if you previously paused for status. This is continuous live output, with no capture or replay command.',
        'Compare the effect of your MA window and EMA coefficient. Keep their input independent: neither filter should consume the other’s output.',
        'Save a screenshot yourself. Note settings, initialization, observed delay and useful-signal changes. Check status separately for actual rates, missed deadlines, overruns and clipping, then resume plot.',
        'Paste the full final sketch below and preserve it separately from the repaired generator version.'])
      + fields(record, 'digital', DIGITAL_FIELDS) + codeField(record, 'digital') + preserved(record, 'digital', 'Digital-filter version'))
    + table(record, 'digital') + captures(record, 3, files, urls)
    + paper('Interpret within the evidence', '<p>The Serial Plotter horizontal axis is a sample sequence, not a calibrated time measurement. Use sampling information and a stated method for delay claims. A live screenshot does not provide a frequency spectrum or quantitative digital-output SNR. Later analysis may recompute digital filters from retained RC samples and documented settings; label that as recomputation, not a captured board output.</p>');
  if (index === 4) body = paper('Review before you leave', summary(record, files))
    + paper('Keep the complete group evidence', steps([
      'Save in this browser, then download lab files (ZIP). Draft and incomplete backups can be downloaded at any stage.',
      'Check the download contains main_lab_backup.json, code/, screenshots/ and data/. The code folder includes current and preserved sketches where entered; original attachment bytes are retained.',
      'Each member keeps this group ZIP and their own pre-lab ZIP for the future individual post-lab. This worksheet never imports or rewrites an individual pre-lab.',
      'Restore the complete JSON or original ZIP in this worksheet when changing devices. Review the import preview before confirming replacement.',
    ]) + '<div class="actions"><button data-action="save">Save in this browser</button><button data-action="zip" class="primary">Download lab files (ZIP)</button><button data-action="export">Download answers (JSON)</button><button data-action="print">Print or save report as PDF</button></div><p>Downloads are not submissions. Follow the separately supplied destination and deadline.</p>')
    + paper('Keep numerical recordings for later SNR analysis', EQUATIONS.snr + '<p>Retain baseline and filtered waveform CSVs with original timing, DC offset, acquisition settings and all six tones. Their total variation contains useful signal and interference; it is not noise-only RMS. Harmonic distortion and unexplained components require separate interpretation. Detailed calculations and conclusions belong in the later individual post-lab.</p>')
    + captures(record, 4, files, urls);
  return `<div class="screen-head"><span class="eyebrow">WEEK 12 · AIRCRAFT SIGNAL INVESTIGATION · ${index + 1} / 5</span><h1>${SCREENS[index]}</h1><p class="leadin">Preserve useful information. Investigate the interference.</p><p class="small">Suggested allowance: ${ALLOWANCES[index]} · keep backups throughout</p></div>${body}`;
}
function entries(record, prefix, labels) {
  return `<dl>${Object.entries(labels).map(([k, label]) => `<div><dt>${esc(label)}</dt><dd class="prewrap">${esc(record.fields[`${prefix}.${k}`] || 'Not entered')}</dd></div>`).join('')}</dl>`;
}
export function report(record, files, urls) {
  const issues = completeness(record, files), group = { ...GROUP_FIELDS };
  for (const n of [2, 3]) if (!record.fields[`group.student${n}Name`].trim() && !record.fields[`group.student${n}Id`].trim()) { delete group[`student${n}Name`]; delete group[`student${n}Id`]; }
  return `<header class="report-title"><h1>Noise and Filtering — Aircraft Signal Investigation</h1><p>2145427 · Group evidence · main-lab v2</p>${identityIssues(record).length || issues.length ? '<p class="report-warning">DRAFT / INCOMPLETE EVIDENCE — review the checklist.</p>' : ''}${entries(record, 'group', group)}<p>Workbook ${esc(record.recordId)} · Created ${esc(record.createdAt)} · Updated ${esc(record.updatedAt)} (computer times)</p></header>
    <section><h2>Apparatus</h2>${entries(record, 'setup', SETUP_FIELDS)}</section>
    <section><h2>Waveform and mathematics</h2>${waveform()}${EQUATIONS.resolution}${EQUATIONS.rc}${EQUATIONS.lowpass}${EQUATIONS.highpass}${EQUATIONS.attenuation}${EQUATIONS.ma}${EQUATIONS.ema}${EQUATIONS.snr}</section>
    <section><h2>Debugging and verification</h2>${entries(record, 'debug', DEBUG_FIELDS)}</section>
    <section><h2>Discovered FFT procedure</h2>${entries(record, 'scope', SCOPE_FIELDS)}</section>
    <section><h2>RC design and corrections</h2>${entries(record, 'design', DESIGN_FIELDS)}</section>
    <section><h2>Digital integration</h2>${entries(record, 'digital', DIGITAL_FIELDS)}</section>
    ${Object.keys(PRESERVE_FIELDS).map((id) => `<section><h2>${esc(id)} — preserved original</h2>${record.originals[id] ? `<p>Preserved ${esc(record.originals[id].at)}</p>${Object.entries(record.originals[id].fields).map(([k, v]) => `<h3>${esc(fieldLabels[k])}</h3>${k.startsWith('code.') ? `<pre class="code-preview">${esc(v)}</pre>` : `<p class="prewrap">${esc(v)}</p>`}`).join('')}` : '<p>Not preserved.</p>'}</section>`).join('')}
    ${['generator', 'digital'].map((id) => `<section><h2>Current ${id} sketch</h2><pre class="code-preview">${esc(record.fields[`code.${id}`] || 'Not entered')}</pre></section>`).join('')}
    ${Object.entries(TABLES).map(([id, t]) => `<section><h2>${t.title}</h2>${t.rows.map(([r, label]) => `<div class="report-row"><h3>${label}</h3>${entries(record, `${id}.${r}`, Object.fromEntries(t.columns.map((c) => [c.id, c.label])))}</div>`).join('')}</section>`).join('')}
    ${CAPTURES.filter((c) => c.kind !== 'optional' || files[`${c.id}.csv`] || files[`${c.id}.image`] || record.fields[`capture.${c.id}.notes`]).map((c) => `<section><h2>${c.label}</h2>${entries(record, `capture.${c.id}`, CAPTURE_FIELDS)}<p>CSV: ${esc(files[`${c.id}.csv`]?.filename || 'Not attached')}</p>${files[`${c.id}.image`] ? `<figure class="report-image"><img src="${urls[`${c.id}.image`]}" alt="${esc(c.label)}"><figcaption>${esc(files[`${c.id}.image`].filename)} · Original: ${esc(files[`${c.id}.image`].originalName)}</figcaption></figure>` : '<p>Image not attached.</p>'}</section>`).join('')}
    <section><h2>Evidence checklist</h2>${summary(record, files)}<p>Live plot screenshots do not establish digital-output SNR. Retain waveform CSVs and source code for the future individual analysis. This report is not proof of submission.</p></section>`;
}
