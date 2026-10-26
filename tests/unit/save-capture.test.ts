import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/shared/types';

const png = 'data:image/png;base64,iVBORw0KGgo=';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('saveCaptureImage', () => {
  it('downloads a PNG using the filename template and Files extension', async () => {
    const download = vi.fn(async () => 11);
    vi.stubGlobal('chrome', {
      downloads: { download },
    });
    const { saveCaptureImage } = await import('../../src/shared/save-capture');
    const id = await saveCaptureImage(
      {
        dataUrl: png,
        title: 'Example Page',
        url: 'https://example.com/',
        width: 10,
        height: 10,
      },
      { ...DEFAULT_SETTINGS, filenameTemplate: 'shot_{domain}_{title}', defaultFormat: 'png' },
    );
    expect(id).toBe(11);
    expect(download).toHaveBeenCalledWith({
      url: png,
      filename: 'shot_example.com_Example Page.png',
      saveAs: false,
    });
  });

  it('appends a part suffix for split full-page captures', async () => {
    const download = vi.fn(async () => 2);
    vi.stubGlobal('chrome', { downloads: { download } });
    const { saveCaptureImage } = await import('../../src/shared/save-capture');
    await saveCaptureImage(
      { dataUrl: png, width: 1, height: 1 },
      { ...DEFAULT_SETTINGS, filenameTemplate: 'page' },
      'png',
      '_part2of3',
    );
    expect(download).toHaveBeenCalledWith(
      expect.objectContaining({ filename: 'page_part2of3.png' }),
    );
  });
});

describe('fileExtension', () => {
  it('maps jpeg to jpg and leaves other formats alone', async () => {
    const { fileExtension } = await import('../../src/shared/encode-image');
    expect(fileExtension('jpeg')).toBe('jpg');
    expect(fileExtension('png')).toBe('png');
    expect(fileExtension('webp')).toBe('webp');
    expect(fileExtension('pdf')).toBe('pdf');
  });
});
