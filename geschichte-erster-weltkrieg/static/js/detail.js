/* Schüler-Detailansicht – Live-Fortschritt, Antwortprotokoll, Notizen, Chat-Monitor */
(() => {
  "use strict";
  const D = window.DETAIL || {};
  const SID = D.studentId;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let gesperrt = !!D.gesperrt;

  function toast(text, color) {
    const t = $("#toast"); t.textContent = text; t.style.background = color || "#16a34a"; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 3000);
  }
  async function post(url, payload) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload || {}) });
    if (res.status === 401) { location.href = "/lehrer/login"; return {}; }
    return res.json().catch(() => ({}));
  }

  function updateSperrUI() {
    $("#toggle-ai").textContent = gesperrt ? "KI freigeben" : "KI sperren";
    const pill = $("#ki-pill"); pill.textContent = gesperrt ? "KI gesperrt" : "KI frei"; pill.className = "pill " + (gesperrt ? "pill-locked" : "pill-open");
  }

  function markTile(nr, niveau) {
    const tile = document.getElementById("tile-" + nr);
    if (!tile) return;
    tile.className = "tile done niv-" + niveau;
    tile.innerHTML = `${esc(nr)}<small>${esc(String(niveau).slice(0, 1))}</small>`;
    tile.animate([{ transform: "scale(1.3)" }, { transform: "scale(1)" }], { duration: 350 });
  }

  function renderQuellen(json) {
    const host = $("#notiz-quelle-abschluss");
    if (!host) return;
    let list = [];
    try { list = JSON.parse(json || "[]"); } catch (e) { list = []; }
    if (!Array.isArray(list) || !list.length) { host.textContent = "Quellenverzeichnis: –"; return; }
    host.innerHTML = "<strong>Quellenverzeichnis:</strong><br>" + list.filter(q => q && (q.titel || q.ort)).map(q => `• ${esc(q.titel || "?")} – ${esc(q.ort || "")} (${esc(q.art || "")}, ${esc(q.wert || "")})${q.grund ? ": " + esc(q.grund) : ""}`).join("<br>");
  }
  renderQuellen(($("#notiz-quelle-abschluss") || {}).textContent);

  function addAnswer(d) {
    const log = $("#answer-log");
    const empty = $("#no-answers"); if (empty) empty.remove();
    const icon = d.korrekt === 1 ? "✅" : d.korrekt === 0 ? "❌" : "📝";
    const cls = d.korrekt === 1 ? "is-correct" : d.korrekt === 0 ? "is-wrong" : "";
    log.insertAdjacentHTML("afterbegin", `<article class="answer-log-item ${cls}"><span>${icon}</span><div><strong>Aufgabe ${esc(d.aufgabe_nr)}</strong> <span class="meta">${esc(d.typ)} · Niveau ${esc(d.niveau)} · Versuch ${d.versuch_nr}</span><br>${esc(d.antwort)}</div><time>${esc(d.zeit)}</time></article>`);
    $("#answer-count").textContent = parseInt($("#answer-count").textContent, 10) + 1;
  }

  function addChat(d) {
    const host = $("#detail-chat");
    const empty = $("#no-chat"); if (empty) empty.remove();
    host.insertAdjacentHTML("beforeend", `<div class="chat-message user"><strong>${esc(d.pseudonym)} · ${esc(d.zeit)}</strong><p>${esc(d.frage)}</p></div><div class="chat-message assistant"><strong>KI · ${d.tokens} Tokens</strong><p>${esc(d.antwort)}</p></div>`);
    host.scrollTop = host.scrollHeight;
  }

  function addRequest(a) {
    const host = $("#request-list");
    if (host.querySelector(`[data-id="${a.id}"]`)) return;
    host.insertAdjacentHTML("beforeend", `<div class="request-item is-new" data-id="${a.id}"><span class="request-typ">${a.typ === "chat" ? "Tutor" : "Feedback"}</span><div class="who"><strong>${esc(a.kontext || "")}</strong><small>${esc((a.erstellt_at || "").slice(11, 16))}</small></div><button class="btn btn-primary btn-sm" data-decide="freigegeben" data-id="${a.id}" type="button">✅ Freigeben</button><button class="btn btn-danger-outline btn-sm" data-decide="abgelehnt" data-id="${a.id}" type="button">✕</button></div>`);
    toast("🤖 Neue KI-Anfrage", "#AD007C");
  }

  document.addEventListener("click", async e => {
    const decide = e.target.closest("[data-decide]");
    if (decide) {
      decide.disabled = true;
      const r = await post("/api/ki-entscheidung", { anfrage_id: parseInt(decide.dataset.id, 10), entscheid: decide.dataset.decide });
      if (r.ok) { const el = $(`#request-list [data-id="${decide.dataset.id}"]`); if (el) el.remove(); }
      else decide.disabled = false;
      return;
    }
    if (e.target.id === "toggle-ai") {
      const r = await post("/api/lehrer/ki-sperren", { schueler_id: SID, aktion: gesperrt ? "freigeben" : "sperren" });
      if (r.ok) { gesperrt = !!r.gesperrt; updateSperrUI(); toast(gesperrt ? "🚫 KI gesperrt" : "✅ KI freigegeben", gesperrt ? "#dc2626" : "#16a34a"); }
    }
    if (e.target.id === "delete-student") {
      if (!confirm("Alle Daten dieses Pseudonyms endgültig löschen?")) return;
      const r = await post("/api/lehrer/daten-loeschen", { schueler_id: SID });
      if (r.ok) location.href = "/lehrer";
    }
  });

  function setupSocket() {
    if (typeof io === "undefined") return;
    const socket = io({ transports: ["websocket", "polling"] });
    socket.on("connect", () => { socket.emit("lehrer_join"); socket.emit("watch_schueler", { schueler_id: SID }); });
    socket.on("fortschritt_update", info => {
      if (info.id !== SID) return;
      (info.aufgaben_neu || []).forEach(a => markTile(a.nr, a.niveau));
      $("#progress-count").textContent = info.aufgaben_erledigt;
      Object.entries(info.abschnitte || {}).forEach(([key, a]) => { const el = document.getElementById("abschnitt-count-" + key); if (el) el.textContent = `${a.erledigt}/${a.gesamt}`; });
    });
    socket.on("antwort_live", d => { if (d.schueler_id === SID) addAnswer(d); });
    socket.on("chat_live", d => { if (d.schueler_id === SID) addChat(d); });
    socket.on("notizen_live", d => {
      if (d.schueler_id !== SID) return;
      const t = document.getElementById("notiz-time-" + d.abschnitt); if (t) t.textContent = d.zeit;
      if (d.abschnitt === "abschluss") { $("#notiz-text-abschluss").textContent = d.stichpunkte || "Noch kein Transfertext."; renderQuellen(d.quellen); return; }
      const s = document.getElementById("notiz-text-" + d.abschnitt); if (s) s.textContent = d.stichpunkte || "Noch keine Stichpunkte.";
      const q = document.getElementById("notiz-quelle-" + d.abschnitt); if (q) q.textContent = d.quellen ? "Quellen: " + d.quellen : "Quellen: –";
    });
    socket.on("neue_anfrage", a => { if (a.schueler_id === SID) addRequest(a); });
    socket.on("anfrage_erledigt", d => { const el = $(`#request-list [data-id="${d.anfrage_id}"]`); if (el) el.remove(); });
    socket.on("schueler_online", s => { if (s.id === SID) { $("#online-pill").textContent = "online"; $("#online-pill").className = "pill pill-open"; } });
    socket.on("schueler_offline", d => { if (d.id === SID) { $("#online-pill").textContent = "offline"; $("#online-pill").className = "pill pill-offline"; } });
    socket.on("ki_sperr_status", d => { if (d.schueler_id === SID) { gesperrt = !!d.gesperrt; updateSperrUI(); } });
    socket.on("sperr_status_all", d => { gesperrt = (d.gesperrt || []).includes(SID); updateSperrUI(); });
    socket.on("schueler_geloescht", d => { if (d.id === SID) location.href = "/lehrer"; });
    socket.on("sitzung_zurueckgesetzt", () => { location.href = "/lehrer"; });
  }
  document.addEventListener("DOMContentLoaded", () => { updateSperrUI(); setupSocket(); });
})();
