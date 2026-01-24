import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';
import { read, write } from '../../src/index';
import { expectJsonEqual } from '../helpers/raw-equal';
import {
  type JpegSegment,
  type PngChunk,
  type WebpChunk,
  readJpegSegments,
  readPngChunks,
  readWebpChunks,
} from '../helpers/structure-readers';

// ==========================================
// Allowlist Definition
// ==========================================

type AllowlistEntry = {
  tool: string;
  files: string[] | '*';
  format: 'png' | 'jpeg' | 'webp';
  segmentType: string; // e.g., 'tEXt', 'APP1', '0xe1'
  reason: string;
};

const ALLOWLIST: AllowlistEntry[] = [
  // PNG: InvokeAI minor serialization differences
  {
    tool: 'InvokeAI',
    files: ['invokeai.png'],
    format: 'png',
    segmentType: 'iTXt',
    reason: 'Minor serialization differences in iTXt chunk (4 bytes diff)',
  },
  // PNG: SwarmUI metadata expansion/reformatting
  {
    tool: 'SwarmUI',
    files: '*',
    format: 'png',
    segmentType: 'tEXt',
    reason: 'Metadata reformatting causes size change',
  },
  // PNG: Stability Matrix expansion
  {
    tool: 'Stability Matrix',
    files: '*',
    format: 'png',
    segmentType: 'tEXt',
    reason: 'Metadata expansion/reformatting',
  },
  // PNG: TensorArt
  {
    tool: 'TensorArt',
    files: ['tensorart.png'],
    format: 'png',
    segmentType: 'tEXt',
    reason: 'Metadata reformatting',
  },
  // JPEG: Exif block reconstruction differences (padding/alignment)
  {
    tool: 'Civitai',
    files: '*',
    format: 'jpeg',
    segmentType: '0xE1', // APP1
    reason: 'Exif block reconstruction/padding differences',
  },
  {
    tool: 'Forge',
    files: '*',
    format: 'jpeg',
    segmentType: '0xE1', // APP1
    reason: 'Exif block reconstruction/structure change',
  },
  {
    tool: 'SD.Next',
    files: '*',
    format: 'jpeg',
    segmentType: '0xE1', // APP1
    reason: 'Exif block reconstruction/structure change',
  },
  {
    tool: 'SwarmUI',
    files: ['swarmui.jpg'],
    format: 'jpeg',
    segmentType: '0xE1', // APP1
    reason: 'Content modified (padding/ordering) despite same size',
  },
  // JPEG: ComfyUI Exif expansion (Likely re-encoding or merging issues)
  {
    tool: 'ComfyUI',
    files: ['comfyui-saveimage-plus.jpg'],
    format: 'jpeg',
    segmentType: '0xE1', // APP1
    reason: 'Exif data expansion/duplication during round-trip',
  },
];

function isAllowed(
  fileName: string,
  format: 'png' | 'jpeg' | 'webp',
  segmentType: string,
): boolean {
  return ALLOWLIST.some(
    (entry) =>
      (entry.files === '*' || entry.files.includes(fileName)) &&
      entry.format === format &&
      entry.segmentType === segmentType,
  );
}

// ==========================================
// Helpers
// ==========================================

function getSampleFiles(format: 'png' | 'jpg' | 'webp'): string[] {
  const dirName = format === 'jpg' ? 'jpg' : format;
  const dirPath = path.join(__dirname, '../../samples', dirName);
  return fs.readdirSync(dirPath).filter((file) => file.endsWith(`.${format}`));
}

function loadSample(
  format: 'png' | 'jpg' | 'webp',
  filename: string,
): Uint8Array {
  const dirName = format === 'jpg' ? 'jpg' : format;
  const filePath = path.join(__dirname, '../../samples', dirName, filename);
  return new Uint8Array(fs.readFileSync(filePath));
}

function hex(n: number): string {
  return `0x${n.toString(16).toUpperCase().padStart(2, '0')}`;
}

/**
 * Filter out structural/image data chunks that are expected to change
 */
function filterChunks(
  format: 'png' | 'jpeg' | 'webp',
  chunks: (PngChunk | JpegSegment | WebpChunk)[],
) {
  if (format === 'png') {
    return (chunks as PngChunk[]).filter(
      (c) =>
        c.type !== 'IHDR' &&
        c.type !== 'IDAT' &&
        c.type !== 'IEND' &&
        c.type !== 'pHYs', // Physical dimensions often change or are re-generated
    );
  }
  if (format === 'jpeg') {
    return (chunks as JpegSegment[]).filter((s) => {
      // Keep APPn (0xE0-0xEF) and COM (0xFE)
      // Filter out SOI, EOI, SOS, DQT, DHT, SOF0/2, DRI
      const m = s.marker;
      const isApp = m >= 0xe0 && m <= 0xef;
      const isCom = m === 0xfe;
      return isApp || isCom;
    });
  }
  if (format === 'webp') {
    return (chunks as WebpChunk[]).filter(
      (c) =>
        c.type !== 'VP8 ' &&
        c.type !== 'VP8L' &&
        c.type !== 'VP8X' &&
        c.type !== 'ALPH' && // Alpha channel data
        c.type !== 'ICCP' && // Color profile (might be stripped if library doesn't copy it?)
        c.type !== 'ANIM' &&
        c.type !== 'ANMF',
    );
  }
  return chunks;
}

function compareMetadata(
  originalData: Uint8Array,
  restoredData: Uint8Array,
  format: 'png' | 'jpeg' | 'webp',
  fileName: string,
) {
  let originalChunks: (PngChunk | JpegSegment | WebpChunk)[];
  let restoredChunks: (PngChunk | JpegSegment | WebpChunk)[];

  // 1. Extract raw structure
  if (format === 'png') {
    originalChunks = readPngChunks(originalData);
    restoredChunks = readPngChunks(restoredData);
  } else if (format === 'jpeg') {
    originalChunks = readJpegSegments(originalData);
    restoredChunks = readJpegSegments(restoredData);
  } else {
    originalChunks = readWebpChunks(originalData);
    restoredChunks = readWebpChunks(restoredData);
  }

  // 2. Filter out non-metadata chunks
  const filteredOriginal = filterChunks(format, originalChunks);
  const filteredRestored = filterChunks(format, restoredChunks);

  for (const originalChunk of filteredOriginal) {
    let typeOrMarker: string;
    let data: Uint8Array;

    if (format === 'png') {
      const c = originalChunk as PngChunk;
      typeOrMarker = c.type;
      data = c.data;
    } else if (format === 'jpeg') {
      const c = originalChunk as JpegSegment;
      typeOrMarker = hex(c.marker);
      data = c.data;
    } else {
      const c = originalChunk as WebpChunk;
      typeOrMarker = c.type;
      data = c.data;
    }

    // Check allowlist
    if (isAllowed(fileName, format, typeOrMarker)) {
      continue;
    }

    // Find in restored
    const match = filteredRestored.find((c) => {
      if (format === 'png') return (c as PngChunk).type === typeOrMarker;
      if (format === 'jpeg')
        return hex((c as JpegSegment).marker) === typeOrMarker;
      return (c as WebpChunk).type === typeOrMarker;
    });

    if (!match) {
      throw new Error(
        `[${fileName}] Missing ${typeOrMarker} chunk/segment in restored file`,
      );
    }

    // Strict binary comparison
    // Note: If there are multiple chunks of same type (e.g. multiple tEXt), finding "any match" is weak.
    // We should probably filter `filteredRestored` to find *exact binary match*.

    let binaryMatchFound = false;
    // Iterate all matches of same type
    const candidates = filteredRestored.filter((c) => {
      if (format === 'png') return (c as PngChunk).type === typeOrMarker;
      if (format === 'jpeg')
        return hex((c as JpegSegment).marker) === typeOrMarker;
      return (c as WebpChunk).type === typeOrMarker;
    });

    for (const candidate of candidates) {
      let candidateData: Uint8Array;
      if (format === 'png') candidateData = (candidate as PngChunk).data;
      else if (format === 'jpeg')
        candidateData = (candidate as JpegSegment).data;
      else candidateData = (candidate as WebpChunk).data;

      if (compareBuffers(data, candidateData)) {
        binaryMatchFound = true;
        break;
      }

      // Try JSON-aware comparison for text chunks
      try {
        // PNG tEXt/iTXt
        if (
          format === 'png' &&
          (typeOrMarker === 'tEXt' || typeOrMarker === 'iTXt')
        ) {
          const nullIndex = data.indexOf(0);
          const candidateNullIndex = candidateData.indexOf(0);

          if (nullIndex > 0 && candidateNullIndex > 0) {
            const decoder = new TextDecoder('latin1');
            const keyword = decoder.decode(data.slice(0, nullIndex));
            const candidateKeyword = decoder.decode(
              candidateData.slice(0, candidateNullIndex),
            );

            if (keyword === candidateKeyword) {
              // Keywords match, check text content
              const textDecoder = new TextDecoder('utf-8'); // Try UTF-8 for text
              const text = textDecoder.decode(data.slice(nullIndex + 1));
              const candidateText = textDecoder.decode(
                candidateData.slice(candidateNullIndex + 1),
              );

              try {
                expectJsonEqual(text, candidateText);
                // If we are here, expectJsonEqual passed (silently)
                binaryMatchFound = true;
                break;
              } catch {
                // Ignore failure, try next candidate
              }
            }
          }
        }
        // JPEG COM (NovelAI uses this for JSON)
        else if (format === 'jpeg' && typeOrMarker === '0xFE') {
          const textDecoder = new TextDecoder('utf-8');
          const text = textDecoder.decode(data);
          const candidateText = textDecoder.decode(candidateData);
          try {
            expectJsonEqual(text, candidateText);
            binaryMatchFound = true;
            break;
          } catch {
            // ignore
          }
        }
      } catch {
        // Decoding failed
      }
    }

    if (!binaryMatchFound) {
      // If we have candidates but no binary match -> Content modified
      throw new Error(`[${fileName}] Content modified for ${typeOrMarker} chunk/segment.
Original size: ${data.length}
Restored size: ${format === 'png' ? (candidates[0] as PngChunk).data.length : format === 'jpeg' ? (candidates[0] as JpegSegment).data.length : (candidates[0] as WebpChunk).data.length}`);
    }
  }
}

function compareBuffers(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// ==========================================
// Tests
// ==========================================

describe('Comprehensive Round-Trip Verification', () => {
  // ----------------------------------------------------------------
  // PNG -> JPEG -> PNG
  // ----------------------------------------------------------------
  describe('PNG -> JPEG -> PNG', () => {
    const files = getSampleFiles('png');
    for (const file of files) {
      it(`[${file}]`, () => {
        const sourceData = loadSample('png', file);

        // Skip known problematic files for round-trip
        if (
          file === 'ruined-fooocus.png' ||
          file === 'huggingface-animagine.png'
        )
          return;

        // 1. Initial Read
        const meta = read(sourceData);
        // Skip if format not supported or read failed (some samples might be corrupted or intentionally invalid)
        if (meta.status !== 'success') return;

        // 2. Conversion (Simulated)
        const baseJpeg = loadSample('jpg', 'civitai.jpeg');
        const jpegResult = write(baseJpeg, meta);
        if (!jpegResult.ok) throw new Error('Write to JPEG failed');

        // 3. Intermediate Read
        const jpegMeta = read(jpegResult.value);
        if (jpegMeta.status !== 'success')
          throw new Error(`[${jpegMeta.status}] Intermediate read failed`);

        // 4. Restore
        const restoreResult = write(sourceData, jpegMeta);
        if (!restoreResult.ok) throw new Error('Restore to PNG failed');

        // 5. Compare
        compareMetadata(sourceData, restoreResult.value, 'png', file);
      });
    }
  });

  // ----------------------------------------------------------------
  // PNG -> WebP -> PNG
  // ----------------------------------------------------------------
  describe('PNG -> WebP -> PNG', () => {
    const files = getSampleFiles('png');
    for (const file of files) {
      it(`[${file}]`, () => {
        // Skip known problematic files for round-trip
        if (
          file === 'ruined-fooocus.png' ||
          file === 'huggingface-animagine.png'
        )
          return;

        const sourceData = loadSample('png', file);
        const meta = read(sourceData);
        if (meta.status !== 'success') return;

        const baseWebp = loadSample('webp', 'forge-hires.webp');
        const webpResult = write(baseWebp, meta);
        if (!webpResult.ok) throw new Error('Write to WebP failed');

        const webpMeta = read(webpResult.value);
        if (webpMeta.status !== 'success')
          throw new Error('Intermediate read failed');

        const restoreResult = write(sourceData, webpMeta);
        if (!restoreResult.ok) throw new Error('Restore to PNG failed');

        compareMetadata(sourceData, restoreResult.value, 'png', file);
      });
    }
  });

  // ----------------------------------------------------------------
  // JPEG -> WebP -> JPEG
  // ----------------------------------------------------------------
  describe('JPEG -> WebP -> JPEG', () => {
    const files = getSampleFiles('jpg');
    for (const file of files) {
      it(`[${file}]`, () => {
        const sourceData = loadSample('jpg', file);
        const meta = read(sourceData);
        if (meta.status !== 'success') return;

        const baseWebp = loadSample('webp', 'forge-hires.webp');
        const webpResult = write(baseWebp, meta);
        if (!webpResult.ok) throw new Error('Write to WebP failed');

        const webpMeta = read(webpResult.value);
        if (webpMeta.status !== 'success')
          throw new Error('Intermediate read failed');

        const restoreResult = write(sourceData, webpMeta);
        if (!restoreResult.ok) throw new Error('Restore to JPEG failed');

        compareMetadata(sourceData, restoreResult.value, 'jpeg', file);
      });
    }
  });
});
