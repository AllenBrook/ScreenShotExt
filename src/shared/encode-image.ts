import { tokens } from './design-tokens';
import type { ExportFormat } from './types';

export type ImageExportFormat = Exclude<ExportFormat, 'pdf'>;

/** File extension for a saved capture, matching the editor export dialog. */
export function fileExtension(format: ExportFormat): string {
  if (format === 'jpeg') return 'jpg';
  return format;
}

export function imageExportFormat(format: ExportFormat): ImageExportFormat {
  return format === 'pdf' ? 'png' : format;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`;
}

/**
 * Re-encode a PNG data URL as JPEG or WebP. PNG is returned unchanged.
 * Uses OffscreenCanvas in the service worker and a DOM canvas in pages.
 */
export async function encodePngDataUrl(
  pngDataUrl: string,
  format: ImageExportFormat,
  quality: number,
): Promise<string> {
  if (format === 'png') return pngDataUrl;
  const blob = await (await fetch(pngDataUrl)).blob();
  const bitmap = await createImageBitmap(blob);
  try {
    const mime = format === 'jpeg' ? 'image/jpeg' : 'image/webp';
    if (typeof OffscreenCanvas === 'function') {
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('OffscreenCanvas 2D unavailable');
      if (format === 'jpeg') {
        ctx.fillStyle = tokens.canvasPaper;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(bitmap, 0, 0);
      return blobToDataUrl(await canvas.convertToBlob({ type: mime, quality }));
    }
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D unavailable');
      if (format === 'jpeg') {
        ctx.fillStyle = tokens.canvasPaper;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(bitmap, 0, 0);
      return canvas.toDataURL(mime, quality);
    }
    throw new Error('No canvas available to encode the screenshot');
  } finally {
    bitmap.close?.();
  }
}
