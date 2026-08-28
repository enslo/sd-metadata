/**
 * Platform-provided image decoding for the stealth scan
 *
 * Browsers can decode WebP natively; servers cannot without a
 * dependency. Two tiers are probed in order:
 *
 * 1. ImageDecoder (WebCodecs) — decodes straight to RGBA, no canvas
 *    and no alpha premultiplication involved.
 * 2. createImageBitmap + OffscreenCanvas 2D — constructor existence is
 *    not enough: Deno ships both but returns null from
 *    getContext('2d'), so the actual context is probed before use.
 *
 * Returns null when no tier works, letting the caller fall back to an
 * injected decoder (ReadOptions.decodePixels) or give up gracefully.
 */

import type { RgbaPixels } from '../types';

/** Minimal structural typing for WebCodecs ImageDecoder */
interface DecodedFrame {
  codedWidth: number;
  codedHeight: number;
  allocationSize(options: { format: string }): number;
  copyTo(
    destination: Uint8Array,
    options: { format: string },
  ): Promise<unknown>;
  close(): void;
}

interface ImageDecoderLike {
  decode(): Promise<{ image: DecodedFrame }>;
  close(): void;
}

type ImageDecoderConstructor = new (init: {
  data: Uint8Array;
  type: string;
}) => ImageDecoderLike;

/**
 * Decode an image to RGBA pixels using whatever the platform provides
 *
 * @param data - Encoded image file data
 * @param mimeType - MIME type of the encoded data (e.g. "image/webp")
 * @returns Decoded pixels, or null when the platform cannot decode
 */
export async function decodePixelsWithPlatform(
  data: Uint8Array,
  mimeType: string,
): Promise<RgbaPixels | null> {
  return (
    (await decodeViaImageDecoder(data, mimeType)) ??
    (await decodeViaCanvas(data, mimeType))
  );
}

/**
 * Tier 1: WebCodecs ImageDecoder
 */
async function decodeViaImageDecoder(
  data: Uint8Array,
  mimeType: string,
): Promise<RgbaPixels | null> {
  const ImageDecoderImpl = (
    globalThis as { ImageDecoder?: ImageDecoderConstructor }
  ).ImageDecoder;
  if (!ImageDecoderImpl) {
    return null;
  }

  let decoder: ImageDecoderLike | null = null;
  try {
    decoder = new ImageDecoderImpl({ data, type: mimeType });
    const { image } = await decoder.decode();
    try {
      const pixels = new Uint8Array(image.allocationSize({ format: 'RGBA' }));
      await image.copyTo(pixels, { format: 'RGBA' });
      return {
        data: pixels,
        width: image.codedWidth,
        height: image.codedHeight,
      };
    } finally {
      image.close();
    }
  } catch {
    // Unsupported type or RGBA conversion — try the canvas tier.
    return null;
  } finally {
    decoder?.close();
  }
}

/**
 * Tier 2: createImageBitmap + OffscreenCanvas 2D context
 */
async function decodeViaCanvas(
  data: Uint8Array,
  mimeType: string,
): Promise<RgbaPixels | null> {
  if (
    typeof createImageBitmap === 'undefined' ||
    typeof OffscreenCanvas === 'undefined'
  ) {
    return null;
  }

  try {
    const blob = new Blob([data as BlobPart], { type: mimeType });
    const bitmap = await createImageBitmap(blob, {
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none',
      // Some engines reject unsupported options rather than ignoring
      // them; retry without options before giving up.
    }).catch(() => createImageBitmap(blob));

    try {
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext('2d');
      if (!context) {
        return null;
      }
      context.drawImage(bitmap, 0, 0);
      const imageData = context.getImageData(0, 0, bitmap.width, bitmap.height);
      return {
        data: imageData.data,
        width: imageData.width,
        height: imageData.height,
      };
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}
