import type {
  GenerationSoftware,
  ITXtChunk,
  PngMetadataResult,
  PngReadError,
  PngTextChunk,
  TExtChunk,
} from '../types';
import { Result } from '../types';

/** PNG file signature (magic bytes) */
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * Read PNG metadata from binary data
 * @param data - PNG file data as Uint8Array
 * @returns Result containing metadata or error
 */
export function readPngMetadata(data: Uint8Array): PngMetadataResult {
  // Validate PNG signature
  if (!isValidPngSignature(data)) {
    return Result.error({ type: 'invalidSignature' });
  }

  // Extract text chunks
  const chunksResult = extractTextChunks(data);
  if (!chunksResult.ok) {
    return chunksResult;
  }

  // Detect software from chunks
  const software = detectSoftware(chunksResult.value);

  return Result.ok({
    chunks: chunksResult.value,
    software,
  });
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
 * Extract tEXt and iTXt chunks from PNG data
 */
function extractTextChunks(
  data: Uint8Array,
): Result<PngTextChunk[], PngReadError> {
  const chunks: PngTextChunk[] = [];
  let offset = PNG_SIGNATURE.length;

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
  const compressionFlag = data[offset];
  offset += 1;

  // Read compression method (1 byte)
  if (offset >= data.length) return null;
  const compressionMethod = data[offset];
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
    result += String.fromCharCode(data[i]);
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

/**
 * Detect generation software from chunks
 *
 * NOTE: This is a temporary implementation for testing purposes.
 * In the future, this logic should be moved to tool-specific parsers
 * in src/parsers/ directory. The reader should only extract raw chunks.
 */
function detectSoftware(chunks: PngTextChunk[]): GenerationSoftware | null {
  const chunkMap = new Map<string, string>();
  for (const chunk of chunks) {
    chunkMap.set(chunk.keyword, chunk.text);
  }

  // NovelAI: tEXt Software = "NovelAI"
  if (chunkMap.get('Software') === 'NovelAI') {
    return 'novelai';
  }

  // InvokeAI: iTXt invokeai_metadata
  if (chunkMap.has('invokeai_metadata')) {
    return 'invokeai';
  }

  // TensorArt: has generation_data chunk
  if (chunkMap.has('generation_data')) {
    return 'tensorart';
  }

  // Stability Matrix: has smproj chunk
  if (chunkMap.has('smproj')) {
    return 'stability-matrix';
  }

  // Check for parameters chunk (A1111 format)
  const parameters = chunkMap.get('parameters');
  if (parameters) {
    // SwarmUI: has sui_image_params
    if (parameters.includes('sui_image_params')) {
      return 'swarmui';
    }
    // Forge Neo: Version: neo
    if (parameters.includes('Version: neo')) {
      return 'forge-neo';
    }
    // Forge: Version: f*
    if (/Version: f\d/.test(parameters)) {
      return 'forge';
    }
    // SD WebUI: has parameters but no specific version
    return 'sd-webui';
  }

  // ComfyUI: has prompt chunk (JSON with class_type)
  const prompt = chunkMap.get('prompt');
  if (prompt?.includes('class_type')) {
    return 'comfyui';
  }

  // Animagine: check for specific markers (TBD)
  // For now, return null for unknown

  return null;
}
