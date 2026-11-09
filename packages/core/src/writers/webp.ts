import { readImageDimensions } from '../readers/dimensions';
import type { MetadataSegment } from '../types';
import { Result } from '../types';
import {
  isWebp,
  readChunkType,
  readUint32LE,
  writeUint24LE,
  writeUint32LE,
} from '../utils/binary';
import { buildExifTiffData } from './exif';

// Internal types (co-located with writer)
type WebpWriteError =
  | { type: 'invalidSignature' }
  | { type: 'invalidRiffStructure'; message: string };

type WebpWriteResult = Result<Uint8Array, WebpWriteError>;

/** WebP file signature: "RIFF" */
const RIFF_SIGNATURE = new Uint8Array([0x52, 0x49, 0x46, 0x46]);

/** WebP format marker: "WEBP" */
const WEBP_MARKER = new Uint8Array([0x57, 0x45, 0x42, 0x50]);

/** VP8X feature flags, the first payload byte of the chunk */
const VP8X_ALPHA_FLAG = 0x10;
const VP8X_EXIF_FLAG = 0x08;
const VP8X_XMP_FLAG = 0x04;

/** VP8X payload: flags (1) + reserved (3) + canvas width-1 (3) + height-1 (3) */
const VP8X_PAYLOAD_LENGTH = 10;

/**
 * Write WebP metadata to binary data
 *
 * Replaces existing EXIF chunk with new metadata.
 * All segments are written to the EXIF chunk based on their source type.
 *
 * @param data - Original WebP file data as Uint8Array
 * @param segments - Metadata segments to embed
 * @returns Result containing new WebP data with embedded metadata
 */
export function writeWebpMetadata(
  data: Uint8Array,
  segments: MetadataSegment[],
): WebpWriteResult {
  // Validate WebP signature
  if (!isWebp(data)) {
    return Result.error({ type: 'invalidSignature' });
  }

  // Separate segments by destination
  const xmpSegments = segments.filter((s) => s.source.type === 'xmpPacket');
  const exifSegments = segments.filter((s) => s.source.type !== 'xmpPacket');

  // Collect all chunks except EXIF and XMP
  const collectResult = collectNonMetadataChunks(data);
  if (!collectResult.ok) {
    return collectResult;
  }

  const { chunks } = collectResult.value;

  // Build new EXIF chunk from segments
  const exifChunk = buildExifChunk(exifSegments);

  // Build new XMP chunk (only first XMP packet)
  const firstXmp = xmpSegments[0];
  const xmpChunk = firstXmp ? buildXmpChunk(firstXmp.data) : null;

  // Metadata chunks go after the image data, where the extended format
  // places them
  const metadataChunks: Uint8Array[] = [];
  if (exifChunk) metadataChunks.push(exifChunk);
  if (xmpChunk) metadataChunks.push(xmpChunk);

  // libwebp-based readers (Pillow, A1111, ComfyUI) take EXIF and XMP chunks
  // only from the extended format: a VP8X header first, with its EXIF and
  // XMP flags set. A simple file (VP8 or VP8L alone) is promoted when
  // metadata is written; an existing header has its flags updated.
  const flags =
    (exifChunk ? VP8X_EXIF_FLAG : 0) | (xmpChunk ? VP8X_XMP_FLAG : 0);
  const [first, ...rest] = chunks;
  let header: Uint8Array | null = null;
  let body = chunks;
  if (first && readChunkType(first, 0) === 'VP8X') {
    header = withVp8xFlags(first, flags);
    body = rest;
  } else if (metadataChunks.length > 0) {
    header = buildVp8xChunk(data, chunks, flags);
  }
  const ordered = [...(header ? [header] : []), ...body, ...metadataChunks];

  // Calculate new file size (excluding RIFF header)
  let newFileSize = 4; // "WEBP"
  for (const chunk of ordered) {
    newFileSize += chunk.length;
  }

  // Build output
  const output = new Uint8Array(8 + newFileSize);
  let offset = 0;

  // Write RIFF header
  output.set(RIFF_SIGNATURE, offset);
  offset += 4;
  writeUint32LE(output, offset, newFileSize);
  offset += 4;

  // Write WEBP marker
  output.set(WEBP_MARKER, offset);
  offset += 4;

  for (const chunk of ordered) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return Result.ok(output);
}

/**
 * Copy of a VP8X chunk with its EXIF and XMP flags replaced by `flags`
 */
function withVp8xFlags(vp8x: Uint8Array, flags: number): Uint8Array {
  const copy = vp8x.slice();
  if (copy.length > 8) {
    copy[8] = ((copy[8] ?? 0) & ~(VP8X_EXIF_FLAG | VP8X_XMP_FLAG)) | flags;
  }
  return copy;
}

/**
 * VP8X header for a file in the simple format
 *
 * The canvas size is the image's own and the alpha flag follows the
 * bitstream. A file whose image header cannot be read gets no header and
 * stays in the simple format (null).
 */
function buildVp8xChunk(
  data: Uint8Array,
  chunks: Uint8Array[],
  flags: number,
): Uint8Array | null {
  const dimensions = readImageDimensions(data, 'webp');
  if (!dimensions) return null;

  const chunk = new Uint8Array(8 + VP8X_PAYLOAD_LENGTH);
  chunk.set(new TextEncoder().encode('VP8X'));
  writeUint32LE(chunk, 4, VP8X_PAYLOAD_LENGTH);
  chunk[8] = flags | (chunks.some(hasAlpha) ? VP8X_ALPHA_FLAG : 0);
  writeUint24LE(chunk, 12, dimensions.width - 1);
  writeUint24LE(chunk, 15, dimensions.height - 1);
  return chunk;
}

/**
 * Whether a chunk carries alpha: an ALPH chunk, or a VP8L bitstream whose
 * header sets alpha_is_used (bit 28 of the 32 bits after the signature)
 */
function hasAlpha(chunk: Uint8Array): boolean {
  const type = readChunkType(chunk, 0);
  if (type === 'ALPH') return true;
  if (type !== 'VP8L' || chunk.length < 13 || chunk[8] !== 0x2f) return false;
  return (readUint32LE(chunk, 9) & 0x10000000) !== 0;
}

/**
 * Collect all chunks except EXIF and XMP
 */
function collectNonMetadataChunks(
  data: Uint8Array,
): Result<
  { chunks: Uint8Array[]; firstChunkType: string },
  { type: 'invalidRiffStructure'; message: string }
> {
  const chunks: Uint8Array[] = [];
  let firstChunkType = '';

  // Start after RIFF header (12 bytes: "RIFF" + size + "WEBP")
  let offset = 12;

  while (offset < data.length - 8) {
    // Read chunk type and size
    const typeStr = readChunkType(data, offset);
    const chunkSize = readUint32LE(data, offset + 4);

    if (!firstChunkType) {
      firstChunkType = typeStr;
    }

    // Validate chunk
    if (offset + 8 + chunkSize > data.length) {
      return Result.error({
        type: 'invalidRiffStructure',
        message: `Chunk extends beyond file at offset ${offset}`,
      });
    }

    // Keep all chunks except EXIF and XMP
    if (typeStr !== 'EXIF' && typeStr !== 'XMP ') {
      // Include type + size + data (+ padding if odd)
      const paddedSize = chunkSize + (chunkSize % 2);
      const chunkData = data.slice(offset, offset + 8 + paddedSize);
      chunks.push(chunkData);
    }

    // Move to next chunk (chunk size + type + size fields)
    // RIFF chunks are padded to even byte boundaries
    const paddedSize = chunkSize + (chunkSize % 2);
    offset += 8 + paddedSize;
  }

  return Result.ok({ chunks, firstChunkType });
}

/**
 * Build EXIF chunk from metadata segments
 */
function buildExifChunk(segments: MetadataSegment[]): Uint8Array | null {
  if (segments.length === 0) {
    return null;
  }

  const tiffData = buildExifTiffData(segments);

  if (tiffData.length === 0) {
    return null;
  }

  // Build EXIF chunk: type (4) + size (4) + TIFF data
  const chunkSize = tiffData.length;
  const paddedSize = chunkSize + (chunkSize % 2);
  const chunk = new Uint8Array(8 + paddedSize);

  // Write "EXIF" chunk type
  chunk.set(new TextEncoder().encode('EXIF'));
  writeUint32LE(chunk, 4, chunkSize);
  chunk.set(tiffData, 8);

  return chunk;
}

/**
 * Build XMP chunk from XMP text
 */
function buildXmpChunk(xmpText: string): Uint8Array {
  const textBytes = new TextEncoder().encode(xmpText);

  // Build XMP chunk: type (4) + size (4) + XMP data (+ padding if odd)
  const chunkSize = textBytes.length;
  const paddedSize = chunkSize + (chunkSize % 2);
  const chunk = new Uint8Array(8 + paddedSize);

  // Write "XMP " chunk type (trailing space)
  chunk.set(new TextEncoder().encode('XMP '));
  writeUint32LE(chunk, 4, chunkSize);
  chunk.set(textBytes, 8);

  return chunk;
}
