'use strict';

const token = window.TEACHER_TOKEN;
let socket = null;
let toastTimer = null;
let iservConfigured = false;
let iservWorksheetName = 'dieses Arbeitsblatt';

document.addEventListener('DOMContentLoaded', () => {
  loadState();
  loadIservStatus();
  document.getElementById('refresh-dashboard').addEventListener('click', () => { loadState(); loadIservStatus(); });
  document.getElementById('snapshot-save').addEventListener('click', saveSnapshot);
  document.getElementById('iserv-test').addEventListener('click', testIservConnection);
  document.getElementById('iserv-save').addEventListener('click', saveIservBackup);
  document.getElementById('iserv-refresh').addEventListener('click', loadIservBackups);
  document.getElementById('reset-session').addEventListener('click', resetSession);
  if (typeof io === 'function') {
    socket = io();
    socket.on('connect', () => socket.emit('lehrer_join'));
    ['neuer_schueler','schueler_online','schueler_offline','fortschritt_update','autosave_update','neue_anfrage','session_reset','session_reloaded'].forEach(event => socket.on(event, loadState));
    socket.on('token_update', updateTokenDisplay);
  }
});

function headers() { return {'Content-Type': 'application/json', 'X-Teacher-Action-Token': token}; }

async function loadState() {
  const response = await fetch('/api/lehrer/state', {headers: {'X-Teacher-Action-Token': token}});
  if (!response.ok) return showToast('Dashboard konnte nicht geladen werden.', 'error');
  const state = await response.json();
  renderStudents(state.students || []);
  renderRequests(state.requests || []);
  renderSnapshots(state.snapshots || []);
  updateTokenDisplay({today: state.tokens, limit: state.limit});
  document.getElementById('kpi-students').textContent = state.students.filter(item => item.online).length;
  document.getElementById('kpi-requests').textContent = state.requests.length;
  document.getElementById('kpi-answers').textContent = state.students.reduce((sum, item) => sum + Number(item.answer_count || 0), 0);
}

function renderStudents(students) {
  const body = document.getElementById('student-table');
  body.replaceChildren();
  if (!students.length) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="8" class="empty-state">Noch niemand angemeldet.</td>';
    body.appendChild(row); return;
  }
  students.forEach(student => {
    const row = document.createElement('tr');
    const online = Boolean(student.online);
    row.innerHTML = `<td><span class="status-dot ${online ? 'online' : ''}"></span>${online ? 'online' : 'offline'}</td><td><strong>${escapeHtml(student.pseudonym)}</strong></td><td>${escapeHtml(student.klasse)}</td><td>${student.progress_count || 0} Stationen</td><td>${student.answer_count || 0}</td><td>${student.autosave_updated_at ? formatDate(student.autosave_updated_at) : '–'}</td><td>${formatDate(student.last_active)}</td><td><div class="row-actions"><a class="btn btn-outline" href="/lehrer/schueler/${encodeURIComponent(student.id)}">Details</a><button class="btn btn-danger-outline" data-delete-student="${student.id}">Löschen</button></div></td>`;
    body.appendChild(row);
  });
  body.querySelectorAll('[data-delete-student]').forEach(button => button.addEventListener('click', () => deleteStudent(button.dataset.deleteStudent)));
}

function renderRequests(requests) {
  const list = document.getElementById('request-list');
  list.replaceChildren();
  document.getElementById('request-count').textContent = requests.length;
  if (!requests.length) { list.innerHTML = '<p class="empty-state">Keine offenen Anfragen.</p>'; return; }
  requests.forEach(item => {
    const article = document.createElement('article');
    article.className = 'request-item';
    article.innerHTML = `<div><strong>${escapeHtml(item.pseudonym || '?')} · ${escapeHtml(item.typ)}</strong><small>${escapeHtml(item.kontext || '')}</small></div><div class="request-actions"><button class="btn btn-primary" data-decision="freigegeben">Freigeben</button><button class="btn btn-danger-outline" data-decision="abgelehnt">Ablehnen</button></div>`;
    article.querySelectorAll('[data-decision]').forEach(button => button.addEventListener('click', () => decideRequest(item.id, button.dataset.decision)));
    list.appendChild(article);
  });
}

function renderSnapshots(snapshots) {
  const list = document.getElementById('snapshot-list');
  list.replaceChildren();
  if (!snapshots.length) { list.innerHTML = '<p class="empty-state">Noch keine gespeicherte Sitzung.</p>'; return; }
  snapshots.forEach(item => {
    const article = document.createElement('article');
    article.className = 'snapshot-item';
    article.innerHTML = `<div><strong>${escapeHtml(item.name)}</strong><small>${formatDate(item.updated_at)}</small></div><div class="request-actions"><button class="btn btn-outline" data-load>Laden</button><button class="btn btn-danger-outline" data-delete>Löschen</button></div>`;
    article.querySelector('[data-load]').addEventListener('click', () => loadSnapshot(item.id));
    article.querySelector('[data-delete]').addEventListener('click', () => deleteSnapshot(item.id));
    list.appendChild(article);
  });
}

async function responseJson(response) {
  try { return await response.json(); }
  catch (_) { return {ok: false, error: `Serverantwort nicht lesbar (HTTP ${response.status}).`}; }
}

function setIservControls(enabled) {
  ['iserv-test', 'iserv-save', 'iserv-refresh'].forEach(id => {
    document.getElementById(id).disabled = !enabled;
  });
}

function setIservStatus(kind, label) {
  const badge = document.getElementById('iserv-status');
  badge.className = `iserv-status-badge is-${kind}`;
  badge.textContent = label;
}

function setIservNote(message, type = 'info') {
  const note = document.getElementById('iserv-config-note');
  note.className = `iserv-config-note is-${type}`;
  note.textContent = message;
}

async function loadIservStatus() {
  setIservStatus('checking', 'Konfiguration wird geprüft …');
  const response = await fetch('/api/lehrer/iserv/status', {headers: {'X-Teacher-Action-Token': token}});
  const data = await responseJson(response);
  if (!response.ok || !data.ok) {
    iservConfigured = false;
    setIservControls(false);
    setIservStatus('error', 'Status nicht verfügbar');
    setIservNote(data.error || 'Der IServ-Status konnte nicht geladen werden.', 'error');
    return;
  }
  iservConfigured = Boolean(data.configured);
  setIservControls(iservConfigured);
  if (!iservConfigured) {
    setIservStatus('off', 'Nicht konfiguriert');
    const missing = (data.missing || []).join(', ');
    setIservNote(data.error || `Noch fehlend: ${missing || 'IServ-Konfiguration'}.`, 'warning');
    return;
  }
  setIservStatus('ready', 'Konfiguriert');
  setIservNote(`Ziel: ${data.endpoint || 'IServ'} · ${data.path || 'Backup-Ordner'} · ${data.encryption}`, 'ok');
  loadIservBackups();
}

async function testIservConnection() {
  if (!iservConfigured) return;
  const button = document.getElementById('iserv-test');
  button.disabled = true;
  setIservStatus('checking', 'Verbindung wird geprüft …');
  const response = await fetch('/api/lehrer/iserv/test', {method: 'POST', headers: headers()});
  const data = await responseJson(response);
  button.disabled = false;
  if (!response.ok || !data.ok) {
    setIservStatus('error', 'Verbindung fehlgeschlagen');
    setIservNote(data.error || 'IServ ist nicht erreichbar.', 'error');
    return showToast(data.error || 'IServ-Verbindung fehlgeschlagen.', 'error');
  }
  setIservStatus('online', 'Verbunden');
  setIservNote(`Verbindung zu ${data.endpoint || 'IServ'} erfolgreich. Zielordner: ${data.path}`, 'ok');
  showToast('IServ-Verbindung erfolgreich geprüft.');
  loadIservBackups();
}

async function saveIservBackup() {
  if (!iservConfigured) return;
  const input = document.getElementById('iserv-backup-name');
  const name = input.value.trim() || `Laborgeräte ${new Date().toLocaleDateString('de-DE')}`;
  if (!confirm(`Unterricht „${name}“ jetzt abschließen?\n\nDie App fordert erreichbare Schülergeräte zu einem letzten Autosave auf, verschlüsselt die Sitzung und prüft die Datei durch erneutes Laden von IServ. Erst nach erfolgreicher Prüfung werden die temporären Schülerdaten auf diesem App-Server gelöscht.`)) return;
  const button = document.getElementById('iserv-save');
  button.disabled = true;
  button.textContent = 'Autosave, Upload und Prüfung …';
  const response = await fetch('/api/lehrer/iserv/backups', {method: 'POST', headers: headers(), body: JSON.stringify({name})});
  const data = await responseJson(response);
  button.disabled = false;
  button.textContent = 'Auf IServ archivieren & Serverdaten löschen';
  if (!response.ok || !data.ok) {
    const kept = data.server_data_kept ? ' Die temporären Serverdaten wurden sicherheitshalber nicht gelöscht.' : '';
    setIservNote(`${data.error || 'IServ-Sicherung fehlgeschlagen.'}${kept}`, 'error');
    showToast(`${data.error || 'IServ-Sicherung fehlgeschlagen.'}${kept}`, 'error');
    loadState();
    return;
  }
  input.value = '';
  setIservStatus('online', 'Zuletzt erfolgreich');
  const flush = data.flush || {};
  const deviceNote = flush.online ? ` Letzter Autosave: ${flush.confirmed || 0} von ${flush.online} erreichbaren Geräten bestätigt.` : '';
  setIservNote(`„${data.backup.name}“ wurde verschlüsselt gespeichert und erfolgreich zurückgeprüft. Die temporären Serverdaten wurden gelöscht.${deviceNote}`, 'ok');
  showToast('IServ-Archiv geprüft; temporäre Serverdaten gelöscht.');
  loadState();
  loadIservBackups();
}

async function loadIservBackups() {
  if (!iservConfigured) return;
  const list = document.getElementById('iserv-backup-list');
  list.innerHTML = '<p class="empty-state">IServ-Sicherungen werden geladen …</p>';
  const response = await fetch('/api/lehrer/iserv/backups', {headers: {'X-Teacher-Action-Token': token}});
  const data = await responseJson(response);
  if (!response.ok || !data.ok) {
    list.innerHTML = `<p class="empty-state error-text">${escapeHtml(data.error || 'Sicherungen konnten nicht geladen werden.')}</p>`;
    setIservStatus('error', 'Verbindung prüfen');
    return;
  }
  iservWorksheetName = data.worksheet || iservWorksheetName;
  renderIservBackups(data.backups || []);
  const count = (data.backups || []).length;
  setIservNote(`${count} ${count === 1 ? 'Sicherung' : 'Sicherungen'} für „${iservWorksheetName}“ gefunden. Andere Arbeitsblätter werden ausgeblendet.`, 'ok');
}

function renderIservBackups(backups) {
  const list = document.getElementById('iserv-backup-list');
  list.replaceChildren();
  if (!backups.length) {
    list.innerHTML = `<p class="empty-state">Im Zielordner befinden sich noch keine Sicherungen für „${escapeHtml(iservWorksheetName)}“.</p>`;
    return;
  }
  backups.forEach(item => {
    const article = document.createElement('article');
    article.className = 'iserv-backup-item';
    const displayDate = item.created_at ? formatDate(item.created_at) : (formatBackupFilename(item.filename) || formatDate(item.modified));
    const backupName = item.name || 'Sicherung ohne Bezeichnung';
    article.innerHTML = `<div><strong>${escapeHtml(backupName)}</strong><small>${escapeHtml(iservWorksheetName)} · ${escapeHtml(displayDate)} · ${escapeHtml(formatBytes(item.size))}</small><code>${escapeHtml(item.filename)}</code></div><button class="btn btn-outline" type="button">Prüfen &amp; laden</button>`;
    article.querySelector('button').addEventListener('click', () => previewAndLoadIservBackup(item.filename));
    list.appendChild(article);
  });
}

async function previewAndLoadIservBackup(filename) {
  setIservNote('Sicherung wird heruntergeladen, entschlüsselt und geprüft …', 'info');
  const previewResponse = await fetch(`/api/lehrer/iserv/backups/${encodeURIComponent(filename)}/preview`, {headers: {'X-Teacher-Action-Token': token}});
  const preview = await responseJson(previewResponse);
  if (!previewResponse.ok || !preview.ok) {
    setIservNote(preview.error || 'Die Sicherung konnte nicht geprüft werden.', 'error');
    return showToast(preview.error || 'IServ-Sicherung ungültig.', 'error');
  }
  const summary = preview.summary || {};
  const details = `„${preview.name}“\n${formatDate(preview.created_at)}\n${summary.students || 0} Lernende · ${summary.answers || 0} Antworten · ${summary.progress || 0} Fortschrittseinträge · ${summary.drawings || 0} Zeichnungen`;
  if (!confirm(`${details}\n\nDiese Sitzung als temporäre Live-Sitzung laden? Eine derzeit offene Live-Sitzung wird dabei ersetzt. Sie wird nicht zusätzlich auf diesem Server kopiert.`)) {
    setIservNote('Sicherung erfolgreich geprüft; Laden wurde abgebrochen.', 'ok');
    return;
  }
  const loadResponse = await fetch(`/api/lehrer/iserv/backups/${encodeURIComponent(filename)}/load`, {method: 'POST', headers: headers()});
  const result = await responseJson(loadResponse);
  if (!loadResponse.ok || !result.ok) {
    setIservNote(result.error || 'Die Sitzung konnte nicht geladen werden.', 'error');
    return showToast(result.error || 'IServ-Sitzung konnte nicht geladen werden.', 'error');
  }
  setIservNote(`„${result.name}“ wurde als temporäre Live-Sitzung geladen. Nach der Einsicht kannst du sie erneut geprüft auf IServ archivieren und vom App-Server entfernen.`, 'ok');
  showToast('IServ-Sitzung geladen.');
  loadState();
}

async function decideRequest(id, decision) {
  await fetch('/api/ki-entscheidung', {method: 'POST', headers: headers(), body: JSON.stringify({anfrage_id: id, entscheid: decision})});
  showToast(decision === 'freigegeben' ? 'KI-Funktion freigegeben.' : 'Anfrage abgelehnt.');
  loadState();
}

async function saveSnapshot() {
  const input = document.getElementById('snapshot-name');
  const name = input.value.trim() || `Laborgeräte ${new Date().toLocaleDateString('de-DE')}`;
  const response = await fetch('/api/lehrer/snapshots', {method: 'POST', headers: headers(), body: JSON.stringify({name})});
  if (response.ok) { input.value = ''; showToast('Unterrichtssitzung gespeichert.'); loadState(); }
}

async function loadSnapshot(id) {
  if (!confirm('Diese Sitzung laden? Die aktuelle Live-Sitzung wird ersetzt.')) return;
  const response = await fetch(`/api/lehrer/snapshots/${encodeURIComponent(id)}/load`, {method: 'POST', headers: headers()});
  showToast(response.ok ? 'Sitzung geladen.' : 'Sitzung konnte nicht geladen werden.', response.ok ? 'ok' : 'error');
  loadState();
}

async function deleteSnapshot(id) {
  if (!confirm('Gespeicherte Sitzung endgültig löschen?')) return;
  await fetch(`/api/lehrer/snapshots/${encodeURIComponent(id)}`, {method: 'DELETE', headers: headers()});
  showToast('Gespeicherte Sitzung gelöscht.'); loadState();
}

async function deleteStudent(id) {
  if (!confirm('Alle Unterrichtsdaten dieses Pseudonyms löschen?')) return;
  await fetch(`/api/lehrer/student/${encodeURIComponent(id)}`, {method: 'DELETE', headers: headers()});
  showToast('Pseudonym und Unterrichtsdaten gelöscht.'); loadState();
}

async function resetSession() {
  if (!confirm('Alle aktuellen Lernenden, Antworten, Fortschritte und KI-Chats löschen? Gespeicherte Sitzungen bleiben erhalten.')) return;
  await fetch('/api/lehrer/reset', {method: 'POST', headers: headers()});
  showToast('Aktuelle Klassenaktivität gelöscht.'); loadState();
}

function updateTokenDisplay(data) {
  const today = Number(data.today || 0), limit = Number(data.limit || window.DAILY_LIMIT || 1);
  document.getElementById('kpi-tokens').textContent = today.toLocaleString('de-DE');
  document.getElementById('budget-label').textContent = `${today.toLocaleString('de-DE')} / ${limit.toLocaleString('de-DE')}`;
  const fill = document.getElementById('budget-fill');
  const percent = Math.min(100, today / limit * 100);
  fill.style.width = `${percent}%`;
  fill.style.background = percent > 90 ? '#c62f3b' : percent > 70 ? '#F7B800' : 'linear-gradient(90deg,#006AB3,#AD007C)';
}

function formatDate(value) { if (!value) return '–'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString('de-DE', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}); }
function formatBackupFilename(value) { const match = String(value || '').match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z_/); if (!match) return ''; const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6]))); return date.toLocaleString('de-DE', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
function formatBytes(value) { const bytes = Number(value || 0); if (!bytes) return 'Größe unbekannt'; if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`; return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[char])); }
function showToast(message, type = 'ok') { const toast = document.getElementById('toast'); toast.textContent = message; toast.style.background = type === 'error' ? '#c62f3b' : '#168548'; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2600); }
