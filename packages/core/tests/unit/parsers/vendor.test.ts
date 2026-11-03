import { describe, expect, it } from 'vitest';
import { detectVendor } from '../../../src/parsers/vendor';
import type { MetadataSegment, RawMetadata } from '../../../src/types';
import { createMinimalJpeg } from '../../helpers/minimal-images';

const AI_DST =
  'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia';

/** An XMP packet with an attribute-form DigitalSourceType and publishers. */
function xmp(digitalSourceType: string | undefined, publishers: string[] = []) {
  const dst = digitalSourceType
    ? ` iptcExt:DigitalSourceType="${digitalSourceType}"`
    : '';
  const publisher = publishers.length
    ? `<dc:publisher><rdf:Bag>${publishers.map((p) => `<rdf:li>${p}</rdf:li>`).join('')}</rdf:Bag></dc:publisher>`
    : '';
  return `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF><rdf:Description rdf:about=""${dst}>${publisher}</rdf:Description></rdf:RDF></x:xmpmeta>`;
}

const xmpSegment = (data: string): MetadataSegment => ({
  source: { type: 'xmpPacket' },
  data,
});

/** An EXIF ImageDescription as the reader splits "Signature: <base64>". */
const signatureSegment = (
  body: string,
  prefix = 'Signature',
): MetadataSegment => ({
  source: { type: 'exifImageDescription', prefix },
  data: body,
});

/** Base64 of `length` arbitrary bytes. */
const base64Of = (length: number): string =>
  Buffer.from(Array.from({ length }, (_, i) => (i * 37) & 0xff)).toString(
    'base64',
  );

const jpegRaw = (...segments: MetadataSegment[]): RawMetadata => ({
  format: 'jpeg',
  segments,
});

const detect = (raw: RawMetadata | undefined) =>
  detectVendor(createMinimalJpeg(), 'jpeg', raw);

describe('detectVendor - XMP', () => {
  it('names Meta from dc:publisher (Muse)', () => {
    expect(detect(jpegRaw(xmpSegment(xmp(AI_DST, ['Meta']))))).toEqual({
      vendor: 'meta',
      source: 'xmp',
    });
  });

  it('reports an unknown vendor when no publisher is written (Muse free tier)', () => {
    expect(detect(jpegRaw(xmpSegment(xmp(AI_DST))))).toEqual({
      vendor: 'unknown',
      source: 'xmp',
    });
  });

  it('reports an unknown vendor for a publisher other than Meta', () => {
    expect(detect(jpegRaw(xmpSegment(xmp(AI_DST, ['Example Corp']))))).toEqual({
      vendor: 'unknown',
      source: 'xmp',
    });
  });

  it('ignores XMP whose DigitalSourceType is not AI', () => {
    const camera = xmp(
      'http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture',
      ['Meta'],
    );
    expect(detect(jpegRaw(xmpSegment(camera)))).toBeNull();
  });

  it('ignores a Meta publisher without an AI declaration', () => {
    expect(detect(jpegRaw(xmpSegment(xmp(undefined, ['Meta']))))).toBeNull();
  });

  it('reads XMP from WebP the same way', () => {
    const raw: RawMetadata = {
      format: 'webp',
      segments: [xmpSegment(xmp(AI_DST, ['Meta']))],
    };
    expect(detectVendor(new Uint8Array(0), 'webp', raw)).toEqual({
      vendor: 'meta',
      source: 'xmp',
    });
  });
});

describe('detectVendor - xAI signature', () => {
  it('accepts a whole-value signature of 128 bytes or more', () => {
    for (const length of [128, 192, 256]) {
      expect(detect(jpegRaw(signatureSegment(base64Of(length))))).toEqual({
        vendor: 'xai',
        source: 'signature',
      });
    }
  });

  it('rejects a signature shorter than 128 bytes', () => {
    expect(detect(jpegRaw(signatureSegment(base64Of(127))))).toBeNull();
  });

  it('rejects a value that is not entirely base64', () => {
    const text = `${base64Of(192)} and some text`;
    expect(detect(jpegRaw(signatureSegment(text)))).toBeNull();
  });

  it('rejects a base64 value under another label', () => {
    expect(
      detect(jpegRaw(signatureSegment(base64Of(192), 'Workflow'))),
    ).toBeNull();
  });
});

describe('detectVendor - precedence', () => {
  it('prefers XMP over the signature', () => {
    const raw = jpegRaw(
      signatureSegment(base64Of(192)),
      xmpSegment(xmp(AI_DST, ['Meta'])),
    );
    expect(detect(raw)).toEqual({ vendor: 'meta', source: 'xmp' });
  });

  it('returns null without raw metadata or C2PA', () => {
    expect(detect(undefined)).toBeNull();
  });

  it('does not read XMP or signatures from PNG raw metadata', () => {
    const raw: RawMetadata = { format: 'png', chunks: [] };
    expect(detectVendor(new Uint8Array(0), 'png', raw)).toBeNull();
  });
});
