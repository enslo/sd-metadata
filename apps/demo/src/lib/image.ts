/**
 * Shared image conversion utilities
 *
 * Used by OutputTab and other components.
 */

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
export function getMimeType(format: OutputFormat): string {
  const mimeTypes: Record<OutputFormat, string> = {
    png: 'image/png',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
  };
  return mimeTypes[format];
}

/**
 * The output format a MIME type names, if any
 */
export function formatOfMimeType(mimeType: string): OutputFormat | null {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/jpeg') return 'jpeg';
  if (mimeType === 'image/webp') return 'webp';
  return null;
}

/**
 * The format of image bytes, from their signature
 *
 * A file's name can disagree with its contents (a PNG saved as .jpg), and
 * write() goes by the bytes, so the saved file is named by them too.
 */
export function sniffFormat(data: Uint8Array): OutputFormat | null {
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e) return 'png';
  if (data[0] === 0xff && data[1] === 0xd8) return 'jpeg';
  if (
    data[0] === 0x52 && // R
    data[1] === 0x49 && // I
    data[2] === 0x46 && // F
    data[3] === 0x46 && // F
    data[8] === 0x57 && // W
    data[9] === 0x45 && // E
    data[10] === 0x42 && // B
    data[11] === 0x50 // P
  ) {
    return 'webp';
  }
  return null;
}

/**
 * Get file extension for format
 */
export function getExtension(format: OutputFormat): string {
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
export async function loadImageToCanvas(
  url: string,
): Promise<HTMLCanvasElement> {
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
export async function canvasToBlob(
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
export async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Trigger file download
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Safari and older Firefox start the download after click() returns, so
  // a URL revoked right away gives them nothing to fetch (FileSaver.js
  // waits 40 seconds for the same reason)
  setTimeout(() => URL.revokeObjectURL(url), 40_000);
}

/**
 * Generate output filename with optional suffix
 */
export function generateFilename(
  originalFilename: string,
  targetFormat: OutputFormat,
  suffix = '',
): string {
  const baseName = originalFilename.replace(/\.[^.]+$/, '');
  return `${baseName}${suffix}${getExtension(targetFormat)}`;
}

/**
 * Convert image data to a different format via canvas
 *
 * A browser that cannot encode the target format (WebP in some) answers
 * with PNG instead, so the format actually produced is returned with the
 * bytes and the caller names the file by it.
 */
export async function convertImageFormat(
  data: Uint8Array,
  targetFormat: OutputFormat,
): Promise<{ data: Uint8Array; format: OutputFormat }> {
  const blob = new Blob([data.slice()]);
  const url = URL.createObjectURL(blob);
  try {
    const canvas = await loadImageToCanvas(url);
    const convertedBlob = await canvasToBlob(canvas, targetFormat);
    return {
      data: await blobToUint8Array(convertedBlob),
      format: formatOfMimeType(convertedBlob.type) ?? 'png',
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
