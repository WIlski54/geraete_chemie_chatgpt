'use strict';

const META = window.WORKSHEET_META || {};
const TOTAL_STATIONS = 7;
const completedTasks = new Set();
let activeTab = 'material';
let quizIndex = 0;
let quizScore = 0;
let quizRound = 1;
let drawingIndex = 0;
let pendingAi = null;
const approvedRequests = {};
const chatHistory = [];
let toastTimer = null;
let objectDrawingCanvas = null;
let drawingClipboard = null;
let drawingShapeDraft = null;
let drawingShapeStart = null;
let drawingShapeMoved = false;
let activeDrawingTool = 'select';
let drawingDirty = false;
let drawingLoading = false;
const savedDrawingLibrary = new Map();
let drawingLibraryReady = Promise.resolve();
let classroomSocket = null;

const AUTOSAVE_DB_NAME = `gsm-iab-autosave-${META.appId || 'worksheet'}`;
const AUTOSAVE_STORE = 'workspaces';
const AUTOSAVE_KEY = META.studentId || 'anonymous';
const RESUME_STORAGE_KEY = `gsm-iab-resume:${META.appId || 'worksheet'}`;
let autosaveRevision = 0;
let autosaveDirty = false;
let autosaveReady = false;
let autosaveApplying = false;
let autosaveTimer = null;
let autosaveLocalTimer = null;
let drawingAutosaveTimer = null;
let autosaveInFlight = Promise.resolve();

const SOURCE_IMAGE = '/static/material/laborgeraete_uebersicht_1.png';
const sourceImage = new Image();
sourceImage.src = SOURCE_IMAGE;
const deviceImageCache = new Map();

// Freigestellte Einzelbilder aus static/img/Geräte. Die Originalübersicht bleibt
// als Materialblatt verfügbar und dient nur noch als technische Rückfallebene.
const DEVICES = [
  {name: 'Reagenzglas', aliases: ['Reagenzglas', 'Reagenzgläser', 'Reaktionsglas'], asset: '/static/img/Geräte/Reagenzgläser.png'},
  {name: 'Gasbrenner', aliases: ['Gasbrenner', 'Bunsenbrenner', 'Brenner'], asset: '/static/img/Geräte/Gasbrenner.png'},
  {name: 'Becherglas', aliases: ['Becherglas'], asset: '/static/img/Geräte/Becherglas.png'},
  {name: 'Messzylinder', aliases: ['Messzylinder'], asset: '/static/img/Geräte/Messzylinder.png'},
  {name: 'Erlenmeyerkolben', aliases: ['Erlenmeyerkolben', 'Erlenmeyer-Kolben', 'Erlenmeyer'], asset: '/static/img/Geräte/Erlenmeyerkolben.png'},
  {name: 'Spritzflasche', aliases: ['Spritzflasche', 'Waschflasche'], asset: '/static/img/Geräte/Spritzflasche.png'},
  {name: 'Mörser', aliases: ['Mörser', 'Reibschale', 'Reibschale mit Pistill'], asset: '/static/img/Geräte/Mörser.png'},
  {name: 'Uhrglas', aliases: ['Uhrglas'], asset: '/static/img/Geräte/Urglas.png'},
  {name: 'Spatel', aliases: ['Spatel', 'Löffelspatel'], asset: '/static/img/Geräte/Spatel.png'},
  {name: 'Pipette', aliases: ['Pipette', 'Messpipette'], asset: '/static/img/Geräte/Pipette.png'},
  {name: 'Dreifuß', aliases: ['Dreifuß', 'Dreifuss'], asset: '/static/img/Geräte/Dreifuss.png'},
  {name: 'Reagenzglasgestell', aliases: ['Reagenzglasgestell', 'Reagenzglasständer'], asset: '/static/img/Geräte/Reagenzglasgestell.png'},
];

const DRAWING_DEVICES = ['Becherglas', 'Reagenzglas', 'Erlenmeyerkolben', 'Messzylinder', 'Spritzflasche', 'Mörser', 'Gasbrenner', 'Dreifuß'];

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initTaskLevels();
  initChoices();
  initTaskSaving();
  initReader();
  initQuiz();
  initDrawingCanvases();
  initDrawingLab();
  initDomino();
  initBackup();
  initTutor();
  initAiApproval();
  initSocket();
  updateProgress();
  initAutomaticSaving();
});

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(button => {
    button.addEventListener('click', () => switchTab(button.dataset.tab));
  });
}

function switchTab(name) {
  const target = document.querySelector(`[data-panel="${name}"]`);
  if (!target) return;
  activeTab = name;
  document.querySelectorAll('.tab-btn').forEach(button => {
    const isActive = button.dataset.tab === name;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    const isActive = panel.dataset.panel === name;
    panel.hidden = !isActive;
    panel.classList.toggle('active', isActive);
  });
  window.scrollTo({top: 0, behavior: 'smooth'});
  markAutomaticSaveDirty();
}

function initTaskLevels() {
  document.querySelectorAll('.task-card .niveau-select').forEach(select => {
    select.addEventListener('change', () => setTaskNiveau(select));
  });
}

function setTaskNiveau(select) {
  const card = select.closest('.task-card');
  card.dataset.niveau = select.value;
  card.querySelectorAll('[data-n]').forEach(section => {
    section.hidden = section.dataset.n !== select.value;
  });
}

function initChoices() {
  document.querySelectorAll('[data-choice-group]').forEach(group => {
    group.querySelectorAll('.choice-btn').forEach(button => {
      button.addEventListener('click', () => {
        group.querySelectorAll('.choice-btn').forEach(item => item.classList.remove('selected', 'correct', 'incorrect'));
        button.classList.add('selected');
      });
    });
  });
}

function initTaskSaving() {
  document.querySelectorAll('.save-task').forEach(button => {
    button.addEventListener('click', async () => {
      const task = button.dataset.task;
      const card = button.closest('.task-card');
      const payload = serializeTask(card);
      const feedback = document.getElementById(`feedback-task${task}`);
      if (!payload.answer.trim()) {
        showFeedback(feedback, 'error', 'Bitte bearbeite die Aufgabe zuerst.');
        return;
      }
      let correct = null;
      const selected = card.querySelector(`[data-n="${card.dataset.niveau}"] .choice-btn.selected`);
      if (selected) {
        correct = selected.dataset.correct === 'true';
        selected.classList.add(correct ? 'correct' : 'incorrect');
      }
      await sendAnswer(task, payload.type, payload.answer, correct, card.dataset.niveau);
      markComplete(task);
      if (correct === true) {
        showFeedback(feedback, 'ok', 'Deine Antwort war richtig! Sie wurde gespeichert und ist für deine Lehrkraft im Dashboard sichtbar.');
      } else if (correct === false) {
        showFeedback(feedback, 'error', 'Deine Antwort war noch nicht richtig. Nutze die Geräteübersicht und versuche es erneut.');
      } else {
        showFeedback(feedback, 'ok', 'Antwort gespeichert. Deine Lehrkraft kann sie im Dashboard sehen.');
      }
    });
  });
  document.querySelectorAll('.ai-text-feedback').forEach(button => {
    button.addEventListener('click', () => checkTextWithAi(button.dataset.task));
  });
}

function serializeTask(card) {
  const level = card.dataset.niveau;
  const section = card.querySelector(`[data-n="${level}"]`);
  const selected = section.querySelector('.choice-btn.selected');
  if (selected) return {answer: selected.dataset.value || selected.textContent.trim(), type: 'auswahl'};
  const fields = [...section.querySelectorAll('textarea, input, select')];
  const answer = fields.map(field => {
    const label = field.closest('label')?.childNodes[0]?.textContent?.trim();
    return `${label ? `${label}: ` : ''}${field.value.trim()}`;
  }).filter(line => !line.endsWith(': ') && line.trim()).join('\n');
  return {answer, type: fields.some(field => field.hasAttribute('data-structured')) ? 'strukturiert' : 'freitext'};
}

async function checkTextWithAi(task) {
  const card = document.querySelector(`[data-task-num="${task}"]`);
  const payload = serializeTask(card);
  const feedback = document.getElementById(`feedback-task${task}`);
  if (payload.answer.length < 20) {
    showFeedback(feedback, 'error', 'Schreibe zuerst mindestens einen vollständigen Satz.');
    return;
  }
  requestAiAccess('korrektur', `Aufgabe ${task}: ${payload.answer.slice(0, 120)}`, async requestId => {
    showFeedback(feedback, 'info', 'Die KI liest deine Antwort …');
    const response = await fetch('/api/check-answer', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        anfrage_id: requestId,
        question: 'Wähle für eine Stoffprobe eine sichere und sinnvolle Gerätekette und begründe sie.',
        answer: payload.answer,
        context: 'Chemie Klasse 7, Erstbegegnung mit Laborgeräten.'
      })
    });
    const result = await response.json();
    if (result.blocked) return showFeedback(feedback, 'error', 'Die KI-Nutzung ist noch nicht freigegeben.');
    const message = `${result.feedback || 'Keine Rückmeldung.'}${result.hint ? ` Tipp: ${result.hint}` : ''}`;
    showFeedback(feedback, result.correct === false ? 'error' : 'info', message);
    await sendAnswer(task, 'freitext-ki', `${payload.answer}\nKI: ${message}`, result.correct, card.dataset.niveau);
    if (result.correct !== false) markComplete(task);
  });
}

async function sendAnswer(task, type, answer, correct = null, level = null) {
  const card = document.querySelector(`[data-task-num="${task}"]`);
  const niveau = level || card?.dataset.niveau || 'Transfer';
  try {
    await fetch('/api/antwort', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({aufgabe: task, niveau, typ: type, antwort: String(answer).slice(0, 1900), korrekt: correct})
    });
  } catch (_) {
    showToast('Die Antwort ist lokal erhalten, aber der Server war nicht erreichbar.', 'error');
  }
}

function markComplete(task) {
  const key = String(task);
  if (completedTasks.has(key)) return;
  completedTasks.add(key);
  updateProgress();
  markAutomaticSaveDirty();
  fetch('/api/fortschritt', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({aufgabe: key, niveau: document.querySelector(`[data-task-num="${key}"]`)?.dataset.niveau || 'Praxis'})
  }).catch(() => {});
}

function updateProgress() {
  const count = Math.min(TOTAL_STATIONS, completedTasks.size);
  document.getElementById('progress-label').textContent = `${count} von ${TOTAL_STATIONS} Lernstationen`;
  document.getElementById('progress-fill').style.width = `${(count / TOTAL_STATIONS) * 100}%`;
}

function showFeedback(element, type, message) {
  if (!element) return;
  element.className = `feedback-box show feedback-${type}`;
  element.textContent = message;
}

function showToast(message, type = 'ok') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.background = type === 'error' ? '#c62f3b' : type === 'info' ? '#006AB3' : '#168548';
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

function initReader() {
  const reader = document.getElementById('worksheet-reader');
  const pageContainer = document.getElementById('reader-image-pages');
  const pdfObject = document.getElementById('reader-pdf-object');
  const title = document.getElementById('reader-title');
  const pdfLink = document.getElementById('reader-open-pdf');
  const imageMode = document.getElementById('reader-image-mode');
  const pdfMode = document.getElementById('reader-pdf-mode');
  let returnFocus = null;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) {
    pdfMode.hidden = true;
    pdfLink.textContent = 'PDF auf dem iPad öffnen';
  }

  function setMode(mode) {
    if (mode === 'pdf' && isIOS) mode = 'image';
    document.getElementById('reader-image-view').classList.toggle('active', mode === 'image');
    document.getElementById('reader-pdf-view').classList.toggle('active', mode === 'pdf');
    imageMode.classList.toggle('active', mode === 'image');
    pdfMode.classList.toggle('active', mode === 'pdf');
    imageMode.setAttribute('aria-pressed', String(mode === 'image'));
    pdfMode.setAttribute('aria-pressed', String(mode === 'pdf'));
  }

  document.querySelectorAll('.open-reader').forEach(button => {
    button.addEventListener('click', () => {
      returnFocus = button;
      title.textContent = button.dataset.readerTitle;
      pageContainer.replaceChildren();
      let pages = [];
      try { pages = JSON.parse(button.dataset.readerPages || '[]'); } catch (_) { pages = []; }
      pages.forEach((src, index) => {
        const image = document.createElement('img');
        image.className = 'reader-page-image';
        image.src = src;
        image.alt = `${button.dataset.readerTitle}, Seite ${index + 1}`;
        pageContainer.appendChild(image);
      });
      pdfObject.data = button.dataset.readerPdf;
      pdfLink.href = button.dataset.readerPdf;
      reader.classList.add('open');
      reader.setAttribute('aria-hidden', 'false');
      document.body.classList.add('reader-open');
      setMode('image');
      document.getElementById('reader-close').focus();
      markComplete('M');
    });
  });

  function closeReader() {
    reader.classList.remove('open');
    reader.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('reader-open');
    pdfObject.data = '';
    pageContainer.replaceChildren();
    returnFocus?.focus();
  }
  imageMode.addEventListener('click', () => setMode('image'));
  pdfMode.addEventListener('click', () => setMode('pdf'));
  document.getElementById('reader-close').addEventListener('click', closeReader);
  document.getElementById('reader-close-bottom').addEventListener('click', closeReader);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && reader.classList.contains('open')) closeReader();
  });
  document.querySelectorAll('.material-disclosure').forEach(disclosure => {
    disclosure.addEventListener('toggle', () => {
      if (!disclosure.open) return;
      document.querySelectorAll('.material-disclosure').forEach(other => {
        if (other !== disclosure) other.open = false;
      });
    });
  });
}

function renderDevice(canvas, device, background = '#ffffff') {
  const context = canvas.getContext('2d');
  const renderToken = `${device.name}-${Date.now()}-${Math.random()}`;
  canvas.dataset.renderToken = renderToken;
  const prepareCanvas = () => {
    context.save();
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();
  };
  const drawAsset = image => {
    if (canvas.dataset.renderToken !== renderToken) return;
    prepareCanvas();
    const sw = image.naturalWidth;
    const sh = image.naturalHeight;
    const scale = Math.min((canvas.width * .78) / sw, (canvas.height * .78) / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
    context.restore();
  };
  const drawCropFallback = () => {
    if (!device.crop || canvas.dataset.renderToken !== renderToken) return;
    const [sx, sy, sw, sh] = device.crop;
    prepareCanvas();
    const scale = Math.min((canvas.width * .78) / sw, (canvas.height * .78) / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    context.drawImage(sourceImage, sx, sy, sw, sh, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
  };
  prepareCanvas();
  if (device.asset) {
    let image = deviceImageCache.get(device.asset);
    if (!image) {
      image = new Image();
      image.decoding = 'async';
      image.src = device.asset;
      deviceImageCache.set(device.asset, image);
    }
    if (image.complete && image.naturalWidth) drawAsset(image);
    else {
      image.addEventListener('load', () => drawAsset(image), {once: true});
      image.addEventListener('error', drawCropFallback, {once: true});
    }
    return;
  }
  if (sourceImage.complete && sourceImage.naturalWidth) drawCropFallback();
  else sourceImage.addEventListener('load', drawCropFallback, {once: true});
}

function initQuiz() {
  quizIndex = Math.floor(Math.random() * DEVICES.length);
  renderQuiz();
  document.getElementById('quiz-next').addEventListener('click', nextQuizDevice);
  document.getElementById('quiz-check').addEventListener('click', checkTypedQuiz);
  document.getElementById('quiz-answer').addEventListener('keydown', event => {
    if (event.key === 'Enter') checkTypedQuiz();
  });
  document.querySelectorAll('[data-quiz-mode]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-quiz-mode]').forEach(item => item.classList.toggle('active', item === button));
      document.getElementById('quiz-typing-mode').hidden = button.dataset.quizMode !== 'typing';
      document.getElementById('quiz-handwriting-mode').hidden = button.dataset.quizMode !== 'handwriting';
    });
  });
  document.getElementById('handwriting-check').addEventListener('click', checkHandwriting);
}

function renderQuiz() {
  renderDevice(document.getElementById('device-quiz-canvas'), DEVICES[quizIndex]);
  document.getElementById('quiz-counter').textContent = `Runde ${quizRound}`;
  document.getElementById('quiz-answer').value = '';
  document.getElementById('quiz-feedback').className = 'feedback-box';
  clearDrawingCanvas(document.getElementById('handwriting-canvas'));
}

function nextQuizDevice() {
  let next = quizIndex;
  while (next === quizIndex) next = Math.floor(Math.random() * DEVICES.length);
  quizIndex = next;
  quizRound += 1;
  renderQuiz();
}

function normalizeName(value) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]/g, '');
}

function checkTypedQuiz() {
  const answer = document.getElementById('quiz-answer').value.trim();
  const device = DEVICES[quizIndex];
  const correct = device.aliases.some(alias => normalizeName(alias) === normalizeName(answer));
  if (!answer) return showFeedback(document.getElementById('quiz-feedback'), 'error', 'Gib zuerst einen Gerätenamen ein.');
  if (correct) {
    quizScore += 1;
    document.getElementById('quiz-score').textContent = quizScore;
    showFeedback(document.getElementById('quiz-feedback'), 'ok', `Richtig: Das ist ein ${device.name}.`);
    markComplete('Q');
  } else {
    showFeedback(document.getElementById('quiz-feedback'), 'error', `Noch nicht. Vergleiche Form, Öffnung und Standfläche mit der Übersicht.`);
  }
  sendAnswer('Q', 'geraet-benennen', `${answer} (gesucht: ${device.name})`, correct, 'Praxis');
}

async function checkHandwriting() {
  const canvas = document.getElementById('handwriting-canvas');
  const expected = DEVICES[quizIndex].name;
  requestAiAccess('handschrift', `Handschrift lesen: Gerätename ${expected}`, async requestId => {
    showFeedback(document.getElementById('quiz-feedback'), 'info', 'Die KI liest deine Handschrift …');
    const response = await fetch('/api/check-drawing', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({anfrage_id: requestId, request_type: 'handschrift', expected, image: canvas.toDataURL('image/png')})
    });
    const result = await response.json();
    if (result.blocked) return showFeedback(document.getElementById('quiz-feedback'), 'error', 'Noch nicht freigegeben.');
    const recognized = result.recognized ? ` Gelesen: „${result.recognized}“.` : '';
    showFeedback(document.getElementById('quiz-feedback'), result.correct === false ? 'error' : 'info', `${result.feedback || ''}${recognized}${result.hint ? ` Tipp: ${result.hint}` : ''}`);
    sendAnswer('Q', 'handschrift-ki', `${recognized} Gesucht: ${expected}. ${result.feedback || ''}`, result.correct, 'Praxis');
    if (result.correct) {
      quizScore += 1;
      document.getElementById('quiz-score').textContent = quizScore;
      markComplete('Q');
    }
  });
}

const drawingState = new Map();

function initDrawingCanvases() {
  document.querySelectorAll('.draw-canvas').forEach(canvas => setupDrawingCanvas(canvas));
  document.querySelectorAll('.clear-canvas').forEach(button => {
    button.addEventListener('click', () => clearDrawingCanvas(document.getElementById(button.dataset.canvas)));
  });
}

function setupDrawingCanvas(canvas) {
  const context = canvas.getContext('2d');
  clearDrawingCanvas(canvas);
  const state = {drawing: false, lastX: 0, lastY: 0};
  drawingState.set(canvas.id, state);

  const point = event => {
    const rect = canvas.getBoundingClientRect();
    return {x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height};
  };
  canvas.addEventListener('pointerdown', event => {
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    const p = point(event);
    state.drawing = true; state.lastX = p.x; state.lastY = p.y;
  });
  canvas.addEventListener('pointermove', event => {
    if (!state.drawing) return;
    event.preventDefault();
    const p = point(event);
    context.beginPath();
    context.moveTo(state.lastX, state.lastY);
    context.lineTo(p.x, p.y);
    context.strokeStyle = canvas.id === 'drawing-canvas' ? (document.querySelector('.tool-btn.active')?.dataset.color || '#17212b') : '#17212b';
    context.lineWidth = canvas.id === 'drawing-canvas' ? Number(document.getElementById('brush-size').value) : 7;
    context.lineCap = 'round'; context.lineJoin = 'round'; context.stroke();
    state.lastX = p.x; state.lastY = p.y;
    markAutomaticSaveDirty();
  });
  const stop = () => { state.drawing = false; };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
}

function clearDrawingCanvas(canvas) {
  if (!canvas) return;
  const context = canvas.getContext('2d');
  context.save();
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.restore();
}

function initDrawingLab() {
  const feedback = document.getElementById('drawing-feedback');
  if (!window.fabric?.Canvas) {
    showFeedback(feedback, 'error', 'Der Objekteditor konnte nicht geladen werden. Bitte die Seite neu laden.');
    document.querySelectorAll('[data-drawing-tool], #save-drawing, #analyze-drawing').forEach(button => { button.disabled = true; });
    return;
  }

  fabric.Object.prototype.transparentCorners = false;
  fabric.Object.prototype.cornerColor = '#006AB3';
  fabric.Object.prototype.cornerStyle = 'circle';
  fabric.Object.prototype.borderColor = '#F7B800';
  objectDrawingCanvas = new fabric.Canvas('drawing-canvas', {
    backgroundColor: '#ffffff',
    preserveObjectStacking: true,
    selection: true,
    fireRightClick: false,
    stopContextMenu: true,
  });
  objectDrawingCanvas.freeDrawingBrush = new fabric.PencilBrush(objectDrawingCanvas);
  updateDrawingBrush();
  objectDrawingCanvas.on('object:added', markDrawingDirty);
  objectDrawingCanvas.on('object:modified', markDrawingDirty);
  objectDrawingCanvas.on('object:removed', markDrawingDirty);
  objectDrawingCanvas.on('path:created', markDrawingDirty);
  objectDrawingCanvas.on('mouse:down', handleDrawingPointerDown);
  objectDrawingCanvas.on('mouse:move', handleDrawingPointerMove);
  objectDrawingCanvas.on('mouse:up', handleDrawingPointerUp);
  objectDrawingCanvas.on('selection:created', updateDrawingObjectActions);
  objectDrawingCanvas.on('selection:updated', updateDrawingObjectActions);
  objectDrawingCanvas.on('selection:cleared', updateDrawingObjectActions);

  document.querySelectorAll('[data-drawing-tool]').forEach(button => {
    button.addEventListener('click', () => setDrawingTool(button.dataset.drawingTool));
  });
  document.querySelectorAll('[data-drawing-color]').forEach(button => {
    button.addEventListener('click', () => setDrawingColor(button.dataset.drawingColor));
  });
  document.getElementById('drawing-color').addEventListener('input', event => {
    setDrawingColor(event.target.value);
  });
  document.getElementById('brush-size').addEventListener('input', () => {
    document.getElementById('brush-size-value').value = document.getElementById('brush-size').value;
    updateDrawingBrush();
    applyStrokeWidthToSelection();
  });
  document.getElementById('copy-selected').addEventListener('click', copySelectedDrawingObjects);
  document.getElementById('paste-drawing').addEventListener('click', pasteDrawingObjects);
  document.getElementById('delete-selected').addEventListener('click', deleteSelectedDrawingObjects);
  document.getElementById('clear-drawing').addEventListener('click', () => clearObjectDrawing(true));
  document.addEventListener('keydown', event => {
    if (!drawingKeyboardShortcutAllowed()) return;
    const key = event.key.toLowerCase();
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && key === 'c' && objectDrawingCanvas?.getActiveObject()) {
      event.preventDefault();
      copySelectedDrawingObjects();
      return;
    }
    if (modifier && key === 'v' && drawingClipboard) {
      event.preventDefault();
      pasteDrawingObjects();
      return;
    }
    if (['delete', 'backspace'].includes(key) && objectDrawingCanvas?.getActiveObject()) {
      event.preventDefault();
      deleteSelectedDrawingObjects();
    }
  });

  drawingIndex = Math.floor(Math.random() * DRAWING_DEVICES.length);
  updateDrawingPrompt();
  setDrawingTool('select');
  updateDrawingObjectActions();
  drawingLibraryReady = loadStudentDrawingLibrary();
  document.getElementById('drawing-next').addEventListener('click', async () => {
    await flushDrawingAutosave();
    await flushAutomaticSave();
    drawingIndex = (drawingIndex + 1 + Math.floor(Math.random() * (DRAWING_DEVICES.length - 1))) % DRAWING_DEVICES.length;
    updateDrawingPrompt();
    await loadDrawingForCurrentDevice();
    document.getElementById('drawing-feedback').className = 'feedback-box';
  });
  document.getElementById('save-drawing').addEventListener('click', async () => {
    if (!await saveObjectDrawing()) return;
    await sendAnswer('Z', 'zeichnung', `Objektzeichnung gespeichert: ${DRAWING_DEVICES[drawingIndex]}`, null, 'Praxis');
    markComplete('Z');
    showFeedback(feedback, 'ok', 'Zeichnung mit allen editierbaren Objekten gespeichert. Die Lehrkraft kann sie in deiner Detailansicht und in Sitzungssicherungen sehen.');
  });
  document.getElementById('analyze-drawing').addEventListener('click', analyzeDrawing);
}

function setDrawingTool(tool) {
  if (!objectDrawingCanvas) return;
  activeDrawingTool = tool;
  document.querySelectorAll('[data-drawing-tool]').forEach(button => {
    const active = button.dataset.drawingTool === tool;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  objectDrawingCanvas.isDrawingMode = tool === 'pencil';
  objectDrawingCanvas.selection = tool === 'select';
  objectDrawingCanvas.defaultCursor = tool === 'eraser' ? 'not-allowed' : tool === 'select' ? 'default' : 'crosshair';
  objectDrawingCanvas.forEachObject(object => {
    object.selectable = tool === 'select';
    object.evented = tool === 'select' || tool === 'eraser';
  });
  if (tool !== 'select') objectDrawingCanvas.discardActiveObject();
  updateDrawingBrush();
  objectDrawingCanvas.requestRenderAll();
  const help = {
    select: 'Objekte antippen, verschieben, drehen oder an den Griffen skalieren.',
    pencil: 'Mit Finger, Maus oder Stift frei zeichnen. Jeder Strich bleibt ein eigenes Objekt.',
    eraser: 'Tippe auf ein Objekt, um genau dieses Objekt zu entfernen.',
    line: 'Setze Maus, Finger oder Pencil an und ziehe die Linie bei gedrückter Taste beziehungsweise Berührung auf.',
    rect: 'Setze an einer Ecke an und ziehe das Rechteck bis zur gegenüberliegenden Ecke auf.',
    ellipse: 'Setze am Rand an und ziehe die Ellipse auf die gewünschte Größe.',
    text: 'Tippe auf die Zeichenfläche und schreibe direkt in das Textobjekt.',
  };
  document.getElementById('drawing-tool-help').textContent = help[tool] || help.select;
}

function updateDrawingBrush() {
  if (!objectDrawingCanvas?.freeDrawingBrush) return;
  objectDrawingCanvas.freeDrawingBrush.color = document.getElementById('drawing-color').value;
  objectDrawingCanvas.freeDrawingBrush.width = Number(document.getElementById('brush-size').value);
}

function setDrawingColor(color) {
  const input = document.getElementById('drawing-color');
  if (!input || !/^#[0-9a-f]{6}$/i.test(color || '')) return;
  input.value = color.toLowerCase();
  document.querySelector('.color-wheel-ring')?.style.setProperty('--current-color', input.value);
  document.querySelectorAll('[data-drawing-color]').forEach(button => {
    const active = button.dataset.drawingColor.toLowerCase() === input.value;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  applyDrawingColor();
}

function handleDrawingPointerDown(options) {
  if (!objectDrawingCanvas || drawingLoading) return;
  if (activeDrawingTool === 'eraser') {
    if (options.target) objectDrawingCanvas.remove(options.target);
    return;
  }
  const point = objectDrawingCanvas.getPointer(options.e);
  const color = document.getElementById('drawing-color').value;
  const width = Number(document.getElementById('brush-size').value);
  if (activeDrawingTool === 'text') {
    const textObject = new fabric.IText('Text', {left: point.x, top: point.y, fill: color, fontSize: 34, fontFamily: 'Arial', originX: 'center', originY: 'center'});
    objectDrawingCanvas.add(textObject);
    setDrawingTool('select');
    objectDrawingCanvas.setActiveObject(textObject);
    objectDrawingCanvas.requestRenderAll();
    textObject.enterEditing();
    textObject.selectAll();
    return;
  }
  if (!['line', 'rect', 'ellipse'].includes(activeDrawingTool)) return;
  drawingShapeStart = point;
  drawingShapeMoved = false;
  const common = {stroke: color, strokeWidth: width, strokeLineCap: 'round', fill: 'rgba(255,255,255,0)', selectable: false, evented: false};
  if (activeDrawingTool === 'line') drawingShapeDraft = new fabric.Line([point.x, point.y, point.x, point.y], common);
  if (activeDrawingTool === 'rect') drawingShapeDraft = new fabric.Rect({...common, left: point.x, top: point.y, width: 1, height: 1, rx: 4, ry: 4});
  if (activeDrawingTool === 'ellipse') drawingShapeDraft = new fabric.Ellipse({...common, left: point.x, top: point.y, rx: .5, ry: .5});
  drawingLoading = true;
  objectDrawingCanvas.add(drawingShapeDraft);
  drawingLoading = false;
  objectDrawingCanvas.requestRenderAll();
}

function handleDrawingPointerMove(options) {
  if (!objectDrawingCanvas || !drawingShapeDraft || !drawingShapeStart) return;
  const point = objectDrawingCanvas.getPointer(options.e);
  const deltaX = point.x - drawingShapeStart.x;
  const deltaY = point.y - drawingShapeStart.y;
  drawingShapeMoved ||= Math.hypot(deltaX, deltaY) >= 4;
  if (drawingShapeDraft.type === 'line') {
    drawingShapeDraft.set({x2: point.x, y2: point.y});
  } else if (drawingShapeDraft.type === 'rect') {
    drawingShapeDraft.set({
      left: Math.min(drawingShapeStart.x, point.x),
      top: Math.min(drawingShapeStart.y, point.y),
      width: Math.max(Math.abs(deltaX), 1),
      height: Math.max(Math.abs(deltaY), 1),
    });
  } else if (drawingShapeDraft.type === 'ellipse') {
    drawingShapeDraft.set({
      left: Math.min(drawingShapeStart.x, point.x),
      top: Math.min(drawingShapeStart.y, point.y),
      rx: Math.max(Math.abs(deltaX) / 2, .5),
      ry: Math.max(Math.abs(deltaY) / 2, .5),
    });
  }
  drawingShapeDraft.setCoords();
  objectDrawingCanvas.requestRenderAll();
}

function handleDrawingPointerUp() {
  if (!objectDrawingCanvas || !drawingShapeDraft) return;
  const finishedShape = drawingShapeDraft;
  drawingShapeDraft = null;
  drawingShapeStart = null;
  const lineLength = finishedShape.type === 'line' ? Math.hypot(finishedShape.x2 - finishedShape.x1, finishedShape.y2 - finishedShape.y1) : 0;
  const shapeLargeEnough = finishedShape.type === 'line' ? lineLength >= 8 : finishedShape.getScaledWidth() >= 8 && finishedShape.getScaledHeight() >= 8;
  if (!drawingShapeMoved || !shapeLargeEnough) {
    drawingShapeMoved = false;
    drawingLoading = true;
    objectDrawingCanvas.remove(finishedShape);
    drawingLoading = false;
    objectDrawingCanvas.requestRenderAll();
    updateDrawingObjectActions();
    showToast('Ziehe die Form etwas größer auf.', 'error');
    return;
  }
  drawingShapeMoved = false;
  finishedShape.setCoords();
  setDrawingTool('select');
  objectDrawingCanvas.setActiveObject(finishedShape);
  objectDrawingCanvas.requestRenderAll();
  markDrawingDirty();
  updateDrawingObjectActions();
}

function selectedDrawingObjects() {
  const active = objectDrawingCanvas?.getActiveObject();
  if (!active) return [];
  return active.type === 'activeSelection' ? active.getObjects() : [active];
}

function drawingKeyboardShortcutAllowed() {
  const panel = document.getElementById('panel-drawing');
  const activeObject = objectDrawingCanvas?.getActiveObject();
  const target = document.activeElement;
  const editingText = Boolean(activeObject?.isEditing);
  const editingForm = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || target?.isContentEditable;
  return Boolean(panel && !panel.hidden && !editingText && !editingForm);
}

function updateDrawingObjectActions() {
  const copyButton = document.getElementById('copy-selected');
  const pasteButton = document.getElementById('paste-drawing');
  if (copyButton) copyButton.disabled = !objectDrawingCanvas?.getActiveObject();
  if (pasteButton) pasteButton.disabled = !drawingClipboard;
}

function copySelectedDrawingObjects() {
  const activeObject = objectDrawingCanvas?.getActiveObject();
  if (!activeObject) return showToast('Tippe zuerst ein Objekt an.', 'error');
  activeObject.clone(clonedObject => {
    drawingClipboard = clonedObject;
    updateDrawingObjectActions();
    showToast(activeObject.type === 'activeSelection' ? 'Auswahl kopiert.' : 'Objekt kopiert.', 'ok');
  });
}

function pasteDrawingObjects() {
  if (!objectDrawingCanvas || !drawingClipboard) return showToast('Kopiere zuerst ein Objekt.', 'error');
  drawingClipboard.clone(clonedObject => {
    setDrawingTool('select');
    objectDrawingCanvas.discardActiveObject();
    clonedObject.set({
      left: (clonedObject.left || 0) + 24,
      top: (clonedObject.top || 0) + 24,
      evented: true,
      selectable: true,
    });
    if (clonedObject.type === 'activeSelection') {
      clonedObject.canvas = objectDrawingCanvas;
      clonedObject.forEachObject(object => {
        object.set({evented: true, selectable: true});
        objectDrawingCanvas.add(object);
      });
      clonedObject.setCoords();
    } else {
      objectDrawingCanvas.add(clonedObject);
    }
    drawingClipboard.set({
      left: (drawingClipboard.left || 0) + 24,
      top: (drawingClipboard.top || 0) + 24,
    });
    objectDrawingCanvas.setActiveObject(clonedObject);
    objectDrawingCanvas.requestRenderAll();
    markDrawingDirty();
    updateDrawingObjectActions();
    showToast(clonedObject.type === 'activeSelection' ? 'Kopierte Auswahl eingefügt.' : 'Kopie eingefügt.', 'ok');
  });
}

function applyDrawingColor() {
  updateDrawingBrush();
  const color = document.getElementById('drawing-color').value;
  selectedDrawingObjects().forEach(object => {
    if (['i-text', 'textbox', 'text'].includes(object.type)) object.set('fill', color);
    else object.set('stroke', color);
  });
  if (selectedDrawingObjects().length) markDrawingDirty();
  objectDrawingCanvas?.requestRenderAll();
}

function applyStrokeWidthToSelection() {
  const width = Number(document.getElementById('brush-size').value);
  selectedDrawingObjects().forEach(object => {
    if (!['i-text', 'textbox', 'text'].includes(object.type)) object.set('strokeWidth', width);
  });
  if (selectedDrawingObjects().length) markDrawingDirty();
  objectDrawingCanvas?.requestRenderAll();
}

function deleteSelectedDrawingObjects() {
  if (!objectDrawingCanvas) return;
  const objects = selectedDrawingObjects();
  if (!objects.length) return showToast('Tippe zuerst ein Objekt an.', 'error');
  objectDrawingCanvas.discardActiveObject();
  objects.forEach(object => objectDrawingCanvas.remove(object));
  objectDrawingCanvas.requestRenderAll();
  updateDrawingObjectActions();
}

function clearObjectDrawing(ask = false) {
  if (!objectDrawingCanvas) return;
  if (ask && objectDrawingCanvas.getObjects().length && !confirm('Wirklich alle Objekte dieser Zeichnung löschen?')) return;
  drawingLoading = true;
  objectDrawingCanvas.clear();
  objectDrawingCanvas.setBackgroundColor('#ffffff', objectDrawingCanvas.renderAll.bind(objectDrawingCanvas));
  drawingLoading = false;
  drawingDirty = Boolean(ask);
  updateDrawingSaveState();
  updateDrawingObjectActions();
  if (ask) markAutomaticSaveDirty({drawing: true});
}

function markDrawingDirty() {
  if (drawingLoading) return;
  drawingDirty = true;
  updateDrawingSaveState();
  markAutomaticSaveDirty({drawing: true});
}

function updateDrawingSaveState(savedAt = '') {
  const state = document.getElementById('drawing-save-state');
  if (!state) return;
  state.classList.toggle('is-saved', !drawingDirty);
  state.textContent = drawingDirty ? 'Änderungen noch nicht im Lehrer-Dashboard gespeichert.' : savedAt ? `Im Lehrer-Dashboard gespeichert: ${formatDrawingTimestamp(savedAt)}` : 'Im Lehrer-Dashboard gespeichert.';
}

function formatDrawingTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('de-DE', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'});
}

function updateDrawingPrompt() {
  document.getElementById('drawing-device-name').textContent = DRAWING_DEVICES[drawingIndex];
}

function currentDrawingJson() {
  return objectDrawingCanvas ? objectDrawingCanvas.toJSON() : {objects: []};
}

function currentDrawingPreview() {
  return objectDrawingCanvas?.toDataURL({format: 'png', multiplier: 1}) || '';
}

async function saveObjectDrawing({silent = false} = {}) {
  const feedback = document.getElementById('drawing-feedback');
  const device = DRAWING_DEVICES[drawingIndex];
  if (!objectDrawingCanvas?.getObjects().length) {
    if (silent) {
      try {
        const response = await fetch(`/api/zeichnungen/${encodeURIComponent(device)}`, {method: 'DELETE'});
        if (!response.ok) return false;
        savedDrawingLibrary.delete(device);
        drawingDirty = false;
        updateDrawingSaveState(new Date().toISOString());
        return true;
      } catch (_) {
        return false;
      }
    }
    showFeedback(feedback, 'error', 'Füge zuerst mindestens einen Strich, eine Form oder einen Text ein.');
    return false;
  }
  const canvas = currentDrawingJson();
  const preview = currentDrawingPreview();
  savedDrawingLibrary.set(device, JSON.parse(JSON.stringify(canvas)));
  let response;
  let result;
  try {
    response = await fetch('/api/zeichnungen', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({device, canvas, preview}),
    });
    result = await response.json();
  } catch (_) {
    if (!silent) showFeedback(feedback, 'error', 'Die Zeichnung konnte nicht gespeichert werden.');
    return false;
  }
  if (!response.ok || !result.ok) {
    if (!silent) showFeedback(feedback, 'error', result.error || 'Die Zeichnung konnte nicht gespeichert werden.');
    return false;
  }
  drawingDirty = false;
  updateDrawingSaveState(result.updated_at);
  return true;
}

async function loadStudentDrawingLibrary() {
  try {
    const response = await fetch('/api/zeichnungen');
    const result = await response.json();
    if (!response.ok || !result.ok) return;
    (result.drawings || []).forEach(item => {
      if (DRAWING_DEVICES.includes(item.device) && item.canvas?.objects) savedDrawingLibrary.set(item.device, item.canvas);
    });
    if (!drawingDirty) await loadDrawingForCurrentDevice();
  } catch (_) {
    // The editor remains fully usable and can still be included in a local JSON backup.
  }
}

function loadFabricDrawing(canvasData) {
  return new Promise(resolve => {
    drawingLoading = true;
    objectDrawingCanvas.loadFromJSON(canvasData, () => {
      objectDrawingCanvas.setBackgroundColor('#ffffff', () => {
        drawingLoading = false;
        setDrawingTool('select');
        objectDrawingCanvas.requestRenderAll();
        resolve();
      });
    });
  });
}

async function loadDrawingForCurrentDevice() {
  const device = DRAWING_DEVICES[drawingIndex];
  const saved = savedDrawingLibrary.get(device);
  if (saved) await loadFabricDrawing(saved);
  else clearObjectDrawing(false);
  drawingDirty = false;
  if (saved) updateDrawingSaveState();
  else {
    const state = document.getElementById('drawing-save-state');
    state.classList.remove('is-saved');
    state.textContent = 'Noch nicht im Lehrer-Dashboard gespeichert.';
  }
}

async function analyzeDrawing() {
  const expected = DRAWING_DEVICES[drawingIndex];
  if (!await saveObjectDrawing()) return;
  requestAiAccess('zeichnung', `Zeichnung prüfen: ${expected}`, async requestId => {
    const feedback = document.getElementById('drawing-feedback');
    showFeedback(feedback, 'info', 'Die KI untersucht Umriss und typische Formmerkmale …');
    const response = await fetch('/api/check-drawing', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({anfrage_id: requestId, request_type: 'zeichnung', expected, image: currentDrawingPreview()})
    });
    const result = await response.json();
    if (result.blocked) return showFeedback(feedback, 'error', 'Die Bildanalyse ist noch nicht freigegeben.');
    const message = `${result.feedback || 'Keine Rückmeldung.'}${result.hint ? ` Konkreter Tipp: ${result.hint}` : ''}`;
    showFeedback(feedback, result.correct === false ? 'error' : 'info', message);
    sendAnswer('Z', 'zeichnung-ki', `${expected}: ${message}`, result.correct, 'Praxis');
    if (result.correct !== false) markComplete('Z');
  });
}

let dominoTiles = [];
let dominoRemaining = [];
let dominoPlaced = [];
const DOMINO_LABELS = {
  Reagenzglas: 'Reagenz\u00adglas',
  Becherglas: 'Becher\u00adglas',
  Messzylinder: 'Mess\u00adzylinder',
  Erlenmeyerkolben: 'Erlenmeyer\u00adkolben',
  Spritzflasche: 'Spritz\u00adflasche',
  Gasbrenner: 'Gas\u00adbrenner',
};

function resizeDominoCanvas(canvas) {
  if (!canvas.isConnected) return;
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const targetWidth = Math.max(1, Math.round(bounds.width * pixelRatio));
  const targetHeight = Math.max(1, Math.round(bounds.height * pixelRatio));
  if (canvas.width === targetWidth && canvas.height === targetHeight) return;
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const device = DEVICES.find(item => item.name === canvas.dataset.deviceName);
  if (device) renderDevice(canvas, device);
}

const dominoCanvasObserver = typeof ResizeObserver === 'function'
  ? new ResizeObserver(entries => entries.forEach(entry => resizeDominoCanvas(entry.target)))
  : null;

function initDomino() {
  document.getElementById('domino-restart').addEventListener('click', startDomino);
  startDomino();
}

function startDomino() {
  const names = ['Reagenzglas', 'Becherglas', 'Messzylinder', 'Erlenmeyerkolben', 'Spatel', 'Spritzflasche', 'Gasbrenner', 'Mörser'];
  dominoTiles = names.map((name, index) => ({id: index, imageName: name, labelName: names[(index + 1) % names.length]}));
  dominoPlaced = [dominoTiles[0]];
  dominoRemaining = shuffle(dominoTiles.slice(1));
  renderDomino();
}

function shuffle(items) {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function renderDominoTile(tile) {
  const wrapper = document.createElement('div');
  wrapper.className = 'domino-tile';
  const imageHalf = document.createElement('div');
  imageHalf.className = 'domino-half';
  const canvas = document.createElement('canvas');
  canvas.width = 220; canvas.height = 92;
  canvas.dataset.deviceName = tile.imageName;
  canvas.setAttribute('aria-label', `Abbildung: ${tile.imageName}`);
  imageHalf.appendChild(canvas);
  const nameHalf = document.createElement('div');
  nameHalf.className = 'domino-half domino-name';
  nameHalf.textContent = DOMINO_LABELS[tile.labelName] || tile.labelName;
  nameHalf.setAttribute('aria-label', tile.labelName);
  wrapper.append(imageHalf, nameHalf);
  return wrapper;
}

function renderDomino() {
  const chain = document.getElementById('domino-chain');
  const options = document.getElementById('domino-options');
  chain.querySelectorAll('canvas').forEach(canvas => dominoCanvasObserver?.unobserve(canvas));
  options.querySelectorAll('canvas').forEach(canvas => dominoCanvasObserver?.unobserve(canvas));
  chain.replaceChildren(...dominoPlaced.map(renderDominoTile));
  options.replaceChildren();
  dominoRemaining.forEach(tile => {
    const button = document.createElement('button');
    button.className = 'domino-option';
    button.type = 'button';
    button.setAttribute('aria-label', `Dominostein: Bild ${tile.imageName}, Name ${tile.labelName}`);
    button.appendChild(renderDominoTile(tile));
    button.addEventListener('click', () => chooseDomino(tile, button));
    options.appendChild(button);
  });
  requestAnimationFrame(() => {
    document.querySelectorAll('#domino-chain canvas, #domino-options canvas').forEach(canvas => {
      resizeDominoCanvas(canvas);
      dominoCanvasObserver?.observe(canvas);
    });
  });
  document.getElementById('domino-progress').textContent = `${dominoPlaced.length} / ${dominoTiles.length}`;
  document.getElementById('domino-message').textContent = dominoRemaining.length ? `Gesucht: Bild „${dominoPlaced.at(-1).labelName}“` : 'Domino vollständig – starke Arbeit!';
}

function chooseDomino(tile, button) {
  const target = dominoPlaced.at(-1).labelName;
  if (tile.imageName !== target) {
    button.classList.add('wrong');
    setTimeout(() => button.classList.remove('wrong'), 500);
    sendAnswer('D', 'domino', `${tile.imageName} statt ${target}`, false, 'Praxis');
    return;
  }
  dominoPlaced.push(tile);
  dominoRemaining = dominoRemaining.filter(item => item.id !== tile.id);
  sendAnswer('D', 'domino', `${tile.imageName} passt zu ${target}`, true, 'Praxis');
  renderDomino();
  if (!dominoRemaining.length) markComplete('D');
}

function initAiApproval() {
  document.getElementById('ki-request-confirm').addEventListener('click', sendAiApprovalRequest);
  document.getElementById('ki-request-cancel').addEventListener('click', closeAiOverlay);
}

async function requestAiAccess(type, context, callback) {
  if (approvedRequests[type]) {
    callback(approvedRequests[type]);
    return;
  }
  try {
    const response = await fetch('/api/ki-zugang', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({typ: type, kontext: context})
    });
    const result = await response.json().catch(() => ({}));
    if (result.status === 'freigegeben') {
      approvedRequests[type] = result.anfrage_id;
      showToast('KI ist für deine Gruppe freigegeben.');
      callback(result.anfrage_id);
      return;
    }
    if (result.status === 'blocked' || result.status === 'budget_exceeded') {
      showToast(result.message || 'Der KI-Zugang ist derzeit gesperrt.', 'error');
      return;
    }
  } catch (_) {
    // Bei einer kurzen Störung bleibt die normale Einzelanfrage verfügbar.
  }
  pendingAi = {type, context, callback};
  document.getElementById('ki-modal-icon').textContent = type === 'zeichnung' ? '✏️' : type === 'handschrift' ? '🖊️' : type === 'chat' ? '💬' : '🤖';
  document.getElementById('ki-modal-title').textContent = type === 'zeichnung' ? 'Zeichnung analysieren' : type === 'handschrift' ? 'Handschrift lesen' : type === 'chat' ? 'KI-Tutor anfragen' : 'KI-Feedback anfragen';
  document.getElementById('ki-modal-text').textContent = 'Deine Lehrkraft muss diese KI-Funktion kurz freigeben. Deine Eingabe bleibt erhalten.';
  document.getElementById('ki-waiting').hidden = true;
  document.getElementById('ki-request-confirm').hidden = false;
  document.getElementById('ki-overlay').hidden = false;
  document.getElementById('ki-request-confirm').focus();
}

async function sendAiApprovalRequest() {
  if (!pendingAi) return;
  document.getElementById('ki-request-confirm').hidden = true;
  document.getElementById('ki-waiting').hidden = false;
  try {
    const response = await fetch('/api/ki-anfrage', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({typ: pendingAi.type, kontext: pendingAi.context})
    });
    const result = await response.json();
    if (result.status === 'budget_exceeded') {
      showToast('Das KI-Tagesbudget ist erreicht.', 'error');
      closeAiOverlay();
    } else if (result.status === 'blocked') {
      showToast(result.message || 'Der KI-Zugang ist gesperrt.', 'error');
      closeAiOverlay();
    }
  } catch (_) {
    showToast('Die Freigabe konnte nicht angefragt werden.', 'error');
    closeAiOverlay();
  }
}

function closeAiOverlay() {
  document.getElementById('ki-overlay').hidden = true;
  document.getElementById('ki-waiting').hidden = true;
  document.getElementById('ki-request-confirm').hidden = false;
}

function initSocket() {
  if (typeof io !== 'function') {
    showToast('Live-Verbindung nicht verfügbar.', 'error');
    return;
  }
  classroomSocket = io();
  classroomSocket.on('connect', () => classroomSocket.emit('schueler_join', {}));
  classroomSocket.on('ki_entscheidung', data => {
    if (!pendingAi || data.typ !== pendingAi.type) return;
    closeAiOverlay();
    if (data.entscheid === 'freigegeben') {
      approvedRequests[data.typ] = data.id;
      const callback = pendingAi.callback;
      pendingAi = null;
      showToast('KI-Funktion freigegeben.');
      if (data.typ === 'chat') {
        document.getElementById('chat-send').disabled = false;
        document.getElementById('chat-status').textContent = 'Freigegeben: Du kannst dieselbe Frage jetzt senden.';
      }
      callback?.(data.id);
    } else {
      pendingAi = null;
      showToast('Die Lehrkraft hat die Anfrage nicht freigegeben.', 'error');
    }
  });
  classroomSocket.on('ki_gesperrt', data => {
    if (data.gesperrt) {
      Object.keys(approvedRequests).forEach(key => delete approvedRequests[key]);
      document.getElementById('chat-send').disabled = true;
      showToast('Der KI-Zugang wurde gesperrt.', 'error');
    } else showToast('Der KI-Zugang ist wieder möglich.');
  });
  classroomSocket.on('autosave_flush', async data => {
    const drawingSaved = await flushDrawingAutosave();
    const workspaceSaved = await flushAutomaticSave({force: true});
    classroomSocket.emit('autosave_ack', {
      request_id: data?.request_id,
      ok: drawingSaved !== false && workspaceSaved !== false,
    });
  });
  classroomSocket.on('session_archived', async () => {
    await clearLocalAutomaticState();
    alert('Die Lehrkraft hat die Stunde sicher auf IServ archiviert. Dein Browser behält nur das zufällige Fortsetzungstoken; Arbeitsdaten liegen nicht mehr auf dem App-Server.');
    location.replace('/login');
  });
  classroomSocket.on('session_invalidated', async () => {
    await clearLocalAutomaticState();
    clearResumeCredentials();
    alert('Deine Unterrichtssitzung wurde beendet. Bitte melde dich neu an.');
    location.replace('/login');
  });
}

function initTutor() {
  const panel = document.getElementById('tutor-panel');
  const toggle = document.getElementById('tutor-toggle');
  const setOpen = open => {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setOpen(panel.hidden));
  document.getElementById('tutor-close').addEventListener('click', () => setOpen(false));
  document.getElementById('chat-request').addEventListener('click', () => {
    const question = document.getElementById('chat-input').value.trim();
    if (!question) return showToast('Schreibe zuerst deine echte Frage.', 'error');
    requestAiAccess('chat', question.slice(0, 250), () => {
      document.getElementById('chat-send').disabled = false;
    });
  });
  document.getElementById('chat-send').addEventListener('click', sendChatMessage);
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;
  if (!approvedRequests.chat) {
    requestAiAccess('chat', message.slice(0, 250), () => {
      document.getElementById('chat-send').disabled = false;
    });
    return;
  }
  appendChatMessage('user', message);
  input.value = '';
  document.getElementById('chat-status').textContent = 'Die KI denkt nach …';
  const response = await fetch('/api/chat', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({message, history: chatHistory, anfrage_id: approvedRequests.chat})
  });
  const result = await response.json();
  if (result.blocked) {
    document.getElementById('chat-status').textContent = result.message || 'Nicht freigegeben.';
    return;
  }
  appendChatMessage('assistant', result.response || 'Keine Antwort erhalten.');
  document.getElementById('chat-status').textContent = 'Freigegeben · Stelle gern eine weitere Frage.';
}

function appendChatMessage(role, content) {
  chatHistory.push({role, content});
  const element = document.createElement('div');
  element.className = `chat-message ${role === 'user' ? 'user' : 'assistant'}`;
  element.innerHTML = renderSafeMarkdown(content);
  document.getElementById('chat-messages').appendChild(element);
  element.scrollIntoView({block: 'end'});
  if (window.MathJax?.typesetPromise) window.MathJax.typesetPromise([element]).catch(() => {});
}

function renderSafeMarkdown(text) {
  const escaped = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  return escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
}

function initBackup() {
  document.getElementById('export-json').addEventListener('click', exportBackup);
  document.getElementById('import-file').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    importBackupText(await file.text());
    event.target.value = '';
  });
  document.getElementById('import-text').addEventListener('click', () => importBackupText(document.getElementById('json-text').value));
  document.getElementById('copy-json').addEventListener('click', async () => {
    const value = document.getElementById('json-text').value;
    if (!value) return showFeedback(document.getElementById('backup-feedback'), 'error', 'Erzeuge zuerst eine Sicherung.');
    await navigator.clipboard.writeText(value);
    showFeedback(document.getElementById('backup-feedback'), 'ok', 'JSON-Text kopiert.');
  });
}

function collectBackup({compact = false} = {}) {
  const fields = {};
  document.querySelectorAll('input[data-backup], textarea[data-backup], [data-structured]').forEach(field => { if (field.id) fields[field.id] = field.value; });
  const levels = {};
  document.querySelectorAll('.task-card').forEach(card => { levels[card.dataset.taskNum] = card.dataset.niveau; });
  const choices = {};
  document.querySelectorAll('[data-choice-group]').forEach(group => {
    choices[group.dataset.choiceGroup] = group.querySelector('.choice-btn.selected')?.dataset.value || null;
  });
  const laboratoryLibrary = Object.fromEntries(
    [...savedDrawingLibrary.entries()].map(([device, canvas]) => [device, canvas])
  );
  if (objectDrawingCanvas) laboratoryLibrary[DRAWING_DEVICES[drawingIndex]] = currentDrawingJson();
  return {
    schema_version: 1,
    app_id: META.appId,
    exported_at: new Date().toISOString(),
    student: {pseudonym: META.pseudonym, klasse: META.klasse},
    progress: [...completedTasks],
    levels,
    active_tab: activeTab,
    fields,
    structured_fields: Object.fromEntries(Object.entries(fields).filter(([id]) => id.startsWith('task2A-'))),
    selected_options: choices,
    quiz: {score: quizScore, round: quizRound, device: DEVICES[quizIndex].name},
    domino: {placed: dominoPlaced.map(item => item.id), remaining: dominoRemaining.map(item => item.id)},
    drawings: {
      handwriting: document.getElementById('handwriting-canvas').toDataURL('image/png'),
      laboratory: compact ? '' : currentDrawingPreview(),
      laboratory_objects: currentDrawingJson(),
      laboratory_library: laboratoryLibrary,
      device: DRAWING_DEVICES[drawingIndex]
    }
  };
}

async function exportBackup() {
  const text = JSON.stringify(collectBackup(), null, 2);
  document.getElementById('json-text').value = text;
  document.getElementById('json-fallback').open = true;
  const file = new File([text], `laborgeraete-${new Date().toISOString().slice(0,10)}.json`, {type: 'application/json'});
  if (navigator.share && navigator.canShare?.({files: [file]})) {
    try { await navigator.share({title: 'Laborgeräte-Sicherung', files: [file]}); return; } catch (error) { if (error.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url; link.download = file.name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showFeedback(document.getElementById('backup-feedback'), 'ok', 'Sicherung erstellt. Der Textfallback bleibt sichtbar.');
}

async function importBackupText(text) {
  const feedback = document.getElementById('backup-feedback');
  try {
    const data = JSON.parse(text);
    await applyBackupData(data);
    document.getElementById('json-text').value = text;
    showFeedback(feedback, 'ok', 'Sicherung lokal geladen. Es wurde nichts an das Lehrer-Dashboard gesendet.');
  } catch (error) {
    showFeedback(feedback, 'error', `Import nicht möglich: ${error.message}`);
  }
}

async function applyBackupData(data, {automatic = false} = {}) {
  if (data.schema_version !== 1 || data.app_id !== META.appId) throw new Error('Diese Datei gehört nicht zu dieser Laborgeräte-App.');
  autosaveApplying = true;
  try {
    Object.entries(data.fields || {}).forEach(([id, value]) => { const field = document.getElementById(id); if (field) field.value = value; });
    Object.entries(data.levels || {}).forEach(([task, level]) => {
      const card = document.querySelector(`[data-task-num="${task}"]`);
      const select = card?.querySelector('.niveau-select');
      if (select && ['A','B','C'].includes(level)) { select.value = level; setTaskNiveau(select); }
    });
    Object.entries(data.selected_options || {}).forEach(([groupName, value]) => {
      const group = document.querySelector(`[data-choice-group="${groupName}"]`);
      group?.querySelectorAll('.choice-btn').forEach(button => button.classList.toggle('selected', button.dataset.value === value));
    });
    completedTasks.clear();
    (data.progress || []).forEach(item => completedTasks.add(String(item)));
    updateProgress();
    quizScore = Number(data.quiz?.score || 0);
    quizRound = Number(data.quiz?.round || 1);
    document.getElementById('quiz-score').textContent = quizScore;
    const quizDeviceIndex = DEVICES.findIndex(item => item.name === data.quiz?.device);
    if (quizDeviceIndex >= 0) { quizIndex = quizDeviceIndex; renderQuiz(); }
    const dominoIds = [...(data.domino?.placed || []), ...(data.domino?.remaining || [])];
    if (dominoIds.length === dominoTiles.length && new Set(dominoIds).size === dominoTiles.length) {
      const byId = new Map(dominoTiles.map(item => [item.id, item]));
      dominoPlaced = data.domino.placed.map(id => byId.get(Number(id))).filter(Boolean);
      dominoRemaining = data.domino.remaining.map(id => byId.get(Number(id))).filter(Boolean);
      renderDomino();
    }
    const drawingDeviceIndex = DRAWING_DEVICES.indexOf(data.drawings?.device);
    if (drawingDeviceIndex >= 0) { drawingIndex = drawingDeviceIndex; updateDrawingPrompt(); }
    restoreCanvasImage('handwriting-canvas', data.drawings?.handwriting);
    savedDrawingLibrary.clear();
    Object.entries(data.drawings?.laboratory_library || {}).forEach(([device, canvas]) => {
      if (DRAWING_DEVICES.includes(device) && canvas?.objects) savedDrawingLibrary.set(device, canvas);
    });
    if (data.drawings?.laboratory_objects?.objects) {
      await loadFabricDrawing(data.drawings.laboratory_objects);
    } else if (data.drawings?.laboratory?.startsWith('data:image/png;base64,')) {
      await importLegacyDrawingImage(data.drawings.laboratory);
    }
    if (objectDrawingCanvas) {
      savedDrawingLibrary.set(DRAWING_DEVICES[drawingIndex], currentDrawingJson());
      drawingDirty = !automatic;
      updateDrawingSaveState();
    }
    if (data.active_tab) switchTab(data.active_tab);
  } finally {
    autosaveApplying = false;
  }
}

function setAutosaveStatus(kind, text) {
  const indicator = document.getElementById('autosave-indicator');
  const label = document.getElementById('autosave-text');
  if (!indicator || !label) return;
  indicator.className = `autosave-indicator is-${kind}`;
  label.textContent = text;
}

function openAutosaveDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return resolve(null);
    const request = indexedDB.open(AUTOSAVE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(AUTOSAVE_STORE)) {
        request.result.createObjectStore(AUTOSAVE_STORE, {keyPath: 'key'});
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readLocalAutomaticState() {
  const db = await openAutosaveDatabase();
  if (!db) return null;
  return new Promise(resolve => {
    const transaction = db.transaction(AUTOSAVE_STORE, 'readwrite');
    const store = transaction.objectStore(AUTOSAVE_STORE);
    const request = store.get(AUTOSAVE_KEY);
    request.onsuccess = () => {
      const record = request.result || null;
      if (record?.expiresAt && record.expiresAt < Date.now()) {
        store.delete(AUTOSAVE_KEY);
        resolve(null);
      } else resolve(record);
    };
    request.onerror = () => resolve(null);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();
  });
}

async function writeLocalAutomaticState(state, revision) {
  const db = await openAutosaveDatabase();
  if (!db) return false;
  return new Promise(resolve => {
    const transaction = db.transaction(AUTOSAVE_STORE, 'readwrite');
    transaction.objectStore(AUTOSAVE_STORE).put({
      key: AUTOSAVE_KEY,
      state,
      revision,
      savedAt: new Date().toISOString(),
      expiresAt: Date.now() + 48 * 60 * 60 * 1000,
    });
    transaction.oncomplete = () => { db.close(); resolve(true); };
    transaction.onerror = () => { db.close(); resolve(false); };
  });
}

async function clearLocalAutomaticState() {
  try {
    const db = await openAutosaveDatabase();
    if (!db) return;
    await new Promise(resolve => {
      const transaction = db.transaction(AUTOSAVE_STORE, 'readwrite');
      transaction.objectStore(AUTOSAVE_STORE).delete(AUTOSAVE_KEY);
      transaction.oncomplete = transaction.onerror = () => { db.close(); resolve(); };
    });
  } catch (_) {}
}

function storeResumeCredentials() {
  if (!META.studentId || !META.resumeToken) return;
  try {
    localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify({studentId: META.studentId, token: META.resumeToken}));
  } catch (_) {}
}

function clearResumeCredentials() {
  try { localStorage.removeItem(RESUME_STORAGE_KEY); } catch (_) {}
}

function bindAutomaticSaveEvents() {
  const fieldSelector = 'input[data-backup], textarea[data-backup], [data-structured], .niveau-select';
  document.addEventListener('input', event => {
    if (event.target.matches?.(fieldSelector)) markAutomaticSaveDirty();
  });
  document.addEventListener('change', event => {
    if (event.target.matches?.(fieldSelector)) markAutomaticSaveDirty();
  });
  document.addEventListener('click', event => {
    if (event.target.closest('.choice-btn, [data-quiz-mode], #quiz-next, #quiz-check, #handwriting-check, .tab-btn, .save-task, .domino-tile, .clear-canvas')) {
      setTimeout(markAutomaticSaveDirty, 0);
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAutomaticSave();
  });
  window.addEventListener('pagehide', () => flushAutomaticSave({keepalive: true}));
  window.setInterval(() => {
    if (autosaveDirty) flushAutomaticSave();
  }, 15000);
}

async function initAutomaticSaving() {
  storeResumeCredentials();
  bindAutomaticSaveEvents();
  await drawingLibraryReady.catch(() => {});

  const [localRecord, serverRecord] = await Promise.all([
    readLocalAutomaticState().catch(() => null),
    fetch('/api/arbeitsstand').then(async response => {
      const result = await response.json().catch(() => ({}));
      return response.ok && result.ok ? result : null;
    }).catch(() => null),
  ]);
  const localRevision = Number(localRecord?.revision || 0);
  const serverRevision = Number(serverRecord?.revision || 0);
  const interactedWhileLoading = autosaveDirty;
  autosaveRevision = Math.max(autosaveRevision, localRevision, serverRevision);
  const chosen = localRevision > serverRevision ? localRecord?.state : serverRecord?.state || localRecord?.state;
  if (chosen && !interactedWhileLoading) {
    try { await applyBackupData(chosen, {automatic: true}); }
    catch (_) { setAutosaveStatus('error', 'Gespeicherter Arbeitsstand konnte nicht geladen werden.'); }
  }
  autosaveReady = true;

  if (chosen && !interactedWhileLoading && localRevision < serverRevision) {
    await writeLocalAutomaticState(chosen, serverRevision).catch(() => false);
  }
  if (interactedWhileLoading || localRevision > serverRevision) {
    autosaveDirty = true;
    await flushAutomaticSave();
  } else if (!chosen) {
    markAutomaticSaveDirty();
    await flushAutomaticSave();
  } else {
    setAutosaveStatus('saved', `Automatisch gesichert · ${new Date().toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})}`);
  }
}

function markAutomaticSaveDirty({drawing = false} = {}) {
  if (autosaveApplying) return;
  autosaveDirty = true;
  autosaveRevision = Math.max(autosaveRevision + 1, 1);
  setAutosaveStatus('pending', 'Arbeitsstand wird automatisch gesichert …');
  clearTimeout(autosaveLocalTimer);
  autosaveLocalTimer = setTimeout(saveAutomaticStateLocally, 300);
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => flushAutomaticSave(), 1300);
  if (drawing) {
    clearTimeout(drawingAutosaveTimer);
    drawingAutosaveTimer = setTimeout(flushDrawingAutosave, 1200);
  }
}

async function saveAutomaticStateLocally() {
  if (!autosaveReady || autosaveApplying) return false;
  const state = collectBackup({compact: true});
  const stored = await writeLocalAutomaticState(state, Math.max(autosaveRevision, 1)).catch(() => false);
  if (stored && autosaveDirty) setAutosaveStatus('local', 'Auf diesem Gerät gesichert · Serverabgleich läuft');
  return stored;
}

async function flushDrawingAutosave() {
  clearTimeout(drawingAutosaveTimer);
  drawingAutosaveTimer = null;
  if (!drawingDirty || !objectDrawingCanvas || drawingLoading) return true;
  return saveObjectDrawing({silent: true});
}

function flushAutomaticSave({force = false, keepalive = false} = {}) {
  if (!autosaveReady || autosaveApplying || (!autosaveDirty && !force)) return autosaveInFlight;
  clearTimeout(autosaveTimer);
  clearTimeout(autosaveLocalTimer);
  const revision = Math.max(autosaveRevision, 1);
  const state = collectBackup({compact: true});
  const run = async () => {
    await writeLocalAutomaticState(state, revision).catch(() => false);
    try {
      const response = await fetch('/api/arbeitsstand', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({revision, state}),
        keepalive,
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) {
        clearResumeCredentials();
        setAutosaveStatus('error', 'Unterrichtssitzung beendet.');
        return false;
      }
      if (!response.ok || !result.ok) throw new Error(result.error || 'Serverabgleich fehlgeschlagen');
      if (autosaveRevision === revision) autosaveDirty = false;
      setAutosaveStatus('saved', `Automatisch gesichert · ${new Date().toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})}`);
      if (autosaveDirty) {
        clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(() => flushAutomaticSave(), 250);
      }
      return true;
    } catch (_) {
      autosaveDirty = true;
      setAutosaveStatus('local', 'Auf diesem Gerät gesichert · Server nicht erreichbar');
      return false;
    }
  };
  autosaveInFlight = autosaveInFlight.catch(() => false).then(run);
  return autosaveInFlight;
}

function importLegacyDrawingImage(dataUrl) {
  return new Promise(resolve => {
    if (!objectDrawingCanvas || !window.fabric?.Image) return resolve();
    fabric.Image.fromURL(dataUrl, image => {
      drawingLoading = true;
      objectDrawingCanvas.clear();
      const scale = Math.min(objectDrawingCanvas.width / image.width, objectDrawingCanvas.height / image.height);
      image.set({left: 0, top: 0, scaleX: scale, scaleY: scale});
      objectDrawingCanvas.add(image);
      objectDrawingCanvas.setBackgroundColor('#ffffff', objectDrawingCanvas.renderAll.bind(objectDrawingCanvas));
      drawingLoading = false;
      setDrawingTool('select');
      resolve();
    });
  });
}

function restoreCanvasImage(canvasId, dataUrl) {
  if (!dataUrl?.startsWith('data:image/png;base64,')) return;
  const canvas = document.getElementById(canvasId);
  const image = new Image();
  image.onload = () => {
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
  };
  image.src = dataUrl;
}
