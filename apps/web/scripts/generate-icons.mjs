// Génère les icônes PWA (PNG) sans dépendance : une marmite blanche sur fond orange.
// Relancer après modification du dessin : node scripts/generate-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUT = path.join(import.meta.dirname, '..', 'public', 'icons');
const BACKGROUND = [0xc2, 0x41, 0x0c]; // --color-accent
const WHITE = [255, 255, 255];

/** Distance signée à un rectangle arrondi centré en (cx, cy). */
function roundedRect(x, y, cx, cy, halfW, halfH, radius) {
  const qx = Math.abs(x - cx) - halfW + radius;
  const qy = Math.abs(y - cy) - halfH + radius;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

/** Marmite dans un carré unité (0..1). */
function inPot(x, y) {
  return (
    roundedRect(x, y, 0.5, 0.64, 0.3, 0.2, 0.09) <= 0 || // cuve
    roundedRect(x, y, 0.5, 0.42, 0.36, 0.035, 0.035) <= 0 || // bord
    roundedRect(x, y, 0.12, 0.54, 0.07, 0.03, 0.03) <= 0 || // anse gauche
    roundedRect(x, y, 0.88, 0.54, 0.07, 0.03, 0.03) <= 0 || // anse droite
    [0.36, 0.5, 0.64].some((sx) => roundedRect(x, y, sx, 0.22, 0.025, 0.09, 0.025) <= 0) // vapeur
  );
}

/**
 * @param size taille en pixels
 * @param content zone occupée par la marmite (fraction du côté, centrée)
 * @param cornerRadius arrondi du fond (0 = plein cadre, pour les icônes « maskable »)
 */
function render(size, content, cornerRadius) {
  const samples = 4; // sur-échantillonnage 4×4 pour l'anticrénelage
  const pixels = Buffer.alloc(size * size * 4);
  const offset = (1 - content) / 2;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bg = 0;
      let fg = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const x = (px + (sx + 0.5) / samples) / size;
          const y = (py + (sy + 0.5) / samples) / size;
          if (roundedRect(x, y, 0.5, 0.5, 0.5, 0.5, cornerRadius) > 0) continue;
          bg++;
          if (inPot((x - offset) / content, (y - offset) / content)) fg++;
        }
      }
      const total = samples * samples;
      const i = (py * size + px) * 4;
      const t = bg ? fg / bg : 0;
      for (let c = 0; c < 3; c++)
        pixels[i + c] = Math.round(BACKGROUND[c] * (1 - t) + WHITE[c] * t);
      pixels[i + 3] = Math.round((bg / total) * 255);
    }
  }
  return encodePng(size, pixels);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}
function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8 bits, RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filtre « None »
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(OUT, { recursive: true });
const icons = {
  'icon-192.png': render(192, 0.62, 0.18),
  'icon-512.png': render(512, 0.62, 0.18),
  // Maskable : fond plein cadre, dessin dans la zone de sécurité (cercle de 80 %).
  'maskable-512.png': render(512, 0.5, 0),
  'apple-touch-icon.png': render(180, 0.6, 0),
};
for (const [name, png] of Object.entries(icons)) {
  fs.writeFileSync(path.join(OUT, name), png);
  console.log(`${name} (${png.length} octets)`);
}
