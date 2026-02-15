import { write } from '@enslo/sd-metadata';
import type { ParseResult } from '@enslo/sd-metadata';
import {
  type OutputFormat,
  blobToUint8Array,
  canvasToBlob,
  generateFilename,
  getMimeType,
  loadImageToCanvas,
} from '../../lib/image';

export type { OutputFormat } from '../../lib/image';
export { detectFormat, getFormatLabel } from '../../lib/image';

/**
 * Convert image and download with optional metadata
 */
export async function convertAndDownload(
  previewUrl: string,
  parseResult: ParseResult,
  filename: string,
  targetFormat: OutputFormat,
  keepMetadata: boolean,
): Promise<void> {
  // Step 1: Load image and convert to target format
  const canvas = await loadImageToCanvas(previewUrl);
  const convertedBlob = await canvasToBlob(canvas, targetFormat);
  const convertedData = await blobToUint8Array(convertedBlob);
  const outputFilename = generateFilename(filename, targetFormat);

  // Step 2: Write metadata (or empty to strip metadata)
  const metadataToWrite: ParseResult = keepMetadata
    ? parseResult
    : { status: 'empty' };
  const writeResult = write(convertedData, metadataToWrite);

  if (!writeResult.ok) {
    throw new Error(`Failed to write metadata: ${writeResult.error.type}`);
  }

  // Step 3: Create final blob and download
  // Use slice() to create a new Uint8Array with a proper ArrayBuffer type
  const finalBlob = new Blob([writeResult.value.slice()], {
    type: getMimeType(targetFormat),
  });

  const url = URL.createObjectURL(finalBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = outputFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  // Log warning if metadata was dropped
  if (writeResult.warning) {
    console.warn('Metadata warning:', writeResult.warning);
  }
}
