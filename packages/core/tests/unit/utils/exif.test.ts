import { describe, expect, it } from 'vitest';
import {
  decodeUserComment,
  parseExifMetadataSegments,
} from '../../../src/readers/exif';
import type { MetadataSegment } from '../../../src/types';
import {
  IMAGE_DESCRIPTION_TAG,
  MAKE_TAG,
  MODEL_TAG,
} from '../../../src/utils/exif-constants';
import { buildExifTiffData } from '../../../src/writers/exif';

/**
 * Decode the raw ASCII tag value (prefix + separator + payload, exactly as
 * encoded) for the given tag out of a built TIFF. Unlike
 * parseExifMetadataSegments, this does not strip the prefix/separator, so it
 * can verify the literal bytes written — needed because a decode-based
 * round-trip can't distinguish "workflow: {...}" from "workflow:{...}" (the
 * reader's prefix regex tolerates both).
 */
function readAsciiTagRaw(tiff: Uint8Array, tag: number): string | undefined {
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const ifd0Offset = view.getUint32(4, true);
  const entryCount = view.getUint16(ifd0Offset, true);

  for (let i = 0; i < entryCount; i++) {
    const entryOffset = ifd0Offset + 2 + i * 12;
    if (view.getUint16(entryOffset, true) !== tag) continue;

    const byteCount = view.getUint32(entryOffset + 4, true);
    const valueOffset =
      byteCount <= 4 ? entryOffset + 8 : view.getUint32(entryOffset + 8, true);
    const bytes = tiff.subarray(valueOffset, valueOffset + byteCount - 1); // drop null terminator
    return new TextDecoder().decode(bytes);
  }
  return undefined;
}

/**
 * Build a little-endian TIFF holding a single ASCII tag with the exact text
 *
 * buildExifTiffData writes ": " between a prefix and its payload, except for
 * the "workflow"/"prompt" labels (Save Animated WEBP's own "key:value", no
 * space), so this helper is needed to construct any OTHER separator by hand.
 */
function buildAsciiTagTiff(tag: number, text: string): Uint8Array {
  const textBytes = new TextEncoder().encode(`${text}\0`);
  // 8 header + 2 entry count + 12 entry + 4 next-IFD pointer
  const valueOffset = 26;
  const data = new Uint8Array(valueOffset + textBytes.length);
  const view = new DataView(data.buffer);

  data.set([0x49, 0x49], 0); // "II" (little-endian)
  view.setUint16(2, 42, true); // TIFF magic
  view.setUint32(4, 8, true); // IFD0 offset
  view.setUint16(8, 1, true); // Entry count
  view.setUint16(10, tag, true);
  view.setUint16(12, 2, true); // ASCII
  view.setUint32(14, textBytes.length, true);
  view.setUint32(18, valueOffset, true);
  view.setUint32(22, 0, true); // No next IFD
  data.set(textBytes, valueOffset);

  return data;
}

describe('Exif Utils - Decoding', () => {
  describe('decodeUserComment', () => {
    it('should decode ASCII prefix UserComment', () => {
      const data = new Uint8Array([
        0x41,
        0x53,
        0x43,
        0x49,
        0x49,
        0x00,
        0x00,
        0x00, // "ASCII\0\0\0"
        0x54,
        0x65,
        0x73,
        0x74, // "Test"
      ]);

      const result = decodeUserComment(data);

      expect(result).toBe('Test');
    });

    it('should decode UNICODE prefix UserComment (UTF-16LE)', () => {
      const data = new Uint8Array([
        0x55,
        0x4e,
        0x49,
        0x43,
        0x4f,
        0x44,
        0x45,
        0x00, // "UNICODE\0"
        0x54,
        0x00,
        0x65,
        0x00,
        0x73,
        0x00,
        0x74,
        0x00, // "Test" in UTF-16LE
      ]);

      const result = decodeUserComment(data);

      expect(result).toBe('Test');
    });

    it('should decode UNICODE prefix UserComment (UTF-16BE)', () => {
      const data = new Uint8Array([
        0x55,
        0x4e,
        0x49,
        0x43,
        0x4f,
        0x44,
        0x45,
        0x00, // "UNICODE\0"
        0x00,
        0x54,
        0x00,
        0x65,
        0x00,
        0x73,
        0x00,
        0x74, // "Test" in UTF-16BE
      ]);

      const result = decodeUserComment(data);

      expect(result).toBe('Test');
    });

    it('should decode UTF-8 without prefix (ComfyUI format)', () => {
      const jsonData = JSON.stringify({ prompt: 'test' });
      const data = new TextEncoder().encode(jsonData);

      const result = decodeUserComment(data);

      expect(result).toBe(jsonData);
    });

    it('should return null for empty or invalid data', () => {
      expect(decodeUserComment(new Uint8Array([]))).toBeNull();
      expect(decodeUserComment(new Uint8Array([0x00, 0x00]))).toBeNull();
    });

    it('should strip null terminator from UTF-8', () => {
      const text = '{"test":"value"}\0';
      const data = new TextEncoder().encode(text);

      const result = decodeUserComment(data);

      expect(result).toBe('{"test":"value"}');
    });
  });

  describe('parseExifMetadataSegments', () => {
    it('should parse little-endian TIFF with UserComment', () => {
      // Build a minimal TIFF with UserComment
      const segments: MetadataSegment[] = [
        { source: { type: 'exifUserComment' }, data: 'Test comment' },
      ];
      const tiffData = buildExifTiffData(segments);

      const result = parseExifMetadataSegments(tiffData);

      expect(result).toHaveLength(1);
      expect(result.at(0)?.source.type).toBe('exifUserComment');
      expect(result.at(0)?.data).toBe('Test comment');
    });

    it('should parse big-endian TIFF', () => {
      // Manual big-endian TIFF with empty IFD
      const data = new Uint8Array([
        0x4d,
        0x4d, // "MM" (big-endian)
        0x00,
        0x2a, // Magic 42
        0x00,
        0x00,
        0x00,
        0x08, // IFD0 offset
        0x00,
        0x00, // 0 entries
        0x00,
        0x00,
        0x00,
        0x00, // Next IFD
      ]);

      const result = parseExifMetadataSegments(data);

      expect(result).toEqual([]);
    });

    it('should extract ImageDescription tag', () => {
      const segments: MetadataSegment[] = [
        { source: { type: 'exifImageDescription' }, data: 'Test description' },
      ];
      const tiffData = buildExifTiffData(segments);

      const result = parseExifMetadataSegments(tiffData);

      expect(result).toHaveLength(1);
      expect(result.at(0)?.source.type).toBe('exifImageDescription');
      expect(result.at(0)?.data).toBe('Test description');
    });

    it('should extract Make tag', () => {
      const segments: MetadataSegment[] = [
        { source: { type: 'exifMake' }, data: 'Test make' },
      ];
      const tiffData = buildExifTiffData(segments);

      const result = parseExifMetadataSegments(tiffData);

      expect(result).toHaveLength(1);
      expect(result.at(0)?.source.type).toBe('exifMake');
      expect(result.at(0)?.data).toBe('Test make');
    });

    it('should extract Model tag', () => {
      const segments: MetadataSegment[] = [
        { source: { type: 'exifModel' }, data: 'Test model' },
      ];
      const tiffData = buildExifTiffData(segments);

      const result = parseExifMetadataSegments(tiffData);

      expect(result).toHaveLength(1);
      expect(result.at(0)?.source.type).toBe('exifModel');
      expect(result.at(0)?.data).toBe('Test model');
    });

    it('should handle prefix extraction for ImageDescription', () => {
      const segments: MetadataSegment[] = [
        {
          source: { type: 'exifImageDescription', prefix: 'Workflow' },
          data: '{"test": true}',
        },
      ];
      const tiffData = buildExifTiffData(segments);

      const result = parseExifMetadataSegments(tiffData);

      expect(result).toHaveLength(1);
      const segment = result.at(0);

      expect(segment?.source.type).toBe('exifImageDescription');
      if (segment?.source.type === 'exifImageDescription') {
        expect(segment.source.prefix).toBe('Workflow');
      }
      expect(segment?.data).toBe('{"test": true}');
    });

    it('should extract a prefix written without a space after the colon', () => {
      // Save Animated WEBP writes Make as "workflow:{...}" (no space)
      const tiffData = buildAsciiTagTiff(MAKE_TAG, 'workflow:{"nodes": []}');

      const result = parseExifMetadataSegments(tiffData);

      expect(result).toHaveLength(1);
      expect(result.at(0)?.source).toEqual({
        type: 'exifMake',
        prefix: 'workflow',
      });
      expect(result.at(0)?.data).toBe('{"nodes": []}');
    });

    it('should keep a colon that does not separate a prefix', () => {
      // A space-less colon only counts in front of JSON, so plain values
      // such as a camera maker URL must survive untouched.
      const tiffData = buildAsciiTagTiff(MAKE_TAG, 'http://example.com');

      const result = parseExifMetadataSegments(tiffData);

      expect(result).toHaveLength(1);
      expect(result.at(0)?.source).toEqual({ type: 'exifMake' });
      expect(result.at(0)?.data).toBe('http://example.com');
    });

    it('should return empty array for invalid TIFF (bad byte order)', () => {
      const data = new Uint8Array([0x00, 0x00, 0x00, 0x2a]);

      const result = parseExifMetadataSegments(data);

      expect(result).toEqual([]);
    });

    it('should return empty array for invalid TIFF (bad magic number)', () => {
      const data = new Uint8Array([
        0x49,
        0x49, // "II" (little-endian)
        0x00,
        0x00, // Wrong magic
        0x00,
        0x00,
        0x00,
        0x08,
      ]);

      const result = parseExifMetadataSegments(data);

      expect(result).toEqual([]);
    });

    it('should return empty array for too short data', () => {
      const data = new Uint8Array([0x49, 0x49]);

      const result = parseExifMetadataSegments(data);

      expect(result).toEqual([]);
    });
  });
});

describe('Exif Utils - Encoding', () => {
  describe('buildExifTiffData', () => {
    it('should build TIFF with UserComment', () => {
      const segments: MetadataSegment[] = [
        { source: { type: 'exifUserComment' }, data: 'Test' },
      ];

      const result = buildExifTiffData(segments);

      expect(result.length).toBeGreaterThan(0);
      // Check TIFF header
      expect(result.at(0)).toBe(0x49); // 'I'
      expect(result.at(1)).toBe(0x49); // 'I'
      expect(result.at(2)).toBe(42); // Magic (LE)
      expect(result.at(3)).toBe(0);
    });

    it('should build TIFF with ImageDescription', () => {
      const segments: MetadataSegment[] = [
        { source: { type: 'exifImageDescription' }, data: 'Description' },
      ];

      const result = buildExifTiffData(segments);

      expect(result.length).toBeGreaterThan(0);
      expect(result.at(0)).toBe(0x49);
      expect(result.at(1)).toBe(0x49);
    });

    it('should build TIFF with Make tag', () => {
      const segments: MetadataSegment[] = [
        { source: { type: 'exifMake' }, data: 'Maker' },
      ];

      const result = buildExifTiffData(segments);

      expect(result.length).toBeGreaterThan(0);
    });

    it('should build TIFF with prefix for ImageDescription', () => {
      const segments: MetadataSegment[] = [
        {
          source: { type: 'exifImageDescription', prefix: 'Workflow' },
          data: '{}',
        },
      ];

      const result = buildExifTiffData(segments);

      expect(result.length).toBeGreaterThan(0);
    });

    it('should write workflow/prompt prefixes without a space, matching Save Animated WEBP exactly', () => {
      const segments: MetadataSegment[] = [
        {
          source: { type: 'exifMake', prefix: 'workflow' },
          data: '{"nodes": []}',
        },
        { source: { type: 'exifModel', prefix: 'prompt' }, data: '{"1": {}}' },
      ];

      const result = buildExifTiffData(segments);

      expect(readAsciiTagRaw(result, MAKE_TAG)).toBe('workflow:{"nodes": []}');
      expect(readAsciiTagRaw(result, MODEL_TAG)).toBe('prompt:{"1": {}}');
    });

    it('should keep a space after every other prefix (e.g. save-image-extended)', () => {
      const segments: MetadataSegment[] = [
        {
          source: { type: 'exifImageDescription', prefix: 'Workflow' },
          data: '{"nodes": []}',
        },
        { source: { type: 'exifMake', prefix: 'Prompt' }, data: '{"1": {}}' },
      ];

      const result = buildExifTiffData(segments);

      expect(readAsciiTagRaw(result, IMAGE_DESCRIPTION_TAG)).toBe(
        'Workflow: {"nodes": []}',
      );
      expect(readAsciiTagRaw(result, MAKE_TAG)).toBe('Prompt: {"1": {}}');
    });

    it('should build TIFF with multiple segments', () => {
      const segments: MetadataSegment[] = [
        { source: { type: 'exifImageDescription' }, data: 'Desc' },
        { source: { type: 'exifMake' }, data: 'Make' },
        { source: { type: 'exifUserComment' }, data: 'Comment' },
      ];

      const result = buildExifTiffData(segments);

      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty array for empty segments', () => {
      const result = buildExifTiffData([]);

      expect(result).toEqual(new Uint8Array(0));
    });

    it('should return empty array for non-Exif segments', () => {
      const segments: MetadataSegment[] = [
        { source: { type: 'jpegCom' }, data: 'test' },
      ];

      const result = buildExifTiffData(segments);

      expect(result).toEqual(new Uint8Array(0));
    });
  });
});

describe('Exif Utils - Round-trip', () => {
  it('should preserve UserComment through encode-decode cycle', () => {
    const original = 'Test comment with 日本語';
    const segments: MetadataSegment[] = [
      { source: { type: 'exifUserComment' }, data: original },
    ];

    const encoded = buildExifTiffData(segments);
    const decoded = parseExifMetadataSegments(encoded);

    expect(decoded).toHaveLength(1);
    expect(decoded.at(0)?.data).toBe(original);
  });

  it('should preserve ImageDescription through encode-decode cycle', () => {
    const original = 'Test description';
    const segments: MetadataSegment[] = [
      { source: { type: 'exifImageDescription' }, data: original },
    ];

    const encoded = buildExifTiffData(segments);
    const decoded = parseExifMetadataSegments(encoded);

    expect(decoded).toHaveLength(1);
    expect(decoded.at(0)?.data).toBe(original);
  });

  it('should preserve Make through encode-decode cycle', () => {
    const original = 'Test make';
    const segments: MetadataSegment[] = [
      { source: { type: 'exifMake' }, data: original },
    ];

    const encoded = buildExifTiffData(segments);
    const decoded = parseExifMetadataSegments(encoded);

    expect(decoded).toHaveLength(1);
    expect(decoded.at(0)?.data).toBe(original);
  });

  it('should preserve the Save Animated WEBP tag layout through encode-decode cycle', () => {
    // Make carries the workflow and Model the prompt here — the reverse of
    // save-image-extended, so the labels are what keeps the two apart.
    const segments: MetadataSegment[] = [
      {
        source: { type: 'exifMake', prefix: 'workflow' },
        data: '{"nodes": []}',
      },
      {
        source: { type: 'exifModel', prefix: 'prompt' },
        data: '{"1": {"class_type": "KSampler"}}',
      },
    ];

    const encoded = buildExifTiffData(segments);
    const decoded = parseExifMetadataSegments(encoded);

    expect(decoded).toEqual(segments);
  });

  it('should preserve prefix through encode-decode cycle', () => {
    const segments: MetadataSegment[] = [
      {
        source: { type: 'exifImageDescription', prefix: 'Workflow' },
        data: '{"test": true}',
      },
    ];

    const encoded = buildExifTiffData(segments);
    const decoded = parseExifMetadataSegments(encoded);

    expect(decoded).toHaveLength(1);
    const segment = decoded.at(0);

    if (segment?.source.type === 'exifImageDescription') {
      expect(segment.source.prefix).toBe('Workflow');
    }
    expect(segment?.data).toBe('{"test": true}');
  });

  it('should preserve multiple segments through encode-decode cycle', () => {
    const segments: MetadataSegment[] = [
      { source: { type: 'exifImageDescription' }, data: 'Desc' },
      { source: { type: 'exifMake' }, data: 'Make' },
      { source: { type: 'exifUserComment' }, data: 'Comment' },
    ];

    const encoded = buildExifTiffData(segments);
    const decoded = parseExifMetadataSegments(encoded);

    expect(decoded).toHaveLength(3);
    // Sort both arrays by type for comparison
    const sortedOriginal = [...segments].sort((a, b) =>
      a.source.type.localeCompare(b.source.type),
    );
    const sortedDecoded = [...decoded].sort((a, b) =>
      a.source.type.localeCompare(b.source.type),
    );

    for (let i = 0; i < sortedOriginal.length; i++) {
      expect(sortedDecoded.at(i)?.source.type).toBe(
        sortedOriginal.at(i)?.source.type,
      );
      expect(sortedDecoded.at(i)?.data).toBe(sortedOriginal.at(i)?.data);
    }
  });

  it('should preserve long text through encode-decode cycle', () => {
    const original = 'A'.repeat(1000);
    const segments: MetadataSegment[] = [
      { source: { type: 'exifUserComment' }, data: original },
    ];

    const encoded = buildExifTiffData(segments);
    const decoded = parseExifMetadataSegments(encoded);

    expect(decoded).toHaveLength(1);
    expect(decoded.at(0)?.data).toBe(original);
  });

  it('should preserve special characters through encode-decode cycle', () => {
    const original = 'Test with émojis 🎨 and unicode ✨';
    const segments: MetadataSegment[] = [
      { source: { type: 'exifUserComment' }, data: original },
    ];

    const encoded = buildExifTiffData(segments);
    const decoded = parseExifMetadataSegments(encoded);

    expect(decoded).toHaveLength(1);
    expect(decoded.at(0)?.data).toBe(original);
  });
});
