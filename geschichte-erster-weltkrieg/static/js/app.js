/* Schüler-Arbeitsbereich „Der Erste Weltkrieg (1914–1918)“ – Logik
   Datengetrieben: Aufgaben kommen aus window.INHALTE (inhalte.js).
   iPad-first: nur Tap, keine Hover-only-Funktionen, kein Drag & Drop. */
(() => {
  "use strict";

  const INHALTE = window.INHALTE;
  const APP = window.APP || {};
  const NIVEAU_LABEL = { A: "🟢 A · Basis", B: "🟡 B · Standard", C: "🔴 C · Experte" };

  // ─── Zustand ───────────────────────────────────────────────────────────
  const state = {
    completed: new Set(),
    niveau: {},            // nr -> 'A' | 'B' | 'C'
    runtime: {},           // nr -> Laufzeitdaten der aktuellen Darstellung
    charts: {},            // nr -> Chart.js-Instanz
    notizen: {},           // abschnitt -> {stichpunkte, quellen}
    activeTab: "material",
    kiGesperrt: false,
    kiKonfiguriert: true,
    chat: [],
  };
  const aufgabenByNr = {};
  const tabByNr = {};
  INHALTE.tabs.forEach(tab => tab.aufgaben.forEach(a => { aufgabenByNr[a.nr] = a; tabByNr[a.nr] = tab; }));
  const totalTasks = APP.aufgabenGesamt || Object.keys(aufgabenByNr).length;

  // ─── Hilfsfunktionen ───────────────────────────────────────────────────
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const normalize = s => String(s || "").toLowerCase().trim().replace(/[.,;:!?„“"']/g, "").replace(/ß/g, "ss").replace(/\s+/g, " ");
  const isDifferenziert = t => ["mc", "luecke", "zuordnung", "sortierung", "diagramm", "karte", "freitext"].includes(t.typ);
  const niveauOf = nr => state.niveau[nr] || "A";
  const cfgOf = t => t.niveaus ? t.niveaus[niveauOf(t.nr)] : t;
  const card = nr => document.getElementById("card-" + nr);
  const body = nr => document.getElementById("body-" + nr);

  function showFb(nr, kind, html, extraBtn) {
    const fb = document.getElementById("fb-" + nr);
    if (!fb) return;
    fb.className = "feedback-box show feedback-" + kind;
    fb.innerHTML = html + (extraBtn || "");
  }
  function clearFb(nr) { const fb = document.getElementById("fb-" + nr); if (fb) { fb.className = "feedback-box"; fb.innerHTML = ""; } }
  function retryBtn(nr) { return ` <button class="btn btn-quiet btn-sm" data-action="retry" data-nr="${nr}">🔄 Nochmal</button>`; }

  function showToast(text, color) {
    const t = $("#toast");
    t.textContent = text;
    t.style.background = color || "#16a34a";
    t.classList.add("show");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => t.classList.remove("show"), 3200);
  }

  async function postJSON(url, payload) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload || {}) });
    if (res.status === 401) { sessionEnded("abgelaufen"); throw new Error("Sitzung abgelaufen"); }
    return res.json().catch(() => ({}));
  }

  // ─── Fortschritt ───────────────────────────────────────────────────────
  function updateProgress() {
    const done = state.completed.size;
    const pct = Math.round((done / totalTasks) * 100);
    $("#progress-fill").style.width = pct + "%";
    $("#progress-text").textContent = `${done} / ${totalTasks} Aufgaben`;
    $("#progress-pct").textContent = pct + " %";
    INHALTE.tabs.forEach(tab => {
      const n = tab.aufgaben.filter(a => state.completed.has(String(a.nr))).length;
      const chip = $(`#tabcount-${tab.key}`);
      if (chip) { chip.textContent = `${n}/${tab.aufgaben.length}`; chip.classList.toggle("is-complete", n === tab.aufgaben.length); }
    });
    if (done === totalTasks && !updateProgress._celebrated) { updateProgress._celebrated = true; showToast("🏆 Alle Aufgaben erledigt – stark!", "#AD007C"); }
  }

  function markComplete(nr) {
    const key = String(nr);
    const first = !state.completed.has(key);
    state.completed.add(key);
    const c = card(nr);
    if (c) { c.classList.add("is-done"); const b = $(".done-badge", c); if (b) b.hidden = false; }
    updateProgress();
    if (first) postJSON("/api/fortschritt", { aufgabe: key, niveau: key === "T" ? "Transfer" : niveauOf(nr) }).catch(() => {});
  }

  function sendAntwort(nr, typ, text, korrekt) {
    const key = String(nr);
    postJSON("/api/antwort", { aufgabe: key, niveau: key === "T" ? "Transfer" : niveauOf(nr), typ, antwort: String(text).slice(0, 400), korrekt: korrekt === undefined ? null : korrekt }).catch(() => {});
  }

  // ─── Navigation ────────────────────────────────────────────────────────
  function buildNav() {
    const nav = $("#tab-bar");
    const items = [{ key: "material", label: "Arbeitsblatt", icon: "📄" }].concat(INHALTE.tabs);
    nav.innerHTML = items.map((t, i) => `
      <button class="tab-btn${i === 0 ? " active" : ""}" id="btn-tab-${t.key}" data-action="tab" data-tab="${t.key}" aria-selected="${i === 0}">
        <span class="tab-icon">${t.icon}</span><span class="tab-label">${esc(t.label)}</span>
        ${t.aufgaben ? `<span class="tab-count" id="tabcount-${t.key}">0/${t.aufgaben.length}</span>` : ""}
      </button>`).join("");
  }

  function showTab(key) {
    state.activeTab = key;
    $$(".tab-btn").forEach(b => { const on = b.dataset.tab === key; b.classList.toggle("active", on); b.setAttribute("aria-selected", on); });
    $$(".tab-panel").forEach(p => { p.hidden = p.dataset.panel !== key; });
    const tab = INHALTE.tabs.find(t => t.key === key);
    if (tab) tab.aufgaben.forEach(a => { if (a.typ === "diagramm") ensureChart(a); });
    window.scrollTo({ top: Math.min(window.scrollY, $("#tab-bar").offsetTop - 8), behavior: "smooth" });
  }

  // ─── Aufbau der Reiter ─────────────────────────────────────────────────
  function buildPanels() {
    const host = $("#panels");
    host.innerHTML = INHALTE.tabs.map(tab => `
      <section class="tab-panel" id="tab-${tab.key}" data-panel="${tab.key}" hidden>
        <article class="card intro-card">
          <span class="eyebrow">${esc(tab.intro.eyebrow)}</span>
          <h2>${esc(tab.intro.titel)}</h2>
          ${tab.intro.absaetze.map(p => `<p>${p}</p>`).join("")}
          <div class="begriffe"><span>Fachbegriffe:</span> ${tab.intro.begriffe.map(b => `<em>${esc(b)}</em>`).join("")}</div>
        </article>
        ${tab.aufgaben.map(renderCardShell).join("")}
      </section>`).join("");
    INHALTE.tabs.forEach(tab => tab.aufgaben.forEach(renderBody));
  }

  function renderCardShell(t) {
    const select = isDifferenziert(t) ? `
      <select class="niveau-select" data-action="niveau" data-nr="${t.nr}" aria-label="Niveau Aufgabe ${t.nr}">
        ${["A", "B", "C"].map(n => `<option value="${n}"${niveauOf(t.nr) === n ? " selected" : ""}>${NIVEAU_LABEL[n]}</option>`).join("")}
      </select>` : "";
    return `
      <article class="card task-card" id="card-${t.nr}" data-nr="${t.nr}" data-typ="${t.typ}">
        <header class="task-header">
          <span class="task-number">${t.nr}</span>
          <div class="task-title"><span class="eyebrow">${esc(t.eyebrow)}</span><h3>${esc(t.titel)}</h3></div>
          ${select}
          <span class="done-badge" hidden>✅ erledigt</span>
        </header>
        <div class="task-body" id="body-${t.nr}"></div>
        <div class="feedback-box" id="fb-${t.nr}" role="status" aria-live="polite"></div>
      </article>`;
  }

  function renderBody(t) {
    const host = body(t.nr);
    if (!host) return;
    clearFb(t.nr);
    state.runtime[t.nr] = {};
    if (state.charts[t.nr]) { state.charts[t.nr].destroy(); delete state.charts[t.nr]; }
    const renderers = { mc: renderMCTask, luecke: renderLuecke, zuordnung: renderZuordnung, sortierung: renderSortierung, diagramm: renderDiagramm, karte: renderKarte, freitext: renderFreitext, notizen: renderNotizen, quellen: renderQuellen, transfer: renderTransfer };
    host.innerHTML = renderers[t.typ] ? renderers[t.typ](t) : "<p>Unbekannter Aufgabentyp.</p>";
    if (t.typ === "diagramm" && !card(t.nr).closest(".tab-panel").hidden) ensureChart(t);
    if (t.typ === "notizen") fillNotizen(t);
    if (t.typ === "quellen") fillQuellen(t);
    if (t.typ === "transfer") fillTransfer(t);
  }

  // ─── Multiple Choice ───────────────────────────────────────────────────
  function renderMC(nr, cfg, hidden) {
    const opts = shuffle(cfg.optionen.map((o, i) => ({ ...o, i })));
    return `
      <div class="mc-block" id="mc-${nr}"${hidden ? " hidden" : ""}>
        <p class="task-question">${esc(cfg.frage)}</p>
        <div class="mc-options" data-multi="${cfg.multi || 1}">
          ${opts.map(o => `<button class="mc-btn" type="button" data-action="mc" data-nr="${nr}" data-ok="${o.ok}">${esc(o.t)}</button>`).join("")}
        </div>
        ${cfg.multi ? `<p class="hint">💡 Wähle genau ${cfg.multi} richtige Aussagen.</p>` : ""}
      </div>`;
  }
  function renderMCTask(t) { return renderMC(t.nr, cfgOf(t)); }

  function handleMC(btn) {
    const nr = btn.dataset.nr;
    const t = aufgabenByNr[nr];
    const group = btn.closest(".mc-options");
    if (group.dataset.done === "1") return;
    const multi = parseInt(group.dataset.multi, 10) || 1;
    const typ = t.typ === "mc" ? (multi > 1 ? "mc-multi" : "mc") : t.typ;
    if (multi === 1) {
      group.dataset.done = "1";
      const ok = btn.dataset.ok === "true";
      $$(".mc-btn", group).forEach(b => { b.disabled = true; });
      btn.classList.add(ok ? "correct" : "incorrect");
      sendAntwort(nr, typ, btn.textContent.trim(), ok);
      if (ok) { showFb(nr, "ok", "✅ Richtig!"); markComplete(nr); }
      else { $$(".mc-btn", group).forEach(b => { if (b.dataset.ok === "true") b.classList.add("correct"); }); showFb(nr, "err", "❌ Leider falsch – die richtige Antwort ist markiert. Lies die Kompakt-Info noch einmal.", retryBtn(nr)); }
      return;
    }
    btn.classList.toggle("selected-multi");
    const selected = $$(".mc-btn.selected-multi", group);
    if (selected.length < multi) { showFb(nr, "info", `💡 ${selected.length} von ${multi} ausgewählt …`); return; }
    group.dataset.done = "1";
    $$(".mc-btn", group).forEach(b => { b.disabled = true; });
    const allOk = selected.every(b => b.dataset.ok === "true");
    selected.forEach(b => b.classList.add(b.dataset.ok === "true" ? "correct" : "incorrect"));
    $$(".mc-btn:not(.selected-multi)", group).forEach(b => { if (b.dataset.ok === "true") b.classList.add("correct"); });
    sendAntwort(nr, typ, selected.map(b => b.textContent.trim()).join(" | "), allOk);
    if (allOk) { showFb(nr, "ok", "✅ Perfekt – beide Aussagen stimmen!"); markComplete(nr); }
    else showFb(nr, "err", "❌ Nicht ganz. Die richtigen Aussagen sind markiert.", retryBtn(nr));
  }

  // ─── Lückentext ────────────────────────────────────────────────────────
  function parseGaps(text) {
    const parts = []; let last = 0; const re = /\[([^\]]+)\]/g; let m;
    while ((m = re.exec(text))) {
      parts.push({ text: text.slice(last, m.index) });
      parts.push({ gap: m[1].split("|").map(s => s.trim()) });
      last = re.lastIndex;
    }
    parts.push({ text: text.slice(last) });
    return parts;
  }

  function renderLuecke(t) {
    const cfg = cfgOf(t);
    const parts = parseGaps(cfg.text);
    const gaps = parts.filter(p => p.gap);
    let html = "";
    if (cfg.modus === "chips") {
      const words = shuffle(gaps.map(g => g.gap[0]).concat(cfg.ablenker || []));
      html += `<div class="word-bank"><span class="word-bank-label">📚 Wortkiste</span>${words.map((w, i) => `<button class="word-chip" type="button" id="chip-${t.nr}-${i}" data-action="chip" data-nr="${t.nr}" data-word="${esc(w)}">${esc(w)}</button>`).join("")}</div>`;
      html += `<div class="gap-text">${parts.map((p, i) => p.gap ? `<span class="gap-tap" data-action="gap-clear" data-nr="${t.nr}" data-answer="${esc(p.gap.join("|"))}" data-idx="${i}">___</span>` : esc(p.text)).join("")}</div>`;
      html += `<p class="hint">Tippe auf ein Wort – es füllt die nächste freie Lücke. Tippe auf eine gefüllte Lücke, um sie zu leeren.</p>`;
    } else {
      html += `<div class="gap-text">${parts.map(p => p.gap ? `<input class="gap-input" data-answer="${esc(p.gap.join("|"))}" placeholder="?" autocomplete="off" autocapitalize="off" aria-label="Lücke">` : esc(p.text)).join("")}</div>`;
      html += `<p class="hint">Schreibe die passenden Begriffe in die Lücken. Groß-/Kleinschreibung ist egal.</p>`;
    }
    html += `<div class="btn-row"><button class="btn btn-primary" type="button" data-action="check-luecke" data-nr="${t.nr}">✅ Überprüfen</button><button class="btn btn-outline" type="button" data-action="reset-luecke" data-nr="${t.nr}">🔄 Zurücksetzen</button></div>`;
    return html;
  }

  function useChip(chip) {
    if (chip.disabled) return;
    const host = body(chip.dataset.nr);
    const gap = $$(".gap-tap:not(.filled)", host)[0];
    if (!gap) { showFb(chip.dataset.nr, "info", "Alle Lücken sind gefüllt – tippe auf eine Lücke, um sie zu leeren."); return; }
    gap.textContent = chip.dataset.word; gap.dataset.filled = chip.dataset.word; gap.dataset.chipId = chip.id;
    gap.classList.add("filled"); gap.classList.remove("correct", "incorrect");
    chip.disabled = true; chip.classList.add("used");
  }
  function clearGap(gap) {
    if (!gap.classList.contains("filled")) return;
    const chip = document.getElementById(gap.dataset.chipId);
    if (chip) { chip.disabled = false; chip.classList.remove("used"); }
    gap.textContent = "___"; gap.classList.remove("filled", "correct", "incorrect"); gap.dataset.filled = ""; delete gap.dataset.chipId;
  }
  function matches(value, answers) {
    const v = normalize(value);
    return answers.some(a => { const n = normalize(a); return v === n || (n.length > 6 && v.length >= 5 && (v === n.replace(/-/g, " ") || v.replace(/-/g, " ") === n.replace(/-/g, " "))); });
  }
  function checkLuecke(nr) {
    const host = body(nr);
    const gaps = $$(".gap-tap, .gap-input", host);
    let correct = 0; const wrong = [];
    gaps.forEach(g => {
      const answers = g.dataset.answer.split("|");
      const val = g.classList.contains("gap-input") ? g.value : (g.dataset.filled || "");
      g.classList.remove("correct", "incorrect");
      if (val && matches(val, answers)) { g.classList.add("correct"); correct++; }
      else { g.classList.add("incorrect"); wrong.push(`${val || "leer"} statt ${answers[0]}`); }
    });
    const ok = correct === gaps.length;
    sendAntwort(nr, "luecke", ok ? "alle Lücken richtig" : wrong.join("; "), ok);
    if (ok) { showFb(nr, "ok", "✅ Alle Lücken richtig!"); markComplete(nr); }
    else showFb(nr, "err", `❌ ${correct} von ${gaps.length} richtig. Rot markierte Lücken noch einmal prüfen – ein Blick in die Kompakt-Info hilft.`);
  }
  function resetLuecke(nr) {
    const host = body(nr);
    $$(".word-chip", host).forEach(c => { c.disabled = false; c.classList.remove("used"); });
    $$(".gap-tap", host).forEach(g => { g.textContent = "___"; g.classList.remove("filled", "correct", "incorrect"); g.dataset.filled = ""; delete g.dataset.chipId; });
    $$(".gap-input", host).forEach(i => { i.value = ""; i.classList.remove("correct", "incorrect"); });
    clearFb(nr);
  }

  // ─── Zuordnung ─────────────────────────────────────────────────────────
  function renderZuordnung(t) {
    const cfg = cfgOf(t);
    const rechts = shuffle(cfg.paare.map((p, i) => ({ text: p[1], i })));
    state.runtime[t.nr] = { matched: 0, total: cfg.paare.length, selected: null };
    return `
      <p class="hint">Tippe zuerst links auf einen Begriff, dann rechts auf die passende Erklärung.</p>
      <div class="match-columns">
        <div><div class="match-col-header">${esc(cfg.links)}</div>${cfg.paare.map((p, i) => `<button type="button" class="match-item" data-action="match-left" data-nr="${t.nr}" data-pair="${i}">${esc(p[0])}</button>`).join("")}</div>
        <div><div class="match-col-header">${esc(cfg.rechts)}</div>${rechts.map(r => `<button type="button" class="match-item" data-action="match-right" data-nr="${t.nr}" data-pair="${r.i}">${esc(r.text)}</button>`).join("")}</div>
      </div>
      <div class="btn-row"><button class="btn btn-outline" type="button" data-action="reset-match" data-nr="${t.nr}">🔄 Zurücksetzen</button></div>`;
  }
  function matchLeft(el) {
    if (el.classList.contains("matched-ok")) return;
    const host = body(el.dataset.nr);
    $$(".match-item.selected", host).forEach(e => e.classList.remove("selected"));
    el.classList.add("selected");
    state.runtime[el.dataset.nr].selected = el;
  }
  function matchRight(el) {
    const nr = el.dataset.nr; const rt = state.runtime[nr];
    if (!rt.selected || el.classList.contains("matched-ok")) { if (!rt.selected) showFb(nr, "info", "👈 Wähle zuerst links einen Begriff."); return; }
    const left = rt.selected;
    const ok = left.dataset.pair === el.dataset.pair;
    sendAntwort(nr, "zuordnung", `${ok ? "✅" : "❌"} ${left.textContent.trim()} → ${el.textContent.trim()}`, ok);
    if (ok) {
      left.classList.remove("selected"); left.classList.add("matched-ok"); el.classList.add("matched-ok");
      left.disabled = true; el.disabled = true;
      rt.matched++; rt.selected = null;
      if (rt.matched >= rt.total) { showFb(nr, "ok", "✅ Alle Zuordnungen richtig!"); markComplete(nr); }
      else showFb(nr, "ok", `✅ Passt! ${rt.matched} von ${rt.total} zugeordnet.`);
    } else {
      left.classList.remove("selected"); el.classList.add("matched-err"); setTimeout(() => el.classList.remove("matched-err"), 700);
      rt.selected = null;
      showFb(nr, "err", "❌ Das passt nicht zusammen. Versuch es noch einmal!");
    }
  }
  function resetMatch(nr) { renderBody(aufgabenByNr[nr]); }

  // ─── Sortierung ────────────────────────────────────────────────────────
  function renderSortierung(t) {
    const cfg = cfgOf(t);
    let order = shuffle(cfg.items.map((_, i) => i));
    if (order.every((v, i) => v === i) && order.length > 1) order = order.slice(1).concat(order[0]);
    state.runtime[t.nr] = { order, selected: null, items: cfg.items };
    return `<p class="hint">${esc(cfg.hinweis || "Bringe die Ereignisse in die richtige Reihenfolge.")} Tippe zwei Einträge nacheinander an, um sie zu tauschen.</p>
      <div class="sort-list" id="sort-${t.nr}">${renderSortItems(t.nr)}</div>
      <div class="btn-row"><button class="btn btn-primary" type="button" data-action="check-sort" data-nr="${t.nr}">✅ Reihenfolge prüfen</button><button class="btn btn-outline" type="button" data-action="reset-sort" data-nr="${t.nr}">🔄 Neu mischen</button></div>`;
  }
  function renderSortItems(nr) {
    const rt = state.runtime[nr];
    return rt.order.map((idx, pos) => `<button type="button" class="sort-item${rt.selected === pos ? " selected-sort" : ""}${rt.result ? (rt.result[pos] ? " correct" : " incorrect") : ""}" data-action="sort-item" data-nr="${nr}" data-pos="${pos}"><span class="handle">${pos + 1}.</span><span>${esc(rt.items[idx])}</span><span class="swap-hint">⇅</span></button>`).join("");
  }
  function sortTap(el) {
    const nr = el.dataset.nr; const rt = state.runtime[nr]; const pos = parseInt(el.dataset.pos, 10);
    rt.result = null;
    if (rt.selected === null || rt.selected === undefined) rt.selected = pos;
    else if (rt.selected === pos) rt.selected = null;
    else { [rt.order[rt.selected], rt.order[pos]] = [rt.order[pos], rt.order[rt.selected]]; rt.selected = null; }
    document.getElementById("sort-" + nr).innerHTML = renderSortItems(nr);
  }
  function checkSort(nr) {
    const rt = state.runtime[nr];
    rt.result = rt.order.map((idx, pos) => idx === pos);
    rt.selected = null;
    document.getElementById("sort-" + nr).innerHTML = renderSortItems(nr);
    const ok = rt.result.every(Boolean);
    const richtig = rt.result.filter(Boolean).length;
    sendAntwort(nr, "sortierung", ok ? "richtige Reihenfolge" : `${richtig}/${rt.order.length} Positionen richtig: ` + rt.order.map(i => rt.items[i].slice(0, 25)).join(" → "), ok);
    if (ok) { showFb(nr, "ok", "✅ Richtige Reihenfolge!"); markComplete(nr); }
    else showFb(nr, "err", `❌ ${richtig} von ${rt.order.length} Positionen stimmen (grün). Weiter tauschen!`);
  }

  // ─── Diagramm (Chart.js) ───────────────────────────────────────────────
  function renderDiagramm(t) {
    const cfg = cfgOf(t);
    return `<div class="chart-wrap"><canvas id="chart-${t.nr}" aria-label="${esc(t.chart.yTitel)}" role="img"></canvas></div>
      <p class="chart-source">${esc(t.chart.quelle)}${t.chart.legendeExtra ? " · " + esc(t.chart.legendeExtra) : ""}</p>
      <div class="feedback-box feedback-info show chart-info" id="chartinfo-${t.nr}">👆 Tippe auf das Diagramm, um Werte zu sehen.</div>
      ${renderMC(t.nr, cfg)}`;
  }
  function ensureChart(t) {
    const canvas = document.getElementById("chart-" + t.nr);
    if (!canvas || state.charts[t.nr] || typeof Chart === "undefined") return;
    const ch = t.chart;
    const datasets = ch.datasets.map(d => ({
      label: d.label, data: d.data,
      backgroundColor: d.farben || (ch.typ === "line" ? "rgba(0,106,179,.15)" : d.farbe),
      borderColor: d.farbe || "#006AB3", borderWidth: ch.typ === "line" ? 3 : 0, borderRadius: 4,
      fill: ch.typ === "line", tension: 0.3, pointRadius: ch.typ === "line" ? 6 : 0, pointHoverRadius: 8,
    }));
    const valueAxis = { beginAtZero: true, title: { display: true, text: ch.yTitel } };
    state.charts[t.nr] = new Chart(canvas, {
      type: ch.typ === "line" ? "line" : "bar",
      data: { labels: ch.labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: ch.horizontal ? "y" : "x",
        plugins: { legend: { display: ch.datasets.length > 1, position: "top" }, tooltip: { enabled: true } },
        scales: ch.horizontal ? { x: valueAxis, y: { ticks: { autoSkip: false, font: { size: 11 } } } } : { y: valueAxis },
        onClick: (evt, elements) => {
          if (!elements.length) return;
          const el = elements[0];
          const ds = ch.datasets[el.datasetIndex];
          const info = document.getElementById("chartinfo-" + t.nr);
          info.innerHTML = `<strong>${esc(ch.labels[el.index])}</strong> · ${esc(ds.label)}: <strong>${ds.data[el.index]} ${esc(ch.einheit)}</strong>`;
        },
      },
    });
  }

  // ─── Karte (SVG-Skizze mit Hotspots) ───────────────────────────────────
  const MAP_W = 900, MAP_H = 640;
  const px = lon => ((lon + 12) * 17).toFixed(1);
  const py = lat => ((63 - lat) * 22).toFixed(1);
  const poly = pts => pts.map(p => `${px(p[0])},${py(p[1])}`).join(" ");
  const ATLANTIK = [[-12, 63], [-12, 34], [-5.5, 34], [-5.5, 36], [-6.5, 36.8], [-8.9, 37], [-8.8, 38.5], [-9.4, 39], [-8.8, 41.2], [-9.3, 43], [-8, 43.7], [-6, 43.6], [-3.8, 43.5], [-1.8, 43.4], [-1.3, 44.6], [-1.2, 46.2], [-2.2, 47.2], [-4.7, 48], [-4.7, 48.6], [-3, 48.8], [-1.5, 48.7], [-1.6, 49.7], [-0.2, 49.4], [1.5, 50.9], [2.5, 51.1], [3.4, 51.4], [4.3, 52.2], [4.8, 53.2], [6.9, 53.6], [8.6, 53.9], [8.4, 55.2], [8.1, 56.6], [9.6, 57.6], [10.6, 57.7], [10.4, 56.3], [10.1, 55.6], [9.7, 54.8], [10.9, 54.1], [12.2, 54.4], [13.4, 54.6], [14.2, 53.9], [15.9, 54.3], [18.6, 54.7], [19.9, 54.4], [21, 55.4], [21, 56.4], [21.1, 57.4], [22.6, 57.6], [24.1, 57.3], [24.3, 58.5], [23.5, 59.3], [24.7, 59.5], [28, 59.5], [30.2, 60], [28.5, 60.5], [26, 60.4], [22.5, 60], [21, 61.2], [21.5, 63], [19.5, 63], [18.5, 62], [17.6, 61.3], [18.9, 59.6], [16.8, 58.3], [16.5, 57], [16, 56.2], [14.3, 55.5], [12.9, 55.4], [12.6, 56.3], [11.6, 57.6], [11.1, 58.6], [10.7, 59.6], [9.6, 59], [8, 58.1], [6.5, 58.1], [5.5, 59], [5, 60.5], [5.2, 62], [5.5, 63]];
  const MITTELMEER = [[-5.5, 36], [-5.5, 34], [35, 34], [35.9, 35.5], [36.1, 36.4], [34.5, 36.8], [32.5, 36.1], [30.5, 36.3], [29.2, 36.7], [28, 36.8], [27.3, 37.1], [26.3, 38.3], [26.7, 39.5], [26.2, 40.1], [26.3, 40.9], [25, 40.9], [24, 40.7], [23, 40.4], [22.8, 39.9], [23.3, 39], [23.8, 38.1], [23.5, 37.8], [22.9, 36.4], [21.7, 36.8], [21.2, 38.2], [20.9, 38.9], [20.6, 39.6], [19.5, 40.4], [19.4, 41.5], [19, 42.4], [17.5, 43], [15.9, 43.7], [15, 44.6], [13.9, 45.1], [13.7, 45.7], [12.6, 45.5], [12.4, 44.8], [13.5, 43.6], [14.5, 42.3], [15.8, 41.9], [17.2, 40.9], [18.5, 40.1], [17.2, 40.4], [16.6, 39.6], [16.5, 38.5], [15.7, 37.9], [16, 39], [15.7, 40], [14.8, 40.7], [13.8, 41.2], [12.5, 41.7], [11.2, 42.4], [10.3, 43.5], [9.8, 44.1], [8.9, 44.4], [8.2, 43.9], [7.5, 43.8], [6.5, 43.2], [5.4, 43.3], [4.2, 43.5], [3.1, 43], [3.1, 42.4], [2.2, 41.4], [0.9, 41], [0.3, 40], [-0.3, 39.5], [-0.5, 38.3], [-0.8, 37.6], [-2.2, 36.8], [-4.4, 36.7]];
  const SCHWARZES_MEER = [[29, 41.2], [28, 41.9], [27.9, 43.2], [28.6, 43.8], [28.6, 44.4], [29.7, 45.2], [30.7, 46.5], [32, 46.6], [33.4, 46.2], [32.6, 45.4], [33.4, 44.5], [34.5, 44.5], [35.4, 45], [36.5, 45.2], [37.4, 44.7], [38.5, 44.4], [39.6, 43.6], [40.8, 43], [41, 42.6], [41, 41.6], [39.5, 41.1], [37, 41], [35.5, 42], [33, 42], [31.4, 41.3], [29.5, 41.2]];
  const GB = [[-5.7, 50], [-3.5, 50.4], [-1, 50.8], [1.4, 51.2], [1.7, 52.7], [0.2, 53.5], [-0.3, 54.5], [-1.5, 55.5], [-2, 56.5], [-1.8, 57.6], [-3.5, 58.6], [-5, 58.6], [-6, 57.5], [-5.5, 56.5], [-6.2, 55.8], [-5, 54.8], [-3.2, 54.3], [-3.2, 53.4], [-4.5, 53.3], [-4.7, 52.2], [-5.2, 51.7], [-4.2, 51.6], [-3, 51.4], [-4, 51], [-5.7, 50]];
  const IRLAND = [[-10, 51.6], [-8, 51.6], [-6, 52.2], [-6, 53.5], [-5.5, 54.6], [-6, 55.2], [-7.5, 55.3], [-8.5, 54.6], [-10, 54], [-10, 52.5]];
  const INSELN = [[[12.4, 37.9], [13.3, 38.2], [15.6, 38.3], [15.1, 36.7], [12.5, 37.6]], [[8.6, 42.9], [9.5, 42.9], [9.5, 41.4], [8.7, 41.4]], [[8.2, 41.1], [9.7, 41.2], [9.6, 39.2], [8.4, 39]], [[23.5, 35.5], [26.3, 35.3], [26, 35], [23.6, 35.2]]];

  function buildMapSVG(spec, nr) {
    const pointById = Object.fromEntries(spec.punkte.map(p => [p.id, p]));
    const linien = (spec.linien || []).map(([a, b, bloc]) => { const A = pointById[a], B = pointById[b]; return `<line class="map-line map-line-${bloc}" x1="${px(A.lon)}" y1="${py(A.lat)}" x2="${px(B.lon)}" y2="${py(B.lat)}"/>`; }).join("");
    const fronten = (spec.fronten || []).map(f => `<polyline class="map-front" points="${poly(f.punkte)}"><title>${esc(f.name)}</title></polyline>`).join("");
    const punkte = spec.punkte.map(p => `
      <g class="hs-dot hs-${p.bloc}" data-action="spot" data-nr="${nr}" data-spot="${p.id}" role="button" tabindex="0" aria-label="${esc(p.titel)}">
        <circle cx="${px(p.lon)}" cy="${py(p.lat)}" r="22"/>
        <text class="hs-icon" x="${px(p.lon)}" y="${py(p.lat)}" text-anchor="middle" dominant-baseline="central">${p.icon}</text>
        <text class="hs-label" x="${px(p.lon)}" y="${(parseFloat(py(p.lat)) + 38).toFixed(1)}" text-anchor="middle">${esc(p.label)}</text>
      </g>`).join("");
    const legende = (spec.legende || []).map(([k, l]) => `<span class="legend-item"><i class="legend-dot hs-${k}"></i>${esc(l)}</span>`).join("");
    return `
      <div class="map-wrap">
        <svg viewBox="0 0 ${MAP_W} ${MAP_H}" class="map-svg" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="${esc(spec.titel)}">
          <rect width="${MAP_W}" height="${MAP_H}" class="map-land"/>
          <polygon class="map-water" points="${poly(ATLANTIK)}"/>
          <polygon class="map-water" points="${poly(MITTELMEER)}"/>
          <polygon class="map-water" points="${poly(SCHWARZES_MEER)}"/>
          <polygon class="map-land-poly" points="${poly(GB)}"/>
          <polygon class="map-land-poly" points="${poly(IRLAND)}"/>
          ${INSELN.map(i => `<polygon class="map-land-poly" points="${poly(i)}"/>`).join("")}
          ${fronten}${linien}${punkte}
        </svg>
      </div>
      <div class="map-legend">${legende}<span class="legend-note">vereinfachte Kartenskizze</span></div>`;
  }

  function renderKarte(t) {
    const spec = INHALTE.karten[t.karte];
    const cfg = cfgOf(t);
    const needed = Math.min(t.benoetigt[niveauOf(t.nr)] || 3, spec.punkte.length);
    state.runtime[t.nr] = { visited: new Set(), needed };
    return `${buildMapSVG(spec, t.nr)}
      <div class="feedback-box feedback-info show map-info" id="mapinfo-${t.nr}">👆 Tippe auf die Punkte der Karte. Erkunde mindestens <strong>${needed}</strong> Orte, dann erscheint die Frage. <span class="map-progress" id="mapprog-${t.nr}">0/${needed}</span></div>
      ${renderMC(t.nr, cfg, true)}`;
  }
  function spotTap(g) {
    const nr = g.dataset.nr; const t = aufgabenByNr[nr]; const rt = state.runtime[nr];
    const p = INHALTE.karten[t.karte].punkte.find(x => x.id === g.dataset.spot);
    if (!p) return;
    $$(".hs-dot.active", body(nr)).forEach(e => e.classList.remove("active"));
    g.classList.add("active", "visited");
    rt.visited.add(p.id);
    const info = document.getElementById("mapinfo-" + nr);
    const n = Math.min(rt.visited.size, rt.needed);
    info.innerHTML = `<strong>${p.icon} ${esc(p.titel)}</strong><br><span>${esc(p.text)}</span><span class="map-progress" id="mapprog-${nr}">${n}/${rt.needed}</span>`;
    if (rt.visited.size >= rt.needed) { const mc = document.getElementById("mc-" + nr); if (mc && mc.hidden) { mc.hidden = false; showFb(nr, "info", "🗺️ Gut erkundet! Jetzt die Frage beantworten."); } }
  }

  // ─── Freitext mit KI-Korrektur ────────────────────────────────────────
  function renderFreitext(t) {
    const cfg = cfgOf(t);
    return renderTextTask(t.nr, cfg);
  }
  function renderTextTask(nr, cfg, extra) {
    return `
      <p class="task-question">${esc(cfg.aufgabe)}</p>
      ${cfg.starter ? `<div class="starter-row">${cfg.starter.map(s => `<button type="button" class="word-chip starter-chip" data-action="starter" data-nr="${nr}" data-text="${esc(s)}">${esc(s)}</button>`).join("")}</div>` : ""}
      ${cfg.begriffe ? `<p class="hint">Nutze die Begriffe: ${cfg.begriffe.map(b => `<em>${esc(b)}</em>`).join(", ")}</p>` : ""}
      <textarea class="freitext" id="ft-${nr}" data-min="${cfg.min || 60}" rows="${cfg.min > 120 ? 8 : 5}" placeholder="Deine Antwort in ganzen Sätzen …" data-action-input="count" data-nr="${nr}"></textarea>
      <div class="text-meta"><span id="count-${nr}">0 Zeichen · mindestens ${cfg.min || 60}</span></div>
      ${extra || ""}
      <div class="btn-row"><button class="btn btn-ai" type="button" data-action="check-freitext" data-nr="${nr}">🤖 Mit KI prüfen lassen</button></div>
      <p class="hint ki-hint">Das KI-Feedback muss deine Lehrkraft zuerst freigeben. Die KI gibt Hinweise, aber keine Lösungen.</p>`;
  }
  function renderTransfer(t) { return renderTextTask("T", t); }
  function fillTransfer() {
    const ta = document.getElementById("ft-T");
    const saved = state.notizen.abschluss && state.notizen.abschluss.stichpunkte;
    if (ta && saved && !ta.value) { ta.value = saved; updateCount("T"); }
  }
  function updateCount(nr) {
    const ta = document.getElementById("ft-" + nr); const c = document.getElementById("count-" + nr);
    if (!ta || !c) return;
    const min = parseInt(ta.dataset.min, 10) || 60;
    c.textContent = `${ta.value.length} Zeichen · mindestens ${min}`;
    c.classList.toggle("ok", ta.value.length >= min);
  }
  function insertStarter(btn) {
    const ta = document.getElementById("ft-" + btn.dataset.nr);
    if (!ta) return;
    ta.value = ta.value ? ta.value.replace(/\s+$/, "") + " " + btn.dataset.text : btn.dataset.text;
    ta.focus(); updateCount(btn.dataset.nr);
  }

  async function checkFreitext(nr) {
    const t = aufgabenByNr[nr];
    const cfg = t.typ === "transfer" ? t : cfgOf(t);
    const ta = document.getElementById("ft-" + nr);
    const text = (ta ? ta.value : "").trim();
    const min = cfg.min || 60;
    if (text.length < min) { showFb(nr, "err", `⚠️ Bitte schreibe noch etwas mehr (mindestens ${min} Zeichen).`); return; }
    if (nr === "T") saveNotizen("abschluss", { stichpunkte: text });
    const question = `${cfg.aufgabe} (Niveau ${nr === "T" ? "Transfer" : niveauOf(nr)})`;
    kiKorrektur(nr, question, text, t.kontext || "", (data) => {
      const typ = nr === "T" ? "freitext-kreativ" : "freitext";
      sendAntwort(nr, typ, text.slice(0, 220) + " → KI: " + (data.feedback || "").slice(0, 150), data.correct);
      const hint = data.hint ? `<br><span class="ki-hint-text">💡 ${esc(data.hint)}</span>` : "";
      if (data.correct === true) { showFb(nr, "ok", "✅ " + esc(data.feedback) + hint); markComplete(nr); }
      else if (data.correct === false) showFb(nr, "err", "💡 " + esc(data.feedback) + hint + " <br><small>Überarbeite deinen Text und prüfe erneut.</small>");
      else { showFb(nr, "info", "📝 " + esc(data.feedback) + hint); markComplete(nr); }
    });
  }

  async function kiKorrektur(nr, question, answer, context, onResult) {
    const approved = Object.entries(state.approved).find(([, typ]) => typ === "korrektur");
    if (!approved) {
      requestKiAccess("korrektur", `Aufgabe ${nr}`, (aid) => { state.approved[aid] = "korrektur"; kiKorrektur(nr, question, answer, context, onResult); });
      return;
    }
    showFb(nr, "info", "🤖 Deine Antwort wird gerade bewertet …");
    try {
      const data = await postJSON("/api/check-answer", { question, answer, context, anfrage_id: parseInt(approved[0], 10) });
      if (data.blocked) { delete state.approved[approved[0]]; showFb(nr, "err", "🔒 " + esc(data.feedback || "Nicht freigegeben.")); return; }
      onResult(data);
    } catch (e) { showFb(nr, "err", "⚠️ Verbindung zur KI fehlgeschlagen. Versuch es gleich noch einmal."); }
  }

  // ─── Recherche-Notizen ─────────────────────────────────────────────────
  function renderNotizen(t) {
    return `
      <p class="task-question">${esc(t.hinweis)}</p>
      <label class="field-label" for="nt-${t.abschnitt}">Stichpunkte (ein Stichpunkt pro Zeile, in zeitlicher Ordnung)</label>
      <textarea class="freitext notiz" id="nt-${t.abschnitt}" rows="7" placeholder="• 1914: …&#10;• …" data-action-input="notiz" data-abschnitt="${t.abschnitt}" data-nr="${t.nr}"></textarea>
      <label class="field-label" for="nq-${t.abschnitt}">Quelle(n) für diesen Abschnitt (Buch mit Seite, Website mit Adresse …)</label>
      <textarea class="freitext notiz notiz-quelle" id="nq-${t.abschnitt}" rows="2" placeholder="z. B. Geschichtsbuch S. 112–115; bpb.de: Der Erste Weltkrieg" data-action-input="notiz" data-abschnitt="${t.abschnitt}" data-nr="${t.nr}"></textarea>
      <div class="text-meta"><span class="save-state" id="save-${t.abschnitt}">Noch nicht gespeichert</span></div>
      <div class="btn-row">
        <button class="btn btn-primary" type="button" data-action="finish-notizen" data-nr="${t.nr}" data-abschnitt="${t.abschnitt}">✅ Stichpunkte abgeben</button>
        <button class="btn btn-ai" type="button" data-action="check-notizen" data-nr="${t.nr}" data-abschnitt="${t.abschnitt}">🤖 Von der KI prüfen lassen</button>
      </div>
      <p class="hint">Abgabe: mindestens drei Stichpunkte und eine Quelle. Deine Lehrkraft sieht die Stichpunkte live im Dashboard.</p>`;
  }
  function fillNotizen(t) {
    const n = state.notizen[t.abschnitt];
    if (!n) return;
    const s = document.getElementById("nt-" + t.abschnitt), q = document.getElementById("nq-" + t.abschnitt);
    if (s) s.value = n.stichpunkte || "";
    if (q) q.value = n.quellen || "";
    const st = document.getElementById("save-" + t.abschnitt);
    if (st && (n.stichpunkte || n.quellen)) st.textContent = "Gespeichert";
  }
  const saveTimers = {};
  function scheduleNotizSave(abschnitt) {
    const st = document.getElementById("save-" + abschnitt);
    if (st) st.textContent = "Wird gespeichert …";
    clearTimeout(saveTimers[abschnitt]);
    saveTimers[abschnitt] = setTimeout(() => saveNotizen(abschnitt), 1200);
  }
  async function saveNotizen(abschnitt, override) {
    const s = document.getElementById("nt-" + abschnitt), q = document.getElementById("nq-" + abschnitt);
    const current = state.notizen[abschnitt] || { stichpunkte: "", quellen: "" };
    const payload = {
      abschnitt,
      stichpunkte: override && override.stichpunkte !== undefined ? override.stichpunkte : (s ? s.value : current.stichpunkte),
      quellen: override && override.quellen !== undefined ? override.quellen : (q ? q.value : current.quellen),
    };
    state.notizen[abschnitt] = { stichpunkte: payload.stichpunkte, quellen: payload.quellen };
    const st = document.getElementById("save-" + abschnitt);
    try { const r = await postJSON("/api/notizen", payload); if (st) st.textContent = r.ok ? "Gespeichert · " + (r.updated_at || "").slice(11, 16) : "Speichern fehlgeschlagen"; }
    catch (e) { if (st) st.textContent = "Speichern fehlgeschlagen"; }
  }
  function notizLines(text) { return String(text || "").split("\n").map(l => l.replace(/^[\s•\-–*·]+/, "").trim()).filter(l => l.length >= 4); }
  function finishNotizen(nr, abschnitt) {
    const s = document.getElementById("nt-" + abschnitt), q = document.getElementById("nq-" + abschnitt);
    const lines = notizLines(s.value), quellen = notizLines(q.value);
    if (lines.length < 3) { showFb(nr, "err", `⚠️ Du hast erst ${lines.length} Stichpunkt(e). Notiere mindestens drei.`); return; }
    if (quellen.length < 1) { showFb(nr, "err", "⚠️ Trage mindestens eine Quelle ein – das verlangt auch das Original-Arbeitsblatt."); return; }
    saveNotizen(abschnitt);
    sendAntwort(nr, "notizen", `${lines.length} Stichpunkte, ${quellen.length} Quelle(n): ` + lines.join(" | ").slice(0, 250), null);
    showFb(nr, "ok", `✅ ${lines.length} Stichpunkte mit ${quellen.length} Quelle(n) abgegeben. Du kannst sie weiter bearbeiten.`);
    markComplete(nr);
  }
  function checkNotizen(nr, abschnitt) {
    const t = aufgabenByNr[nr];
    const s = document.getElementById("nt-" + abschnitt), q = document.getElementById("nq-" + abschnitt);
    const lines = notizLines(s.value);
    if (lines.length < 2) { showFb(nr, "err", "⚠️ Schreibe zuerst mindestens zwei Stichpunkte."); return; }
    const answer = "Stichpunkte:\n" + lines.map(l => "- " + l).join("\n") + "\nQuellen: " + (q.value.trim() || "keine angegeben");
    kiKorrektur(nr, t.kiFrage, answer, "Recherche-Arbeitsblatt Klasse 9. Bewerte Richtigkeit, Vollständigkeit, zeitliche Ordnung und Quellenangabe.", (data) => {
      sendAntwort(nr, "notizen", lines.join(" | ").slice(0, 200) + " → KI: " + (data.feedback || "").slice(0, 150), data.correct);
      const hint = data.hint ? `<br><span class="ki-hint-text">💡 ${esc(data.hint)}</span>` : "";
      showFb(nr, data.correct === false ? "err" : "info", (data.correct === false ? "💡 " : "📝 ") + esc(data.feedback) + hint);
    });
  }

  // ─── Quellenverzeichnis ────────────────────────────────────────────────
  const QUELLEN_ARTEN = ["Schulbuch", "Website", "Buch / Lexikon", "Dokumentation / Video", "Podcast", "Sonstiges"];
  const QUELLEN_WERT = ["sehr verlässlich", "eher verlässlich", "unsicher"];
  function renderQuellen(t) {
    return `<p class="task-question">${esc(t.hinweis)}</p>
      <div class="quellen-list" id="quellen-${t.nr}"></div>
      <div class="btn-row">
        <button class="btn btn-outline" type="button" data-action="add-quelle" data-nr="${t.nr}">＋ Quelle hinzufügen</button>
        <button class="btn btn-primary" type="button" data-action="save-quellen" data-nr="${t.nr}">✅ Quellenverzeichnis abgeben</button>
      </div>
      <div class="text-meta"><span class="save-state" id="save-abschluss-quellen">Noch nicht gespeichert</span></div>`;
  }
  function quelleRow(nr, q, i) {
    q = q || {};
    return `<div class="quelle-row" data-row="${i}">
      <div class="quelle-grid">
        <label><span>Titel / Autor:in</span><input data-field="titel" value="${esc(q.titel || "")}" placeholder="z. B. Geschichte und Geschehen 9, S. 112"></label>
        <label><span>Adresse / Verlag / Jahr</span><input data-field="ort" value="${esc(q.ort || "")}" placeholder="z. B. bpb.de/… oder Klett 2020"></label>
        <label><span>Art</span><select data-field="art">${QUELLEN_ARTEN.map(a => `<option${q.art === a ? " selected" : ""}>${a}</option>`).join("")}</select></label>
        <label><span>Verlässlichkeit</span><select data-field="wert">${QUELLEN_WERT.map(a => `<option${q.wert === a ? " selected" : ""}>${a}</option>`).join("")}</select></label>
        <label class="span-2"><span>Warum ist die Quelle (nicht) verlässlich?</span><input data-field="grund" value="${esc(q.grund || "")}" placeholder="z. B. staatliche Bildungseinrichtung, Autor genannt, Quellen belegt"></label>
      </div>
      <button class="btn btn-quiet btn-sm" type="button" data-action="remove-quelle" data-nr="${nr}" data-row="${i}">✕ entfernen</button>
    </div>`;
  }
  function readQuellen(nr) {
    return $$(".quelle-row", document.getElementById("quellen-" + nr)).map(row => {
      const o = {}; $$("[data-field]", row).forEach(f => { o[f.dataset.field] = f.value.trim(); }); return o;
    });
  }
  function fillQuellen(t) {
    const host = document.getElementById("quellen-" + t.nr);
    let list = [];
    try { list = JSON.parse((state.notizen.abschluss && state.notizen.abschluss.quellen) || "[]"); } catch (e) { list = []; }
    if (!Array.isArray(list) || !list.length) list = [{}, {}];
    host.innerHTML = list.map((q, i) => quelleRow(t.nr, q, i)).join("");
  }
  function addQuelle(nr) { const host = document.getElementById("quellen-" + nr); host.insertAdjacentHTML("beforeend", quelleRow(nr, {}, host.children.length)); }
  function removeQuelle(nr, row) { const host = document.getElementById("quellen-" + nr); const el = host.querySelector(`.quelle-row[data-row="${row}"]`); if (el && host.children.length > 1) el.remove(); scheduleQuellenSave(nr); }
  function scheduleQuellenSave(nr) {
    clearTimeout(saveTimers.quellen);
    const st = document.getElementById("save-abschluss-quellen"); if (st) st.textContent = "Wird gespeichert …";
    saveTimers.quellen = setTimeout(() => saveQuellen(nr, false), 1200);
  }
  function saveQuellen(nr, abgeben) {
    const list = readQuellen(nr);
    const json = JSON.stringify(list);
    state.notizen.abschluss = { stichpunkte: (state.notizen.abschluss || {}).stichpunkte || "", quellen: json };
    postJSON("/api/notizen", { abschnitt: "abschluss", stichpunkte: state.notizen.abschluss.stichpunkte, quellen: json })
      .then(r => { const st = document.getElementById("save-abschluss-quellen"); if (st) st.textContent = r.ok ? "Gespeichert · " + (r.updated_at || "").slice(11, 16) : "Speichern fehlgeschlagen"; })
      .catch(() => {});
    if (!abgeben) return;
    const valid = list.filter(q => q.titel.length >= 3 && q.ort.length >= 3 && q.grund.length >= 10);
    const t = aufgabenByNr[nr];
    if (valid.length < (t.min || 2)) { showFb(nr, "err", `⚠️ Erst ${valid.length} vollständige Quelle(n). Für jede Quelle brauchst du Titel, Adresse/Verlag und eine Begründung (mindestens ${t.min || 2} Quellen).`); return; }
    sendAntwort(nr, "quellen", valid.map(q => `${q.titel} (${q.art}, ${q.wert})`).join(" | ").slice(0, 300), null);
    showFb(nr, "ok", `✅ ${valid.length} Quellen eingetragen und begründet – so gehört es sich für eine Recherche!`);
    markComplete(nr);
  }

  // ─── KI-Freigabesystem ─────────────────────────────────────────────────
  state.approved = {};          // anfrage_id -> typ
  let pendingTyp = null, pendingCallback = null, pendingId = null;

  function requestKiAccess(typ, kontext, callback) {
    if (state.kiGesperrt) { showToast("🚫 Der KI-Zugang ist gesperrt.", "#dc2626"); return; }
    for (const [id, t] of Object.entries(state.approved)) { if (t === typ) { callback(parseInt(id, 10)); return; } }
    pendingTyp = typ; pendingCallback = callback; pendingId = null; pendingKontext = kontext;
    $("#ki-modal-icon").textContent = typ === "chat" ? "💬" : "✅";
    $("#ki-modal-title").textContent = typ === "chat" ? "KI-Tutor anfragen" : "KI-Feedback anfragen";
    $("#ki-modal-text").textContent = typ === "chat" ? "Der KI-Tutor beantwortet deine Fragen zum Thema. Deine Lehrkraft muss die Nutzung kurz freigeben." : "Die KI gibt dir Rückmeldung zu deinem Text. Deine Lehrkraft muss die Nutzung kurz freigeben.";
    $("#ki-request-confirm").hidden = false; $("#ki-waiting").hidden = true;
    $("#ki-overlay").hidden = false;
  }
  let pendingKontext = "";
  async function sendeAnfrage() {
    $("#ki-request-confirm").hidden = true; $("#ki-waiting").hidden = false;
    try {
      const data = await postJSON("/api/ki-anfrage", { typ: pendingTyp, kontext: pendingKontext || (pendingTyp === "chat" ? "KI-Tutor" : "KI-Feedback") });
      if (data.status === "wartend") { pendingId = data.anfrage_id; return; }
      $("#ki-waiting").innerHTML = "⚠️ " + esc(data.message || "Anfrage nicht möglich.");
      setTimeout(closeKiOverlay, 3000);
    } catch (e) { closeKiOverlay(); }
  }
  function closeKiOverlay() {
    $("#ki-overlay").hidden = true;
    $("#ki-waiting").innerHTML = '<span class="spinner"></span>Warte auf die Lehrkraft …';
    pendingId = null; pendingCallback = null; pendingTyp = null;
  }

  // ─── KI-Tutor (Chat) ───────────────────────────────────────────────────
  function addChatMessage(role, text) {
    const list = $("#chat-messages");
    const div = document.createElement("div");
    div.className = "chat-message " + (role === "assistant" ? "assistant" : "user");
    div.innerHTML = `<strong>${role === "assistant" ? "GSM-Tutor" : "Du"}</strong><p>${esc(text)}</p>`;
    list.appendChild(div); list.scrollTop = list.scrollHeight;
    return div;
  }
  async function sendMessage() {
    const inp = $("#chat-input");
    const text = inp.value.trim();
    if (!text) return;
    if (state.kiGesperrt) { showToast("🚫 Der KI-Zugang ist gesperrt.", "#dc2626"); return; }
    const approved = Object.entries(state.approved).find(([, t]) => t === "chat");
    if (!approved) {
      const tabLabel = (INHALTE.tabs.find(t => t.key === state.activeTab) || {}).label || "Arbeitsblatt";
      requestKiAccess("chat", "Tutor · " + tabLabel, (aid) => { state.approved[aid] = "chat"; sendMessage(); });
      return;   // Text bleibt im Eingabefeld, bis die Freigabe da ist
    }
    inp.value = "";
    addChatMessage("user", text);
    const history = state.chat.slice(-8);
    state.chat.push({ role: "user", content: text });
    const thinking = addChatMessage("assistant", "…");
    try {
      const tabLabel = (INHALTE.tabs.find(t => t.key === state.activeTab) || {}).label || "Arbeitsblatt";
      const data = await postJSON("/api/chat", { message: text, history, kontext: tabLabel, anfrage_id: parseInt(approved[0], 10) });
      if (data.blocked) { delete state.approved[approved[0]]; thinking.querySelector("p").textContent = "🔒 " + (data.message || "Nicht freigegeben."); return; }
      thinking.querySelector("p").textContent = data.response || "Keine Antwort erhalten.";
      state.chat.push({ role: "assistant", content: data.response || "" });
    } catch (e) { thinking.querySelector("p").textContent = "⚠️ Verbindung fehlgeschlagen."; }
  }

  // ─── Socket.IO ─────────────────────────────────────────────────────────
  function setupSocket() {
    if (typeof io === "undefined") return;
    const socket = io({ transports: ["websocket", "polling"] });
    socket.on("connect", () => socket.emit("schueler_join", {}));
    socket.on("ki_entscheidung", d => {
      if (pendingId && d.anfrage_id !== pendingId) return;
      const cb = pendingCallback;
      closeKiOverlay();
      if (d.entscheid === "freigegeben") { state.approved[d.anfrage_id] = d.typ; showToast("✅ Freigegeben – die KI darf jetzt helfen!"); if (cb) cb(d.anfrage_id); }
      else showToast("❌ Die Lehrkraft hat die Anfrage abgelehnt.", "#dc2626");
    });
    socket.on("ki_gesperrt", d => {
      state.kiGesperrt = !!d.gesperrt;
      document.body.classList.toggle("ki-locked", state.kiGesperrt);
      if (state.kiGesperrt) { state.approved = {}; closeKiOverlay(); showToast("🚫 KI-Zugang von der Lehrkraft gesperrt.", "#dc2626"); }
      else if (setupSocket._wasLocked) showToast("✅ KI-Zugang wieder freigegeben!");
      setupSocket._wasLocked = state.kiGesperrt;
    });
    socket.on("sitzung_beendet", d => sessionEnded(d && d.grund));
  }
  function sessionEnded(grund) {
    if (sessionEnded._done) return; sessionEnded._done = true;
    const o = $("#session-overlay"); o.hidden = false;
    $("#session-overlay-text").textContent = grund === "geloescht" ? "Deine Daten wurden von der Lehrkraft gelöscht." : "Die Unterrichtssitzung wurde beendet oder ist abgelaufen.";
    setTimeout(() => { location.href = "/login"; }, 4000);
  }

  // ─── Ereignisse ────────────────────────────────────────────────────────
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const a = el.dataset.action, nr = el.dataset.nr;
    switch (a) {
      case "tab": showTab(el.dataset.tab); break;
      case "mc": handleMC(el); break;
      case "retry": renderBody(aufgabenByNr[nr]); break;
      case "chip": useChip(el); break;
      case "gap-clear": clearGap(el); break;
      case "check-luecke": checkLuecke(nr); break;
      case "reset-luecke": resetLuecke(nr); break;
      case "match-left": matchLeft(el); break;
      case "match-right": matchRight(el); break;
      case "reset-match": resetMatch(nr); break;
      case "sort-item": sortTap(el); break;
      case "check-sort": checkSort(nr); break;
      case "reset-sort": renderBody(aufgabenByNr[nr]); break;
      case "spot": spotTap(el); break;
      case "starter": insertStarter(el); break;
      case "check-freitext": checkFreitext(nr); break;
      case "finish-notizen": finishNotizen(nr, el.dataset.abschnitt); break;
      case "check-notizen": checkNotizen(nr, el.dataset.abschnitt); break;
      case "add-quelle": addQuelle(nr); break;
      case "remove-quelle": removeQuelle(nr, el.dataset.row); break;
      case "save-quellen": saveQuellen(nr, true); break;
      case "tutor-toggle": toggleTutor(); break;
      case "tutor-close": toggleTutor(false); break;
      case "chat-send": sendMessage(); break;
      case "ki-confirm": sendeAnfrage(); break;
      case "ki-cancel": closeKiOverlay(); break;
      case "reader": openReader(el.dataset.src); break;
      case "reader-close": $("#reader").hidden = true; document.body.classList.remove("no-scroll"); break;
      default: break;
    }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Enter" && e.target.id === "chat-input") { e.preventDefault(); sendMessage(); }
    if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("hs-dot")) { e.preventDefault(); spotTap(e.target); }
  });
  document.addEventListener("change", e => {
    if (e.target.dataset.action === "niveau") {
      const nr = e.target.dataset.nr; state.niveau[nr] = e.target.value; renderBody(aufgabenByNr[nr]);
      const c = card(nr); if (c) c.dataset.niveau = e.target.value;
    }
    if (e.target.closest(".quelle-row")) scheduleQuellenSave(e.target.closest(".quellen-list").id.replace("quellen-", ""));
  });
  document.addEventListener("input", e => {
    const t = e.target;
    if (t.dataset.actionInput === "count") updateCount(t.dataset.nr);
    if (t.dataset.actionInput === "notiz") scheduleNotizSave(t.dataset.abschnitt);
    if (t.id === "ft-T") { clearTimeout(saveTimers.transfer); saveTimers.transfer = setTimeout(() => saveNotizen("abschluss", { stichpunkte: t.value }), 1500); }
    if (t.closest(".quelle-row")) scheduleQuellenSave(t.closest(".quellen-list").id.replace("quellen-", ""));
  });

  function toggleTutor(force) {
    const panel = $("#tutor-panel"); const open = force === undefined ? panel.hidden : force;
    panel.hidden = !open; $("#tutor-toggle").setAttribute("aria-expanded", open);
    if (open) setTimeout(() => $("#chat-input").focus(), 50);
  }
  function openReader(src) {
    $("#reader-img").src = src; $("#reader").hidden = false; document.body.classList.add("no-scroll");
  }

  // ─── Start ─────────────────────────────────────────────────────────────
  async function restore() {
    try {
      const res = await fetch("/api/status"); if (res.status === 401) { location.href = "/login"; return; }
      const data = await res.json();
      state.notizen = data.notizen || {};
      state.kiGesperrt = !!data.ki_gesperrt; document.body.classList.toggle("ki-locked", state.kiGesperrt);
      state.kiKonfiguriert = data.ki_konfiguriert !== false;
      if (!state.kiKonfiguriert) $("#tutor-note").textContent = "KI ist noch nicht konfiguriert – Aufgaben funktionieren trotzdem.";
      (data.erledigt || []).forEach(x => { state.completed.add(String(x.nr)); if (x.niveau && x.niveau !== "Transfer") state.niveau[x.nr] = state.niveau[x.nr] || x.niveau; });
    } catch (e) { /* offline: lokal weiterarbeiten */ }
  }

  async function init() {
    buildNav();
    await restore();
    buildPanels();
    state.completed.forEach(nr => { const c = card(nr); if (c) { c.classList.add("is-done"); const b = $(".done-badge", c); if (b) b.hidden = false; } });
    $$(".niveau-select").forEach(s => { if (state.niveau[s.dataset.nr]) s.value = state.niveau[s.dataset.nr]; });
    updateProgress();
    setupSocket();
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (isIOS) document.body.classList.add("is-ios");
  }
  document.addEventListener("DOMContentLoaded", init);
})();
