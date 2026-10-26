import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { resolveModeKeys } from '../../src/shared/shortcuts';

describe('manifest capture-full-page shortcut', () => {
  it('suggests Ctrl+G (Command+G on Mac) for a fresh install', () => {
    const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
    expect(manifest.commands['capture-full-page'].suggested_key).toEqual({
      default: 'Ctrl+G',
      mac: 'Command+G',
    });
  });
});

describe('resolveModeKeys', () => {
  it('always returns the list-position digit', () => {
    expect(resolveModeKeys('capture-full-page', 0, {}).digit).toBe('1');
    expect(resolveModeKeys('capture-visible', 1, {}).digit).toBe('2');
    expect(resolveModeKeys('capture-region', 2, {}).digit).toBe('3');
  });

  it('returns the OS shortcut when Chrome reports one', () => {
    const keys = resolveModeKeys('capture-visible', 1, { 'capture-visible': '⇧⌘V' });
    expect(keys.osShortcut).toBe('⇧⌘V');
  });

  it('returns null when the command is absent', () => {
    expect(resolveModeKeys('capture-region', 2, {}).osShortcut).toBeNull();
  });

  it('returns null when Chrome reports an unassigned command', () => {
    expect(resolveModeKeys('capture-region', 2, { 'capture-region': '' }).osShortcut).toBeNull();
    expect(resolveModeKeys('capture-region', 2, { 'capture-region': '  ' }).osShortcut).toBeNull();
  });
});
