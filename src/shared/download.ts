import { IS_FIREFOX } from './browser';
import { toDownloadPath } from './utils';

/**
 * Filenames we asked `chrome.downloads.download` to use, waiting for
 * `onDeterminingFilename`. Chromium drops the `filename` option whenever *any*
 * extension registers that listener (IDM is a common one on Chinese Edge), and
 * the item then gets the URL-derived name — for a `data:` screenshot that is
 * the localized word "download" (`下载.png`). Re-suggesting here restores the
 * template. Firefox has no such event; the queue is unused there.
 */
const expectedNames: string[] = [];
const namesById = new Map<number, string>();
let guardInstalled = false;

export function installDownloadFilenameGuard(): void {
  if (guardInstalled) return;
  const api = chrome.downloads?.onDeterminingFilename;
  if (!api?.addListener) return;
  guardInstalled = true;
  api.addListener((item, suggest) => {
    const filename = namesById.get(item.id) ?? expectedNames.shift();
    if (filename) {
      namesById.delete(item.id);
      suggest({ filename, conflictAction: 'uniquify' });
      return;
    }
    suggest();
  });
}

export function expectDownloadFilename(filename: string): void {
  expectedNames.push(toDownloadPath(filename));
}

export function bindDownloadFilename(id: number, filename: string): void {
  const path = toDownloadPath(filename);
  namesById.set(id, path);
  dropExpected(path);
}

function dropExpected(filename: string): void {
  const i = expectedNames.indexOf(filename);
  if (i >= 0) expectedNames.splice(i, 1);
}

/**
 * Firefox rejects `data:` downloads; its background page can own a blob URL.
 * Chromium (including Edge) accepts `data:` from the service worker, which
 * cannot call `URL.createObjectURL`. The filename guard below is what stops
 * Edge from saving those as the localized "download.png".
 */
function canCreateBlobUrl(): boolean {
  return IS_FIREFOX && typeof URL.createObjectURL === 'function';
}

async function materializeUrl(dataUrl: string): Promise<{ url: string; cleanup: () => void }> {
  if (!canCreateBlobUrl() || !dataUrl.startsWith('data:')) {
    return { url: dataUrl, cleanup: () => {} };
  }
  const blob = await (await fetch(dataUrl)).blob();
  const url = URL.createObjectURL(blob);
  return {
    url,
    cleanup: () => {
      // Match PDF export: let the browser begin reading before releasing the URL.
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    },
  };
}

function rememberFilename(filename: string): void | Promise<void> {
  if (guardInstalled) {
    expectDownloadFilename(filename);
    return;
  }
  if (!chrome.downloads?.onDeterminingFilename) return;
  return chrome.runtime.sendMessage({ type: 'DOWNLOAD_EXPECT', filename }).then(
    () => undefined,
    () => undefined,
  );
}

function rememberFilenameId(id: number, filename: string): void | Promise<void> {
  if (guardInstalled) {
    bindDownloadFilename(id, filename);
    return;
  }
  if (!chrome.downloads?.onDeterminingFilename) return;
  return chrome.runtime.sendMessage({ type: 'DOWNLOAD_ID', id, filename }).then(
    () => undefined,
    () => undefined,
  );
}

export async function downloadUrl(
  url: string,
  name: string,
  options?: { saveAs?: boolean },
): Promise<number> {
  const filename = toDownloadPath(name);
  const expecting = rememberFilename(filename);
  if (expecting) await expecting;
  try {
    const id = await chrome.downloads.download({
      url,
      filename,
      saveAs: options?.saveAs ?? false,
    });
    const bound = rememberFilenameId(id, filename);
    if (bound) await bound;
    return id;
  } catch (err) {
    if (guardInstalled) dropExpected(filename);
    throw err;
  }
}

export async function downloadDataUrl(dataUrl: string, name: string): Promise<number> {
  const { url, cleanup } = await materializeUrl(dataUrl);
  try {
    return await downloadUrl(url, name);
  } finally {
    cleanup();
  }
}

function isTerminalDownloadState(state: string | undefined): boolean {
  return state === 'complete' || state === 'interrupted';
}

/**
 * Resolves when `id` reaches a terminal `complete` state. Times out without
 * throwing so a stuck shelf cannot pin the completion window open. A `data:`
 * save can finish before the caller starts waiting, so we read the current
 * item first.
 */
export async function waitForDownloadComplete(id: number, timeoutMs = 15_000): Promise<void> {
  const api = chrome.downloads?.onChanged;
  if (!api?.addListener) return;
  try {
    const [item] = await chrome.downloads.search({ id });
    if (isTerminalDownloadState(item?.state)) return;
  } catch {
    // `search` is best-effort; onChanged still covers an in-flight save.
  }
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      api.removeListener(onChanged);
      clearTimeout(timer);
      resolve();
    };
    const onChanged = (delta: chrome.downloads.DownloadDelta) => {
      if (delta.id !== id) return;
      if (isTerminalDownloadState(delta.state?.current)) finish();
    };
    api.addListener(onChanged);
    const timer = setTimeout(finish, timeoutMs);
  });
}
