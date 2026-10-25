import './styles.css';
import { createRecord, validateRecord, updateField, preserve, identityIssues, filename, SCREENS, STORAGE_KEY, MAX_CODE } from './model.js';
import { fileStore, validateFile, checkTotal, createBackup, createZip, parseFile } from './files.js';
import { screen, report, esc } from './views.js';

const $ = (s) => document.querySelector(s);
let record = createRecord(), files = {}, urls = {}, recovery = null, paused = false, busy = false, epoch = 0;
let storageProblem = '', fileProblem = '', timer, pending = Promise.resolve(), savingFiles = 0, dialogFocus, navOpen = false;
const store = fileStore();
function status(message) { $('#save-status').textContent = message; $('#save-detail').textContent = message + ' Keep a downloaded backup before changing computers.'; }
function notify(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(timer); timer = setTimeout(() => { $('#toast').hidden = true; }, 9000); }
function download(name, content, type = 'application/json') {
  const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function save() {
  if (paused) { status('Some saved answers or files could not be opened. Automatic saving is paused. Download a backup, then use Load lab data or Start a new workbook.'); return; }
  try {
    record.fileSlots = Object.keys(files);
    const text = JSON.stringify(validateRecord(record));
    localStorage.setItem(STORAGE_KEY, text);
    if (localStorage.getItem(STORAGE_KEY) !== text) throw new Error('Save did not persist.');
    storageProblem = '';
    status(fileProblem || 'Answers saved in this browser. Download a backup to keep your answers, code and files.');
  } catch { storageProblem = 'Browser saving failed. Keep this tab open and download JSON or ZIP now.'; status(storageProblem); }
}
function persistFiles() {
  if (paused) { save(); return Promise.resolve(); }
  const id = record.recordId, snapshot = { ...files }, at = epoch;
  ++savingFiles;
  status('Saving attached files in this browser…');
  pending = pending.then(async () => {
    try { await store.write(id, snapshot); if (at === epoch) { fileProblem = ''; save(); } }
    catch { if (at === epoch) { fileProblem = 'Attachments are available in this tab but could not be saved. Download JSON or ZIP before closing.'; status(fileProblem); } }
    finally { --savingFiles; }
  });
  return pending;
}
function refreshUrls() {
  for (const url of Object.values(urls)) URL.revokeObjectURL(url);
  urls = Object.fromEntries(Object.entries(files).filter(([s]) => s.endsWith('.image')).map(([s, f]) => [s, URL.createObjectURL(f.blob)]));
}
function syncNavigation() {
  const mobile = matchMedia('(max-width: 820px)').matches, sidebar = $('#sidebar');
  sidebar.classList.toggle('open', mobile && navOpen);
  sidebar.inert = mobile && !navOpen;
  $('.frame').inert = mobile && navOpen;
  $('#nav-shade').hidden = !mobile || !navOpen;
  $('#menu-button').setAttribute('aria-expanded', String(mobile && navOpen));
  if (mobile && navOpen) { sidebar.setAttribute('role', 'dialog'); sidebar.setAttribute('aria-modal', 'true'); }
  else { sidebar.removeAttribute('role'); sidebar.removeAttribute('aria-modal'); }
}
function closeNavigation(restore = false) { navOpen = false; syncNavigation(); if (restore) $('#menu-button').focus(); }
function closeMenu() { $('#save-menu').hidden = true; $('#save-menu-button').setAttribute('aria-expanded', 'false'); }
function render(focus = false) {
  const opened = [...document.querySelectorAll('details[open]')].map((el) => el.id);
  $('#steps').innerHTML = SCREENS.map((title, i) => `<button class="step${i === record.current ? ' active' : ''}" data-step="${i}" ${i === record.current ? 'aria-current="step"' : ''}><span class="step-number">${i + 1}</span><strong>${title}</strong></button>`).join('');
  $('#main').innerHTML = screen(record, record.current, files, urls);
  // Assign learner code as textarea values; never interpret it as markup.
  for (const el of document.querySelectorAll('textarea[data-field^="code."]')) if (el instanceof HTMLTextAreaElement) el.value = record.fields[el.dataset.field];
  for (const id of opened) { const el = document.getElementById(id); if (el instanceof HTMLDetailsElement) el.open = true; }
  $('#breadcrumb').textContent = SCREENS[record.current]; $('#screen-count').textContent = `${record.current + 1} / ${SCREENS.length}`;
  $('#progress-bar').style.width = `${(record.current + 1) * 100 / SCREENS.length}%`;
  $('#previous').disabled = record.current === 0; $('#next').disabled = record.current === SCREENS.length - 1;
  if (focus) { $('#main').focus(); window.scrollTo(0, 0); }
}
function openDialog(title, body) {
  dialogFocus = document.activeElement;
  $('#dialog-title').textContent = title; $('#dialog-body').innerHTML = body; $('#dialog').showModal();
}
function closeDialog() { $('#dialog').close(); if (dialogFocus instanceof HTMLElement && dialogFocus.isConnected) dialogFocus.focus(); }
async function exportWork(zip) {
  if (busy) throw new Error('Wait for the current file to finish opening.');
  const snapshot = validateRecord(record), attachments = { ...files };
  if (paused && record.fileSlots.some((s) => !files[s])) notify('Some browser attachments could not be recovered. This download contains only the files available in this tab. Load a complete backup or add the missing files again.');
  download(`${filename(snapshot)}.${zip ? 'zip' : 'json'}`, zip ? await createZip(snapshot, attachments) : JSON.stringify(await createBackup(snapshot, attachments), null, 2), zip ? 'application/zip' : 'application/json');
  if (!paused) notify('Your answers, code and attached files have been downloaded. Keep the download and submit it as instructed.');
}
async function printReport() {
  if (busy) throw new Error('Wait for the file operation to finish.');
  const issues = identityIssues(record); if (issues.length) throw new Error(issues.join(' ') + ' Draft JSON/ZIP downloads remain available.');
  // Independent report URLs survive navigation/replacing preview URLs.
  const printUrls = Object.fromEntries(Object.entries(files).filter(([s]) => s.endsWith('.image')).map(([s, f]) => [s, URL.createObjectURL(f.blob)]));
  $('#report').innerHTML = report(record, files, printUrls);
  await Promise.all([...document.querySelectorAll('#report img')].map((img) => img instanceof HTMLImageElement ? img.decode() : Promise.resolve()));
  const title = document.title; document.title = filename(record);
  try { window.print(); } finally { document.title = title; }
  // Keep URLs valid for engines that return before print preview closes.
  setTimeout(() => Object.values(printUrls).forEach((url) => URL.revokeObjectURL(url)), 120000);
}
async function attach(slot) {
  if (busy) throw new Error('Wait for the current file operation.');
  const input = document.querySelector(`[data-file="${slot}"]`);
  const file = input instanceof HTMLInputElement ? input.files?.[0] : null;
  if (!file) throw new Error('Choose a file first.');
  busy = true; const at = epoch;
  try {
    const validated = await validateFile(slot, file, file.name);
    if (at !== epoch) throw new Error('Workbook changed. Attach this file again.');
    const next = { ...files, [slot]: validated }; checkTotal(next); files = next;
    refreshUrls(); save(); void persistFiles(); render(); notify('File attached locally. Download a backup to keep it.');
  } finally { busy = false; }
}
async function loadFile(file) {
  if (!file || busy) return;
  if (file.size > 96 * 1024 * 1024) throw new Error('File exceeds 96 MiB.');
  busy = true;
  let candidate;
  try { candidate = await parseFile(new Uint8Array(await file.arrayBuffer())); } finally { busy = false; }
  const f = candidate.record.fields;
  const members = [1, 2, 3].filter((n) => n === 1 || f[`group.student${n}Name`].trim() || f[`group.student${n}Id`].trim()).map((n) => `<p><strong>Student ${n}:</strong> ${[f[`group.student${n}Name`], f[`group.student${n}Id`]].filter((v) => v.trim()).map(esc).join(' · ') || '(not entered)'}</p>`).join('');
  openDialog('Review backup before replacing', `<p><strong>Group:</strong> ${esc(f['group.groupId'] || '(not entered)')}</p>${members}<p>${Object.keys(candidate.files).length} attached files · Updated ${esc(candidate.record.updatedAt)}</p><p>This replaces the current answers and attachments. Download the current group’s work first if you need to keep it.</p><div class="actions"><button data-action="export">Download current answers</button><button id="cancel-import">Keep current answers</button><button id="confirm-import" class="primary">Load these answers</button></div>`);
  $('#cancel-import').onclick = closeDialog;
  $('#confirm-import').onclick = async () => {
    epoch++; record = candidate.record; files = candidate.files; paused = false; recovery = null; fileProblem = '';
    // Give an imported copy its own attachment identity; never replace an older browser blob entry before save succeeds.
    record.recordId = crypto.randomUUID(); record.updatedAt = new Date().toISOString();
    $('#recover-button').hidden = true; refreshUrls(); save(); void persistFiles(); closeDialog(); render(true); notify('Backup loaded. Original downloaded files have not changed.');
  };
}
async function action(name) {
  if (name !== 'export') closeMenu();
  if (name === 'save') { save(); await persistFiles(); }
  if (name === 'export' || name === 'zip') await exportWork(name === 'zip');
  if (name === 'print') await printReport();
  if (name === 'import') { $('#import-file').value = ''; $('#import-file').click(); }
  if (name === 'recover' && recovery !== null) download('noise_main_lab_unreadable_record.txt', recovery, 'text/plain');
  if (name === 'new') {
    if (busy) throw new Error('Wait for the file operation to finish.');
    openDialog('Start a new workbook?', '<p>Download the current JSON or ZIP first to keep this group’s work. Starting new replaces the active answers and attachments; original computer files are not deleted.</p><div class="actions"><button data-action="export">Download current answers</button><button id="cancel-new">Keep current answers</button><button id="confirm-new">Start new workbook</button></div>');
    $('#cancel-new').onclick = closeDialog;
    $('#confirm-new').onclick = () => { epoch++; record = createRecord(); files = {}; recovery = null; paused = false; fileProblem = ''; $('#recover-button').hidden = true; refreshUrls(); save(); closeDialog(); render(true); };
  }
}
document.addEventListener('input', (event) => {
  const el = event.target;
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) || !el.dataset.field) return;
  try { updateField(record, el.dataset.field, el.value); el.setCustomValidity(''); save(); }
  catch (e) { notify(e.message); el.value = record.fields[el.dataset.field]; el.setCustomValidity(e.message); el.reportValidity(); }
});
document.addEventListener('beforeinput', (event) => {
  const el = event.target;
  if (el instanceof HTMLTextAreaElement && el.dataset.field?.startsWith('code.') && event instanceof InputEvent && event.data) {
    const next = el.value.slice(0, el.selectionStart) + event.data + el.value.slice(el.selectionEnd);
    if (new TextEncoder().encode(next).length > MAX_CODE) { event.preventDefault(); notify('Code exceeds 128 KiB. Keep a separate source backup.'); }
  }
});
document.addEventListener('click', async (event) => {
  const button = event.target instanceof Element ? event.target.closest('button') : null;
  if (!button) return;
  try {
    if (button.dataset.action) await action(button.dataset.action);
    if (button.dataset.step !== undefined) { record.current = Number(button.dataset.step); closeNavigation(); save(); render(true); }
    if (button.dataset.preserve) { preserve(record, button.dataset.preserve); save(); render(); notify('Copy saved. You can keep editing below; this saved copy will stay unchanged.'); }
    if (button.dataset.downloadCode) {
      const id = button.dataset.downloadCode, source = record.fields[`code.${id}`];
      if (!source.trim()) throw new Error('Paste your code or formulas first.');
      download(id === 'processing' ? 'MA_EMA_formulas_or_code.txt' : `${id}_current.ino`, source, 'text/plain;charset=utf-8');
    }
    if (button.dataset.upload) await attach(button.dataset.upload);
    if (button.dataset.remove) { if (busy) throw new Error('Wait for the file operation.'); delete files[button.dataset.remove]; refreshUrls(); save(); void persistFiles(); render(); }
    if (button.dataset.downloadFile) { const f = files[button.dataset.downloadFile]; if (f) download(f.filename, f.blob); }
  } catch (e) { notify(e.message); }
});
$('#previous').onclick = () => { record.current--; save(); render(true); };
$('#next').onclick = () => { record.current++; save(); render(true); };
$('#save-menu-button').onclick = () => { const open = $('#save-menu').hidden; $('#save-menu').hidden = !open; $('#save-menu-button').setAttribute('aria-expanded', String(open)); };
$('#menu-button').onclick = () => { closeMenu(); navOpen = true; syncNavigation(); $('#close-navigation').focus(); };
$('#close-navigation').onclick = () => closeNavigation(true);
$('#nav-shade').onclick = () => closeNavigation(true);
$('#dialog-close').onclick = closeDialog;
$('#import-file').onchange = () => { void loadFile($('#import-file').files?.[0]).catch((e) => notify(e.message)); };
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#dialog').open) { if (navOpen) closeNavigation(true); else if (!$('#save-menu').hidden) { closeMenu(); $('#save-menu-button').focus(); } }
  if (e.key === 'Tab' && navOpen && matchMedia('(max-width: 820px)').matches) {
    const buttons = [...$('#sidebar').querySelectorAll('button')], first = buttons[0], last = buttons.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  if (e.target instanceof HTMLElement && e.target.classList.contains('diagram-scroll') && ['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); e.target.scrollLeft += e.key === 'ArrowRight' ? 50 : -50; }
});
document.addEventListener('click', (e) => { if (e.target instanceof Element && !e.target.closest('#save-menu, #save-menu-button')) closeMenu(); });
$('#dialog').addEventListener('cancel', (e) => { e.preventDefault(); closeDialog(); });
window.addEventListener('resize', () => { if (!matchMedia('(max-width: 820px)').matches) navOpen = false; syncNavigation(); });
window.addEventListener('beforeunload', (e) => { if (busy || savingFiles || storageProblem || fileProblem || paused) e.preventDefault(); });
window.addEventListener('beforeprint', () => {
  if (!$('#report').querySelector('h1')) $('#report').innerHTML = report(record, files, urls);
});
// Keep native menu printing current without rerendering inputs or revoking media during print.
window.addEventListener('afterprint', () => { $('#report').innerHTML = ''; });
async function initialize() {
  try { const text = localStorage.getItem(STORAGE_KEY); if (text) { recovery = text; record = validateRecord(JSON.parse(text)); recovery = null; } }
  catch { paused = true; $('#recover-button').hidden = recovery === null; }
  busy = true;
  try {
    const restored = await store.read(record.recordId);
    for (const slot of record.fileSlots) {
      const f = restored[slot]; if (!f) throw new Error('Missing attachment.');
      files[slot] = await validateFile(slot, f.blob, f.originalName);
    }
    checkTotal(files);
  } catch { if (record.fileSlots.length) paused = true; fileProblem = 'Some attached files could not be opened from browser storage. Load a downloaded backup. Keep this tab open if you are adding new files.'; }
  busy = false; refreshUrls(); render(); $('#workbook').inert = false;
  if (paused) status('Automatic saving paused. Restore a backup or start new explicitly; existing saved data is protected.');
  else status(fileProblem || 'Ready. Answers save in this browser; keep downloaded backups.');
}
render(); syncNavigation(); $('#workbook').inert = true; void initialize();
