import {
  esc,
  paper,
  box,
  definitionList,
  report as mainReport,
  analysisForm,
  analysisLabels,
} from '../555-main-lab/views.js';
import { groupStudents } from '../555-main-lab/model.js';
import { PAGES, issues } from './model.js';
import { answerProgress, DISCUSSION_KEYS } from './calculations.js';
import { comparisonSection, legacyComparison } from './comparison.js';

const names = {
  high_time: 'HIGH time',
  low_time: 'LOW time',
  high_duty: 'HIGH duty cycle',
  period: 'Period',
  frequency: 'Frequency',
  reasoning: 'Reasoning',
  selections: 'Predicted changes',
  periods_seconds: 'Periods (s)',
  original: 'Original',
  modified: 'Modified',
  decision: 'Decision',
  initial: 'Initial attempt',
  retry: 'Retry',
  working_response: 'Revised response',
  initial_snapshot: 'Original response',
  captured_at_client: 'Captured (computer time)',
  recorded_at_client: 'Recorded (computer time)',
  ai_use: 'Declared AI use',
  assistance: 'Assistance',
  claims: 'Claims and verification',
  prompt_copied: 'Prompt copied',
  s04thought: 'Switching-threshold explanation',
  s5high: 'Calculated HIGH time',
  s5low: 'Calculated LOW time',
  s5period: 'Calculated period',
  s5frequency: 'Calculated frequency',
  s5duty: 'Calculated duty cycle',
};
export function evidenceTree(value) {
  if (value === null) return '<span class="missing">Not recorded</span>';
  if (Array.isArray(value))
    return value.length
      ? `<ol>${value.map((item) => `<li>${evidenceTree(item)}</li>`).join('')}</ol>`
      : '<span class="muted">None recorded</span>';
  if (typeof value === 'object')
    return `<dl>${Object.entries(value)
      .map(
        ([key, item]) =>
          `<div><dt>${esc(names[key] || key.replaceAll('_', ' '))}</dt><dd>${evidenceTree(item)}</dd></div>`,
      )
      .join('')}</dl>`;
  return `<span class="prewrap">${typeof value === 'boolean' ? (value ? 'Yes' : 'No') : esc(value === '' ? 'Not recorded' : value)}</span>`;
}
export function prelabEvidence(prelab, includeHistory = true) {
  if (!prelab)
    return box(
      'Pre-lab not imported',
      'Choose your finalized pre-lab ZIP or prelab_evidence.json on Import files.',
    );
  return paper(
    'Your pre-lab evidence',
    box(
      'Hypothetical teaching scenarios',
      'These are your pre-lab responses, not physical measurements. Component values differ from the bench designs. No numerical experimental-error comparison is made between these scenarios and the main lab.',
    ) +
      definitionList(
        {
          name: prelab.student.full_name,
          id: prelab.student.university_student_id,
          record: prelab.record_id,
          revision: prelab.revision_id,
          schema: prelab.schema_version,
        },
        {
          name: 'Student name',
          id: 'Student ID',
          record: 'Pre-lab record ID',
          revision: 'Revision ID',
          schema: 'Evidence format',
        },
      ) +
      Object.entries(prelab.questions)
        .map(
          ([id, q]) =>
            `<section><h3>${id} - ${id === 'PRE-P01' ? 'Changing a resistor' : 'Changing the capacitor'}</h3><p>${id === 'PRE-P01' ? 'Scenario A: RA = 12 kΩ, RB = 18 kΩ, C = 4.7 µF. Scenario B: RA = 24 kΩ; RB and C unchanged.' : 'Scenario C: RA = 8.2 kΩ, RB = 27 kΩ, C = 2.2 µF. Scenario D: C = 4.7 µF; RA and RB unchanged.'}</p><h4>Original response (preserved)</h4>${evidenceTree(q.initial_snapshot)}<h4>Revised response</h4>${evidenceTree(q.working_response)}${includeHistory ? `<details class="reference"><summary>Revision history, checks and learning support</summary>${evidenceTree(Object.fromEntries(Object.entries(q).filter(([key]) => !['initial_snapshot', 'working_response'].includes(key))))}</details>` : ''}</section>`,
        )
        .join('') +
      (includeHistory
        ? `<details class="reference"><summary>Practice responses and evidence metadata</summary>${evidenceTree(Object.fromEntries(Object.entries(prelab).filter(([key]) => !['questions', 'student'].includes(key))))}</details>`
        : ''),
  );
}
export function sourceMain(record, sources) {
  return record.sources.main
    ? `<div class="source-report">${mainReport(record.sources.main, sources)}</div>`
    : box(
        'Main-lab data not imported',
        'Choose the group’s main-lab ZIP or JSON backup on Import files.',
      );
}
function identity(record) {
  const pre = record.sources.prelab,
    main = record.sources.main;
  let text = pre
    ? `<p><strong>${esc(pre.student.full_name)}</strong> · Student ID ${esc(pre.student.university_student_id)}</p>`
    : '';
  if (main)
    text += `<p>Group ID: ${esc(main.group.id)}</p>${groupStudents(main)
      .map(
        (student, i) =>
          `<p>Student ${i + 1}: ${esc(student.name)} · ${esc(student.id)}</p>`,
      )
      .join('')}`;
  const match =
    pre && main
      ? groupStudents(main).find(
          (s) => s.id.trim() === pre.student.university_student_id.trim(),
        )
      : null;
  if (match && match.name.trim() !== pre.student.full_name.trim())
    text += box(
      'Name spelling differs',
      `Pre-lab: ${esc(pre.student.full_name)}. Group sheet: ${esc(match.name)}. Check both names before confirming. Source names will not be changed.`,
      'warning',
    );
  const problems = issues(record, false);
  return (
    text +
    (problems.length
      ? box('Check the imported files', esc(problems.join(' ')), 'warning')
      : `<label class="check"><input type="checkbox" data-confirm ${record.identityConfirmed ? 'checked' : ''}><span>I confirm this is my own pre-lab and my group’s lab data, including any name-spelling differences shown above.</span></label>`)
  );
}
export function postlabScreen(record, index, sources) {
  const intro = [
    'Import your own finalized pre-lab and the group’s lab data. Nothing is uploaded to a server.',
    'Review your preserved pre-lab responses.',
    'Review the group’s measurements, designs and screenshots. Imported data cannot be edited here.',
    'Complete these answers independently, using your own reasoning.',
    'Check your individual report, then download it and keep a backup.',
  ][index];
  let body = '';
  if (index === 0)
    body =
      paper(
        'Choose the two source files',
        box(
          'Your work stays in this browser',
          'Use a copy of the group’s main-lab ZIP and only your own finalized pre-lab ZIP. JSON evidence is also accepted. PDFs and the pre-lab HTML are not data imports. Download an individual backup before leaving or changing computers.',
        ) +
          ['prelab', 'main']
            .map(
              (kind) =>
                `<h3>${kind === 'prelab' ? 'Your finalized pre-lab' : 'The group’s main-lab data'}</h3><p>${esc(record.sourceNames[kind] || 'No file imported')}</p><div class="attachment-controls"><label for="source-${kind}">Choose ${kind === 'prelab' ? 'pre-lab' : 'main-lab'} ZIP or JSON</label><input id="source-${kind}" type="file" accept=".zip,.json" data-source="${kind}"><button data-import-source="${kind}">Import ${kind === 'prelab' ? 'pre-lab' : 'main-lab'}</button></div>`,
            )
            .join('') +
          '<p class="small muted">Corrections must be made in the source workspace and explicitly re-imported. Replacing a source never merges groups or students.</p>',
      ) +
      paper('Confirm your identity', identity(record)) +
      '<p><a href="/worksheets/555-main-lab.html" target="_blank" rel="noopener">Open main-lab workspace ↗</a></p>';
  if (index === 1) body = prelabEvidence(record.sources.prelab);
  if (index === 2) body = sourceMain(record, sources);
  if (index === 3) {
    const incomplete = issues(record, false);
    if (incomplete.length)
      body = box(
        'Import matching source files first',
        esc(incomplete.join(' ')),
        'warning',
      );
    else
      body =
        (record.needsReview
          ? box(
              'Source data changed',
              'Review all your analysis against the replacement source before confirming the review on the Report page.',
              'warning',
            )
          : '') +
        analysisForm(
          {
            ...record.sources.main,
            analysis: record.analysis,
            optional: record.optional,
          },
          comparisonSection(record),
        );
  }
  if (index === 4)
    body = paper(
      'Your individual report',
      identity(record) +
        (record.needsReview
          ? `<label class="check"><input type="checkbox" data-reviewed><span>I have reviewed my analysis against the updated source data.</span></label>`
          : '') +
        `<p>${answerProgress(record).started}/${answerProgress(record).total} analysis fields started. Entered answers are not automatically checked for correctness.</p><p>The PDF includes your pre-lab evidence, the group’s results and screenshots, and your individual analysis. Missing measurements or images remain explicitly marked.</p><div class="actions"><button class="primary" data-action="print">Print or save report as PDF</button><button data-action="export">Download answers (JSON)</button><button data-action="zip">Download lab files (ZIP)</button></div><p>JSON and ZIP backups include both imported records, your writing and attached images. ZIP also contains the original images in a screenshots folder. Downloads do not submit your work.</p>`,
    );
  return `<div class="screen-head"><span class="eyebrow">INDIVIDUAL POST-LAB</span><h1>${PAGES[index]}</h1><p class="leadin">${intro}</p></div>${body}`;
}
export function individualReport(record, sources) {
  const pre = record.sources.prelab,
    problems = issues(record);
  return `<header class="report-title"><p>Individual post-lab</p><h1>555 Timer Post-Lab Report</h1>${problems.length ? `<p class="report-warning">DRAFT / INCOMPLETE - ${esc(problems.join(' '))}</p>` : ''}${definitionList({ name: pre?.student.full_name || '', id: pre?.student.university_student_id || '', group: record.sources.main?.group.id || '', workbook: record.recordId }, { name: 'Student name', id: 'Student ID', group: 'Group ID', workbook: 'Individual workbook ID' })}<p>Student-entered identities and computer timestamps do not authenticate identity or prove submission.</p></header>
    <section><h2>Pre-lab evidence</h2>${prelabEvidence(pre, false)}</section>
    <section><h2>Shared main-lab data</h2>${sourceMain(record, sources)}</section>
    <section><h2>Individual analysis and conclusions</h2>${comparisonSection(record, true)}${definitionList(Object.fromEntries(DISCUSSION_KEYS.map((key) => [key, record.analysis[key]])), analysisLabels)}</section>${legacyComparison(record, true)}
    ${Object.values(record.optional).some((text) => text.trim()) ? paper('Earlier individual optional notes · recovery appendix', definitionList(record.optional)) : ''}${
      pre
        ? paper(
            'Pre-lab evidence appendix',
            Object.entries(pre.questions)
              .map(
                ([id, q]) =>
                  `<h3>${esc(id)} - revision history, checks and learning support</h3>${evidenceTree(Object.fromEntries(Object.entries(q).filter(([key]) => !['initial_snapshot', 'working_response'].includes(key))))}`,
              )
              .join('') +
              `<h3>Practice responses and evidence metadata</h3>${evidenceTree(Object.fromEntries(Object.entries(pre).filter(([key]) => !['questions', 'student'].includes(key))))}`,
          )
        : ''
    }`;
}
