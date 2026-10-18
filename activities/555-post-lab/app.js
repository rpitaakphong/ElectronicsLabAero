import '../555-main-lab/styles.css';
import { esc } from '../555-main-lab/views.js';
import {
  imageStore,
  validateImage,
  parseMainFile,
  MAX_BACKUP_BYTES,
} from '../555-main-lab/attachments.js';
import { MAX_ZIP_BYTES } from '../555-main-lab/archive.js';
import { REQUIRED_CAPTURES } from '../555-main-lab/model.js';
import { parsePrelab } from './prelab.js';
import {
  ACTIVE_KEY,
  PAGES,
  createPostlab,
  validatePostlab,
  withSource,
  issues,
  postlabFilename,
  postlabBackup,
  parsePostlabFile,
  postlabZip,
} from './model.js';
import { postlabScreen, individualReport } from './views.js';

const $ = (selector) => document.querySelector(selector);
let record = createPostlab(),
  images = {},
  current = 0,
  epoch = 0,
  timer,
  toastTimer;
let unsaved = false,
  blocked = false,
  booting = true,
  importing = false,
  saving = 0,
  navOpen = false;
let staged = null,
  opener = null,
  queue = Promise.resolve(),
  printPreparing = false,
  printActive = false;
const store = imageStore(undefined, 'electronics-555-post-lab-workbooks');
const urls = new Map(),
  retired = new Set();
let reportDirty = true;
const dialog = $('#dialog');
function toast(text) {
  clearTimeout(toastTimer);
  $('#toast').textContent = text;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => ($('#toast').hidden = true), 8000);
}
function status(text) {
  $('#save-status').textContent = text;
  $('#save-detail').textContent =
    text +
    ' Download a JSON or ZIP backup before leaving or changing computers.';
}
function release() {
  if (!printActive) {
    retired.forEach((url) => URL.revokeObjectURL(url));
    retired.clear();
  }
}
function imageSources() {
  return Object.fromEntries([...urls].map(([slot, item]) => [slot, item.url]));
}
function refreshReport(forPrint = false) {
  if (printActive && !forPrint) {
    reportDirty = true;
    return;
  }
  let changed = false;
  for (const slot of REQUIRED_CAPTURES) {
    const old = urls.get(slot),
      image = images[slot];
    if (old?.blob === image?.blob) continue;
    if (old) {
      retired.add(old.url);
      urls.delete(slot);
    }
    if (image)
      urls.set(slot, {
        blob: image.blob,
        url: URL.createObjectURL(image.blob),
      });
    changed = true;
  }
  if (reportDirty || changed) {
    const report = $('#report'),
      decoded = new Map(
        [...report.querySelectorAll('img[data-report-image]')].map((img) => [
          img.dataset.reportImage,
          img,
        ]),
      );
    report.innerHTML =
      (booting || importing
        ? '<p class="report-warning">Files are still opening. Close print preview and wait, then print again.</p>'
        : '') + individualReport(record, imageSources());
    report
      .querySelectorAll('details')
      .forEach((detail) => (detail.open = true));
    report.querySelectorAll('img[data-report-image]').forEach((img) => {
      const old = decoded.get(img.dataset.reportImage);
      if (old?.src === img.src && old.complete && old.naturalWidth)
        img.replaceWith(old);
    });
    reportDirty = false;
  }
  release();
}
function save() {
  clearTimeout(timer);
  if (booting || blocked) {
    status(
      'Browser saving is unavailable or paused. Download a backup to keep this session.',
    );
    return queue;
  }
  const snapshot = { record: validatePostlab(record), images: { ...images } },
    revision = record.updatedAt,
    atEpoch = epoch;
  saving++;
  status('Saving individual work in this browser…');
  queue = queue
    .catch(() => {})
    .then(async () => {
      try {
        await store.write(snapshot.record.recordId, snapshot);
        if (atEpoch !== epoch) return;
        localStorage.setItem(ACTIVE_KEY, snapshot.record.recordId);
        if (localStorage.getItem(ACTIVE_KEY) !== snapshot.record.recordId)
          throw new Error('Save read-back failed.');
        if (record.updatedAt === revision) unsaved = false;
        status(`Saved in this browser · ${new Date().toLocaleTimeString()}`);
      } catch {
        if (atEpoch === epoch) {
          unsaved = true;
          status(
            'Save failed. Your answers and images remain in this session. Download a JSON or ZIP backup before closing.',
          );
        }
      } finally {
        saving--;
      }
    });
  return queue;
}
function changed() {
  unsaved = true;
  record.updatedAt = new Date().toISOString();
  reportDirty = true;
  status('Unsaved changes…');
  clearTimeout(timer);
  timer = setTimeout(save, 450);
  refreshReport();
}
function syncNav() {
  const mobile = matchMedia('(max-width:820px)').matches,
    open = mobile && navOpen;
  $('#sidebar').classList.toggle('open', open);
  $('#sidebar').inert = mobile && !open;
  $('#nav-shade').hidden = !open;
  $('.frame').inert = open;
  $('#menu-button').setAttribute('aria-expanded', String(open));
  if (open) {
    $('#sidebar').setAttribute('role', 'dialog');
    $('#sidebar').setAttribute('aria-modal', 'true');
  } else {
    $('#sidebar').removeAttribute('role');
    $('#sidebar').removeAttribute('aria-modal');
  }
}
function closeMenu() {
  $('#save-menu').hidden = true;
  $('#save-menu-button').setAttribute('aria-expanded', 'false');
}
function draw(focus = false) {
  refreshReport();
  $('#steps').innerHTML = PAGES.map(
    (name, i) =>
      `<button class="step ${i === current ? 'active' : ''}" data-step="${i}" ${i === current ? 'aria-current="step"' : ''}><span class="step-number">${i + 1}</span><span><strong>${name}</strong></span></button>`,
  ).join('');
  $('#breadcrumb').textContent = PAGES[current];
  $('#screen-count').textContent = `${current + 1} of ${PAGES.length}`;
  $('#progress-bar').style.width = `${(100 * (current + 1)) / PAGES.length}%`;
  $('#main').innerHTML = postlabScreen(record, current, imageSources());
  $('#main')
    .querySelectorAll('[data-import-source]')
    .forEach((button) => (button.disabled = importing || booting));
  $('#previous').disabled = current === 0;
  $('#next').disabled = current === PAGES.length - 1;
  $('#next').textContent =
    current === PAGES.length - 1 ? 'Final page' : 'Continue →';
  syncNav();
  if (focus) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    $('#main').focus({ preventScroll: true });
  }
}
function go(index) {
  if (index < 0 || index >= PAGES.length) return;
  current = index;
  navOpen = false;
  closeMenu();
  draw(true);
}
function showDialog(title, html) {
  opener = document.activeElement;
  $('#dialog-title').textContent = title;
  $('#dialog-body').innerHTML = html;
  dialog.showModal();
  $('#dialog-close').focus();
}
function closeDialog() {
  dialog.close();
  staged = null;
  $('#dialog-body').innerHTML = '';
  if (opener?.isConnected) opener.focus();
}
function download(name, content, type = 'application/json;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
async function exportWork(zip = false) {
  try {
    if (booting || importing)
      throw new Error('Wait for files to finish opening.');
    const snapshot = validatePostlab(record),
      attached = { ...images },
      name = postlabFilename(snapshot);
    if (zip)
      download(
        name + '.zip',
        await postlabZip(snapshot, attached),
        'application/zip',
      );
    else {
      const text = JSON.stringify(
        await postlabBackup(snapshot, attached),
        null,
        2,
      );
      if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES)
        throw new Error('This backup exceeds the supported 64 MiB limit.');
      download(name + '.json', text);
    }
    toast('Download initiated. This is a local backup, not a submission.');
  } catch (error) {
    toast('Could not download: ' + error.message);
  }
}
function replace(candidate) {
  epoch++;
  clearTimeout(timer);
  record = candidate.record;
  images = candidate.images;
  blocked = false;
  booting = false;
  importing = false;
  reportDirty = true;
  changed();
  void save();
  draw(true);
}
function preview(candidate, title) {
  staged = candidate;
  const pre = candidate.record.sources.prelab,
    main = candidate.record.sources.main;
  showDialog(
    title,
    `<p>Student: ${esc(pre?.student.full_name || '(pre-lab not imported)')} · ${esc(pre?.student.university_student_id || '')}</p><p>Group: ${esc(main?.group.id || '(main lab not imported)')}</p><p>${Object.keys(candidate.images).length}/3 screenshots attached.</p><p>${esc(issues(candidate.record, false).join(' '))}</p><p>Only this explicit confirmation replaces the current source or workbook. Download your current backup first if needed. Individual writing is retained only for the same student and group; updated sources require review.</p><div class="actions"><button data-action="export">Download current answers</button><button id="cancel-import">Keep current</button><button id="confirm-import" class="primary">Use imported file</button></div>`,
  );
}
async function importFile(file, kind) {
  if (!file || booting || importing) return;
  importing = true;
  reportDirty = true;
  const atEpoch = epoch;
  draw();
  try {
    if (file.size > MAX_ZIP_BYTES)
      throw new Error('File exceeds the supported 96 MiB ZIP limit.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    let candidate;
    if (kind === 'backup') candidate = await parsePostlabFile(bytes);
    else if (kind === 'prelab')
      candidate = {
        record: withSource(record, 'prelab', parsePrelab(bytes), file.name),
        images: { ...images },
      };
    else {
      const parsed = await parseMainFile(bytes);
      if (parsed.migrated)
        throw new Error(
          'Open this earlier backup in the main worksheet, confirm the two students and add their IDs, then download a new ZIP.',
        );
      candidate = {
        record: withSource(record, 'main', parsed.record, file.name),
        images: parsed.images,
      };
    }
    if (atEpoch === epoch)
      preview(
        candidate,
        kind === 'backup'
          ? 'Restore individual workspace?'
          : 'Check the source before importing',
      );
  } catch (error) {
    if (atEpoch === epoch)
      toast(
        'Import failed: ' + error.message + ' Current work has not changed.',
      );
  } finally {
    if (atEpoch === epoch) {
      importing = false;
      reportDirty = true;
      draw();
    }
  }
}
async function printReport() {
  if (printPreparing || printActive) return;
  if (booting || importing) {
    toast('Wait for the files to finish opening, then print again.');
    return;
  }
  const problems = issues(record);
  if (problems.length) {
    toast(problems.join(' ') + ' Draft JSON/ZIP backups remain available.');
    return;
  }
  closeMenu();
  printPreparing = true;
  const atEpoch = epoch;
  document.querySelectorAll('[data-action="print"]').forEach((b) => {
    if (b instanceof HTMLButtonElement) b.disabled = true;
    b.textContent = 'Preparing report…';
  });
  try {
    refreshReport();
    await Promise.all(
      [...$('#report').querySelectorAll('img')].map(async (img) => {
        let timeout;
        try {
          await Promise.race([
            img.decode(),
            new Promise(
              (_, reject) =>
                (timeout = setTimeout(
                  () => reject(new Error('Image took too long to open.')),
                  10000,
                )),
            ),
          ]);
        } finally {
          clearTimeout(timeout);
        }
        if (!img.complete || !img.naturalWidth)
          throw new Error('An attached image could not be opened.');
      }),
    );
    if (atEpoch !== epoch)
      throw new Error('The individual workspace changed. Try again.');
    const old = document.title;
    document.title = postlabFilename(record);
    try {
      window.print();
    } finally {
      document.title = old;
    }
  } catch (error) {
    toast('Could not prepare the report. ' + error.message);
  } finally {
    printPreparing = false;
    document.querySelectorAll('[data-action="print"]').forEach((b) => {
      if (b instanceof HTMLButtonElement) b.disabled = false;
      b.textContent = 'Print or save report as PDF';
    });
  }
}
function action(name) {
  closeMenu();
  if (name === 'save') void save();
  if (name === 'export') void exportWork();
  if (name === 'zip') void exportWork(true);
  if (name === 'print') void printReport();
  if (name === 'import') {
    $('#import-file').value = '';
    $('#import-file').click();
  }
  if (name === 'new')
    showDialog(
      'Start a new individual workspace?',
      '<p>Download a backup first. The new workspace will have no sources, writing or screenshots. Original computer files will not be deleted.</p><div class="actions"><button data-action="export">Download current answers</button><button id="cancel-import">Keep current</button><button id="confirm-new" class="primary">Start new workspace</button></div>',
    );
}
document.addEventListener('click', (event) => {
  const button =
    event.target instanceof Element ? event.target.closest('button') : null;
  if (!button) return;
  if (button.dataset.step !== undefined) go(Number(button.dataset.step));
  if (button.dataset.action) action(button.dataset.action);
  if (button.dataset.importSource) {
    const kind = button.dataset.importSource,
      file = $(`[data-source="${kind}"]`)?.files[0];
    if (!file) toast('Choose a ZIP or JSON file first.');
    else void importFile(file, kind);
  }
  if (button.id === 'confirm-import' && staged) {
    const candidate = staged;
    closeDialog();
    replace(candidate);
    toast('Imported locally. Review and confirm your identity.');
  }
  if (button.id === 'confirm-new') {
    closeDialog();
    replace({ record: createPostlab(), images: {} });
  }
  if (['dialog-close', 'cancel-import'].includes(button.id)) closeDialog();
});
document.addEventListener('input', (event) => {
  const input = event.target;
  if (
    !(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)
  )
    return;
  if (input instanceof HTMLInputElement && input.hasAttribute('data-confirm')) {
    record.identityConfirmed = input.checked;
    changed();
  }
  if (
    input instanceof HTMLInputElement &&
    input.hasAttribute('data-reviewed') &&
    input.checked
  ) {
    record.needsReview = false;
    changed();
    toast('Review confirmed.');
  }
  if (input.dataset.field) {
    const [section, key] = input.dataset.field.split('.');
    if (
      !['analysis', 'optional'].includes(section) ||
      !Object.hasOwn(record[section], key) ||
      input.value.length > 4000
    )
      return;
    record[section][key] = input.value;
    changed();
  }
});
$('#import-file').addEventListener('change', (event) => {
  const file = event.target.files[0];
  event.target.value = '';
  void importFile(file, 'backup');
});
$('#previous').addEventListener('click', () => go(current - 1));
$('#next').addEventListener('click', () => go(current + 1));
$('#save-menu-button').addEventListener('click', () => {
  $('#save-menu').hidden = !$('#save-menu').hidden;
  $('#save-menu-button').setAttribute(
    'aria-expanded',
    String(!$('#save-menu').hidden),
  );
});
$('#menu-button').addEventListener('click', () => {
  closeMenu();
  navOpen = true;
  syncNav();
  $('#close-navigation').focus();
});
$('#close-navigation').addEventListener('click', () => {
  navOpen = false;
  syncNav();
  $('#menu-button').focus();
});
$('#nav-shade').addEventListener('click', () => {
  navOpen = false;
  syncNav();
  $('#menu-button').focus();
});
document.addEventListener('click', (event) => {
  if (
    event.target instanceof Element &&
    !event.target.closest('#save-menu,#save-menu-button')
  )
    closeMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !dialog.open) {
    navOpen = false;
    syncNav();
    closeMenu();
    $('#menu-button').focus();
  }
  if (
    event.key === 'Tab' &&
    navOpen &&
    matchMedia('(max-width:820px)').matches
  ) {
    const buttons = [...$('#sidebar').querySelectorAll('button')].filter(
        (b) => !b.disabled,
      ),
      first = buttons[0],
      last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});
dialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeDialog();
});
window.addEventListener('resize', () => {
  if (!matchMedia('(max-width:820px)').matches) navOpen = false;
  syncNav();
});
window.addEventListener('beforeprint', () => {
  printActive = true;
  reportDirty = true;
  refreshReport(true);
});
window.addEventListener('afterprint', () => {
  printActive = false;
  refreshReport();
  release();
  if (current === 2) draw();
});
window.addEventListener('beforeunload', (event) => {
  if (unsaved || saving || importing) event.preventDefault();
});
async function start() {
  draw();
  try {
    const id = localStorage.getItem(ACTIVE_KEY);
    if (id) {
      const saved = await store.read(id);
      if (!saved.record || saved.record.recordId !== id)
        throw new Error('Saved individual workspace could not be opened.');
      const candidate = validatePostlab(saved.record),
        opened = {};
      for (const slot of REQUIRED_CAPTURES)
        if (saved.images?.[slot])
          opened[slot] = await validateImage(
            slot,
            saved.images[slot].blob,
            saved.images[slot].filename,
          );
      if (!candidate.sources.main && Object.keys(opened).length)
        throw new Error('Saved images have no source record.');
      record = candidate;
      images = opened;
      status('Your individual workspace has been reopened in this browser.');
    } else
      status('Not saved yet. Import your source files and download a backup.');
  } catch {
    blocked = true;
    status(
      'Earlier browser data could not be opened. Saving is paused to protect it. Restore an individual backup or start a new workspace.',
    );
    toast(
      'Browser storage could not be opened. Keep this session and download a backup before closing.',
    );
  } finally {
    booting = false;
    reportDirty = true;
    draw();
    document.body.dataset.ready = 'true';
  }
}
void start();
