import type { MetadataSegment } from '../types';
import { Result } from '../types';
import { buildExifTiffData } from './exif';

import { isJpeg } from '../utils/binary';

// Internal types (co-located with writer)
type JpegWriteError =
  | { type: 'invalidSignature' }
  | { type: 'corruptedStructure'; message: string };

type JpegWriteResult = Result<Uint8Array, JpegWriteError>;

/** APP1 marker */
const APP1_MARKER = 0xe1;

/** COM (Comment) marker */
const COM_MARKER = 0xfe;

/** SOS (Start of Scan) marker */
const SOS_MARKER = 0xda;

/** EOI (End of Image) marker */
const EOI_MARKER = 0xd9;

/** Exif header: "Exif\0\0" */
const EXIF_HEADER = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);

/**
 * Write JPEG metadata to binary data
 *
 * Replaces existing metadata segments with the provided segments.
 * Each segment is written to its original location based on source type:
 * - jpegCom -> COM segment (before SOS)
 * - exifUserComment/exifImageDescription/exifMake -> APP1 Exif segment (after SOI)
 *
 * @param data - Original JPEG file data as Uint8Array
 * @param segments - Metadata segments to embed
 * @returns Result containing new JPEG data with embedded metadata
 */
export function writeJpegMetadata(
  data: Uint8Array,
  segments: MetadataSegment[],
): JpegWriteResult {
  // Validate JPEG signature
  if (!isJpeg(data)) {
    return Result.error({ type: 'invalidSignature' });
  }

  // Separate segments by destination
  const comSegments = segments.filter((s) => s.source.type === 'jpegCom');
  const exifSegments = segments.filter(
    (s) =>
      s.source.type === 'exifUserComment' ||
      s.source.type === 'exifImageDescription' ||
      s.source.type === 'exifMake',
  );

  // Collect non-metadata segments from original JPEG
  const collectResult = collectNonMetadataSegments(data);
  if (!collectResult.ok) {
    return collectResult;
  }

  const { beforeSos, scanData } = collectResult.value;

  // Build new APP1 Exif segment
  const app1Segment =
    exifSegments.length > 0 ? buildApp1Segment(exifSegments) : null;

  // Build new COM segments
  const comSegmentData = comSegments.map((s) => buildComSegment(s.data));

  // Calculate total size
  let totalSize = 2; // SOI
  if (app1Segment) {
    totalSize += app1Segment.length;
  }
  for (const seg of beforeSos) {
    totalSize += seg.length;
  }
  for (const com of comSegmentData) {
    totalSize += com.length;
  }
  totalSize += scanData.length;

  // Build output
  const output = new Uint8Array(totalSize);
  let offset = 0;

  // Write SOI
  output[offset++] = 0xff;
  output[offset++] = 0xd8;

  // Write APP1 Exif (immediately after SOI)
  if (app1Segment) {
    output.set(app1Segment, offset);
    offset += app1Segment.length;
  }

  // Write original non-metadata segments
  for (const seg of beforeSos) {
    output.set(seg, offset);
    offset += seg.length;
  }

  // Write COM segments (before SOS)
  for (const com of comSegmentData) {
    output.set(com, offset);
    offset += com.length;
  }

  // Write scan data (SOS to EOI)
  output.set(scanData, offset);

  return Result.ok(output);
}

/**
 * Collect non-metadata segments from JPEG
 *
 * Returns segments that are not APP1 Exif or COM, plus the scan data (SOS to EOI)
 */
function collectNonMetadataSegments(
  data: Uint8Array,
): Result<
  { beforeSos: Uint8Array[]; scanData: Uint8Array },
  { type: 'corruptedStructure'; message: string }
> {
  const beforeSos: Uint8Array[] = [];
  let offset = 2; // Skip SOI

  while (offset < data.length - 1) {
    // Check for marker
    if (data[offset] !== 0xff) {
      return Result.error({
        type: 'corruptedStructure',
        message: `Expected marker at offset ${offset}`,
      });
    }

    // Skip padding bytes
    while (data[offset] === 0xff && offset < data.length - 1) {
      offset++;
    }

    const marker = data[offset];
    offset++;

    // Check for SOS - everything after this is scan data
    if (marker === SOS_MARKER) {
      // Include SOS marker in scan data
      const scanData = data.slice(offset - 2);
      return Result.ok({ beforeSos, scanData });
    }

    // Check for EOI (shouldn't happen before SOS but handle it)
    if (marker === EOI_MARKER) {
      return Result.ok({ beforeSos, scanData: new Uint8Array([0xff, 0xd9]) });
    }

    // Get segment length (big-endian, includes length bytes)
    if (offset + 2 > data.length) {
      return Result.error({
        type: 'corruptedStructure',
        message: 'Unexpected end of file',
      });
    }

    const length = ((data[offset] ?? 0) << 8) | (data[offset + 1] ?? 0);
    const segmentStart = offset - 2; // Include marker
    const segmentEnd = offset + length;

    if (segmentEnd > data.length) {
      return Result.error({
        type: 'corruptedStructure',
        message: 'Segment extends beyond file',
      });
    }

    // Check if this is a metadata segment we want to strip
    const isExifApp1 =
      marker === APP1_MARKER &&
      offset + 2 + 6 <= data.length &&
      data[offset + 2] === 0x45 && // E
      data[offset + 3] === 0x78 && // x
      data[offset + 4] === 0x69 && // i
      data[offset + 5] === 0x66 && // f
      data[offset + 6] === 0x00 && // NULL
      data[offset + 7] === 0x00; // NULL

    const isCom = marker === COM_MARKER;

    // Keep non-metadata segments
    if (!isExifApp1 && !isCom) {
      beforeSos.push(data.slice(segmentStart, segmentEnd));
    }

    offset = segmentEnd;
  }

  // If we reach here without finding SOS, the JPEG is malformed
  return Result.error({
    type: 'corruptedStructure',
    message: 'No SOS marker found',
  });
}

/**
 * Build APP1 Exif segment from metadata segments
 */
function buildApp1Segment(segments: MetadataSegment[]): Uint8Array {
  const tiffData = buildExifTiffData(segments);

  if (tiffData.length === 0) {
    return new Uint8Array(0);
  }

  // APP1 segment: marker (2) + length (2) + Exif header (6) + TIFF data
  const segmentLength = 2 + EXIF_HEADER.length + tiffData.length;
  const segment = new Uint8Array(2 + segmentLength);

  segment[0] = 0xff;
  segment[1] = APP1_MARKER;
  segment[2] = (segmentLength >> 8) & 0xff;
  segment[3] = segmentLength & 0xff;
  segment.set(EXIF_HEADER, 4);
  segment.set(tiffData, 4 + EXIF_HEADER.length);

  return segment;
}

/**
 * Build COM segment from text
 */
function buildComSegment(text: string): Uint8Array {
  const textBytes = new TextEncoder().encode(text);
  const segmentLength = 2 + textBytes.length; // length field includes itself

  const segment = new Uint8Array(2 + segmentLength);
  segment[0] = 0xff;
  segment[1] = COM_MARKER;
  segment[2] = (segmentLength >> 8) & 0xff;
  segment[3] = segmentLength & 0xff;
  segment.set(textBytes, 4);

  return segment;
}
