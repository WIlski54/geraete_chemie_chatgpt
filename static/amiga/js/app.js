/* AmigaWerk – Oberfläche für den Emulationskern SAE.
   Diese Datei enthält keinen Emulator-Code; sie übersetzt die Einstellungen
   des Dialogs in die Konfiguration des Kerns und steuert ihn zur Laufzeit. */
'use strict';

/* =====================================================================
   Grundlagen
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const APP_NAME = 'AmigaWerk';
const LS_SETTINGS = 'amigawerk.settings.v1';
const LS_CONFIGS = 'amigawerk.configs.v1';
const LS_DISKS = 'amigawerk.disks.v1';
const MAX_DISKS = 40;
const IS_FILE = location.protocol === 'file:';

function lsGet(key, fallback) {
	try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
	catch (e) { return fallback; }
}
function lsSet(key, val) {
	try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* Speicher nicht verfügbar */ }
}
const clone = o => JSON.parse(JSON.stringify(o));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fmtKB(kb) {
	if (!kb) return 'Keiner';
	if (kb < 1024) return kb + ' KB';
	const mb = kb / 1024;
	if (mb >= 1024) return (mb / 1024).toLocaleString('de-DE') + ' GB';
	return mb.toLocaleString('de-DE') + ' MB';
}
function fmtBytes(b) {
	if (b >= 1048576) return (b / 1048576).toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' MB';
	return Math.round(b / 1024) + ' KB';
}

/* =====================================================================
   Modelle (Schnellstart) – entsprechen den eingebauten Profilen des Kerns
   ===================================================================== */
const MODELS = {
	A500: { id: SAEC_Model_A500, name: 'A500', cfgs: [
		'KS 1.3, OCS, 512 KB Chip + 512 KB Slow RAM (am häufigsten)',
		'KS 1.3, ECS Agnus, 512 KB Chip + 512 KB Slow RAM',
		'KS 1.3, ECS Agnus, 1 MB Chip RAM'] },
	A500P: { id: SAEC_Model_A500P, name: 'A500+', cfgs: [
		'Grundausstattung: KS 2.04, ECS, 1 MB Chip RAM',
		'2 MB Chip RAM',
		'2 MB Chip RAM + 4 MB Fast RAM'] },
	A600: { id: SAEC_Model_A600, name: 'A600', cfgs: [
		'Grundausstattung: KS 2.05, ECS, 1 MB Chip RAM',
		'2 MB Chip RAM + Echtzeituhr',
		'2 MB Chip RAM + 4 MB Fast RAM'] },
	A1000: { id: SAEC_Model_A1000, name: 'A1000', cfgs: [
		'512 KB Chip RAM',
		'256 KB Chip RAM (früheste Version)'] },
	A1200: { id: SAEC_Model_A1200, name: 'A1200', cfgs: [
		'Grundausstattung: KS 3.0, AGA, 68020, 2 MB Chip RAM',
		'4 MB Fast RAM + Echtzeituhr'] },
	A2000: { id: SAEC_Model_A2000, name: 'A2000', cfgs: [
		'KS 1.3, ECS Agnus, 512 KB Chip + 512 KB Slow RAM'] },
	A3000: { id: SAEC_Model_A3000, name: 'A3000', cfgs: [
		'KS 2.04, ECS, 68030, 2 MB Chip RAM'] },
	A4000: { id: SAEC_Model_A4000, name: 'A4000', cfgs: [
		'KS 3.1, AGA, 68030, 2 MB Chip + 8 MB Fast RAM'] }
};

/* Schieberegler-Stufen für den Speicher (in KB) */
const MEM_STEPS = {
	memChip: [256, 512, 1024, 2048],
	memSlow: [0, 256, 512, 1024, 1536],
	memZ2: [0, 512, 1024, 2048, 4096, 8192],
	memZ3: [0, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144],
	memMbLow: [0, 1024, 2048, 4096, 8192, 16384, 32768, 65536],
	memMbHigh: [0, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072]
};
const MEM_KEYS = { memChip: 'chip', memSlow: 'slow', memZ2: 'z2', memZ3: 'z3', memMbLow: 'mbLow', memMbHigh: 'mbHigh' };
const FD_SPEEDS = [0, 100, 200, 500, 1000];
const FD_SPEED_TXT = ['Turbo', '100 % (original)', '200 %', '500 %', '1000 %'];

const COMPAT_TXT = [
	'Zyklusnahe CPU, Diskettenlaufwerk in Originalgeschwindigkeit – für Spiele und Demos mit Kopierschutz oder exaktem Timing.',
	'Genaue CPU-Emulation, doppelt so schnelles Laufwerk – guter Mittelweg für fast alles.',
	'Schnellere CPU-Emulation und Turbo-Laufwerk – für Workbench und Anwendungen.',
	'CPU so schnell wie möglich, sofortiger Blitter, Turbo-Laufwerk – nur für Programme ohne Timing-Ansprüche.'
];

const FIRE_KEYS = [
	['None', 'Keine'], ['ControlRight', 'Strg rechts'], ['ControlLeft', 'Strg links'], ['ShiftRight', 'Umschalt rechts'],
	['ShiftLeft', 'Umschalt links'], ['AltLeft', 'Alt links'], ['Space', 'Leertaste'], ['Enter', 'Eingabe'],
	['Numpad0', 'Ziffernblock 0'], ['NumpadDecimal', 'Ziffernblock ,'], ['KeyX', 'X'], ['KeyY', 'Y'], ['KeyZ', 'Z'],
	['Digit1', '1'], ['Digit2', '2']
];

/* =====================================================================
   Einstellungen
   ===================================================================== */
const DEFAULTS = {
	v: 1,
	model: 'A500', modelCfg: 0, ntsc: false, compat: 1,
	romSrc: 'aros', romShifter: false,
	cpu: { model: 68000, speed: 0, compatible: true, addr24: true },
	chip: { mask: 0, colLevel: 2, blitImm: false, blitWait: 0, features: '' },
	mem: { chip: 512, slow: 512, z2: 0, z3: 0, mbLow: 0, mbHigh: 0 },
	ide: 0,
	fd: { drives: [
		{ on: true, type: 1, wp: false }, { on: true, type: 1, wp: false },
		{ on: false, type: 1, wp: false }, { on: false, type: 1, wp: false }], speed: 200 },
	hd: [{ on: false, ro: false }, { on: false, ro: false }, { on: false, ro: false }, { on: false, ro: false }],
	vid: { res: 1, line: 1, api: 1, scale: 'fit', cursor: 2, skip: false, cx: false, cy: false, smooth: false },
	flt: { scan: 25, vig: 20, glow: 0, lum: 0, con: 0, gam: 0 },
	snd: { mode: 2, freq: 0, ch: 2, sep: 7, delay: 0, interp: 0, filter: 1, ftype: 0 },
	ports: [
		{ type: 1, move: 3, f1: 'None', f2: 'None', dev: -1 },
		{ type: 3, move: 1, f1: 'ControlRight', f2: 'ShiftRight', dev: -1 }],
	keyboard: true,
	misc: { pauseBg: true, pauseDlg: true, status: true, toolbar: true, remember: true, autostart: false, serial: false, quickstartMode: true },
	page: 'quickstart',
	lastDisks: [null, null, null, null]
};

let S = mergeDeep(clone(DEFAULTS), lsGet(LS_SETTINGS, {}));
function mergeDeep(base, add) {
	if (!add || typeof add !== 'object') return base;
	for (const k of Object.keys(add)) {
		if (!(k in base)) continue;
		if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) mergeDeep(base[k], add[k]);
		else if (Array.isArray(base[k]) && Array.isArray(add[k])) {
			base[k] = base[k].map((v, i) => (i in add[k]) ? (v && typeof v === 'object' ? mergeDeep(v, add[k][i]) : add[k][i]) : v);
		} else base[k] = add[k];
	}
	return base;
}
function saveSettings() { lsSet(LS_SETTINGS, S); }

/* =====================================================================
   Dateien im Speicher
   ===================================================================== */
const FILES = {
	rom: null, ext: null, key: null,
	df: [null, null, null, null],
	hd: [null, null, null, null]
};
const AROS = {
	rom: { name: 'AROS Kickstart (eingebaut)', data: '', size: 0, crc32: 0 },
	ext: { name: 'AROS Erweiterung (eingebaut)', data: '', size: 0, crc32: 0 }
};
function loadAros() {
	if (AROS.rom.size) return true;
	if (!window.AROS_ROM_B64) return false;
	AROS.rom.data = atob(window.AROS_ROM_B64); AROS.rom.size = AROS.rom.data.length; AROS.rom.crc32 = AWFiles.crc32(AROS.rom.data);
	AROS.ext.data = atob(window.AROS_EXT_B64); AROS.ext.size = AROS.ext.data.length; AROS.ext.crc32 = AWFiles.crc32(AROS.ext.data);
	return true;
}

/* Disketten-Sammlung: Metadaten in localStorage, Inhalte in IndexedDB */
let DISKS = lsGet(LS_DISKS, []);             /* [{key,name,size,ts}] */
const DISK_CACHE = new Map();                 /* key -> file */
function diskKey(f) { return 'disk:' + f.crc32.toString(16) + ':' + f.name; }
async function collectDisk(f) {
	const key = diskKey(f);
	DISK_CACHE.set(key, f);
	DISKS = DISKS.filter(d => d.key !== key);
	DISKS.unshift({ key: key, name: f.name, size: f.size, ts: Date.now() });
	while (DISKS.length > MAX_DISKS) {
		const old = DISKS.pop();
		DISK_CACHE.delete(old.key);
		AWFiles.store.del(old.key);
	}
	lsSet(LS_DISKS, DISKS);
	if (S.misc.remember) await AWFiles.store.put(key, f);
	return key;
}
async function getDisk(key) {
	if (!key) return null;
	if (DISK_CACHE.has(key)) return DISK_CACHE.get(key);
	const f = await AWFiles.store.get(key);
	if (f && f.data) { DISK_CACHE.set(key, f); return f; }
	return null;
}
async function forgetDisk(key) {
	DISKS = DISKS.filter(d => d.key !== key);
	DISK_CACHE.delete(key);
	lsSet(LS_DISKS, DISKS);
	await AWFiles.store.del(key);
}

/* =====================================================================
   Emulator
   ===================================================================== */
let sae = null, cfg = null, inf = null;
const RT = {
	running: false, paused: false, muted: false, starting: false,
	pausedByDialog: false, dialogOpen: true, snapshot: null,
	modified: [false, false, false, false], stopWaiters: [], startWaiters: [],
	hwAtStart: null
};

function saeErrText(err) {
	switch (err) {
		case SAEE_AlreadyRunning: return 'Der Emulator läuft bereits.';
		case SAEE_NotRunning: return 'Der Emulator läuft nicht.';
		case SAEE_NoTimer: return 'Dieser Browser bietet keine genauen Zeitgeber. Bitte einen aktuellen Browser verwenden.';
		case SAEE_NoMemory: return 'Nicht genug Arbeitsspeicher. Weniger RAM einstellen oder andere Tabs schließen.';
		case SAEE_Config_Invalid: return 'Die Konfiguration ist ungültig.';
		case SAEE_Config_Compressed: return 'Gepackte Dateien werden an dieser Stelle nicht unterstützt.';
		case SAEE_CPU_Requires68020: return 'Diese Kickstart braucht einen 68020 mit 32-Bit-Adressierung. Unter „CPU und FPU“ einstellen.';
		case SAEE_CPU_Requires680EC20: return 'Diese Kickstart braucht mindestens einen 68020. Unter „CPU und FPU“ einstellen.';
		case SAEE_CPU_Requires68030: return 'Diese Kickstart braucht einen 68030. Unter „CPU und FPU“ einstellen.';
		case SAEE_CPU_Requires68040: return 'Diese Kickstart braucht einen 68040 oder 68060 – diese CPUs kann der Emulator noch nicht.';
		case SAEE_Memory_NoKickstartRom: return 'Es ist keine Kickstart-ROM gewählt. Unter „ROM“ AROS wählen oder eine eigene Datei laden.';
		case SAEE_Memory_NoExtendedRom: return 'Diese Kickstart braucht zusätzlich ein Erweiterungs-ROM (Seite „ROM“).';
		case SAEE_Memory_RomSize: return 'Die ROM-Datei hat eine ungültige Größe (erlaubt: 256 KB, 512 KB oder 1 MB).';
		case SAEE_Memory_RomKey: return 'Diese ROM ist verschlüsselt (Cloanto). Bitte zusätzlich die Datei „rom.key“ laden.';
		case SAEE_Memory_RomDecode: return 'Die Datei „rom.key“ passt nicht zu dieser ROM.';
		case SAEE_Memory_RomChecksum: return 'Die ROM-Datei ist beschädigt (Prüfsummenfehler).';
		case SAEE_Memory_RomUnknown: return 'Unbekannte ROM-Datei.';
		case SAEE_Video_ElementNotFound: return 'Interner Fehler: Bildschirmbereich nicht gefunden.';
		case SAEE_Video_RequiresCanvas: return 'Dieser Browser kann kein Canvas-Element darstellen.';
		case SAEE_Video_RequiresWegGl: return 'WebGL ist nicht verfügbar. Unter „Anzeige“ auf „Canvas 2D“ umstellen.';
		case SAEE_Video_ComphileShader:
		case SAEE_Video_LinkShader: return 'Die Grafikkarte lehnt den WebGL-Shader ab. Unter „Anzeige“ auf „Canvas 2D“ umstellen.';
		case SAEE_Audio_RequiresWebAudio: return 'Dieser Browser unterstützt kein Web Audio. Unter „Sound“ den Ton ausschalten.';
		case SAEE_Input_GamepadNotReady: return 'Das gewählte Gamepad wurde nicht gefunden. Einmal einen Knopf am Gamepad drücken und erneut starten.';
		default: return 'Interner Emulatorfehler (Code ' + err + ').';
	}
}

function copyFile(dst, src) {
	if (!src) { dst.clr(); return; }
	dst.name = src.name; dst.data = src.data; dst.size = src.size; dst.crc32 = src.crc32;
}

/* Liest die Hardware-Werte des Kerns nach einem Modellwechsel in die Einstellungen */
function readHardware() {
	S.cpu.model = cfg.cpu.model;
	S.cpu.speed = cfg.cpu.speed;
	S.cpu.compatible = !!cfg.cpu.compatible;
	S.cpu.addr24 = !!cfg.cpu.addressSpace24;
	S.chip.mask = cfg.chipset.mask;
	S.chip.colLevel = cfg.chipset.colLevel;
	S.chip.blitImm = !!cfg.chipset.blitter.immediate;
	S.chip.blitWait = cfg.chipset.blitter.waiting;
	S.mem.chip = cfg.memory.chipSize >> 10;
	S.mem.slow = cfg.memory.bogoSize >> 10;
	S.mem.z2 = cfg.memory.z2FastSize >> 10;
	S.mem.z3 = cfg.memory.z3FastSize >> 10;
	S.mem.mbLow = cfg.memory.ramsey.lowSize >> 10;
	S.mem.mbHigh = cfg.memory.ramsey.highSize >> 10;
	S.ide = cfg.chipset.ide;
	S.snd.ftype = (cfg.chipset.mask & SAEC_Config_Chipset_Mask_AGA) ? 1 : 0;
	S.snd.filter = cfg.audio.filter;
}

function applyPreset() {
	sae.setModel(MODELS[S.model].id, S.modelCfg);
	readHardware();
	applyCompat();
}

function applyCompat() {
	const c = S.compat;
	S.cpu.compatible = c <= 1;
	S.chip.blitImm = c >= 3;
	S.fd.speed = [100, 200, 0, 0][c];
	S.cpu.speed = c >= 3 ? -1 : 0;
}

/* Baut die vollständige Kern-Konfiguration aus den Einstellungen */
function buildConfig() {
	sae.setModel(MODELS[S.model].id, S.modelCfg);

	/* CPU */
	cfg.cpu.model = S.cpu.model;
	cfg.cpu.speed = S.cpu.speed;
	cfg.cpu.compatible = S.cpu.compatible;
	cfg.cpu.addressSpace24 = S.cpu.model < 68020 ? true : S.cpu.addr24;

	/* Chipsatz */
	cfg.chipset.mask = S.chip.mask;
	cfg.chipset.ntsc = S.ntsc;
	cfg.chipset.colLevel = S.chip.colLevel;
	cfg.chipset.blitter.immediate = S.chip.blitImm;
	cfg.chipset.blitter.waiting = S.chip.blitWait;

	/* RAM */
	cfg.memory.chipSize = S.mem.chip << 10;
	cfg.memory.bogoSize = S.mem.slow << 10;
	cfg.memory.z2FastSize = S.mem.z2 << 10;
	cfg.memory.z3FastSize = cfg.cpu.addressSpace24 ? 0 : S.mem.z3 << 10;
	const ramsey = S.model === 'A3000' || S.model === 'A4000';
	cfg.memory.ramsey.lowSize = ramsey ? S.mem.mbLow << 10 : 0;
	cfg.memory.ramsey.highSize = ramsey && !cfg.cpu.addressSpace24 ? S.mem.mbHigh << 10 : 0;

	/* ROM */
	if (S.romSrc === 'aros') {
		if (!loadAros()) { msgBox('Der eingebaute AROS-Kickstart fehlt (Datei roms/aros.js).'); return false; }
		copyFile(cfg.memory.rom, AROS.rom);
		copyFile(cfg.memory.extRom, AROS.ext);
		cfg.memory.romKey.clr();
	} else {
		if (!FILES.rom) {
			msgBox('Es ist keine eigene Kickstart-Datei geladen. Unter <b>ROM</b> eine Datei wählen oder AROS verwenden.');
			showPage('rom');
			return false;
		}
		copyFile(cfg.memory.rom, FILES.rom);
		copyFile(cfg.memory.extRom, FILES.ext);
		copyFile(cfg.memory.romKey, FILES.key);
	}
	cfg.memory.kickShifter = S.romShifter;

	/* Disketten */
	for (let n = 0; n < 4; n++) {
		const d = cfg.floppy.drive[n], s = S.fd.drives[n];
		if (n === 0 || s.on) {
			d.type = s.type;
			copyFile(d.file, FILES.df[n]);
			d.file.prot = s.wp;
		} else {
			d.type = SAEC_Config_Floppy_Type_None;
			d.file.clr();
		}
	}
	cfg.floppy.speed = S.fd.speed;

	/* Festplatten */
	for (let n = 0; n < 6; n++) {
		const ci = cfg.mount.config[n].ci;
		ci.controller_type = 0;
		if (n > 3) continue;
		const f = FILES.hd[n];
		if (cfg.chipset.ide && S.hd[n].on && f) {
			sae.setMountInfoDefaults(n);
			ci.controller_type = SAEC_Config_Mount_Controller_Type_MB_IDE;
			ci.controller_unit = n;
			ci.readonly = S.hd[n].ro;
			copyFile(ci.file, f);
			ci.file.crc32 = false;
			if (f.data.substr(0, 4) !== 'RDSK') {
				const blocks = Math.floor(f.size / ci.blocksize);
				ci.highcyl = Math.floor(blocks / (ci.surfaces * ci.sectors));
				ci.devname = 'DH' + n;
			}
		}
	}

	/* Anzeige */
	cfg.video.id = 'amigaVideo';
	cfg.video.enabled = true;
	cfg.video.api = (S.vid.api === 1 && inf.video.webGL) || !inf.video.canvas ? SAEC_Config_Video_API_WebGL : SAEC_Config_Video_API_Canvas;
	cfg.video.cursor = S.vid.cursor;
	cfg.video.antialias = S.vid.smooth;
	cfg.video.hresolution = S.vid.res;
	cfg.video.vresolution = S.vid.line === 0 ? SAEC_Config_Video_VResolution_NonDouble : SAEC_Config_Video_VResolution_Double;
	cfg.video.pscanlines = S.vid.line === 2 ? 1 : 0;
	cfg.video.iscanlines = 0;
	cfg.video.framerate = S.vid.skip ? 2 : 1;
	cfg.video.xcenter = S.vid.cx ? 2 : 0;
	cfg.video.ycenter = S.vid.cy ? 2 : 0;
	cfg.video.luminance = S.flt.lum;
	cfg.video.contrast = S.flt.con;
	cfg.video.gamma = S.flt.gam;
	cfg.video.size_win.width = SAEC_Video_DEF_AMIGA_WIDTH << cfg.video.hresolution;
	cfg.video.size_win.height = SAEC_Video_DEF_AMIGA_HEIGHT << cfg.video.vresolution;
	cfg.video.pauseInBackground = S.misc.pauseBg;

	/* Sound */
	cfg.audio.mode = inf.audio.webAudio ? S.snd.mode : Math.min(S.snd.mode, SAEC_Config_Audio_Mode_Off_Emul);
	cfg.audio.api = IS_FILE || RT.forceScriptProcessor ? SAEC_Config_Audio_API_ScriptProcessor : SAEC_Config_Audio_API_AudioWorklet;
	cfg.audio.freq = S.snd.freq;
	cfg.audio.channels = S.snd.ch;
	cfg.audio.stereoSeparation = S.snd.sep;
	cfg.audio.stereoDelay = S.snd.delay;
	cfg.audio.interpol = S.snd.interp;
	cfg.audio.filter = S.snd.filter;
	cfg.audio.filterType = S.snd.ftype;

	/* Gameports */
	for (let p = 0; p < 2; p++) {
		const sp = S.ports[p], cp = cfg.ports[p];
		cp.type = sp.type;
		cp.move = sp.move;
		cp.fire = [sp.f1, sp.f2];
		cp.device = sp.dev;
		if (sp.type === SAEC_Config_Ports_Type_Joy && sp.dev < 0) cp.type = SAEC_Config_Ports_Type_None;
	}
	cfg.keyboard.enabled = S.keyboard;

	/* Schnittstellen */
	cfg.serial.enabled = S.misc.serial;
	cfg.parallel.enabled = false;
	cfg.debug.level = SAEC_Config_Debug_Level_Warn;

	setHooks();
	return true;
}

/* ---------- Rückmeldungen des Kerns ---------- */
let serialLine = '';
function setHooks() {
	const h = cfg.hook;
	h.log.error = (err, msg) => {
		RT.running = false;
		msgBox('Der Emulator wurde mit einem Fehler angehalten.' + (msg ? '<br><br><span class="mono">' + esc(msg) + '</span>' : ''));
	};
	h.led.power = on => setLed(LED.power, on ? 'on' : '');
	h.led.hd = rw => setLed(LED.hd, rw === 1 ? 'on' : rw === 2 ? 'wr' : '');
	h.led.df = (unit, dis, cyl, side, rw) => {
		setLed(LED.df[unit], dis ? 'off' : rw === 1 ? 'on' : rw === 2 ? 'wr' : '');
		setText(LED.trk[unit], dis ? '--' : String(cyl).padStart(2, '0'));
	};
	h.led.fps = (fps, paused) => setText(LED.fps, paused ? '0.0' : fps.toFixed(1));
	h.led.cpu = (usage, paused) => {
		setText(LED.cpu, paused ? '0' : usage.toFixed(0));
		LED.cpu.parentNode.classList.toggle('hot', !paused && usage >= 110);
	};
	h.event.started = onStarted;
	h.event.stopped = onStopped;
	h.event.reseted = () => { setPaused(false); if (Date.now() - RT.startedAt > 1500) status('Amiga zurückgesetzt'); };
	h.event.paused = p => setPaused(p);
	h.event.diskModified = unit => { RT.modified[unit] = true; updateSaveBtn(); };
	h.event.screened = () => {};
	h.serial.put = ch => {
		if (ch === 10 || serialLine.length > 120) { console.log('[Amiga seriell] ' + serialLine); serialLine = ''; }
		else if (ch >= 32) serialLine += String.fromCharCode(ch);
	};
}

const LED = {};
function initLeds() {
	LED.power = $('#ledPower'); LED.hd = $('#ledHd');
	LED.df = [0, 1, 2, 3].map(n => $('#ledDf' + n));
	LED.trk = [0, 1, 2, 3].map(n => $('#trkDf' + n));
	LED.fps = $('#sbFps'); LED.cpu = $('#sbCpu');
}
function setLed(el, state) { if (el._s !== state) { el._s = state; el.className = 'led' + (state ? ' ' + state : ''); } }
function setText(el, t) { if (el._t !== t) { el._t = t; el.textContent = t; } }
function resetLeds() {
	setLed(LED.power, ''); setLed(LED.hd, '');
	for (let n = 0; n < 4; n++) { setLed(LED.df[n], 'off'); setText(LED.trk[n], '--'); }
	setText(LED.fps, '0.0'); setText(LED.cpu, '0');
}
function status(t) { $('#sbMsg').textContent = t; }

/* ---------- Starten / Beenden ---------- */
async function startEmu() {
	if (RT.running || RT.starting) return;
	if (!buildConfig()) return;
	RT.starting = true;
	$('#btnStart').disabled = true;
	status('Starte…');
	showEmuWindow(true);
	let err = await sae.start();
	if (err !== SAEE_None && err === SAEE_Audio_RequiresWebAudio && !RT.forceScriptProcessor) {
		RT.forceScriptProcessor = true;
		buildConfig();
		err = await sae.start();
	}
	RT.starting = false;
	$('#btnStart').disabled = false;
	if (err !== SAEE_None) {
		showEmuWindow(false);
		status('Bereit');
		await msgBox(saeErrText(err));
		openDialog();
		return;
	}
}

function onStarted() {
	RT.running = true;
	RT.startedAt = Date.now();
	RT.paused = false;
	RT.modified = [false, false, false, false];
	RT.hwAtStart = hwSignature();
	updateSaveBtn();
	readBackAfterStart();
	updateTitle();
	status(RT.forceScriptProcessor || IS_FILE ? 'Läuft (Ton über Ersatzweg)' : 'Läuft');
	closeDialog(true);
	layoutScreen();
	setTimeout(layoutScreen, 50);
	RT.startWaiters.splice(0).forEach(f => f());
	$('#focusHint').hidden = false;
	setTimeout(() => { $('#focusHint').hidden = true; }, 7000);
}

function onStopped() {
	RT.running = false;
	RT.paused = false;
	setPaused(false);
	resetLeds();
	status('Ausgeschaltet');
	RT.stopWaiters.splice(0).forEach(f => f());
}

function stopEmu() {
	return new Promise(resolve => {
		if (!RT.running) { resolve(); return; }
		RT.stopWaiters.push(resolve);
		if (sae.stop() !== SAEE_None) { RT.stopWaiters = []; RT.running = false; resolve(); }
	});
}

/* Nach dem Start: vom Kern korrigierte Werte zurück in den Dialog holen */
function readBackAfterStart() {
	S.cpu.model = cfg.cpu.model;
	S.cpu.addr24 = !!cfg.cpu.addressSpace24;
	S.chip.mask = cfg.chipset.mask;
	S.mem.chip = cfg.memory.chipSize >> 10;
	S.mem.slow = cfg.memory.bogoSize >> 10;
	S.mem.z2 = cfg.memory.z2FastSize >> 10;
	S.mem.z3 = cfg.memory.z3FastSize >> 10;
	saveSettings();
	renderAll();
}

/* Kennung aller Einstellungen, die nur mit Neustart wirken */
function hwSignature() {
	const s = clone(S);
	delete s.flt.scan; delete s.flt.vig; delete s.flt.glow;
	delete s.vid.scale; delete s.misc; delete s.page; delete s.lastDisks;
	s.fd.drives.forEach(d => delete d.wp);
	delete s.fd.speed;
	return JSON.stringify(s) + '|' + (S.romSrc === 'file' && FILES.rom ? FILES.rom.crc32 : '') + '|' + FILES.hd.map(f => f ? f.crc32 : '').join(',');
}

function setPaused(p) {
	RT.paused = p;
	$('#pausedBadge').hidden = !p || RT.dialogOpen;
	const b = $('#tbPause');
	b.querySelector('use').setAttribute('href', p ? '#i-resume' : '#i-pause');
	b.querySelector('span').textContent = p ? 'Weiter' : 'Pause';
	if (RT.running) status(p ? 'Angehalten' : 'Läuft');
}
function togglePause() {
	if (!RT.running) return;
	sae.pause(!RT.paused);
}
function toggleMute() {
	RT.muted = !RT.muted;
	if (RT.running) sae.mute(RT.muted);
	const b = $('#tbMute');
	b.querySelector('use').setAttribute('href', RT.muted ? '#i-mute' : '#i-vol');
	b.classList.toggle('active', RT.muted);
}
function hardReset() {
	if (RT.running) sae.reset(true, false);
}

function updateTitle() {
	const rom = S.romSrc === 'aros' ? 'AROS' : (FILES.rom ? FILES.rom.name.replace(/\.rom$/i, '') : 'Kickstart');
	const df0 = FILES.df[0] ? ' – ' + FILES.df[0].name : '';
	$('#emuTitle').textContent = APP_NAME + ' – Amiga ' + MODELS[S.model].name + ' (' + rom + ')' + df0;
	document.title = FILES.df[0] && RT.running ? FILES.df[0].name + ' – ' + APP_NAME : APP_NAME;
}

/* =====================================================================
   Disketten zur Laufzeit
   ===================================================================== */
async function insertDisk(n, f, key) {
	if (RT.running && RT.modified[n]) await offerSave(n);
	FILES.df[n] = f;
	S.lastDisks[n] = key || null;
	if (n > 0 && f) S.fd.drives[n].on = true;
	saveSettings();
	if (RT.running) {
		const d = cfg.floppy.drive[n];
		if (d.type === SAEC_Config_Floppy_Type_None) {
			msgBox('Laufwerk DF' + n + ': war beim Start ausgeschaltet. Die Diskette wird beim nächsten Start eingelegt.');
		} else {
			copyFile(d.file, f);
			d.file.prot = S.fd.drives[n].wp;
			RT.modified[n] = false;
			sae.insert(n);
			status('DF' + n + ': ' + f.name + ' eingelegt');
		}
	}
	renderDrives();
	updateTitle();
}

async function ejectDisk(n) {
	if (RT.running && RT.modified[n]) await offerSave(n);
	FILES.df[n] = null;
	S.lastDisks[n] = null;
	saveSettings();
	if (RT.running) {
		cfg.floppy.drive[n].file.clr();
		sae.eject(n);
		RT.modified[n] = false;
		updateSaveBtn();
		status('DF' + n + ': ausgeworfen');
	}
	renderDrives();
	updateTitle();
}

/* Liest ausgewählte Dateien ein und legt die erste in Laufwerk n */
async function loadDiskFiles(files, n) {
	let first = null, firstKey = null, count = 0;
	for (const file of files) {
		try {
			const imgs = await AWFiles.readImages(file);
			for (const f of imgs) {
				if (/\.hdf$/i.test(f.name)) { msgBox('„' + esc(f.name) + '“ ist ein Festplatten-Image. Bitte unter <b>Festplatten</b> einbinden.'); continue; }
				const key = await collectDisk(f);
				if (!first) { first = f; firstKey = key; }
				count++;
			}
		} catch (e) {
			msgBox('„' + esc(file.name) + '“ konnte nicht gelesen werden.<br><br>' + esc(e.message || e));
		}
	}
	if (first && n !== null && n !== undefined) await insertDisk(n, first, firstKey);
	renderSwapper();
	renderHistory();
	if (count > 1) status(count + ' Disketten zur Sammlung hinzugefügt');
	return first;
}

async function pickDisk(n) {
	const files = await AWFiles.pick('.adf,.adz,.dms,.zip,.gz,.img,.st', true);
	if (files.length) await loadDiskFiles(files, n);
}

function diskData(n) {
	const d = sae.getDisk(n);
	if (!d) return null;
	const data = typeof d.data === 'string' ? d.data : AWFiles.bytesToBin(d.data);
	return { name: d.name, data: data, size: data.length, crc32: AWFiles.crc32(data) };
}

async function offerSave(n) {
	const r = await msgBox('Die Diskette in DF' + n + ': wurde vom Amiga beschrieben. Änderungen sichern?', ['Im Browser sichern', 'Als Datei speichern', 'Verwerfen']);
	if (r === 2) return;
	const f = diskData(n);
	if (!f) return;
	if (r === 0) { await collectDisk(f); status('Änderungen an ' + f.name + ' gesichert'); }
	if (r === 1) AWFiles.download(f.name, f.data);
	sae.markDiskSaved(n);
	RT.modified[n] = false;
	updateSaveBtn();
}

async function saveModifiedDisks() {
	let any = false;
	for (let n = 0; n < 4; n++) {
		if (!RT.modified[n]) continue;
		const f = diskData(n);
		if (!f) continue;
		any = true;
		const key = await collectDisk(f);
		FILES.df[n] = f; S.lastDisks[n] = key;
		AWFiles.download(f.name, f.data);
		sae.markDiskSaved(n);
		RT.modified[n] = false;
	}
	saveSettings();
	updateSaveBtn();
	renderSwapper(); renderHistory();
	if (any) status('Veränderte Disketten gespeichert');
}
function updateSaveBtn() { $('#tbSave').disabled = !RT.modified.some(Boolean); }

/* Automatisches Sichern beschriebener Disketten im Browser */
setInterval(async () => {
	if (!RT.running || !S.misc.remember) return;
	for (let n = 0; n < 4; n++) {
		if (!RT.modified[n]) continue;
		const f = diskData(n);
		if (!f) continue;
		const oldKey = S.lastDisks[n];
		const key = await collectDisk(f);
		if (oldKey && oldKey !== key && DISKS.some(d => d.key === oldKey && d.name === f.name)) await forgetDisk(oldKey);
		FILES.df[n] = f; S.lastDisks[n] = key;
		saveSettings();
	}
}, 20000);

/* =====================================================================
   Bildschirm, Vollbild, Bildschirmfoto
   ===================================================================== */
function showEmuWindow(show) {
	$('#emuWin').hidden = !show;
	$('#offScreen').hidden = true;
	document.body.classList.toggle('emu-on', show);
}

function layoutScreen() {
	const wrap = $('#screenWrap'), box = $('#screenBox');
	if (!wrap || $('#emuWin').hidden) return;
	const aw = wrap.clientWidth, ah = wrap.clientHeight;
	const bw = SAEC_Video_DEF_AMIGA_WIDTH, bh = SAEC_Video_DEF_AMIGA_HEIGHT;
	const aspect = bw / bh;
	let w, h;
	if (S.vid.scale === 'int') {
		const k = Math.max(1, Math.floor(Math.min(aw / bw, ah / bh)));
		w = bw * k; h = bh * k;
		if (w > aw) { w = aw; h = w / aspect; }
	} else if (S.vid.scale === '1') {
		w = Math.min(bw * 2, aw); h = w / aspect;
		if (h > ah) { h = ah; w = h * aspect; }
	} else if (S.vid.scale === '2') {
		w = Math.min(bw * 3, aw); h = w / aspect;
		if (h > ah) { h = ah; w = h * aspect; }
	} else {
		w = aw; h = w / aspect;
		if (h > ah) { h = ah; w = h * aspect; }
	}
	box.style.setProperty('--sw', Math.floor(w) + 'px');
	box.style.setProperty('--sh', Math.floor(h) + 'px');
}
window.addEventListener('resize', layoutScreen);

function applyLiveDisplay() {
	const box = $('#screenBox');
	box.style.setProperty('--scan', (S.flt.scan / 100).toFixed(2));
	box.style.setProperty('--vig', (S.flt.vig / 100).toFixed(2));
	box.style.setProperty('--glow', (S.flt.glow / 100 * 6).toFixed(1) + 'px');
	box.classList.toggle('smooth', S.vid.smooth);
	$('#emuWin').classList.toggle('no-status', !S.misc.status);
	$('#emuWin').classList.toggle('no-toolbar', !S.misc.toolbar);
	layoutScreen();
}

function toggleFullscreen() {
	const el = $('#screenWrap');
	try {
		if (document.fullscreenElement) document.exitFullscreen();
		else if (el.requestFullscreen) el.requestFullscreen().catch(() => status('Vollbild ist hier nicht erlaubt'));
	} catch (e) { status('Vollbild ist hier nicht erlaubt'); }
}
document.addEventListener('fullscreenchange', () => setTimeout(layoutScreen, 60));

function screenshot() {
	const c = $('#amigaVideo canvas');
	if (!c) return;
	try {
		c.toBlob(b => {
			if (!b) return;
			const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
			AWFiles.download('amiga-' + stamp + '.png', b);
			status('Bildschirmfoto gespeichert');
		}, 'image/png');
	} catch (e) { status('Bildschirmfoto nicht möglich'); }
}

/* Tastatur und Maus an den Amiga geben bzw. zurückholen */
function focusAmiga(on) {
	const target = on ? ($('#amigaVideo canvas') || $('#amigaVideo')) : $('#propWin');
	try { target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); }
	catch (e) { try { target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })); } catch (e2) { /* egal */ } }
}

/* =====================================================================
   Dialog
   ===================================================================== */
function openDialog() {
	RT.snapshot = clone(S);
	RT.snapFiles = { rom: FILES.rom, ext: FILES.ext, key: FILES.key, hd: FILES.hd.slice() };
	RT.dialogOpen = true;
	$('#propLayer').hidden = false;
	$('#propLayer').classList.toggle('over', RT.running);
	$('#offScreen').hidden = true;
	if (RT.running) {
		focusAmiga(false);
		if (S.misc.pauseDlg && !RT.paused) { RT.pausedByDialog = true; sae.pause(true); }
		if (document.fullscreenElement) document.exitFullscreen();
	}
	updateDialogButtons();
	renderAll();
	setPaused(RT.paused);
	const sel = $('.tree a.sel') || $('#btnStart');
	setTimeout(() => sel.focus(), 0);
}

function closeDialog(fromStart) {
	RT.dialogOpen = false;
	$('#propLayer').hidden = true;
	if (RT.running) {
		if (RT.pausedByDialog) { RT.pausedByDialog = false; sae.pause(false); }
		focusAmiga(true);
		applyLiveDisplay();
	} else if (!fromStart) {
		$('#offScreen').hidden = false;
	}
	setPaused(RT.paused);
	saveSettings();
}

function updateDialogButtons() {
	$('#btnStart').textContent = RT.running ? 'OK' : 'Start';
	$('#btnReset').disabled = !RT.running;
	$('#propCaption').textContent = APP_NAME + ' – Eigenschaften' + (RT.running ? ' (Emulation läuft)' : '');
}

async function onOk() {
	saveSettings();
	if (!RT.running) { await startEmu(); return; }
	if (hwSignature() !== RT.hwAtStart) {
		const r = await msgBox('Du hast Einstellungen geändert, die erst nach einem Neustart des Amiga wirken. Jetzt neu starten?', ['Neu starten', 'Später']);
		if (r === 0) {
			closeDialog(true);
			await saveDisksBeforeStop();
			await stopEmu();
			await startEmu();
			return;
		}
	}
	closeDialog();
}

async function onCancel() {
	if (RT.snapshot) {
		S = RT.snapshot;
		Object.assign(FILES, { rom: RT.snapFiles.rom, ext: RT.snapFiles.ext, key: RT.snapFiles.key, hd: RT.snapFiles.hd });
	}
	if (RT.running) closeDialog();
	else { renderAll(); RT.snapshot = clone(S); }
}

async function saveDisksBeforeStop() {
	for (let n = 0; n < 4; n++) if (RT.running && RT.modified[n]) await offerSave(n);
}

async function onQuit() {
	if (RT.running) {
		const r = await msgBox('Emulation beenden? Ungesicherte Arbeit im Amiga geht verloren.', ['Beenden', 'Abbrechen']);
		if (r !== 0) return;
		await saveDisksBeforeStop();
		await stopEmu();
	}
	saveSettings();
	RT.dialogOpen = false;
	$('#propLayer').hidden = true;
	showEmuWindow(false);
	$('#offScreen').hidden = false;
}

/* ---------- Nachrichtenfenster ---------- */
let msgResolve = null;
function msgBox(html, buttons) {
	buttons = buttons || ['OK'];
	return new Promise(resolve => {
		if (msgResolve) msgResolve(-1);
		msgResolve = resolve;
		$('#msgText').innerHTML = html;
		const bar = $('#msgBtns');
		bar.innerHTML = '';
		buttons.forEach((t, i) => {
			const b = document.createElement('button');
			b.className = 'btn' + (i === 0 ? ' default' : '');
			b.textContent = t;
			b.onclick = () => { $('#msgLayer').hidden = true; msgResolve = null; resolve(i); };
			bar.appendChild(b);
		});
		$('#msgLayer').hidden = false;
		if (RT.running && !RT.dialogOpen) focusAmiga(false);
		setTimeout(() => bar.firstChild.focus(), 0);
	});
}

/* =====================================================================
   Seiten
   ===================================================================== */
const PAGE_TITLES = {};
function initTree() {
	const sel = $('#treeSelect');
	$$('#tree a[data-page]').forEach(a => {
		PAGE_TITLES[a.dataset.page] = a.textContent.trim();
		const o = document.createElement('option');
		o.value = a.dataset.page; o.textContent = a.textContent.trim();
		sel.appendChild(o);
		a.addEventListener('click', e => { e.preventDefault(); showPage(a.dataset.page); });
	});
	sel.addEventListener('change', () => showPage(sel.value));
	document.addEventListener('click', e => {
		const g = e.target.closest('[data-goto]');
		if (g) { e.preventDefault(); showPage(g.dataset.goto); }
	});
	$('#tree').addEventListener('keydown', e => {
		const links = $$('#tree a[data-page]');
		const i = links.indexOf(document.activeElement);
		if (i < 0) return;
		if (e.key === 'ArrowDown' && i < links.length - 1) { e.preventDefault(); links[i + 1].focus(); showPage(links[i + 1].dataset.page); }
		if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); links[i - 1].focus(); showPage(links[i - 1].dataset.page); }
	});
}
function showPage(id) {
	if (!PAGE_TITLES[id]) id = 'quickstart';
	S.page = id;
	$$('.page').forEach(p => { p.hidden = p.dataset.page !== id; });
	$$('#tree a[data-page]').forEach(a => {
		a.classList.toggle('sel', a.dataset.page === id);
		a.setAttribute('aria-selected', a.dataset.page === id);
	});
	$('#treeSelect').value = id;
	renderPage(id);
}

function renderAll() {
	renderPage(S.page);
	updateDialogButtons();
}
function renderPage(id) {
	switch (id) {
		case 'about': renderAbout(); break;
		case 'quickstart': renderQuickstart(); break;
		case 'configs': renderConfigs(); break;
		case 'cpu': renderCpu(); break;
		case 'chipset': renderChipset(); break;
		case 'rom': renderRom(); break;
		case 'ram': renderRam(); break;
		case 'floppy': renderFloppy(); break;
		case 'hd': renderHd(); break;
		case 'display': renderDisplay(); break;
		case 'sound': renderSound(); break;
		case 'ports': renderPorts(); break;
		case 'input': $('#inKeyboard').checked = S.keyboard; break;
		case 'filter': renderFilter(); break;
		case 'swapper': renderSwapper(); break;
		case 'misc': renderMisc(); break;
	}
}

/* Hilfsfunktionen für Formularelemente */
function setRadio(name, v) { $$('input[name="' + name + '"]').forEach(r => { r.checked = String(r.value) === String(v); }); }
function onRadio(name, fn) { $$('input[name="' + name + '"]').forEach(r => r.addEventListener('change', () => { if (r.checked) { fn(r.value); saveSettings(); } })); }
function onChk(id, fn) { $('#' + id).addEventListener('change', e => { fn(e.target.checked); saveSettings(); }); }
function onSel(id, fn) { $('#' + id).addEventListener('change', e => { fn(e.target.value); saveSettings(); }); }
function fillSelect(sel, items, value) {
	sel.innerHTML = '';
	items.forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o); });
	sel.value = String(value);
}

/* ---------- Über ---------- */
function renderAbout() {
	$('#aboutVersion').textContent = 'Oberfläche 1.0 · Emulationskern SAE ' + SAEC_Version + '.' + SAEC_Revision + '.' + SAEC_Patch;
}

/* ---------- Schnellstart ---------- */
function renderQuickstart() {
	fillSelect($('#qsModel'), Object.keys(MODELS).map(k => [k, MODELS[k].name]), S.model);
	fillSelect($('#qsConfig'), MODELS[S.model].cfgs.map((t, i) => [i, t]), S.modelCfg);
	$('#qsNtsc').checked = S.ntsc;
	$('#qsCompat').value = S.compat;
	$('#qsCompatText').textContent = COMPAT_TXT[S.compat];
	$('#qsRom').value = S.romSrc;
	$('#qsRomPick').hidden = S.romSrc !== 'file';
	$('#qsRomInfo').innerHTML = romInfoText();
	$('#qsMode').checked = S.misc.quickstartMode;
	renderDrives();
	renderHistory();
}
function initQuickstart() {
	onSel('qsModel', v => { S.model = v; S.modelCfg = 0; applyPreset(); renderQuickstart(); });
	onSel('qsConfig', v => { S.modelCfg = Number(v); applyPreset(); renderQuickstart(); });
	onChk('qsNtsc', v => { S.ntsc = v; });
	$('#qsCompat').addEventListener('input', e => {
		S.compat = Number(e.target.value); applyCompat();
		$('#qsCompatText').textContent = COMPAT_TXT[S.compat]; saveSettings();
	});
	onSel('qsRom', v => { S.romSrc = v; renderQuickstart(); if (v === 'file' && !FILES.rom) pickRom('rom'); });
	$('#qsRomPick').addEventListener('click', () => pickRom('rom'));
	onChk('qsMode', v => { S.misc.quickstartMode = v; });
	$('#qsDemo').addEventListener('click', async e => {
		e.preventDefault();
		await insertDisk(0, AWDemoDisk.make(), null);
		status('Demo-Diskette in DF0: eingelegt');
		if (RT.running) sae.reset(true, false);
	});

	$$('.drive .pick').forEach(b => b.addEventListener('click', () => pickDisk(Number(b.dataset.unit))));
	$$('.drive .eject').forEach(b => b.addEventListener('click', () => ejectDisk(Number(b.dataset.unit))));
	$$('.drive .info').forEach(b => b.addEventListener('click', () => diskInfo(Number(b.dataset.unit))));
	$$('.drive .wp').forEach(c => c.addEventListener('change', () => { S.fd.drives[c.dataset.unit].wp = c.checked; saveSettings(); }));
	$$('.drive .den').forEach(c => c.addEventListener('change', () => { S.fd.drives[c.dataset.unit].on = c.checked; saveSettings(); renderDrives(); }));
	$$('.drive .hist').forEach(s => s.addEventListener('change', async () => {
		const n = Number(s.dataset.unit);
		if (!s.value) return;
		if (s.value === '@demo') { await insertDisk(n, AWDemoDisk.make(), null); return; }
		const f = await getDisk(s.value);
		if (f) await insertDisk(n, f, s.value);
		else { msgBox('Diese Diskette ist nicht mehr im Browser gespeichert. Bitte erneut auswählen.'); await forgetDisk(s.value); renderHistory(); }
	}));
}

function renderDrives() {
	$$('.drive').forEach(el => {
		const n = Number(el.dataset.unit);
		const on = n === 0 || S.fd.drives[n].on;
		const den = el.querySelector('.den'); if (den) den.checked = on;
		el.querySelector('.wp').checked = S.fd.drives[n].wp;
		el.querySelector('.pick').disabled = !on;
		el.querySelector('.eject').disabled = !FILES.df[n];
		el.querySelector('.info').disabled = !FILES.df[n];
		el.querySelector('.wp').disabled = !on;
		el.querySelector('.wp').parentNode.classList.toggle('dim', !on);
		el.querySelector('.hist').disabled = !on;
	});
	renderHistory();
	if (!$('.page[data-page="floppy"]').hidden) renderFloppy();
}

function renderHistory() {
	$$('.drive .hist').forEach(s => {
		const n = Number(s.dataset.unit);
		const cur = FILES.df[n];
		const curKey = S.lastDisks[n];
		s.innerHTML = '';
		const o0 = document.createElement('option');
		o0.value = ''; o0.textContent = cur ? cur.name + '  (eingelegt)' : '';
		s.appendChild(o0);
		const od = document.createElement('option');
		od.value = '@demo'; od.textContent = '★ Demo-Diskette (eingebaut)';
		s.appendChild(od);
		DISKS.forEach(d => {
			if (d.key === curKey) return;
			const o = document.createElement('option');
			o.value = d.key; o.textContent = d.name;
			s.appendChild(o);
		});
		s.value = '';
	});
}

function diskInfo(n) {
	const f = FILES.df[n];
	if (!f) return;
	const di = new SAEO_DiskInfo();
	copyFile(cfg.floppy.drive[n].file, f);
	let extra = '';
	try {
		if (sae.getDiskInfo(di, n) === SAEE_None) {
			extra = '<tr><td>Diskettenname</td><td>' + esc(di.diskname || '–') + '</td></tr>' +
				'<tr><td>Dichte</td><td>' + (di.hd ? 'HD (1,76 MB)' : 'DD (880 KB)') + '</td></tr>' +
				'<tr><td>Bootblock</td><td>' + (di.bootblockChecksumValid ? 'gültig, bootfähig' : di.bootblockChecksum === false ? 'unbekannt' : 'nicht bootfähig') + '</td></tr>';
		}
	} catch (e) { /* Info optional */ }
	if (!RT.running) cfg.floppy.drive[n].file.clr();
	msgBox('<table class="info-tab"><tr><td>Datei</td><td>' + esc(f.name) + '</td></tr><tr><td>Größe</td><td>' + fmtBytes(f.size) +
		'</td></tr><tr><td>CRC32</td><td class="mono">' + f.crc32.toString(16).toUpperCase().padStart(8, '0') + '</td></tr>' + extra + '</table>');
}

/* ---------- Konfigurationen ---------- */
let cfgSelected = null;
function renderConfigs() {
	const all = lsGet(LS_CONFIGS, {});
	const box = $('#cfgList');
	box.innerHTML = '';
	const names = Object.keys(all).sort((a, b) => a.localeCompare(b, 'de'));
	if (!names.length) box.innerHTML = '<p class="empty">Noch keine Konfiguration gespeichert. Gib unten einen Namen ein und klicke auf „Speichern“.</p>';
	names.forEach(name => {
		const c = all[name];
		const div = document.createElement('div');
		div.className = 'li' + (name === cfgSelected ? ' sel' : '');
		div.setAttribute('role', 'option');
		div.tabIndex = 0;
		div.innerHTML = '<b>' + esc(name) + '</b><span>' + esc(c.desc || (MODELS[c.s.model] ? MODELS[c.s.model].name : '')) + '</span>';
		div.onclick = () => { cfgSelected = name; $('#cfgName').value = name; $('#cfgDesc').value = c.desc || ''; renderConfigs(); };
		div.ondblclick = () => loadConfig(name);
		box.appendChild(div);
	});
}
function loadConfig(name) {
	const all = lsGet(LS_CONFIGS, {});
	if (!all[name]) return;
	const keep = { page: S.page, lastDisks: S.lastDisks };
	S = mergeDeep(clone(DEFAULTS), all[name].s);
	Object.assign(S, keep);
	saveSettings();
	renderAll();
	status('Konfiguration „' + name + '“ geladen');
	msgBox('Konfiguration „' + esc(name) + '“ geladen.');
}
function initConfigs() {
	$('#cfgSave').onclick = () => {
		const name = $('#cfgName').value.trim();
		if (!name) { msgBox('Bitte zuerst einen Namen für die Konfiguration eingeben.'); return; }
		const all = lsGet(LS_CONFIGS, {});
		const s = clone(S); delete s.page; delete s.lastDisks;
		all[name] = { desc: $('#cfgDesc').value.trim(), s: s, ts: Date.now() };
		lsSet(LS_CONFIGS, all);
		cfgSelected = name;
		renderConfigs();
	};
	$('#cfgLoad').onclick = () => { if (cfgSelected) loadConfig(cfgSelected); else msgBox('Bitte erst eine Konfiguration in der Liste anklicken.'); };
	$('#cfgDelete').onclick = async () => {
		if (!cfgSelected) return;
		if (await msgBox('Konfiguration „' + esc(cfgSelected) + '“ löschen?', ['Löschen', 'Abbrechen']) !== 0) return;
		const all = lsGet(LS_CONFIGS, {}); delete all[cfgSelected]; lsSet(LS_CONFIGS, all);
		cfgSelected = null; renderConfigs();
	};
	$('#cfgExport').onclick = () => {
		const s = clone(S); delete s.page; delete s.lastDisks;
		const name = ($('#cfgName').value.trim() || 'amiga-' + S.model).replace(/[^\w\-äöüÄÖÜß ]+/g, '_');
		AWFiles.download(name + '.amigawerk.json', new Blob([JSON.stringify({ app: APP_NAME, name: name, desc: $('#cfgDesc').value, s: s }, null, 2)], { type: 'application/json' }));
	};
	$('#cfgImport').onclick = async () => {
		const files = await AWFiles.pick('.json', false);
		if (!files.length) return;
		try {
			const j = JSON.parse(await files[0].text());
			if (!j.s) throw new Error('keine Einstellungen gefunden');
			const all = lsGet(LS_CONFIGS, {});
			const name = j.name || files[0].name.replace(/\.json$/i, '');
			all[name] = { desc: j.desc || '', s: j.s, ts: Date.now() };
			lsSet(LS_CONFIGS, all);
			cfgSelected = name;
			loadConfig(name);
		} catch (e) { msgBox('Die Datei ist keine gültige Konfiguration: ' + esc(e.message)); }
	};
	$('#cfgDefaults').onclick = async () => {
		if (await msgBox('Alle Einstellungen auf die Werkseinstellungen zurücksetzen?', ['Zurücksetzen', 'Abbrechen']) !== 0) return;
		const keep = S.lastDisks;
		S = clone(DEFAULTS); S.lastDisks = keep; S.page = 'configs';
		applyPreset(); saveSettings(); renderAll();
	};
	$('#cfgForget').onclick = async () => {
		if (await msgBox('Alle im Browser gespeicherten ROMs und Disketten löschen?', ['Löschen', 'Abbrechen']) !== 0) return;
		await AWFiles.store.clear();
		DISKS = []; DISK_CACHE.clear(); lsSet(LS_DISKS, DISKS);
		S.lastDisks = [null, null, null, null]; saveSettings();
		renderAll();
		status('Browser-Speicher geleert');
	};
}

/* ---------- CPU ---------- */
function renderCpu() {
	setRadio('cpuModel', S.cpu.model);
	setRadio('cpuSpeed', S.cpu.speed);
	const is32 = S.cpu.model >= 68020;
	$('#cpuAddr24').checked = !is32 || S.cpu.addr24;
	$('#cpuAddr24').disabled = !is32;
	$('#cpuCompat').checked = S.cpu.compatible;
}
function initCpu() {
	onRadio('cpuModel', v => {
		S.cpu.model = Number(v);
		if (S.cpu.model < 68020) { S.cpu.addr24 = true; S.mem.z3 = 0; }
		renderCpu();
	});
	onRadio('cpuSpeed', v => { S.cpu.speed = Number(v); });
	onChk('cpuAddr24', v => { S.cpu.addr24 = v; if (v) S.mem.z3 = 0; });
	onChk('cpuCompat', v => { S.cpu.compatible = v; });
}

/* ---------- Chipsatz ---------- */
const FEATURE_NAMES = { A500: 'Amiga 500', A500P: 'Amiga 500+', A600: 'Amiga 600', A1000: 'Amiga 1000', A1200: 'Amiga 1200', A2000: 'Amiga 2000', A3000: 'Amiga 3000', A4000: 'Amiga 4000' };
function renderChipset() {
	setRadio('chipMask', S.chip.mask);
	$('#chipNtsc').checked = S.ntsc;
	$('#chipBlitImm').checked = S.chip.blitImm;
	$('#chipBlitWait').value = S.chip.blitWait;
	setRadio('chipCol', S.chip.colLevel);
	$('#chipFeatures').textContent = 'Echtzeituhr, Gary/Gayle, CIA-Verhalten und IDE-Controller richten sich nach dem Modell „' + FEATURE_NAMES[S.model] + '“' +
		(S.ide ? ' (mit IDE-Controller).' : ' (ohne IDE-Controller).');
}
function initChipset() {
	onRadio('chipMask', v => {
		S.chip.mask = Number(v);
		S.snd.ftype = (S.chip.mask & SAEC_Config_Chipset_Mask_AGA) ? 1 : 0;
	});
	onChk('chipNtsc', v => { S.ntsc = v; });
	onChk('chipBlitImm', v => { S.chip.blitImm = v; });
	onSel('chipBlitWait', v => { S.chip.blitWait = Number(v); });
	onRadio('chipCol', v => { S.chip.colLevel = Number(v); });
}

/* ---------- ROM ---------- */
function romInfoText() {
	if (S.romSrc === 'aros') return 'AROS ist ein freier Nachbau des AmigaOS. Viele Spiele und Demos laufen damit, manche brauchen aber ein Original-Kickstart.';
	if (!FILES.rom) return '<span class="warn">Noch keine Kickstart-Datei geladen.</span>';
	const ri = romInfo(FILES.rom);
	return ri ? esc(ri) : esc(FILES.rom.name);
}
function romInfo(f) {
	try {
		const ri = new SAEO_RomInfo();
		const tmp = new SAEO_Config_File();
		copyFile(tmp, f);
		if (sae.getRomInfo(ri, tmp) === SAEE_None && ri.name) {
			let t = ri.name;
			if (ri.ver) t += ' – Version ' + ri.ver + '.' + ri.rev;
			if (ri.cpu) t += ' – benötigt ' + ri.cpu;
			if (ri.cloanto) t += ' – verschlüsselt (rom.key nötig)';
			return t;
		}
	} catch (e) { /* unbekannt */ }
	return null;
}
function renderRom() {
	setRadio('romSrc', S.romSrc);
	$('#romName').textContent = FILES.rom ? FILES.rom.name + ' (' + fmtBytes(FILES.rom.size) + ')' : '– keine Datei –';
	$('#extName').textContent = FILES.ext ? FILES.ext.name + ' (' + fmtBytes(FILES.ext.size) + ')' : '– keine Datei –';
	$('#keyName').textContent = FILES.key ? FILES.key.name : '– keine Datei –';
	$('#romClear').disabled = !FILES.rom; $('#extClear').disabled = !FILES.ext; $('#keyClear').disabled = !FILES.key;
	$('#romInfo').innerHTML = romInfoText();
	$('#romShifter').checked = S.romShifter;
}
async function pickRom(which) {
	const files = await AWFiles.pick(which === 'key' ? '.key' : '.rom,.bin,.a500,.a1200,.zip', false);
	if (!files.length) return;
	try {
		let f;
		if (/\.zip$/i.test(files[0].name)) {
			const u8 = new Uint8Array(await files[0].arrayBuffer());
			throw new Error('Bitte die ROM-Datei vorher aus dem ZIP-Archiv entpacken.' + (u8 ? '' : ''));
		}
		const u8 = new Uint8Array(await files[0].arrayBuffer());
		const bin = AWFiles.bytesToBin(u8);
		f = { name: files[0].name, data: bin, size: bin.length, crc32: AWFiles.crc32(bin) };
		if (which !== 'key' && [262144, 524288, 1048576, 524299, 262155, 1048587].indexOf(f.size) < 0)
			throw new Error('Eine Kickstart-Datei ist 256 KB, 512 KB oder 1 MB groß. Diese Datei hat ' + fmtBytes(f.size) + '.');
		FILES[which] = f;
		if (which === 'rom') { S.romSrc = 'file'; autoCpuForRom(f); }
		if (S.misc.remember) await AWFiles.store.put('rom:' + which, f);
		saveSettings();
		renderAll();
	} catch (e) { msgBox(esc(e.message || e)); }
}
/* Stellt die CPU passend ein, wenn die gewählte ROM mehr verlangt */
function autoCpuForRom(f) {
	try {
		const ri = new SAEO_RomInfo(); const tmp = new SAEO_Config_File(); copyFile(tmp, f);
		if (sae.getRomInfo(ri, tmp) !== SAEE_None) return;
		const need = ri.cpu || 0;
		if (need >= 68020 && S.cpu.model < need) {
			S.cpu.model = Math.min(need, 68030); S.cpu.addr24 = !!ri.addressSpace24;
			status('CPU auf ' + S.cpu.model + ' gestellt (von der ROM verlangt)');
		}
	} catch (e) { /* egal */ }
}
function initRom() {
	onRadio('romSrc', v => { S.romSrc = v; renderRom(); });
	$('#romPick').onclick = () => pickRom('rom');
	$('#extPick').onclick = () => pickRom('ext');
	$('#keyPick').onclick = () => pickRom('key');
	['rom', 'ext', 'key'].forEach(w => {
		$('#' + w + 'Clear').onclick = () => {
			FILES[w] = null; AWFiles.store.del('rom:' + w);
			if (w === 'rom') S.romSrc = 'aros';
			saveSettings(); renderRom();
		};
	});
	onChk('romShifter', v => { S.romShifter = v; });
}

/* ---------- RAM ---------- */
function stepIndex(steps, v) {
	let best = 0;
	steps.forEach((s, i) => { if (Math.abs(s - v) < Math.abs(steps[best] - v)) best = i; });
	return best;
}
function renderRam() {
	const is24 = S.cpu.model < 68020 || S.cpu.addr24;
	const ramsey = S.model === 'A3000' || S.model === 'A4000';
	Object.keys(MEM_STEPS).forEach(id => {
		const key = MEM_KEYS[id];
		const el = $('#' + id);
		el.value = stepIndex(MEM_STEPS[id], S.mem[key]);
		$('#' + id + 'Out').textContent = fmtKB(MEM_STEPS[id][el.value]);
	});
	$('#memZ3').disabled = is24;
	$('#memMbLow').disabled = !ramsey;
	$('#memMbHigh').disabled = !ramsey || is24;
	const hints = [];
	if (S.chip.mask === 0 && S.mem.chip > 512) hints.push('OCS-Agnus kann nur 512 KB Chip-RAM ansprechen – für mehr unter „Chipsatz“ ECS oder AGA wählen.');
	if (is24) hints.push('Zorro-III-Speicher braucht einen 68020/68030 ohne 24-Bit-Adressierung.');
	if (!ramsey) hints.push('Hauptplatinen-Speicher gibt es nur beim A3000 und A4000.');
	const total = S.mem.chip + S.mem.slow + S.mem.z2 + (is24 ? 0 : S.mem.z3) + (ramsey ? S.mem.mbLow + (is24 ? 0 : S.mem.mbHigh) : 0);
	hints.unshift('Gesamt: ' + fmtKB(total) + '.');
	$('#memHint').textContent = hints.join(' ');
}
function initRam() {
	Object.keys(MEM_STEPS).forEach(id => {
		$('#' + id).addEventListener('input', e => {
			S.mem[MEM_KEYS[id]] = MEM_STEPS[id][Number(e.target.value)];
			renderRam(); saveSettings();
		});
	});
}

/* ---------- Diskettenlaufwerke ---------- */
function renderFloppy() {
	const box = $('#fdRows');
	if (!box.children.length) {
		for (let n = 0; n < 4; n++) {
			const r = document.createElement('div');
			r.className = 'fd-row';
			r.innerHTML = '<label class="chk fd-on"><input type="checkbox" data-n="' + n + '"' + (n === 0 ? ' disabled' : '') + '> DF' + n + ':</label>' +
				'<select class="fd-type" data-n="' + n + '" aria-label="Laufwerkstyp DF' + n + '"><option value="1">3,5" DD</option><option value="2">3,5" HD</option><option value="6">5,25" SD</option></select>' +
				'<span class="file-name fd-name"></span>' +
				'<button class="btn fd-pick" data-n="' + n + '">…</button>' +
				'<button class="btn fd-eject" data-n="' + n + '">Auswerfen</button>' +
				'<label class="chk"><input type="checkbox" class="fd-wp" data-n="' + n + '"> Schreibschutz</label>';
			box.appendChild(r);
		}
		$$('.fd-on input', box).forEach(c => c.onchange = () => { S.fd.drives[c.dataset.n].on = c.checked; saveSettings(); renderDrives(); });
		$$('.fd-type', box).forEach(s => s.onchange = () => { S.fd.drives[s.dataset.n].type = Number(s.value); saveSettings(); });
		$$('.fd-pick', box).forEach(b => b.onclick = () => pickDisk(Number(b.dataset.n)));
		$$('.fd-eject', box).forEach(b => b.onclick = () => ejectDisk(Number(b.dataset.n)));
		$$('.fd-wp', box).forEach(c => c.onchange = () => { S.fd.drives[c.dataset.n].wp = c.checked; saveSettings(); renderDrives(); });
	}
	$$('.fd-row', box).forEach((r, n) => {
		const on = n === 0 || S.fd.drives[n].on;
		r.querySelector('.fd-on input').checked = on;
		r.querySelector('.fd-type').value = S.fd.drives[n].type;
		r.querySelector('.fd-type').disabled = !on || RT.running;
		r.querySelector('.fd-name').textContent = FILES.df[n] ? FILES.df[n].name : (on ? '– leer –' : '– aus –');
		r.querySelector('.fd-pick').disabled = !on;
		r.querySelector('.fd-eject').disabled = !FILES.df[n];
		r.querySelector('.fd-wp').checked = S.fd.drives[n].wp;
		r.classList.toggle('off', !on);
	});
	$('#fdSpeed').value = Math.max(0, FD_SPEEDS.indexOf(S.fd.speed));
	$('#fdSpeedOut').textContent = FD_SPEED_TXT[$('#fdSpeed').value];
}
function initFloppy() {
	$('#fdSpeed').addEventListener('input', e => {
		S.fd.speed = FD_SPEEDS[Number(e.target.value)];
		$('#fdSpeedOut').textContent = FD_SPEED_TXT[e.target.value];
		saveSettings();
	});
	$('#fdNewType').onchange = () => {
		const pc = Number($('#fdNewType').value) > 2;
		$('#fdNewFfs').disabled = pc; $('#fdNewBoot').disabled = pc;
	};
	$('#fdNewCreate').onclick = async () => {
		const n = Number($('#fdNewUnit').value);
		const type = Number($('#fdNewType').value);
		const label = $('#fdNewLabel').value.trim() || 'Leer';
		const name = label.replace(/\s+/g, '_') + '.adf';
		if (sae.createDisk(n, name, SAEC_Disk_Create_Mode_Normal, type, label, $('#fdNewFfs').checked, $('#fdNewBoot').checked) !== SAEE_None) {
			msgBox('Die Diskette konnte nicht erzeugt werden.'); return;
		}
		const src = cfg.floppy.drive[n].file;
		const data = typeof src.data === 'string' ? src.data : AWFiles.bytesToBin(src.data);
		const f = { name: name, data: data, size: data.length, crc32: AWFiles.crc32(data) };
		S.fd.drives[n].type = type === 2 ? 2 : 1;
		const key = await collectDisk(f);
		await insertDisk(n, f, key);
		status('Leere Diskette „' + label + '“ in DF' + n + ': eingelegt');
	};
}

/* ---------- Festplatten ---------- */
function renderHd() {
	const box = $('#hdRows');
	if (!box.children.length) {
		for (let n = 0; n < 4; n++) {
			const r = document.createElement('div');
			r.className = 'fd-row';
			r.innerHTML = '<label class="chk fd-on"><input type="checkbox" data-n="' + n + '"> IDE' + n + ':</label>' +
				'<span class="file-name hd-name"></span>' +
				'<button class="btn hd-pick" data-n="' + n + '">Datei wählen…</button>' +
				'<button class="btn hd-del" data-n="' + n + '">Entfernen</button>' +
				'<label class="chk"><input type="checkbox" class="hd-ro" data-n="' + n + '"> Nur lesen</label>';
			box.appendChild(r);
		}
		$$('.fd-on input', box).forEach(c => c.onchange = () => { S.hd[c.dataset.n].on = c.checked; saveSettings(); renderHd(); });
		$$('.hd-ro', box).forEach(c => c.onchange = () => { S.hd[c.dataset.n].ro = c.checked; saveSettings(); });
		$$('.hd-del', box).forEach(b => b.onclick = () => { FILES.hd[b.dataset.n] = null; renderHd(); });
		$$('.hd-pick', box).forEach(b => b.onclick = async () => {
			const n = Number(b.dataset.n);
			const files = await AWFiles.pick('.hdf,.zip', false);
			if (!files.length) return;
			try {
				const imgs = await AWFiles.readImages(files[0]);
				const f = imgs[0];
				if (f.size < 512 * 1024) throw new Error('Die Datei ist zu klein für ein Festplatten-Image.');
				FILES.hd[n] = f; S.hd[n].on = true; saveSettings(); renderHd();
			} catch (e) { msgBox(esc(e.message || e)); }
		});
	}
	const ide = !!S.ide;
	$$('.fd-row', box).forEach((r, n) => {
		r.querySelector('.fd-on input').checked = S.hd[n].on;
		r.querySelector('.fd-on input').disabled = !ide;
		r.querySelector('.hd-name').textContent = FILES.hd[n] ? FILES.hd[n].name + ' (' + fmtBytes(FILES.hd[n].size) + ')' : '– keine Datei –';
		r.querySelector('.hd-pick').disabled = !ide;
		r.querySelector('.hd-del').disabled = !FILES.hd[n];
		r.querySelector('.hd-ro').checked = S.hd[n].ro;
		r.classList.toggle('off', !ide || !S.hd[n].on);
	});
	$('#hdHint').innerHTML = ide
		? 'Hardfiles (.hdf) werden als IDE-Festplatte eingebunden. Mit Kickstart 2.0 oder neuer bzw. AROS bootet der Amiga davon. Festplatten-Images bleiben nur bis zum Schließen der Seite geladen.'
		: '<span class="warn">Das Modell ' + MODELS[S.model].name + ' hat keinen IDE-Controller.</span> Festplatten gehen mit A600, A1200 oder A4000 (im <a href="#" data-goto="quickstart">Schnellstart</a> wählen).';
}

/* ---------- Anzeige ---------- */
function renderDisplay() {
	$('#vidRes').value = S.vid.res; $('#vidLine').value = S.vid.line; $('#vidApi').value = S.vid.api;
	$('#vidScale').value = S.vid.scale; $('#vidCursor').value = S.vid.cursor;
	$('#vidSkip').checked = S.vid.skip; $('#vidCenterX').checked = S.vid.cx; $('#vidCenterY').checked = S.vid.cy; $('#vidSmooth').checked = S.vid.smooth;
	$('#vidApi').querySelector('option[value="1"]').disabled = !inf.video.webGL;
}
function initDisplay() {
	onSel('vidRes', v => { S.vid.res = Number(v); });
	onSel('vidLine', v => { S.vid.line = Number(v); });
	onSel('vidApi', v => { S.vid.api = Number(v); });
	onSel('vidScale', v => { S.vid.scale = v; layoutScreen(); });
	onSel('vidCursor', v => { S.vid.cursor = Number(v); });
	onChk('vidSkip', v => { S.vid.skip = v; });
	onChk('vidCenterX', v => { S.vid.cx = v; });
	onChk('vidCenterY', v => { S.vid.cy = v; });
	onChk('vidSmooth', v => { S.vid.smooth = v; applyLiveDisplay(); });
}

/* ---------- Sound ---------- */
function renderSound() {
	setRadio('sndMode', S.snd.mode);
	$('#sndFreq').value = S.snd.freq; $('#sndCh').value = S.snd.ch; $('#sndSep').value = S.snd.sep;
	$('#sndSepOut').textContent = (S.snd.sep * 10) + ' %';
	$('#sndDelay').value = S.snd.delay; $('#sndInterp').value = S.snd.interp;
	$('#sndFilter').value = S.snd.filter; $('#sndFilterType').value = S.snd.ftype;
	const off = S.snd.mode < 2;
	['sndFreq', 'sndCh', 'sndSep', 'sndDelay', 'sndInterp', 'sndFilter', 'sndFilterType'].forEach(id => { $('#' + id).disabled = off; });
}
function initSound() {
	onRadio('sndMode', v => { S.snd.mode = Number(v); renderSound(); });
	onSel('sndFreq', v => { S.snd.freq = Number(v); });
	onSel('sndCh', v => { S.snd.ch = Number(v); });
	$('#sndSep').addEventListener('input', e => { S.snd.sep = Number(e.target.value); $('#sndSepOut').textContent = (S.snd.sep * 10) + ' %'; saveSettings(); });
	onSel('sndDelay', v => { S.snd.delay = Number(v); });
	onSel('sndInterp', v => { S.snd.interp = Number(v); });
	onSel('sndFilter', v => { S.snd.filter = Number(v); });
	onSel('sndFilterType', v => { S.snd.ftype = Number(v); });
}

/* ---------- Gameports ---------- */
function gamepads() {
	const out = [];
	try { const g = navigator.getGamepads ? navigator.getGamepads() : []; for (let i = 0; i < g.length; i++) if (g[i]) out.push([i, (i + 1) + ': ' + g[i].id.slice(0, 50)]); }
	catch (e) { /* keine Gamepads */ }
	return out;
}
function renderPorts() {
	const pads = gamepads();
	$$('[data-port]').forEach(grid => {
		const p = Number(grid.dataset.port), sp = S.ports[p];
		if (!grid.children.length) {
			grid.innerHTML =
				'<label for="pType' + p + '">Gerät:</label><select id="pType' + p + '"></select>' +
				'<label for="pMove' + p + '" class="kbd-only">Richtung:</label><select id="pMove' + p + '" class="kbd-only"><option value="1">Pfeiltasten</option><option value="2">Ziffernblock</option><option value="3">W A S D</option></select>' +
				'<label for="pF1' + p + '" class="kbd-only">Feuerknopf 1:</label><select id="pF1' + p + '" class="kbd-only"></select>' +
				'<label for="pF2' + p + '" class="kbd-only">Feuerknopf 2:</label><select id="pF2' + p + '" class="kbd-only"></select>' +
				'<label for="pDev' + p + '" class="pad-only">Gamepad:</label><select id="pDev' + p + '" class="pad-only"></select>';
			fillSelect($('#pType' + p), [[0, 'Nichts'], [1, 'Maus'], [2, 'Joystick (Gamepad am Rechner)'], [3, 'Joystick über Tastatur']], sp.type);
			fillSelect($('#pF1' + p), FIRE_KEYS, sp.f1);
			fillSelect($('#pF2' + p), FIRE_KEYS, sp.f2);
			$('#pType' + p).onchange = e => { S.ports[p].type = Number(e.target.value); if (S.ports[p].type === 1) { const o = S.ports[1 - p]; if (o.type === 1) o.type = 3; } saveSettings(); renderPorts(); };
			$('#pMove' + p).onchange = e => { S.ports[p].move = Number(e.target.value); saveSettings(); };
			$('#pF1' + p).onchange = e => { S.ports[p].f1 = e.target.value; saveSettings(); };
			$('#pF2' + p).onchange = e => { S.ports[p].f2 = e.target.value; saveSettings(); };
			$('#pDev' + p).onchange = e => { S.ports[p].dev = Number(e.target.value); saveSettings(); };
		}
		$('#pType' + p).value = sp.type;
		$('#pMove' + p).value = sp.move;
		$('#pF1' + p).value = sp.f1; $('#pF2' + p).value = sp.f2;
		fillSelect($('#pDev' + p), [[-1, pads.length ? '– bitte wählen –' : 'Kein Gamepad gefunden']].concat(pads), sp.dev);
		$$('.kbd-only', grid).forEach(e => { e.hidden = sp.type !== 3; });
		$$('.pad-only', grid).forEach(e => { e.hidden = sp.type !== 2; });
	});
	$('#padInfo').textContent = pads.length
		? pads.length + ' Gamepad(s) erkannt.'
		: 'Kein Gamepad erkannt. Gamepad anschließen und einmal einen Knopf drücken, dann diese Seite neu öffnen.';
}
window.addEventListener('gamepadconnected', () => { if (S.page === 'ports' && RT.dialogOpen) renderPorts(); });

/* ---------- Filter ---------- */
function renderFilter() {
	[['fltScan', 'scan', '%'], ['fltVig', 'vig', '%'], ['fltGlow', 'glow', '%'], ['fltLum', 'lum', ''], ['fltCon', 'con', ''], ['fltGam', 'gam', '']].forEach(([id, k, u]) => {
		$('#' + id).value = S.flt[k];
		$('#' + id + 'Out').textContent = (u ? S.flt[k] + ' %' : (S.flt[k] > 0 ? '+' : '') + (S.flt[k] / 10).toFixed(0));
	});
}
function initFilter() {
	[['fltScan', 'scan'], ['fltVig', 'vig'], ['fltGlow', 'glow'], ['fltLum', 'lum'], ['fltCon', 'con'], ['fltGam', 'gam']].forEach(([id, k]) => {
		$('#' + id).addEventListener('input', e => { S.flt[k] = Number(e.target.value); renderFilter(); applyLiveDisplay(); saveSettings(); });
	});
	$('#fltReset').onclick = () => { Object.assign(S.flt, clone(DEFAULTS.flt)); renderFilter(); applyLiveDisplay(); saveSettings(); };
}

/* ---------- Diskettenwechsler ---------- */
let swapSel = null;
function renderSwapper() {
	const box = $('#swapList');
	if (!box) return;
	box.innerHTML = '';
	if (!DISKS.length) {
		box.innerHTML = '<p class="empty">Noch keine Disketten gesammelt. Mit „Disketten hinzufügen…“ ADF-, DMS-, ADZ- oder ZIP-Dateien laden – oder einfach auf dieses Fenster ziehen.</p>';
	}
	DISKS.forEach(d => {
		const div = document.createElement('div');
		const inDf = FILES.df.map((f, n) => S.lastDisks[n] === d.key ? 'DF' + n + ':' : '').filter(Boolean).join(' ');
		div.className = 'li' + (d.key === swapSel ? ' sel' : '');
		div.setAttribute('role', 'option');
		div.tabIndex = 0;
		div.innerHTML = '<b>' + esc(d.name) + '</b><span>' + fmtBytes(d.size) + (inDf ? ' · <em>in ' + inDf + '</em>' : '') + '</span>';
		div.onclick = () => { swapSel = d.key; renderSwapper(); };
		div.ondblclick = () => swapTo(0);
		box.appendChild(div);
	});
	$('#swDf0').disabled = $('#swDf1').disabled = $('#swDel').disabled = !swapSel;
}
async function swapTo(n) {
	if (!swapSel) return;
	const f = await getDisk(swapSel);
	if (!f) { msgBox('Diese Diskette ist nicht mehr im Browser gespeichert.'); await forgetDisk(swapSel); swapSel = null; renderSwapper(); return; }
	await insertDisk(n, f, swapSel);
	renderSwapper();
}
function initSwapper() {
	$('#swAdd').onclick = async () => {
		const files = await AWFiles.pick('.adf,.adz,.dms,.zip,.gz', true);
		if (files.length) await loadDiskFiles(files, null);
	};
	$('#swDf0').onclick = () => swapTo(0);
	$('#swDf1').onclick = () => swapTo(1);
	$('#swDel').onclick = async () => { if (swapSel) { await forgetDisk(swapSel); swapSel = null; renderSwapper(); renderHistory(); } };
}

/* ---------- Verschiedenes ---------- */
function renderMisc() {
	const m = S.misc;
	$('#miscPauseBg').checked = m.pauseBg; $('#miscPauseDlg').checked = m.pauseDlg; $('#miscStatus').checked = m.status;
	$('#miscToolbar').checked = m.toolbar; $('#miscRemember').checked = m.remember; $('#miscAutoStart').checked = m.autostart;
	$('#miscSerial').checked = m.serial;
}
function initMisc() {
	onChk('miscPauseBg', v => { S.misc.pauseBg = v; if (RT.running) cfg.video.pauseInBackground = v; });
	onChk('miscPauseDlg', v => { S.misc.pauseDlg = v; });
	onChk('miscStatus', v => { S.misc.status = v; applyLiveDisplay(); });
	onChk('miscToolbar', v => { S.misc.toolbar = v; applyLiveDisplay(); });
	onChk('miscRemember', v => { S.misc.remember = v; });
	onChk('miscAutoStart', v => { S.misc.autostart = v; });
	onChk('miscSerial', v => { S.misc.serial = v; });
	onChk('inKeyboard', v => { S.keyboard = v; });
}

/* ---------- Hilfe ---------- */
const HELP = {
	about: 'Hier steht, woraus der Emulator besteht, welche Lizenzen gelten und welche Tastenkürzel es gibt.',
	quickstart: 'Wähle ein Amiga-Modell und eine typische Ausstattung. Der Schieberegler stellt ein, ob der Emulator möglichst originalgetreu (für Spiele) oder möglichst schnell (für Workbench) arbeitet. Lege eine Diskette in DF0: und klicke auf <b>Start</b>.<br><br>Ohne eigene Kickstart-ROM startet der freie AROS-Kickstart. Original-Kickstarts lädst du unter <b>ROM</b>.',
	configs: 'Speichere komplette Einstellungen unter einem Namen, z. B. „A1200 Spiele“ oder „A500 Unterricht“. Mit Exportieren erhältst du eine Datei, die du auf einem anderen Rechner wieder importieren kannst.',
	cpu: 'Der 68000 steckt im A500/A600/A2000, der 68020 im A1200, der 68030 im A3000/A4000. „Mehr Kompatibilität“ emuliert die CPU genauer, braucht aber mehr Rechenleistung.',
	chipset: 'OCS ist der Original-Chipsatz (A500/A1000/A2000), ECS kam mit A500+/A600/A3000, AGA mit A1200/A4000. Ein „sofortiger Blitter“ beschleunigt Grafikoperationen, verträgt sich aber nicht mit allen Spielen.',
	rom: 'Der Kickstart ist das Betriebssystem im ROM. AROS ist frei und eingebaut. Eigene ROM-Dateien (z. B. aus „Amiga Forever“) werden nur in deinem Browser gespeichert.',
	ram: 'Chip-RAM ist der Speicher, den auch Grafik- und Soundchips nutzen. Slow-RAM ist die typische 512-KB-Erweiterung des A500. Fast-RAM gehört nur der CPU und macht Programme schneller.',
	floppy: 'Hier schaltest du bis zu vier Laufwerke ein, wählst ihren Typ und erzeugst leere, formatierte Disketten – zum Beispiel als Speicherdiskette für Spielstände.',
	hd: 'Festplatten-Images (.hdf) funktionieren mit Modellen, die einen IDE-Anschluss haben: A600, A1200, A4000.',
	display: 'HighRes mit verdoppelten Zeilen zeigt alle Amiga-Auflösungen sauber an. „Ganzzahlig“ skaliert in ganzen Vielfachen, so bleiben die Pixel gleich groß.',
	sound: 'Der Amiga-Soundchip Paula hat vier Kanäle, je zwei links und rechts. Eine Stereo-Trennung von etwa 70 % klingt über Kopfhörer angenehmer als 100 %.',
	ports: 'Port 0 ist normalerweise die Maus, Port 1 der Joystick. Ohne echtes Gamepad steuerst du den Joystick mit Pfeiltasten und rechter Strg-Taste als Feuerknopf.',
	input: 'Die Tastatur wird an den Amiga weitergegeben, sobald du ins Bild klickst. Klickst du daneben, gehört die Tastatur wieder dem Browser.',
	filter: 'Diese Effekte ahmen einen Röhrenmonitor nach. Sie belasten den Rechner kaum und wirken sofort.',
	swapper: 'Sammle hier alle Disketten eines Spiels. Während des Spiels drückst du F12, wählst die nächste Diskette und schickst sie mit „→ DF0:“ ins Laufwerk.',
	misc: 'Allgemeine Einstellungen der Oberfläche. „ROMs und Disketten im Browser merken“ legt Dateien im Speicher dieses Browsers ab, damit sie beim nächsten Besuch wieder da sind.'
};

/* =====================================================================
   Tastatur, Ziehen & Ablegen
   ===================================================================== */
window.addEventListener('keydown', e => {
	if (e.code === 'F12') {
		e.preventDefault(); e.stopImmediatePropagation();
		if (!$('#msgLayer').hidden) return;
		if (RT.dialogOpen && RT.running) onOk();
		else if (!RT.dialogOpen) openDialog();
		return;
	}
	if (e.code === 'Pause' && RT.running) {
		e.preventDefault(); e.stopImmediatePropagation(); togglePause(); return;
	}
	if (e.code === 'Enter' && e.altKey && RT.running && !RT.dialogOpen) {
		e.preventDefault(); e.stopImmediatePropagation(); toggleFullscreen(); return;
	}
	if (e.code === 'Escape' && !$('#msgLayer').hidden) {
		e.preventDefault(); const b = $$('#msgBtns .btn'); b[b.length - 1].click(); return;
	}
	if (e.code === 'Escape' && RT.dialogOpen && RT.running && $('#msgLayer').hidden) {
		e.preventDefault(); onCancel();
	}
}, true);

function initDragDrop() {
	let depth = 0;
	const hint = $('#dropHint');
	const hasFiles = e => e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') >= 0;
	document.addEventListener('dragenter', e => { if (!hasFiles(e)) return; depth++; if (RT.running && !RT.dialogOpen) hint.hidden = false; document.body.classList.add('dragging'); });
	document.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) { hint.hidden = true; document.body.classList.remove('dragging'); } });
	document.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
	document.addEventListener('drop', async e => {
		if (!hasFiles(e)) return;
		e.preventDefault(); depth = 0; hint.hidden = true; document.body.classList.remove('dragging');
		const files = Array.from(e.dataTransfer.files);
		if (!files.length) return;
		/* ROM-Dateien erkennen */
		if (files.length === 1 && /\.(rom|key)$/i.test(files[0].name)) {
			const bin = AWFiles.bytesToBin(new Uint8Array(await files[0].arrayBuffer()));
			const f = { name: files[0].name, data: bin, size: bin.length, crc32: AWFiles.crc32(bin) };
			const which = /\.key$/i.test(f.name) ? 'key' : 'rom';
			FILES[which] = f; if (which === 'rom') { S.romSrc = 'file'; autoCpuForRom(f); }
			if (S.misc.remember) await AWFiles.store.put('rom:' + which, f);
			saveSettings(); renderAll(); status(f.name + ' als ' + (which === 'key' ? 'ROM-Schlüssel' : 'Kickstart') + ' geladen');
			return;
		}
		let unit = e.shiftKey ? 1 : 0;
		const dt = e.target.closest && e.target.closest('.drive');
		if (dt) unit = Number(dt.dataset.unit);
		await loadDiskFiles(files, unit);
		if (RT.running && !RT.dialogOpen) focusAmiga(true);
	});
}

/* =====================================================================
   Start der Seite
   ===================================================================== */
async function restoreFiles() {
	for (const w of ['rom', 'ext', 'key']) {
		const f = await AWFiles.store.get('rom:' + w);
		if (f && f.data) FILES[w] = f;
	}
	if (S.romSrc === 'file' && !FILES.rom) S.romSrc = 'aros';
	for (let n = 0; n < 4; n++) {
		const f = await getDisk(S.lastDisks[n]);
		FILES.df[n] = f || null;
		if (!f) S.lastDisks[n] = null;
	}
	/* Metadaten der Sammlung mit dem tatsächlichen Speicher abgleichen */
	const keys = await AWFiles.store.keys();
	if (Array.isArray(keys)) {
		const have = new Set(keys);
		DISKS = DISKS.filter(d => have.has(d.key) || DISK_CACHE.has(d.key));
		lsSet(LS_DISKS, DISKS);
	}
}

function bindButtons() {
	$('#btnStart').onclick = onOk;
	$('#btnCancel').onclick = onCancel;
	$('#btnQuit').onclick = onQuit;
	$('#btnReset').onclick = () => { hardReset(); closeDialog(); };
	$('#btnHelp').onclick = () => msgBox('<b>' + esc(PAGE_TITLES[S.page]) + '</b><br><br>' + (HELP[S.page] || ''));
	$('#propX').onclick = () => { if (RT.running) onCancel(); };
	$('#btnPowerOn').onclick = () => { $('#offScreen').hidden = true; openDialog(); };

	$('#tbSettings').onclick = openDialog;
	$('#tbPause').onclick = () => { togglePause(); focusAmiga(true); };
	$('#tbReset').onclick = () => { hardReset(); focusAmiga(true); };
	$('#tbDf0').onclick = () => pickDisk(0).then(() => focusAmiga(true));
	$('#tbDf1').onclick = () => pickDisk(1).then(() => focusAmiga(true));
	$('#tbSave').onclick = saveModifiedDisks;
	$('#tbMute').onclick = () => { toggleMute(); focusAmiga(true); };
	$('#tbShot').onclick = screenshot;
	$('#tbFull').onclick = toggleFullscreen;
	$('#tbQuit').onclick = onQuit;
	$('#screenBox').addEventListener('pointerdown', () => { $('#focusHint').hidden = true; });
}

async function init() {
	sae = new ScriptedAmigaEmulator();
	inf = sae.getInfo();
	cfg = sae.getConfig();
	initLeds(); resetLeds();
	initTree(); initQuickstart(); initConfigs(); initCpu(); initChipset(); initRom(); initRam();
	initFloppy(); initDisplay(); initSound(); initFilter(); initSwapper(); initMisc();
	bindButtons(); initDragDrop();

	/* Beim allerersten Besuch: Profil des gewählten Modells übernehmen */
	if (!lsGet(LS_SETTINGS, null)) applyPreset();
	else { sae.setModel(MODELS[S.model].id, S.modelCfg); S.ide = cfg.chipset.ide; }

	await restoreFiles();
	applyLiveDisplay();
	showPage(S.misc.quickstartMode ? 'quickstart' : (S.page || 'quickstart'));
	openDialog();
	if (S.misc.autostart) startEmu();

	window.addEventListener('beforeunload', e => {
		if (RT.running && RT.modified.some(Boolean)) { e.preventDefault(); e.returnValue = ''; }
	});
}

document.addEventListener('DOMContentLoaded', init);
