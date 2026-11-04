/* AmigaWerk – Hilfsfunktionen für Dateien, Archive und Browser-Speicher.
   Enthält keinen Emulator-Code. */
'use strict';

const AWFiles = (function () {

	/* ---------- CRC-32 (wie der Emulationskern, über Binär-Strings) ---------- */
	const CRC_TABLE = (function () {
		const t = new Uint32Array(256);
		for (let n = 0; n < 256; n++) {
			let c = n;
			for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
			t[n] = c >>> 0;
		}
		return t;
	})();

	function crc32(str) {
		let crc = 0xffffffff;
		for (let i = 0; i < str.length; i++)
			crc = CRC_TABLE[(crc ^ str.charCodeAt(i)) & 0xff] ^ (crc >>> 8);
		return (crc ^ 0xffffffff) >>> 0;
	}

	/* ---------- Umwandlung Bytes <-> Binär-String ---------- */
	function bytesToBin(u8) {
		let s = '';
		const CH = 0x8000;
		for (let i = 0; i < u8.length; i += CH)
			s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
		return s;
	}
	function binToBytes(str) {
		const u8 = new Uint8Array(str.length);
		for (let i = 0; i < str.length; i++) u8[i] = str.charCodeAt(i) & 0xff;
		return u8;
	}

	/* ---------- Entpacken ---------- */
	async function inflate(u8, format) {
		if (typeof DecompressionStream === 'undefined')
			throw new Error('Dieser Browser kann keine gepackten Dateien entpacken. Bitte die Datei vorher entpacken.');
		const ds = new DecompressionStream(format);
		const stream = new Blob([u8]).stream().pipeThrough(ds);
		return new Uint8Array(await new Response(stream).arrayBuffer());
	}

	const DISK_EXT = /\.(adf|dms|img|ima|st|adz|hdf)$/i;

	/* Liest ein ZIP-Archiv über das zentrale Verzeichnis und liefert alle Einträge,
	   die nach Disketten- oder Festplatten-Image aussehen. */
	async function unzip(u8) {
		const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
		let eocd = -1;
		for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
			if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
		}
		if (eocd < 0) throw new Error('Das ZIP-Archiv ist beschädigt.');
		const count = dv.getUint16(eocd + 10, true);
		let p = dv.getUint32(eocd + 16, true);
		const out = [];
		const dec = new TextDecoder();
		for (let n = 0; n < count; n++) {
			if (dv.getUint32(p, true) !== 0x02014b50) break;
			const method = dv.getUint16(p + 10, true);
			const csize = dv.getUint32(p + 20, true);
			const nlen = dv.getUint16(p + 28, true);
			const xlen = dv.getUint16(p + 30, true);
			const clen = dv.getUint16(p + 32, true);
			const lho = dv.getUint32(p + 42, true);
			const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
			p += 46 + nlen + xlen + clen;
			if (name.endsWith('/') || !DISK_EXT.test(name)) continue;
			const lnlen = dv.getUint16(lho + 26, true);
			const lxlen = dv.getUint16(lho + 28, true);
			const start = lho + 30 + lnlen + lxlen;
			const raw = u8.subarray(start, start + csize);
			let data;
			if (method === 0) data = raw.slice();
			else if (method === 8) data = await inflate(raw, 'deflate-raw');
			else continue;
			out.push({ name: name.split('/').pop(), bytes: data });
		}
		return out;
	}

	/* Bereitet eine Datei auf: entpackt ZIP/ADZ/GZ und liefert eine Liste von Images */
	async function readImages(file) {
		let u8 = new Uint8Array(await file.arrayBuffer());
		let name = file.name;
		if (u8.length > 4 && u8[0] === 0x50 && u8[1] === 0x4b && u8[2] === 0x03 && u8[3] === 0x04) {
			const list = await unzip(u8);
			if (!list.length) throw new Error('Im ZIP-Archiv „' + name + '“ wurde kein Disketten-Image (ADF, DMS, HDF) gefunden.');
			return list.map(e => mk(e.name, e.bytes));
		}
		if (u8.length > 2 && u8[0] === 0x1f && u8[1] === 0x8b) {
			u8 = await inflate(u8, 'gzip');
			name = name.replace(/\.adz$/i, '.adf').replace(/\.gz$/i, '');
		}
		return [mk(name, u8)];
	}

	function mk(name, u8) {
		const bin = bytesToBin(u8);
		return { name: name, data: bin, size: bin.length, crc32: crc32(bin) };
	}

	/* Datei-Dialog öffnen und Datei(en) liefern */
	function pick(accept, multiple) {
		return new Promise(resolve => {
			const inp = document.getElementById('fileInput');
			inp.value = '';
			inp.accept = accept || '';
			inp.multiple = !!multiple;
			inp.onchange = () => resolve(Array.from(inp.files || []));
			inp.click();
		});
	}

	/* Datei zum Herunterladen anbieten */
	function download(name, data, mime) {
		const blob = data instanceof Blob ? data : new Blob([typeof data === 'string' ? binToBytes(data) : data], { type: mime || 'application/octet-stream' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url; a.download = name;
		document.body.appendChild(a); a.click(); a.remove();
		setTimeout(() => URL.revokeObjectURL(url), 4000);
	}

	/* ---------- IndexedDB (ROMs, Disketten-Verlauf) ---------- */
	const DB_NAME = 'amigawerk', STORE = 'files';
	let dbp = null;
	function db() {
		if (dbp) return dbp;
		dbp = new Promise((resolve) => {
			try {
				const req = indexedDB.open(DB_NAME, 1);
				req.onupgradeneeded = () => req.result.createObjectStore(STORE);
				req.onsuccess = () => resolve(req.result);
				req.onerror = () => resolve(null);
				req.onblocked = () => resolve(null);
			} catch (e) { resolve(null); }
		});
		return dbp;
	}
	async function tx(mode, fn) {
		const d = await db();
		if (!d) return null;
		return new Promise((resolve) => {
			try {
				const t = d.transaction(STORE, mode);
				const st = t.objectStore(STORE);
				const r = fn(st);
				t.oncomplete = () => resolve(r && 'result' in r ? r.result : true);
				t.onerror = t.onabort = () => resolve(null);
			} catch (e) { resolve(null); }
		});
	}
	const store = {
		get: key => tx('readonly', st => st.get(key)),
		put: (key, val) => tx('readwrite', st => st.put(val, key)),
		del: key => tx('readwrite', st => st.delete(key)),
		keys: () => tx('readonly', st => st.getAllKeys()),
		clear: () => tx('readwrite', st => st.clear())
	};

	return { crc32, bytesToBin, binToBytes, readImages, pick, download, store, DISK_EXT };
})();
