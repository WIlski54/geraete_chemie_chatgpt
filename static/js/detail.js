'use strict';

const token = window.TEACHER_TOKEN;
const studentId = window.STUDENT_ID;
let socket = null;

document.addEventListener('DOMContentLoaded', () => {
  if (typeof io === 'function') {
    socket = io();
    socket.on('connect', () => { socket.emit('lehrer_join'); socket.emit('watch_schueler', {schueler_id: studentId}); });
    socket.on('antwort_live', appendAnswer);
    socket.on('chat_live', appendChat);
  }
  document.getElementById('toggle-ai').addEventListener('click', toggleAi);
  document.getElementById('delete-student').addEventListener('click', deleteStudent);
});

function headers() { return {'Content-Type':'application/json','X-Teacher-Action-Token':token}; }
function appendAnswer(item) {
  document.getElementById('no-answers')?.remove();
  const article = document.createElement('article');
  article.className = `answer-log-item ${item.korrekt === true ? 'is-correct' : item.korrekt === false ? 'is-wrong' : ''}`;
  article.innerHTML = `<div><strong>Aufgabe ${escapeHtml(item.aufgabe_nr)}</strong><span>${escapeHtml(item.typ)} · Niveau ${escapeHtml(item.niveau)} · Versuch ${item.versuch_nr}</span></div><p>${escapeHtml(item.antwort)}</p><time>${escapeHtml(item.zeit)}</time>`;
  document.getElementById('answer-log').prepend(article);
}
function appendChat(item) {
  const container = document.getElementById('detail-chat');
  container.querySelector('.empty-state')?.remove();
  [
    {role:'user', label:'Frage', text:item.frage},
    {role:'assistant', label:'KI', text:item.antwort}
  ].forEach(entry => {
    const div = document.createElement('div');
    div.className = `chat-message ${entry.role}`;
    div.innerHTML = `<strong>${entry.label}</strong><p>${escapeHtml(entry.text)}</p><time>${escapeHtml(item.zeit)}</time>`;
    container.appendChild(div);
  });
}
async function toggleAi() {
  const response = await fetch(`/api/lehrer/student/${encodeURIComponent(studentId)}/toggle-ai`, {method:'POST',headers:headers()});
  const result = await response.json();
  showToast(result.blocked ? 'KI für dieses Pseudonym gesperrt.' : 'KI wieder freigegeben.');
}
async function deleteStudent() {
  if (!confirm('Alle Daten dieses Pseudonyms endgültig löschen?')) return;
  const response = await fetch(`/api/lehrer/student/${encodeURIComponent(studentId)}`, {method:'DELETE',headers:headers()});
  if (response.ok) window.location.href='/lehrer';
}
function showToast(message) { const toast=document.getElementById('toast'); toast.textContent=message; toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'),2500); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[char])); }
