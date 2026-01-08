import type {
  ITXtChunk,
  PngTextChunk,
  PngWriteResult,
  TExtChunk,
} from '../types';
import { Result } from '../types';

/** PNG file signature (magic bytes) */
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * Write PNG metadata to binary data
 *
 * Replaces all existing tEXt and iTXt chunks with the provided chunks.
 * Chunks are inserted immediately after the IHDR chunk (PNG spec recommended).
 *
 * @param data - Original PNG file data as Uint8Array
 * @param chunks - Text chunks to embed
 * @returns Result containing new PNG data with embedded metadata
 */
export function writePngMetadata(
  data: Uint8Array,
  chunks: PngTextChunk[],
): PngWriteResult {
  // Validate PNG signature
  if (!isValidPngSignature(data)) {
    return Result.error({ type: 'invalidSignature' });
  }

  // Find IHDR chunk end position
  const ihdrEnd = findIhdrChunkEnd(data);
  if (ihdrEnd === -1) {
    return Result.error({ type: 'noIhdrChunk' });
  }

  // Collect non-text chunks from original data
  const originalChunks = collectNonTextChunks(data);

  // Serialize new text chunks
  const serializedTextChunks = chunks.map((chunk) =>
    chunk.type === 'tEXt'
      ? serializeTExtChunk(chunk)
      : serializeITXtChunk(chunk),
  );

  // Calculate total output size
  const totalSize =
    PNG_SIGNATURE.length +
    originalChunks.ihdr.length +
    serializedTextChunks.reduce((sum, chunk) => sum + chunk.length, 0) +
    originalChunks.others.reduce((sum, chunk) => sum + chunk.length, 0);

  // Build output
  const output = new Uint8Array(totalSize);
  let offset = 0;

  // Write signature
  output.set(PNG_SIGNATURE, offset);
  offset += PNG_SIGNATURE.length;

  // Write IHDR
  output.set(originalChunks.ihdr, offset);
  offset += originalChunks.ihdr.length;

  // Write text chunks (immediately after IHDR)
  for (const chunk of serializedTextChunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  // Write other chunks
  for (const chunk of originalChunks.others) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return Result.ok(output);
}

/**
 * Validate PNG signature
 */
function isValidPngSignature(data: Uint8Array): boolean {
  if (data.length < PNG_SIGNATURE.length) {
    return false;
  }
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (data[i] !== PNG_SIGNATURE[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Find the end position of IHDR chunk (including CRC)
 * @returns End offset or -1 if not found
 */
function findIhdrChunkEnd(data: Uint8Array): number {
  const offset = PNG_SIGNATURE.length;

  if (offset + 8 > data.length) {
    return -1;
  }

  const length = readUint32BE(data, offset);
  const chunkType = readChunkType(data, offset + 4);

  if (chunkType !== 'IHDR') {
    return -1;
  }

  // Return end position: length(4) + type(4) + data(length) + crc(4)
  return offset + 4 + 4 + length + 4;
}

/**
 * Collect chunks from PNG, separating IHDR and non-text chunks
 */
function collectNonTextChunks(data: Uint8Array): {
  ihdr: Uint8Array;
  others: Uint8Array[];
} {
  const others: Uint8Array[] = [];
  let offset = PNG_SIGNATURE.length;
  let ihdr: Uint8Array = new Uint8Array(0);

  while (offset < data.length) {
    const chunkStart = offset;

    // Read chunk length
    if (offset + 4 > data.length) break;
    const length = readUint32BE(data, offset);
    offset += 4;

    // Read chunk type
    if (offset + 4 > data.length) break;
    const chunkType = readChunkType(data, offset);
    offset += 4;

    // Skip chunk data
    offset += length;

    // Skip CRC
    offset += 4;

    const chunkEnd = offset;
    const chunkData = data.slice(chunkStart, chunkEnd);

    if (chunkType === 'IHDR') {
      ihdr = chunkData;
    } else if (chunkType !== 'tEXt' && chunkType !== 'iTXt') {
      others.push(chunkData);
    }

    if (chunkType === 'IEND') {
      break;
    }
  }

  return { ihdr, others };
}

/**
 * Serialize a tEXt chunk to binary
 */
function serializeTExtChunk(chunk: TExtChunk): Uint8Array {
  // Encode keyword as Latin-1
  const keyword = latin1Encode(chunk.keyword);
  // Encode text as Latin-1
  const text = latin1Encode(chunk.text);

  // Data: keyword + null + text
  const chunkData = new Uint8Array(keyword.length + 1 + text.length);
  chunkData.set(keyword, 0);
  chunkData[keyword.length] = 0; // null separator
  chunkData.set(text, keyword.length + 1);

  return buildChunk('tEXt', chunkData);
}

/**
 * Serialize an iTXt chunk to binary
 */
function serializeITXtChunk(chunk: ITXtChunk): Uint8Array {
  // Encode strings
  const keyword = utf8Encode(chunk.keyword);
  const languageTag = utf8Encode(chunk.languageTag);
  const translatedKeyword = utf8Encode(chunk.translatedKeyword);
  const text = utf8Encode(chunk.text);

  // Calculate data size
  const dataSize =
    keyword.length +
    1 + // null
    1 + // compression flag
    1 + // compression method
    languageTag.length +
    1 + // null
    translatedKeyword.length +
    1 + // null
    text.length;

  const chunkData = new Uint8Array(dataSize);
  let offset = 0;

  // Write keyword
  chunkData.set(keyword, offset);
  offset += keyword.length;
  chunkData[offset++] = 0; // null

  // Write compression flag and method
  chunkData[offset++] = chunk.compressionFlag;
  chunkData[offset++] = chunk.compressionMethod;

  // Write language tag
  chunkData.set(languageTag, offset);
  offset += languageTag.length;
  chunkData[offset++] = 0; // null

  // Write translated keyword
  chunkData.set(translatedKeyword, offset);
  offset += translatedKeyword.length;
  chunkData[offset++] = 0; // null

  // Write text
  chunkData.set(text, offset);

  return buildChunk('iTXt', chunkData);
}

/**
 * Build a complete PNG chunk with length, type, data, and CRC
 */
function buildChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(4 + 4 + data.length + 4);

  // Write length (4 bytes, big-endian)
  writeUint32BE(chunk, 0, data.length);

  // Write type (4 bytes)
  for (let i = 0; i < 4; i++) {
    chunk[4 + i] = type.charCodeAt(i);
  }

  // Write data
  chunk.set(data, 8);

  // Calculate and write CRC (over type + data)
  const crcData = chunk.slice(4, 8 + data.length);
  const crc = calculateCrc32(crcData);
  writeUint32BE(chunk, 8 + data.length, crc);

  return chunk;
}

/**
 * Read 4-byte big-endian unsigned integer
 */
function readUint32BE(data: Uint8Array, offset: number): number {
  return (
    (data[offset] << 24) |
    (data[offset + 1] << 16) |
    (data[offset + 2] << 8) |
    data[offset + 3]
  );
}

/**
 * Write 4-byte big-endian unsigned integer
 */
function writeUint32BE(data: Uint8Array, offset: number, value: number): void {
  data[offset] = (value >>> 24) & 0xff;
  data[offset + 1] = (value >>> 16) & 0xff;
  data[offset + 2] = (value >>> 8) & 0xff;
  data[offset + 3] = value & 0xff;
}

/**
 * Read 4-byte chunk type as string
 */
function readChunkType(data: Uint8Array, offset: number): string {
  return String.fromCharCode(
    data[offset],
    data[offset + 1],
    data[offset + 2],
    data[offset + 3],
  );
}

/**
 * Encode string as Latin-1 bytes
 */
function latin1Encode(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xff;
  }
  return bytes;
}

/**
 * Encode string as UTF-8 bytes
 */
function utf8Encode(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// ============================================================================
// CRC-32 Implementation (IEEE polynomial)
// ============================================================================

/** CRC-32 lookup table */
const CRC_TABLE = makeCrcTable();

/**
 * Generate CRC-32 lookup table
 */
function makeCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) {
        c = 0xedb88320 ^ (c >>> 1);
      } else {
        c = c >>> 1;
      }
    }
    table[n] = c >>> 0;
  }
  return table;
}

/**
 * Calculate CRC-32 checksum
 */
function calculateCrc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
