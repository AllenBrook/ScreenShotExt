import { downloadDataUrl } from './download';
import { encodePngDataUrl, fileExtension, imageExportFormat } from './encode-image';
import type { ExportFormat, Settings } from './types';
import { formatFilename } from './utils';

export type CaptureFileContext = {
  dataUrl: string;
  title?: string;
  url?: string;
  width: number;
  height: number;
};

/** Download `capture` using Files-settings format (PDF callers handle PDF themselves). */
export async function saveCaptureImage(
  capture: CaptureFileContext,
  settings: Settings,
  format: ExportFormat = settings.defaultFormat,
  nameSuffix = '',
): Promise<number> {
  const imageFormat = imageExportFormat(format);
  const dataUrl = await encodePngDataUrl(capture.dataUrl, imageFormat, settings.quality);
  const base = formatFilename(settings.filenameTemplate, capture);
  return downloadDataUrl(dataUrl, `${base}${nameSuffix}.${fileExtension(imageFormat)}`);
}
