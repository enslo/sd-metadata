import {
  isJpeg,
  isPng,
  isWebp,
  readChunkType,
  readUint16,
  readUint32BE,
  readUint32LE,
} from '../../src/utils/binary';

/**
 * Raw PNG Chunk structure
 */
export interface PngChunk {
  length: number;
  type: string;
  data: Uint8Array;
  crc: Uint8Array;
}

/**
 * Raw JPEG Segment structure
 */
export interface JpegSegment {
  marker: number;
  length: number; // Includes the 2-byte length field itself usually, but we store the data length
  data: Uint8Array;
}

/**
 * Raw WebP Chunk structure
 */
export interface WebpChunk {
  type: string;
  size: number;
  data: Uint8Array;
}

/**
 * Read ALL chunks from a PNG file without filtering
 */
export function readPngChunks(data: Uint8Array): PngChunk[] {
  if (!isPng(data)) {
    throw new Error('Not a valid PNG file');
  }

  const chunks: PngChunk[] = [];
  let offset = 8; // Skip signature

  while (offset < data.length) {
    if (offset + 8 > data.length) break; // Need at least length + type

    const length = readUint32BE(data, offset);
    offset += 4;

    const type = readChunkType(data, offset);
    offset += 4;

    if (offset + length + 4 > data.length) {
      throw new Error(`Unexpected end of file reading chunk ${type}`);
    }

    const chunkData = data.slice(offset, offset + length);
    offset += length;

    const crc = data.slice(offset, offset + 4);
    offset += 4;

    chunks.push({
      length,
      type,
      data: chunkData,
      crc,
    });

    if (type === 'IEND') break;
  }

  return chunks;
}

/**
 * Read ALL segments from a JPEG file without filtering
 * Note: Scans (SOS) are treated as a special segment containing all data until EOI or next marker
 */
export function readJpegSegments(data: Uint8Array): JpegSegment[] {
  if (!isJpeg(data)) {
    throw new Error('Not a valid JPEG file');
  }

  const segments: JpegSegment[] = [];
  let offset = 2; // Skip SOI

  while (offset < data.length - 1) {
    // Need at least 2 bytes for marker
    if (data[offset] !== 0xff) {
      // Not a marker, possibly entropy-coded data?
      // In valid JPEG structure, we should always be at a marker here unless we are in SOS.
      // But SOS handling below should consume entropy data.
      offset++;
      continue;
    }

    const marker = data[offset + 1];

    if (marker === undefined) {
      break;
    }

    // Skip padding
    if (marker === 0xff) {
      offset++;
      continue;
    }

    // Offset points to 0xFF
    offset += 2; // Skip marker

    // Standalone markers (no length)
    if (
      marker === 0xd8 || // SOI (shouldn't be here usually)
      marker === 0xd9 || // EOI
      (marker >= 0xd0 && marker <= 0xd7) // RSTn
    ) {
      segments.push({
        marker,
        length: 0,
        data: new Uint8Array(0),
      });
      if (marker === 0xd9) break; // EOI
      continue;
    }

    // SOS (Start of Scan) - followed by entropy-coded data
    if (marker === 0xda) {
      // SOS header has a length
      if (offset + 2 > data.length) break;
      const length = readUint16(data, offset, false);
      const headerEnd = offset + length;

      // Store header as data for now? Or strictly the entropy data?
      // Let's store the header first
      segments.push({
        marker,
        length,
        data: data.slice(offset, headerEnd),
      });

      offset = headerEnd;

      // Scan forward for next marker (0xFF followed by non-0x00)
      // Entropy data usually contains 0xFF00 for escaped 0xFF.
      while (offset < data.length - 1) {
        if (data[offset] === 0xff && data[offset + 1] !== 0x00) {
          // Found a marker
          break;
        }
        offset++;
      }

      // We can optionally store the scan data as a "ScanData" pseudo-segment
      // segments.push({ marker: 0x00, length: offset - scanStart, data: data.slice(scanStart, offset) });

      continue;
    }

    // Unrecognized or regular segments with length
    if (offset + 2 > data.length) break;
    const length = readUint16(data, offset, false);

    if (offset + length > data.length) {
      // specific case: if truncated
      break;
    }

    segments.push({
      marker,
      length,
      data: data.slice(offset + 2, offset + length), // data excludes length bytes
    });
    offset += length;
  }

  return segments;
}

/**
 * Read ALL chunks from a WebP file without filtering
 */
export function readWebpChunks(data: Uint8Array): WebpChunk[] {
  if (!isWebp(data)) {
    throw new Error('Not a valid WebP file');
  }

  const chunks: WebpChunk[] = [];
  let offset = 12; // Skip RIFF header

  while (offset < data.length - 8) {
    const type = readChunkType(data, offset);
    const size = readUint32LE(data, offset + 4);

    // WebP chunks are padded to even size
    const paddedSize = size + (size % 2);

    // Only capture the actual data, not the padding
    const chunkData = data.slice(offset + 8, offset + 8 + size);

    chunks.push({
      type,
      size,
      data: chunkData,
    });

    offset += 8 + paddedSize;
  }

  return chunks;
}
