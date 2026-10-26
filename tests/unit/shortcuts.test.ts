import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  FULL_PAGE_SUGGESTED_KEY,
  commandToMode,
  resolveModeKeys,
} from '../../src/shared/shortcuts';

describe('manifest capture-full-page shortcut', () => {
  it('suggests Alt+Shift+G so Chromium can assign it (Ctrl+G is Find next)', () => {
    const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
    expect(FULL_PAGE_SUGGESTED_KEY).toBe('Alt+Shift+G');
    expect(manifest.commands['capture-full-page'].suggested_key).toEqual({
      default: 'Alt+Shift+G',
      mac: 'Alt+Shift+G',
    });
    expect(manifest.commands['capture-full-page'].description).toBe(
      '__MSG_commandCaptureFullPage__',
    );
  });
});

describe('commandToMode', () => {
  it('maps capture-full-page to the full-page capture mode', () => {
    expect(commandToMode('capture-full-page')).toBe('full-page');
    expect(commandToMode('capture-visible')).toBe('visible');
    expect(commandToMode('capture-region')).toBe('region');
    expect(commandToMode('capture-element')).toBe('element');
    expect(commandToMode('stop-recording')).toBeNull();
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
