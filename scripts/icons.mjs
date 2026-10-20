// Small code-drawn egg icon; no downloaded artwork, fonts or image libraries.
import { deflateSync } from "node:zlib";
import { writeFile } from "node:fs/promises";
const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}
function color(x, y) {
  const radius = Math.hypot(x - 0.5, y - 0.5);
  const t = (y - 0.48) / 0.30;
  const eggWidth = 0.22 * (0.85 + 0.16 * t) * Math.sqrt(Math.max(0, 1 - t * t));
  if (Math.abs(t) <= 1 && Math.abs(x - 0.5) < eggWidth) {
    if (((x - 0.44) / 0.035) ** 2 + ((y - 0.36) / 0.075) ** 2 < 1) return [255, 255, 255];
    return [255, 242, 201];
  }
  if (radius > 0.37 && radius < 0.39) return [255, 211, 77];
  return [6, 25, 40];
}
for (const size of [180, 192, 512]) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const samples = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]
        .map(([dx, dy]) => color((x + dx) / size, (y + dy) / size));
      for (let c = 0; c < 3; c++) raw[y * (size * 3 + 1) + 1 + x * 3 + c] = Math.round(samples.reduce((sum, rgb) => sum + rgb[c], 0) / 4);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
  await writeFile(new URL(`../assets/icon-${size}.png`, import.meta.url), png);
}
