import './styles.css';
import {
  createRecord,
  validateRecord,
  pages,
  subtitles,
  POST_LEADINS,
  labels,
  numericIssue,
  prerequisites,
  FILE_KINDS,
  NUMERIC_FIELDS,
} from './model.js';
import { zipSync } from 'fflate';
import { validateAttachment as validateLegacyAttachment } from './legacy/files.js';
import {
  createBackup,
  createZip,
  parseFile,
  validateAttachment,
  checkFiles,
  persistentFiles,
  restoreGroupInputs,
  store,
  legacyStore,
  legacyBackup,
  legacyZip,
  MAX_FILE,
  MAX_GROUP,
} from './files.js';
import { esc, mainContent, postContent, report, legacyView } from './views.js';

const kind = document.body.dataset.kind;
if (!['main', 'post'].includes(kind)) throw new Error('Unknown worksheet.');
const embedded = new URLSearchParams(location.search).get('embed') === '1';
document.documentElement.classList.toggle('embedded', embedded);
document.body.classList.toggle('embedded', embedded);
const state = {
  kind,
  record: createRecord(kind),
  files: {},
  source: null,
  parsedSource: null,
  urls: {},
};
const $ = (id) => document.getElementById(id);
const storage = store(kind);
const visited = new Set();
$('worksheet-title').textContent =
  kind === 'main'
    ? 'Sensor Calibration Main Lab'
    : 'Sensor Calibration Post-Lab';
$('worksheet-subtitle').textContent =
  kind === 'main'
    ? 'Sensor calibration · Main lab'
    : 'Sensor calibration · Post-lab';
let previousWork = null;
let revision = 0,
  savedRevision = 0,
  reportRevision = -1,
  saveTimer,
  saveQueue = Promise.resolve(),
  persistenceBlocked = false,
  ready = false,
  busy = false;
const numericFields = NUMERIC_FIELDS;
function message(s, error = false) {
  $('message').hidden = false;
  $('message').className = `message${error ? ' error' : ''}`;
  $('message').textContent = s;
}
function storageWarning(s) {
  $('storage-warning').hidden = !s;
  $('storage-warning').textContent = s;
}
function touch() {
  state.record.updatedAt = new Date().toISOString();
  revision++;
  $('save-status').textContent = 'Saving your changes…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 500);
}
async function save(force = false) {
  clearTimeout(saveTimer);
  if (!ready || (persistenceBlocked && !force)) {
    $('save-status').textContent = 'Download a backup to keep this session';
    return;
  }
  const snapshot = {
      record: structuredClone(state.record),
      files: { ...state.files },
      source: state.source,
    },
    atRevision = revision;
  saveQueue = saveQueue
    .catch(() => {})
    .then(async () => {
      try {
        snapshot.files = await persistentFiles(snapshot.files);
        await storage.write('active', snapshot);
        savedRevision = Math.max(savedRevision, atRevision);
        persistenceBlocked = false;
        storageWarning('');
        if (revision === atRevision)
          $('save-status').textContent =
            'Saved in this browser. Download a ZIP backup before closing.';
      } catch {
        persistenceBlocked = true;
        storageWarning(
          'Browser autosave is unavailable. Your current entries remain in this session. Download a JSON or ZIP backup now; you can retry “Save in this browser.”',
        );
        $('save-status').textContent =
          'Not saved in browser · download a backup';
      }
    });
  await saveQueue;
}
function refreshURLs() {
  Object.values(state.urls).forEach((url) => URL.revokeObjectURL(url));
  state.urls = {};
  for (const [slot, f] of Object.entries(state.files))
    state.urls[`own-${slot}`] = URL.createObjectURL(f.blob);
  for (const [slot, f] of Object.entries(state.parsedSource?.files || {}))
    state.urls[`source-${slot}`] = URL.createObjectURL(f.blob);
}
function render(focus = false) {
  const titles = pages(kind),
    current = state.record.current,
    mainLeadins = {
      0: 'Build a system that records raw echo time, then document your circuit, code and timing method.',
      1: 'Choose your calibration variables and plan how to collect paired measurements.',
      2: 'Collect paired ruler distances and echo times in three separate runs.',
      3: 'Summarize the repeated readings, fit a line and report its sensitivity.',
      4: 'Use your fitted equation to calculate two new distances and compare them with the ruler.',
      5: 'Change the target’s angle, then return it to its original orientation and compare the readings.',
    },
    leadin =
      kind === 'main'
        ? mainLeadins[current] ||
          'Build and test your system with your group. Keep all three runs identifiable in your CSV.'
        : POST_LEADINS[current];
  visited.add(current);
  $('breadcrumb').textContent = titles[current];
  $('steps').innerHTML = titles
    .map(
      (title, i) =>
        `<button class="step${i === current ? ' active' : ''}" data-page="${i}"${i === current ? ' aria-current="step"' : ''}><span class="step-number" aria-hidden="true">${i === current ? '●' : visited.has(i) ? '✓' : i + 1}</span><span><strong>${esc(title)}</strong><small>${esc(subtitles(kind)[i])}</small></span></button>`,
    )
    .join('');
  $('screen-count').textContent = `${current + 1} / ${titles.length}`;
  $('progress-bar').style.width = `${(100 * (current + 1)) / titles.length}%`;
  $('main').innerHTML =
    `<div class="screen-head page-title"><p class="eyebrow">${kind === 'main' ? 'Group main lab' : 'Individual post-lab'} · Section ${current + 1} of ${titles.length}</p><h1>${esc(titles[current])}</h1><p class="leadin">${esc(leadin)}</p></div>${current === 0 ? `<div class="callout"><strong>Your work stays in this browser</strong><p>${kind === 'main' ? 'Use one computer for your group of one to three students. Each student completes the post-lab separately.' : 'Complete this worksheet individually using your group’s saved measurements.'} Answers and attached files stay in this browser. Download a ZIP before leaving or changing computers. ${kind === 'main' ? 'Give every member a copy of the group file.' : 'Keep your own individual backup.'}</p></div>` : ''}${kind === 'main' ? mainContent(state, current) : postContent(state, current)}`;
  $('previous').toggleAttribute('disabled', current === 0);
  $('next').toggleAttribute('disabled', current === titles.length - 1);
  $('report').innerHTML = '';
  reportRevision = -1;
  if (embedded)
    for (const anchor of document.querySelectorAll('a[href]:not([download])'))
      anchor.setAttribute('target', '_top');
  if (focus) {
    $('main').focus();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}
function navigate(page, addHistory = true) {
  if (!Number.isInteger(page) || page < 0 || page >= pages(kind).length) return;
  state.record.current = page;
  setSaveMenu(false);
  setNavigationOpen(false, false);
  if (addHistory) history.pushState(null, '', `#section-${page + 1}`);
  touch();
  render(true);
}
function download(name, data, type = 'application/octet-stream') {
  const url = URL.createObjectURL(new Blob([data], { type })),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function prepareReport() {
  if (reportRevision !== revision) {
    $('report').innerHTML = report(state);
    reportRevision = revision;
  }
}
function filename() {
  return `sensor_calibration_${kind}_${(kind === 'main' ? state.record.fields.groupId : state.record.fields.studentId || state.record.fields.name).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) || 'unfinished'}`;
}
function preview(title, body, confirmText = 'Load file') {
  return new Promise((resolve) => {
    const d = /** @type {HTMLDialogElement} */ ($('dialog'));
    $('dialog-title').textContent = title;
    $('dialog-body').innerHTML = body;
    $('dialog-confirm').textContent = confirmText;
    const finish = (result) => {
      d.close();
      d.removeEventListener('cancel', cancel);
      $('dialog-confirm').onclick = $('dialog-cancel').onclick = null;
      resolve(result);
    };
    const cancel = (e) => {
      e.preventDefault();
      finish(false);
    };
    $('dialog-confirm').onclick = () => finish(true);
    $('dialog-cancel').onclick = () => finish(false);
    d.addEventListener('cancel', cancel);
    d.showModal();
  });
}
function chooseFile(accept, callback) {
  if (busy) {
    message('Finish the current file operation first.', true);
    return;
  }
  const picker = /** @type {HTMLInputElement} */ ($('file-picker'));
  picker.accept = accept;
  picker.value = '';
  picker.onchange = async () => {
    const file = picker.files?.[0];
    if (!file) return;
    if (busy) {
      message('Finish the current file operation first.', true);
      return;
    }
    busy = true;
    try {
      await callback(file);
    } catch (e) {
      message(
        e.message ||
          'The file could not be opened. Your current work is unchanged.',
        true,
      );
    } finally {
      busy = false;
    }
  };
  picker.click();
}
async function loadBackup(file, sourceOnly) {
  if (file.size > (sourceOnly ? MAX_GROUP : MAX_FILE))
    throw new Error('The selected backup exceeds the worksheet file limit.');
  const bytes = new Uint8Array(await file.arrayBuffer()),
    parsed = await parseFile(bytes, sourceOnly ? 'main' : kind);
  if (parsed.legacy) return recoverLegacy(parsed);
  const group = parsed.record.fields.groupId;
  const summary = `<p>File: <strong>${esc(file.name)}</strong></p><p>${sourceOnly || kind === 'main' ? `Group: ${esc(group || '[not recorded]')}` : `Student: ${esc(parsed.record.fields.name || '[not recorded]')}`}</p><p>Last edited: ${esc(parsed.record.updatedAt)}</p><p>${sourceOnly ? 'You can read the group measurements here. Your own answers and images will stay in this worksheet. If you replace the group file, check your answers against the new readings.' : 'This replaces the current worksheet in this browser. Download your current draft first if you need to keep it.'}</p><p>Check the group or student details above to make sure you chose the right file.</p>`;
  if (
    !(await preview(
      sourceOnly
        ? 'Check the group file before opening it'
        : 'Check the backup before opening it',
      summary,
    ))
  )
    return;
  if (sourceOnly) {
    state.record.needsReview = !!state.source;
    state.source = { name: file.name, bytes };
    state.parsedSource = parsed;
  } else {
    visited.clear();
    state.record = parsed.record;
    state.files = parsed.files;
    state.source = parsed.source;
    state.parsedSource = parsed.parsedSource;
  }
  persistenceBlocked = false;
  refreshURLs();
  touch();
  render(true);
  message(
    sourceOnly
      ? 'Your group file is open. Your individual answers have been kept.'
      : 'Worksheet backup loaded.',
  );
  await save();
}
async function recoverLegacy(parsed) {
  if (
    !(await preview(
      'Recover your earlier worksheet without replacing this one.',
      legacyView(parsed),
      'Download recovery ZIP',
    ))
  )
    return;
  const oldKind = parsed.record.activityId.endsWith('main') ? 'main' : 'post';
  download(
    `sensor_calibration_${oldKind}_v1_recovery.zip`,
    await legacyZip(oldKind, parsed.record, parsed.files, parsed.source),
    'application/zip',
  );
  message(
    'Your version-one recovery ZIP has been downloaded. This workbook and the older browser record are unchanged.',
  );
}
function inputWarning(el, value, positive = false) {
  const warning = numericIssue(value, positive);
  el.setAttribute('aria-invalid', warning ? 'true' : 'false');
  let hint = el.parentElement.querySelector(':scope > .field-warning');
  if (!hint) {
    hint = document.createElement('span');
    hint.className = 'field-warning';
    el.after(hint);
  }
  hint.textContent = warning;
}
function edit(el) {
  if (
    !(
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
    )
  )
    return;
  const d = el.dataset;
  if (
    kind === 'main' &&
    state.record.current > 0 &&
    !prerequisites(state.files, state.record)
  )
    return;
  if (d.field && Object.hasOwn(labels(kind), d.field)) {
    state.record.fields[d.field] = el.value;
    if (
      numericFields.has(d.field) ||
      /\.(mean|sd|distance|error)$/.test(d.field)
    )
      inputWarning(el, el.value);
  } else if (
    d.uncertainty &&
    Object.hasOwn(state.record.uncertainty, d.uncertainty) &&
    Object.hasOwn(state.record.uncertainty[d.uncertainty], d.key)
  )
    state.record.uncertainty[d.uncertainty][d.key] = el.value;
  else return;
  touch();
}
document.addEventListener('input', (e) => {
  if (e.target instanceof HTMLElement && e.target.tagName !== 'SELECT')
    edit(e.target);
});
document.addEventListener('change', (e) => {
  if (e.target instanceof HTMLSelectElement) edit(e.target);
});
async function action(name) {
  if (name === 'source')
    return chooseFile('.json,.zip,application/json,application/zip', (f) =>
      loadBackup(f, true),
    );
  if (name === 'import')
    return chooseFile('.json,.zip,application/json,application/zip', (f) =>
      loadBackup(f, false),
    );
  if (name === 'zip') {
    download(
      `${filename()}.zip`,
      await createZip(kind, state.record, state.files, state.source),
      'application/zip',
    );
    message(
      'Your ZIP file has been downloaded. Keep it to reopen your work, and submit it as instructed by your teacher.',
    );
  }
  if (name === 'json') {
    download(
      `${filename()}.json`,
      JSON.stringify(
        await createBackup(kind, state.record, state.files, state.source),
        null,
        2,
      ),
      'application/json',
    );
    message(
      'Your JSON backup has been downloaded. It includes your images and any group file you opened.',
    );
  }
  if (name === 'csv') {
    const files = kind === 'main' ? state.files : state.parsedSource?.files;
    /** @type {Record<string, Uint8Array>} */
    const entries = {};
    for (const [slot, file] of Object.entries(files || {}))
      if (FILE_KINDS[slot] === 'csv')
        entries[file.filename] = new Uint8Array(await file.blob.arrayBuffer());
    if (!Object.keys(entries).length)
      throw new Error(
        'Attach a measurement CSV, or open a group file containing one, before downloading the original CSV files.',
      );
    download(
      `${filename()}_measurement_csvs.zip`,
      zipSync(entries, { level: 0 }),
      'application/zip',
    );
    message(
      'The ZIP contains the original uploaded CSV files without changes.',
    );
  }
  if (name === 'legacy' && previousWork) return recoverLegacy(previousWork);
  if (name === 'original') {
    if (!state.source) throw new Error('Open your group file first.');
    download(state.source.name, state.source.bytes);
  }
  if (name === 'print') {
    prepareReport();
    await Promise.all(
      [...$('report').querySelectorAll('img')].map((img) =>
        img.decode().catch(() => {}),
      ),
    );
    window.print();
  }
  if (name === 'save') {
    if (
      persistenceBlocked &&
      !(await preview(
        'Replace browser save with this session?',
        '<p>A previous browser save could not be loaded or written. Saving now replaces the active browser record with the current session. Download any needed backup first.</p>',
        'Save current session',
      ))
    )
      return;
    await save(true);
  }
  if (name === 'new') {
    if (
      !(await preview(
        'Start a new workbook?',
        '<p>This replaces the active worksheet in this browser. Download your current ZIP first to keep it.</p>',
        'Start new workbook',
      ))
    )
      return;
    visited.clear();
    state.record = createRecord(kind);
    state.files = {};
    state.source = state.parsedSource = null;
    persistenceBlocked = false;
    refreshURLs();
    touch();
    render(true);
    await save();
  }
  if (name === 'reviewed') {
    state.record.needsReview = false;
    touch();
    message(
      'You have confirmed that you checked your answers against the replacement group file.',
    );
  }
}
document.addEventListener('click', async (e) => {
  const button =
    e.target instanceof HTMLElement ? e.target.closest('button') : null;
  if (!button || !ready) return;
  try {
    if (button.dataset.page !== undefined)
      return navigate(Number(button.dataset.page));
    const slot = button.dataset.file || button.dataset.removeFile;
    if (
      slot &&
      kind === 'main' &&
      !['circuit', 'circuit2', 'circuit3', 'code'].includes(slot) &&
      !prerequisites(state.files, state.record)
    )
      throw new Error(
        'Upload a circuit photograph and paste your Arduino code in Section 1 first.',
      );
    if (button.dataset.file) {
      const category = FILE_KINDS[slot] || 'image';
      return chooseFile(
        category === 'code'
          ? '.ino'
          : category === 'csv'
            ? '.csv,text/csv'
            : 'image/png,image/jpeg,image/bmp,image/webp',
        async (file) => {
          const f = await validateAttachment(kind, slot, file),
            next = { ...state.files, [slot]: f };
          checkFiles(next);
          if (
            kind === 'main' &&
            !['circuit', 'circuit2', 'circuit3', 'code'].includes(slot) &&
            !prerequisites(state.files, state.record)
          )
            throw new Error(
              'Upload the circuit photograph and paste your Arduino code first.',
            );
          state.files = next;
          refreshURLs();
          touch();
          render();
          message(
            'Your file is attached locally and included in backups. It has not been submitted.',
          );
        },
      );
    }
    if (button.dataset.removeFile) {
      delete state.files[slot];
      refreshURLs();
      touch();
      render();
      return;
    }
    if (button.dataset.action) {
      setSaveMenu(false);
      await action(button.dataset.action);
    }
  } catch (error) {
    message(
      error.message ||
        'The operation could not be completed. Your current work remains in this session.',
      true,
    );
  }
});
// A checkbox is deliberately separate from navigation buttons.
document.addEventListener('change', (e) => {
  if (
    e.target instanceof HTMLInputElement &&
    e.target.dataset.action === 'reviewed' &&
    e.target.checked
  )
    void action('reviewed');
});
function setSaveMenu(open, restoreFocus = false) {
  $('save-menu').hidden = !open;
  $('save-menu-button').setAttribute('aria-expanded', String(open));
  $('save-detail').textContent = $('save-status').textContent;
  if (restoreFocus) $('save-menu-button').focus();
}
$('save-menu-button').onclick = () => setSaveMenu($('save-menu').hidden);
document.addEventListener('click', (event) => {
  if (
    event.target instanceof Element &&
    !event.target.closest('#save-menu, #save-menu-button')
  )
    setSaveMenu(false);
});
// Save pending edits before a worksheet link leaves the current browser view.
document.addEventListener('click', async (event) => {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    !(event.target instanceof Element)
  )
    return;
  const anchor = event.target.closest('a[href]');
  if (
    !(anchor instanceof HTMLAnchorElement) ||
    anchor.hasAttribute('download') ||
    !['_top', '_parent'].includes(anchor.target) ||
    revision <= savedRevision
  )
    return;
  event.preventDefault();
  await save();
  if (revision > savedRevision) {
    message(
      'Download a backup before leaving. Browser saving is unavailable.',
      true,
    );
    return;
  }
  window.top.location.assign(anchor.href);
});
$('previous').onclick = () => navigate(state.record.current - 1);
$('next').onclick = () => navigate(state.record.current + 1);
function setNavigationOpen(open, restoreFocus = true) {
  document.body.classList.toggle('nav-open', open);
  $('sidebar').classList.toggle('open', open);
  $('menu-button').setAttribute('aria-expanded', String(open));
  $('nav-shade').hidden = !open;
  document.querySelector('.frame')?.toggleAttribute('inert', open);
  if (open) $('close-navigation').focus();
  else if (restoreFocus) $('menu-button').focus();
}
$('menu-button').onclick = () =>
  setNavigationOpen(!document.body.classList.contains('nav-open'));
$('close-navigation').onclick = () => setNavigationOpen(false);
$('nav-shade').onclick = () => setNavigationOpen(false);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('save-menu').hidden) {
    e.preventDefault();
    setSaveMenu(false, true);
    return;
  }
  if (!document.body.classList.contains('nav-open')) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    setNavigationOpen(false);
  }
  if (e.key === 'Tab') {
    const controls = [
      ...$('sidebar').querySelectorAll('a[href],button:not([disabled])'),
    ].filter((el) => el.getClientRects().length);
    if (!controls.length) return;
    const position = controls.indexOf(document.activeElement);
    const next = e.shiftKey
      ? position <= 0
        ? controls.length - 1
        : position - 1
      : (position + 1) % controls.length;
    e.preventDefault();
    if (controls[next] instanceof HTMLElement) controls[next].focus();
  }
});
window.matchMedia('(min-width: 821px)').addEventListener('change', (e) => {
  if (e.matches) setNavigationOpen(false, false);
});
window.addEventListener('popstate', () => {
  const match = location.hash.match(/^#section-(\d+)$/);
  if (match) navigate(Number(match[1]) - 1, false);
});
window.addEventListener('beforeprint', prepareReport);
window.addEventListener('beforeunload', (e) => {
  if (revision > savedRevision) e.preventDefault();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && ready && revision > savedRevision) void save();
});
async function boot() {
  try {
    const saved = await storage.read('active');
    if (saved?.record) {
      const record = validateRecord(saved.record, kind),
        files = {};
      for (const [slot, f] of Object.entries(saved.files || {})) {
        if (!(f.blob instanceof Blob) && !(f.bytes instanceof Uint8Array))
          throw new Error('Invalid stored attachment.');
        files[slot] = await validateAttachment(
          kind,
          slot,
          f.blob || new Blob([f.bytes]),
          undefined,
          f.originalName || f.filename,
        );
      }
      if (kind === 'main')
        restoreGroupInputs(
          record,
          files,
          Object.hasOwn(saved.record.fields, 'code'),
        );
      checkFiles(files);
      let parsedSource = null;
      if (saved.source) {
        if (
          kind !== 'post' ||
          !(saved.source.bytes instanceof Uint8Array) ||
          typeof saved.source.name !== 'string' ||
          saved.source.name.length > 255
        )
          throw new Error('Invalid saved source.');
        parsedSource = await parseFile(saved.source.bytes, 'main');
        if (parsedSource.legacy)
          throw new Error('Older group source requires recovery.');
      }
      state.record = record;
      state.files = files;
      state.source = saved.source;
      state.parsedSource = parsedSource;
    } else if (saved && Object.keys(saved).length)
      throw new Error('Unrecognized saved work.');
    $('save-status').textContent = saved?.record
      ? 'Your saved worksheet is open.'
      : 'Download a backup as you work.';
  } catch {
    persistenceBlocked = true;
    storageWarning(
      'The browser save is unavailable or could not be read. It has not been overwritten. You can load a downloaded backup or work in this session and download it.',
    );
    $('save-status').textContent = 'Session only · download a backup';
  }
  try {
    const old = await legacyStore(kind).read('active');
    if (old?.record) {
      const oldFiles = {};
      for (const [slot, file] of Object.entries(old.files || {})) {
        if (!(file.blob instanceof Blob) && !(file.bytes instanceof Uint8Array))
          throw new Error('Unreadable older attachment.');
        oldFiles[slot] = await validateLegacyAttachment(
          kind,
          slot,
          file.blob || new Blob([file.bytes]),
        );
      }
      const backup = await legacyBackup(
        kind,
        old.record,
        oldFiles,
        old.source || null,
      );
      previousWork = await parseFile(
        new TextEncoder().encode(JSON.stringify(backup)),
        kind,
      );
      $('legacy-recovery').hidden = false;
      $('legacy-notice').hidden = false;
      $('legacy-notice').textContent =
        'Your version-one work is still saved. Use Save and load, then Recover version-one browser work, to read it and download a recovery ZIP. This version-two workbook is saved separately.';
    }
  } catch {
    $('legacy-notice').hidden = false;
    $('legacy-notice').textContent =
      'An older browser save could not be read. It has not been changed. You can also open a downloaded version-one backup for recovery.';
  }
  const match = location.hash.match(/^#section-(\d+)$/);
  if (match && Number(match[1]) >= 1 && Number(match[1]) <= pages(kind).length)
    state.record.current = Number(match[1]) - 1;
  refreshURLs();
  ready = true;
  render();
  window.dispatchEvent(new Event('sensor-calibration-ready'));
}
void boot().catch((error) =>
  message(
    error.message ||
      'The worksheet could not be opened. Keep any downloaded backups.',
    true,
  ),
);
Object.assign(window, {
  sensorCalibrationHost: {
    save: () => save(),
    print: () => action('print'),
    dirty: () => revision > savedRevision,
    ready: () => ready,
  },
});
