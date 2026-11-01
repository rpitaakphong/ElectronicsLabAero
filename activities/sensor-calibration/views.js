import {
  MAIN_FIELDS,
  SOURCES,
  BUDGET_SOURCES,
  ATTACHMENTS,
  FILE_KINDS,
  REQUIRED_FILES,
  pages,
  labels,
  draftIssues,
  csvGuidance,
  CSV_HEADERS,
  prerequisites,
  NUMERIC_FIELDS,
  numericIssue,
} from './model.js';
import { EQUATIONS, repeatGuide, mainFitGuide, fitGuide } from './equations.js';
import { rawCSV as legacyCSV } from './legacy/model.js';
export { EQUATIONS } from './equations.js';
export const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
const text = (value) =>
  `<div class="saved-text">${esc(value || '[not recorded]')}</div>`;
const card = (title, body) =>
  `<section class="paper"><div class="section-heading"><h2>${title}</h2></div>${body}</section>`;
export function field(
  record,
  key,
  print = false,
  multiline = true,
  label = null,
) {
  const title =
    label || labels(record.activityId.endsWith('main') ? 'main' : 'post')[key];
  const warning =
    !print && NUMERIC_FIELDS.has(key) ? numericIssue(record.fields[key]) : '';
  const codeAttributes =
    key === 'code'
      ? ' class="code-input" spellcheck="false" autocomplete="off"'
      : '';
  const maxLength = key === 'code' ? 1048576 : 16000;
  const input = multiline
    ? `<textarea id="f-${esc(key)}" data-field="${esc(key)}" rows="${key === 'code' ? 14 : key === 'design' ? 5 : 4}" maxlength="${maxLength}"${codeAttributes}>${esc(record.fields[key])}</textarea>`
    : `<input type="text" id="f-${esc(key)}" data-field="${esc(key)}" value="${esc(record.fields[key])}" maxlength="16000"${NUMERIC_FIELDS.has(key) ? ` aria-invalid="${warning ? 'true' : 'false'}" inputmode="decimal"` : ''}>`;
  return `<div class="field"><label for="f-${esc(key)}">${esc(title)}</label>${print ? text(record.fields[key]) : input}${warning ? `<span class="field-warning">${esc(warning)}</span>` : ''}</div>`;
}
const select = (value, choices, attrs) =>
  `<select ${attrs}>${[['', 'Choose an option.'], ...choices.map((x) => (Array.isArray(x) ? x : [x, x]))].map(([v, label]) => `<option value="${esc(v)}"${value === v ? ' selected' : ''}>${esc(label)}</option>`).join('')}</select>`;
export function uncertaintyCards(record, kind, print = false) {
  const sources = kind === 'main' ? SOURCES : BUDGET_SOURCES;
  const fields =
    kind === 'main'
      ? [
          [
            'value',
            'Give the ± limit or standard uncertainty, and state which it is.',
          ],
          ['units', 'State the units.'],
          [
            'distribution',
            'State the assumed distribution and any conversion used.',
          ],
          [
            'scope',
            'Does this affect readings separately or several readings together?',
          ],
          ['source', 'Name the measurement or specification you used.'],
          [
            'justification',
            'Explain how you chose the value and what you could not check.',
          ],
        ]
      : [
          [
            'estimate',
            'Give the estimated input value or its ± limit, and state which it is.',
          ],
          ['units', 'State the input units.'],
          ['distribution', 'State the assumed distribution and conversion.'],
          ['standard', 'Calculate the standard input uncertainty u(q).'],
          [
            'coefficient',
            'Calculate the sensitivity coefficient ∂x/∂q and give its units.',
          ],
          [
            'contribution',
            'Calculate this uncertainty contribution in distance units (cm).',
          ],
          ['scope', 'Explain which readings or quantities share this effect.'],
          [
            'accounted',
            'State whether this effect is already included in another calculation.',
          ],
          [
            'justification',
            'Show how you obtained the value and explain any assumptions.',
          ],
        ];
  return sources
    .filter(
      ([id]) =>
        !print ||
        kind !== 'main' ||
        Object.values(record.uncertainty[id]).some((value) => value.trim()),
    )
    .map(([id, title]) => {
      const values = record.uncertainty[id];
      if (print)
        return `<section class="print-uncertainty"><h4>${esc(title)}</h4><dl>${[
          ['status', 'Choose how you obtained this estimate.'],
          ...fields,
        ]
          .filter(([key]) => kind !== 'main' || values[key].trim())
          .map(
            ([key, label]) =>
              `<dt>${esc(label)}</dt><dd>${esc(values[key] || '[not recorded]')}</dd>`,
          )
          .join('')}</dl></section>`;
      const u = (key, label, choices = null) =>
        `<div class="field ${['justification', 'accounted'].includes(key) ? 'wide' : ''}"><label for="u-${id}-${key}">${esc(label)}</label>${print ? text(values[key]) : choices ? select(values[key], choices, `id="u-${id}-${key}" data-uncertainty="${id}" data-key="${key}"`) : `<textarea rows="2" id="u-${id}-${key}" data-uncertainty="${id}" data-key="${key}" maxlength="16000">${esc(values[key])}</textarea>`}</div>`;
      return `<fieldset class="uncertainty-card"><legend>${esc(title)}</legend><div class="fields">${u('status', 'Choose how you obtained this estimate.', ['Bound estimate', 'Standard uncertainty', 'Not quantified', 'Not applicable'])}${fields.map(([key, label]) => u(key, label)).join('')}</div></fieldset>`;
    })
    .join('');
}

const earlierMainFields = [
  'ruler',
  'origin',
  'alignment',
  'graduation',
  'accuracy',
  'placement',
  'environment',
];
function earlierMeasurementNotes(record, print = false) {
  const fields = earlierMainFields.filter((key) => record.fields[key].trim());
  const uncertainty = uncertaintyCards(record, 'main', true);
  if (!fields.length && !uncertainty) return '';
  return `<details class="earlier-notes"${print ? ' open' : ''}><summary>Read your earlier measurement notes.</summary>${fields.map((key) => field(record, key, true)).join('')}${uncertainty}</details>`;
}
const earlierFitFields = ['uIntercept', 'uSlope', 'covariance'];
function earlierFitNotes(record, print = false) {
  const fields = earlierFitFields.filter((key) => record.fields[key].trim());
  if (!fields.length) return '';
  return `<details class="earlier-fit-notes"${print ? ' open' : ''}><summary>Read your earlier parameter uncertainty calculations.</summary><p>These saved entries are retained from an earlier worksheet. Complete parameter uncertainties and covariance in the individual post-lab.</p>${fields.map((key) => field(record, key, true)).join('')}</details>`;
}
function groupProcedureNotes(state, print) {
  if (!state.parsedSource) return '';
  const record = state.parsedSource.record;
  return `<details${print ? ' open' : ''}><summary>Read your group’s calibration procedure and measurement notes.</summary>${['xVariable', 'yVariable', 'design'].map((key) => field(record, key, true)).join('')}${earlierMeasurementNotes(record, print)}</details>`;
}

function attachment(state, slot, print = false, source = false) {
  const kind = source ? 'main' : state.kind,
    f = (source ? state.parsedSource?.files : state.files)?.[slot],
    category = FILE_KINDS[slot] || 'image';
  const photoAlreadyPresent =
    slot === 'circuit' && (state.files.circuit2 || state.files.circuit3);
  if (
    print &&
    !f &&
    (!REQUIRED_FILES[kind].includes(slot) || photoAlreadyPresent)
  )
    return '';
  const label = ATTACHMENTS[kind][slot],
    url = state.urls[`${source ? 'source' : 'own'}-${slot}`];
  let preview = '<p class="muted">No file is attached here.</p>';
  if (f) {
    const original = f.originalName || f.filename;
    if (category === 'image' && url)
      preview = `<figure><img src="${esc(url)}" alt="${esc(label)}"><figcaption>${esc(original)}</figcaption></figure>`;
    else if (category !== 'image') {
      const content = f.text ?? '',
        shown = print ? content : content.slice(0, 16000);
      const guidance = category === 'csv' ? csvGuidance(content, slot) : null;
      preview = `<p class="filename">${esc(original)}</p>${guidance ? `<p>This CSV is shown as read-only text. ${guidance.rows.length ? `${guidance.rows.length - 1} data rows were read.` : ''}</p>${guidance.issues.length ? `<div class="notice"><p>Check the source CSV, then upload a replacement. Your original file is kept.</p><ul>${guidance.issues.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>` : '<p>The basic CSV format check found no issues. Check the measurements and analysis yourself.</p>'}` : ''}<details${print ? ' open' : ''}><summary>Read the uploaded ${category === 'csv' ? 'CSV' : 'Arduino code'}.</summary><pre class="file-preview">${esc(shown)}</pre>${shown.length < content.length ? '<p>Only the first 16,000 characters are shown here. Download the original to read the complete file.</p>' : ''}</details>`;
    }
    if (!print && url)
      preview += `<p><a href="${esc(url)}" download="${esc(original)}">Download the original file</a></p>`;
  }
  const limit =
    category === 'image'
      ? 'Choose PNG, JPEG, BMP or WebP, up to 10 MiB per image.'
      : category === 'code'
        ? 'Choose the UTF-8 .ino file you uploaded to the Arduino, up to 1 MiB.'
        : 'Choose a UTF-8 .csv file, up to 5 MiB. Its original contents are kept, including incomplete drafts.';
  return `<div class="attachment" data-slot="${slot}"><h3>${esc(label)}</h3>${preview}${print || source ? '' : `<div class="actions"><button data-file="${slot}">${f ? 'Replace' : 'Upload'} ${category === 'image' ? 'image' : category === 'code' ? '.ino file' : 'CSV file'}</button>${f ? `<button data-remove-file="${slot}">Remove file</button>` : ''}</div><p class="hint">${limit} All attachments together can be up to 32 MiB. Attaching a file saves it locally; it does not submit it to a server.</p>`}</div>`;
}
import { csvLayoutImage } from './csv-layout.js';
function csvExample() {
  return `<figure class="csv-example"><img src="${csvLayoutImage}" alt="CSV example with five columns: trial, condition, reference distance (cm), echo time (us), and note. Trial labels 1, 2 and 3 identify the calibration runs. Each row is one echo attempt; placeholders indicate students’ own ruler readings and echo durations. A failed echo has an empty time cell and an explanation in note. Excluded readings keep their original value and an exclusion reason."><figcaption>This image shows the layout only. It contains no measured results.</figcaption></figure><p>Use these five column headings:</p><p class="csv-headings"><code>${CSV_HEADERS.join(',')}</code></p><p><strong>Trial</strong> identifies calibration run 1, 2 or 3. Repeat the trial number for every reading from that run, using one row per echo attempt. <strong>Condition</strong> describes the target orientation. Record the actual ruler distance in cm and raw echo time in us (microseconds, µs).</p><p>Use <strong>note</strong> for observations. If no echo is returned, leave the echo-time cell empty and explain what happened. For an excluded reading, keep its original value and begin the note with <code>Excluded:</code>, followed by your reason. The note may be blank for an ordinary valid reading.</p><p>Save as CSV in UTF-8. Use the same headings for validation and the target-angle investigation. If your Arduino program produces a different layout, organize its readings into this layout before uploading. Keep every attempt.</p>`;
}
const groups = (r, keys, print) =>
  keys.map((k) => field(r, k, print, false)).join('');
export function mainContent(state, page, print = false) {
  const r = state.record,
    f = (k) => field(r, k, print);
  let body = '';
  if (page === 0)
    body =
      card(
        'Calibrate your ultrasonic sensor.',
        `<p>Before collecting calibration data, you need a system that records raw echo duration. Your circuit photograph, code and timing notes will record how those readings were obtained.</p><p class="eyebrow">2145427 · Group main lab · Allow approximately three hours. Suggested time for this section: 0–40 min.</p><p><strong>Objective:</strong> Build an Arduino ultrasonic measurement system, calibrate echo time against ruler distance, estimate its sensitivity and uncertainty, and investigate how target angle affects its readings.</p><p>In the prelab, the thermometer provided the reference and the sensor produced an ADC reading. Here, the ruler replaces the reference thermometer and echo duration replaces the ADC count. This experiment measures pulse duration.</p><ol><li><strong>Record your group and equipment details.</strong> Work in a group of one to three students using one shared workbook on one computer. Enter your group ID, date, member names and IDs, and the board and sensor models below. Leave unused member fields blank.</li><li><strong>Build the measurement system.</strong> Use an Arduino UNO R4 WiFi, HC-SR04, USB cable, breadboard, wires, ruler and a flat target. Work out the connections using appropriate documentation, and develop or generate your own Arduino program.</li><li><strong>Test the readings.</strong> Check that your program records raw echo duration in µs and distinguishes a failed echo from a valid measurement. Check how it handles a missing echo before you start collecting calibration data.</li><li><strong>Save a photograph and your code.</strong> Upload one clear photograph of the actual connected circuit and paste the Arduino code you used into the box below.</li><li><strong>Explain how the system takes measurements.</strong> Describe how the circuit and program measure echo duration and handle a missing echo. Record the timing method, measurement interval, timeout, board-core version and any documented timing limits.</li></ol><p>The times in this workbook are suggestions. Use your chosen software for calculations and plots. You can save unfinished work at any time.</p>`,
      ) +
      card(
        'Enter your group details.',
        `<p>These details identify the group and measurement system used for the experiment. Give every member a copy of the downloaded group ZIP.</p><div class="fields">${groups(r, ['groupId', 'labDate', ...[1, 2, 3].flatMap((n) => [`member${n}Name`, `member${n}Id`]), 'board', 'sensor'], print)}</div>`,
      ) +
      card(
        'Add your circuit photo and code.',
        `<p>The photograph and code keep a record of the system you used. Later instructions are always readable. Later answers and uploads become available after a circuit photograph is attached and code is entered. This checks that both are present; it does not certify the circuit or program.</p>${attachment(state, 'circuit', print)}${f('code')}${f('setupNotes')}${f('timing')}<p class="hint">Consult the <a href="https://docs.arduino.cc/hardware/uno-r4-wifi/">official board documentation</a> and the documentation for your sensor and chosen timing method.</p>`,
      );
  if (page === 1)
    body = `<section class="paper calibration-plan"><p>Calibration establishes the relationship between a reference measurement and the output of a sensor system. You collect paired measurements over a chosen range and fit a relationship that can be used to convert later sensor readings into measured quantities. Repeated readings let you examine how much the output varies.</p><p class="eyebrow">Suggested time: 40–55 min.</p><p>In this experiment, you will work with ruler measurements and raw echo durations. Plan how you will collect the paired readings so another group could follow your procedure.</p><ol><li><strong>Identify your graph variables.</strong> In the two short boxes below, name the quantity and unit you will use for x and for y.</li><li><strong>Choose your distances and repeated readings.</strong> Explain your choice of range, positions and number of readings at each position. Complete three runs and reserve two other distances for later checks.</li><li><strong>Describe how you will take the measurements.</strong> Explain where you will measure distance from, how you will hold the target, and what you will keep consistent. Include the ruler’s smallest division and your estimated positioning limit. Keep these details together in your procedure.</li></ol><div class="fields calibration-axes">${groups(r, ['xVariable', 'yVariable'], print)}</div><p>You may write in paragraphs, steps or brief notes.</p>${f('design')}${earlierMeasurementNotes(r, print)}</section>`;
  if (page === 2)
    body = card(
      'Record your measurements.',
      `<p>These measurements will provide the paired ruler distances and echo times for your calibration. Repeated readings show the variation while the target is fixed; three separate runs let you compare the results after repositioning.</p><p class="eyebrow">Suggested time: 55–105 min.</p><ol><li><strong>Prepare your data file.</strong> Create your data table in your own software using the five-column layout shown below. Use one row for each measurement attempt. There is no measurement-entry table in this workbook.</li><li><strong>Set the measurement reference.</strong> Secure the sensor and ruler, and use the distance reference points defined in your procedure. Hold the flat target perpendicular to the measurement direction.</li><li><strong>Measure the chosen positions in Run 1.</strong> Position the target at each chosen distance and record the actual ruler reading in cm. Keep the target fixed while collecting your chosen number of consecutive echo-time readings in µs. Keep every attempt, including failed echoes and readings you later exclude. Use trial label 1 for every reading in this run.</li><li><strong>Repeat the complete procedure for Runs 2 and 3.</strong> Reposition the target and measure all your chosen positions again in each run. Use trial labels 2 and 3 respectively. Keep the readings from the three runs identifiable.</li><li><strong>Record changes and save the CSV.</strong> Note changes in alignment, timing, surroundings or procedure, along with failed echoes and exclusion reasons. Save the CSV in UTF-8. You will upload it with your calibration graph in Section 4.</li></ol>${csvExample()}${f('runNotes')}`,
    );
  if (page === 3)
    body =
      card(
        'Calculate means and fit the line.',
        `<p>This section turns the paired measurements into a calibration line you can use to calculate distance from echo time. The means describe the average response, the sample standard deviations describe the spread, and the fitted slope gives the sensitivity.</p><p class="eyebrow">Suggested time: 105–135 min.</p>${mainFitGuide()}${f('provisionalEquation')}<div class="fields">${groups(r, ['intercept', 'slope', 'inverse'], print)}</div>${f('provisionalWorking')}${earlierFitNotes(r, print)}`,
      ) +
      card(
        'Upload your CSV and graph.',
        `<p>Keep the original measurements and calibration graph together so each group member can use them in the individual post-lab. Upload the CSV containing every measurement attempt, including failed and excluded readings, and the graph showing the run-and-position means and fitted line.</p>${attachment(state, 'calibrationData', print)}${attachment(state, 'calibration', print)}`,
      );
  if (page === 4)
    body = card(
      'Compare calculated distances with the ruler.',
      `<p class="eyebrow">Suggested time: 135–155 min.</p><p>This test checks whether your fitted calibration predicts distances at positions that were not used to fit the line. You will calculate two distances from echo times and compare them with ruler measurements.</p><ol><li><strong>Choose two new positions.</strong> Use two distances within your calibration range that were not used to fit the line. Keep these readings out of the fit.</li><li><strong>Collect repeated readings.</strong> At each position, record the actual ruler distance using the same distance reference point as before. Note your positioning limit. Hold the target stationary and perpendicular to the sensor while collecting repeated echo times, using the same program and timing settings. Record every attempt, including failed echoes and reasons for exclusions.</li><li><strong>Calculate the distance from the echo time.</strong> Calculate the mean and sample standard deviation of the valid readings you include at each position. Use that mean as t in the equation below. Keep a₀ and a₁ from your original calibration unchanged.${EQUATIONS.inverse}<p>Here, t is the mean echo time in µs, a₀ is the fitted intercept in µs, and a₁ is the fitted sensitivity in µs/cm. The result x̂ is the calculated distance in cm.</p></li><li><strong>Compare with the ruler.</strong> Calculate the signed error at each position.${EQUATIONS.signedError}<p>Subtract the ruler distance xᵣₑf from the calculated distance x̂. The error E is in cm. A positive error means the system reads high; a negative error means it reads low.</p></li><li><strong>Explain what the comparison shows.</strong> Discuss the size and direction of the errors alongside the scatter in your readings and your positioning limits. Complete the detailed uncertainty calculation and comparison in the individual post-lab.</li></ol><p>Upload the readings for these two positions as a separate CSV using the same headings as your calibration file. Record your calculations and explanation below.</p>${f('validationPlan')}${attachment(state, 'validationData', print)}${f('validationWorking')}${f('validationDiscussion')}${attachment(state, 'validation', print)}`,
    );
  if (page === 5)
    body = card(
      'Compare the three target orientations.',
      `<p class="eyebrow">Suggested time: 155–175 min.</p><p>This test checks whether changing the target’s angle changes the calculated distance, the spread of the readings or the number of failed echoes while you try to keep its ruler position fixed. Returning the target to its original orientation lets you check whether the earlier readings return.</p><ol><li><strong>Choose a position and mark your reference point.</strong> Use a distance within your calibration range. Mark the point on the target that you will use for ruler measurements. Measure from the same sensor reference point as before, and record the distance in cm and your positioning limit. Keep the sensor, target material and size, program and timing settings unchanged throughout the test.</li><li><strong>Measure with the target perpendicular.</strong> Set the target face at right angles to the measurement direction. Hold it stationary and collect repeated echo-time readings. Use the same number of measurement attempts for each of the three orientations so you can compare failed-echo counts. Label this set <code>perpendicular</code>.</li><li><strong>Tilt the target and measure again.</strong> Change the angle while trying to keep the marked reference point fixed. Record its actual ruler distance, then hold the target stationary and collect another repeated set. State the angle in degrees if you measured it; otherwise describe how you set it and label the angle as estimated. Label this set <code>tilted</code>.</li><li><strong>Return the target and repeat.</strong> Restore the original orientation and reference-point position. Check and record the ruler distance, then collect the final repeated set. Label this set <code>returned</code>. Record any difficulty restoring the position.</li><li><strong>Calculate and compare the three sets.</strong> For each orientation, calculate the mean echo time and sample standard deviation in µs from the valid readings you include. Use your original calibration and the equation in Section 5 to convert each mean into distance in cm. Keep the fitted coefficients unchanged. Count the failed echoes, and make a graph comparing the three orientations with labelled axes and units.</li><li><strong>Explain what changed.</strong> Compare the tilted set with the initial perpendicular set. Then compare the returned set with the initial set. Discuss the calculated distances, scatter and failed echoes alongside the recorded ruler positions and positioning limits. Explain whether restoring the target brought the readings back. Tilting also changes the reflecting geometry, so the comparison alone may not isolate one cause.</li></ol><p>Upload a separate CSV using the same five headings as before and the condition labels <code>perpendicular</code>, <code>tilted</code> and <code>returned</code>. Keep every attempt, explain failed echoes and exclusions in the notes, and retain excluded values. Upload your comparison graph and include the failed-echo counts in its caption or your explanation.</p>${f('anglePlan')}${attachment(state, 'angleData', print)}${attachment(state, 'angle', print)}${f('angleWorking')}${f('angleDiscussion')}`,
    );
  if (page === 6)
    body = card(
      'Save and share your group file.',
      `<p class="eyebrow">Suggested time: 175–180 min.</p><p>Your group ZIP includes the circuit photograph, pasted Arduino code, original CSV files, graphs, procedure and measurement-limit notes. Each student opens that file in the separate individual post-lab and completes their own detailed calculations and explanations.</p><p>There is no instructor sign-off during this workbook. Your instructor checks the calculations and explanations in the post-lab. Downloading or printing does not submit your work.</p>${f('unfinished')}${review(state)}${print ? '' : saveButtons('main')}<p><a href="/sensor-calibration/post-lab" target="_top">Open the individual post-lab.</a></p>`,
    );
  if (page > 0 && !print && !prerequisites(state.files, state.record))
    return `<p class="notice" id="upload-lock">Upload a circuit photograph and paste your Arduino code in Section 1 before editing later answers or attaching more files. You can read all instructions and save unfinished work.</p><fieldset class="gate-controls" disabled aria-describedby="upload-lock">${body}</fieldset>`;
  return body;
}
function sourceOverview(state, print) {
  if (!state.parsedSource)
    return '<p class="empty">Open your group’s version-two ZIP or JSON file to read its work here.</p>';
  const r = state.parsedSource.record;
  return `<p class="source-tag">Read your group’s original work.</p><p>Group: ${esc(r.fields.groupId || '[not recorded]')} · File: ${esc(state.source.name)}. These entries are read-only. Make changes in the group workbook and export a new group file if needed.</p><details${print ? ' open' : ''}><summary>Read the group’s procedure, results and measurement limits.</summary>${Object.keys(
    MAIN_FIELDS,
  )
    .filter(
      (k) =>
        k !== 'help' &&
        !earlierMainFields.includes(k) &&
        !earlierFitFields.includes(k),
    )
    .map((k) => field(r, k, true))
    .join(
      '',
    )}${earlierMeasurementNotes(r, print)}${earlierFitNotes(r, print)}</details><details${print ? ' open' : ''}><summary>Read the group’s uploaded files.</summary>${Object.keys(
    ATTACHMENTS.main,
  )
    .filter((slot) => state.parsedSource.files[slot])
    .map((slot) => attachment(state, slot, print, true))
    .join('')}</details>`;
}
function sourceData(state, slots, print) {
  return state.parsedSource
    ? `<details${print ? ' open' : ''}><summary>Read the group files for this calculation.</summary>${slots.map((slot) => attachment(state, slot, print, true)).join('')}</details>`
    : sourceOverview(state, print);
}
export function postContent(state, page, print = false) {
  const r = state.record,
    f = (k) => field(r, k, print);
  if (page === 0)
    return card(
      'Open your group’s work.',
      `<p>The individual post-lab uses your group’s measurements to explain how the calibration works, how uncertain a calculated distance is, and what limits the system. You will complete your own calculations, graphs and explanations.</p><ol><li><strong>Enter your details.</strong> Write your name and student ID below. Use Excel, MATLAB, Python or another program for the analysis; this workbook records your work without calculating answers or grades.</li><li><strong>Open your group’s saved file.</strong> Use the button below to open the group ZIP or JSON saved in class. The imported measurements, code, photographs and graphs are read-only.</li><li><strong>Review the measurements and procedure.</strong> Check that the file belongs to your group and includes the three calibration runs, two new test positions and target-angle investigation. Note missing readings, exclusions or incomplete work. Base your analysis on the recorded measurements and explain any gaps.</li><li><strong>Keep your individual work separate.</strong> Show your formulas or analysis code, upload your own plots, and write your own explanations. You can save unfinished work. If you replace the group file later, review your existing answers against the replacement.</li></ol><p>The ruler replaces the reference thermometer and echo duration replaces the ADC count from the prelab. No prelab upload is required.</p><div class="fields">${groups(r, ['name', 'studentId'], print)}</div>${print ? '' : `<p><button class="primary" data-action="source">${state.source ? 'Replace' : 'Open'} your group’s ZIP or JSON file</button>${state.source ? ' <button data-action="original">Download the original group file</button>' : ''}</p>`}${r.needsReview ? '<p class="notice">Your group source has changed. Your answers and attachments are still here. Review them against the replacement file.</p>' : ''}${sourceOverview(state, print)}`,
    );
  if (page === 1)
    return card(
      'Compare variation within and between runs.',
      `<p>Repeated readings show how much the output varies while the target stays still. Comparing the three runs shows how the results change after repositioning. You will examine both kinds of variation before fitting the calibration line.</p><ol><li><strong>Identify each repeated-reading set.</strong> Open the calibration CSV below and separate the readings by run and actual ruler position. Keep failed and excluded attempts visible, and explain which readings you include.</li><li><strong>Calculate each set’s mean and sample standard deviation.</strong>${repeatGuide()}<p>The number of sets depends on your group’s chosen positions. Keep one result for every run and position, including the number of readings used.</p></li><li><strong>Compare the three runs.</strong> At each position, compare the run means with the spread within each set. Explain which differences could be related to repositioning or changes recorded during the experiment. Keep the three run means separate for fitting.</li><li><strong>Record your calculations and interpretation.</strong> Show the formulas or code you used and explain which readings you treated as independent.</li></ol>${sourceData(state, ['calibrationData'], print)}${f('repeatWorking')}${f('repeats')}`,
    );
  if (page === 2)
    return (
      card(
        'Fit the calibration line.',
        `<p>The fitted line describes how mean echo time changes with ruler distance. Its slope gives the sensitivity, while residuals and coefficient uncertainties help you judge the fit and support the later uncertainty calculation.</p>${fitGuide()}${sourceData(state, ['calibrationData', 'calibration'], print)}<div class="fields">${groups(r, ['intercept', 'slope', 'uIntercept', 'uSlope', 'covariance', 'inverse'], print)}</div>${f('fitWorking')}${f('fitAssumptions')}${attachment(state, 'calibration', print)}${attachment(state, 'residuals', print)}`,
      ) +
      card(
        'Compare measured and nominal sensitivity.',
        `<p>A nominal sensitivity provides a benchmark for the measured slope. This comparison uses an assumed sound speed; it does not measure the sound speed in your classroom.</p><ol><li><strong>Calculate the nominal sensitivity.</strong> Use the explicitly assumed c₀ = 340 m/s.${EQUATIONS.sensitivity}<p>For round-trip sound travel, S₀ = 20000/c₀ gives the expected time change in µs/cm. The factor 20000 accounts for the outward-and-return path and the conversion between metres, centimetres, seconds and microseconds.</p></li><li><strong>Calculate the percentage difference.</strong> Use your fitted a₁ and calculated S₀ in this equation.${EQUATIONS.deviation}<p>D is the signed sensitivity deviation as a percentage of nominal sensitivity. A positive value means the fitted slope is larger than the benchmark; a negative value means it is smaller. Keep this percentage separate from percentages of output span.</p></li><li><strong>Explain the comparison.</strong> Discuss possible effects of geometry, reference measurements and classroom conditions. Distinguish the assumed benchmark from conditions you actually measured.</li></ol><div class="fields">${groups(r, ['nominalSensitivity', 'sensitivityDeviation'], print)}</div>${f('sensitivityDiscussion')}<p class="hint">See the round-trip relation in the <a href="https://cdn.sparkfun.com/datasheets/Sensors/Proximity/HCSR04.pdf">HC-SR04 datasheet</a>. The benchmark used here assumes c₀ = 340 m/s.</p>`,
      )
    );
  if (page === 3)
    return card(
      'Calculate error and repeatability measures.',
      `<p>This section describes the fitted offset, departures from the line and spread of repeated readings. Expressing these quantities relative to the fitted output span helps you compare their sizes while keeping their meanings distinct.</p><ol><li><strong>Calculate the fitted output span.</strong> Use the smallest and largest actual ruler distances included in the fit for xₘᵢₙ and xₘₐₓ.${EQUATIONS.span}<p>The span rₒ is in µs. A percentage of full-scale output (%FSO) uses this span as its denominator.</p></li><li><strong>Express the intercept relative to the span.</strong> Use the fitted intercept a₀ in µs.${EQUATIONS.offset}<p>O is the magnitude of an extrapolated offset in %FSO. It does not verify the error at zero physical distance. Explain how your chosen distance starting point affects this interpretation.</p></li><li><strong>Find the largest departure from the fitted line.</strong> Calculate the residual for every run-and-position mean, then find the largest absolute value.${EQUATIONS.residual}${EQUATIONS.linearity}<p>Each residual eⱼ is the measured mean minus the fitted echo time, in µs. Report the maximum absolute residual in µs and L in %FSO. Mean-response residuals include measurement scatter; they do not isolate intrinsic nonlinearity.</p></li><li><strong>Describe repeatability.</strong> Use the sample standard deviations sₜ in µs from Section 2. State the measure you choose, its units and any pooling across positions or runs. If you use the Chapter 10 convention, calculate:${EQUATIONS.repeatability}<p>R expresses 2sₜ as a percentage of span. State which sₜ you used and why. A ±2s range is a convention, not an exact 95% interval. If you use another repeatability measure, define it and use the same span to express it as a percentage.</p></li><li><strong>Explain what the measures tell you.</strong> Show your calculations and distinguish the extrapolated offset, maximum mean-response residual and repeatability. Explain any effects that your measurements cannot separate.</li></ol><div class="fields">${groups(r, ['outputSpan', 'offsetPercent', 'maxResidual', 'linearityPercent', 'repeatability', 'repeatabilityPercent'], print)}</div>${f('errorWorking')}${f('errorDiscussion')}`,
    );
  if (page === 4)
    return card(
      'Check the validation errors.',
      `<p>The two new positions test whether the original calibration predicts distances that were not used to fit the line. Comparing those predictions with ruler measurements shows the size and direction of the errors at the tested positions.</p><ol><li><strong>Review the two test positions.</strong> Open the group’s validation CSV below and identify the actual ruler distances and included readings. Keep these points out of the calibration fit.</li><li><strong>Summarize the repeated readings.</strong> Calculate the mean echo time and sample standard deviation in µs at each position. State how many readings you included and explain exclusions.</li><li><strong>Calculate distance using the original calibration.</strong> Use each mean echo time as t and keep the fitted coefficients unchanged.${EQUATIONS.inverse}<p>Here, t and a₀ are in µs, a₁ is in µs/cm, and the calculated distance x̂ is in cm.</p></li><li><strong>Calculate and interpret the signed errors.</strong>${EQUATIONS.signedError}<p>Subtract the ruler distance xᵣₑf from the calculated distance. E is in cm. Positive error means the system reads high; negative error means it reads low. Record both errors and the range you tested.</p></li><li><strong>Compare the errors with uncertainty.</strong> After completing Sections 6 and 7, return to discuss the errors alongside your uncertainty estimates. If calibration and validation used the same ruler or starting point, explain how that shared reference affects uncertainty in the comparison error.</li></ol>${sourceData(state, ['validationData'], print)}${f('validationWorking')}${f('validationDiscussion')}`,
    );
  if (page === 5)
    return card(
      'Justify your uncertainty estimates.',
      `<p>An uncertainty budget explains which effects limit a reported distance and how you estimated their sizes. You will identify the significant contributions here, then combine them in Section 7.</p><ol><li><strong>Choose the result you will report.</strong> Select one of the two validation positions. State whether your result comes from one echo-time reading or an average, and identify the readings used.</li><li><strong>Identify the significant sources.</strong> Review your group’s procedure and measurement notes below. Consider repeated-reading scatter, fitted coefficients, ruler measurements, the distance starting point, positioning, alignment, timing and relevant changes during measurement. Explain any important source you cannot quantify.</li><li><strong>Express estimates as standard uncertainties.</strong> State each estimate’s units, source and distribution assumption.${EQUATIONS.uncertainty}<p>For n independent repeated readings, u(t̄) = sₜ/√n estimates the standard uncertainty of the mean in µs. The sample standard deviation sₜ describes the spread of individual readings; dividing by √n is appropriate for the mean under the independence assumption. For a justified uniform bound ±a on an input q, use u(q) = a/√3 in the bound’s units.</p>${EQUATIONS.ruler}<p>If rounding is uniform within half a ruler division Δ, use Δ/√12 in the ruler’s units. Explain why this assumption is appropriate. The smallest division alone does not describe the complete ruler accuracy or positioning uncertainty.</p></li><li><strong>Distinguish separate and shared effects.</strong> Identify which contributions affect individual readings and which are shared across placements or the whole experiment. An uncertain ruler scale or origin does not shrink simply because more echoes were recorded. Type A means an evaluation from statistical observations; Type B uses other information such as specifications or justified bounds. These terms do not mean random and systematic.</li><li><strong>Complete the budget and justify it.</strong> Use the entries below to record each estimate, standard uncertainty and explanation. Section 7 explains the sensitivity coefficients used to convert input uncertainties into distance contributions. State whether an effect is already included elsewhere so you can avoid counting it twice. Mark unsupported estimates as not quantified and explain what information is missing.</li></ol>${groupProcedureNotes(state, print)}${uncertaintyCards(r, 'post', print)}${f('budgetDiscussion')}<p class="hint">See the <a href="https://www.nist.gov/pml/nist-technical-note-1297/nist-tn-1297-appendix-law-propagation-uncertainty">NIST guide to uncertainty propagation</a>.</p>`,
    );
  if (page === 6)
    return card(
      'Combine the uncertainty contributions.',
      `<p>This section turns your uncertainty budget into a standard uncertainty for one calibrated distance. You will first calculate the part associated with the regression, then explain how reference measurements and other significant effects enter the full result.</p><ol><li><strong>State the distance calculation and its inputs.</strong> Use the validation result chosen in Section 6.${EQUATIONS.inverse}<p>Let t be the echo-time input in µs and uₜ its standard uncertainty in µs. The intercept a₀ is in µs, the slope a₁ is in µs/cm, and x̂ is in cm. Use the uncertainty of one reading or an average consistently with the result you report.</p></li><li><strong>Calculate the regression contribution.</strong> Use the coefficient uncertainties and covariance from the same fit.${EQUATIONS.propagation}<p>This first-order formula assumes that the new echo-time measurement is independent of the fitted coefficients. Keep the covariance sign. The square root of the result gives uᵣₑg in cm. This is regression-conditional uncertainty: it is conditional on the reference distances treated as fixed in ordinary regression, so it is not automatically the full distance uncertainty.</p></li><li><strong>Include reference measurements and other significant effects.</strong> Write a measurement model explaining how ruler scale, the origin, positioning, timing and any corrections affect the calibrated distance.${EQUATIONS.combined}<p>Here, qᵢ are the model’s input quantities, u(qᵢ) are their standard uncertainties, and cᵢ = ∂x/∂qᵢ are sensitivity coefficients. These coefficients describe how the calculated distance changes with each input; they are distinct from the sensor slope a₁. Express each cᵢu(qᵢ) contribution in cm. Combine independent contributions by root-sum-of-squares and include covariance for shared effects. The combined standard uncertainty u꜀ is in cm.</p></li><li><strong>Check for duplicate contributions.</strong> Do not count the same effect twice. Scatter, differences among runs or placement may already affect fitted coefficient uncertainty. Shared reference effects need an explicit model and do not shrink with the number of echoes. Explain how you included them rather than adding the same uncertainty again. You may use errors-in-variables fitting or Monte Carlo propagation if you describe the model and assumptions.</li><li><strong>Report the combined result.</strong> Record uᵣₑg and u꜀ separately, show your calculation or code, and explain the reference contributions and any significant unquantified limitation. Use the result when discussing the errors in Section 5.</li><li><strong>Report expanded uncertainty if you use it.</strong>${EQUATIONS.expanded}<p>Expanded uncertainty U is in the same units as u꜀. State and justify the coverage factor k. Taking k = 2 does not automatically give an exact 95% interval, especially with few independent observations. Leave the optional expanded-uncertainty fields blank if you report only standard uncertainty.</p></li></ol><div class="fields">${groups(r, ['propagationPoint', 'propagationTime', 'uTime', 'conditionalU', 'combinedU'], print)}</div>${f('referencePropagation')}${f('propagationWorking')}<div class="fields">${groups(r, ['expandedU'], print)}${f('coverage')}</div>${attachment(state, 'working', print)}<p class="hint">The <a href="https://www.itl.nist.gov/div898/handbook/mpc/section3/mpc3673.htm">NIST inverse-calibration example</a> includes slope–intercept covariance and discusses limitations of propagation.</p>`,
    );
  if (page === 7)
    return card(
      'Compare the three target orientations.',
      `<p>The angle test examines how the system’s readings change when the target is tilted. Comparing the returned target with the initial position helps you judge whether the earlier readings were restored.</p><ol><li><strong>Review how the test was performed.</strong> Open the group’s angle-test CSV and graph below. Identify the perpendicular, tilted and returned sets. Explain how the target reference point was held or remeasured, note any change in ruler position, and state whether the angle was measured or estimated.</li><li><strong>Summarize all three sets.</strong> Calculate each set’s mean echo time and sample standard deviation in µs. State the number of attempts, included readings and failed echoes. Explain exclusions and account for different attempt counts if they occurred.</li><li><strong>Apply the original calibration.</strong> Use the equation from Section 5 and the same a₀ and a₁ for all three mean echo times. Report the calculated distances in cm and compare them with the recorded ruler positions.</li><li><strong>Compare the tilted and returned readings.</strong> Compare the tilted set with the initial perpendicular set, then compare the returned set with the initial set. Discuss the differences alongside the scatter and reference-position limits. Explain whether the original calibration remained useful when tilted and whether returning the target restored the earlier readings.</li><li><strong>Explain the limits of the comparison.</strong> Tilting changes the reflecting geometry and may affect echo availability. Explain what your experiment can distinguish from changes in position or repeated-reading scatter. Additional displayed digits alone do not establish accuracy. Upload your comparison graph with labelled axes and units, and include failed-echo counts in its caption or your explanation.</li></ol>${sourceData(state, ['angleData', 'angle'], print)}${f('angleWorking')}${f('angleDiscussion')}${attachment(state, 'angle', print)}`,
    );
  return card(
    'Report your result and limitations.',
    `<p>Your conclusion should tell a reader what distance you can report, how uncertain it is, and where the calibration is supported by your measurements. This final section also saves your individual work together with the original group files.</p><ol><li><strong>Report one distance with uncertainty.</strong> Give the distance, uncertainty and units. State whether the result represents one reading or an average, and whether you report standard or expanded uncertainty. If expanded, state the coverage factor.</li><li><strong>State the supported range and limitations.</strong> Identify the calibration range and the two validation positions. Explain what the distance checks and target-angle test support, and identify the dominant limitation.</li><li><strong>Propose one improvement you could test.</strong> Describe a specific change and how you would compare measurements to decide whether it helped.</li><li><strong>Review your individual work.</strong> Complete your conclusion and state which software, AI tools or other help you used. Check your answers, units, calculations and plots. If the group source was replaced, review your work against that file and confirm below.</li><li><strong>Save your files.</strong> Download the individual ZIP and keep a backup before closing or changing devices. It includes your answers and graphs plus the exact original group file. The entry check below identifies missing items; it does not assess scientific correctness or give a grade. Downloading or printing does not submit your work.</li></ol>${f('conclusion')}${f('help')}${r.needsReview && !print ? '<label class="check"><input type="checkbox" data-action="reviewed"> I have checked my answers against the replacement group file.</label>' : ''}${review(state)}${print ? '' : saveButtons('post')}<p>Submit your work using the process specified by your instructor.</p>`,
  );
}
export function review(state) {
  const issues = draftIssues(state.record, state.kind, !!state.source);
  for (const slot of REQUIRED_FILES[state.kind])
    if (
      !state.files[slot] &&
      !(slot === 'circuit' && (state.files.circuit2 || state.files.circuit3))
    )
      issues.push(ATTACHMENTS[state.kind][slot]);
  for (const [slot, f] of Object.entries(state.files))
    if (FILE_KINDS[slot] === 'csv')
      issues.push(
        ...csvGuidance(f.text, slot).issues.map(
          (s) => `${f.originalName}: ${s}`,
        ),
      );
  return `<div class="review"><h3>Check your entries before saving.</h3><p>This check identifies missing entries and CSV format issues. It does not check scientific correctness or give a grade. You can download unfinished work.</p>${issues.length ? `<ul>${issues.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : '<p>No entries are missing from this basic check. Read your calculations and explanations before submitting.</p>'}</div>`;
}
function saveButtons(kind) {
  return `<div class="actions"><button class="primary" data-action="zip">Download your ${kind === 'main' ? 'group' : 'individual'} ZIP</button><button data-action="json">Download a JSON backup</button><button data-action="csv">Download the original measurement CSV files</button><button data-action="print">Print your report or save it as PDF</button></div>`;
}
export function report(state) {
  return `<h1>2145427 · Calibrate an ultrasonic measurement system</h1><p>${state.kind === 'main' ? 'Group lab' : 'Individual post-lab'} · Worksheet version 2.</p><p>Last edited: ${esc(state.record.updatedAt)}.</p>${pages(
    state.kind,
  )
    .map(
      (title, i) =>
        `<section class="report-section"><h2 class="report-heading">${i + 1}. ${esc(title)}</h2>${state.kind === 'main' ? mainContent(state, i, true) : postContent(state, i, true)}</section>`,
    )
    .join('')}`;
}
export function legacyView(parsed) {
  const r = parsed.record;
  return `<p>This is version-one work. It is shown read-only and does not replace your version-two workbook. Download a recovery ZIP before closing this view.</p><p>Last edited: ${esc(r.updatedAt)}</p><details><summary>Read the saved answers and uncertainty notes.</summary>${Object.entries(
    r.fields,
  )
    .map(([k, v]) => `<h3>${esc(k)}</h3>${text(v)}`)
    .join(
      '',
    )}<pre class="file-preview">${esc(JSON.stringify(r.uncertainty, null, 2))}</pre></details>${r.measurements ? `<details><summary>Read the saved measurement CSV.</summary><pre class="file-preview">${esc(legacyCSV(r))}</pre></details>` : ''}<p>The recovery ZIP retains attachments and any original group source. No old record is converted or overwritten.</p>`;
}
