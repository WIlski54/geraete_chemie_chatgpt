/* Lehrer-Dashboard – Live-Übersicht über Socket.IO */
(() => {
  "use strict";
  const DASH = window.DASH || {};
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const students = {};
  const requests = {};
  let gesperrt = new Set();

  function toast(text, color) {
    const t = $("#toast"); t.textContent = text; t.style.background = color || "#16a34a"; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 3000);
  }
  async function post(url, payload) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload || {}) });
    if (res.status === 401) { location.href = "/lehrer/login"; return {}; }
    return res.json().catch(() => ({}));
  }

  // ── Budget & KPIs ──
  function renderBudget(d) {
    const pct = Math.min(100, Math.round((d.today / d.limit) * 100));
    $("#budget-label").textContent = `${d.today} / ${d.limit} Tokens (${pct} %)`;
    const fill = $("#budget-fill"); fill.style.width = pct + "%";
    fill.className = pct >= 90 ? "budget-fill-danger" : pct >= 60 ? "budget-fill-warn" : "budget-fill-ok";
    $("#kpi-tokens").textContent = d.today;
  }
  function renderKpis() {
    const list = Object.values(students);
    $("#kpi-students").textContent = list.length;
    $("#kpi-online").textContent = list.filter(s => s.online).length;
    $("#kpi-answers").textContent = list.reduce((a, s) => a + (s.antworten || 0), 0);
    const n = Object.keys(requests).length;
    $("#kpi-requests").textContent = n; $("#request-count").textContent = n;
  }

  // ── Schüler-Tabelle ──
  function rowHTML(s) {
    const pct = Math.round((s.aufgaben_erledigt / s.aufgaben_gesamt) * 100);
    const chips = Object.values(s.abschnitte || {}).map(a => `<span class="abschnitt-chip${a.erledigt === a.gesamt ? " is-complete" : a.erledigt ? " is-started" : ""}" title="${esc(a.titel)}">${esc(a.kurz)} ${a.erledigt}/${a.gesamt}</span>`).join("");
    const locked = gesperrt.has(s.id);
    return `
      <td><span class="dot${s.online ? " online" : ""}" title="${s.online ? "online" : "offline"}"></span></td>
      <td><strong>${esc(s.pseudonym)}</strong></td>
      <td>${esc(s.klasse)}</td>
      <td><div class="mini-progress"><div class="progress-track"><span style="width:${pct}%"></span></div><span>${s.aufgaben_erledigt}/${s.aufgaben_gesamt}</span></div></td>
      <td><div class="abschnitt-chips">${chips}</div></td>
      <td>${s.antworten || 0}</td>
      <td>${s.notizen || 0}/6</td>
      <td><span class="pill ${locked ? "pill-locked" : "pill-open"}">${locked ? "gesperrt" : "frei"}</span>${s.pending ? ` <span class="pill pill-locked">${s.pending} offen</span>` : ""}</td>
      <td>${esc((s.last_active || "").slice(11, 16))}</td>
      <td><div class="row-actions">
        <a class="btn btn-outline btn-sm" href="/lehrer/schueler/${s.id}">Detail</a>
        <button class="btn btn-quiet btn-sm" data-lock="${s.id}" type="button">${locked ? "KI freigeben" : "KI sperren"}</button>
        <button class="btn btn-danger-outline btn-sm" data-delete="${s.id}" type="button">Löschen</button>
      </div></td>`;
  }
  function upsertStudent(s) {
    if (!s || !s.id) return;
    students[s.id] = Object.assign(students[s.id] || {}, s);
    const tbody = $("#student-table");
    const empty = $("#no-students"); if (empty) empty.remove();
    let tr = tbody.querySelector(`tr[data-id="${s.id}"]`);
    if (!tr) { tr = document.createElement("tr"); tr.dataset.id = s.id; tbody.prepend(tr); }
    tr.innerHTML = rowHTML(students[s.id]);
    renderKpis();
  }
  function removeStudent(id) {
    delete students[id];
    const tr = $(`#student-table tr[data-id="${id}"]`); if (tr) tr.remove();
    if (!Object.keys(students).length) $("#student-table").innerHTML = '<tr id="no-students"><td colspan="10" class="empty-state">Noch niemand angemeldet.</td></tr>';
    renderKpis();
  }

  // ── Anfragen ──
  function requestHTML(a, isNew) {
    return `<div class="request-item${isNew ? " is-new" : ""}" data-id="${a.id}">
      <span class="request-typ">${a.typ === "chat" ? "Tutor" : "Feedback"}</span>
      <div class="who"><strong>${esc(a.pseudonym)}</strong><small>Klasse ${esc(a.klasse)} · ${esc(a.kontext || "")} · ${esc((a.erstellt_at || "").slice(11, 16))}</small></div>
      <button class="btn btn-primary btn-sm" data-decide="freigegeben" data-id="${a.id}" type="button">✅ Freigeben</button>
      <button class="btn btn-danger-outline btn-sm" data-decide="abgelehnt" data-id="${a.id}" type="button">✕</button>
    </div>`;
  }
  function renderRequests(list, isNew) {
    const host = $("#request-list");
    if (list) { Object.keys(requests).forEach(k => delete requests[k]); list.forEach(a => { requests[a.id] = a; }); host.innerHTML = ""; }
    const ids = Object.keys(requests);
    if (!ids.length) { host.innerHTML = '<p class="empty-state" id="no-requests">Keine offenen Anfragen.</p>'; renderKpis(); return; }
    const empty = $("#no-requests"); if (empty) empty.remove();
    ids.forEach(id => { if (!host.querySelector(`[data-id="${id}"]`)) host.insertAdjacentHTML("beforeend", requestHTML(requests[id], isNew)); });
    renderKpis();
  }
  function addRequest(a) {
    requests[a.id] = a; renderRequests(null, true);
    if (students[a.schueler_id]) { students[a.schueler_id].pending = (students[a.schueler_id].pending || 0) + 1; upsertStudent(students[a.schueler_id]); }
    toast(`🤖 ${a.pseudonym} fragt ${a.typ === "chat" ? "den KI-Tutor" : "KI-Feedback"} an`, "#AD007C");
  }
  function removeRequest(id, sid) {
    delete requests[id];
    const el = $(`#request-list [data-id="${id}"]`); if (el) el.remove();
    if (sid && students[sid] && students[sid].pending) { students[sid].pending--; upsertStudent(students[sid]); }
    renderRequests(null);
  }

  // ── Aktionen ──
  document.addEventListener("click", async e => {
    const decide = e.target.closest("[data-decide]");
    if (decide) {
      decide.disabled = true;
      const r = await post("/api/ki-entscheidung", { anfrage_id: parseInt(decide.dataset.id, 10), entscheid: decide.dataset.decide });
      if (r.ok) { const a = requests[decide.dataset.id]; removeRequest(decide.dataset.id, a && a.schueler_id); toast(decide.dataset.decide === "freigegeben" ? "✅ Freigegeben" : "Abgelehnt", decide.dataset.decide === "freigegeben" ? "#16a34a" : "#dc2626"); }
      else decide.disabled = false;
      return;
    }
    const lock = e.target.closest("[data-lock]");
    if (lock) {
      const sid = lock.dataset.lock;
      const r = await post("/api/lehrer/ki-sperren", { schueler_id: sid, aktion: gesperrt.has(sid) ? "freigeben" : "sperren" });
      if (r.ok) { if (r.gesperrt) gesperrt.add(sid); else gesperrt.delete(sid); upsertStudent(students[sid]); }
      return;
    }
    const del = e.target.closest("[data-delete]");
    if (del) {
      const s = students[del.dataset.delete];
      if (!confirm(`Alle Daten von „${s ? s.pseudonym : "?"}“ endgültig löschen?`)) return;
      const r = await post("/api/lehrer/daten-loeschen", { schueler_id: del.dataset.delete });
      if (r.ok) { removeStudent(del.dataset.delete); toast("🗑️ Daten gelöscht", "#64748b"); }
      return;
    }
    if (e.target.id === "reset-session") {
      if (!confirm("Wirklich alle Schüler:innen, Antworten, Notizen und Anfragen dieser Sitzung löschen?")) return;
      const r = await post("/api/lehrer/sitzung-zuruecksetzen");
      if (r.ok) { Object.keys(students).forEach(removeStudent); renderRequests([]); toast("Sitzung zurückgesetzt", "#64748b"); }
    }
    if (e.target.id === "refresh-dashboard") loadState();
  });

  async function loadState() {
    const res = await fetch("/api/lehrer/state"); if (res.status === 401) { location.href = "/lehrer/login"; return; }
    const d = await res.json();
    gesperrt = new Set(d.gesperrt || []);
    Object.keys(students).forEach(k => delete students[k]);
    $("#student-table").innerHTML = '<tr id="no-students"><td colspan="10" class="empty-state">Noch niemand angemeldet.</td></tr>';
    (d.schueler || []).slice().reverse().forEach(upsertStudent);
    renderRequests(d.anfragen || []);
    renderBudget(d.budget);
  }

  // ── Socket ──
  function setupSocket() {
    if (typeof io === "undefined") { loadState(); return; }
    const socket = io({ transports: ["websocket", "polling"] });
    socket.on("connect", () => socket.emit("lehrer_join"));
    socket.on("alle_schueler", list => { Object.keys(students).forEach(k => delete students[k]); $("#student-table").innerHTML = '<tr id="no-students"><td colspan="10" class="empty-state">Noch niemand angemeldet.</td></tr>'; list.slice().reverse().forEach(upsertStudent); });
    socket.on("sperr_status_all", d => { gesperrt = new Set(d.gesperrt || []); Object.values(students).forEach(upsertStudent); });
    socket.on("offene_anfragen", list => renderRequests(list));
    socket.on("token_update", renderBudget);
    socket.on("neuer_schueler", s => { upsertStudent(s); toast(`👋 ${s.pseudonym} (Klasse ${s.klasse}) hat sich angemeldet`, "#006AB3"); });
    socket.on("schueler_online", s => upsertStudent(Object.assign({}, s, { online: true })));
    socket.on("schueler_offline", d => { if (students[d.id]) { students[d.id].online = false; upsertStudent(students[d.id]); } });
    socket.on("fortschritt_update", s => upsertStudent(s));
    socket.on("antwort_zaehler", d => { if (students[d.schueler_id]) { students[d.schueler_id].antworten = d.antworten; upsertStudent(students[d.schueler_id]); } });
    socket.on("neue_anfrage", addRequest);
    socket.on("anfrage_erledigt", d => removeRequest(d.anfrage_id, d.schueler_id));
    socket.on("schueler_geloescht", d => removeStudent(d.id));
    socket.on("ki_sperr_status", d => { if (d.gesperrt) gesperrt.add(d.schueler_id); else gesperrt.delete(d.schueler_id); if (students[d.schueler_id]) upsertStudent(students[d.schueler_id]); });
    socket.on("sitzung_zurueckgesetzt", () => { Object.keys(students).forEach(removeStudent); renderRequests([]); });
  }
  document.addEventListener("DOMContentLoaded", () => { renderBudget({ today: parseInt($("#kpi-tokens").textContent, 10) || 0, limit: DASH.limit || 1 }); setupSocket(); });
})();
