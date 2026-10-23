'use strict';
const VERSION = '2145427-W12-prelab-1.0.0',
  KEY = '2145427-W12-prelab-20261026-impl-v1';
const COMPAT_PACKAGE = '2145427-W12-prelab-review-r4';
const titles = [
  'Start here',
  'Where filters act',
  'Measure variation',
  'Worked RC',
  'MA & EMA mechanism',
  'Prediction 1',
  'Prediction 2',
  'Independent check',
  'Reflect & verify',
  'Review & export',
];
const assignmentContext = {
  p1: 'PRE-P01: RC R=10 kΩ, C=1 versus 3 µF, shared 25 ms pulse; calculate τ and cutoff, predict before reveal, revise from comparison.',
  p2: 'PRE-P02: EMA α=0.20 versus 0.04 at 1000 Hz; shared 25 ms pulse, predict before reveal and revise.',
  check1:
    'UC-W12-01: new 100 ms pulse; compare three supplied settings against RMS ≤0.020 V, t90 ≤20 ms, pulse ≥90%; justify with limitations.',
  check2:
    'UC-W12-02: total RMS versus noise RMS; aliased ADC and post-sampling smoothing.',
};
const fieldIds = [
  'studentId',
  'studentName',
  'practiceNoise',
  'practiceFilter',
  'maWork',
  'emaWork',
  'p1first',
  'p1reason',
  'p1assumption',
  'p1uncertainty',
  'p1revision',
  'p1help',
  'p2first',
  'p2reason',
  'p2assumption',
  'p2uncertainty',
  'p2revision',
  'p2help',
  'check1',
  'check2',
  'aiUsed',
  'aiExposure',
  'claim',
  'verification',
  'limitation',
  'handoff',
];
const checks = ['identityConfirm', 'honestyConfirm', 'independentConfirm'];
const fresh = () => ({
  package: VERSION,
  course: '2145427',
  activity: 'noise-filtering-prelab-20261026',
  stage: 'prelab',
  current: 0,
  fields: Object.fromEntries(fieldIds.map((k) => [k, ''])),
  checks: Object.fromEntries(checks.map((k) => [k, false])),
  frozen: { p1: null, p2: null, check: null },
  finalized: false,
  created: new Date().toISOString(),
  updated: new Date().toISOString(),
});
let state = fresh(),
  saveFailed = false,
  restoreCandidate = null;
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
const $ = (s) => document.querySelector(s);
function valid(s) {
  if (
    !s ||
    typeof s !== 'object' ||
    s.package !== VERSION ||
    s.course !== '2145427' ||
    s.activity !== 'noise-filtering-prelab-20261026' ||
    s.stage !== 'prelab'
  )
    throw Error(
      'This is not this Week 12 v1 workspace. Only compatible R4 or v1 backups are supported; R3 and Week 11 require their original application.',
    );
  if (
    !Number.isInteger(s.current) ||
    s.current < 0 ||
    s.current > 9 ||
    typeof s.finalized !== 'boolean'
  )
    throw Error('Invalid workspace state.');
  if (
    Object.keys(s.fields || {})
      .sort()
      .join() !== fieldIds.slice().sort().join() ||
    fieldIds.some(
      (k) => typeof s.fields[k] !== 'string' || s.fields[k].length > 10000,
    )
  )
    throw Error('Invalid response fields.');
  if (
    Object.keys(s.checks || {})
      .sort()
      .join() !== checks.slice().sort().join() ||
    checks.some((k) => typeof s.checks[k] !== 'boolean')
  )
    throw Error('Invalid confirmations.');
  if (!s.frozen || Object.keys(s.frozen).sort().join() !== 'check,p1,p2')
    throw Error('Invalid original records.');
  for (const k of ['p1', 'p2']) {
    const f = s.frozen[k];
    if (
      f !== null &&
      (!f ||
        Object.keys(f).sort().join() !==
          'assumption,first,reason,time,uncertainty' ||
        ['first', 'reason', 'assumption', 'uncertainty', 'time'].some(
          (n) => typeof f[n] !== 'string' || f[n].length > 10000,
        ) ||
        !f.first.trim() ||
        !f.reason.trim() ||
        !f.assumption.trim() ||
        !f.uncertainty.trim())
    )
      throw Error('Invalid frozen prediction.');
  }
  const f = s.frozen.check;
  if (
    f !== null &&
    (!f ||
      Object.keys(f).sort().join() !== 'check1,check2,time' ||
      ['check1', 'check2', 'time'].some(
        (n) => typeof f[n] !== 'string' || f[n].length > 10000,
      ) ||
      !f.check1.trim() ||
      !f.check2.trim())
  )
    throw Error('Invalid independent check.');
  if (
    !Number.isFinite(Date.parse(s.created)) ||
    !Number.isFinite(Date.parse(s.updated))
  )
    throw Error('Invalid record dates.');
  if (s.finalized && missing(s).length)
    throw Error('Finalized record is incomplete.');
  return s;
}
try {
  const old = localStorage.getItem(KEY);
  if (old) state = valid(JSON.parse(old));
} catch (e) {
  saveFailed = true;
}
function importWorkspace(s) {
  return valid(
    s && s.package === COMPAT_PACKAGE ? { ...s, package: VERSION } : s,
  );
}
function notify(t) {
  $('#notice').textContent = t;
}
function save() {
  state.updated = new Date().toISOString();
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    saveFailed = false;
  } catch (e) {
    saveFailed = true;
    notify(
      'Browser storage unavailable. Your work remains in this tab: save a JSON backup now before closing.',
    );
  }
}
function field(id, label, placeholder = '', type = 'textarea') {
  const disabled = state.finalized ? 'disabled' : '';
  return `<label class="field">${label}${type === 'input' ? `<input class="input" id="${id}" maxlength="10000" ${disabled} value="${esc(state.fields[id])}" placeholder="${esc(placeholder)}">` : `<textarea class="textarea" id="${id}" maxlength="10000" ${disabled} placeholder="${esc(placeholder)}">${esc(state.fields[id])}</textarea>`}</label>`;
}
const head = (n, eyebrow, title, sub) =>
  `<div class="screen-head"><div class="screen-index">Screen ${n + 1} of 10 · ${eyebrow}</div><h1>${title}</h1><p class="leadin">${sub}</p></div>`;
const panel = (title, text) =>
  `<div class="soft-panel"><h3>${title}</h3>${text}</div>`;
function missing(s = state) {
  let m = [];
  for (const id of [
    'studentId',
    'studentName',
    'maWork',
    'emaWork',
    'p1revision',
    'p1help',
    'p2revision',
    'p2help',
    'aiUsed',
    'aiExposure',
    'claim',
    'verification',
    'limitation',
    'handoff',
  ])
    if (!s.fields[id].trim()) m.push(id);
  for (const p of ['p1', 'p2', 'check'])
    if (!s.frozen[p]) m.push(p + ' original');
  for (const k of checks) if (!s.checks[k]) m.push(k);
  return m;
}
function describeMissing(s = state) {
  const labels = {
    maWork: 'MA calculations (screen 5, exercise details)',
    emaWork: 'EMA calculations (screen 5, exercise details)',
    studentId: 'Student ID (screen 1)',
    studentName: 'Full name (screen 1)',
    p1revision: 'Revised response (screen 6)',
    p1help: 'Support used, or none (screen 6)',
    p2revision: 'Revised response (screen 7)',
    p2help: 'Support used, or none (screen 7)',
    aiUsed: 'AI use, or none (screen 9)',
    aiExposure: 'Answer exposure, or none (screen 9)',
    claim: 'Important claim (screen 9)',
    verification: 'Verification (screen 9)',
    limitation: 'Limitation (screen 9)',
    handoff: 'In-class comparison (screen 9)',
    'p1 original': 'Preserve first attempt (screen 6)',
    'p2 original': 'Preserve first attempt (screen 7)',
    'check original': 'Preserve independent responses (screen 8)',
    identityConfirm: 'Identity confirmation (screen 10)',
    honestyConfirm: 'Honesty confirmation (screen 10)',
    independentConfirm: 'Independent-check confirmation (screen 10)',
  };
  return missing(s)
    .map((k) => labels[k] || k)
    .join('; ');
}
function legacyScreen9() {
  let m = missing();
  return (
    head(
      9,
      'Individual evidence',
      'Review, save, and bring your reasoning',
      'Check your record before finalizing. Finalization locks this workspace; backups remain downloadable.',
    ) +
    `<div class="paper sheet"><p><strong>${state.finalized ? 'Finalized · read-only' : 'Draft · not yet finalized'}</strong></p><button class="btn light" id="review">Show full evidence record</button><div id="review-text" class="locked" hidden></div>${checks.map((k, i) => `<label class="checkbox"><input type="checkbox" id="${k}" ${state.checks[k] ? 'checked' : ''} ${state.finalized ? 'disabled' : ''}>${['I have checked my name and student ID.', 'I have distinguished hypothetical predictions from actual measurements and disclosed support and answer exposure honestly.', 'My independent-check status is accurately disclosed; an exposed or uncertain answer is not claimed as verified independent mastery.'][i]}</label>`).join('')}<p class="status-line" id="completion">${state.finalized ? 'Final record ready for export.' : m.length ? `${m.length} required fields/records/confirmations remain. Complete: ${esc(describeMissing())}. “None” or an honest uncertainty is acceptable where appropriate.` : 'All required entries are present; content has not been graded.'}</p><div class="row"><button class="btn primary" id="finalize" ${state.finalized ? 'disabled' : ''}>Finalize & download evidence ZIP</button><button class="btn" id="zip" ${state.finalized ? '' : 'disabled'}>Download final ZIP again</button><button class="btn" id="print">Print / save report as PDF</button><button class="btn" id="json">Download JSON backup</button></div><div class="callout warning"><strong>Save is not submission.</strong> Use the actual MyCourseVille instructions for deadline and required submitted file. This package does not upload anything, link to last week’s assignment, or set a new deadline.</div><p>The ZIP contains your evidence JSON, readable report and full workspace backup. Keep the backup to restore this exact Week 12 application. The Week 11 555 recorder has not been verified to import this new activity; the readable report is the human-readable handoff. Do not rename it as a 555 export.</p><p class="source-note">Teaching basis: approved Week 12 noise/SNR/filtering topic; 2026 semester-plan theme. Visual style adapted from the prior 555 pre-lab functional package. No real bench results are included. Client timestamps are editable and are not proof of submission time or independent authorship.</p></div>`
  );
}
/* Implementation v1.0.0 teaching screens. Shared simulated data; no bench specification. */
const screens = [
  screen0,
  screen1,
  screen2,
  screen3,
  screen4,
  () => prediction(1),
  () => prediction(2),
  screen7,
  screen8,
  screen9,
];
function render() {
  $('#nav').innerHTML = titles
    .map(
      (t, i) =>
        `<button class="step ${i === state.current ? 'active' : ''}" data-nav="${i}" ${i === state.current ? 'aria-current="step"' : ''}><span class="step-icon">${i + 1}</span><span class="step-name">${t}</span></button>`,
    )
    .join('');
  $('#screens').innerHTML = screens[state.current]();
  $('#progress').textContent = `${state.current + 1} / 10`;
  $('#prev').disabled = state.current === 0;
  $('#next').disabled = state.current === 9;
  $('#screens')
    .querySelectorAll('input,textarea')
    .forEach((el) =>
      el.addEventListener('input', () => {
        if (
          state.finalized ||
          (!fieldIds.includes(el.id) && !checks.includes(el.id))
        )
          return;
        if (fieldIds.includes(el.id)) state.fields[el.id] = el.value;
        if (checks.includes(el.id)) state.checks[el.id] = el.checked;
        save();
        if (state.current === 9)
          $('#completion').textContent = missing().length
            ? `${missing().length} required entries remain. Complete: ${describeMissing()}.`
            : 'All required entries are present; content has not been graded.';
      }),
    );
}
function go(n) {
  state.current = n;
  save();
  render();
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
}
function freeze(p) {
  if (state.finalized || state.frozen[p]) return;
  const ids =
    p === 'check'
      ? ['check1', 'check2']
      : [p + 'first', p + 'reason', p + 'assumption', p + 'uncertainty'];
  if (ids.some((k) => !state.fields[k].trim()))
    return notify(
      'Please complete each first-attempt field, including an honest uncertainty if needed.',
    );
  if (
    !confirm(
      'Preserve these responses as your original record? They cannot be edited afterward. You can explain corrections in your revision or disclosure.',
    )
  )
    return;
  if (p === 'check')
    state.frozen.check = {
      check1: state.fields.check1,
      check2: state.fields.check2,
      time: new Date().toISOString(),
    };
  else
    state.frozen[p] = {
      first: state.fields[p + 'first'],
      reason: state.fields[p + 'reason'],
      assumption: state.fields[p + 'assumption'],
      uncertainty: state.fields[p + 'uncertainty'],
      time: new Date().toISOString(),
    };
  save();
  render();
  notify('Original responses preserved. This is not a correctness judgment.');
}
function coachPrompt(p) {
  if (p !== 'p1' && p !== 'p2') return null;
  const f = state.frozen[p];
  if (!f) return null;
  const request = `Use LAB_AI_COACH.md for 2145427 Week 12, PRELAB only. I am working on ${p === 'p1' ? 'PRE-P01 (RC comparison)' : 'PRE-P02 (EMA comparison)'}. Teach one immediate concept using an unrelated example. Do not solve the assigned case, write my response, or discuss independent-check answers. Ask at most one small question at a time. My original reasoning: ${f.reason}\nMy uncertainty: ${f.uncertainty}\nHelp me understand the principle and how I could verify a claim independently.`;
  return (
    COACH_RESOURCE +
    '\n\n---\nCURRENT PRE-LAB COACHING REQUEST\n---\n\n' +
    request
  );
}
async function coach(p, action) {
  if (!['show', 'copy', 'select'].includes(action)) return;
  const prompt = coachPrompt(p);
  if (prompt === null) return;
  const el = $('#prompt-' + p);
  const panel = $('#coach-panel-' + p);
  const status = $('#coach-status-' + p);
  if (!el || !panel || !status) return;
  panel.hidden = false;
  el.value = prompt;
  $('[data-coach-show="' + p + '"]').setAttribute('aria-expanded', 'true');
  const message = (text) => {
    status.textContent = text;
  };
  const selectAll = () => {
    el.focus();
    el.select();
    el.setSelectionRange(0, el.value.length);
  };
  if (action === 'select') {
    selectAll();
    message(
      'All prompt text selected. Use your device’s normal Copy command, then paste into your chosen AI tool.',
    );
    return;
  }
  if (action === 'show') {
    el.focus();
    message(
      'Full coach prompt ready. Use Copy full coach prompt or Select all to copy it manually.',
    );
    return;
  }
  try {
    if (
      !navigator.clipboard ||
      typeof navigator.clipboard.writeText !== 'function'
    )
      throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(el.value);
    if (panel.isConnected)
      message('Full coach prompt copied. Paste it into your chosen AI tool.');
  } catch {
    if (!panel.isConnected) return;
    selectAll();
    message(
      'Clipboard unavailable. Select and copy the displayed full prompt using your device’s normal Copy command. The complete text is selected for you.',
    );
  }
}
function download(name, data, type = 'application/json') {
  const u = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = u;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 30000);
}
function backup() {
  download(
    `2145427_W12_v1_0_0_${safeId()}_workspace.json`,
    JSON.stringify(
      { kind: '2145427-W12-workspace-backup', version: 4, workspace: state },
      null,
      2,
    ),
  );
  notify(
    'JSON backup download requested. Check your Downloads folder; browser storage is not your only copy.',
  );
}
function safeId() {
  return (
    state.fields.studentId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) ||
    'UNNAMED'
  );
}
function evidence() {
  return {
    schema: '2145427-w12-prelab-evidence-v4',
    package: VERSION,
    student: { id: state.fields.studentId, name: state.fields.studentName },
    stage: 'prelab',
    activity: state.activity,
    status: state.finalized ? 'finalized' : 'draft',
    assigned_context: assignmentContext,
    originals: state.frozen,
    responses: state.fields,
    confirmations: state.checks,
    created_client: state.created,
    updated_client: state.updated,
    disclaimer:
      'Hypothetical individual predictions; no measured results. Client records do not prove independent authorship or LMS submission. Not a 555-recorder import.',
  };
}
function report() {
  let lines = [
    'IMPLEMENTATION v1.0.0 · approved R4 instructional baseline',
    '2145427 · Week 12 · Noise, SNR and Filtering',
    'Individual pre-lab evidence · ' +
      (state.finalized ? 'FINALIZED' : 'DRAFT'),
    `Student: ${state.fields.studentName} | ${state.fields.studentId}`,
    'Class: Monday 26 October 2026, 13:00–17:00 Asia/Bangkok',
    'Hypothetical predictions only; no physical measurements.',
    '',
  ];
  lines.push(
    'HAND CALCULATIONS: MA N=3 at 100 Hz, x[-2]=x[-1]=4 V; x[0..2]=4,7,10 V; EMA α=.4, y[-1]=4 V.',
    'MA: ' + state.fields.maWork,
    'EMA: ' + state.fields.emaWork,
    '',
  );
  for (const p of ['p1', 'p2']) {
    lines.push(
      p === 'p1' ? 'PRE-P01 · RC comparison' : 'PRE-P02 · EMA comparison',
    );
    let f = state.frozen[p];
    lines.push(
      'ASSIGNED CASE: ' + assignmentContext[p],
      'ORIGINAL: ' + (f ? f.first : 'Not preserved'),
      'REASON: ' + (f ? f.reason : ''),
      'ASSUMPTION: ' + (f ? f.assumption : ''),
      'UNCERTAINTY: ' + (f ? f.uncertainty : ''),
      'SUPPORT: ' + state.fields[p + 'help'],
      'REVISION: ' + state.fields[p + 'revision'],
      '',
    );
  }
  lines.push(
    'INDEPENDENT CHECK',
    assignmentContext.check1,
    assignmentContext.check2,
    'UC-W12-01: ' + (state.frozen.check?.check1 || 'Not preserved'),
    'UC-W12-02: ' + (state.frozen.check?.check2 || 'Not preserved'),
    '',
  );
  for (const [k, l] of [
    ['aiUsed', 'AI use'],
    ['aiExposure', 'Answer exposure / independence'],
    ['claim', 'Important claim'],
    ['verification', 'Verification'],
    ['limitation', 'Limitations'],
    ['handoff', 'Proposed in-class comparison'],
  ])
    lines.push(l + ': ' + state.fields[k], '');
  lines.push(
    'Local record timestamps (not proof of submission): ' +
      state.created +
      ' / ' +
      state.updated,
    'Save/export is not LMS submission. Follow the published assignment.',
  );
  return lines.join('\n');
}
function printReport() {
  renderReport($('#print-report'));
  window.print();
}
function zipBytes(files) {
  const enc = new TextEncoder(),
    parts = [],
    central = [];
  let offset = 0;
  const u16 = (v, n, o) => v.setUint16(o, n, true),
    u32 = (v, n, o) => v.setUint32(o, n >>> 0, true);
  function crc(b) {
    let c = 0xffffffff;
    for (const x of b) {
      c ^= x;
      for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
    return (c ^ 0xffffffff) >>> 0;
  }
  for (const [name, body] of files) {
    const n = enc.encode(name),
      b = enc.encode(body),
      c = crc(b),
      h = new Uint8Array(30 + n.length),
      v = new DataView(h.buffer);
    u32(v, 0x04034b50, 0);
    u16(v, 20, 4);
    u16(v, 0x800, 6);
    u32(v, c, 14);
    u32(v, b.length, 18);
    u32(v, b.length, 22);
    u16(v, n.length, 26);
    h.set(n, 30);
    const ch = new Uint8Array(46 + n.length),
      cv = new DataView(ch.buffer);
    u32(cv, 0x02014b50, 0);
    u16(cv, 20, 4);
    u16(cv, 20, 6);
    u16(cv, 0x800, 8);
    u32(cv, c, 16);
    u32(cv, b.length, 20);
    u32(cv, b.length, 24);
    u16(cv, n.length, 28);
    u32(cv, offset, 42);
    ch.set(n, 46);
    parts.push(h, b);
    central.push(ch);
    offset += h.length + b.length;
  }
  const length = central.reduce((a, b) => a + b.length, 0),
    end = new Uint8Array(22),
    ev = new DataView(end.buffer);
  u32(ev, 0x06054b50, 0);
  u16(ev, files.length, 8);
  u16(ev, files.length, 10);
  u32(ev, length, 12);
  u32(ev, offset, 16);
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}
function exportZip() {
  if (!state.finalized)
    return notify(
      'Finalize the complete record before downloading the final ZIP.',
    );
  valid(state);
  const blob = zipBytes([
    ['prelab_evidence.json', JSON.stringify(evidence(), null, 2)],
    ['prelab_report.txt', report()],
    [
      'workspace_backup.json',
      JSON.stringify(
        { kind: '2145427-W12-workspace-backup', version: 4, workspace: state },
        null,
        2,
      ),
    ],
  ]);
  download(
    `2145427_W12_v1_0_0_PRELAB_${safeId()}.zip`,
    blob,
    'application/zip',
  );
  notify(
    'Final ZIP download requested. Verify that the ZIP exists before closing; this has not submitted to MyCourseVille.',
  );
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.nav !== undefined) go(Number(b.dataset.nav));
  if (b.dataset.freeze) freeze(b.dataset.freeze);
  if (b.dataset.coachShow) coach(b.dataset.coachShow, 'show');
  if (b.dataset.coachCopy) coach(b.dataset.coachCopy, 'copy');
  if (b.dataset.coachSelect) coach(b.dataset.coachSelect, 'select');
  if (b.id === 'prev') go(Math.max(0, state.current - 1));
  if (b.id === 'next') go(Math.min(9, state.current + 1));
  if (['backup', 'json'].includes(b.id)) backup();
  if (b.id === 'restore') $('#import-file').click();
  if (b.id === 'review') {
    const r = $('#review-text');
    r.hidden = !r.hidden;
    renderReport(r);
  }
  if (b.id === 'print') printReport();
  if (b.id === 'zip') exportZip();
  if (b.id === 'finalize') {
    if (missing().length)
      return notify(
        'Complete the missing responses, preserved originals and confirmations before finalizing. Missing: ' +
          describeMissing() +
          '.',
      );
    if (
      confirm(
        'Finalize and lock this record? Check your identity, disclosures and responses first. Download remains available afterward.',
      )
    ) {
      state.finalized = true;
      save();
      render();
      exportZip();
    }
  }
});
$('#import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    if (file.size > 500000) throw Error('Backup exceeds 500 KB limit.');
    const b = JSON.parse(await file.text());
    if (b.version === 1)
      throw Error(
        'R3/earlier backups are preserved separately. This version has different exercises; open your original R3 file to read that work. No data was changed.',
      );
    if (b.kind !== '2145427-W12-workspace-backup' || b.version !== 4)
      throw Error(
        'Unsupported backup type/version. Choose a compatible R4 or v1 JSON workspace backup.',
      );
    const s = importWorkspace(b.workspace);
    if (
      state.fields.studentId.trim() &&
      state.fields.studentId !== s.fields.studentId
    )
      throw Error(
        'Student ID does not match this workspace. Existing work was not changed.',
      );
    if (
      !confirm(
        `Validated Week 12 backup for ${s.fields.studentId || 'unnamed student'} (${s.finalized ? 'finalized' : 'draft'}). Replace this tab’s workspace? Save your current backup first if needed. Cancel leaves current work unchanged.`,
      )
    )
      return;
    state = s;
    save();
    render();
    notify(
      'Validated backup restored. Review identity and responses; your old file remains unchanged.',
    );
  } catch (err) {
    notify(
      'Restore rejected: ' + err.message + ' Current workspace unchanged.',
    );
  }
});
render();
if (saveFailed)
  notify(
    'Previous browser record could not be loaded or storage is unavailable. Restore a valid JSON backup if you have one. Do not close this tab without saving your current work.',
  );
