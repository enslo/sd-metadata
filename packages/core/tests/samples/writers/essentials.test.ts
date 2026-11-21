import { describe, expect, it } from 'vitest';
import { read } from '../../../src/api/read';
import {
  writeEssentialJpeg,
  writeEssentialPng,
  writeEssentialWebp,
} from '../../../src/writers/essentials';
import { jpegSegments, pngChunkTypes } from '../../helpers/containers';
import {
  listSampleFiles,
  loadSample,
  loadVendorSample,
  VENDOR_SAMPLES,
} from '../../helpers/samples';
import { readWebpChunks } from '../../helpers/webp-pixels';

/**
 * What the samples carry besides the picture, by container block.
 *
 * The writers keep a short list of blocks and drop everything else, so the
 * question a real file answers is the reverse one: was anything dropped
 * that a decoder needs? Across every sample, the generation tools' and the
 * vendors' alike, the dropped blocks are these and no other:
 *
 * - PNG: text (tEXt, iTXt), EXIF (eXIf, written by CivitAI), GIMP's
 *   modification time (tIME), and the C2PA manifest of ChatGPT and Gemini
 *   images (caBX).
 * - JPEG: EXIF and XMP (APP1), the C2PA manifest (APP11, "JP"), Photoshop
 *   data (APP13), and comments (COM, 0xFE).
 * - WebP: the EXIF and XMP chunks.
 *
 * With that established on the blocks, the pixels are compared on a few
 * samples only, in tests/samples/api/strip.test.ts.
 */
const FORMATS = [
  {
    format: 'png',
    write: writeEssentialPng,
    blocks: pngChunkTypes,
    dropped: ['caBX', 'eXIf', 'iTXt', 'tEXt', 'tIME'],
  },
  {
    format: 'jpg',
    write: writeEssentialJpeg,
    blocks: jpegSegments,
    dropped: [
      'e1:Exif',
      'e1:http://ns.adobe.com/xap/1.0/',
      'eb:JP',
      'ed:Photoshop',
      'fe',
    ],
  },
  {
    format: 'webp',
    write: writeEssentialWebp,
    blocks: (data: Uint8Array) => readWebpChunks(data).map((c) => c.type),
    dropped: ['EXIF', 'XMP '],
  },
] as const;

for (const { format, write, blocks, dropped } of FORMATS) {
  describe(`writeEssential - ${format} samples`, () => {
    const files: [name: string, load: () => Uint8Array][] = [
      ...listSampleFiles(format).map((name): [string, () => Uint8Array] => [
        name,
        () => loadSample(format, name),
      ]),
      ...VENDOR_SAMPLES.filter((sample) => sample.format === format).map(
        ({ filename }): [string, () => Uint8Array] => [
          `vendor/${filename}`,
          () => loadVendorSample(format, filename),
        ],
      ),
    ];

    it('drops metadata blocks of the known kinds and nothing else', () => {
      const seen = new Set<string>();
      for (const [name, load] of files) {
        const original = load();
        const result = write(original);
        if (!result.ok) throw new Error(`${name}: ${result.error}`);

        // What is kept stays in order, and nothing is added
        const kept = blocks(result.value);
        for (const block of blocks(original)) {
          if (kept[0] === block) {
            kept.shift();
          } else {
            seen.add(block);
          }
        }
        expect(kept, name).toEqual([]);
      }
      expect([...seen].sort()).toEqual(dropped);
    });

    for (const [name, load] of files) {
      it(`leaves no metadata to read: ${name}`, () => {
        const result = write(load());

        // A vendor's declaration is gone as well
        expect(result.ok && read(result.value).status).toBe('empty');
      });
    }
  });
}
