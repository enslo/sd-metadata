import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readPngMetadata } from '../../../src/readers/png';

describe('PNG Readers - Samples', () => {
  const samplesDir = path.join(__dirname, '../../../../../samples/png');
  const samples = fs.readdirSync(samplesDir).sort();

  // Helper to load sample data
  const loadSample = (type: string, filename: string) => {
    const filePath = path.join(
      __dirname,
      `../../../../../samples/${type}`,
      filename,
    );
    return fs.readFileSync(filePath);
  };

  it('should have PNG samples', () => {
    expect(samples.length).toBeGreaterThan(0);
  });

  for (const file of samples) {
    it(`should read ${file} without errors`, () => {
      const data = loadSample('png', file);
      const result = readPngMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Empty file has no metadata chunks, others carry text chunks or an
        // eXIf chunk (CivitAI)
        const count =
          result.value.chunks.length + (result.value.exif?.length ?? 0);
        if (file === 'empty.png') {
          expect(count).toBe(0);
        } else {
          expect(count).toBeGreaterThan(0);
        }
      }
    });
  }
});
