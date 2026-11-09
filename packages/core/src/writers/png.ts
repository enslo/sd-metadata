import type {
  ITXtChunk,
  MetadataSegment,
  PngTextChunk,
  TExtChunk,
} from '../types';
import { Result } from '../types';
import {
  isPng,
  readChunkType,
  readUint32BE,
  writeUint32BE,
} from '../utils/binary';
import { buildExifTiffData } from './exif';

// Internal types (co-located with writer)
type PngWriteError =
  | { type: 'invalidSignature' }
  | { type: 'noIhdrChunk' }
  | { type: 'corruptedStructure'; message: string };

type PngWriteResult = Result<Uint8Array, PngWriteError>;

/** PNG file signature (magic bytes) */
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * Write PNG metadata to binary data
 *
 * Replaces all existing tEXt, iTXt and eXIf chunks with the provided
 * metadata. The eXIf chunk (if any) and then the text chunks are inserted
 * immediately after the IHDR chunk (PNG spec recommended).
 *
 * A file that breaks off inside a chunk (a download that stopped partway)
 * is refused: writing it would drop that chunk, the image data included,
 * and return a PNG that looks whole.
 *
 * @param data - Original PNG file data as Uint8Array
 * @param chunks - Text chunks to embed
 * @param exif - Segments to store in an eXIf chunk (CivitAI layout); omit
 *   to write none
 * @returns Result containing new PNG data with embedded metadata
 */
export function writePngMetadata(
  data: Uint8Array,
  chunks: PngTextChunk[],
  exif?: MetadataSegment[],
): PngWriteResult {
  // Validate PNG signature
  if (!isPng(data)) {
    return Result.error({ type: 'invalidSignature' });
  }

  // Collect the chunks we do not manage from the original data
  const collected = collectOtherChunks(data);
  if (!collected.ok) {
    return collected;
  }
  const originalChunks = collected.value;

  // Serialize the eXIf chunk (only EXIF-type segments can live there)
  const tiff = exif && exif.length > 0 ? buildExifTiffData(exif) : null;
  const serializedExif =
    tiff && tiff.length > 0 ? [buildChunk('eXIf', tiff)] : [];

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
    serializedExif.reduce((sum, chunk) => sum + chunk.length, 0) +
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

  // Write eXIf and text chunks (immediately after IHDR)
  for (const chunk of [...serializedExif, ...serializedTextChunks]) {
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
 * Collect chunks from PNG, separating IHDR from the chunks we do not manage
 * (everything except tEXt, iTXt and eXIf)
 *
 * The first chunk must be IHDR and every chunk must lie within the file; a
 * missing IEND is tolerated, as the chunks before it are whole.
 */
function collectOtherChunks(
  data: Uint8Array,
): Result<{ ihdr: Uint8Array; others: Uint8Array[] }, PngWriteError> {
  const others: Uint8Array[] = [];
  let offset = PNG_SIGNATURE.length;
  let ihdr: Uint8Array = new Uint8Array(0);

  while (offset < data.length) {
    const chunkStart = offset;

    // Read chunk length and type
    if (offset + 8 > data.length) {
      return Result.error({
        type: 'corruptedStructure',
        message: 'Unexpected end of file while reading chunk header',
      });
    }
    const length = readUint32BE(data, offset);
    const chunkType = readChunkType(data, offset + 4);
    offset += 8;

    if (chunkStart === PNG_SIGNATURE.length && chunkType !== 'IHDR') {
      return Result.error({ type: 'noIhdrChunk' });
    }

    // Validate chunk data + CRC fits within buffer
    if (offset + length + 4 > data.length) {
      return Result.error({
        type: 'corruptedStructure',
        message: `Unexpected end of file while reading chunk data (${chunkType})`,
      });
    }

    // Skip chunk data and CRC
    offset += length + 4;

    const chunkEnd = offset;
    const chunkData = data.slice(chunkStart, chunkEnd);

    if (chunkType === 'IHDR') {
      ihdr = chunkData;
    } else if (
      chunkType !== 'tEXt' &&
      chunkType !== 'iTXt' &&
      chunkType !== 'eXIf'
    ) {
      others.push(chunkData);
    }

    if (chunkType === 'IEND') {
      break;
    }
  }

  if (ihdr.length === 0) {
    return Result.error({ type: 'noIhdrChunk' });
  }

  return Result.ok({ ihdr, others });
}

/**
 * Serialize a tEXt chunk to binary
 *
 * Per PNG spec, tEXt uses Latin-1, and PIL-based readers (A1111, ComfyUI)
 * decode it that way, so a chunk the converters marked `latin1` is written
 * as such. A chunk without an encoding, read from a file or supplied by a
 * caller, is written as UTF-8 as before: tools such as TensorArt write
 * UTF-8 into tEXt, and their bytes round-trip unchanged.
 */
function serializeTExtChunk(chunk: TExtChunk): Uint8Array {
  // Encode keyword as Latin-1 (keywords are ASCII-safe)
  const keyword = latin1Encode(chunk.keyword);
  const text =
    chunk.encoding === 'latin1'
      ? latin1Encode(chunk.text)
      : utf8Encode(chunk.text);

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
  chunk.set(new TextEncoder().encode(type), 4);

  // Write data
  chunk.set(data, 8);

  // Calculate and write CRC (over type + data)
  const crcData = chunk.slice(4, 8 + data.length);
  const crc = calculateCrc32(crcData);
  writeUint32BE(chunk, 8 + data.length, crc);

  return chunk;
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
    crc = (CRC_TABLE[(crc ^ (data[i] ?? 0)) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
