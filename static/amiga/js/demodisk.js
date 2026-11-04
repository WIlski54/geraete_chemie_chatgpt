/* AmigaWerk – eingebaute Demo-Diskette.
   Ein selbst geschriebenes Bootblock-Intro (68000-Maschinencode, 160 Byte):
   schaltet die Systeminterrupts und alle DMA-Kanäle ab und schreibt Zeile für
   Zeile neue Farben ins Hintergrundregister COLOR00 – ein scrollender
   Regenbogen aus 256 Rasterzeilen, wie bei den „Copper-Bars“ alter Demos.

   Ablauf des Programms:
     1. A5 = $DFF000 (Custom-Chips), INTENA/INTREQ/DMACON = $7FFF (alles aus)
     2. Farbtabelle mit 256 Einträgen berechnen (drei versetzte Dreieckskurven für R, G, B)
     3. Endlosschleife: auf Rasterzeile 44 warten, dann bei jedem Zeilenwechsel
        COLOR00 = Tabelle[(Zeile + Bildzähler) & 255]
   Die Tabelle liegt ab Byte 512 im Bootblock-Puffer selbst (Chip-RAM).
   Frei verwendbar (gemeinfrei). */
'use strict';

const AWDemoDisk = (function () {
	const CODE_HEX =
		'4bf900dff0003b7c7fff009a3b7c7fff009c3b7c7fff009641fa01da70003200616ae1493601320006410055615ee94986413200064100aa6152864130c352400c40010066d87800202d000402800001ff000c8000002c0066ee54047a0041fa01941c2d0006bc2d000667fa3e05de04024700ffde473b707000018052450c45010066de3b7c0000018060bc024100ff08010007670246010241007fe6494e75';
	const TAG = 'AmigaWerk Demo-Bootblock - selbst geschrieben, frei verwendbar';
	const NAME = 'AmigaWerk-Demo.adf';

	function make() {
		const adf = new Uint8Array(901120);
		adf.set([0x44, 0x4f, 0x53, 0x00], 0);            /* "DOS\0" (OFS) */
		adf.set([0x00, 0x00, 0x03, 0x70], 8);            /* Rootblock 880 */
		for (let i = 0; i < CODE_HEX.length / 2; i++)
			adf[12 + i] = parseInt(CODE_HEX.substr(i * 2, 2), 16);
		for (let i = 0; i < TAG.length; i++) adf[400 + i] = TAG.charCodeAt(i);

		/* Bootblock-Prüfsumme: Summe aller Langwörter mit Übertrag, dann invertiert */
		let sum = 0;
		for (let i = 0; i < 1024; i += 4) {
			const v = ((adf[i] << 24) | (adf[i + 1] << 16) | (adf[i + 2] << 8) | adf[i + 3]) >>> 0;
			sum += v;
			if (sum > 0xffffffff) sum = (sum - 0x100000000 + 1);
		}
		const chk = (~sum) >>> 0;
		adf[4] = chk >>> 24; adf[5] = (chk >>> 16) & 0xff; adf[6] = (chk >>> 8) & 0xff; adf[7] = chk & 0xff;

		const bin = AWFiles.bytesToBin(adf);
		return { name: NAME, data: bin, size: bin.length, crc32: AWFiles.crc32(bin) };
	}

	return { make: make, NAME: NAME };
})();
