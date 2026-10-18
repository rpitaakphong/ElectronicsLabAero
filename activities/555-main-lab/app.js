import './styles.css';
import {
  createRecord,
  STORAGE_KEY,
  SCREENS,
  updateField,
  preservePrediction,
  parseRecord,
  validateRecord,
  number,
  progress,
  LEGACY_STORAGE_KEY,
  visitedPages,
  markPageVisited,
  designForEntry,
  REQUIRED_CAPTURES,
} from './model.js';
import { esc, screen, report, schematic, pinGuide, designFeedback } from './views.js';
import { timingEquations } from './scientific.js';
import { conversionSchematic, monostableWaveforms } from './diagrams.js';
import { imageStore, validateImage, createBackup, parseBackup, createLabZip, MAX_BACKUP_BYTES } from './attachments.js';

const $ = (selector) => document.querySelector(selector);
let record = createRecord(),
  current = 0,
  saveTimer,
  toastTimer;
let saveState = 'Not saved yet. Download your answers before closing.';
let storageBlocked = false,
  unreadable = null,
  unsaved = false,
  navOpen = false;
let stagedImport = null,
  dialogOpener = null;
let legacyRecord = null;
const dialog = $('#dialog');
/** @type {import('./attachments.js').Attachments} */
let images = {};
let imageLoading = true, imageSaving = false, imageStorageFailed = false;
let workspaceEpoch = 0, imageRevision = 0, writeQueue = Promise.resolve();
const storage = imageStore();
const previewUrls = [];
const busySlots = new Set();

function renderAttachments() {
  previewUrls.splice(0).forEach((url) => URL.revokeObjectURL(url));
  document.querySelectorAll('[data-attachment]').forEach((panel) => {
    const slot = panel.getAttribute('data-attachment'), image = images[slot];
    const input = /** @type {HTMLInputElement} */ (panel.querySelector('[data-image-file]'));
    const upload = /** @type {HTMLButtonElement} */ (panel.querySelector('[data-upload]'));
    const remove = /** @type {HTMLButtonElement} */ (panel.querySelector('[data-remove-image]'));
    input.disabled = imageLoading || busySlots.has(slot);
    upload.disabled = input.disabled || !input.files?.length;
    upload.textContent = busySlots.has(slot) ? 'Checking image…' : image ? 'Replace' : 'Upload';
    remove.hidden = !image;
    remove.disabled = input.disabled;
    panel.querySelector('.image-status').textContent = imageLoading ? 'Opening local images…' : image
      ? `Attached locally · ${image.filename} · ${(image.blob.size / 1024 / 1024).toFixed(2)} MiB`
      : `Image not attached${record.evidence[slot].filename ? ` · Previously recorded: ${record.evidence[slot].filename}` : ''}`;
    const preview = panel.querySelector('.image-preview');
    preview.replaceChildren();
    if (image) {
      const element = document.createElement('img');
      const url = URL.createObjectURL(image.blob);
      previewUrls.push(url);
      element.src = url;
      element.alt = `Attached screenshot: ${image.filename}`;
      preview.append(element);
    }
  });
}
function persistImages() {
  const epoch = workspaceEpoch, revision = ++imageRevision;
  const recordId = record.recordId, snapshot = { ...images };
  imageSaving = true;
  showSave('Saving images…');
  writeQueue = writeQueue.catch(() => {}).then(() => storage.write(recordId, snapshot)).then(() => {
    if (epoch !== workspaceEpoch || revision !== imageRevision) return;
    imageSaving = false;
    imageStorageFailed = false;
    save();
  }).catch(() => {
    if (epoch !== workspaceEpoch || revision !== imageRevision) return;
    imageSaving = false;
    imageStorageFailed = true;
    showSave('');
    toast('Images are attached for this session, but could not be saved in this browser. Download answers (JSON) or lab files (ZIP) before closing.');
  });
}
async function uploadImage(slot) {
  if (!REQUIRED_CAPTURES.includes(slot) || imageLoading || busySlots.has(slot)) return;
  const input = /** @type {HTMLInputElement} */ ($(`[data-image-file="${slot}"]`));
  const file = input?.files?.[0];
  if (!file) return;
  const epoch = workspaceEpoch;
  busySlots.add(slot);
  renderAttachments();
  try {
    const image = await validateImage(slot, file, file.name);
    if (epoch !== workspaceEpoch) return;
    images[slot] = image;
    record.evidence[slot].filename = image.filename;
    input.value = '';
    changed();
    persistImages();
    toast(`${image.filename} attached locally. No image was sent to a server.`);
  } catch (error) {
    if (epoch === workspaceEpoch) toast(`${error.message} Your existing attachment has not changed.`);
  } finally {
    if (epoch === workspaceEpoch) { busySlots.delete(slot); renderAttachments(); }
  }
}
function replaceWorkspace(candidate, attachments) {
  workspaceEpoch++;
  busySlots.clear();
  images = attachments;
  imageLoading = imageSaving = imageStorageFailed = false;
  record = candidate;
  storageBlocked = false;
  unreadable = null;
  current = 0;
  changed();
  save();
  persistImages();
  draw(true);
}

function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => {
    $('#toast').hidden = true;
  }, 6500);
}
function showSave(message) {
  if (imageStorageFailed) message = 'Images not saved in this browser. Download a JSON or ZIP backup before closing.';
  else if (imageSaving) message = 'Saving images in this browser… Download a backup before closing.';
  saveState = message;
  $('#save-status').textContent = message;
  $('#save-detail').textContent =
    message +
    ' Download a JSON backup before changing computers or clearing browser data.';
  $('#recover-button').hidden = unreadable === null;
}
function save() {
  clearTimeout(saveTimer);
  if (storageBlocked) {
    showSave(
      'Automatic saving is paused. Download your answers before closing; earlier saved answers will not be overwritten.',
    );
    return false;
  }
  try {
    const bytes = JSON.stringify(validateRecord(record));
    localStorage.setItem(STORAGE_KEY, bytes);
    if (localStorage.getItem(STORAGE_KEY) !== bytes)
      throw new Error('Save read-back failed');
    unsaved = false;
    showSave(`Saved in this browser · ${new Date().toLocaleTimeString()}`);
    return !imageStorageFailed && !imageSaving && !imageLoading;
  } catch {
    showSave(
      'Your answers could not be saved in this browser. Download them before closing this page.',
    );
    return false;
  }
}
function changed() {
  unsaved = true;
  record.updatedAt = new Date().toISOString();
  showSave(
    storageBlocked
      ? 'Automatic saving is paused. Download your answers before closing.'
      : 'Saving answers…',
  );
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 450);
}
function load() {
  try {
    legacyRecord = localStorage.getItem(LEGACY_STORAGE_KEY);
    $('#legacy-button').hidden = legacyRecord === null;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      unreadable = saved;
      record = parseRecord(saved);
      unreadable = null;
      showSave('Your previously saved answers have been reopened in this browser.');
    }
  } catch {
    storageBlocked = true;
    showSave(
      'Your earlier answers could not be opened. Automatic saving is paused so they will not be overwritten. Download any work you enter now.',
    );
  }
}
function download(name, content, type = 'application/json;charset=utf-8') {
  const blob = new Blob([content], { type }),
    url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
const groupFilename = (candidate) => `555_MAIN_LAB_${candidate.group.id.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'DRAFT'}`;
async function exportJson(zip = false) {
  try {
    if (imageLoading || busySlots.size) throw new Error('Wait for the image to finish opening, then try again.');
    const valid = validateRecord(record);
    const snapshot = { ...images }, name = groupFilename(valid);
    if (zip) {
      download(`${name}.zip`, await createLabZip(valid, snapshot, `${name}.json`), 'application/zip');
    } else download(`${name}.json`, JSON.stringify(await createBackup(valid, snapshot), null, 2));
    toast(
      zip ? `Lab files downloaded with ${Object.keys(snapshot).length}/3 images. Extract the ZIP to create the screenshots folder. Incomplete work is allowed.` : 'Your answers and attached images are being downloaded together as a JSON backup. Keep it to reopen your work later.',
    );
  } catch (error) {
    toast(`Your answers could not be downloaded. ${error.message}`);
  }
}
function closeSaveMenu() {
  $('#save-menu').hidden = true;
  $('#save-menu-button').setAttribute('aria-expanded', 'false');
}
function syncNav() {
  const mobile = matchMedia('(max-width: 820px)').matches;
  const sidebar = $('#sidebar');
  sidebar.classList.toggle('open', mobile && navOpen);
  sidebar.inert = mobile && !navOpen;
  $('#nav-shade').hidden = !mobile || !navOpen;
  $('.frame').inert = mobile && navOpen;
  $('#menu-button').setAttribute('aria-expanded', String(mobile && navOpen));
  if (mobile && navOpen) {
    sidebar.setAttribute('role', 'dialog');
    sidebar.setAttribute('aria-modal', 'true');
  } else {
    sidebar.removeAttribute('role');
    sidebar.removeAttribute('aria-modal');
  }
}
function closeNav(restore = false) {
  navOpen = false;
  syncNav();
  if (restore) $('#menu-button').focus();
}
function draw(focus = false) {
  $('#steps').innerHTML = SCREENS.map(
    ([title, note], i) =>
      `<button class="step ${current === i ? 'active' : ''}" data-step="${i}" ${current === i ? 'aria-current="step"' : ''}><span class="step-number" aria-hidden="true">${current === i ? '●' : visitedPages(record).includes(i) ? '✓' : i >= 1 && i <= 3 ? i : '·'}</span><span><strong>${title}</strong><small>${note}</small></span></button>`,
  ).join('');
  $('#breadcrumb').textContent =
    SCREENS[current][0];
  $('#screen-count').textContent =
    current >= 1 && current <= 3 ? `Lab ${current} of 3` : current === 0 ? 'Preparation' : 'Post-lab';
  $('#progress-bar').style.width = `${(100 * (current + 1)) / SCREENS.length}%`;
  $('#main').innerHTML = screen(record, current, Object.keys(images));
  renderAttachments();
  if (legacyRecord !== null && current === 0) {
    const notice = document.createElement('div');
    notice.className = 'callout warning';
    notice.innerHTML = '<strong>Answers from the earlier lab were found</strong><p>They have not been changed. To continue that lab, download the earlier answers from Save and load, then open START_HERE-v1.html and load the downloaded file there. This workbook saves its answers separately and uses seconds for timing entries.</p>';
    $('#main .screen-head').after(notice);
  }
  $('#previous').disabled = current === 0;
  $('#next').disabled = current === SCREENS.length - 1;
  $('#next').textContent =
    current === 3
      ? 'Continue to post-lab →'
      : current === SCREENS.length - 1
        ? 'Final page'
        : 'Continue →';
  syncNav();
  if (focus) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    $('#main').focus({ preventScroll: true });
  }
}
function go(index) {
  if (!Number.isInteger(index) || index < 0 || index >= SCREENS.length) return;
  current = index;
  markPageVisited(record, index);
  closeNav();
  closeSaveMenu();
  changed();
  draw(true);
}
function openDialog(title, html, wide = false) {
  dialogOpener = document.activeElement;
  $('#dialog-title').textContent = title;
  $('#dialog-body').innerHTML = html;
  dialog.classList.toggle('wide', wide);
  dialog.showModal();
  $('#dialog-close').focus();
}
function finishDialog() {
  dialog.close();
  stagedImport = null;
  if (dialogOpener?.isConnected) dialogOpener.focus();
}
function importPreview(candidate) {
  stagedImport = candidate;
  const p = progress(candidate.record, Object.keys(candidate.images));
  const incoming = candidate.record;
  openDialog(
    'Check the backup before loading',
    `<p><strong>Group:</strong> ${esc(incoming.group.id || '(not entered)')}</p><p class="prewrap"><strong>Members:</strong> ${esc(incoming.group.members || '(not entered)')}</p><p>Workbook version ${incoming.schemaVersion} · Last saved ${esc(incoming.updatedAt)} (computer time)</p><p>${p.preserved}/3 initial designs saved · ${p.captures}/${REQUIRED_CAPTURES.length} images attached.</p><p>Loading replaces the current answers and attachments; it never combines groups. Older filename-only backups need their images attached again. Download your current backup first if you want to keep it.</p><div class="actions"><button data-action="export">Download current answers</button><button id="cancel-import">Keep current answers</button><button id="confirm-import" class="primary">Load these answers</button></div>`,
  );
}
function printReport() {
  closeSaveMenu();
  $('#report').innerHTML = report(record);
  const previousTitle = document.title;
  document.title = `555_MAIN_LAB_${record.group.id.trim() || 'DRAFT'}`;
  window.print();
  document.title = previousTitle;
}
function action(name) {
  if (name !== 'print') closeSaveMenu();
  if (name === 'save') {
    save();
    toast(saveState);
  }
  if (name === 'export') void exportJson();
  if (name === 'zip') void exportJson(true);
  if (name === 'import') {
    $('#import-file').value = '';
    $('#import-file').click();
  }
  if (name === 'print') printReport();
  if (name === 'legacy' && legacyRecord !== null)
    download('555_MAIN_LAB_previous_v1_record.json', legacyRecord);
  if (name === 'recover' && unreadable !== null)
    download(
      '555_MAIN_LAB_unreadable_local_record.txt',
      unreadable,
      'text/plain;charset=utf-8',
    );
  if (name === 'new')
    openDialog(
      'Start a new workbook?',
      '<p>This will replace the current group’s answers and attachments with an empty workbook. Download a backup first to keep them. Original computer image files will not be deleted. If earlier answers could not be opened, download that saved file before replacing it.</p><div class="actions"><button data-action="export">Download current answers</button><button id="cancel-new">Keep current answers</button><button id="confirm-new" class="primary">Start new workbook</button></div>',
    );
}
document.addEventListener('input', (event) => {
  const input = event.target;
  if (
    !(
      input instanceof HTMLInputElement ||
      input instanceof HTMLSelectElement ||
      input instanceof HTMLTextAreaElement
    ) ||
    !input.matches('[data-field]')
  )
    return;
  try {
    const value =
      input instanceof HTMLInputElement && input.type === 'checkbox'
        ? input.checked
        : input.value;
    updateField(record, input.dataset.field, value);
    if (input.dataset.numeric) {
      const numeric = typeof value === 'string' ? number(value) : null;
      const invalid =
        typeof value === 'string' &&
        value.trim() !== '' &&
        (numeric === null || (Boolean(input.dataset.positive) && numeric <= 0));
      input.setAttribute('aria-invalid', String(invalid));
      input.title = invalid
        ? input.dataset.positive
          ? 'Enter a resistance greater than zero, in kΩ, without typing the unit. Incomplete entries are kept in draft backups.'
          : 'Enter a number that is zero or greater, without units. If you do not know the value, leave it blank and explain why in the notes.'
        : '';
    }
    if (input.dataset.field.startsWith('configs.') && input.dataset.field.includes('.design.') && ['r1a', 'r2a', 'capacitor'].includes(input.dataset.field.split('.').at(-1))) {
      const line = input.closest('.paper')?.querySelector('[data-design-feedback]');
      if (line) {
        const id = input.dataset.field.split('.')[1], d = designForEntry(record, id);
        line.innerHTML = designFeedback(id, d);
      }
    }
    changed();
  } catch (error) {
    toast(error.message);
  }
});
document.addEventListener('change', (event) => {
  const select = event.target;
  if (select instanceof HTMLInputElement && select.matches('[data-image-file]')) renderAttachments();
  if (
    select instanceof HTMLSelectElement &&
    select.matches('select[data-field]')
  ) {
    // Do not replace the editor while typing. Refresh only the design feedback.
    const line = select.closest('.paper')?.querySelector('[data-design-feedback]');
    if (line) {
      const id = select.dataset.field.split('.')[1],
        d = designForEntry(record, id);
      line.innerHTML = designFeedback(id, d);
    }
  }
});
document.addEventListener('click', (event) => {
  const button =
    event.target instanceof Element ? event.target.closest('button') : null;
  if (!button) return;
  if (button.dataset.step !== undefined) go(Number(button.dataset.step));
  if (button.dataset.action) action(button.dataset.action);
  if (button.dataset.upload) void uploadImage(button.dataset.upload);
  if (button.dataset.removeImage) {
    const slot = button.dataset.removeImage;
    if (REQUIRED_CAPTURES.includes(slot) && !busySlots.has(slot) && !imageLoading) {
      delete images[slot];
      record.evidence[slot].filename = '';
      changed();
      persistImages();
      renderAttachments();
      toast('Attachment removed from this workbook. The original computer file has not been deleted.');
    }
  }
  if (button.hasAttribute('data-go-task1-frequency')) {
    go(1);
    const frequency = $('[data-field="configs.A0.measurement.frequency"]');
    const disabled = frequency.matches(':disabled');
    const target = disabled ? $('[data-preserve="A0"]') : frequency;
    target.scrollIntoView({ block: 'center' });
    target.focus({ preventScroll: true });
    if (disabled)
      toast('Save your Lab 1 initial design and predictions first. Then enter the oscilloscope frequency in Measured results → Frequency (Hz).');
  }
  if (button.dataset.preserve) {
    try {
      preservePrediction(record, button.dataset.preserve);
      changed();
      draw();
      const heading = $('#main h1');
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      toast(
        'Your initial design and predictions have been saved. You can now enter your measured results.',
      );
    } catch (error) {
      toast(error.message);
    }
  }
  if (button.dataset.reference === 'astable-equations')
    openDialog('Lab 1 - Astable Circuit Equations', timingEquations(true));
  if (button.dataset.expand) {
    const kind = button.dataset.expand;
    const diagrams = {
      pins: ['NE555 DIP-8 pin guide', pinGuide],
      schematic: ['Astable circuit diagram', schematic],
      'monostable-waveforms': ['Example oscilloscope signals', monostableWaveforms],
      'conversion-astable': ['Before conversion · Astable timing connections', () => conversionSchematic('astable')],
      'conversion-monostable': ['After conversion · Monostable timing connections', () => conversionSchematic('monostable')],
    };
    const entry = diagrams[kind];
    if (entry) {
      const [title, render] = entry;
      openDialog(title, `<p>Scroll sideways to view the whole diagram if needed. You can also select the diagram and use the arrow keys. Press Escape to close it.</p><div class="expanded-diagram" data-diagram="${kind}" tabindex="0" role="region" aria-label="Enlarged circuit diagram or pin guide">${render()}</div>`, true);
    }
  }
  if (button.id === 'confirm-import' && stagedImport) {
    const candidate = stagedImport;
    finishDialog();
    replaceWorkspace(candidate.record, candidate.images);
    toast('Your answers and attached images have been loaded, including original designs and predictions.');
  }
  if (button.id === 'confirm-new') {
    finishDialog();
    replaceWorkspace(createRecord(), {});
  }
  if (['dialog-close', 'cancel-import', 'cancel-new'].includes(button.id))
    finishDialog();
});
$('#import-file').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  try {
    if (file.size > MAX_BACKUP_BYTES)
      throw new Error('The file is larger than the 64 MiB backup limit.');
    const epoch = workspaceEpoch;
    const candidate = await parseBackup(await file.text());
    if (epoch === workspaceEpoch) importPreview(candidate);
  } catch (error) {
    toast(
      `Could not load this backup. ${error.message} Your current answers have not been changed.`,
    );
  }
});
$('#previous').addEventListener('click', () => go(current - 1));
$('#next').addEventListener('click', () => go(current + 1));
$('#menu-button').addEventListener('click', () => {
  closeSaveMenu();
  navOpen = true;
  syncNav();
  $('#close-navigation').focus();
});
$('#close-navigation').addEventListener('click', () => closeNav(true));
$('#nav-shade').addEventListener('click', () => closeNav(true));
$('#save-menu-button').addEventListener('click', () => {
  const menu = $('#save-menu');
  menu.hidden = !menu.hidden;
  $('#save-menu-button').setAttribute('aria-expanded', String(!menu.hidden));
});
document.addEventListener('click', (event) => {
  if (
    event.target instanceof Element &&
    !event.target.closest('#save-menu, #save-menu-button')
  )
    closeSaveMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !dialog.open) {
    if (navOpen) closeNav(true);
    else {
      closeSaveMenu();
      $('#save-menu-button').focus();
    }
  }
  if (
    event.key === 'Tab' &&
    navOpen &&
    matchMedia('(max-width:820px)').matches
  ) {
    const focusable = [...$('#sidebar').querySelectorAll('button')].filter(
      (el) => !el.disabled,
    );
    const first = focusable[0],
      last = focusable.at(-1);
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
  finishDialog();
});
window.addEventListener('resize', () => {
  if (!matchMedia('(max-width:820px)').matches) navOpen = false;
  syncNav();
});
window.addEventListener('beforeprint', () => {
  $('#report').innerHTML = report(record);
});
window.addEventListener('beforeunload', (event) => {
  if ((unsaved && !save()) || imageSaving || imageStorageFailed || busySlots.size) event.preventDefault();
});
load();
draw();
async function openImages() {
  const epoch = workspaceEpoch;
  try {
    const saved = await storage.read(record.recordId);
    /** @type {import('./attachments.js').Attachments} */
    const opened = {};
    for (const slot of REQUIRED_CAPTURES) {
      if (saved[slot]) opened[slot] = await validateImage(slot, saved[slot].blob, saved[slot].filename);
    }
    if (epoch !== workspaceEpoch) return;
    images = opened;
    for (const slot of Object.keys(images)) record.evidence[slot].filename = images[slot].filename;
  } catch {
    if (epoch !== workspaceEpoch) return;
    imageStorageFailed = true;
    toast('Local image storage could not be opened. Your answers are unchanged. Attach any missing images and download a JSON or ZIP backup before closing.');
  } finally {
    if (epoch === workspaceEpoch) {
      imageLoading = false;
      showSave(saveState);
      // Only refresh attachment controls: keep any answers being typed intact.
      renderAttachments();
      if (current === 4) draw();
    }
  }
}
void openImages();
