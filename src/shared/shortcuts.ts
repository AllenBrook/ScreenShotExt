/**
 * Popup shortcut-chip rules.
 *
 * Every capture mode answers to a digit key while the popup is open (1–4 in
 * list order). Chrome may also hold an OS-level binding, but only when the user
 * or a manifest suggestion registered one. The popup shows the digit on every
 * row so the column never mixes two meanings, and adds the OS binding as a
 * second chip when Chrome reports one.
 */

import type { CaptureMode } from './types';

/**
 * Manifest `suggested_key` for full-page capture. Ctrl+G / Command+G is the
 * binding Chinese Edge users often want (FireShot), but Chromium reserves
 * Ctrl+G for Find next, so `suggested_key` stays empty on a fresh install.
 * Alt+Shift+G is the closest combo Chrome/Edge actually assign automatically.
 * Users can still bind Ctrl+G by hand on edge://extensions/shortcuts.
 */
export const FULL_PAGE_SUGGESTED_KEY = 'Alt+Shift+G';

export function commandToMode(command: string): CaptureMode | null {
  switch (command) {
    case 'capture-full-page':
      return 'full-page';
    case 'capture-visible':
      return 'visible';
    case 'capture-region':
      return 'region';
    case 'capture-element':
      return 'element';
    default:
      return null;
  }
}

export interface ModeKeys {
  /** In-popup digit key. Always available while the mode list shows. */
  digit: string;
  /** OS-level binding from chrome.commands.getAll(), or null when unassigned. */
  osShortcut: string | null;
}

export function resolveModeKeys(
  command: string,
  index: number,
  shortcuts: Record<string, string>,
): ModeKeys {
  const raw = shortcuts[command];
  const trimmed = raw?.trim() ?? '';
  return { digit: String(index + 1), osShortcut: trimmed === '' ? null : trimmed };
}
