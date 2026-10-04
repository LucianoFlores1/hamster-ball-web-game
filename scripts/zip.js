// Empaqueta una carpeta de build en un ZIP (sin dependencias).
// Uso: node scripts/zip.js [carpeta=dist] [salida=zipzapp.zip]

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { deflateRawSync, crc32 } from 'node:zlib';

const dir = process.argv[2] || 'dist';
const out = process.argv[3] || `zipzapp${dir === 'dist' ? '' : `-${dir.replace(/^dist-/, '')}`}.zip`;

function walk(d) {
  return readdirSync(d).flatMap((name) => {
    const p = join(d, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk(dir);
if (!files.some((f) => relative(dir, f) === 'index.html')) {
  console.error(`No hay index.html en ${dir}/. ¿Corriste el build?`);
  process.exit(1);
}

const local = [];
const central = [];
let offset = 0;
for (const file of files) {
  const name = Buffer.from(relative(dir, file).split(sep).join('/'));
  const data = readFileSync(file);
  const comp = deflateRawSync(data, { level: 9 });
  const crc = crc32(data);

  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0);
  lh.writeUInt16LE(20, 4);
  lh.writeUInt16LE(0x0800, 6); // nombres en UTF-8
  lh.writeUInt16LE(8, 8); // deflate
  lh.writeUInt32LE(0x00210000, 10); // fecha fija (1980-01-01)
  lh.writeUInt32LE(crc, 14);
  lh.writeUInt32LE(comp.length, 18);
  lh.writeUInt32LE(data.length, 22);
  lh.writeUInt16LE(name.length, 26);
  local.push(lh, name, comp);

  const ch = Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50, 0);
  ch.writeUInt16LE(20, 4);
  ch.writeUInt16LE(20, 6);
  ch.writeUInt16LE(0x0800, 8);
  ch.writeUInt16LE(8, 10);
  ch.writeUInt32LE(0x00210000, 12);
  ch.writeUInt32LE(crc, 16);
  ch.writeUInt32LE(comp.length, 20);
  ch.writeUInt32LE(data.length, 24);
  ch.writeUInt16LE(name.length, 28);
  ch.writeUInt32LE(offset, 42);
  central.push(ch, name);

  offset += lh.length + name.length + comp.length;
}

const cdSize = central.reduce((n, b) => n + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(cdSize, 12);
end.writeUInt32LE(offset, 16);

const zip = Buffer.concat([...local, ...central, end]);
writeFileSync(out, zip);
console.log(`${out}: ${files.length} archivos, ${(zip.length / 1024).toFixed(0)} KB`);
