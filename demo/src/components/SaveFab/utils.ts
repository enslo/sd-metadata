import { write } from '@enslo/sd-metadata';
import type { ParseResult } from '@enslo/sd-metadata';

export type OutputFormat = 'png' | 'jpeg' | 'webp';

/**
 * Detect image format from filename extension
 */
export function detectFormat(filename: string): OutputFormat {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'jpeg';
  if (ext === 'webp') return 'webp';
  return 'png';
}

/**
 * Get display label for format
 */
export function getFormatLabel(format: OutputFormat): string {
  const labels: Record<OutputFormat, string> = {
    png: 'PNG',
    jpeg: 'JPEG',
    webp: 'WebP',
  };
  return labels[format];
}

/**
 * Get MIME type for format
 */
function getMimeType(format: OutputFormat): string {
  const mimeTypes: Record<OutputFormat, string> = {
    png: 'image/png',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
  };
  return mimeTypes[format];
}

/**
 * Get file extension for format
 */
function getExtension(format: OutputFormat): string {
  const extensions: Record<OutputFormat, string> = {
    png: '.png',
    jpeg: '.jpg',
    webp: '.webp',
  };
  return extensions[format];
}

/**
 * Load image from URL into canvas
 */
async function loadImageToCanvas(url: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

/**
 * Convert canvas to blob
 */
async function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  quality = 0.95,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      },
      getMimeType(format),
      quality,
    );
  });
}

/**
 * Convert blob to Uint8Array
 */
async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Trigger file download
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate output filename
 */
function generateFilename(
  originalFilename: string,
  targetFormat: OutputFormat,
): string {
  const baseName = originalFilename.replace(/\.[^.]+$/, '');
  return `${baseName}${getExtension(targetFormat)}`;
}

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
  downloadBlob(finalBlob, outputFilename);

  // Log warning if metadata was dropped
  if (writeResult.warning) {
    console.warn('Metadata warning:', writeResult.warning);
  }
}
