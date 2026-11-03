import { describe, expect, it } from 'vitest';
import {
  convertDezgoPngToSegments,
  convertDezgoSegmentsToPng,
} from '../../../src/converters/dezgo';
import type { MetadataSegment } from '../../../src/types';

const YAML =
  '\nJobId: job\nFunction: text2image_sdxl\nInput:\n  prompt: a cat\n';

describe('Dezgo converter', () => {
  it('should turn no text chunk into a segment (GenInfo has no JPEG/WebP slot)', () => {
    expect(
      convertDezgoPngToSegments([
        { type: 'tEXt', keyword: 'GenInfo', text: '{"JobId": "job"}' },
        { type: 'tEXt', keyword: 'GenCode', text: 'code' },
      ]),
    ).toEqual([]);
  });

  it('should put the EXIF segments into an eXIf chunk', () => {
    const segments: MetadataSegment[] = [
      { source: { type: 'exifUserComment' }, data: YAML },
      { source: { type: 'jpegCom' }, data: 'not EXIF' },
    ];

    expect(convertDezgoSegmentsToPng(segments)).toEqual({
      chunks: [],
      exif: [{ source: { type: 'exifUserComment' }, data: YAML }],
    });
  });
});
