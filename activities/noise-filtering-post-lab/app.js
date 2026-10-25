import './styles.css';
import { createRecord, validateRecord, updateField, withSource, filename, SCREENS, STORAGE_KEY, missingWork } from './model.js';
import { parseSource, validateSources, parseBackup, createBackup, createZip, fileStore, LIMITS, base64 } from './files.js';
import { screen, report, esc, sourceIssues, checklist } from './views.js';

/** @returns {any} */
const $ = selector => document.querySelector(selector);
let record = createRecord(), sources = {}, parsed = { main: null, prelab: null }, urls = {};
let busy = false, paused = false, recovery = null, sourceKind = 'main', navOpen = false, dialogFocus;
let saveTimer, toastTimer, pending = Promise.resolve(), saving = 0, storageProblem = '';
const store = fileStore();
function status(message) { $('#save-status').textContent = message; $('#save-detail').textContent = message; }
function notify(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 12000); }
function download(name, content, type = 'application/json') {
  const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function save(immediate = false) {
  clearTimeout(saveTimer); saveTimer = null;
  if (paused) { status('Saved work could not be opened. Download recovery files, then restore a backup or start a new workbook.'); return pending; }
  if (!immediate) { saveTimer = setTimeout(() => save(true), 400); status(storageProblem || 'Saving your individual work…'); return pending; }
  // One transaction stores answers and source Blobs together; partial saves cannot mix workbooks.
  const snapshot = { record: validateRecord(record), sources: { ...sources } };
  saving++;
  pending = pending.then(async () => {
    try { await store.write(STORAGE_KEY, snapshot); storageProblem = ''; status('Individual work saved in this browser. Keep a downloaded backup.'); }
    catch { storageProblem = 'Browser saving failed. Keep this tab open and download JSON or ZIP now.'; status(storageProblem); notify(storageProblem); }
    finally { saving--; }
  });
  return pending;
}
function refreshUrls() {
  Object.values(urls).forEach(url => URL.revokeObjectURL(url));
  urls = Object.fromEntries(Object.entries(parsed.main?.files || {}).map(([slot, file]) => [slot, URL.createObjectURL(file.blob)]));
}
function syncNavigation() {
  const mobile = matchMedia('(max-width: 820px)').matches, sidebar = $('#sidebar');
  sidebar.classList.toggle('open', mobile && navOpen); sidebar.inert = mobile && !navOpen;
  $('.frame').inert = mobile && navOpen; $('#nav-shade').hidden = !mobile || !navOpen;
  $('#menu-button').setAttribute('aria-expanded', String(mobile && navOpen));
  if (mobile && navOpen) { sidebar.setAttribute('role', 'dialog'); sidebar.setAttribute('aria-modal', 'true'); }
  else { sidebar.removeAttribute('role'); sidebar.removeAttribute('aria-modal'); }
}
function closeNavigation(restore = false) { navOpen = false; syncNavigation(); if (restore) $('#menu-button').focus(); }
function closeMenu() { $('#save-menu').hidden = true; $('#save-menu-button').setAttribute('aria-expanded', 'false'); }
function render(focus = false) {
  $('#steps').innerHTML = SCREENS.map((title, i) => `<button class="step${i === record.current ? ' active' : ''}" data-step="${i}" ${i === record.current ? 'aria-current="step"' : ''}><span class="step-number">${i + 1}</span><strong>${title}</strong></button>`).join('');
  $('#main').innerHTML = screen(record, record.current, parsed, urls);
  $('#breadcrumb').textContent = SCREENS[record.current]; $('#screen-count').textContent = `${record.current + 1} / ${SCREENS.length}`;
  $('#progress-bar').style.width = `${(record.current + 1) * 100 / SCREENS.length}%`;
  $('#previous').disabled = record.current === 0; $('#next').disabled = record.current === SCREENS.length - 1;
  if (focus) { $('#main').focus(); window.scrollTo(0, 0); }
}
function openDialog(title, body) { dialogFocus = document.activeElement; $('#dialog-title').textContent = title; $('#dialog-body').innerHTML = body; $('#dialog').showModal(); }
function closeDialog() { $('#dialog').close(); if (dialogFocus instanceof HTMLElement && dialogFocus.isConnected) dialogFocus.focus(); }
function error(message) { notify(message); }
async function loadSource(file) {
  if (!file || busy) return;
  const kind = sourceKind;
  if (file.size > LIMITS[kind]) throw new Error(`${kind === 'main' ? 'Group ZIP exceeds 96 MiB.' : 'Pre-lab ZIP exceeds 2 MiB.'}`);
  busy = true;
  let candidate;
  try { candidate = await parseSource(kind, new Uint8Array(await file.arrayBuffer())); } finally { busy = false; }
  const summary = kind === 'main' ? `Group: ${candidate.record.fields['group.groupId'] || 'Not entered'}. ${[1, 2, 3].map(n => candidate.record.fields[`group.student${n}Name`]).filter(Boolean).join(', ')}` : `Student: ${candidate.student.name || 'Not entered'} · ${candidate.student.id || 'No ID'} · ${candidate.status}`;
  const preview = { ...parsed, [kind]: candidate }, missing = sourceIssues(preview);
  openDialog('Review source ZIP', `<p><strong>${esc(file.name)}</strong></p><p>${esc(summary)}</p><p>${missing.length} imported items need review. You can continue with missing work.</p><p>${record.sources[kind] ? 'This replaces that source file, keeps your individual writing, and marks your answers for review.' : 'This adds a read-only copy. The original workbook stays unchanged.'}</p><div class="actions"><button id="cancel-source">Cancel</button><button id="confirm-source" class="primary">Use this ZIP</button></div>`);
  $('#cancel-source').onclick = closeDialog;
  $('#confirm-source').onclick = () => {
    record = withSource(record, kind, candidate, file.name); sources = { ...sources, [kind]: { name: file.name, blob: file.slice(0, file.size, 'application/zip') } }; parsed = preview;
    refreshUrls(); closeDialog(); render(); void save(true); notify('Source ZIP loaded. Your individual answers are separate.');
  };
}
async function restore(file) {
  if (!file || busy) return;
  if (file.size > 256 * 1024 * 1024) throw new Error('Post-lab backup exceeds 256 MiB.');
  busy = true; let candidate;
  try { candidate = await parseBackup(new Uint8Array(await file.arrayBuffer())); } finally { busy = false; }
  openDialog('Review post-lab backup', `<p><strong>${esc(file.name)}</strong></p><p>Student: ${esc(candidate.record.fields.name || 'Not entered')}</p><p>${Object.keys(candidate.sources).length} source ZIPs · ${esc(candidate.record.updatedAt)}</p><p>This replaces your current individual answers and source files. Download your current work first if you need it.</p><div class="actions"><button data-action="zip">Download current ZIP</button><button id="cancel-import">Keep current work</button><button id="confirm-import" class="primary">Load this backup</button></div>`);
  $('#cancel-import').onclick = closeDialog;
  $('#confirm-import').onclick = () => {
    clearTimeout(saveTimer); record = candidate.record; sources = candidate.sources; parsed = candidate.parsed;
    record.recordId = crypto.randomUUID(); record.updatedAt = new Date().toISOString(); paused = false; recovery = null;
    $('#recover-button').hidden = true; refreshUrls(); closeDialog(); render(true); void save(true); notify('Individual backup restored.');
  };
}
async function printReport() {
  $('#report').innerHTML = report(record, parsed, urls);
  await Promise.all([...document.querySelectorAll('#report img')].map(img => img instanceof HTMLImageElement ? img.decode() : Promise.resolve()));
  const title = document.title; document.title = filename(record);
  try { window.print(); } finally { document.title = title; }
}
async function action(name) {
  if (busy) throw new Error('Wait for the file to finish opening.');
  closeMenu();
  if (name === 'save') await save(true);
  if (name === 'zip' || name === 'export') {
    const snapshot = validateRecord(record), sourceCopy = { ...sources };
    download(`${filename(snapshot)}.${name === 'zip' ? 'zip' : 'json'}`, name === 'zip' ? await createZip(snapshot, sourceCopy) : JSON.stringify(await createBackup(snapshot, sourceCopy)), name === 'zip' ? 'application/zip' : 'application/json');
  }
  if (name === 'import') { $('#import-file').value = ''; $('#import-file').click(); }
  if (name === 'print') await printReport();
  if (name === 'recover' && recovery) {
    const output = { record: recovery.record, sources: {} };
    for (const [kind, source] of Object.entries(recovery.sources || {})) if (source.blob instanceof Blob) output.sources[kind] = { name: source.name, data: base64(new Uint8Array(await source.blob.arrayBuffer())) };
    download('noise_post_lab_recovery.json', JSON.stringify(output));
  }
  if (name === 'new') {
    openDialog('Start a new individual workbook?', '<p>Download your JSON or ZIP first to keep the current work. Starting new replaces this browser’s active post-lab only.</p><div class="actions"><button data-action="zip">Download current ZIP</button><button id="cancel-new">Keep current work</button><button id="confirm-new">Start new workbook</button></div>');
    $('#cancel-new').onclick = closeDialog;
    $('#confirm-new').onclick = () => {
      clearTimeout(saveTimer); record = createRecord(); sources = {}; parsed = { main: null, prelab: null }; paused = false; recovery = null;
      $('#recover-button').hidden = true; refreshUrls(); closeDialog(); render(true); void save(true);
    };
  }
}
document.addEventListener('input', event => {
  const el = event.target;
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) || !el.dataset.field) return;
  try {
    updateField(record, el.dataset.field, el.value);
    if ($('#identity-confirm')) { $('#identity-confirm').checked = record.identityConfirmed; $('#identity-confirm').disabled = !parsed.main || !parsed.prelab || !record.fields.name.trim(); }
    if ($('#work-checklist')) $('#work-checklist').innerHTML = checklist([...missingWork(record), ...sourceIssues(parsed)]);
    void save();
  } catch (e) { error(e.message); el.value = record.fields[el.dataset.field]; }
});
document.addEventListener('change', event => {
  const el = event.target;
  if (!(el instanceof HTMLInputElement)) return;
  if (el.id === 'identity-confirm') { record.identityConfirmed = el.checked; record.updatedAt = new Date().toISOString(); void save(); }
  if (el.id === 'review-confirm' && el.checked) {
    record.needsReview = false; record.updatedAt = new Date().toISOString(); void save();
    $('#main .review-notice')?.remove();
    $('#work-checklist').innerHTML = checklist([...missingWork(record), ...sourceIssues(parsed)]);
    notify('Your review is recorded.');
  }
});
document.addEventListener('click', async event => {
  const button = event.target instanceof Element ? event.target.closest('button') : null;
  if (!button) return;
  try {
    if (button.dataset.action) await action(button.dataset.action);
    if (button.dataset.step !== undefined) { record.current = Number(button.dataset.step); closeNavigation(); render(true); void save(); }
    if (button.dataset.source) { if (busy) throw new Error('Wait for the file to finish opening.'); sourceKind = button.dataset.source; $('#source-file').value = ''; $('#source-file').click(); }
    if (button.dataset.original) { const source = sources[button.dataset.original]; if (source) download(source.name, source.blob); }
  } catch (e) { error(e.message); }
});
$('#previous').onclick = () => { record.current--; render(true); void save(); };
$('#next').onclick = () => { record.current++; render(true); void save(); };
$('#save-menu-button').onclick = () => { const open = $('#save-menu').hidden; $('#save-menu').hidden = !open; $('#save-menu-button').setAttribute('aria-expanded', String(open)); };
$('#menu-button').onclick = () => { closeMenu(); navOpen = true; syncNavigation(); $('#close-navigation').focus(); };
$('#close-navigation').onclick = () => closeNavigation(true); $('#nav-shade').onclick = () => closeNavigation(true);
$('#dialog-close').onclick = closeDialog;
$('#dialog').addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
$('#import-file').onchange = () => { void restore($('#import-file').files?.[0]).catch(e => error(e.message)); };
$('#source-file').onchange = () => { void loadSource($('#source-file').files?.[0]).catch(e => error(e.message)); };
document.addEventListener('click', e => { if (e.target instanceof Element && !e.target.closest('#save-menu, #save-menu-button')) closeMenu(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#dialog').open) { if (navOpen) closeNavigation(true); else { closeMenu(); $('#save-menu-button').focus(); } }
  if (e.key === 'Tab' && navOpen && matchMedia('(max-width: 820px)').matches) {
    const buttons = [...$('#sidebar').querySelectorAll('button')], first = buttons[0], last = buttons.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
window.addEventListener('resize', () => { if (!matchMedia('(max-width: 820px)').matches) navOpen = false; syncNavigation(); });
window.addEventListener('beforeunload', e => { if (saveTimer || saving || storageProblem || busy || paused) e.preventDefault(); });
window.addEventListener('beforeprint', () => { $('#report').innerHTML = report(record, parsed, urls); });
async function start() {
  $('#workbook').inert = true; status('Opening your individual workbook…');
  let saved;
  try {
    saved = await store.read(STORAGE_KEY);
    if (saved?.record) { const restored = validateRecord(saved.record), restoredSources = saved.sources; const data = await validateSources(restored, restoredSources); record = restored; sources = restoredSources; parsed = data; }
    else if (Object.keys(saved || {}).length) throw new Error('Unrecognized saved workbook.');
    status('Ready. Your individual work saves in this browser; keep downloaded backups.');
  } catch {
    if (saved && Object.keys(saved).length) { paused = true; recovery = saved; $('#recover-button').hidden = false; status('Saved work could not be opened. Download recovery files before restoring a backup or starting new.'); }
    else { storageProblem = 'Browser storage is unavailable. You can work in this tab; download JSON or ZIP before leaving.'; status(storageProblem); }
  }
  refreshUrls(); render(); $('#workbook').inert = false; syncNavigation();
}
void start();
