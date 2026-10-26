/**
 * Pack dist/ into a Chromium-safe zip: forward-slash paths, manifest.json at
 * the archive root. PowerShell Compress-Archive stores backslashes, and Edge
 * then treats `_locales\ar\messages.json` as the illegal name
 * `_localesarmessages.json`.
 *
 * Usage:
 *   node scripts/write-extension-zip.mjs
 *   node scripts/write-extension-zip.mjs --verify path/to.zip
 */
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateRawSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const ZIP_STEM = 'openscreenshotExt';

export function zipFileName(version) {
  return `${ZIP_STEM}-v${version}.zip`;
}

export function toZipName(fsPath) {
  return fsPath
    .replaceAll('\\', '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '');
}

export function isUnsafeZipName(name) {
  if (name.includes('\\')) return true;
  if (name === '_localesarmessages.json') return true;
  if (/^_locales[^/]/.test(name)) return true;
  return false;
}

export async function listFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listFiles(full)));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function dosDateTime(date) {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | ((date.getSeconds() / 2) | 0),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function u16(n) {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(n);
  return buf;
}

function u32(n) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(n >>> 0);
  return buf;
}

export function buildZip(entries) {
  const now = dosDateTime(new Date());
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const entry of entries) {
    const name = toZipName(entry.name);
    if (!name || isUnsafeZipName(name)) {
      throw new Error(`refusing unsafe zip path: ${JSON.stringify(entry.name)}`);
    }
    const nameBuf = Buffer.from(name, 'utf8');
    const raw = entry.data;
    const deflated = deflateRawSync(raw);
    const useDeflate = deflated.length < raw.length;
    const payload = useDeflate ? deflated : raw;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(raw);

    const local = Buffer.concat([
      Buffer.from('PK\u0003\u0004', 'binary'),
      u16(20),
      u16(0),
      u16(method),
      u16(now.time),
      u16(now.date),
      u32(crc),
      u32(payload.length),
      u32(raw.length),
      u16(nameBuf.length),
      u16(0),
      nameBuf,
      payload,
    ]);
    locals.push(local);

    const central = Buffer.concat([
      Buffer.from('PK\u0001\u0002', 'binary'),
      u16(20),
      u16(20),
      u16(0),
      u16(method),
      u16(now.time),
      u16(now.date),
      u32(crc),
      u32(payload.length),
      u32(raw.length),
      u16(nameBuf.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBuf,
    ]);
    centrals.push(central);
    offset += local.length;
  }

  const centralDir = Buffer.concat(centrals);
  const eocd = Buffer.concat([
    Buffer.from('PK\u0005\u0006', 'binary'),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);
  return Buffer.concat([...locals, centralDir, eocd]);
}

export function listZipNames(buf) {
  const sig = Buffer.from('PK\u0005\u0006', 'binary');
  const end = buf.lastIndexOf(sig);
  if (end < 0) throw new Error('zip has no end-of-central-directory record');
  const cdSize = buf.readUInt32LE(end + 12);
  const cdOffset = buf.readUInt32LE(end + 16);
  const names = [];
  let i = cdOffset;
  const cdEnd = cdOffset + cdSize;
  while (i < cdEnd) {
    if (buf.toString('binary', i, i + 4) !== 'PK\u0001\u0002') {
      throw new Error('zip central directory is corrupt');
    }
    const nameLen = buf.readUInt16LE(i + 28);
    const extraLen = buf.readUInt16LE(i + 30);
    const commentLen = buf.readUInt16LE(i + 32);
    names.push(buf.toString('utf8', i + 46, i + 46 + nameLen));
    i += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}

export function assertChromiumSafeZip(buf) {
  const names = listZipNames(buf);
  const bad = names.filter(isUnsafeZipName);
  if (bad.length) {
    throw new Error(`zip has backslash or flattened locale paths: ${bad.join(', ')}`);
  }
  if (!names.includes('manifest.json')) {
    throw new Error('zip root is missing manifest.json');
  }
  if (!names.includes('_locales/ar/messages.json')) {
    throw new Error('zip is missing _locales/ar/messages.json (forward-slash nested path)');
  }
  return names;
}

export async function writeExtensionZip(distDir, outFile) {
  const manifest = join(distDir, 'manifest.json');
  await stat(manifest);
  const files = await listFiles(distDir);
  const entries = [];
  for (const file of files) {
    entries.push({
      name: relative(distDir, file),
      data: await readFile(file),
    });
  }
  const buf = buildZip(entries);
  assertChromiumSafeZip(buf);
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, buf);
  return { outFile, names: listZipNames(buf), bytes: buf.length };
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--verify') {
    const file = args[1];
    if (!file) throw new Error('usage: node scripts/write-extension-zip.mjs --verify <zip>');
    const names = assertChromiumSafeZip(await readFile(file));
    console.log(`ok: ${file} (${names.length} entries, includes _locales/ar/messages.json)`);
    return;
  }

  const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
  const dist = join(ROOT, 'dist');
  const name = zipFileName(pkg.version);
  const rootZip = join(ROOT, name);
  await rm(rootZip, { force: true });
  const { bytes, names } = await writeExtensionZip(dist, rootZip);
  console.log(`wrote ${name} (${bytes} bytes, ${names.length} entries)`);
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  });
}
