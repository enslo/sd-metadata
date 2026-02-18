import type { ITXtChunk, PngTextChunk, TExtChunk } from '../types';
import { Result } from '../types';
import { isPng, readChunkType, readUint32BE } from '../utils/binary';

// Internal types (co-located with reader)
type PngReadError =
  | { type: 'invalidSignature' }
  | { type: 'corruptedChunk'; message: string };

type PngMetadataResult = Result<PngTextChunk[], PngReadError>;

/**
 * Read PNG metadata from binary data
 * @param data - PNG file data as Uint8Array
 * @returns Result containing metadata or error
 */
export function readPngMetadata(data: Uint8Array): PngMetadataResult {
  // Validate PNG signature
  if (!isPng(data)) {
    return Result.error({ type: 'invalidSignature' });
  }

  // Extract text chunks
  const chunksResult = extractTextChunks(data);
  if (!chunksResult.ok) {
    return chunksResult;
  }

  return Result.ok(chunksResult.value);
}

/**
 * Extract tEXt and iTXt chunks from PNG data
 */
// 8 bytes for PNG signature
const PNG_SIGNATURE_LENGTH = 8;

/**
 * Extract tEXt and iTXt chunks from PNG data
 */
function extractTextChunks(
  data: Uint8Array,
): Result<PngTextChunk[], PngReadError> {
  const chunks: PngTextChunk[] = [];
  let offset = PNG_SIGNATURE_LENGTH;

  while (offset < data.length) {
    // Read chunk length (4 bytes, big-endian)
    if (offset + 4 > data.length) {
      return Result.error({
        type: 'corruptedChunk',
        message: 'Unexpected end of file while reading chunk length',
      });
    }
    const length = readUint32BE(data, offset);
    offset += 4;

    // Read chunk type (4 bytes)
    if (offset + 4 > data.length) {
      return Result.error({
        type: 'corruptedChunk',
        message: 'Unexpected end of file while reading chunk type',
      });
    }
    const chunkType = readChunkType(data, offset);
    offset += 4;

    // Read chunk data
    if (offset + length > data.length) {
      return Result.error({
        type: 'corruptedChunk',
        message: `Unexpected end of file while reading chunk data (${chunkType})`,
      });
    }
    const chunkData = data.slice(offset, offset + length);
    offset += length;

    // Skip CRC (4 bytes)
    offset += 4;

    // Parse text chunks
    if (chunkType === 'tEXt') {
      const parsed = parseTExtChunk(chunkData);
      if (parsed) {
        chunks.push(parsed);
      }
    } else if (chunkType === 'iTXt') {
      const parsed = parseITXtChunk(chunkData);
      if (parsed) {
        chunks.push(parsed);
      }
    }

    // Stop at IEND
    if (chunkType === 'IEND') {
      break;
    }
  }

  return Result.ok(chunks);
}

/**
 * Parse tEXt chunk data
 *
 * Per PNG specification, tEXt chunks use Latin-1 (ISO-8859-1) encoding.
 * However, some tools (notably TensorArt) incorrectly write UTF-8 bytes
 * directly into tEXt chunks. To handle these non-compliant tools, we
 * attempt UTF-8 decoding first and fall back to Latin-1 if that fails.
 */
function parseTExtChunk(data: Uint8Array): TExtChunk | null {
  // Find null separator
  const nullIndex = data.indexOf(0);
  if (nullIndex === -1) {
    return null;
  }

  // Keyword is Latin-1 encoded (per spec, keywords are ASCII-safe)
  const keyword = latin1Decode(data.slice(0, nullIndex));

  // Text: Try UTF-8 first (for non-compliant tools), fallback to Latin-1
  const textData = data.slice(nullIndex + 1);
  const text = tryUtf8Decode(textData) ?? latin1Decode(textData);

  return { type: 'tEXt', keyword, text };
}

/**
 * Try to decode data as UTF-8, return null if invalid
 */
function tryUtf8Decode(data: Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(data);
  } catch {
    return null;
  }
}

/**
 * Parse iTXt chunk data
 */
function parseITXtChunk(data: Uint8Array): ITXtChunk | null {
  let offset = 0;

  // Read keyword (null-terminated)
  const keywordEnd = findNull(data, offset);
  if (keywordEnd === -1) return null;
  const keyword = utf8Decode(data.slice(offset, keywordEnd));
  offset = keywordEnd + 1;

  // Read compression flag (1 byte)
  if (offset >= data.length) return null;
  const compressionFlag = data[offset] ?? 0;
  offset += 1;

  // Read compression method (1 byte)
  if (offset >= data.length) return null;
  const compressionMethod = data[offset] ?? 0;
  offset += 1;

  // Read language tag (null-terminated)
  const langEnd = findNull(data, offset);
  if (langEnd === -1) return null;
  const languageTag = utf8Decode(data.slice(offset, langEnd));
  offset = langEnd + 1;

  // Read translated keyword (null-terminated)
  const transEnd = findNull(data, offset);
  if (transEnd === -1) return null;
  const translatedKeyword = utf8Decode(data.slice(offset, transEnd));
  offset = transEnd + 1;

  // Read text (rest of data)
  let text: string;
  if (compressionFlag === 1) {
    // Compressed with zlib
    const decompressed = decompressZlib(data.slice(offset));
    if (!decompressed) return null;
    text = utf8Decode(decompressed);
  } else {
    text = utf8Decode(data.slice(offset));
  }

  return {
    type: 'iTXt',
    keyword,
    compressionFlag,
    compressionMethod,
    languageTag,
    translatedKeyword,
    text,
  };
}

/**
 * Find null byte in data starting from offset
 */
function findNull(data: Uint8Array, offset: number): number {
  for (let i = offset; i < data.length; i++) {
    if (data[i] === 0) {
      return i;
    }
  }
  return -1;
}

/**
 * Decode Latin-1 (ISO-8859-1) bytes to string
 */
function latin1Decode(data: Uint8Array): string {
  let result = '';
  for (let i = 0; i < data.length; i++) {
    result += String.fromCharCode(data[i] ?? 0);
  }
  return result;
}

/**
 * Decode UTF-8 bytes to string
 */
function utf8Decode(data: Uint8Array): string {
  return new TextDecoder('utf-8').decode(data);
}

/**
 * Decompress zlib-compressed data
 *
 * Currently unimplemented: All surveyed sample images use uncompressed iTXt.
 * When a sample with compressed iTXt is found, implement using pako library.
 *
 * @see https://www.npmjs.com/package/pako
 */
function decompressZlib(_data: Uint8Array): Uint8Array | null {
  // Not yet implemented - no compressed iTXt samples encountered
  return null;
}
