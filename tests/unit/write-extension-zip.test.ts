import { describe, it, expect } from 'vitest';
import {
  ZIP_STEM,
  zipFileName,
  toZipName,
  isUnsafeZipName,
  buildZip,
  listZipNames,
  assertChromiumSafeZip,
} from '../../scripts/write-extension-zip.mjs';

describe('Chromium-safe extension zip', () => {
  it('names the sideload archive openscreenshotExt-v*.zip', () => {
    expect(ZIP_STEM).toBe('openscreenshotExt');
    expect(zipFileName('2.5.2.4')).toBe('openscreenshotExt-v2.5.2.4.zip');
  });

  it('normalizes Windows separators to forward slashes', () => {
    expect(toZipName('_locales\\ar\\messages.json')).toBe('_locales/ar/messages.json');
  });

  it('rejects backslashes and the flattened Edge locale name', () => {
    expect(isUnsafeZipName('_locales\\ar\\messages.json')).toBe(true);
    expect(isUnsafeZipName('_localesarmessages.json')).toBe(true);
    expect(isUnsafeZipName('_locales/ar/messages.json')).toBe(false);
  });

  it('stores nested locale paths with forward slashes', () => {
    const buf = buildZip([
      { name: 'manifest.json', data: Buffer.from('{"manifest_version":3}') },
      { name: '_locales\\ar\\messages.json', data: Buffer.from('{"extName":{}}') },
    ]);
    const names = listZipNames(buf);
    expect(names).toEqual(['manifest.json', '_locales/ar/messages.json']);
    expect(names.some((n) => n.includes('\\'))).toBe(false);
    expect(names).not.toContain('_localesarmessages.json');
    expect(assertChromiumSafeZip(buf)).toEqual(names);
  });

  it('fails a zip that flattened _locales/ar/messages.json', () => {
    const buf = buildZip([
      { name: 'manifest.json', data: Buffer.from('{}') },
      { name: 'other.json', data: Buffer.from('{}') },
    ]);
    expect(() => assertChromiumSafeZip(buf)).toThrow(/_locales\/ar\/messages\.json/);
  });
});
