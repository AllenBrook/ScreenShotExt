import { afterEach, describe, expect, it, vi } from 'vitest';

const png = 'data:image/png;base64,iVBORw0KGgo=';

type Suggest = (suggestion?: chrome.downloads.FilenameSuggestion) => void;
type FilenameListener = (item: chrome.downloads.DownloadItem, suggest: Suggest) => void;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetModules();
});

describe('download filename guard', () => {
  it('re-suggests the template path when Chromium asks for a filename', async () => {
    let listener: FilenameListener | undefined;
    const download = vi.fn(async ({ filename }: { filename: string }) => {
      const suggest = vi.fn();
      listener?.({ id: 7, filename: '下载.png' } as chrome.downloads.DownloadItem, suggest);
      expect(suggest).toHaveBeenCalledWith({
        filename,
        conflictAction: 'uniquify',
      });
      return 7;
    });
    vi.stubGlobal('chrome', {
      downloads: {
        download,
        onDeterminingFilename: {
          addListener: (fn: FilenameListener) => {
            listener = fn;
          },
        },
      },
    });
    const { downloadDataUrl, installDownloadFilenameGuard } =
      await import('../../src/shared/download');
    installDownloadFilenameGuard();
    await downloadDataUrl(
      png,
      '/screen1/screenshot_example.com_Example Page_2026-10-26_115703.png',
    );
    expect(download).toHaveBeenCalledWith({
      url: png,
      filename: 'screen1/screenshot_example.com_Example Page_2026-10-26_115703.png',
      saveAs: false,
    });
  });

  it('uses a queued name when onDeterminingFilename fires before download() resolves', async () => {
    let listener: FilenameListener | undefined;
    const suggest = vi.fn();
    vi.stubGlobal('chrome', {
      downloads: {
        download: async () => {
          listener?.({ id: 3, filename: 'download.png' } as chrome.downloads.DownloadItem, suggest);
          return 3;
        },
        onDeterminingFilename: {
          addListener: (fn: FilenameListener) => {
            listener = fn;
          },
        },
      },
    });
    const { downloadDataUrl, installDownloadFilenameGuard } =
      await import('../../src/shared/download');
    installDownloadFilenameGuard();
    await downloadDataUrl(png, 'Shots/page.png');
    expect(suggest).toHaveBeenCalledWith({
      filename: 'Shots/page.png',
      conflictAction: 'uniquify',
    });
  });

  it('does not override downloads started by other extensions', async () => {
    let listener: FilenameListener | undefined;
    vi.stubGlobal('chrome', {
      downloads: {
        download: async () => 1,
        onDeterminingFilename: {
          addListener: (fn: FilenameListener) => {
            listener = fn;
          },
        },
      },
    });
    const { installDownloadFilenameGuard } = await import('../../src/shared/download');
    installDownloadFilenameGuard();
    const suggest = vi.fn();
    listener?.({ id: 99, filename: 'other.pdf' } as chrome.downloads.DownloadItem, suggest);
    expect(suggest).toHaveBeenCalledWith();
  });

  it('resolves waitForDownloadComplete on a terminal onChanged event', async () => {
    const listeners: Array<(delta: chrome.downloads.DownloadDelta) => void> = [];
    vi.stubGlobal('chrome', {
      downloads: {
        download: async () => 4,
        search: async () => [{ state: 'in_progress' }],
        onDeterminingFilename: { addListener: vi.fn() },
        onChanged: {
          addListener: (fn: (delta: chrome.downloads.DownloadDelta) => void) => listeners.push(fn),
          removeListener: (fn: (delta: chrome.downloads.DownloadDelta) => void) => {
            const i = listeners.indexOf(fn);
            if (i >= 0) listeners.splice(i, 1);
          },
        },
      },
    });
    const { waitForDownloadComplete } = await import('../../src/shared/download');
    const done = waitForDownloadComplete(4);
    await Promise.resolve();
    expect(listeners).toHaveLength(1);
    listeners[0]!({ id: 4, state: { current: 'complete' } });
    await done;
    expect(listeners).toHaveLength(0);
  });

  it('does not wait when the download already finished', async () => {
    const addListener = vi.fn();
    vi.stubGlobal('chrome', {
      downloads: {
        search: async () => [{ state: 'complete' }],
        onChanged: { addListener, removeListener: vi.fn() },
      },
    });
    const { waitForDownloadComplete } = await import('../../src/shared/download');
    await waitForDownloadComplete(4);
    expect(addListener).not.toHaveBeenCalled();
  });
});
